import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
  server.tool("list_projects", "List all accessible projects", {}, async () => {
    const data = await api<{ projects: unknown[] }>("GET", "/projects");
    return {
      content: [{ type: "text", text: JSON.stringify(data.projects, null, 2) }],
    };
  });

  server.tool(
    "get_project",
    "Get a project with its members",
    { idOrKey: z.string().describe("Project UUID or short key (e.g. ORB)") },
    async ({ idOrKey }) => {
      const data = await api("GET", `/projects/${idOrKey}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "create_project",
    "Create a new project",
    {
      key: z.string().describe("Short uppercase key, 2-10 chars (e.g. ORBIT)"),
      name: z.string().describe("Display name"),
      description: z.string().optional().describe("Project description"),
      memberIds: z
        .array(z.string().uuid())
        .optional()
        .describe("Initial member UUIDs"),
    },
    async (body) => {
      const data = await api("POST", "/projects", body);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
