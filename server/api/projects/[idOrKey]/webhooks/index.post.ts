import {
	eq,
	select,
	from,
	insert,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { webhooks } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { audit } from "../../../lib/audit";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

const EVENTS = [
	"issue.created",
	"issue.updated",
	"issue.status_changed",
	"issue.commented",
	"sprint.started",
	"sprint.completed",
	"secret.created",
] as const;

const createSchema = z.object({
	name: z.string().min(1).max(120),
	url: z.string().url(),
	events: z.array(z.enum(EVENTS)).min(1),
	preset: z.enum(["generic", "slack", "discord"]).default("generic"),
});

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const body = await readValidatedBody(event, createSchema.parse);
	const db = getDb();
	const signingSecret = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

	const [row] = await db
		.insert(webhooks)
		.values({
			projectId: project.id,
			name: body.name,
			url: body.url,
			events: body.events,
			preset: body.preset,
			signingSecret,
		})
		.returning();

	await audit(event, {
		action: "webhook.create",
		projectId: project.id,
		targetId: row.id,
		targetName: row.name,
	});

	return { webhook: row, signingSecret };
});
