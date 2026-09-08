import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
	server.tool(
		"get_issue_links",
		"Get dependency links for an issue (blocks / duplicates / relates_to)",
		{ id: z.string().uuid().describe("Issue UUID") },
		async ({ id }) => {
			const data = await api("GET", `/issues/${id}/links`);
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);

	server.tool(
		"add_issue_link",
		"Add a link between two issues",
		{
			sourceId: z.string().uuid().describe("Source issue UUID"),
			targetId: z.string().uuid().describe("Target issue UUID"),
			kind: z.enum(["blocks", "duplicates", "relates_to"]).default("relates_to"),
		},
		async ({ sourceId, targetId, kind }) => {
			const data = await api("POST", `/issues/${sourceId}/links`, { targetId, kind });
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);

	server.tool(
		"remove_issue_link",
		"Remove a link between issues",
		{ linkId: z.string().uuid().describe("Link UUID") },
		async ({ linkId }) => {
			await api("DELETE", `/issues/links/${linkId}`);
			return { content: [{ type: "text", text: "Link removed." }] };
		},
	);
}
