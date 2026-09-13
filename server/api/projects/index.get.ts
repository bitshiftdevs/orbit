import { and, desc, eq, innerJoin } from "drizzle-orm";
import { getDb } from "../../db/client";
import { projects, projectMembers } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const db = getDb();

	const rows =
		user.role === "owner"
			? await db.select().from(projects).orderBy(desc(projects.updatedAt))
			: await db
					.select({ project: projects })
					.from(projects)
					.innerJoin(
						projectMembers,
						and(
							eq(projectMembers.projectId, projects.id),
							eq(projectMembers.userId, user.id),
						),
					)
					.orderBy(desc(projects.updatedAt))
					.then((r) => r.map((x) => x.project));

	return { projects: rows };
});
