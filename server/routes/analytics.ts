import { and, avg, count, eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "@server/db/client";
import { issues, sprints } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// Velocity: completed story points per sprint for a project.
app.get("/projects/:idOrKey/velocity", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();

	const rows = await db
		.select({
			sprintId: sprints.id,
			sprintName: sprints.name,
			status: sprints.status,
			startsAt: sprints.startsAt,
			endsAt: sprints.endsAt,
			committed: sql<number>`coalesce(sum(${issues.storyPoints}), 0)`.mapWith(Number),
			completed: sql<number>`coalesce(sum(${issues.storyPoints}) filter (where ${issues.status} = 'done'), 0)`.mapWith(Number),
			issueCount: count(issues.id),
		})
		.from(sprints)
		.leftJoin(issues, eq(issues.sprintId, sprints.id))
		.where(eq(sprints.projectId, project.id))
		.groupBy(sprints.id)
		.orderBy(sprints.createdAt);

	return c.json({ velocity: rows });
});

// Cycle time: average days from creation to completion, grouped by issue type.
app.get("/projects/:idOrKey/cycle-time", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();

	const rows = await db
		.select({
			type: issues.type,
			avgDays: sql<number>`round(avg(extract(epoch from ${issues.completedAt} - ${issues.createdAt}) / 86400), 1)`.mapWith(Number),
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

	return c.json({ cycleTime: rows });
});

export default app;
