import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
  server.tool(
    "list_sprints",
    "List sprints for a project",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const data = await api<{ sprints: unknown[] }>(
        "GET",
        `/projects/${idOrKey}/sprints`,
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(data.sprints, null, 2) },
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
      goal: z.string().optional().describe("Sprint goal"),
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
      const data = await api("POST", `/projects/${idOrKey}/sprints`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
      const data = await api("PATCH", `/sprints/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
