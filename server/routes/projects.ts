import { and, desc, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { projectMembers, projects, users } from "@server/db/schema";
import { assertMember, loadProject } from "@server/lib/access";
import { audit } from "@server/lib/audit";
import { requireAuth, requireRole } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const createSchema = z.object({
	key: z
		.string()
		.min(2)
		.max(10)
		.regex(/^[A-Z][A-Z0-9]*$/, "uppercase alphanum, starts with a letter"),
	name: z.string().min(1).max(120),
	description: z.string().max(4000).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	icon: z.string().max(40).optional(),
	repoUrl: z.string().url().optional().or(z.literal("")),
	productionUrl: z.string().url().optional().or(z.literal("")),
	memberIds: z.array(z.string().uuid()).default([]),
});

app.get("/", async (c) => {
	const user = c.get("user");
	const db = getDb();
	const rows =
		user.role === "owner"
			? await db.select().from(projects).orderBy(desc(projects.updatedAt))
			: await db
					.select({ project: projects })
					.from(projects)
					.innerJoin(
						projectMembers,
						and(
							eq(projectMembers.projectId, projects.id),
							eq(projectMembers.userId, user.id),
						),
					)
					.orderBy(desc(projects.updatedAt))
					.then((r) => r.map((x) => x.project));
	return c.json({ projects: rows });
});

app.post("/", requireRole("owner", "admin"), async (c) => {
	const body = createSchema.parse(await c.req.json());
	const db = getDb();
	const actor = c.get("user");
	const [row] = await db
		.insert(projects)
		.values({
			key: body.key,
			name: body.name,
			description: body.description,
			color: body.color ?? "#3b82f6",
			icon: body.icon ?? "rocket",
			repoUrl: body.repoUrl || null,
			productionUrl: body.productionUrl || null,
			leadId: actor.id,
		})
		.returning();

	const memberSet = new Set([actor.id, ...body.memberIds]);
	await db.insert(projectMembers).values(
		[...memberSet].map((userId) => ({
			projectId: row.id,
			userId,
		})),
	);
	await audit(c, {
		action: "project.create",
		projectId: row.id,
		targetName: row.key,
	});
	return c.json({ project: row }, 201);
});

app.get("/:idOrKey", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const db = getDb();
	const members = await db
		.select({
			id: users.id,
			name: users.name,
			handle: users.handle,
			email: users.email,
			avatarUrl: users.avatarUrl,
			accentColor: users.accentColor,
			role: users.role,
			joinedAt: projectMembers.joinedAt,
		})
		.from(projectMembers)
		.innerJoin(users, eq(users.id, projectMembers.userId))
		.where(eq(projectMembers.projectId, project.id));
	return c.json({ project, members });
});

const updateSchema = createSchema.partial().omit({ key: true, memberIds: true });

app.patch("/:idOrKey", async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	await assertMember(c.get("user"), project.id);
	const body = updateSchema.parse(await c.req.json());
	const db = getDb();
	const [row] = await db
		.update(projects)
		.set({ ...body, updatedAt: new Date() })
		.where(eq(projects.id, project.id))
		.returning();
	return c.json({ project: row });
});

app.post("/:idOrKey/members", requireRole("owner", "admin"), async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	const body = z
		.object({ userId: z.string().uuid() })
		.parse(await c.req.json());
	const db = getDb();
	await db
		.insert(projectMembers)
		.values({ projectId: project.id, userId: body.userId })
		.onConflictDoNothing();
	return c.json({ ok: true });
});

app.delete(
	"/:idOrKey/members/:userId",
	requireRole("owner", "admin"),
	async (c) => {
		const project = await loadProject(c.req.param("idOrKey"));
		const userId = c.req.param("userId");
		const db = getDb();
		await db
			.delete(projectMembers)
			.where(
				and(
					eq(projectMembers.projectId, project.id),
					eq(projectMembers.userId, userId),
				),
			);
		return c.json({ ok: true });
	},
);

app.post("/:idOrKey/archive", requireRole("owner", "admin"), async (c) => {
	const project = await loadProject(c.req.param("idOrKey"));
	const db = getDb();
	const [row] = await db
		.update(projects)
		.set({ status: "archived", updatedAt: new Date() })
		.where(eq(projects.id, project.id))
		.returning();
	await audit(c, {
		action: "project.archive",
		projectId: row.id,
		targetName: row.key,
	});
	return c.json({ project: row });
});

export default app;
