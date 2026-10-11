import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  issueComments,
  issueLinks,
  issues,
  projects,
  sprints,
  users,
} from "../../db/schema";
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

	const linkedIssue = alias(issues, "linked_issue");
	const linkedProject = alias(projects, "linked_project");

	const [comments, projectSprints, linkRows] = await Promise.all([
		db
			.select({ comment: issueComments, author: authorShape })
			.from(issueComments)
			.innerJoin(users, eq(users.id, issueComments.authorId))
			.where(eq(issueComments.issueId, row.issue.id))
			.orderBy(asc(issueComments.createdAt)),
		db
			.select()
			.from(sprints)
			.where(eq(sprints.projectId, row.project.id))
			.orderBy(desc(sprints.createdAt)),
		db
			.select({
				link: issueLinks,
				linked: linkedIssue,
				projectKey: linkedProject.key,
			})
			.from(issueLinks)
			.innerJoin(
				linkedIssue,
				or(
					and(
						eq(issueLinks.sourceId, id),
						eq(linkedIssue.id, issueLinks.targetId),
					),
					and(
						eq(issueLinks.targetId, id),
						eq(linkedIssue.id, issueLinks.sourceId),
					),
				),
			)
			.innerJoin(linkedProject, eq(linkedProject.id, linkedIssue.projectId))
			.where(or(eq(issueLinks.sourceId, id), eq(issueLinks.targetId, id))),
	]);

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
		sprints: projectSprints,
		links: linkRows.map(({ link, linked, projectKey }) => {
			const outbound = link.sourceId === id;
			return {
				id: link.id,
				kind: outbound ? link.kind : invertKind(link.kind),
				sourceId: link.sourceId,
				targetId: link.targetId,
				createdAt: link.createdAt,
				linked: {
					id: linked.id,
					key: `${projectKey}-${linked.number}`,
					title: linked.title,
					status: linked.status,
					type: linked.type,
					priority: linked.priority,
				},
			};
		}),
	};
});

function invertKind(kind: string) {
	if (kind === "blocks") return "blocked_by";
	return kind;
}
