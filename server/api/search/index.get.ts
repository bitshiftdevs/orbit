import { and, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import {
  issues,
  projectMembers,
  projects,
  secrets,
  users,
} from "../../db/schema";
import { requireAuth } from "../../middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  let q = getQuery(event).q ?? "";
  q = typeof q === "string" ? q.trim() : q;

  if (!q) {
    return { projects: [], issues: [], members: [], secrets: [] };
  }

  const db = getDb();
  const me = user;
  const wildcard = `%${q}%`;
  const issueKeyMatch = /^([A-Za-z]+)[-\s]?(\d+)$/.exec(q);

  const [projectRows, issueRows, memberRows, secretRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        color: projects.color,
      })
      .from(projects)
      .where(or(ilike(projects.key, wildcard), ilike(projects.name, wildcard)))
      .limit(6),

    issueKeyMatch
      ? db
          .select({
            id: issues.id,
            title: issues.title,
            number: issues.number,
            status: issues.status,
            projectKey: projects.key,
            projectId: projects.id,
          })
          .from(issues)
          .innerJoin(projects, eq(projects.id, issues.projectId))
          .where(
            and(
              eq(projects.key, issueKeyMatch[1].toUpperCase()),
              eq(issues.number, Number(issueKeyMatch[2])),
            ),
          )
          .limit(6)
      : db
          .select({
            id: issues.id,
            title: issues.title,
            number: issues.number,
            status: issues.status,
            projectKey: projects.key,
            projectId: projects.id,
          })
          .from(issues)
          .innerJoin(projects, eq(projects.id, issues.projectId))
          .where(
            sql`${issues.searchVector} @@ websearch_to_tsquery('english', ${q})`,
          )
          .orderBy(
            sql`ts_rank(${issues.searchVector}, websearch_to_tsquery('english', ${q})) DESC`,
          )
          .limit(8),

    db
      .select({
        id: users.id,
        name: users.name,
        handle: users.handle,
        avatarUrl: users.avatarUrl,
        accentColor: users.accentColor,
      })
      .from(users)
      .where(or(ilike(users.name, wildcard), ilike(users.handle, wildcard)))
      .limit(6),

    db
      .select({
        id: secrets.id,
        name: secrets.name,
        projectId: secrets.projectId,
        projectKey: projects.key,
      })
      .from(secrets)
      .innerJoin(projects, eq(projects.id, secrets.projectId))
      .where(ilike(secrets.name, wildcard))
      .limit(6),
  ]);

  let visibleIds: Set<string> | null = null;
  if (me.role !== "owner") {
    const mem = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, me.id));
    visibleIds = new Set(mem.map((m) => m.projectId));
  }

  const filterVisible = <T extends { projectId?: string; id?: string }>(
    rows: T[],
  ) =>
    visibleIds
      ? rows.filter((r) =>
          visibleIds.has((r as any).projectId ?? (r as any).id),
        )
      : rows;

  return {
    projects: filterVisible(projectRows),
    issues: filterVisible(issueRows),
    members: memberRows,
    secrets: filterVisible(secretRows),
  };
});
