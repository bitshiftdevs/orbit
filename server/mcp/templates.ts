import { eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DB } from "../db/client";
import { User, issueTemplates } from "../db/schema";
import { loadProject, assertMember } from "../lib/access";

export function register(server: McpServer, db: DB, user: User): void {
  server.tool(
    "list_templates",
    "List issue templates for a project",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const rows = await db
        .select()
        .from(issueTemplates)
        .where(eq(issueTemplates.projectId, project.id))
        .orderBy(issueTemplates.createdAt);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "create_template",
    "Create an issue template for a project",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      name: z.string().describe("Template name"),
      description: z
        .string()
        .optional()
        .nullable()
        .describe("Short description of the template"),
      type: z
        .enum(["task", "bug", "story", "epic", "chore"])
        .optional()
        .default("task"),
      priority: z
        .enum(["trivial", "low", "medium", "high", "urgent"])
        .optional()
        .default("medium"),
      labels: z.array(z.string()).optional().default([]),
      body: z
        .string()
        .optional()
        .nullable()
        .describe("Default issue body (markdown)"),
    },
    async ({ idOrKey, ...body }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const [row] = await db
        .insert(issueTemplates)
        .values({ projectId: project.id, ...body, createdById: user.id })
        .returning();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );
}
