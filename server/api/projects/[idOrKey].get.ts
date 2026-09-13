import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { projects, projectMembers, users } from "../../db/schema";
import { loadProject } from "../../lib/access";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey");
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const db = getDb();

	const members = await db
		.select({
			id: users.id,
			name: users.name,
			handle: users.handle,
			email: users.email,
			avatarUrl: users.avatarUrl,
			accentColor: users.accentColor,
			role: users.role,
			joinedAt: projectMembers.joinedAt,
		})
		.from(users)
		.leftJoin(
			projectMembers,
			and(eq(projectMembers.userId, users.id), eq(projectMembers.projectId, project.id)),
		)
		.orderBy(users.name);

	return { project, members };
});
