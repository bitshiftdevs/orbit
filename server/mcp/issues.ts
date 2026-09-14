import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DB } from "../db/client";
import { users, User, issues, projects, issueComments } from "../db/schema";
import { loadProject, assertMember } from "../lib/access";
import { midpoint, initialRank } from "../lib/rank";

const assigneeShape = {
  id: users.id,
  name: users.name,
  handle: users.handle,
  avatarUrl: users.avatarUrl,
  accentColor: users.accentColor,
};

export function register(server: McpServer, db: DB, user: User): void {
  server.tool(
    "list_issues",
    "List all issues for a project",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const rows = await db
        .select({ issue: issues, assignee: assigneeShape })
        .from(issues)
        .leftJoin(users, eq(users.id, issues.assigneeId))
        .where(eq(issues.projectId, project.id))
        .orderBy(asc(issues.rank));
      const shaped = rows.map((r) => ({
        ...r.issue,
        key: `${project.key}-${r.issue.number}`,
        assignee: r.assignee?.id ? r.assignee : null,
      }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(shaped, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "get_issue",
    "Get a single issue by UUID",
    { id: z.string().uuid().describe("Issue UUID") },
    async ({ id }) => {
      const [row] = await db
        .select({ issue: issues, project: projects, assignee: assigneeShape })
        .from(issues)
        .innerJoin(projects, eq(projects.id, issues.projectId))
        .leftJoin(users, eq(users.id, issues.assigneeId))
        .where(eq(issues.id, id))
        .limit(1);
      if (!row) throw new Error("issue not found");
      await assertMember(user, row.project.id);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "create_issue",
    "Create a new issue inside a project",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      title: z.string().describe("Issue title"),
      description: z.string().optional().describe("Markdown body"),
      type: z
        .enum(["task", "bug", "story", "epic", "chore"])
        .optional()
        .default("task"),
      status: z
        .enum([
          "backlog",
          "todo",
          "in_progress",
          "in_review",
          "done",
          "cancelled",
        ])
        .optional()
        .default("backlog"),
      priority: z
        .enum(["trivial", "low", "medium", "high", "urgent"])
        .optional()
        .default("medium"),
      assigneeId: z.string().uuid().optional().describe("Assignee user UUID"),
      sprintId: z.string().uuid().optional().describe("Sprint UUID"),
      labels: z.array(z.string()).optional(),
      storyPoints: z.number().int().min(0).max(99).optional(),
      prUrl: z
        .string()
        .url()
        .optional()
        .nullable()
        .describe("PR or branch URL"),
      dueAt: z.string().datetime().optional().describe("ISO 8601 due date"),
    },
    async ({ idOrKey, ...body }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const inserted = await db.transaction(async (tx) => {
        const [projRow] = await tx
          .update(projects)
          .set({
            issueCounter: sql`${projects.issueCounter} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, project.id))
          .returning({ counter: projects.issueCounter });
        const [last] = await tx
          .select({ rank: issues.rank })
          .from(issues)
          .where(
            and(
              eq(issues.projectId, project.id),
              eq(issues.status, body.status ?? "backlog"),
            ),
          )
          .orderBy(desc(issues.rank))
          .limit(1);
        const rank = last ? midpoint(last.rank, null) : initialRank();
        const [row] = await tx
          .insert(issues)
          .values({
            projectId: project.id,
            number: projRow.counter,
            title: body.title,
            description: body.description,
            type: body.type ?? "task",
            status: body.status ?? "backlog",
            priority: body.priority ?? "medium",
            storyPoints: body.storyPoints,
            assigneeId: body.assigneeId ?? null,
            reporterId: user.id,
            sprintId: body.sprintId ?? null,
            labels: body.labels ?? [],
            prUrl: body.prUrl ?? null,
            dueAt: body.dueAt ? new Date(body.dueAt) : null,
            rank,
          })
          .returning();
        return { ...row, key: `${project.key}-${projRow.counter}` };
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(inserted, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "update_issue",
    "Update fields of an existing issue",
    {
      id: z.string().uuid().describe("Issue UUID"),
      title: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(["task", "bug", "story", "epic", "chore"]).optional(),
      status: z
        .enum([
          "backlog",
          "todo",
          "in_progress",
          "in_review",
          "done",
          "cancelled",
        ])
        .optional(),
      priority: z
        .enum(["trivial", "low", "medium", "high", "urgent"])
        .optional(),
      assigneeId: z.string().uuid().nullable().optional(),
      sprintId: z.string().uuid().nullable().optional(),
      labels: z.array(z.string()).optional(),
      storyPoints: z.number().int().min(0).max(99).optional(),
      prUrl: z
        .string()
        .url()
        .nullable()
        .optional()
        .describe("PR or branch URL"),
      dueAt: z.string().datetime().nullable().optional(),
    },
    async ({ id, ...body }) => {
      const [existing] = await db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .limit(1);
      if (!existing) throw new Error("issue not found");
      await assertMember(user, existing.projectId);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined)
          patch[k] = k === "dueAt" && v ? new Date(v as string) : v;
      }
      const [updated] = await db
        .update(issues)
        .set(patch)
        .where(eq(issues.id, id))
        .returning();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(updated, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "delete_issue",
    "Permanently delete an issue",
    { id: z.string().uuid().describe("Issue UUID") },
    async ({ id }) => {
      const [existing] = await db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .limit(1);
      if (!existing) throw new Error("issue not found");
      await assertMember(user, existing.projectId);
      await db.delete(issues).where(eq(issues.id, id));
      return { content: [{ type: "text" as const, text: "Deleted." }] };
    },
  );

  server.tool(
    "add_comment",
    "Add a comment to an issue",
    {
      id: z.string().uuid().describe("Issue UUID"),
      body: z.string().describe("Comment body (markdown)"),
    },
    async ({ id, body }) => {
      const [existing] = await db
        .select()
        .from(issues)
        .where(eq(issues.id, id))
        .limit(1);
      if (!existing) throw new Error("issue not found");
      await assertMember(user, existing.projectId);
      const [comment] = await db
        .insert(issueComments)
        .values({ issueId: id, authorId: user.id, body })
        .returning();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(comment, null, 2) },
        ],
      };
    },
  );
}
