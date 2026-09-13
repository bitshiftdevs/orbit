import {
	and,
	eq,
	select,
	from,
	update,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { apiTokens } from "../../db/schema";
import { audit } from "../../lib/audit";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const id = getRouterParam(event, "id") as string;
	const db = getDb();
	const me = user;

	const [row] = await db
		.select()
		.from(apiTokens)
		.where(and(eq(apiTokens.id, id), eq(apiTokens.userId, me.id)))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "token not found" });

	await db
		.update(apiTokens)
		.set({ revokedAt: new Date() })
		.where(eq(apiTokens.id, row.id));

	await audit(event, {
		action: "token.revoke",
		targetId: row.id,
		targetName: row.name,
	});

	return { ok: true };
});
