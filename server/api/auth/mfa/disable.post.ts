import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { User, userMfa } from "../../../db/schema";
import { audit } from "../../../lib/audit";
import { decryptSecret } from "../../../lib/crypto";
import { verifyTotp } from "../../../lib/totp";
import { requireAuth } from "~~/server/middleware/auth";

const codeSchema = z.object({ code: z.string().length(6) });

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const body = await readValidatedBody(event, codeSchema.parse);
  const db = getDb();

  const [row] = await db
    .select()
    .from(userMfa)
    .where(eq(userMfa.userId, user.id))
    .limit(1);

  if (!row?.enabledAt)
    throw createError({ statusCode: 400, statusMessage: "not enabled" });

  const secret = decryptSecret(row.secretCiphertext);
  if (!verifyTotp(secret, body.code)) {
    throw createError({ statusCode: 400, statusMessage: "invalid code" });
  }

  await db.delete(userMfa).where(eq(userMfa.userId, user.id));
  await audit(event, { action: "mfa.disable" });

  return { ok: true };
});
