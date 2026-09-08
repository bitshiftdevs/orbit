import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
	server.tool(
		"list_templates",
		"List issue templates for a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const data = await api<{ templates: unknown[] }>("GET", `/projects/${idOrKey}/templates`);
			return { content: [{ type: "text", text: JSON.stringify(data.templates, null, 2) }] };
		},
	);

	server.tool(
		"create_template",
		"Create an issue template for a project",
		{
			idOrKey: z.string().describe("Project UUID or short key"),
			name: z.string().describe("Template name"),
			description: z.string().optional().nullable(),
			type: z.enum(["task", "bug", "story", "epic", "chore"]).optional().default("task"),
			priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).optional().default("medium"),
			labels: z.array(z.string()).optional().default([]),
			body: z.string().optional().nullable().describe("Default issue body (markdown)"),
		},
		async ({ idOrKey, ...body }) => {
			const data = await api("POST", `/projects/${idOrKey}/templates`, body);
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);
}
