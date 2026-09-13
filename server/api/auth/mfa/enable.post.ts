import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db/client";
import { User, userMfa } from "../../../db/schema";
import { audit } from "../../../lib/audit";
import { decryptSecret } from "../../../lib/crypto";
import { verifyTotp } from "../../../lib/totp";

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

  if (!row)
    throw createError({ statusCode: 400, statusMessage: "run setup first" });

  const secret = decryptSecret(row.secretCiphertext);
  if (!verifyTotp(secret, body.code)) {
    throw createError({ statusCode: 400, statusMessage: "invalid code" });
  }

  await db
    .update(userMfa)
    .set({ enabledAt: new Date() })
    .where(eq(userMfa.userId, user.id));

  await audit(event, { action: "mfa.enable" });

  return { ok: true };
});
