import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { secrets } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
import { encryptSecret, lastFour } from "../../lib/crypto";
import { requireAuth } from "../../middleware/auth";

const secretSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Z0-9_]+$/, "uppercase, digits, underscores only")
    .optional(),
  description: z.string().max(1000).optional(),
  value: z.string().min(1).optional(),
});

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

  const body = await readValidatedBody(event, secretSchema.partial().parse);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.description !== undefined) patch.description = body.description;
  if (body.value !== undefined) {
    patch.ciphertext = encryptSecret(body.value);
    patch.lastFour = lastFour(body.value);
  }

  const [row] = await db
    .update(secrets)
    .set(patch)
    .where(eq(secrets.id, existing.id))
    .returning({
      id: secrets.id,
      name: secrets.name,
      description: secrets.description,
      lastFour: secrets.lastFour,
      createdAt: secrets.createdAt,
      updatedAt: secrets.updatedAt,
    });

  await audit(event, {
    action: "secret.update",
    projectId: existing.projectId,
    targetId: existing.id,
    targetName: existing.name,
  });

  return { secret: row };
});
