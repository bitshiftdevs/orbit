import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getDb } from "@server/db/client";
import { webhookDeliveries, webhooks } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { audit } from "@server/lib/audit";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const EVENTS = [
	"issue.created",
	"issue.updated",
	"issue.status_changed",
	"issue.commented",
	"sprint.started",
	"sprint.completed",
	"secret.created",
] as const;

const createSchema = z.object({
	name: z.string().min(1).max(120),
	url: z.string().url(),
	events: z.array(z.enum(EVENTS)).min(1),
	preset: z.enum(["generic", "slack", "discord"]).default("generic"),
});

app.get("/projects/:idOrKey/webhooks", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
	const rows = await db
		.select({
			id: webhooks.id,
			name: webhooks.name,
			url: webhooks.url,
			events: webhooks.events,
			preset: webhooks.preset,
			active: webhooks.active,
			createdAt: webhooks.createdAt,
		})
		.from(webhooks)
		.where(eq(webhooks.projectId, project.id))
		.orderBy(desc(webhooks.createdAt));
	return c.json({ webhooks: rows });
});

app.post("/projects/:idOrKey/webhooks", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const body = createSchema.parse(await c.req.json());
	const db = getDb();
	const signingSecret = randomBytes(32).toString("hex");
	const [row] = await db
		.insert(webhooks)
		.values({
			projectId: project.id,
			name: body.name,
			url: body.url,
			events: body.events,
			preset: body.preset,
			signingSecret,
		})
		.returning();
	await audit(c, {
		action: "webhook.create",
		projectId: project.id,
		targetId: row.id,
		targetName: row.name,
	});
	return c.json({ webhook: row, signingSecret }, 201);
});

app.patch("/webhooks/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(webhooks)
		.where(eq(webhooks.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "webhook not found" });
	await assertMember(c.get("user"), existing.projectId);
	const body = createSchema.partial().extend({ active: z.boolean().optional() }).parse(await c.req.json());
	const [row] = await db
		.update(webhooks)
		.set({
			name: body.name,
			url: body.url,
			events: body.events,
			preset: body.preset,
			active: body.active,
		})
		.where(eq(webhooks.id, existing.id))
		.returning();
	await audit(c, {
		action: "webhook.update",
		projectId: existing.projectId,
		targetId: row.id,
		targetName: row.name,
	});
	return c.json({ webhook: row });
});

app.delete("/webhooks/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(webhooks)
		.where(eq(webhooks.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "webhook not found" });
	await assertMember(c.get("user"), existing.projectId);
	await db.delete(webhooks).where(eq(webhooks.id, existing.id));
	await audit(c, {
		action: "webhook.delete",
		projectId: existing.projectId,
		targetId: existing.id,
		targetName: existing.name,
	});
	return c.json({ ok: true });
});

app.get("/webhooks/:id/deliveries", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(webhooks)
		.where(eq(webhooks.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "webhook not found" });
	await assertMember(c.get("user"), existing.projectId);
	const rows = await db
		.select()
		.from(webhookDeliveries)
		.where(eq(webhookDeliveries.webhookId, existing.id))
		.orderBy(desc(webhookDeliveries.createdAt))
		.limit(50);
	return c.json({ deliveries: rows });
});

export default app;
