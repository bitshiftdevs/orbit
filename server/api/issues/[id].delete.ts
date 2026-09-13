import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { issues } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const id = getRouterParam(event, "id") as string;
	const db = getDb();

	const [existing] = await db
		.select()
		.from(issues)
		.where(eq(issues.id, id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await assertMember(user, existing.projectId);

	await db.delete(issues).where(eq(issues.id, existing.id));
	return { ok: true };
});
