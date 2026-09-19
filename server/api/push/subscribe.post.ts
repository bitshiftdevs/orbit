import { sql } from "drizzle-orm";
import { getHeader } from "h3";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { pushSubscriptions } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";

const bodySchema = z.object({
	endpoint: z.string().url().max(2048),
	keys: z.object({
		p256dh: z.string().min(1).max(200),
		auth: z.string().min(1).max(100),
	}),
});

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const body = await readValidatedBody(event, bodySchema.parse);
	const userAgent = getHeader(event, "user-agent") ?? null;
	const db = getDb();

	await db
		.insert(pushSubscriptions)
		.values({
			userId: user.id,
			endpoint: body.endpoint,
			p256dh: body.keys.p256dh,
			auth: body.keys.auth,
			userAgent,
		})
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: {
				userId: user.id,
				p256dh: body.keys.p256dh,
				auth: body.keys.auth,
				userAgent,
				lastSeenAt: sql`now()`,
			},
		});

	return { ok: true };
});
