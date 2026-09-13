import { eq, desc } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { secrets, User } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const db = getDb();

  const rows = await db
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
    .orderBy(desc(secrets.updatedAt));

  return { secrets: rows };
});
