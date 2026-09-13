import {
	and,
	asc,
	eq,
	select,
	from,
	update,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { issues, projects } from "../../../db/schema";
import { assertMember } from "../../../lib/access";
import { midpoint } from "../../../lib/rank";
import { dispatch } from "../../../lib/webhooks";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

const STATUSES = [
	"backlog",
	"todo",
	"in_progress",
	"in_review",
	"done",
	"cancelled",
] as const;

const reorderSchema = z.object({
	status: z.enum(STATUSES),
	beforeId: z.string().uuid().optional().nullable(),
	afterId: z.string().uuid().optional().nullable(),
});

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const id = getRouterParam(event, "id") as string;
	const db = getDb();

	const [existing] = await db
		.select()
		.from(issues)
		.where(eq(issues.id, id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await assertMember(user, existing.projectId);

	const body = await readValidatedBody(event, reorderSchema.parse);
	let beforeRank: string | null = null;
	let afterRank: string | null = null;

	if (body.beforeId) {
		const [b] = await db
			.select({ rank: issues.rank })
			.from(issues)
			.where(eq(issues.id, body.beforeId!))
			.limit(1);
		beforeRank = b?.rank ?? null;
	}
	if (body.afterId) {
		const [a] = await db
			.select({ rank: issues.rank })
			.from(issues)
			.where(eq(issues.id, body.afterId!))
			.limit(1);
		afterRank = a?.rank ?? null;
	}

	const rank = midpoint(beforeRank, afterRank);
	const completedAt =
		body.status === "done" && existing.status !== "done"
			? new Date()
			: body.status !== "done"
				? null
				: existing.completedAt;

	const [row] = await db
		.update(issues)
		.set({
			status: body.status,
			rank,
			completedAt,
			updatedAt: new Date(),
		})
		.where(eq(issues.id, existing.id))
		.returning();

	if (body.status !== existing.status) {
		const [proj] = await db
			.select({ key: projects.key })
			.from(projects)
			.where(eq(projects.id, existing.projectId))
			.limit(1);
		dispatch(existing.projectId, "issue.status_changed", {
			key: `${proj?.key ?? ""}-${row.number}`,
			title: row.title,
			from: existing.status,
			status: row.status,
			actor: user.handle,
		});
	}

	return { issue: row };
});
