import { eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, envVars } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { decryptSecret } from "~~/server/lib/crypto";
import { ensureTokenProject, ensureTokenScope, requireAuth } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [row] = await db
    .select()
    .from(envVars)
    .where(eq(envVars.id, id))
    .limit(1);

  if (!row)
    throw createError({ statusCode: 404, statusMessage: "env var not found" });
  await assertMember(user, row.projectId);
  ensureTokenProject(event, row.projectId);
  ensureTokenScope(event, "env:read");

  const value = decryptSecret(row.ciphertext);

  await audit(event, {
    action: "envvar.read",
    projectId: row.projectId,
    targetId: row.id,
    targetName: `${row.scope}:${row.name}`,
  });

  return { value };
});
