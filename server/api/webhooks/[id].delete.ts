import {
	and,
	eq,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { webhooks } from "../../db/schema";
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
		.from(webhooks)
		.where(eq(webhooks.id, id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "webhook not found" });
	await assertMember(user, existing.projectId);

	await db.delete(webhooks).where(eq(webhooks.id, existing.id));

	await audit(event, {
		action: "webhook.delete",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: existing.name,
	});

	return { ok: true };
});
