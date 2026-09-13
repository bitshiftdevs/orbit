import {
	eq,
	select,
	from,
	insert,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { issueTemplates } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

const schema = z.object({
	name: z.string().min(1).max(120),
	description: z.string().max(2000).optional().nullable(),
	type: z.enum(["task", "bug", "story", "epic", "chore"]).default("task"),
	priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).default("medium"),
	labels: z.array(z.string().max(40)).max(20).default([]),
	body: z.string().max(20000).optional().nullable(),
});

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const body = await readValidatedBody(event, schema.parse);
	const db = getDb();

	const [row] = await db
		.insert(issueTemplates)
		.values({
			projectId: project.id,
			name: body.name,
			description: body.description ?? null,
			type: body.type,
			priority: body.priority,
			labels: body.labels,
			body: body.body ?? null,
			createdById: user.id,
		})
		.returning();

	return { template: row };
});
