import {
	eq,
	select,
	from,
	delete,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { envVars } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const id = getRouterParam(event, "id") as string;
	const db = getDb();

	const [existing] = await db
		.select()
		.from(envVars)
		.where(eq(envVars.id, id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "env var not found" });
	await assertMember(user, existing.projectId);

	await db.delete(envVars).where(eq(envVars.id, existing.id));

	await audit(event, {
		action: "envvar.delete",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: `${existing.scope}:${existing.name}`,
	});

	return { ok: true };
});
