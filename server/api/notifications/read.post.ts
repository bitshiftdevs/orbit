import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { notifications } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";

const readSchema = z
  .object({ ids: z.array(z.string().uuid()).optional() })
  .optional();

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const db = getDb();
  const me = user;

  const body = (await readValidatedBody(event, readSchema.parse)) ?? {};
  const now = new Date();

  if (body.ids && body.ids.length) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.userId, me.id),
          inArray(notifications.id, body.ids),
        ),
      );
  } else {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(eq(notifications.userId, me.id));
  }

  return { ok: true };
});
