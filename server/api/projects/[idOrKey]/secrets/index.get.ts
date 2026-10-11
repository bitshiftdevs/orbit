import { desc, eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { envVars, secrets, User } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const db = getDb();

  const include = String(getQuery(event).include ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const wantEnv = include.includes("env");

  const [secretRows, envRows] = await Promise.all([
    db
      .select({
        id: secrets.id,
        name: secrets.name,
        description: secrets.description,
        lastFour: secrets.lastFour,
        createdById: secrets.createdById,
        createdAt: secrets.createdAt,
        updatedAt: secrets.updatedAt,
      })
      .from(secrets)
      .where(eq(secrets.projectId, project.id))
      .orderBy(desc(secrets.updatedAt)),
    wantEnv
      ? db
          .select({
            id: envVars.id,
            scope: envVars.scope,
            name: envVars.name,
            lastFour: envVars.lastFour,
            createdAt: envVars.createdAt,
            updatedAt: envVars.updatedAt,
          })
          .from(envVars)
          .where(eq(envVars.projectId, project.id))
          .orderBy(envVars.scope, envVars.name)
      : Promise.resolve([] as Array<{
          id: string;
          scope: typeof envVars.$inferSelect.scope;
          name: string;
          lastFour: string;
          createdAt: Date;
          updatedAt: Date;
        }>),
  ]);

  const payload: Record<string, unknown> = { secrets: secretRows };
  if (wantEnv) payload.envVars = envRows;
  return payload;
});
