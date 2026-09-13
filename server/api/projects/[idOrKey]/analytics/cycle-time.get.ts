import {
	and,
	count,
	eq,
	isNotNull,
	sql,
	select,
	from,
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
			type: issues.type,
			avgDays: sql<number>`round(avg(extract(epoch from ${issues.completedAt} - ${issues.createdAt}) / 86400), 1)`.mapWith(
				Number,
			),
			count: count(issues.id),
		})
		.from(issues)
		.where(
			and(
				eq(issues.projectId, project.id),
				isNotNull(issues.completedAt),
			),
		)
		.groupBy(issues.type)
		.orderBy(issues.type);

	return { cycleTime: rows };
});
