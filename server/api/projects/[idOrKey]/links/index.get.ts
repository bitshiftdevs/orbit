import {
	and,
	eq,
	or,
	innerJoin,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { issueLinks, issues, projects } from "../../../db/schema";
import { assertMember } from "../../../lib/access";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const id = getRouterParam(event, "id") as string;
	const db = getDb();

	const [issue] = await db
		.select({ projectId: issues.projectId })
		.from(issues)
		.where(eq(issues.id, id))
		.limit(1);

	if (!issue) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await assertMember(user, issue.projectId);

	const rows = await db
		.select({
			link: issueLinks,
			linked: issues,
			project: { key: projects.key },
		})
		.from(issueLinks)
		.innerJoin(
			issues,
			or(
				and(eq(issueLinks.sourceId, id), eq(issues.id, issueLinks.targetId)),
				and(eq(issueLinks.targetId, id), eq(issues.id, issueLinks.sourceId)),
			),
		)
		.innerJoin(projects, eq(projects.id, issues.projectId))
		.where(or(eq(issueLinks.sourceId, id), eq(issueLinks.targetId, id)));

	return {
		links: rows.map(({ link, linked, project }) => {
			const outbound = link.sourceId === id;
			return {
				id: link.id,
				kind: outbound ? link.kind : invertKind(link.kind),
				sourceId: link.sourceId,
				targetId: link.targetId,
				createdAt: link.createdAt,
				linked: {
					id: linked.id,
					key: `${project.key}-${linked.number}`,
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
