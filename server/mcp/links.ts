import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DB } from "../db/client";
import { User, issueLinks, issues, projects } from "../db/schema";
import { assertMember } from "../lib/access";

export function register(server: McpServer, db: DB, user: User): void {
  server.tool(
    "get_issue_links",
    "Get dependency links for an issue (blocks / duplicates / relates_to)",
    { id: z.string().uuid().describe("Issue UUID") },
    async ({ id }) => {
      const rows = await db
        .select({
          link: issueLinks,
          linked: issues,
          project: { key: projects.key },
        })
        .from(issueLinks)
        .innerJoin(
          issues,
          or(
            and(
              eq(issueLinks.sourceId, id),
              eq(issues.id, issueLinks.targetId),
            ),
            and(
              eq(issueLinks.targetId, id),
              eq(issues.id, issueLinks.sourceId),
            ),
          ),
        )
        .innerJoin(projects, eq(projects.id, issues.projectId))
        .where(or(eq(issueLinks.sourceId, id), eq(issueLinks.targetId, id)));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "add_issue_link",
    "Add a link between two issues",
    {
      sourceId: z.string().uuid().describe("Source issue UUID"),
      targetId: z.string().uuid().describe("Target issue UUID"),
      kind: z
        .enum(["blocks", "duplicates", "relates_to"])
        .default("relates_to"),
    },
    async ({ sourceId, targetId, kind }) => {
      const [src] = await db
        .select({ projectId: issues.projectId })
        .from(issues)
        .where(eq(issues.id, sourceId))
        .limit(1);
      if (!src) throw new Error("source issue not found");
      await assertMember(user, src.projectId);
      const [row] = await db
        .insert(issueLinks)
        .values({ sourceId, targetId, kind, createdById: user.id })
        .onConflictDoNothing()
        .returning();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "remove_issue_link",
    "Remove a link between issues",
    { linkId: z.string().uuid().describe("Link UUID") },
    async ({ linkId }) => {
      await db.delete(issueLinks).where(eq(issueLinks.id, linkId));
      return { content: [{ type: "text" as const, text: "Link removed." }] };
    },
  );
}
