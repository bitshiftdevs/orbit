import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, envVars } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { encryptSecret, lastFour } from "~~/server/lib/crypto";
import { requireAuth } from "~~/server/middleware/auth";

const envSchema = z.object({
  scope: z
    .enum(["development", "staging", "production"])
    .default("development"),
  name: z
    .string()
    .min(1)
    .max(120)
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9_]+$/)),
  value: z.string(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const body = await readValidatedBody(event, envSchema.parse);
  const db = getDb();
  const actor = user;
  const ciphertext = encryptSecret(body.value);

  const [row] = await db
    .insert(envVars)
    .values({
      projectId: project.id,
      scope: body.scope,
      name: body.name,
      ciphertext,
      lastFour: lastFour(body.value),
      createdById: actor.id,
    })
    .onConflictDoUpdate({
      target: [envVars.projectId, envVars.scope, envVars.name],
      set: {
        ciphertext,
        lastFour: lastFour(body.value),
        updatedAt: new Date(),
      },
    })
    .returning({
      id: envVars.id,
      scope: envVars.scope,
      name: envVars.name,
      lastFour: envVars.lastFour,
      createdAt: envVars.createdAt,
      updatedAt: envVars.updatedAt,
    });

  await audit(event, {
    action: "envvar.create",
    projectId: project.id,
    targetId: row.id,
    targetName: `${row.scope}:${row.name}`,
  });

  return { envVar: row };
});
