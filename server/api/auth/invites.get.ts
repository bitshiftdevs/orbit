import {
	and,
	desc,
	eq,
	gt,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { invites } from "../../db/schema";
import { requireAuth, requireRole } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(
	requireRole<User>("owner", "admin")(async (event) => {
		const db = getDb();

		const rows = await db
			.select()
			.from(invites)
			.where(
				and(
					isNull(invites.acceptedAt),
					gt(invites.expiresAt, new Date()),
				),
			)
			.orderBy(desc(invites.createdAt));

		return { invites: rows };
	}),
);
