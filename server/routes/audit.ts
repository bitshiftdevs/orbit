import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "@server/db/client";
import { auditLog, users } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/projects/:idOrKey/audit", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
	const rows = await db
		.select({
			log: auditLog,
			actor: {
				id: users.id,
				name: users.name,
				handle: users.handle,
				avatarUrl: users.avatarUrl,
			},
		})
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(eq(auditLog.projectId, project.id))
		.orderBy(desc(auditLog.createdAt))
		.limit(200);
	return c.json({
		entries: rows.map((r) => ({ ...r.log, actor: r.actor })),
	});
});

export default app;
