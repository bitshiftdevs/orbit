import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { savedFilters } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [row] = await db
    .select()
    .from(savedFilters)
    .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, user.id)))
    .limit(1);

  if (!row)
    throw createError({ statusCode: 404, statusMessage: "filter not found" });
  await db.delete(savedFilters).where(eq(savedFilters.id, row.id));
  return { ok: true };
});
