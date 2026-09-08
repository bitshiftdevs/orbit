import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { notifications, users } from "@server/db/schema";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
	const db = getDb();
	const me = c.get("user");
	const rows = await db
		.select({
			n: notifications,
			actor: {
				id: users.id,
				name: users.name,
				handle: users.handle,
				avatarUrl: users.avatarUrl,
				accentColor: users.accentColor,
			},
		})
		.from(notifications)
		.leftJoin(users, eq(users.id, notifications.actorId))
		.where(eq(notifications.userId, me.id))
		.orderBy(desc(notifications.createdAt))
		.limit(50);
	const [{ value: unread }] = await db
		.select({ value: count() })
		.from(notifications)
		.where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
	return c.json({
		notifications: rows.map((r) => ({ ...r.n, actor: r.actor })),
		unread,
	});
});

app.post("/read", async (c) => {
	const db = getDb();
	const me = c.get("user");
	const body = z
		.object({ ids: z.array(z.string().uuid()).optional() })
		.parse(await c.req.json().catch(() => ({})));
	const now = new Date();
	if (body.ids && body.ids.length) {
		await db
			.update(notifications)
			.set({ readAt: now })
			.where(
				and(
					eq(notifications.userId, me.id),
					inArray(notifications.id, body.ids),
				),
			);
	} else {
		await db
			.update(notifications)
			.set({ readAt: now })
			.where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
	}
	return c.json({ ok: true });
});

export default app;
