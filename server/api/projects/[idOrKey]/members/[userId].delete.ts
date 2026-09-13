import { and, eq, delete } from "drizzle-orm";
import { getDb } from "../../../db/client";
import { projectMembers } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { requireRole } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(
	requireRole<User>("owner", "admin")(async (event) => {
		const idOrKey = getRouterParam(event, "idOrKey");
		const userId = getRouterParam(event, "userId");
		const project = await loadProject(idOrKey);
		const db = getDb();

		await db
			.delete(projectMembers)
			.where(
				and(
					eq(projectMembers.projectId, project.id),
					eq(projectMembers.userId, userId),
				),
			);

		return { ok: true };
	}),
);
