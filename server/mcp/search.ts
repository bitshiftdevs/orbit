import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "@server/db/client";
import { issues, projects, users } from "@server/db/schema";
import type { User } from "@server/db/schema";

export function register(server: McpServer, db: DB, _user: User): void {
	server.tool(
		"search",
		"Search across projects, issues, and members",
		{ q: z.string().describe("Query — also matches issue keys like ORB-42") },
		async ({ q }) => {
			if (!q.trim()) return { content: [{ type: "text" as const, text: "{}" }] };
			const wildcard = `%${q}%`;
			const issueKeyMatch = /^([A-Za-z]+)[-\s]?(\d+)$/.exec(q);
			const [projectRows, issueRows, memberRows] = await Promise.all([
				db
					.select({ id: projects.id, key: projects.key, name: projects.name })
					.from(projects)
					.where(or(ilike(projects.key, wildcard), ilike(projects.name, wildcard)))
					.limit(6),
				issueKeyMatch
					? db
							.select({
								id: issues.id,
								title: issues.title,
								number: issues.number,
								status: issues.status,
								projectKey: projects.key,
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
							})
							.from(issues)
							.innerJoin(projects, eq(projects.id, issues.projectId))
							.where(ilike(issues.title, wildcard))
							.limit(8),
				db
					.select({ id: users.id, name: users.name, handle: users.handle })
					.from(users)
					.where(or(ilike(users.name, wildcard), ilike(users.handle, wildcard)))
					.limit(6),
			]);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{ projects: projectRows, issues: issueRows, members: memberRows },
							null,
							2,
						),
					},
				],
			};
		},
	);
}
