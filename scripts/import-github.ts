#!/usr/bin/env bun
// Import issues from a GitHub Issues JSON export into an Orbit project.
//
//   bun run scripts/import-github.ts \
//     --project ORB \
//     --file ./gh-export.json
//
// The input can be either:
//   • the array returned by `gh api "repos/OWNER/REPO/issues?state=all" --paginate`
//   • an object with an `issues` array
//
// Requires DATABASE_URL to be set.

import { eq, sql } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { issues, projects, users } from "../server/db/schema";
import { initialRank } from "../server/lib/rank";

type GhLabel = { name: string } | string;
type GhUser = { login: string; name?: string };
type GhIssue = {
	number: number;
	title: string;
	body: string | null;
	state: "open" | "closed";
	labels?: GhLabel[];
	assignee?: GhUser | null;
	assignees?: GhUser[];
	user?: GhUser;
	created_at: string;
	closed_at: string | null;
	pull_request?: unknown;
};

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
	const a = process.argv[i];
	if (a.startsWith("--")) args.set(a.slice(2), process.argv[++i] ?? "");
}

const projectKey = args.get("project")?.toUpperCase();
const file = args.get("file");
if (!projectKey || !file) {
	console.error("Usage: bun run scripts/import-github.ts --project KEY --file path.json");
	process.exit(1);
}

const raw = JSON.parse(await Bun.file(file).text());
const list: GhIssue[] = Array.isArray(raw) ? raw : raw.issues ?? [];
const nonPRs = list.filter((i) => !i.pull_request);

const db = getDb();
const [project] = await db
	.select()
	.from(projects)
	.where(eq(projects.key, projectKey))
	.limit(1);
if (!project) {
	console.error(`no project with key ${projectKey}`);
	process.exit(1);
}

const team = await db.select({ id: users.id, handle: users.handle }).from(users);
const handleMap = new Map(team.map((u) => [u.handle.toLowerCase(), u.id]));

let inserted = 0;
for (const gh of nonPRs) {
	const type =
		(Array.isArray(gh.labels) ? gh.labels : [])
			.map((l) => (typeof l === "string" ? l : l.name).toLowerCase())
			.find((n) => ["bug", "task", "story", "chore", "epic"].includes(n)) ??
		"task";
	const priorityLabel = (Array.isArray(gh.labels) ? gh.labels : [])
		.map((l) => (typeof l === "string" ? l : l.name).toLowerCase())
		.find((n) => ["urgent", "high", "medium", "low", "trivial"].includes(n));
	const assigneeHandle =
		gh.assignee?.login?.toLowerCase() ??
		gh.assignees?.[0]?.login?.toLowerCase();
	const status =
		gh.state === "closed" ? "done" : "backlog";

	const [{ counter }] = await db
		.update(projects)
		.set({ issueCounter: sql`${projects.issueCounter} + 1` })
		.where(eq(projects.id, project.id))
		.returning({ counter: projects.issueCounter });

	await db.insert(issues).values({
		projectId: project.id,
		number: counter,
		title: gh.title.slice(0, 240),
		description: gh.body,
		type: type as any,
		status: status as any,
		priority: (priorityLabel as any) ?? "medium",
		rank: initialRank(),
		assigneeId: assigneeHandle ? handleMap.get(assigneeHandle) ?? null : null,
		labels: (Array.isArray(gh.labels) ? gh.labels : [])
			.map((l) => (typeof l === "string" ? l : l.name))
			.slice(0, 20),
		createdAt: new Date(gh.created_at),
		completedAt: gh.closed_at ? new Date(gh.closed_at) : null,
	});
	inserted++;
}

console.log(`imported ${inserted} issues into ${projectKey}`);
process.exit(0);
