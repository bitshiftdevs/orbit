import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { userMfa } from "@server/db/schema";
import { audit } from "@server/lib/audit";
import { decryptSecret, encryptSecret } from "@server/lib/crypto";
import {
	generateBackupCodes,
	generateBase32Secret,
	otpauthUrl,
	verifyTotp,
} from "@server/lib/totp";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/status", async (c) => {
	const db = getDb();
	const me = c.get("user");
	const [row] = await db
		.select()
		.from(userMfa)
		.where(eq(userMfa.userId, me.id))
		.limit(1);
	return c.json({
		enabled: !!row?.enabledAt,
		lastUsedAt: row?.lastUsedAt ?? null,
	});
});

app.post("/setup", async (c) => {
	const db = getDb();
	const me = c.get("user");
	const secret = generateBase32Secret();
	const backupCodes = generateBackupCodes();
	await db
		.insert(userMfa)
		.values({
			userId: me.id,
			secretCiphertext: encryptSecret(secret),
			backupCodes,
		})
		.onConflictDoUpdate({
			target: userMfa.userId,
			set: {
				secretCiphertext: encryptSecret(secret),
				backupCodes,
				enabledAt: null,
			},
		});
	return c.json({
		secret,
		otpauth: otpauthUrl(secret, me.email),
		backupCodes,
	});
});

app.post("/enable", async (c) => {
	const body = z.object({ code: z.string().length(6) }).parse(await c.req.json());
	const db = getDb();
	const me = c.get("user");
	const [row] = await db
		.select()
		.from(userMfa)
		.where(eq(userMfa.userId, me.id))
		.limit(1);
	if (!row) throw new HTTPException(400, { message: "run setup first" });
	const secret = decryptSecret(row.secretCiphertext);
	if (!verifyTotp(secret, body.code)) {
		throw new HTTPException(400, { message: "invalid code" });
	}
	await db
		.update(userMfa)
		.set({ enabledAt: new Date() })
		.where(eq(userMfa.userId, me.id));
	await audit(c, { action: "mfa.enable" });
	return c.json({ ok: true });
});

app.post("/disable", async (c) => {
	const body = z.object({ code: z.string().length(6) }).parse(await c.req.json());
	const db = getDb();
	const me = c.get("user");
	const [row] = await db
		.select()
		.from(userMfa)
		.where(eq(userMfa.userId, me.id))
		.limit(1);
	if (!row?.enabledAt) throw new HTTPException(400, { message: "not enabled" });
	const secret = decryptSecret(row.secretCiphertext);
	if (!verifyTotp(secret, body.code)) {
		throw new HTTPException(400, { message: "invalid code" });
	}
	await db.delete(userMfa).where(eq(userMfa.userId, me.id));
	await audit(c, { action: "mfa.disable" });
	return c.json({ ok: true });
});

export default app;
