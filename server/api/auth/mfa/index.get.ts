import { eq } from "drizzle-orm";
import { getDb } from "../../../db/client";
import { userMfa } from "../../../db/schema";
import type { User } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const db = getDb();

  const [row] = await db
    .select()
    .from(userMfa)
    .where(eq(userMfa.userId, user.id))
    .limit(1);

  return {
    enabled: !!row?.enabledAt,
    lastUsedAt: row?.lastUsedAt ?? null,
  };
});
