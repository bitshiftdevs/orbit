import { and, asc, desc, gt, isNull } from "drizzle-orm";
import { getDb } from "../../db/client";
import { invites, users } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const db = getDb();

  const include = String(getQuery(event).include ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const wantInvites =
    include.includes("invites") &&
    (user.role === "owner" || user.role === "admin");

  const [team, inviteRows] = await Promise.all([
    db
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
      .orderBy(asc(users.createdAt)),
    wantInvites
      ? db
          .select()
          .from(invites)
          .where(and(isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
          .orderBy(desc(invites.createdAt))
      : Promise.resolve([] as Array<typeof invites.$inferSelect>),
  ]);

  const payload: Record<string, unknown> = { team };
  if (wantInvites) payload.invites = inviteRows;
  return payload;
});
