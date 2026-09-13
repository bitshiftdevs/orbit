import { eq } from "drizzle-orm";
import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, issues, issueLinks } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";

const kindEnum = z.enum(["blocks", "duplicates", "relates_to"]);

const createSchema = z.object({
  targetId: z.string().uuid(),
  kind: kindEnum,
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [issue] = await db
    .select({ projectId: issues.projectId })
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);

  if (!issue)
    throw createError({ statusCode: 404, statusMessage: "issue not found" });
  await assertMember(user, issue.projectId);

  const body = await readValidatedBody(event, createSchema.parse);

  if (body.targetId === id) {
    throw createError({
      statusCode: 400,
      statusMessage: "cannot link issue to itself",
    });
  }

  const [target] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, body.targetId))
    .limit(1);

  if (!target)
    throw createError({
      statusCode: 404,
      statusMessage: "target issue not found",
    });

  const [row] = await db
    .insert(issueLinks)
    .values({
      sourceId: id,
      targetId: body.targetId,
      kind: body.kind,
      createdById: user.id,
    })
    .onConflictDoNothing()
    .returning();

  return { link: row };
});
