import { and, asc, count, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import {
	issues,
	savedFilters,
	sprints,
	users,
} from "~~/server/db/schema";
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

	const query = getQuery(event);
	const limit = Math.min(Number(query.limit ?? 500), 500);
	const offset = Math.max(Number(query.offset ?? 0), 0);
	const include = String(query.include ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const wantSprints = include.includes("sprints");
	const wantFilters = include.includes("filters");

	const [rows, [{ value: total }], sprintRows, filterRows] = await Promise.all([
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
		wantSprints
			? db
					.select()
					.from(sprints)
					.where(eq(sprints.projectId, project.id))
					.orderBy(desc(sprints.createdAt))
			: Promise.resolve([] as Array<typeof sprints.$inferSelect>),
		wantFilters
			? db
					.select()
					.from(savedFilters)
					.where(
						and(
							eq(savedFilters.userId, user.id),
							or(
								eq(savedFilters.projectId, project.id),
								isNull(savedFilters.projectId),
							),
						),
					)
					.orderBy(desc(savedFilters.createdAt))
			: Promise.resolve([] as Array<typeof savedFilters.$inferSelect>),
	]);

	const payload: Record<string, unknown> = {
		issues: rows.map((r) => ({
			...r.issue,
			key: `${project.key}-${r.issue.number}`,
			assignee: r.assignee?.id ? r.assignee : null,
		})),
		total,
		hasMore: offset + rows.length < total,
	};
	if (wantSprints) payload.sprints = sprintRows;
	if (wantFilters) payload.filters = filterRows;
	return payload;
});
