import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "@server/db/client";
import { files } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import type { User } from "@server/db/schema";

export function register(server: McpServer, db: DB, user: User): void {
	server.tool(
		"list_files",
		"List files attached to a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
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
			return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
		},
	);

	server.tool(
		"delete_file",
		"Permanently delete a file",
		{ id: z.string().uuid().describe("File UUID") },
		async ({ id }) => {
			const [existing] = await db.select().from(files).where(eq(files.id, id)).limit(1);
			if (!existing) throw new Error("file not found");
			await assertMember(user, existing.projectId);
			await db.delete(files).where(eq(files.id, id));
			return { content: [{ type: "text" as const, text: "Deleted." }] };
		},
	);

	server.tool(
		"get_file_content",
		"Read the plaintext content of a text or markdown file",
		{ id: z.string().uuid().describe("File UUID") },
		async ({ id }) => {
			const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
			if (!row) throw new Error("file not found");
			await assertMember(user, row.projectId);
			const isText =
				row.mimeType.startsWith("text/") ||
				row.mimeType === "application/json" ||
				row.name.endsWith(".md") ||
				row.name.endsWith(".markdown");
			if (!isText) throw new Error("file is not a text file");
			const content = row.data.toString("utf-8");
			return { content: [{ type: "text" as const, text: content }] };
		},
	);
}
