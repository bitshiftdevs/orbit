import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { pushSubscriptions } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";

const bodySchema = z.object({ endpoint: z.string().url().max(2048) });

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const body = await readValidatedBody(event, bodySchema.parse);
	const db = getDb();

	await db
		.delete(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.endpoint, body.endpoint),
				eq(pushSubscriptions.userId, user.id),
			),
		);

	return { ok: true };
});
