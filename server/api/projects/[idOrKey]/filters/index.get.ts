import { and, eq, isNull, or, desc } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, savedFilters } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const db = getDb();
  const me = user;

  const rows = await db
    .select()
    .from(savedFilters)
    .where(
      and(
        eq(savedFilters.userId, me.id),
        or(
          eq(savedFilters.projectId, project.id),
          isNull(savedFilters.projectId),
        ),
      ),
    )
    .orderBy(desc(savedFilters.createdAt));

  return { filters: rows };
});
