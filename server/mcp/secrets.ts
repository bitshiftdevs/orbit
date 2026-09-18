import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DB } from "../db/client";
import { User, envVars, secrets } from "../db/schema";
import { loadProject, assertMember } from "../lib/access";
import { decryptSecret, encryptSecret, lastFour } from "../lib/crypto";

export function register(server: McpServer, db: DB, user: User): void {
  // ─── Secrets ───────────────────────────────────────────────────────────────

  server.tool(
    "list_secrets",
    "List secrets for a project (names and last-four only — values are encrypted)",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const rows = await db
        .select({
          id: secrets.id,
          name: secrets.name,
          description: secrets.description,
          lastFour: secrets.lastFour,
          createdAt: secrets.createdAt,
          updatedAt: secrets.updatedAt,
        })
        .from(secrets)
        .where(eq(secrets.projectId, project.id))
        .orderBy(desc(secrets.updatedAt));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "reveal_secret",
    "Reveal the plaintext value of a secret",
    {
      id: z.string().uuid().describe("Secret UUID"),
      reason: z
        .string()
        .optional()
        .describe("Reason for accessing the secret (audit log)"),
    },
    async ({ id }) => {
      const [row] = await db
        .select()
        .from(secrets)
        .where(eq(secrets.id, id))
        .limit(1);
      if (!row) throw new Error("secret not found");
      await assertMember(user, row.projectId);
      const value = decryptSecret(row.ciphertext);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ name: row.name, value }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "create_secret",
    "Create a new secret for a project",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      name: z
        .string()
        .regex(/^[A-Z0-9_]+$/)
        .describe("Uppercase name (e.g. DATABASE_URL)"),
      value: z.string().min(1).describe("Plaintext value — stored encrypted"),
      description: z.string().optional(),
    },
    async ({ idOrKey, name, value, description }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const ciphertext = encryptSecret(value);
      const [row] = await db
        .insert(secrets)
        .values({
          projectId: project.id,
          name,
          description,
          ciphertext,
          lastFour: lastFour(value),
          createdById: user.id,
        })
        .returning({
          id: secrets.id,
          name: secrets.name,
          description: secrets.description,
          lastFour: secrets.lastFour,
          createdAt: secrets.createdAt,
          updatedAt: secrets.updatedAt,
        });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "update_secret",
    "Update the value or description of a secret",
    {
      id: z.string().uuid().describe("Secret UUID"),
      value: z.string().min(1).optional().describe("New plaintext value"),
      description: z.string().optional(),
    },
    async ({ id, value, description }) => {
      const [existing] = await db
        .select()
        .from(secrets)
        .where(eq(secrets.id, id))
        .limit(1);
      if (!existing) throw new Error("secret not found");
      await assertMember(user, existing.projectId);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (description !== undefined) patch.description = description;
      if (value !== undefined) {
        patch.ciphertext = encryptSecret(value);
        patch.lastFour = lastFour(value);
      }
      const [row] = await db
        .update(secrets)
        .set(patch)
        .where(eq(secrets.id, id))
        .returning({
          id: secrets.id,
          name: secrets.name,
          description: secrets.description,
          lastFour: secrets.lastFour,
          createdAt: secrets.createdAt,
          updatedAt: secrets.updatedAt,
        });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "delete_secret",
    "Permanently delete a secret",
    { id: z.string().uuid().describe("Secret UUID") },
    async ({ id }) => {
      const [existing] = await db
        .select()
        .from(secrets)
        .where(eq(secrets.id, id))
        .limit(1);
      if (!existing) throw new Error("secret not found");
      await assertMember(user, existing.projectId);
      await db.delete(secrets).where(eq(secrets.id, id));
      return { content: [{ type: "text" as const, text: "Deleted." }] };
    },
  );

  // ─── Env Vars ──────────────────────────────────────────────────────────────

  server.tool(
    "list_env_vars",
    "List environment variables for a project (names and last-four only)",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const rows = await db
        .select({
          id: envVars.id,
          scope: envVars.scope,
          name: envVars.name,
          lastFour: envVars.lastFour,
          createdAt: envVars.createdAt,
          updatedAt: envVars.updatedAt,
        })
        .from(envVars)
        .where(eq(envVars.projectId, project.id))
        .orderBy(envVars.scope, envVars.name);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "reveal_env_var",
    "Reveal the plaintext value of an environment variable",
    { id: z.string().uuid().describe("Env var UUID") },
    async ({ id }) => {
      const [row] = await db
        .select()
        .from(envVars)
        .where(eq(envVars.id, id))
        .limit(1);
      if (!row) throw new Error("env var not found");
      await assertMember(user, row.projectId);
      const value = decryptSecret(row.ciphertext);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { name: row.name, scope: row.scope, value },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "set_env_var",
    "Create or update an environment variable (upserts on project + scope + name)",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      scope: z
        .enum(["development", "staging", "production"])
        .default("development"),
      name: z
        .string()
        .regex(/^[A-Z0-9_]+$/)
        .describe("Uppercase name (e.g. API_KEY)"),
      value: z.string().describe("Plaintext value — stored encrypted"),
    },
    async ({ idOrKey, scope, name, value }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const ciphertext = encryptSecret(value);
      const [row] = await db
        .insert(envVars)
        .values({
          projectId: project.id,
          scope,
          name,
          ciphertext,
          lastFour: lastFour(value),
          createdById: user.id,
        })
        .onConflictDoUpdate({
          target: [envVars.projectId, envVars.scope, envVars.name],
          set: { ciphertext, lastFour: lastFour(value), updatedAt: new Date() },
        })
        .returning({
          id: envVars.id,
          scope: envVars.scope,
          name: envVars.name,
          lastFour: envVars.lastFour,
          createdAt: envVars.createdAt,
          updatedAt: envVars.updatedAt,
        });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(row, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "delete_env_var",
    "Delete an environment variable",
    { id: z.string().uuid().describe("Env var UUID") },
    async ({ id }) => {
      const [existing] = await db
        .select()
        .from(envVars)
        .where(eq(envVars.id, id))
        .limit(1);
      if (!existing) throw new Error("env var not found");
      await assertMember(user, existing.projectId);
      await db.delete(envVars).where(eq(envVars.id, id));
      return { content: [{ type: "text" as const, text: "Deleted." }] };
    },
  );

  // ─── Env export ────────────────────────────────────────────────────────────

  server.tool(
    "ci_setup_instructions",
    "Return copy-pasteable GitHub Actions YAML and a curl command for loading a project's env (and optionally secrets) into a CI job. Use this when a user asks how to wire Orbit env/secrets into GitHub Actions, GitLab CI, or any other pipeline.",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      scope: z
        .enum(["development", "staging", "production"])
        .default("production"),
      includeSecrets: z
        .boolean()
        .default(true)
        .describe("Include project secrets alongside env vars"),
      orbitUrl: z
        .string()
        .optional()
        .describe(
          "Base URL of the Orbit deployment. Falls back to ORBIT_BASE_URL env var or a placeholder.",
        ),
    },
    async ({ idOrKey, scope, includeSecrets, orbitUrl }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const base = (orbitUrl ?? process.env.ORBIT_BASE_URL ?? "https://orbit.example.com").replace(/\/$/, "");
      const includeQ = includeSecrets ? "?include=secrets" : "";
      const scopes = includeSecrets ? "env:read, secrets:read" : "env:read";
      const yaml = `- name: Load Orbit env
  uses: bitshiftdevs/orbit/action@v1
  with:
    orbit-url: ${base}
    token: \${{ secrets.ORBIT_TOKEN }}
    project: ${project.key}
    scope: ${scope}${includeSecrets ? "" : "\n    include-secrets: false"}`;
      const curl = `curl -H "Authorization: Bearer $ORBIT_TOKEN" \\
  "${base}/api/projects/${project.key}/env/${scope}/dotenv${includeQ}"`;
      const instructions = [
        `# Loading ${project.key} env (${scope}) into CI`,
        ``,
        `1. In Orbit, go to **Settings → API tokens** and create a new token:`,
        `   - Project: **${project.key}**`,
        `   - Scopes: **${scopes}**`,
        `   - Uncheck \`write\`.`,
        `2. Copy the \`orb_...\` token and store it as a GitHub Actions repo secret named \`ORBIT_TOKEN\`.`,
        `3. Paste this step into your workflow:`,
        ``,
        "```yaml",
        yaml,
        "```",
        ``,
        `Or fetch directly with curl (e.g. from a non-GitHub runner):`,
        ``,
        "```bash",
        curl,
        "```",
        ``,
        `Values are auto-masked in GitHub Actions logs. Later steps read each variable from \`$GITHUB_ENV\`.`,
      ].join("\n");
      return { content: [{ type: "text" as const, text: instructions }] };
    },
  );

  server.tool(
    "export_dotenv",
    "Export all env vars for a scope as a .env file string",
    {
      idOrKey: z.string().describe("Project UUID or short key"),
      scope: z.enum(["development", "staging", "production"]),
    },
    async ({ idOrKey, scope }) => {
      const project = await loadProject(idOrKey);
      await assertMember(user, project.id);
      const rows = await db
        .select()
        .from(envVars)
        .where(and(eq(envVars.projectId, project.id), eq(envVars.scope, scope)))
        .orderBy(envVars.name);
      const dotenv = rows
        .map((r) => `${r.name}=${JSON.stringify(decryptSecret(r.ciphertext))}`)
        .join("\n");
      return { content: [{ type: "text" as const, text: dotenv }] };
    },
  );
}
