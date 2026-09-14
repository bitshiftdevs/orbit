import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
  server.tool("list_team", "List all workspace members", {}, async () => {
    const data = await api<{ team: unknown[] }>("GET", "/team");
    return {
      content: [{ type: "text", text: JSON.stringify(data.team, null, 2) }],
    };
  });
}
