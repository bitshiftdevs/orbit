#!/usr/bin/env bun
/**
 * Orbit MCP server — exposes project/issue management as MCP tools.
 *
 * Required env vars:
 *   ORBIT_BASE_URL  — e.g. http://localhost:8888
 *   ORBIT_API_TOKEN — an `orb_...` token created in Settings → API Tokens
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.ORBIT_BASE_URL ?? "http://localhost:8888").replace(/\/$/, "");
const TOKEN = process.env.ORBIT_API_TOKEN ?? "";

if (!TOKEN) {
	process.stderr.write("ORBIT_API_TOKEN is not set\n");
	process.exit(1);
}

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${BASE_URL}/api${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${TOKEN}`,
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new Error(`${method} ${path} → ${res.status}: ${text}`);
	}
	return res.json() as Promise<T>;
}

const server = new McpServer({ name: "orbit", version: "1.0.0" });

// ─── Projects ────────────────────────────────────────────────────────────────

server.tool("list_projects", "List all accessible projects", {}, async () => {
	const data = await api<{ projects: unknown[] }>("GET", "/projects");
	return { content: [{ type: "text", text: JSON.stringify(data.projects, null, 2) }] };
});

server.tool(
	"get_project",
	"Get a project with its members",
	{ idOrKey: z.string().describe("Project UUID or short key (e.g. ORB)") },
	async ({ idOrKey }) => {
		const data = await api("GET", `/projects/${idOrKey}`);
		return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
	},
);

server.tool(
	"create_project",
	"Create a new project",
	{
		key: z.string().describe("Short uppercase key, 2-10 chars (e.g. ORBIT)"),
		name: z.string().describe("Display name"),
		description: z.string().optional().describe("Project description"),
		memberIds: z.array(z.string().uuid()).optional().describe("Initial member UUIDs"),
	},
	async (body) => {
		const data = await api("POST", "/projects", body);
		return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
	},
);

// ─── Issues ──────────────────────────────────────────────────────────────────

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

// ─── Sprints ─────────────────────────────────────────────────────────────────

server.tool(
	"list_sprints",
	"List sprints for a project",
	{ idOrKey: z.string().describe("Project UUID or short key") },
	async ({ idOrKey }) => {
		const data = await api<{ sprints: unknown[] }>("GET", `/projects/${idOrKey}/sprints`);
		return { content: [{ type: "text", text: JSON.stringify(data.sprints, null, 2) }] };
	},
);

server.tool(
	"create_sprint",
	"Create a sprint for a project",
	{
		idOrKey: z.string().describe("Project UUID or short key"),
		name: z.string().describe("Sprint name"),
		goal: z.string().optional().describe("Sprint goal"),
		status: z.enum(["planned", "active", "completed"]).optional().default("planned"),
		startsAt: z.string().datetime().optional().describe("ISO 8601 start date"),
		endsAt: z.string().datetime().optional().describe("ISO 8601 end date"),
	},
	async ({ idOrKey, ...body }) => {
		const data = await api("POST", `/projects/${idOrKey}/sprints`, body);
		return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
	},
);

server.tool(
	"update_sprint",
	"Update a sprint",
	{
		id: z.string().uuid().describe("Sprint UUID"),
		name: z.string().optional(),
		goal: z.string().optional(),
		status: z.enum(["planned", "active", "completed"]).optional(),
		startsAt: z.string().datetime().nullable().optional(),
		endsAt: z.string().datetime().nullable().optional(),
	},
	async ({ id, ...body }) => {
		const data = await api("PATCH", `/sprints/${id}`, body);
		return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
	},
);

// ─── Team ─────────────────────────────────────────────────────────────────────

server.tool("list_team", "List all workspace members", {}, async () => {
	const data = await api<{ team: unknown[] }>("GET", "/team");
	return { content: [{ type: "text", text: JSON.stringify(data.team, null, 2) }] };
});

// ─── Search ───────────────────────────────────────────────────────────────────

server.tool(
	"search",
	"Search across projects, issues, members, and secrets",
	{ q: z.string().describe("Search query — also matches issue keys like ORB-42") },
	async ({ q }) => {
		const data = await api("GET", `/search?q=${encodeURIComponent(q)}`);
		return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
	},
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
