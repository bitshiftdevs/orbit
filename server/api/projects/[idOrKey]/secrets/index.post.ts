import {
	eq,
	select,
	from,
	insert,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { secrets } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { audit } from "../../../lib/audit";
import { encryptSecret, lastFour } from "../../../lib/crypto";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

const secretSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(120)
		.regex(/^[A-Z0-9_]+$/, "uppercase, digits, underscores only"),
	description: z.string().max(1000).optional(),
	value: z.string().min(1),
});

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const body = await readValidatedBody(event, secretSchema.parse);
	const db = getDb();
	const ciphertext = encryptSecret(body.value);
	const actor = user;

	const [row] = await db
		.insert(secrets)
		.values({
			projectId: project.id,
			name: body.name,
			description: body.description,
			ciphertext,
			lastFour: lastFour(body.value),
			createdById: actor.id,
		})
		.returning({
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		});

	await audit(event, {
		action: "secret.create",
		projectId: project.id,
		targetId: row.id,
		targetName: row.name,
	});

	return { secret: row };
});
