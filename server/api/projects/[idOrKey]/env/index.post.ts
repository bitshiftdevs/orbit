import { sql } from "drizzle-orm";
import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, envVars } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { auditMany } from "~~/server/lib/audit";
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

  // Single bulk upsert — one round-trip regardless of how many vars.
  const rows = await db
    .insert(envVars)
    .values(
      deduped.map((item) => ({
        projectId: project.id,
        scope: body.scope,
        name: item.name,
        ciphertext: encryptSecret(item.value),
        lastFour: lastFour(item.value),
        createdById: actor.id,
      })),
    )
    .onConflictDoUpdate({
      target: [envVars.projectId, envVars.scope, envVars.name],
      set: {
        // Reference the values proposed for insert so each conflicting row
        // updates to its own new value.
        ciphertext: sql`excluded.ciphertext`,
        lastFour: sql`excluded.last_four`,
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

  // Single batched audit insert.
  await auditMany(
    event,
    rows.map((row) => ({
      action: "envvar.create" as const,
      projectId: project.id,
      targetId: row.id,
      targetName: `${row.scope}:${row.name}`,
    })),
  );

  // Return a single object for single-var requests (backwards compatible),
  // and an array for multi-var requests.
  if (!body.vars) return { envVar: rows[0] };
  return { envVars: rows };
});
