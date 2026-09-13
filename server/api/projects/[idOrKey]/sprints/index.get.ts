import { eq, desc } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, sprints } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const db = getDb();

  const rows = await db
    .select()
    .from(sprints)
    .where(eq(sprints.projectId, project.id))
    .orderBy(desc(sprints.createdAt));

  return { sprints: rows };
});
