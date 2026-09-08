import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getDb } from "@server/db/client";
import { files } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { audit } from "@server/lib/audit";
import { sha256Hex } from "@server/lib/crypto";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/projects/:idOrKey/files", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
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
	return c.json({ files: rows });
});

app.post("/projects/:idOrKey/files", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const form = await c.req.formData();
	const file = form.get("file");
	const issueId = (form.get("issueId") as string | null) || null;
	if (!(file instanceof File)) {
		throw new HTTPException(400, { message: "file field is required" });
	}
	if (file.size > MAX_BYTES) {
		throw new HTTPException(413, {
			message: `file exceeds ${MAX_BYTES / 1024 / 1024} MB limit`,
		});
	}
	const buf = Buffer.from(await file.arrayBuffer());
	const db = getDb();
	const actor = c.get("user");
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
	await audit(c, {
		action: "file.upload",
		projectId: project.id,
		targetId: row.id,
		targetName: row.name,
		meta: { size: row.sizeBytes, mime: row.mimeType },
	});
	return c.json({ file: row }, 201);
});

app.get("/files/:id/preview", async (c) => {
	const db = getDb();
	const [row] = await db
		.select()
		.from(files)
		.where(eq(files.id, c.req.param("id")))
		.limit(1);
	if (!row) throw new HTTPException(404, { message: "file not found" });
	await assertMember(c.get("user"), row.projectId);
	return new Response(row.data, {
		headers: {
			"content-type": row.mimeType,
			"content-length": String(row.sizeBytes),
			"content-disposition": `inline; filename="${encodeURIComponent(row.name)}"`,
		},
	});
});

app.get("/files/:id/download", async (c) => {
	const db = getDb();
	const [row] = await db
		.select()
		.from(files)
		.where(eq(files.id, c.req.param("id")))
		.limit(1);
	if (!row) throw new HTTPException(404, { message: "file not found" });
	await assertMember(c.get("user"), row.projectId);
	await audit(c, {
		action: "file.download",
		projectId: row.projectId,
		targetId: row.id,
		targetName: row.name,
	});
	return new Response(row.data, {
		headers: {
			"content-type": row.mimeType,
			"content-length": String(row.sizeBytes),
			"content-disposition": `attachment; filename="${encodeURIComponent(row.name)}"`,
		},
	});
});

app.delete("/files/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(files)
		.where(eq(files.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "file not found" });
	await assertMember(c.get("user"), existing.projectId);
	await db.delete(files).where(eq(files.id, existing.id));
	await audit(c, {
		action: "file.delete",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: existing.name,
	});
	return c.json({ ok: true });
});

export default app;
