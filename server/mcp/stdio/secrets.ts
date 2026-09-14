import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFn } from "./types";

export function register(server: McpServer, api: ApiFn): void {
  // ─── Secrets ───────────────────────────────────────────────────────────────

  server.tool(
    "list_secrets",
    "List secrets for a project (names and last-four only — values are encrypted)",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const data = await api<{ secrets: unknown[] }>(
        "GET",
        `/projects/${idOrKey}/secrets`,
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(data.secrets, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "reveal_secret",
    "Reveal the plaintext value of a secret",
    {
      id: z.string().uuid().describe("Secret UUID"),
      reason: z.string().optional().describe("Reason for access (audit log)"),
    },
    async ({ id, reason }) => {
      const params = reason ? `?reason=${encodeURIComponent(reason)}` : "";
      const data = await api<{ value: string }>(
        "GET",
        `/secrets/${id}/reveal${params}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
    async ({ idOrKey, ...body }) => {
      const data = await api("POST", `/projects/${idOrKey}/secrets`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
    async ({ id, ...body }) => {
      const data = await api("PATCH", `/secrets/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "delete_secret",
    "Permanently delete a secret",
    { id: z.string().uuid().describe("Secret UUID") },
    async ({ id }) => {
      await api("DELETE", `/secrets/${id}`);
      return { content: [{ type: "text", text: "Deleted." }] };
    },
  );

  // ─── Env Vars ──────────────────────────────────────────────────────────────

  server.tool(
    "list_env_vars",
    "List environment variables for a project (names and last-four only)",
    { idOrKey: z.string().describe("Project UUID or short key") },
    async ({ idOrKey }) => {
      const data = await api<{ envVars: unknown[] }>(
        "GET",
        `/projects/${idOrKey}/env`,
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(data.envVars, null, 2) },
        ],
      };
    },
  );

  server.tool(
    "reveal_env_var",
    "Reveal the plaintext value of an environment variable",
    { id: z.string().uuid().describe("Env var UUID") },
    async ({ id }) => {
      const data = await api<{ value: string }>("GET", `/env/${id}/reveal`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
    async ({ idOrKey, ...body }) => {
      const data = await api("POST", `/projects/${idOrKey}/env`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "delete_env_var",
    "Delete an environment variable",
    { id: z.string().uuid().describe("Env var UUID") },
    async ({ id }) => {
      await api("DELETE", `/env/${id}`);
      return { content: [{ type: "text", text: "Deleted." }] };
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
      const text = await fetch(
        `${process.env.ORBIT_BASE_URL ?? "http://localhost:8888"}/api/projects/${idOrKey}/env/${scope}/dotenv`,
        {
          headers: {
            Authorization: `Bearer ${process.env.ORBIT_API_TOKEN ?? ""}`,
          },
        },
      ).then((r) => r.text());
      return { content: [{ type: "text", text }] };
    },
  );
}
