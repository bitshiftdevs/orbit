import {
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { envVars } from "../../db/schema";
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
		.from(envVars)
		.where(eq(envVars.id, id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "env var not found" });
	await assertMember(user, row.projectId);

	const value = decryptSecret(row.ciphertext);

	await audit(event, {
		action: "envvar.read",
		projectId: row.projectId,
		targetId: row.id,
		targetName: `${row.scope}:${row.name}`,
	});

	return { value };
});
