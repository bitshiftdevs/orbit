import { and, eq, gt, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { invites, users } from "@server/db/schema";
import {
	createSession,
	currentUser,
	destroySession,
	hashPassword,
	verifyPassword,
} from "@server/lib/auth";
import { requireAuth, requireRole } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const auth = new Hono<AppEnv>();

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

auth.post("/login", async (c) => {
	const body = loginSchema.parse(await c.req.json());
	const db = getDb();
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, body.email.toLowerCase()))
		.limit(1);
	if (!user) throw new HTTPException(401, { message: "invalid credentials" });
	const ok = await verifyPassword(body.password, user.passwordHash);
	if (!ok) throw new HTTPException(401, { message: "invalid credentials" });
	await createSession(c, user.id, c.req.header("user-agent") ?? null);
	await db
		.update(users)
		.set({ lastSeenAt: new Date() })
		.where(eq(users.id, user.id));
	return c.json({ user: publicUser(user) });
});

auth.post("/logout", async (c) => {
	await destroySession(c);
	return c.json({ ok: true });
});

auth.get("/me", async (c) => {
	const user = await currentUser(c);
	if (!user) return c.json({ user: null });
	return c.json({ user: publicUser(user) });
});

const inviteSchema = z.object({
	email: z.string().email(),
	role: z.enum(["admin", "member"]).default("member"),
});

auth.post(
	"/invites",
	requireAuth,
	requireRole("owner", "admin"),
	async (c) => {
		const body = inviteSchema.parse(await c.req.json());
		const db = getDb();
		const actor = c.get("user");
		const token = nanoid(32);
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		const [inv] = await db
			.insert(invites)
			.values({
				email: body.email.toLowerCase(),
				role: body.role,
				invitedBy: actor.id,
				token,
				expiresAt,
			})
			.returning();
		const url = `${process.env.APP_URL ?? "http://localhost:8888"}/accept-invite/${token}`;
		return c.json({ invite: inv, url });
	},
);

auth.get("/invites", requireAuth, requireRole("owner", "admin"), async (c) => {
	const db = getDb();
	const rows = await db
		.select()
		.from(invites)
		.where(and(isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())));
	return c.json({ invites: rows });
});

const acceptSchema = z.object({
	token: z.string().min(1),
	name: z.string().min(1).max(120),
	handle: z
		.string()
		.min(2)
		.max(40)
		.regex(/^[a-z0-9_-]+$/i),
	password: z.string().min(10),
});

auth.post("/accept-invite", async (c) => {
	const body = acceptSchema.parse(await c.req.json());
	const db = getDb();
	const [inv] = await db
		.select()
		.from(invites)
		.where(and(eq(invites.token, body.token), isNull(invites.acceptedAt)))
		.limit(1);
	if (!inv || inv.expiresAt < new Date()) {
		throw new HTTPException(400, { message: "invite is invalid or expired" });
	}
	const passwordHash = await hashPassword(body.password);
	const [user] = await db
		.insert(users)
		.values({
			email: inv.email,
			name: body.name,
			handle: body.handle.toLowerCase(),
			passwordHash,
			role: inv.role,
		})
		.returning();
	await db
		.update(invites)
		.set({ acceptedAt: new Date() })
		.where(eq(invites.id, inv.id));
	await createSession(c, user.id, c.req.header("user-agent") ?? null);
	return c.json({ user: publicUser(user) });
});

function publicUser(u: {
	id: string;
	email: string;
	name: string;
	handle: string;
	avatarUrl: string | null;
	role: string;
	accentColor: string;
	lastSeenAt: Date | null;
	createdAt: Date;
}) {
	return {
		id: u.id,
		email: u.email,
		name: u.name,
		handle: u.handle,
		avatarUrl: u.avatarUrl,
		role: u.role,
		accentColor: u.accentColor,
		lastSeenAt: u.lastSeenAt,
		createdAt: u.createdAt,
	};
}

export default auth;
