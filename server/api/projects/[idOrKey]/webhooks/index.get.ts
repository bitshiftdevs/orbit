import {
	desc,
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { webhooks } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			id: webhooks.id,
			name: webhooks.name,
			url: webhooks.url,
			events: webhooks.events,
			preset: webhooks.preset,
			active: webhooks.active,
			createdAt: webhooks.createdAt,
		})
		.from(webhooks)
		.where(eq(webhooks.projectId, project.id))
		.orderBy(desc(webhooks.createdAt));

	return { webhooks: rows };
});
