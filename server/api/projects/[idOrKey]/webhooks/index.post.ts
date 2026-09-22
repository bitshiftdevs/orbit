import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, webhooks } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { requireAuth } from "~~/server/middleware/auth";

const EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.status_changed",
  "issue.commented",
  "sprint.started",
  "sprint.completed",
  "secret.created",
] as const;

const createSchema = z
  .object({
    name: z.string().min(1).max(120),
    url: z.string().min(1),
    events: z.array(z.enum(EVENTS)).min(1),
    preset: z.enum(["generic", "slack", "discord", "telegram"]).default("generic"),
    config: z
      .object({
        botToken: z.string().min(1).optional(),
        chatId: z.string().min(1).optional(),
        messageThreadId: z.string().min(1).optional(),
      })
      .partial()
      .optional(),
  })
  .refine(
    (v) => (v.preset === "telegram" ? !!v.config?.botToken : true),
    { message: "telegram preset requires config.botToken", path: ["config", "botToken"] },
  )
  .refine(
    (v) => (v.preset !== "telegram" ? /^https?:\/\//.test(v.url) : true),
    { message: "url must start with http(s)://", path: ["url"] },
  );

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const body = await readValidatedBody(event, createSchema.parse);
  const db = getDb();
  const signingSecret = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  const [row] = await db
    .insert(webhooks)
    .values({
      projectId: project.id,
      name: body.name,
      url: body.url,
      events: body.events,
      preset: body.preset,
      config: body.config ?? null,
      signingSecret,
    })
    .returning();

  await audit(event, {
    action: "webhook.create",
    projectId: project.id,
    targetId: row.id,
    targetName: row.name,
  });

  return { webhook: row, signingSecret };
});
