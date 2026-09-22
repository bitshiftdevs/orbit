import { lt } from "drizzle-orm";
import { getDb } from "../../db/client";
import { notifications, webhookDeliveries } from "../../db/schema";

const RETENTION_DAYS = 3;

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = getRequestHeader(event, "authorization");
    if (auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: "unauthorized" });
    }
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();

  const deletedNotifications = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, cutoff))
    .returning({ id: notifications.id });

  const deletedDeliveries = await db
    .delete(webhookDeliveries)
    .where(lt(webhookDeliveries.createdAt, cutoff))
    .returning({ id: webhookDeliveries.id });

  return {
    ok: true,
    cutoff: cutoff.toISOString(),
    deletedNotifications: deletedNotifications.length,
    deletedDeliveries: deletedDeliveries.length,
  };
});
