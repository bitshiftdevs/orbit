import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { webhooks } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
import { requireAuth } from "../../middleware/auth";

const EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.status_changed",
  "issue.commented",
  "sprint.started",
  "sprint.completed",
  "secret.created",
] as const;

const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    url: z.string().min(1).optional(),
    events: z.array(z.enum(EVENTS)).optional(),
    preset: z.enum(["generic", "slack", "discord", "telegram"]).optional(),
    config: z
      .object({
        botToken: z.string().min(1).optional(),
        chatId: z.string().min(1).optional(),
        messageThreadId: z.string().min(1).optional(),
      })
      .partial()
      .nullable()
      .optional(),
    active: z.boolean().optional(),
  })
  .optional();

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "webhook not found" });
  await assertMember(user, existing.projectId);

  const parsed = (await readValidatedBody(event, updateSchema.parse)) ?? {};

  const [row] = await db
    .update(webhooks)
    .set(parsed)
    .where(eq(webhooks.id, existing.id))
    .returning();

  await audit(event, {
    action: "webhook.update",
    projectId: existing.projectId,
    targetId: row.id,
    targetName: row.name,
  });

  return { webhook: row };
});
