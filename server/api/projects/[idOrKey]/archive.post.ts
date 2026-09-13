import { eq } from "drizzle-orm";
import { getDb } from "../../../db/client";
import { projects } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { requireRole } from "../../../middleware/auth";
import { audit } from "../../../lib/audit";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(
	requireRole<User>("owner", "admin")(async (event) => {
		const idOrKey = getRouterParam(event, "idOrKey");
		const project = await loadProject(idOrKey);
		const db = getDb();
		const [row] = await db
			.update(projects)
			.set({ status: "archived", updatedAt: new Date() })
			.where(eq(projects.id, project.id))
			.returning();

		await audit(event, {
			action: "project.archive",
			projectId: row.id,
			targetName: row.key,
		});

		return { project: row };
	}),
);
