import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import { nanoid } from "nanoid";
import { getDb } from "@server/db/client";
import { apiTokens, sessions, users } from "@server/db/schema";
import { sha256Hex } from "./crypto";

export const API_TOKEN_PREFIX = "orb_";

const SESSION_COOKIE = "orbit_session";
const SESSION_TTL_DAYS = 30;

export async function hashPassword(pw: string) {
	return hash(pw, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
}

export async function verifyPassword(pw: string, hashed: string) {
	return verify(hashed, pw);
}

export async function createSession(
	c: Context,
	userId: string,
	userAgent: string | null,
) {
	const db = getDb();
	const token = nanoid(48);
	const expiresAt = new Date(
		Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
	);
	await db.insert(sessions).values({
		id: token,
		userId,
		userAgent: userAgent ?? undefined,
		expiresAt,
	});
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "Lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		expires: expiresAt,
	});
	return token;
}

export async function destroySession(c: Context) {
	const db = getDb();
	const token = getCookie(c, SESSION_COOKIE);
	if (token) {
		await db.delete(sessions).where(eq(sessions.id, token));
	}
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function currentUser(c: Context) {
	const db = getDb();

	// 1. Session cookie (browser).
	const sessToken = getCookie(c, SESSION_COOKIE);
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
	const auth = c.req.header("authorization");
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
