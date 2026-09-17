import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
  server.tool(
    "list_files",
    "List files attached to a project",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const data = await api<{ files: unknown[] }>(
        "GET",
        `/projects/${idOrKey}/files`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data.files, null, 2) }],
      };
    },
  );

  server.tool(
    "delete_file",
    "Permanently delete a file",
    { id: z.string().uuid().describe("File UUID") },
    async ({ id }) => {
      await api("DELETE", `/files/${id}`);
      return { content: [{ type: "text", text: "Deleted." }] };
    },
  );

  server.tool(
    "get_file_content",
    "Read the plaintext content of a text or markdown file",
    { id: z.string().uuid().describe("File UUID") },
    async ({ id }) => {
      const text = await api<string>("GET", `/files/${id}/content`);
      return { content: [{ type: "text", text }] };
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
      const data = await api<{ file: unknown }>("PATCH", `/files/${id}/content`, { content });
      return {
        content: [{ type: "text", text: JSON.stringify(data.file, null, 2) }],
      };
    },
  );
}
