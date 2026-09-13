import {
	desc,
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { apiTokens } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const db = getDb();

	const rows = await db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			lastFour: apiTokens.lastFour,
			scopes: apiTokens.scopes,
			lastUsedAt: apiTokens.lastUsedAt,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
			createdAt: apiTokens.createdAt,
		})
		.from(apiTokens)
		.where(eq(apiTokens.userId, user.id))
		.orderBy(desc(apiTokens.createdAt));

	return { tokens: rows };
});
