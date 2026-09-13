import {
	and,
	eq,
	isNull,
	gt,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { invites } from "../../db/schema";
import { nanoid } from "nanoid";
import { requireAuth, requireRole } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

const inviteSchema = z.object({
	email: z.string().email(),
	role: z.enum(["admin", "member"]).default("member"),
});

export default defineEventHandler(
	requireRole<User>("owner", "admin")(async (event) => {
		const body = await readValidatedBody(event, inviteSchema.parse);
		const db = getDb();
		const actor = event.context.user as User;
		const token = nanoid(32);
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		const [inv] = await db
			.insert(invites)
			.values({
				email: body.email.toLowerCase(),
				role: body.role,
				invitedBy: actor.id,
				token,
				expiresAt,
			})
			.returning();

		const url = `${process.env.APP_URL ?? "http://localhost:3000"}/accept-invite/${token}`;

		return { invite: inv, url };
	}),
);
