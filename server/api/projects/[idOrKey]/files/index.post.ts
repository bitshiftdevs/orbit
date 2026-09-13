import {
	eq,
	select,
	from,
	insert,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { files } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { audit } from "../../../lib/audit";
import { sha256Hex } from "../../../lib/crypto";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const form = await readFormData(event);
	const file = form.get("file");
	const issueId = (form.get("issueId") as string | null) || null;

	if (!(file instanceof File)) {
		throw createError({ statusCode: 400, statusMessage: "file field is required" });
	}
	if (file.size > MAX_BYTES) {
		throw createError({
			statusCode: 413,
			statusMessage: `file exceeds ${MAX_BYTES / 1024 / 1024} MB limit`,
		});
	}

	const buf = Buffer.from(await file.arrayBuffer());
	const db = getDb();
	const actor = user;

	const [row] = await db
		.insert(files)
		.values({
			projectId: project.id,
			issueId,
			name: file.name,
			mimeType: file.type || "application/octet-stream",
			sizeBytes: buf.byteLength,
			sha256: sha256Hex(buf),
			data: buf,
			uploadedById: actor.id,
		})
		.returning({
			id: files.id,
			name: files.name,
			mimeType: files.mimeType,
			sizeBytes: files.sizeBytes,
			sha256: files.sha256,
			issueId: files.issueId,
			createdAt: files.createdAt,
		});

	await audit(event, {
		action: "file.upload",
		projectId: project.id,
		targetId: row.id,
		targetName: row.name,
		meta: { size: row.sizeBytes, mime: row.mimeType },
	});

	return { file: row };
});
