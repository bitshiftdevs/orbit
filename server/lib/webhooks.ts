import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { webhooks, webhookDeliveries } from "../db/schema";

type WebhookEvent =
  | "issue.created"
  | "issue.updated"
  | "issue.status_changed"
  | "issue.commented"
  | "sprint.started"
  | "sprint.completed"
  | "secret.created";

export function dispatch(
  projectId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  // Non-blocking; caller doesn't wait on the network.
  fireAndForget(projectId, event, payload).catch((err) => {
    console.error("webhook dispatch failed", err);
  });
}

async function fireAndForget(
  projectId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const db = getDb();
  const hooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.projectId, projectId), eq(webhooks.active, true)));
  const subscribed = hooks.filter(
    (h) => h.events.includes(event) || h.events.includes("*"),
  );
  await Promise.all(subscribed.map((h) => deliver(h, event, payload)));
}

async function deliver(
  hook: typeof webhooks.$inferSelect,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const db = getDb();
  const start = Date.now();
  // Slack / Discord speak their own body shape.
  let body: string;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "orbit-webhook/1",
  };
  if (hook.preset === "slack") {
    body = JSON.stringify(slackPayload(event, payload));
  } else if (hook.preset === "discord") {
    body = JSON.stringify(discordPayload(event, payload));
  } else if (hook.preset === "telegram") {
    // Telegram delivery: url stores the chat id; bot token in config.botToken.
    return deliverTelegram(hook, event, payload, start);
  } else {
    body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });
    const sig = createHmac("sha256", hook.signingSecret)
      .update(body)
      .digest("hex");
    headers["x-orbit-event"] = event;
    headers["x-orbit-signature"] = `sha256=${sig}`;
  }

  let status: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(8_000),
    });
    status = res.status;
    if (!res.ok) error = (await res.text().catch(() => "")).slice(0, 500);
  } catch (e) {
    error = String((e as Error).message ?? e).slice(0, 500);
  }
  await db.insert(webhookDeliveries).values({
    webhookId: hook.id,
    event,
    statusCode: status,
    error,
    durationMs: Date.now() - start,
  });
}

async function deliverTelegram(
  hook: typeof webhooks.$inferSelect,
  event: WebhookEvent,
  payload: Record<string, unknown>,
  start: number,
) {
  const db = getDb();
  const token = hook.config?.botToken;
  const chatId = hook.config?.chatId ?? hook.url;
  const threadId = hook.config?.messageThreadId;
  let status: number | null = null;
  let error: string | null = null;
  if (!token || !chatId) {
    error = "telegram webhook missing botToken or chatId";
  } else {
    const summary = summarize(event, payload);
    const text = `*${escapeMd(summary.title)}*\n${escapeMd(summary.body)}\n_${event}_`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "MarkdownV2",
    };
    if (threadId) body.message_thread_id = Number(threadId);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
      status = res.status;
      if (!res.ok) error = (await res.text().catch(() => "")).slice(0, 500);
    } catch (e) {
      error = String((e as Error).message ?? e).slice(0, 500);
    }
  }
  await db.insert(webhookDeliveries).values({
    webhookId: hook.id,
    event,
    statusCode: status,
    error,
    durationMs: Date.now() - start,
  });
}

function escapeMd(s: string) {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

function slackPayload(event: string, payload: Record<string, unknown>) {
  const summary = summarize(event, payload);
  return {
    text: summary.title,
    attachments: [
      {
        color: colorFor(event),
        text: summary.body,
        footer: `Orbit · ${event}`,
      },
    ],
  };
}

function discordPayload(event: string, payload: Record<string, unknown>) {
  const summary = summarize(event, payload);
  return {
    embeds: [
      {
        title: summary.title,
        description: summary.body,
        color: parseInt(colorFor(event).slice(1), 16),
        footer: { text: `Orbit · ${event}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function summarize(event: string, payload: Record<string, unknown>) {
  const p = payload as any;
  if (event.startsWith("issue")) {
    return {
      title: `${p.key ?? "issue"} — ${p.title ?? ""}`.trim(),
      body: `${event.replace("issue.", "")} · ${p.status ?? ""}${p.actor ? ` by @${p.actor}` : ""}`,
    };
  }
  if (event.startsWith("sprint")) {
    return {
      title: `Sprint ${p.name ?? ""}`,
      body: event.replace("sprint.", ""),
    };
  }
  return { title: event, body: JSON.stringify(p).slice(0, 500) };
}

function colorFor(event: string): string {
  if (event.includes("status_changed")) return "#3b82f6";
  if (event.startsWith("issue.created")) return "#22c55e";
  if (event.startsWith("issue.commented")) return "#a855f7";
  if (event.startsWith("secret")) return "#f59e0b";
  return "#71717a";
}
