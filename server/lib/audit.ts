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
