import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, issues } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  patch: z.object({
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
    priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    sprintId: z.string().uuid().nullable().optional(),
    addLabels: z.array(z.string()).optional(),
    removeLabels: z.array(z.string()).optional(),
  }),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const body = await readValidatedBody(event, bulkSchema.parse);
  const db = getDb();

  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.projectId, project.id), inArray(issues.id, body.ids)));

  const now = new Date();
  const updated: Array<(typeof rows)[number]> = [];

  await db.transaction(async (tx) => {
    for (const r of rows) {
      const labels = new Set(r.labels);
      for (const l of body.patch.addLabels ?? []) labels.add(l);
      for (const l of body.patch.removeLabels ?? []) labels.delete(l);
      const [u] = await tx
        .update(issues)
        .set({
          status: body.patch.status ?? r.status,
          priority: body.patch.priority ?? r.priority,
          assigneeId:
            body.patch.assigneeId === undefined
              ? r.assigneeId
              : body.patch.assigneeId,
          sprintId:
            body.patch.sprintId === undefined
              ? r.sprintId
              : body.patch.sprintId,
          labels: [...labels],
          completedAt:
            body.patch.status === "done" && r.status !== "done"
              ? now
              : body.patch.status && body.patch.status !== "done"
                ? null
                : r.completedAt,
          updatedAt: now,
        })
        .where(eq(issues.id, r.id))
        .returning();
      updated.push(u);
    }
  });

  return { updated: updated.length };
});
