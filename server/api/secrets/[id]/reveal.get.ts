import {
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { secrets } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
import { decryptSecret } from "../../lib/crypto";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const id = getRouterParam(event, "id") as string;
	const db = getDb();

	const [row] = await db
		.select()
		.from(secrets)
		.where(eq(secrets.id, id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "secret not found" });
	await assertMember(user, row.projectId);

	const value = decryptSecret(row.ciphertext);
	const reason = getQuery(event).reason ?? null;

	await audit(event, {
		action: "secret.read",
		projectId: row.projectId,
		targetId: row.id,
		targetName: row.name,
		meta: reason ? { reason } : null,
	});

	return { value };
});
