import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import {
  issueComments,
  issues,
  notifications,
  projects,
  sprints,
  users,
} from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { notifyAssigned, notifyMentions } from "@server/lib/mentions";
import { initialRank, midpoint } from "@server/lib/rank";
import { dispatch } from "@server/lib/webhooks";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

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

const updateSchema = createSchema.partial();

const author = {
  id: users.id,
  name: users.name,
  handle: users.handle,
  avatarUrl: users.avatarUrl,
  accentColor: users.accentColor,
};

app.get("/projects/:idOrKey/issues", async (c) => {
  const project = await loadProject(c.req.param("idOrKey"));
  await assertMember(c.get("user"), project.id);
  const db = getDb();

  const limit = Math.min(Number(c.req.query("limit") ?? 500), 500);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({ issue: issues, assignee: author })
      .from(issues)
      .leftJoin(users, eq(users.id, issues.assigneeId))
      .where(eq(issues.projectId, project.id))
      .orderBy(asc(issues.rank))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(issues)
      .where(eq(issues.projectId, project.id)),
  ]);

  return c.json({
    issues: rows.map((r) => ({
      ...r.issue,
      key: `${project.key}-${r.issue.number}`,
      assignee: r.assignee?.id ? r.assignee : null,
    })),
    total,
    hasMore: offset + rows.length < total,
  });
});

app.post("/projects/:idOrKey/issues", async (c) => {
  const project = await loadProject(c.req.param("idOrKey"));
  await assertMember(c.get("user"), project.id);
  const body = createSchema.parse(await c.req.json());
  const db = getDb();
  const actor = c.get("user");

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

  // Side effects — mentions + assignment + webhook.
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

  return c.json({ issue: { ...inserted, key: issueKey } }, 201);
});

app.get("/issues/:id", async (c) => {
  const db = getDb();
  const [row] = await db
    .select({ issue: issues, project: projects, assignee: author })
    .from(issues)
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .leftJoin(users, eq(users.id, issues.assigneeId))
    .where(eq(issues.id, c.req.param("id")))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "issue not found" });
  await assertMember(c.get("user"), row.project.id);

  const comments = await db
    .select({
      comment: issueComments,
      author: author,
    })
    .from(issueComments)
    .innerJoin(users, eq(users.id, issueComments.authorId))
    .where(eq(issueComments.issueId, row.issue.id))
    .orderBy(asc(issueComments.createdAt));

  return c.json({
    issue: {
      ...row.issue,
      key: `${row.project.key}-${row.issue.number}`,
      assignee: row.assignee?.id ? row.assignee : null,
    },
    project: row.project,
    comments: comments.map((c) => ({
      ...c.comment,
      author: c.author,
    })),
  });
});

app.patch("/issues/:id", async (c) => {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, c.req.param("id")))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "issue not found" });
  await assertMember(c.get("user"), existing.projectId);
  const body = updateSchema.parse(await c.req.json());
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

  // Load project key for events.
  const [proj] = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.id, existing.projectId))
    .limit(1);
  const key = `${proj?.key ?? ""}-${row.number}`;
  const actor = c.get("user");

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

  return c.json({ issue: row });
});

const reorderSchema = z.object({
  status: z.enum(STATUSES),
  beforeId: z.string().uuid().optional().nullable(),
  afterId: z.string().uuid().optional().nullable(),
});

app.post("/issues/:id/reorder", async (c) => {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, c.req.param("id")))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "issue not found" });
  await assertMember(c.get("user"), existing.projectId);

  const body = reorderSchema.parse(await c.req.json());
  let beforeRank: string | null = null;
  let afterRank: string | null = null;
  if (body.beforeId) {
    const [b] = await db
      .select({ rank: issues.rank })
      .from(issues)
      .where(eq(issues.id, body.beforeId))
      .limit(1);
    beforeRank = b?.rank ?? null;
  }
  if (body.afterId) {
    const [a] = await db
      .select({ rank: issues.rank })
      .from(issues)
      .where(eq(issues.id, body.afterId))
      .limit(1);
    afterRank = a?.rank ?? null;
  }
  const rank = midpoint(beforeRank, afterRank);
  const completedAt =
    body.status === "done" && existing.status !== "done"
      ? new Date()
      : body.status !== "done"
        ? null
        : existing.completedAt;
  const [row] = await db
    .update(issues)
    .set({
      status: body.status,
      rank,
      completedAt,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, existing.id))
    .returning();

  if (body.status !== existing.status) {
    const [proj] = await db
      .select({ key: projects.key })
      .from(projects)
      .where(eq(projects.id, existing.projectId))
      .limit(1);
    dispatch(existing.projectId, "issue.status_changed", {
      key: `${proj?.key ?? ""}-${row.number}`,
      title: row.title,
      from: existing.status,
      status: row.status,
      actor: c.get("user").handle,
    });
  }
  return c.json({ issue: row });
});

