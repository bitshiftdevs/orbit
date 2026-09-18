import { and, eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, envVars, secrets } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { decryptSecret } from "~~/server/lib/crypto";
import { ensureTokenProject, ensureTokenScope, requireAuth } from "~~/server/middleware/auth";

const scopes = ["development", "staging", "production"] as const;
type Scope = (typeof scopes)[number];

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const scope = getRouterParam(event, "scope") as Scope;
  const includeSecrets = getQuery(event).include === "secrets";
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  ensureTokenProject(event, project.id);
  ensureTokenScope(event, "env:read");
  if (includeSecrets) ensureTokenScope(event, "secrets:read");

  if (!scopes.includes(scope)) {
    throw createError({ statusCode: 400, statusMessage: "invalid scope" });
  }

  const db = getDb();
  const envRows = await db
    .select()
    .from(envVars)
    .where(and(eq(envVars.projectId, project.id), eq(envVars.scope, scope)))
    .orderBy(envVars.name);

  const secretRows = includeSecrets
    ? await db
        .select()
        .from(secrets)
        .where(eq(secrets.projectId, project.id))
        .orderBy(secrets.name)
    : [];

  const lines = [
    ...envRows.map((r) => `${r.name}=${JSON.stringify(decryptSecret(r.ciphertext))}`),
    ...secretRows.map((r) => `${r.name}=${JSON.stringify(decryptSecret(r.ciphertext))}`),
  ];
  const body = lines.join("\n");

  await audit(event, {
    action: "envvar.read",
    projectId: project.id,
    targetName: `${scope}:dotenv-export`,
    meta: { count: envRows.length, secrets: secretRows.length },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${project.key.toLowerCase()}.${scope}.env"`,
    },
  });
});
