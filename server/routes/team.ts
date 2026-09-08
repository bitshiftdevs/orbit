import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { users } from "@server/db/schema";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
	const db = getDb();
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			handle: users.handle,
			avatarUrl: users.avatarUrl,
			role: users.role,
			accentColor: users.accentColor,
			lastSeenAt: users.lastSeenAt,
			createdAt: users.createdAt,
		})
		.from(users)
		.orderBy(asc(users.createdAt));
	return c.json({ team: rows });
});

const profileSchema = z.object({
	name: z.string().min(1).max(120).optional(),
	handle: z
		.string()
		.min(2)
		.max(40)
		.regex(/^[a-z0-9_-]+$/i)
		.optional(),
	accentColor: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	avatarUrl: z.string().url().optional().or(z.literal("")),
});

app.patch("/me", async (c) => {
	const body = profileSchema.parse(await c.req.json());
	const db = getDb();
	const actor = c.get("user");
	const [row] = await db
		.update(users)
		.set({
			name: body.name,
			handle: body.handle?.toLowerCase(),
			accentColor: body.accentColor,
			avatarUrl: body.avatarUrl || null,
		})
		.where(eq(users.id, actor.id))
		.returning({
			id: users.id,
			email: users.email,
			name: users.name,
			handle: users.handle,
			avatarUrl: users.avatarUrl,
			role: users.role,
			accentColor: users.accentColor,
			lastSeenAt: users.lastSeenAt,
			createdAt: users.createdAt,
		});
	return c.json({ user: row });
});

export default app;
