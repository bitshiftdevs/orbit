import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { users, apiTokens } from "../../db/schema";
import { verifyPassword } from "../../lib/auth";
import { createApiTokenSecret, hashToken } from "../../middleware/auth";

export const API_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export const TOKEN_LAST_FOUR_MAX = 6;

export function makeTokenName(email: string): string {
	return `session for ${email}`;
}

export function tokenLastFour(token: string): string {
	return token.slice(-TOKEN_LAST_FOUR_MAX);
}

export function tokenExpiresAt(): Date {
	return new Date(Date.now() + API_TOKEN_TTL_MS);
}

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

export default defineEventHandler(async (event) => {
	const db = getDb();
	const body = await readValidatedBody(event, loginSchema.parse);
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, body.email.toLowerCase()))
		.limit(1);

	if (!user) throw createError({ statusCode: 401, statusMessage: "invalid credentials" });

	const ok = await verifyPassword(body.password, user.passwordHash);
	if (!ok) throw createError({ statusCode: 401, statusMessage: "invalid credentials" });

	const token = createApiTokenSecret();
	const hash = hashToken(token);
	await db.insert(apiTokens).values({
		userId: user.id,
		name: makeTokenName(user.email),
		tokenHash: hash,
		lastFour: tokenLastFour(token),
		scopes: ["read", "write"],
		expiresAt: tokenExpiresAt(),
	});

	await db
		.update(users)
		.set({ lastSeenAt: new Date() })
		.where(eq(users.id, user.id));

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


