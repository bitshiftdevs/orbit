import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { DB } from "../db/client";
import { User, files } from "../db/schema";
import { assertMember, loadProject } from "../lib/access";
import { sha256Hex } from "../lib/crypto";

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
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "delete_file",
    "Permanently delete a file",
    { id: z.string().uuid().describe("File UUID") },
    async ({ id }) => {
      const [existing] = await db
        .select()
        .from(files)
        .where(eq(files.id, id))
        .limit(1);
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
      const [row] = await db
        .select()
        .from(files)
        .where(eq(files.id, id))
        .limit(1);
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

  server.tool(
    "create_markdown_file",
    "Create a new markdown file in a project",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      name: z.string().describe("Filename, must end in .md or .markdown"),
      content: z.string().max(500_000).optional().describe("Initial file content"),
      issueId: z.string().uuid().optional().describe("Issue UUID to attach the file to"),
    },
    async ({ idOrKey, name, content = "", issueId }) => {
      if (!/\.md(?:own)?$/i.test(name)) throw new Error("name must end in .md or .markdown");
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const buf = Buffer.from(content, "utf-8");
      const [row] = await db
        .insert(files)
        .values({
          projectId: project.id,
          issueId: issueId ?? null,
          name,
          mimeType: "text/markdown",
          sizeBytes: buf.byteLength,
          sha256: sha256Hex(buf),
          data: buf,
          uploadedById: user.id,
        })
        .returning({
          id: files.id,
          name: files.name,
          mimeType: files.mimeType,
          sizeBytes: files.sizeBytes,
          sha256: files.sha256,
          issueId: files.issueId,
          uploadedById: files.uploadedById,
          createdAt: files.createdAt,
        });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
      };
    },
  );

  server.tool(
    "update_file_content",
    "Overwrite the content of a text or markdown file",
    {
      id: z.string().uuid().describe("File UUID"),
      content: z.string().max(500_000).describe("New file content"),
    },
    async ({ id, content }) => {
      const [row] = await db
        .select()
        .from(files)
        .where(eq(files.id, id))
        .limit(1);
      if (!row) throw new Error("file not found");
      await assertMember(user, row.projectId);
      const isEditable =
        row.mimeType.startsWith("text/") ||
        row.mimeType === "application/json" ||
        row.name.endsWith(".md") ||
        row.name.endsWith(".markdown");
      if (!isEditable) throw new Error("file is not editable");
      const buf = Buffer.from(content, "utf-8");
      const [updated] = await db
        .update(files)
        .set({ data: buf, sizeBytes: buf.byteLength, sha256: sha256Hex(buf) })
        .where(eq(files.id, id))
        .returning({
          id: files.id,
          name: files.name,
          mimeType: files.mimeType,
          sizeBytes: files.sizeBytes,
          sha256: files.sha256,
          issueId: files.issueId,
          uploadedById: files.uploadedById,
          createdAt: files.createdAt,
        });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
      };
    },
  );
}
