import { asc, count, eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { issues, users } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";
import type { User } from "~~/server/db/schema";

const author = {
	id: users.id,
	name: users.name,
	handle: users.handle,
	avatarUrl: users.avatarUrl,
	accentColor: users.accentColor,
};

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const projectKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(projectKey);
	await assertMember(user, project.id);
	const db = getDb();

	const limit = Math.min(Number(getQuery(event).limit ?? 500), 500);
	const offset = Math.max(Number(getQuery(event).offset ?? 0), 0);

	const [rows, [{ value: total }]] = await Promise.all([
		db
			.select({ issue: issues, assignee: author })
			.from(issues)
			.leftJoin(users, eq(users.id, issues.assigneeId))
			.where(eq(issues.projectId, project.id))
			.orderBy(asc(issues.rank))
			.limit(limit)
			.offset(offset),
		db
			.select({ value: count() })
			.from(issues)
			.where(eq(issues.projectId, project.id)),
	]);

	return {
		issues: rows.map((r) => ({
			...r.issue,
			key: `${project.key}-${r.issue.number}`,
			assignee: r.assignee?.id ? r.assignee : null,
		})),
		total,
		hasMore: offset + rows.length < total,
	};
});
