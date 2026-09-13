import {
	and,
	avg,
	count,
	eq,
	isNotNull,
	sql,
	select,
	from,
	leftJoin,
	groupBy,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { issues, sprints } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			sprintId: sprints.id,
			sprintName: sprints.name,
			status: sprints.status,
			startsAt: sprints.startsAt,
			endsAt: sprints.endsAt,
			committed: sql<number>`coalesce(sum(${issues.storyPoints}), 0)`.mapWith(
				Number,
			),
			completed: sql<number>`coalesce(sum(${issues.storyPoints}) filter (where ${issues.status} = 'done'), 0)`.mapWith(
				Number,
			),
			issueCount: count(issues.id),
		})
		.from(sprints)
		.leftJoin(issues, eq(issues.sprintId, sprints.id))
		.where(eq(sprints.projectId, project.id))
		.groupBy(sprints.id)
		.orderBy(sprints.createdAt);

	return { velocity: rows };
});
