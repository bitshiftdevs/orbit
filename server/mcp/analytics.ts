import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "@server/db/client";
import { issues, sprints } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import type { User } from "@server/db/schema";

export function register(server: McpServer, db: DB, user: User): void {
	server.tool(
		"get_velocity",
		"Get sprint velocity (committed vs completed story points) for a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
			const rows = await db
				.select({
					sprintId: sprints.id,
					sprintName: sprints.name,
					status: sprints.status,
					committed: sql<number>`coalesce(sum(${issues.storyPoints}), 0)`.mapWith(Number),
					completed: sql<number>`coalesce(sum(${issues.storyPoints}) filter (where ${issues.status} = 'done'), 0)`.mapWith(Number),
					issueCount: count(issues.id),
				})
				.from(sprints)
				.leftJoin(issues, eq(issues.sprintId, sprints.id))
				.where(eq(sprints.projectId, project.id))
				.groupBy(sprints.id)
				.orderBy(sprints.createdAt);
			return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
		},
	);

	server.tool(
		"get_cycle_time",
		"Get average cycle time (days from creation to completion) by issue type for a project",
		{ idOrKey: z.string().describe("Project UUID or short key") },
		async ({ idOrKey }) => {
			const project = await loadProject(idOrKey);
			await assertMember(user, project.id);
			const rows = await db
				.select({
					type: issues.type,
					avgDays: sql<number>`round(avg(extract(epoch from ${issues.completedAt} - ${issues.createdAt}) / 86400), 1)`.mapWith(Number),
					count: count(issues.id),
				})
				.from(issues)
				.where(and(eq(issues.projectId, project.id), isNotNull(issues.completedAt)))
				.groupBy(issues.type)
				.orderBy(issues.type);
			return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
		},
	);
}
