import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { issues, projects, users } from "../../db/schema";
import { assertMember, loadProject } from "../../lib/access";
import { notifyAssigned, notifyMentions } from "../../lib/mentions";
import { initialRank, midpoint } from "../../lib/rank";
import { dispatch } from "../../lib/webhooks";
import { requireAuth } from "../../middleware/auth";

const STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
] as const;

const createSchema = z.object({
  title: z.string().min(1).max(240),
  description: z.string().max(20000).optional(),
  type: z.enum(["task", "bug", "story", "epic", "chore"]).default("task"),
  status: z.enum(STATUSES).default("backlog"),
  priority: z
    .enum(["trivial", "low", "medium", "high", "urgent"])
    .default("medium"),
  storyPoints: z.number().int().min(0).max(9999).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  sprintId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  labels: z.array(z.string().max(40)).max(20).default([]),
  prUrl: z.string().url().max(2048).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

const authorShape = {
  id: users.id,
  name: users.name,
  handle: users.handle,
  avatarUrl: users.avatarUrl,
  accentColor: users.accentColor,
};

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const projectKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(projectKey);
  await assertMember(user, project.id);
  const body = await readValidatedBody(event, createSchema.parse);
  const db = getDb();
  const actor = user;

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
        and(eq(issues.projectId, project.id), eq(issues.status, body.status)),
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
        type: body.type,
        status: body.status,
        priority: body.priority,
        storyPoints: body.storyPoints,
        assigneeId: body.assigneeId ?? null,
        reporterId: actor.id,
        parentId: body.parentId ?? null,
        sprintId: body.sprintId ?? null,
        labels: body.labels,
        prUrl: body.prUrl ?? null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        rank,
      })
      .returning();
    return row;
  });

  const issueKey = `${project.key}-${inserted.number}`;

  if (inserted.assigneeId) {
    notifyAssigned({
      assigneeId: inserted.assigneeId,
      actorId: actor.id,
      projectId: project.id,
      issueId: inserted.id,
      issueKey,
      issueTitle: inserted.title,
    }).catch(() => {});
  }
  notifyMentions({
    text: inserted.description,
    actorId: actor.id,
    projectId: project.id,
    issueId: inserted.id,
    message: `Mentioned you in ${issueKey}`,
  }).catch(() => {});
  dispatch(project.id, "issue.created", {
    key: issueKey,
    title: inserted.title,
    status: inserted.status,
    priority: inserted.priority,
    actor: actor.handle,
  });

  return { issue: { ...inserted, key: issueKey } };
});
