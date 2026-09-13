import {
	desc,
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { webhooks, webhookDeliveries } from "../../db/schema";
import { assertMember } from "../../lib/access";
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

	const rows = await db
		.select()
		.from(webhookDeliveries)
		.where(eq(webhookDeliveries.webhookId, existing.id))
		.orderBy(desc(webhookDeliveries.createdAt))
		.limit(50);

	return { deliveries: rows };
});
