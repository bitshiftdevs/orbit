import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { sprints } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: z.string().max(4000).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  status: z.enum(["planned", "active", "completed"]).optional(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(sprints)
    .where(eq(sprints.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "sprint not found" });
  await assertMember(user, existing.projectId);

  const body = await readValidatedBody(event, schema.partial().parse);

  if (body.status === "active") {
    await db
      .update(sprints)
      .set({ status: "planned" })
      .where(
        and(
          eq(sprints.projectId, existing.projectId),
          eq(sprints.status, "active"),
          ne(sprints.id, existing.id),
        ),
      );
  }

  const [row] = await db
    .update(sprints)
    .set({
      ...body,
      startsAt:
        body.startsAt === undefined
          ? undefined
          : body.startsAt
            ? new Date(body.startsAt)
            : null,
      endsAt:
        body.endsAt === undefined
          ? undefined
          : body.endsAt
            ? new Date(body.endsAt)
            : null,
    })
    .where(eq(sprints.id, existing.id))
    .returning();

  return { sprint: row };
});
