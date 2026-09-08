import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { apiTokens } from "@server/db/schema";
import { audit } from "@server/lib/audit";
import { API_TOKEN_PREFIX } from "@server/lib/auth";
import { sha256Hex } from "@server/lib/crypto";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";
import { randomBytes } from "node:crypto";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
	const db = getDb();
	const me = c.get("user");
	const rows = await db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			lastFour: apiTokens.lastFour,
			scopes: apiTokens.scopes,
			lastUsedAt: apiTokens.lastUsedAt,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
			createdAt: apiTokens.createdAt,
		})
		.from(apiTokens)
		.where(eq(apiTokens.userId, me.id))
		.orderBy(desc(apiTokens.createdAt));
	return c.json({ tokens: rows });
});

const createSchema = z.object({
	name: z.string().min(1).max(120),
	scopes: z.array(z.enum(["read", "write"])).default(["read", "write"]),
	expiresInDays: z.number().int().min(1).max(365).optional(),
});

app.post("/", async (c) => {
	const body = createSchema.parse(await c.req.json());
	const db = getDb();
	const me = c.get("user");
	// 32 random bytes → 43-char base64url → prefixed.
	const secret =
		API_TOKEN_PREFIX +
		randomBytes(32)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	const hash = sha256Hex(secret);
	const expiresAt = body.expiresInDays
		? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
		: null;
	const [row] = await db
		.insert(apiTokens)
		.values({
			userId: me.id,
			name: body.name,
			tokenHash: hash,
			lastFour: secret.slice(-6),
			scopes: body.scopes,
			expiresAt,
		})
		.returning({
			id: apiTokens.id,
			name: apiTokens.name,
			lastFour: apiTokens.lastFour,
			scopes: apiTokens.scopes,
			expiresAt: apiTokens.expiresAt,
			createdAt: apiTokens.createdAt,
		});
	await audit(c, {
		action: "token.create",
		targetId: row.id,
		targetName: row.name,
	});
	return c.json({ token: row, secret }, 201);
});

app.delete("/:id", async (c) => {
	const db = getDb();
	const me = c.get("user");
	const [row] = await db
		.select()
		.from(apiTokens)
		.where(and(eq(apiTokens.id, c.req.param("id")), eq(apiTokens.userId, me.id)))
		.limit(1);
	if (!row) throw new HTTPException(404, { message: "token not found" });
	await db
		.update(apiTokens)
		.set({ revokedAt: new Date() })
		.where(eq(apiTokens.id, row.id));
	await audit(c, {
		action: "token.revoke",
		targetId: row.id,
		targetName: row.name,
	});
	return c.json({ ok: true });
});

export default app;
