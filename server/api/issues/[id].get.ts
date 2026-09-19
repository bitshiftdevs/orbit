import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { issueComments, issues, projects, users } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";

const authorShape = {
	id: users.id,
	name: users.name,
	handle: users.handle,
	avatarUrl: users.avatarUrl,
	accentColor: users.accentColor,
};

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const db = getDb();
	const id = getRouterParam(event, "id") as string;

	const reporter = alias(users, "reporter");
	const reporterShape = {
		id: reporter.id,
		name: reporter.name,
		handle: reporter.handle,
		avatarUrl: reporter.avatarUrl,
		accentColor: reporter.accentColor,
	};

	const [row] = await db
		.select({
			issue: issues,
			project: projects,
			assignee: authorShape,
			reporter: reporterShape,
		})
		.from(issues)
		.innerJoin(projects, eq(projects.id, issues.projectId))
		.leftJoin(users, eq(users.id, issues.assigneeId))
		.leftJoin(reporter, eq(reporter.id, issues.reporterId))
		.where(eq(issues.id, id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await assertMember(user, row.project.id);

	const comments = await db
		.select({
			comment: issueComments,
			author: authorShape,
		})
		.from(issueComments)
		.innerJoin(users, eq(users.id, issueComments.authorId))
		.where(eq(issueComments.issueId, row.issue.id))
		.orderBy(asc(issueComments.createdAt));

	return {
		issue: {
			...row.issue,
			key: `${row.project.key}-${row.issue.number}`,
			assignee: row.assignee?.id ? row.assignee : null,
			reporter: row.reporter?.id ? row.reporter : null,
		},
		project: row.project,
		comments: comments.map((c) => ({
			...c.comment,
			author: c.author,
		})),
	};
});
