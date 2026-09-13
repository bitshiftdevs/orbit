import {
	eq,
	select,
	from,
	delete,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { issueTemplates } from "../../db/schema";
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
		.from(issueTemplates)
		.where(eq(issueTemplates.id, id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "template not found" });
	await assertMember(user, existing.projectId);

	await db.delete(issueTemplates).where(eq(issueTemplates.id, existing.id));
	return { ok: true };
});
