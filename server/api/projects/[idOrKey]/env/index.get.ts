import { eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, envVars } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const db = getDb();

  const rows = await db
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
    .orderBy(envVars.scope, envVars.name);

  return { envVars: rows };
});
