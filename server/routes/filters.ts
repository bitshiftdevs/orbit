import { and, desc, eq, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { savedFilters } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const querySchema = z.object({
	status: z.array(z.string()).optional(),
	priority: z.array(z.string()).optional(),
	type: z.array(z.string()).optional(),
	assigneeId: z.array(z.string()).optional(),
	labels: z.array(z.string()).optional(),
	sprintId: z.string().nullable().optional(),
	text: z.string().optional(),
});

app.get("/projects/:idOrKey/filters", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
	const me = c.get("user");
	const rows = await db
		.select()
		.from(savedFilters)
		.where(
			and(
				eq(savedFilters.userId, me.id),
				or(
					eq(savedFilters.projectId, project.id),
					isNull(savedFilters.projectId),
				),
			),
		)
		.orderBy(desc(savedFilters.createdAt));
	return c.json({ filters: rows });
});

app.post("/projects/:idOrKey/filters", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const body = z
		.object({
			name: z.string().min(1).max(120),
			query: querySchema,
			global: z.boolean().default(false),
		})
		.parse(await c.req.json());
	const db = getDb();
	const me = c.get("user");
	const [row] = await db
		.insert(savedFilters)
		.values({
			userId: me.id,
			projectId: body.global ? null : project.id,
			name: body.name,
			query: body.query as Record<string, unknown>,
		})
		.returning();
	return c.json({ filter: row }, 201);
});

app.delete("/filters/:id", async (c) => {
	const db = getDb();
	const me = c.get("user");
	const [row] = await db
		.select()
		.from(savedFilters)
		.where(
			and(
				eq(savedFilters.id, c.req.param("id")),
				eq(savedFilters.userId, me.id),
			),
		)
		.limit(1);
	if (!row) throw new HTTPException(404, { message: "filter not found" });
	await db.delete(savedFilters).where(eq(savedFilters.id, row.id));
	return c.json({ ok: true });
});

export default app;
