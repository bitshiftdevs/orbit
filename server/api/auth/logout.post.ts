import { getDb } from "../../db/client";
import { apiTokens } from "../../db/schema";
import { hashToken, parseBearerToken } from "../../middleware/auth";
import { eq } from "drizzle-orm";
import { getHeader } from "h3";
import { and, isNull } from "drizzle-orm";

// Logout revokes the bearer token sent by the client.
// No cookies are used anywhere in this flow.

export default defineEventHandler(async (event) => {
	const authHeader = getHeader(event, "authorization");
	const raw = parseBearerToken(authHeader);
	if (!raw) throw createError({ statusCode: 401, statusMessage: "unauthenticated" });

	const db = getDb();
	const hash = hashToken(raw);
	const [tokenRow] = await db
		.select()
		.from(apiTokens)
		.where(
			and(
				eq(apiTokens.tokenHash, hash),
				isNull(apiTokens.revokedAt),
			),
		)
		.limit(1);

	if (!tokenRow) throw createError({ statusCode: 401, statusMessage: "unauthenticated" });

	await db
		.update(apiTokens)
		.set({ revokedAt: new Date() })
		.where(eq(apiTokens.id, tokenRow.id));

	return { ok: true };
});
