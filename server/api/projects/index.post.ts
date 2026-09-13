import { z } from "zod";
import { getDb } from "../../db/client";
import { projects, projectMembers } from "../../db/schema";
import { requireRole } from "../../middleware/auth";
import { audit } from "../../lib/audit";
import type { User } from "../../db/schema";

const createSchema = z.object({
	key: z
		.string()
		.min(2)
		.max(10)
		.regex(/^[A-Z][A-Z0-9]*$/, "uppercase alphanum, starts with a letter"),
	name: z.string().min(1).max(120),
	description: z.string().max(4000).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	icon: z.string().max(40).optional(),
	repoUrl: z.string().url().optional().or(z.literal("")),
	productionUrl: z.string().url().optional().or(z.literal("")),
	memberIds: z.array(z.string().uuid()).default([]),
});

export default defineEventHandler(async (event) => {
	await requireRole(event, "owner", "admin");
	const body = await readValidatedBody(event, createSchema.parse);
	const db = getDb();
	const actor = event.context.user as User;
	const [row] = await db
		.insert(projects)
		.values({
			key: body.key,
			name: body.name,
			description: body.description,
			color: body.color ?? "#3b82f6",
			icon: body.icon ?? "rocket",
			repoUrl: body.repoUrl || null,
			productionUrl: body.productionUrl || null,
			leadId: actor.id,
		})
		.returning();

	const memberSet = new Set([actor.id, ...body.memberIds]);
	await db.insert(projectMembers).values(
		[...memberSet].map((userId) => ({ projectId: row.id, userId })),
	);

	await audit(event, {
		action: "project.create",
		projectId: row.id,
		targetName: row.key,
	});

	return { project: row };
});
