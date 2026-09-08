import { asc, desc, eq, and, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getDb } from "@server/db/client";
import {
	issues,
	issueComments,
	projects,
	projectMembers,
	sprints,
	users,
} from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { initialRank, midpoint } from "@server/lib/rank";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";
import type { User } from "@server/db/schema";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const author = {
	id: users.id,
	name: users.name,
	handle: users.handle,
	avatarUrl: users.avatarUrl,
	accentColor: users.accentColor,
};

function buildServer(user: User) {
	const server = new McpServer({ name: "orbit", version: "1.0.0" });
	const db = getDb();

	// ─── Projects ──────────────────────────────────────────────────────────────

	server.tool("list_projects", "List all accessible projects", {}, async () => {
		const rows =
			user.role === "owner"
				? await db.select().from(projects).orderBy(desc(projects.updatedAt))
				: await db
						.select({ project: projects })
						.from(projects)
						.innerJoin(
							projectMembers,
							and(
								eq(projectMembers.projectId, projects.id),
								eq(projectMembers.userId, user.id),
							),
						)
						.orderBy(desc(projects.updatedAt))
						.then((r) => r.map((x) => x.project));
		return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
	});

	server.tool(
		"get_project",
		"Get a project with its members",
		{ idOrKey: z.string().describe("Project UUID or short key (e.g. ORB)") },
		async ({ idOrKey }) => {
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
			const members = await db
				.select({
					id: users.id,
					name: users.name,
					handle: users.handle,
					email: users.email,
					avatarUrl: users.avatarUrl,
					accentColor: users.accentColor,
					role: users.role,
					joinedAt: projectMembers.joinedAt,
				})
				.from(projectMembers)
				.innerJoin(users, eq(users.id, projectMembers.userId))
				.where(eq(projectMembers.projectId, project.id));
			return {
				content: [{ type: "text" as const, text: JSON.stringify({ project, members }, null, 2) }],
			};
		},
	);

	// ─── Issues ────────────────────────────────────────────────────────────────

	server.tool(
		"list_issues",
		"List all issues for a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
			const rows = await db
				.select({ issue: issues, assignee: author })
				.from(issues)
				.leftJoin(users, eq(users.id, issues.assigneeId))
				.where(eq(issues.projectId, project.id))
				.orderBy(asc(issues.rank));
			const shaped = rows.map((r) => ({
				...r.issue,
				key: `${project.key}-${r.issue.number}`,
				assignee: r.assignee?.id ? r.assignee : null,
			}));
			return { content: [{ type: "text" as const, text: JSON.stringify(shaped, null, 2) }] };
		},
	);

	server.tool(
		"get_issue",
		"Get a single issue by UUID",
		{ id: z.string().uuid().describe("Issue UUID") },
		async ({ id }) => {
			const [row] = await db
				.select({ issue: issues, project: projects, assignee: author })
				.from(issues)
				.innerJoin(projects, eq(projects.id, issues.projectId))
				.leftJoin(users, eq(users.id, issues.assigneeId))
				.where(eq(issues.id, id))
				.limit(1);
			if (!row) throw new Error("issue not found");
			await assertMember(user, row.project.id);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
			};
		},
	);

	server.tool(
		"create_issue",
		"Create a new issue inside a project",
		{
			idOrKey: z.string().describe("Project UUID or short key"),
			title: z.string().describe("Issue title"),
			description: z.string().optional().describe("Markdown body"),
			type: z.enum(["task", "bug", "story", "epic", "chore"]).optional().default("task"),
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
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
			const inserted = await db.transaction(async (tx) => {
				const [projRow] = await tx
					.update(projects)
					.set({ issueCounter: sql`${projects.issueCounter} + 1`, updatedAt: new Date() })
					.where(eq(projects.id, project.id))
					.returning({ counter: projects.issueCounter });
				const [last] = await tx
					.select({ rank: issues.rank })
					.from(issues)
					.where(and(eq(issues.projectId, project.id), eq(issues.status, body.status ?? "backlog")))
					.orderBy(desc(issues.rank))
					.limit(1);
				const rank = last ? midpoint(last.rank, null) : initialRank();
				const [row] = await tx
					.insert(issues)
					.values({
						projectId: project.id,
						number: projRow.counter,
						title: body.title,
						description: body.description,
						type: body.type ?? "task",
						status: body.status ?? "backlog",
						priority: body.priority ?? "medium",
						storyPoints: body.storyPoints,
						assigneeId: body.assigneeId ?? null,
						reporterId: user.id,
						sprintId: body.sprintId ?? null,
						labels: body.labels ?? [],
						dueAt: body.dueAt ? new Date(body.dueAt) : null,
						rank,
					})
					.returning();
				return { ...row, key: `${project.key}-${projRow.counter}` };
			});
			return { content: [{ type: "text" as const, text: JSON.stringify(inserted, null, 2) }] };
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
			const [existing] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
			if (!existing) throw new Error("issue not found");
			await assertMember(user, existing.projectId);
			const patch: Record<string, unknown> = { updatedAt: new Date() };
			for (const [k, v] of Object.entries(body)) {
				if (v !== undefined) patch[k] = k === "dueAt" && v ? new Date(v as string) : v;
			}
			const [updated] = await db
				.update(issues)
				.set(patch)
				.where(eq(issues.id, id))
				.returning();
			return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
		},
	);

	server.tool(
		"delete_issue",
		"Permanently delete an issue",
		{ id: z.string().uuid().describe("Issue UUID") },
		async ({ id }) => {
			const [existing] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
			if (!existing) throw new Error("issue not found");
			await assertMember(user, existing.projectId);
			await db.delete(issues).where(eq(issues.id, id));
			return { content: [{ type: "text" as const, text: "Deleted." }] };
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
			const [existing] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
			if (!existing) throw new Error("issue not found");
			await assertMember(user, existing.projectId);
			const [comment] = await db
				.insert(issueComments)
				.values({ issueId: id, authorId: user.id, body })
				.returning();
			return { content: [{ type: "text" as const, text: JSON.stringify(comment, null, 2) }] };
		},
	);

	// ─── Sprints ───────────────────────────────────────────────────────────────

	server.tool(
		"list_sprints",
		"List sprints for a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
			const rows = await db
				.select()
				.from(sprints)
				.where(eq(sprints.projectId, project.id))
				.orderBy(desc(sprints.createdAt));
			return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
		},
	);

	server.tool(
		"create_sprint",
		"Create a sprint for a project",
		{
			idOrKey: z.string().describe("Project UUID or short key"),
			name: z.string().describe("Sprint name"),
			goal: z.string().optional(),
			status: z.enum(["planned", "active", "completed"]).optional().default("planned"),
			startsAt: z.string().datetime().optional(),
			endsAt: z.string().datetime().optional(),
		},
		async ({ idOrKey, ...body }) => {
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
			const [row] = await db
				.insert(sprints)
				.values({
					projectId: project.id,
					name: body.name,
					goal: body.goal,
					status: body.status ?? "planned",
					startsAt: body.startsAt ? new Date(body.startsAt) : null,
					endsAt: body.endsAt ? new Date(body.endsAt) : null,
				})
				.returning();
			return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
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
			const patch: Record<string, unknown> = { updatedAt: new Date() };
			for (const [k, v] of Object.entries(body)) {
				if (v !== undefined)
					patch[k] =
						(k === "startsAt" || k === "endsAt") && v ? new Date(v as string) : v;
			}
			const [row] = await db.update(sprints).set(patch).where(eq(sprints.id, id)).returning();
			if (!row) throw new Error("sprint not found");
			return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
		},
	);

	// ─── Team ──────────────────────────────────────────────────────────────────

	server.tool("list_team", "List all workspace members", {}, async () => {
		const rows = await db
			.select({
				id: users.id,
				name: users.name,
				handle: users.handle,
				email: users.email,
				avatarUrl: users.avatarUrl,
				role: users.role,
				accentColor: users.accentColor,
			})
			.from(users);
		return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
	});

	// ─── Search ────────────────────────────────────────────────────────────────

	server.tool(
		"search",
		"Search across projects, issues, and members",
		{ q: z.string().describe("Query — also matches issue keys like ORB-42") },
		async ({ q }) => {
			if (!q.trim()) return { content: [{ type: "text" as const, text: "{}" }] };
			const wildcard = `%${q}%`;
			const issueKeyMatch = /^([A-Za-z]+)[-\s]?(\d+)$/.exec(q);
			const [projectRows, issueRows, memberRows] = await Promise.all([
				db
					.select({ id: projects.id, key: projects.key, name: projects.name })
					.from(projects)
					.where(or(ilike(projects.key, wildcard), ilike(projects.name, wildcard)))
					.limit(6),
				issueKeyMatch
					? db
							.select({
								id: issues.id,
								title: issues.title,
								number: issues.number,
								status: issues.status,
								projectKey: projects.key,
							})
							.from(issues)
							.innerJoin(projects, eq(projects.id, issues.projectId))
							.where(
								and(
									eq(projects.key, issueKeyMatch[1].toUpperCase()),
									eq(issues.number, Number(issueKeyMatch[2])),
								),
							)
							.limit(6)
					: db
							.select({
								id: issues.id,
								title: issues.title,
								number: issues.number,
								status: issues.status,
								projectKey: projects.key,
							})
							.from(issues)
							.innerJoin(projects, eq(projects.id, issues.projectId))
							.where(ilike(issues.title, wildcard))
							.limit(8),
				db
					.select({ id: users.id, name: users.name, handle: users.handle })
					.from(users)
					.where(or(ilike(users.name, wildcard), ilike(users.handle, wildcard)))
					.limit(6),
			]);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ projects: projectRows, issues: issueRows, members: memberRows }, null, 2),
					},
				],
			};
		},
	);

	return server;
}

app.all("/", async (c) => {
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});
	const server = buildServer(c.get("user"));
	await server.connect(transport);
	const response = await transport.handleRequest(c.req.raw);
	await server.close();
	return response;
});

export default app;
