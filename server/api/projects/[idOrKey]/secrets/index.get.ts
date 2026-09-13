import {
	desc,
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { secrets } from "../../../db/schema";
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
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdById: secrets.createdById,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		})
		.from(secrets)
		.where(eq(secrets.projectId, project.id))
		.orderBy(desc(secrets.updatedAt));

	return { secrets: rows };
});
