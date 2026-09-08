import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { getDb } from "@server/db/client";
import { projectMembers, projects } from "@server/db/schema";
import type { User } from "@server/db/schema";

export async function loadProject(idOrKey: string) {
	const db = getDb();
	const byId = idOrKey.length === 36 ? projects.id : projects.key;
	const [row] = await db
		.select()
		.from(projects)
		.where(eq(byId, idOrKey.length === 36 ? idOrKey : idOrKey.toUpperCase()))
		.limit(1);
	if (!row) throw new HTTPException(404, { message: "project not found" });
	return row;
}

export async function assertMember(user: User, projectId: string) {
	if (user.role === "owner") return;
	const db = getDb();
	const [row] = await db
		.select()
		.from(projectMembers)
		.where(
			and(
				eq(projectMembers.projectId, projectId),
				eq(projectMembers.userId, user.id),
			),
		)
		.limit(1);
	if (!row) throw new HTTPException(403, { message: "not a project member" });
}
