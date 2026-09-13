import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { sprints } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(sprints)
    .where(eq(sprints.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "sprint not found" });
  await assertMember(user, existing.projectId);

  await db.delete(sprints).where(eq(sprints.id, existing.id));
  return { ok: true };
});