app.delete("/issues/:id", async (c) => {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, c.req.param("id")))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "issue not found" });
  await assertMember(c.get("user"), existing.projectId);
  await db.delete(issues).where(eq(issues.id, existing.id));
  return c.json({ ok: true });
});

const commentSchema = z.object({ body: z.string().min(1).max(20000) });

app.post("/issues/:id/comments", async (c) => {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, c.req.param("id")))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "issue not found" });
  await assertMember(c.get("user"), existing.projectId);
  const body = commentSchema.parse(await c.req.json());
  const actor = c.get("user");
  const [row] = await db
    .insert(issueComments)
    .values({
      issueId: existing.id,
      authorId: actor.id,
      body: body.body,
    })
    .returning();
  // Mentions in the comment body → notifications.
  const [proj] = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.id, existing.projectId))
    .limit(1);
  const key = `${proj?.key ?? ""}-${existing.number}`;
  notifyMentions({
    text: body.body,
    actorId: actor.id,
    projectId: existing.projectId,
    issueId: existing.id,
    message: `Mentioned you in ${key}`,
  }).catch(() => {});
  // Notify assignee about new comment (unless they're the one commenting).
  if (existing.assigneeId && existing.assigneeId !== actor.id) {
    await db
      .insert(notifications)
      .values({
        userId: existing.assigneeId,
        kind: "comment" as const,
        message: `New comment on ${key}`,
        projectId: existing.projectId,
        issueId: existing.id,
        actorId: actor.id,
      })
      .catch(() => {});
  }
  dispatch(existing.projectId, "issue.commented", {
    key,
    title: existing.title,
    actor: actor.handle,
    preview: body.body.slice(0, 240),
  });

  return c.json(
    {
      comment: {
        ...row,
        author: {
          id: actor.id,
          name: actor.name,
          handle: actor.handle,
          avatarUrl: actor.avatarUrl,
          accentColor: actor.accentColor,
        },
      },
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// Bulk edit — apply a partial update to many issues at once.
// ---------------------------------------------------------------------------
const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  patch: z.object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    sprintId: z.string().uuid().nullable().optional(),
    addLabels: z.array(z.string()).optional(),
    removeLabels: z.array(z.string()).optional(),
  }),
});

app.post("/projects/:idOrKey/issues/bulk", async (c) => {
  const project = await loadProject(c.req.param("idOrKey"));
  await assertMember(c.get("user"), project.id);
  const body = bulkSchema.parse(await c.req.json());
  const db = getDb();

  // Load matching issues to apply label add/remove logic per-row.
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.projectId, project.id), inArray(issues.id, body.ids)));

  const now = new Date();
  const updated: typeof rows = [];
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
  return c.json({ updated: updated.length });
});

// ---------------------------------------------------------------------------
// Burndown — day-by-day remaining points for a sprint.
// ---------------------------------------------------------------------------
app.get("/sprints/:id/burndown", async (c) => {
  const db = getDb();
  const [s] = await db
    .select()
    .from(sprints)
    .where(eq(sprints.id, c.req.param("id")))
    .limit(1);
  if (!s) throw new HTTPException(404, { message: "sprint not found" });
  await assertMember(c.get("user"), s.projectId);

  const start = s.startsAt ?? s.createdAt;
  const end = s.endsAt ?? new Date();
  const items = await db
    .select({
      id: issues.id,
      storyPoints: issues.storyPoints,
      completedAt: issues.completedAt,
      status: issues.status,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(eq(issues.sprintId, s.id));

  const total = items.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
  const days: Array<{ date: string; remaining: number; ideal: number }> = [];
  const startMs = new Date(start).setHours(0, 0, 0, 0);
  const endMs = new Date(end).setHours(23, 59, 59, 999);
  const spanDays = Math.max(
    1,
    Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)),
  );
  for (let i = 0; i <= spanDays; i++) {
    const day = new Date(startMs + i * 24 * 60 * 60 * 1000);
    const dayEnd = day.getTime() + 24 * 60 * 60 * 1000 - 1;
    const done = items
      .filter(
        (x) => x.completedAt && new Date(x.completedAt).getTime() <= dayEnd,
      )
      .reduce((sum, x) => sum + (x.storyPoints ?? 0), 0);
    days.push({
      date: day.toISOString().slice(0, 10),
      remaining: total - done,
      ideal: Math.max(0, total - (total / spanDays) * i),
    });
  }
  return c.json({
    sprint: s,
    total,
    days,
    completed: total - (days[days.length - 1]?.remaining ?? 0),
  });
});

export default app;
