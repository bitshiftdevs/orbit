import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getHeader } from "h3";
import { getDb } from "../db/client";
import { apiTokens, users } from "../db/schema";
import { sha256Hex } from "../lib/crypto";
import type { H3Event } from "h3";
import type { User } from "../db/schema";

export const API_TOKEN_PREFIX = "orb_";

// Stateless auth only: no long-lived browser session cookies.
// Auth is carried by a bearer token (`orb_...`) checked on each request.

export async function currentUser(event: H3Event) {
	const db = getDb();

	const auth = getHeader(event, "authorization");
	if (auth?.startsWith("Bearer ")) {
		const raw = auth.slice(7).trim();
		if (raw.startsWith(API_TOKEN_PREFIX)) {
			const hashHex = sha256Hex(raw);
			const [row] = await db
				.select({ user: users, token: apiTokens })
				.from(apiTokens)
				.innerJoin(users, eq(users.id, apiTokens.userId))
				.where(
					and(
						eq(apiTokens.tokenHash, hashHex),
						isNull(apiTokens.revokedAt),
						or(
							isNull(apiTokens.expiresAt),
							gt(apiTokens.expiresAt, new Date()),
						),
					),
				)
				.limit(1);
			if (row) {
				// Fire-and-forget last-used bump.
				db.update(apiTokens)
					.set({ lastUsedAt: new Date() })
					.where(eq(apiTokens.id, row.token.id))
					.catch(() => {});
				return row.user;
			}
		}
	}

	return null;
}

export async function requireAuth(event: H3Event): Promise<void> {
	const user = await currentUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: "unauthenticated" });
	event.context.user = user;
}

export async function requireRole(
	event: H3Event,
	...roles: Array<"owner" | "admin" | "member">
): Promise<void> {
	const user = event.context.user as User | undefined;
	if (!user || !roles.includes(user.role as any)) {
		throw createError({ statusCode: 403, statusMessage: "forbidden" });
	}
}

// ---------------------------------------------------------------------------
// Small helpers reused by server routes and server utilities.
// ---------------------------------------------------------------------------

export function parseBearerToken(authHeader: string | undefined): string | undefined {
	if (!authHeader?.startsWith("Bearer ")) return undefined;
	return authHeader.slice(7).trim();
}

export function isApiToken(token: string): boolean {
	return token.startsWith(API_TOKEN_PREFIX);
}

export function hashToken(token: string): string {
	return sha256Hex(token);
}

export function createApiTokenSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return API_TOKEN_PREFIX +
		btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
}

// Convenience wrappers for server utilities that already have a user in scope.

export default defineEventHandler(async (event) => {
	event.context.user = await currentUser(event);
});

export type AuthContext = { user: User };

export async function authenticateOrThrow(event: H3Event): Promise<User> {
	const user = await currentUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: "unauthenticated" });
	return user;
}

export function ensureUser(user: User | null | undefined): User {
	if (!user) throw new Error("unauthenticated");
	return user;
}

export function ensureRole(
	user: User | null | undefined,
	...roles: Array<"owner" | "admin" | "member">
): User {
	const u = ensureUser(user);
	if (!roles.includes(u.role as any)) throw new Error("forbidden");
	return u;
}
