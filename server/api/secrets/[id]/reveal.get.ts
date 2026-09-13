import { eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { secrets, User } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { decryptSecret } from "~~/server/lib/crypto";
import { requireAuth } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [row] = await db
    .select()
    .from(secrets)
    .where(eq(secrets.id, id))
    .limit(1);

  if (!row)
    throw createError({ statusCode: 404, statusMessage: "secret not found" });
  await assertMember(user, row.projectId);

  const value = decryptSecret(row.ciphertext);
  const reason = getQuery(event).reason ?? null;

  await audit(event, {
    action: "secret.read",
    projectId: row.projectId,
    targetId: row.id,
    targetName: row.name,
    meta: reason ? { reason } : null,
  });

  return { value };
});
