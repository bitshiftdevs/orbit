import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "h3";
import { getDb } from "../db/client";
import { apiTokens, sessions, users } from "../db/schema";
import { sha256Hex } from "../lib/crypto";
import type { H3Event } from "h3";
import type { User } from "../db/schema";
import type { createMiddleware, H3EventContext } from "h3";

// This file is being removed. Use server/middleware/auth.ts for stateless auth.

throw new Error("server/utils/auth.ts should not be imported anymore");

export const API_TOKEN_PREFIX = "orb_";

const SESSION_COOKIE = "orbit_session";
const SESSION_TTL_DAYS = 30;

export async function createSession(
	event: H3Event,
	userId: string,
	userAgent: string | null,
) {
	const db = getDb();
	const token = crypto.randomUUID();
	const expiresAt = new Date(
		Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
	);
	await db.insert(sessions).values({
		id: token,
		userId,
		userAgent: userAgent ?? undefined,
		expiresAt,
	});
	setCookie(event, SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "Lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		expires: expiresAt,
	});
	return token;
}

export async function destroySession(event: H3Event) {
	const db = getDb();
	const token = getCookie(event, SESSION_COOKIE);
	if (token) {
		await db.delete(sessions).where(eq(sessions.id, token));
	}
	deleteCookie(event, SESSION_COOKIE, { path: "/" });
}

export async function currentUser(event: H3Event) {
	const db = getDb();

	// 1. Session cookie (browser).
	const sessToken = getCookie(event, SESSION_COOKIE);
	if (sessToken) {
		const [row] = await db
			.select({ user: users })
			.from(sessions)
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(and(eq(sessions.id, sessToken), gt(sessions.expiresAt, new Date())))
			.limit(1);
		if (row) return row.user;
	}

	// 2. Bearer API token (`orb_...`) for CLI / CI / MCP.
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

export const requireAuth = createMiddleware<User>(async (event) => {
	const user = await currentUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: "unauthenticated" });
	event.context.user = user;
});

export const requireRole = (...roles: Array<"owner" | "admin" | "member">) =>
	createMiddleware<User>(async (event) => {
		const user = event.context.user as User | undefined;
		if (!user || !roles.includes(user.role as any)) {
			throw createError({ statusCode: 403, statusMessage: "forbidden" });
		}
	});
