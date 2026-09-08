import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { sprints } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const schema = z.object({
	name: z.string().min(1).max(120),
	goal: z.string().max(4000).optional(),
	startsAt: z.string().datetime().optional().nullable(),
	endsAt: z.string().datetime().optional().nullable(),
	status: z.enum(["planned", "active", "completed"]).default("planned"),
});

app.get("/projects/:idOrKey/sprints", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
	const rows = await db
		.select()
		.from(sprints)
		.where(eq(sprints.projectId, project.id))
		.orderBy(desc(sprints.createdAt));
	return c.json({ sprints: rows });
});

app.post("/projects/:idOrKey/sprints", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const body = schema.parse(await c.req.json());
	const db = getDb();
	const [row] = await db
		.insert(sprints)
		.values({
			projectId: project.id,
			name: body.name,
			goal: body.goal,
			status: body.status,
			startsAt: body.startsAt ? new Date(body.startsAt) : null,
			endsAt: body.endsAt ? new Date(body.endsAt) : null,
		})
		.returning();
	return c.json({ sprint: row }, 201);
});

app.patch("/sprints/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(sprints)
		.where(eq(sprints.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "sprint not found" });
	await assertMember(c.get("user"), existing.projectId);
	const body = schema.partial().parse(await c.req.json());
	const [row] = await db
		.update(sprints)
		.set({
			...body,
			startsAt:
				body.startsAt === undefined
					? undefined
					: body.startsAt
						? new Date(body.startsAt)
						: null,
			endsAt:
				body.endsAt === undefined
					? undefined
					: body.endsAt
						? new Date(body.endsAt)
						: null,
		})
		.where(eq(sprints.id, existing.id))
		.returning();
	return c.json({ sprint: row });
});

app.delete("/sprints/:id", async (c) => {
	const db = getDb();
	const [existing] = await db
		.select()
		.from(sprints)
		.where(eq(sprints.id, c.req.param("id")))
		.limit(1);
	if (!existing) throw new HTTPException(404, { message: "sprint not found" });
	await assertMember(c.get("user"), existing.projectId);
	await db.delete(sprints).where(eq(sprints.id, existing.id));
	return c.json({ ok: true });
});

export default app;
