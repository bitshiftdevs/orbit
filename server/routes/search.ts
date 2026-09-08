import { and, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "@server/db/client";
import {
	issues,
	projectMembers,
	projects,
	secrets,
	users,
} from "@server/db/schema";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
	const q = (c.req.query("q") ?? "").trim();
	if (!q) return c.json({ projects: [], issues: [], members: [], secrets: [] });
	const db = getDb();
	const me = c.get("user");
	const wildcard = `%${q}%`;

	// Match `KEY-123` for direct issue lookup.
	const issueKeyMatch = /^([A-Za-z]+)[-\s]?(\d+)$/.exec(q);

	const [projectRows, issueRows, memberRows, secretRows] = await Promise.all([
		db
			.select({
				id: projects.id,
				key: projects.key,
				name: projects.name,
				color: projects.color,
			})
			.from(projects)
			.where(
				or(
					ilike(projects.key, wildcard),
					ilike(projects.name, wildcard),
				),
			)
			.limit(6),

		issueKeyMatch
			? db
					.select({
						id: issues.id,
						title: issues.title,
						number: issues.number,
						status: issues.status,
						projectKey: projects.key,
						projectId: projects.id,
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
						projectId: projects.id,
					})
					.from(issues)
					.innerJoin(projects, eq(projects.id, issues.projectId))
					.where(
						sql`${issues.searchVector} @@ websearch_to_tsquery('english', ${q})`,
					)
					.orderBy(
						sql`ts_rank(${issues.searchVector}, websearch_to_tsquery('english', ${q})) DESC`,
					)
					.limit(8),

		db
			.select({
				id: users.id,
				name: users.name,
				handle: users.handle,
				avatarUrl: users.avatarUrl,
				accentColor: users.accentColor,
			})
			.from(users)
			.where(
				or(ilike(users.name, wildcard), ilike(users.handle, wildcard)),
			)
			.limit(6),

		db
			.select({
				id: secrets.id,
				name: secrets.name,
				projectId: secrets.projectId,
				projectKey: projects.key,
			})
			.from(secrets)
			.innerJoin(projects, eq(projects.id, secrets.projectId))
			.where(ilike(secrets.name, wildcard))
			.limit(6),
	]);

	// Filter to visible projects (non-owners only see projects they're in).
	let visibleIds: Set<string> | null = null;
	if (me.role !== "owner") {
		const mem = await db
			.select({ projectId: projectMembers.projectId })
			.from(projectMembers)
			.where(eq(projectMembers.userId, me.id));
		visibleIds = new Set(mem.map((m) => m.projectId));
	}
	const filterVisible = <T extends { projectId?: string; id?: string }>(
		rows: T[],
	) => (visibleIds ? rows.filter((r) => visibleIds!.has((r as any).projectId ?? (r as any).id)) : rows);

	return c.json({
		projects: filterVisible(projectRows),
		issues: filterVisible(issueRows),
		members: memberRows,
		secrets: filterVisible(secretRows),
	});
});

export default app;
