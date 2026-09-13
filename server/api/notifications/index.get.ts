import {
	and,
	count,
	desc,
	eq,
	leftJoin,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { notifications, users } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const db = getDb();
	const me = user;

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
		.where(and(eq(notifications.userId, me.id), eq(notifications.readAt, null)));

	return {
		notifications: rows.map((r) => ({ ...r.n, actor: r.actor })),
		unread,
	};
});
