import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, issues } from "~~/server/db/schema";
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
      type: issues.type,
      avgDays:
        sql<number>`round(avg(extract(epoch from ${issues.completedAt} - ${issues.createdAt}) / 86400), 1)`.mapWith(
          Number,
        ),
      count: count(issues.id),
    })
    .from(issues)
    .where(and(eq(issues.projectId, project.id), isNotNull(issues.completedAt)))
    .groupBy(issues.type)
    .orderBy(issues.type);

  return { cycleTime: rows };
});
