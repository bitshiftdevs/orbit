import {
	eq,
	select,
	from,
	delete,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { files } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
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
		.from(files)
		.where(eq(files.id, id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "file not found" });
	await assertMember(user, existing.projectId);

	await db.delete(files).where(eq(files.id, existing.id));

	await audit(event, {
		action: "file.delete",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: existing.name,
	});

	return { ok: true };
});
