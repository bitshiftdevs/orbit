import { eq, desc } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, auditLog, users } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const db = getDb();

  const rows = await db
    .select({
      log: auditLog,
      actor: {
        id: users.id,
        name: users.name,
        handle: users.handle,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(eq(auditLog.projectId, project.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return {
    entries: rows.map((r) => ({ ...r.log, actor: r.actor })),
  };
});
