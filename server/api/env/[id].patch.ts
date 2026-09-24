import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { envVars } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
import { encryptSecret, lastFour } from "../../lib/crypto";
import { requireAuth } from "../../middleware/auth";

const envSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9_]+$/, "uppercase, digits, underscores only"))
    .optional(),
  value: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(envVars)
    .where(eq(envVars.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "env var not found" });
  await assertMember(user, existing.projectId);

  const body = await readValidatedBody(event, envSchema.parse);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) patch.name = body.name;
  if (body.value !== undefined) {
    patch.ciphertext = encryptSecret(body.value);
    patch.lastFour = lastFour(body.value);
  }

  const [row] = await db
    .update(envVars)
    .set(patch)
    .where(eq(envVars.id, existing.id))
    .returning({
      id: envVars.id,
      scope: envVars.scope,
      name: envVars.name,
      lastFour: envVars.lastFour,
      createdAt: envVars.createdAt,
      updatedAt: envVars.updatedAt,
    });

  await audit(event, {
    action: "envvar.update",
    projectId: existing.projectId,
    targetId: existing.id,
    targetName: `${existing.scope}:${row?.name ?? existing.name}`,
  });

  return { envVar: row };
});
