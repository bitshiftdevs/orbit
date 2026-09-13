import { and, eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { projectMembers, User } from "~~/server/db/schema";
import { loadProject } from "~~/server/lib/access";
import { requireRole } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  requireRole(event, "admin", "owner");
  const idOrKey = getRouterParam(event, "idOrKey");
  const userId = getRouterParam(event, "userId");
  const project = await loadProject(idOrKey!);
  const db = getDb();

  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, project.id),
        eq(projectMembers.userId, userId),
      ),
    );

  return { ok: true };
});
