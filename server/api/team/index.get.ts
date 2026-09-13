import {
	asc,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const db = getDb();

	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			handle: users.handle,
			avatarUrl: users.avatarUrl,
			role: users.role,
			accentColor: users.accentColor,
			lastSeenAt: users.lastSeenAt,
			createdAt: users.createdAt,
		})
		.from(users)
		.orderBy(asc(users.createdAt));

	return { team: rows };
});
