import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { issues, notifications, projects, users } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { notifyAssigned, notifyMentions } from "../../lib/mentions";
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

const updateSchema = z.object({
  title: z.string().min(1).max(240).optional(),
  description: z.string().max(20000).optional(),
  type: z.enum(["task", "bug", "story", "epic", "chore"]).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().optional().nullable(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  storyPoints: z.number().int().min(0).max(9999).optional(),
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
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "issue not found" });
  await assertMember(user, existing.projectId);

  const body = await readValidatedBody(event, updateSchema.parse);
  const completedAt =
    body.status === "done" && existing.status !== "done"
      ? new Date()
      : body.status && body.status !== "done"
        ? null
        : existing.completedAt;

  const [row] = await db
    .update(issues)
    .set({
      ...body,
      dueAt:
        body.dueAt === undefined
          ? undefined
          : body.dueAt
            ? new Date(body.dueAt)
            : null,
      completedAt,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, existing.id))
    .returning();

  const [proj] = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.id, existing.projectId))
    .limit(1);
  const key = `${proj?.key ?? ""}-${row.number}`;
  const actor = user;

  if (body.assigneeId && body.assigneeId !== existing.assigneeId) {
    notifyAssigned({
      assigneeId: body.assigneeId,
      actorId: actor.id,
      projectId: existing.projectId,
      issueId: existing.id,
      issueKey: key,
      issueTitle: row.title,
    }).catch(() => {});
  }
  if (body.description !== undefined) {
    notifyMentions({
      text: row.description,
      actorId: actor.id,
      projectId: existing.projectId,
      issueId: existing.id,
      message: `Mentioned you in ${key}`,
    }).catch(() => {});
  }
  if (body.status && body.status !== existing.status) {
    dispatch(existing.projectId, "issue.status_changed", {
      key,
      title: row.title,
      from: existing.status,
      status: row.status,
      actor: actor.handle,
    });
    if (existing.assigneeId && existing.assigneeId !== actor.id) {
      getDb()
        .insert(notifications)
        .values({
          userId: existing.assigneeId,
          kind: "status_change" as const,
          message: `${key} moved to ${row.status.replace("_", " ")}`,
          projectId: existing.projectId,
          issueId: existing.id,
          actorId: actor.id,
        })
        .catch(() => {});
    }
  } else {
    dispatch(existing.projectId, "issue.updated", {
      key,
      title: row.title,
      status: row.status,
      actor: actor.handle,
    });
  }

  return { issue: row };
});
