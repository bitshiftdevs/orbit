import { eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, issueTemplates } from "~~/server/db/schema";
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
    .select()
    .from(issueTemplates)
    .where(eq(issueTemplates.projectId, project.id))
    .orderBy(issueTemplates.createdAt);

  return { templates: rows };
});
