import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { envVars, secrets } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { audit } from "@server/lib/audit";
import { decryptSecret, encryptSecret, lastFour } from "@server/lib/crypto";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// ---------------------------------------------------------------------------
// SECRETS
// ---------------------------------------------------------------------------
const secretSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(120)
		.regex(/^[A-Z0-9_]+$/, "uppercase, digits, underscores only"),
	description: z.string().max(1000).optional(),
	value: z.string().min(1),
});

app.get("/projects/:idOrKey/secrets", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
	const rows = await db
		.select({
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdById: secrets.createdById,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		})
		.from(secrets)
		.where(eq(secrets.projectId, project.id))
		.orderBy(desc(secrets.updatedAt));
	return c.json({ secrets: rows });
});

app.post("/projects/:idOrKey/secrets", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const body = secretSchema.parse(await c.req.json());
	const db = getDb();
	const ciphertext = encryptSecret(body.value);
	const actor = c.get("user");
	const [row] = await db
		.insert(secrets)
		.values({
			projectId: project.id,
			name: body.name,
			description: body.description,
			ciphertext,
			lastFour: lastFour(body.value),
			createdById: actor.id,
		})
		.returning({
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		});
	await audit(c, {
		action: "secret.create",
		projectId: project.id,
		targetId: row.id,
		targetName: row.name,
	});
	return c.json({ secret: row }, 201);
});

app.get("/secrets/:id/reveal", async (c) => {
	const db = getDb();
	const [row] = await db
		.select()
		.from(secrets)
		.where(eq(secrets.id, c.req.param("id")))
		.limit(1);
	if (!row) throw new HTTPException(404, { message: "secret not found" });
	await assertMember(c.get("user"), row.projectId);
	const value = decryptSecret(row.ciphertext);
	const reason = c.req.query("reason") ?? null;
	await audit(c, {
		action: "secret.read",
		projectId: row.projectId,
		targetId: row.id,
		targetName: row.name,
		meta: reason ? { reason } : null,
	});
	return c.json({ value });
});

app.patch("/secrets/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(secrets)
		.where(eq(secrets.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "secret not found" });
	await assertMember(c.get("user"), existing.projectId);
	const body = secretSchema.partial().parse(await c.req.json());
	const patch: Record<string, unknown> = {
		updatedAt: new Date(),
	};
	if (body.description !== undefined) patch.description = body.description;
	if (body.value !== undefined) {
		patch.ciphertext = encryptSecret(body.value);
		patch.lastFour = lastFour(body.value);
	}
	const [row] = await db
		.update(secrets)
		.set(patch)
		.where(eq(secrets.id, existing.id))
		.returning({
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		});
	await audit(c, {
		action: "secret.update",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: existing.name,
	});
	return c.json({ secret: row });
});

app.delete("/secrets/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(secrets)
		.where(eq(secrets.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "secret not found" });
	await assertMember(c.get("user"), existing.projectId);
	await db.delete(secrets).where(eq(secrets.id, existing.id));
	await audit(c, {
		action: "secret.delete",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: existing.name,
	});
	return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// ENV VARS (same shape, scoped)
// ---------------------------------------------------------------------------
const envSchema = z.object({
	scope: z.enum(["development", "staging", "production"]).default("development"),
	name: z
		.string()
		.min(1)
		.max(120)
		.regex(/^[A-Z0-9_]+$/),
	value: z.string(),
});

app.get("/projects/:idOrKey/env", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
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
	return c.json({ envVars: rows });
});

app.post("/projects/:idOrKey/env", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const body = envSchema.parse(await c.req.json());
	const db = getDb();
	const actor = c.get("user");
	const ciphertext = encryptSecret(body.value);
	const [row] = await db
		.insert(envVars)
		.values({
			projectId: project.id,
			scope: body.scope,
			name: body.name,
			ciphertext,
			lastFour: lastFour(body.value),
			createdById: actor.id,
		})
		.onConflictDoUpdate({
			target: [envVars.projectId, envVars.scope, envVars.name],
			set: {
				ciphertext,
				lastFour: lastFour(body.value),
				updatedAt: new Date(),
			},
		})
		.returning({
			id: envVars.id,
			scope: envVars.scope,
			name: envVars.name,
			lastFour: envVars.lastFour,
			createdAt: envVars.createdAt,
			updatedAt: envVars.updatedAt,
		});
	await audit(c, {
		action: "envvar.create",
		projectId: project.id,
		targetId: row.id,
		targetName: `${row.scope}:${row.name}`,
	});
	return c.json({ envVar: row }, 201);
});

app.get("/env/:id/reveal", async (c) => {
	const db = getDb();
	const [row] = await db
		.select()
		.from(envVars)
		.where(eq(envVars.id, c.req.param("id")))
		.limit(1);
	if (!row) throw new HTTPException(404, { message: "env var not found" });
	await assertMember(c.get("user"), row.projectId);
	const value = decryptSecret(row.ciphertext);
	await audit(c, {
		action: "envvar.read",
		projectId: row.projectId,
		targetId: row.id,
		targetName: `${row.scope}:${row.name}`,
	});
	return c.json({ value });
});

app.get("/projects/:idOrKey/env/:scope/dotenv", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const scope = c.req.param("scope") as "development" | "staging" | "production";
	if (!["development", "staging", "production"].includes(scope)) {
		throw new HTTPException(400, { message: "invalid scope" });
	}
	const db = getDb();
	const rows = await db
		.select()
		.from(envVars)
		.where(and(eq(envVars.projectId, project.id), eq(envVars.scope, scope)))
		.orderBy(envVars.name);
	const body = rows
		.map((r) => `${r.name}=${JSON.stringify(decryptSecret(r.ciphertext))}`)
		.join("\n");
	await audit(c, {
		action: "envvar.read",
		projectId: project.id,
		targetName: `${scope}:dotenv-export`,
		meta: { count: rows.length },
	});
	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"content-disposition": `attachment; filename="${project.key.toLowerCase()}.${scope}.env"`,
		},
	});
});

app.delete("/env/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(envVars)
		.where(eq(envVars.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "env var not found" });
	await assertMember(c.get("user"), existing.projectId);
	await db.delete(envVars).where(eq(envVars.id, existing.id));
	await audit(c, {
		action: "envvar.delete",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: `${existing.scope}:${existing.name}`,
	});
	return c.json({ ok: true });
});

export default app;
