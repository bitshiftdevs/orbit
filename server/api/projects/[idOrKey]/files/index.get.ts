import {
	desc,
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { files } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			id: files.id,
			name: files.name,
			mimeType: files.mimeType,
			sizeBytes: files.sizeBytes,
			sha256: files.sha256,
			issueId: files.issueId,
			uploadedById: files.uploadedById,
			createdAt: files.createdAt,
		})
		.from(files)
		.where(eq(files.projectId, project.id))
		.orderBy(desc(files.createdAt));

	return { files: rows };
});
