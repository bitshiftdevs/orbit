import { and, desc, gt, isNull } from "drizzle-orm";
import { getDb } from "../../db/client";
import { invites } from "../../db/schema";
import { requireRole } from "../../middleware/auth";

export default defineEventHandler(async (event) => {
	await requireRole(event, "owner", "admin");
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
});
