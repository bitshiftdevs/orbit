import {
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import { files } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const id = getRouterParam(event, "id") as string;
	const db = getDb();

	const [row] = await db
		.select()
		.from(files)
		.where(eq(files.id, id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "file not found" });
	await assertMember(user, row.projectId);

	return new Response(row.data, {
		headers: {
			"content-type": row.mimeType,
			"content-length": String(row.sizeBytes),
			"content-disposition": `inline; filename="${encodeURIComponent(row.name)}"`,
		},
	});
});
