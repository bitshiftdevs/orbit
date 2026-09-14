import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DB } from "../db/client";
import { User, projects, projectMembers, users } from "../db/schema";
import { loadProject, assertMember } from "../lib/access";

export function register(server: McpServer, db: DB, user: User): void {
  server.tool("list_projects", "List all accessible projects", {}, async () => {
    const rows =
      user.role === "owner"
        ? await db.select().from(projects).orderBy(desc(projects.updatedAt))
        : await db
            .select({ project: projects })
            .from(projects)
            .innerJoin(
              projectMembers,
              and(
                eq(projectMembers.projectId, projects.id),
                eq(projectMembers.userId, user.id),
              ),
            )
            .orderBy(desc(projects.updatedAt))
            .then((r) => r.map((x) => x.project));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
    };
  });

  server.tool(
    "get_project",
    "Get a project with its members",
    { idOrKey: z.string().describe("Project UUID or short key (e.g. ORB)") },
    async ({ idOrKey }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const members = await db
        .select({
          id: users.id,
          name: users.name,
          handle: users.handle,
          email: users.email,
          avatarUrl: users.avatarUrl,
          accentColor: users.accentColor,
          role: users.role,
          joinedAt: projectMembers.joinedAt,
        })
        .from(projectMembers)
        .innerJoin(users, eq(users.id, projectMembers.userId))
        .where(eq(projectMembers.projectId, project.id));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ project, members }, null, 2),
          },
        ],
      };
    },
  );
}
