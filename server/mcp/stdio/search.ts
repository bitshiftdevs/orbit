import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
	server.tool(
		"search",
		"Search across projects, issues, members, and secrets",
		{ q: z.string().describe("Search query — also matches issue keys like ORB-42") },
		async ({ q }) => {
			const data = await api("GET", `/search?q=${encodeURIComponent(q)}`);
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);
}
