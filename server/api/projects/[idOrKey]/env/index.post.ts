import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, envVars } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { encryptSecret, lastFour } from "~~/server/lib/crypto";
import { requireAuth } from "~~/server/middleware/auth";

const nameSchema = z
  .string()
  .min(1)
  .max(120)
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9_]+$/));

const varSchema = z.object({
  name: nameSchema,
  value: z.string(),
});

const envSchema = z
  .object({
    scope: z
      .enum(["development", "staging", "production"])
      .default("development"),
    // Single-var form (backwards compatible).
    name: nameSchema.optional(),
    value: z.string().optional(),
    // Multi-var form.
    vars: z.array(varSchema).min(1).optional(),
  })
  .refine(
    (b) => (b.vars && b.vars.length > 0) || (b.name != null && b.value != null),
    { message: "Provide either { name, value } or a non-empty vars array." },
  );

type EnvVarRow = {
  id: string;
  scope: "development" | "staging" | "production";
  name: string;
  lastFour: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const body = await readValidatedBody(event, envSchema.parse);
  const db = getDb();
  const actor = user;

  const items =
    body.vars && body.vars.length > 0
      ? body.vars
      : [{ name: body.name as string, value: body.value as string }];

  // De-duplicate by name (last one wins) so a single request can't conflict with itself.
  const byName = new Map<string, { name: string; value: string }>();
  for (const item of items) byName.set(item.name, item);
  const deduped = [...byName.values()];

  const saved: EnvVarRow[] = [];
  for (const item of deduped) {
    const ciphertext = encryptSecret(item.value);
    const [row] = await db
      .insert(envVars)
      .values({
        projectId: project.id,
        scope: body.scope,
        name: item.name,
        ciphertext,
        lastFour: lastFour(item.value),
        createdById: actor.id,
      })
      .onConflictDoUpdate({
        target: [envVars.projectId, envVars.scope, envVars.name],
        set: {
          ciphertext,
          lastFour: lastFour(item.value),
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
    if (!row) continue;

    await audit(event, {
      action: "envvar.create",
      projectId: project.id,
      targetId: row.id,
      targetName: `${row.scope}:${row.name}`,
    });

    saved.push(row);
  }

  // Return a single object for single-var requests (backwards compatible),
  // and an array for multi-var requests.
  if (!body.vars) return { envVar: saved[0] };
  return { envVars: saved };
});
