import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { secrets } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
import { requireAuth } from "../../middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(secrets)
    .where(eq(secrets.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "secret not found" });
  await assertMember(user, existing.projectId);

  await db.delete(secrets).where(eq(secrets.id, existing.id));

  await audit(event, {
    action: "secret.delete",
    projectId: existing.projectId,
    targetId: existing.id,
    targetName: existing.name,
  });

  return { ok: true };
});
