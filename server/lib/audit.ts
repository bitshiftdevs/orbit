import type { Context } from "hono";
import { getDb } from "@server/db/client";
import { auditLog } from "@server/db/schema";
import type { AppEnv } from "@server/types";

type Action = (typeof auditLog.action.enumValues)[number];

export async function audit(
	c: Context<AppEnv>,
	params: {
		action: Action;
		projectId?: string | null;
		targetId?: string | null;
		targetName?: string | null;
		meta?: Record<string, unknown> | null;
	},
) {
	const user = c.get("user");
	const ip =
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
		c.req.header("x-real-ip") ??
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
