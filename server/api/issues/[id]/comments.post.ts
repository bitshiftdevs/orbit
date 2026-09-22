import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import type { User } from "../../../db/schema";
import {
  issueComments,
  issues,
  notifications,
  projects,
  users,
} from "../../../db/schema";
import { assertMember } from "../../../lib/access";
import { notifyMentions } from "../../../lib/mentions";
import { sendPushToUsers } from "../../../lib/push";
import { dispatch } from "../../../lib/webhooks";
import { requireAuth } from "../../../middleware/auth";

const commentSchema = z.object({ body: z.string().min(1).max(20000) });

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

  const body = await readValidatedBody(event, commentSchema.parse);
  const [row] = await db
    .insert(issueComments)
    .values({
      issueId: existing.id,
      authorId: user.id,
      body: body.body,
    })
    .returning();

  const [proj] = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.id, existing.projectId))
    .limit(1);
  const key = `${proj?.key ?? ""}-${existing.number}`;

  notifyMentions({
    text: body.body,
    actorId: user.id,
    projectId: existing.projectId,
    issueId: existing.id,
    message: `Mentioned you in ${key}`,
  }).catch(() => {});

  if (existing.assigneeId && existing.assigneeId !== user.id) {
    const message = `New comment on ${key}`;
    await db
      .insert(notifications)
      .values({
        userId: existing.assigneeId,
        kind: "comment" as const,
        message,
        projectId: existing.projectId,
        issueId: existing.id,
        actorId: user.id,
      })
      .catch(() => {});
    sendPushToUsers([existing.assigneeId], {
      title: key,
      body: `${user.name}: ${body.body.slice(0, 140)}`,
      tag: `issue:${existing.id}`,
    }).catch(() => {});
  }

  dispatch(existing.projectId, "issue.commented", {
    key,
    title: existing.title,
    actor: user.handle,
    body: body.body,
    preview: body.body.slice(0, 240),
  });

  return {
    comment: {
      ...row,
      author: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatarUrl: user.avatarUrl,
        accentColor: user.accentColor,
      },
    },
  };
});
