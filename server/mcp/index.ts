import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDb } from "../db/client";
import { User } from "../db/schema";
import { register as registerAnalytics } from "./analytics";
import { register as registerFiles } from "./files";
import { register as registerIssues } from "./issues";
import { register as registerLinks } from "./links";
import { register as registerProjects } from "./projects";
import { register as registerSearch } from "./search";
import { register as registerSecrets } from "./secrets";
import { register as registerSprints } from "./sprints";
import { register as registerTeam } from "./team";
import { register as registerTemplates } from "./templates";

export function buildServer(user: User): McpServer {
  const server = new McpServer({ name: "orbit", version: "1.0.0" });
  const db = getDb();

  registerProjects(server, db, user);
  registerIssues(server, db, user);
  registerLinks(server, db, user);
  registerSprints(server, db, user);
  registerTemplates(server, db, user);
  registerAnalytics(server, db, user);
  registerTeam(server, db, user);
  registerSearch(server, db, user);
  registerSecrets(server, db, user);
  registerFiles(server, db, user);

  return server;
}
