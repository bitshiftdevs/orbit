import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { projects } from "../../db/schema";
import { loadProject } from "../../lib/access";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import { H3Event } from "h3";

const updateSchema = z.object({
	name: z.string().min(1).max(120).optional(),
	description: z.string().max(4000).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	icon: z.string().max(40).optional(),
	repoUrl: z.string().url().optional().or(z.literal("")).optional(),
	productionUrl: z.string().url().optional().or(z.literal("")).optional(),
}).strip();

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey");
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const body = await readValidatedBody(event, updateSchema.parse);
	const db = getDb();

	const [row] = await db
		.update(projects)
		.set({ ...body, updatedAt: new Date() })
		.where(eq(projects.id, project.id))
		.returning();

	return { project: row };
});
