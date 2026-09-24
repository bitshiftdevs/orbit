import type { H3Event } from "h3";
import { getHeader } from "h3";
import { getDb } from "../db/client";
import { auditLog, User } from "../db/schema";
type Action = (typeof auditLog.action.enumValues)[number];

export async function audit(
  event: H3Event,
  params: {
    action: Action;
    projectId?: string | null;
    targetId?: string | null;
    targetName?: string | null;
    meta?: Record<string, unknown> | null;
  },
) {
  const user = event.context.user as User | undefined;
  const ip =
    getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ??
    getHeader(event, "x-real-ip") ??
    null;
  await getDb()
    .insert(auditLog)
    .values({
      actorId: user?.id,
      projectId: params.projectId ?? null,
      action: params.action,
      targetId: params.targetId ?? null,
      targetName: params.targetName ?? null,
      meta: params.meta ?? null,
      ip,
    });
}

/**
 * Insert multiple audit rows in a single statement. Prefer this over calling
 * `audit()` in a loop to avoid N sequential round-trips.
 */
export async function auditMany(
  event: H3Event,
  entries: Array<{
    action: Action;
    projectId?: string | null;
    targetId?: string | null;
    targetName?: string | null;
    meta?: Record<string, unknown> | null;
  }>,
) {
  if (!entries.length) return;
  const user = event.context.user as User | undefined;
  const ip =
    getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ??
    getHeader(event, "x-real-ip") ??
    null;
  await getDb()
    .insert(auditLog)
    .values(
      entries.map((e) => ({
        actorId: user?.id,
        projectId: e.projectId ?? null,
        action: e.action,
        targetId: e.targetId ?? null,
        targetName: e.targetName ?? null,
        meta: e.meta ?? null,
        ip,
      })),
    );
}
