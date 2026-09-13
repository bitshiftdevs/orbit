import {
	eq,
	insert,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { userMfa } from "../../../db/schema";
import { encryptSecret } from "../../../lib/crypto";
import { generateBackupCodes, generateBase32Secret, otpauthUrl } from "../../../lib/totp";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const db = getDb();

	const secret = generateBase32Secret();
	const backupCodes = generateBackupCodes();

	await db
		.insert(userMfa)
		.values({
			userId: user.id,
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

	return {
		secret,
		otpauth: otpauthUrl(secret, user.email),
		backupCodes,
	};
});
