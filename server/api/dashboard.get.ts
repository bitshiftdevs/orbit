import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../db/client";
import { User, issues, projects, projectMembers, users } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const db = getDb();

  const projectIds =
    user.role === "owner"
      ? (await db.select({ id: projects.id }).from(projects)).map((p) => p.id)
      : (
          await db
            .select({ id: projectMembers.projectId })
            .from(projectMembers)
            .where(eq(projectMembers.userId, user.id))
        ).map((p) => p.id);

  if (projectIds.length === 0) return { assigned: [] };

  const rows = await db
    .select({
      issue: issues,
      projectKey: projects.key,
      assignee: {
        id: users.id,
        name: users.name,
        handle: users.handle,
        avatarUrl: users.avatarUrl,
        accentColor: users.accentColor,
      },
    })
    .from(issues)
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .leftJoin(users, eq(users.id, issues.assigneeId))
    .where(
      and(
        eq(issues.assigneeId, user.id),
        ne(issues.status, "done"),
        ne(issues.status, "cancelled"),
        inArray(issues.projectId, projectIds),
      ),
    );

  return {
    assigned: rows.map((r) => ({
      ...r.issue,
      key: `${r.projectKey}-${r.issue.number}`,
      projectKey: r.projectKey,
      assignee: r.assignee?.id ? r.assignee : null,
    })),
  };
});
