import { desc, eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, webhooks, webhookDeliveries } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";

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

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "webhook not found" });
  await assertMember(user, existing.projectId);

  const rows = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, existing.id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(50);

  return { deliveries: rows };
});
