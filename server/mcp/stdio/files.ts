import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
	server.tool(
		"list_files",
		"List files attached to a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const data = await api<{ files: unknown[] }>("GET", `/projects/${idOrKey}/files`);
			return { content: [{ type: "text", text: JSON.stringify(data.files, null, 2) }] };
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
}
