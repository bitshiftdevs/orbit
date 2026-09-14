import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";
import { register as registerProjects } from "./projects";
import { register as registerIssues } from "./issues";
import { register as registerLinks } from "./links";
import { register as registerSprints } from "./sprints";
import { register as registerTemplates } from "./templates";
import { register as registerAnalytics } from "./analytics";
import { register as registerTeam } from "./team";
import { register as registerSearch } from "./search";
import { register as registerSecrets } from "./secrets";
import { register as registerFiles } from "./files";

export function buildStdioServer(api: ApiFn): McpServer {
  const server = new McpServer({ name: "orbit", version: "1.0.0" });

  registerProjects(server, api);
  registerIssues(server, api);
  registerLinks(server, api);
  registerSprints(server, api);
  registerTemplates(server, api);
  registerAnalytics(server, api);
  registerTeam(server, api);
  registerSearch(server, api);
  registerSecrets(server, api);
  registerFiles(server, api);

  return server;
}
