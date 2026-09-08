import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "@server/db/client";
import { envVars, secrets } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { decryptSecret, encryptSecret, lastFour } from "@server/lib/crypto";
import type { User } from "@server/db/schema";

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
			return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
		},
	);

	server.tool(
		"reveal_secret",
		"Reveal the plaintext value of a secret",
		{
			id: z.string().uuid().describe("Secret UUID"),
			reason: z.string().optional().describe("Reason for accessing the secret (audit log)"),
		},
		async ({ id }) => {
			const [row] = await db.select().from(secrets).where(eq(secrets.id, id)).limit(1);
			if (!row) throw new Error("secret not found");
			await assertMember(user, row.projectId);
			const value = decryptSecret(row.ciphertext);
			return { content: [{ type: "text" as const, text: JSON.stringify({ name: row.name, value }, null, 2) }] };
		},
	);

	server.tool(
		"create_secret",
		"Create a new secret for a project",
		{
			idOrKey: z.string().describe("Project UUID or short key"),
			name: z.string().regex(/^[A-Z0-9_]+$/).describe("Uppercase name (e.g. DATABASE_URL)"),
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
			return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
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
			const [existing] = await db.select().from(secrets).where(eq(secrets.id, id)).limit(1);
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
			return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
		},
	);

	server.tool(
		"delete_secret",
		"Permanently delete a secret",
		{ id: z.string().uuid().describe("Secret UUID") },
		async ({ id }) => {
			const [existing] = await db.select().from(secrets).where(eq(secrets.id, id)).limit(1);
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
			return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
		},
	);

	server.tool(
		"reveal_env_var",
		"Reveal the plaintext value of an environment variable",
		{ id: z.string().uuid().describe("Env var UUID") },
		async ({ id }) => {
			const [row] = await db.select().from(envVars).where(eq(envVars.id, id)).limit(1);
			if (!row) throw new Error("env var not found");
			await assertMember(user, row.projectId);
			const value = decryptSecret(row.ciphertext);
			return { content: [{ type: "text" as const, text: JSON.stringify({ name: row.name, scope: row.scope, value }, null, 2) }] };
		},
	);

	server.tool(
		"set_env_var",
		"Create or update an environment variable (upserts on project + scope + name)",
		{
			idOrKey: z.string().describe("Project UUID or short key"),
			scope: z.enum(["development", "staging", "production"]).default("development"),
			name: z.string().regex(/^[A-Z0-9_]+$/).describe("Uppercase name (e.g. API_KEY)"),
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
			return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
		},
	);

	server.tool(
		"delete_env_var",
		"Delete an environment variable",
		{ id: z.string().uuid().describe("Env var UUID") },
		async ({ id }) => {
			const [existing] = await db.select().from(envVars).where(eq(envVars.id, id)).limit(1);
			if (!existing) throw new Error("env var not found");
			await assertMember(user, existing.projectId);
			await db.delete(envVars).where(eq(envVars.id, id));
			return { content: [{ type: "text" as const, text: "Deleted." }] };
		},
	);

	// ─── Env export ────────────────────────────────────────────────────────────

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
