import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DB } from "../db/client";
import { User, sprints } from "../db/schema";
import { loadProject, assertMember } from "../lib/access";

export function register(server: McpServer, db: DB, user: User): void {
  server.tool(
    "list_sprints",
    "List sprints for a project",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const rows = await db
        .select()
        .from(sprints)
        .where(eq(sprints.projectId, project.id))
        .orderBy(desc(sprints.createdAt));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "create_sprint",
    "Create a sprint for a project",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      name: z.string().describe("Sprint name"),
      goal: z.string().optional(),
      status: z
        .enum(["planned", "active", "completed"])
        .optional()
        .default("planned"),
      startsAt: z
        .string()
        .datetime()
        .optional()
        .describe("ISO 8601 start date"),
      endsAt: z.string().datetime().optional().describe("ISO 8601 end date"),
    },
    async ({ idOrKey, ...body }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const [row] = await db
        .insert(sprints)
        .values({
          projectId: project.id,
          name: body.name,
          goal: body.goal,
          status: body.status ?? "planned",
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
        })
        .returning();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "update_sprint",
    "Update a sprint",
    {
      id: z.string().uuid().describe("Sprint UUID"),
      name: z.string().optional(),
      goal: z.string().optional(),
      status: z.enum(["planned", "active", "completed"]).optional(),
      startsAt: z.string().datetime().nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
    },
    async ({ id, ...body }) => {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined)
          patch[k] =
            (k === "startsAt" || k === "endsAt") && v
              ? new Date(v as string)
              : v;
      }
      const [row] = await db
        .update(sprints)
        .set(patch)
        .where(eq(sprints.id, id))
        .returning();
      if (!row) throw new Error("sprint not found");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );
}
