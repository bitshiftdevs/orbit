import { eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, issueLinks, issues } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const linkId = getRouterParam(event, "linkId") as string;
  const db = getDb();

  const [link] = await db
    .select({ link: issueLinks, projectId: issues.projectId })
    .from(issueLinks)
    .innerJoin(issues, eq(issues.id, issueLinks.sourceId))
    .where(eq(issueLinks.id, linkId))
    .limit(1);

  if (!link)
    throw createError({ statusCode: 404, statusMessage: "link not found" });
  await assertMember(user, link.projectId);

  await db.delete(issueLinks).where(eq(issueLinks.id, linkId));
  return { ok: true };
});
