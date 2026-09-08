import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
	server.tool(
		"list_issues",
		"List all issues for a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const data = await api<{ issues: unknown[] }>("GET", `/projects/${idOrKey}/issues`);
			return { content: [{ type: "text", text: JSON.stringify(data.issues, null, 2) }] };
		},
	);

	server.tool(
		"get_issue",
		"Get a single issue by its UUID",
		{ id: z.string().uuid().describe("Issue UUID") },
		async ({ id }) => {
			const data = await api("GET", `/issues/${id}`);
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);

	server.tool(
		"create_issue",
		"Create a new issue inside a project",
		{
			idOrKey: z.string().describe("Project UUID or short key"),
			title: z.string().describe("Issue title"),
			description: z.string().optional().describe("Issue description (markdown)"),
			type: z
				.enum(["task", "bug", "story", "epic", "chore"])
				.optional()
				.default("task")
				.describe("Issue type"),
			status: z
				.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"])
				.optional()
				.default("backlog"),
			priority: z
				.enum(["trivial", "low", "medium", "high", "urgent"])
				.optional()
				.default("medium"),
			assigneeId: z.string().uuid().optional().describe("Assignee user UUID"),
			sprintId: z.string().uuid().optional().describe("Sprint UUID"),
			labels: z.array(z.string()).optional(),
			storyPoints: z.number().int().min(0).max(99).optional(),
			prUrl: z.string().url().optional().nullable().describe("PR or branch URL"),
			dueAt: z.string().datetime().optional().describe("ISO 8601 due date"),
		},
		async ({ idOrKey, ...body }) => {
			const data = await api("POST", `/projects/${idOrKey}/issues`, body);
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);

	server.tool(
		"update_issue",
		"Update fields of an existing issue",
		{
			id: z.string().uuid().describe("Issue UUID"),
			title: z.string().optional(),
			description: z.string().optional(),
			type: z.enum(["task", "bug", "story", "epic", "chore"]).optional(),
			status: z
				.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"])
				.optional(),
			priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).optional(),
			assigneeId: z.string().uuid().nullable().optional(),
			sprintId: z.string().uuid().nullable().optional(),
			labels: z.array(z.string()).optional(),
			storyPoints: z.number().int().min(0).max(99).optional(),
			prUrl: z.string().url().nullable().optional().describe("PR or branch URL"),
			dueAt: z.string().datetime().nullable().optional(),
		},
		async ({ id, ...body }) => {
			const data = await api("PATCH", `/issues/${id}`, body);
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);

	server.tool(
		"delete_issue",
		"Permanently delete an issue",
		{ id: z.string().uuid().describe("Issue UUID") },
		async ({ id }) => {
			await api("DELETE", `/issues/${id}`);
			return { content: [{ type: "text", text: "Deleted." }] };
		},
	);

	server.tool(
		"add_comment",
		"Add a comment to an issue",
		{
			id: z.string().uuid().describe("Issue UUID"),
			body: z.string().describe("Comment body (markdown)"),
		},
		async ({ id, body }) => {
			const data = await api("POST", `/issues/${id}/comments`, { body });
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
		},
	);
}
