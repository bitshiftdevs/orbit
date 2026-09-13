import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { invites, users } from "../../db/schema";
import { hashPassword, verifyPassword } from "../../lib/auth";
import { createApiTokenSecret, hashToken } from "../../middleware/auth";
import { apiTokens } from "../../db/schema";
import type { User } from "../../db/schema";

const acceptSchema = z.object({
	token: z.string().min(1),
	name: z.string().min(1).max(120),
	handle: z
		.string()
		.min(2)
		.max(40)
		.regex(/^[a-z0-9_-]+$/i),
	password: z.string().min(10),
});

export default defineEventHandler(async (event) => {
	const db = getDb();
	const body = await readValidatedBody(event, acceptSchema.parse);

	const [inv] = await db
		.select()
		.from(invites)
		.where(and(eq(invites.token, body.token), isNull(invites.acceptedAt)))
		.limit(1);

	if (!inv || inv.expiresAt < new Date()) {
		throw createError({ statusCode: 400, statusMessage: "invite is invalid or expired" });
	}

	const passwordHash = await hashPassword(body.password);
	const [user] = await db
		.insert(users)
		.values({
			email: inv.email,
			name: body.name,
			handle: body.handle.toLowerCase(),
			passwordHash,
			role: inv.role,
		})
		.returning();

	await db
		.update(invites)
		.set({ acceptedAt: new Date() })
		.where(eq(invites.id, inv.id));

	const token = createApiTokenSecret();
	const hash = hashToken(token);
	await db.insert(apiTokens).values({
		userId: user.id,
		name: `session for ${user.email}`,
		tokenHash: hash,
		lastFour: token.slice(-6),
		scopes: ["read", "write"],
		expiresAt: new Date(Date.now() + 60 * 60 * 1000),
	});

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			handle: user.handle,
			avatarUrl: user.avatarUrl,
			role: user.role,
			accentColor: user.accentColor,
			lastSeenAt: user.lastSeenAt,
			createdAt: user.createdAt,
		},
		token,
	};
});
