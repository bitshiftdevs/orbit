import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { issueTemplates } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const schema = z.object({
	name: z.string().min(1).max(120),
	description: z.string().max(2000).optional().nullable(),
	type: z.enum(["task", "bug", "story", "epic", "chore"]).default("task"),
	priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).default("medium"),
	labels: z.array(z.string().max(40)).max(20).default([]),
	body: z.string().max(20000).optional().nullable(),
});

app.get("/projects/:idOrKey/templates", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
	const rows = await db
		.select()
		.from(issueTemplates)
		.where(eq(issueTemplates.projectId, project.id))
		.orderBy(issueTemplates.createdAt);
	return c.json({ templates: rows });
});

app.post("/projects/:idOrKey/templates", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const body = schema.parse(await c.req.json());
	const db = getDb();
	const [row] = await db
		.insert(issueTemplates)
		.values({
			projectId: project.id,
			name: body.name,
			description: body.description ?? null,
			type: body.type,
			priority: body.priority,
			labels: body.labels,
			body: body.body ?? null,
			createdById: c.get("user").id,
		})
		.returning();
	return c.json({ template: row }, 201);
});

app.patch("/templates/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(issueTemplates)
		.where(eq(issueTemplates.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "template not found" });
	await assertMember(c.get("user"), existing.projectId);
	const body = schema.partial().parse(await c.req.json());
	const [row] = await db
		.update(issueTemplates)
		.set(body)
		.where(eq(issueTemplates.id, existing.id))
		.returning();
	return c.json({ template: row });
});

app.delete("/templates/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(issueTemplates)
		.where(eq(issueTemplates.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "template not found" });
	await assertMember(c.get("user"), existing.projectId);
	await db.delete(issueTemplates).where(eq(issueTemplates.id, existing.id));
	return c.json({ ok: true });
});

export default app;
