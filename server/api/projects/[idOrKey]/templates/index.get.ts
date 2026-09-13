import {
	eq,
	asc,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { issueTemplates } from "../../../db/schema";
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
		.select()
		.from(issueTemplates)
		.where(eq(issueTemplates.projectId, project.id))
		.orderBy(issueTemplates.createdAt);

	return { templates: rows };
});
