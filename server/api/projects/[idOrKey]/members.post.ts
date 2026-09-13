import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { projectMembers } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { requireRole } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

const bodySchema = z.object({ userId: z.string().uuid() });

export default defineEventHandler(
	requireRole<User>("owner", "admin")(async (event) => {
		const idOrKey = getRouterParam(event, "idOrKey");
		const project = await loadProject(idOrKey);
		const body = await readValidatedBody(event, bodySchema.parse);
		const db = getDb();

		await db
			.insert(projectMembers)
			.values({ projectId: project.id, userId: body.userId })
			.onConflictDoNothing();

		return { ok: true };
	}),
);
