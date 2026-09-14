import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { issueTemplates } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { requireAuth } from "../../middleware/auth";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(["task", "bug", "story", "epic", "chore"]).optional(),
  priority: z.enum(["trivial", "low", "medium", "high", "urgent"]).optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  body: z.string().max(20000).optional().nullable(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(issueTemplates)
    .where(eq(issueTemplates.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "template not found" });
  await assertMember(user, existing.projectId);

  const body = await readValidatedBody(event, schema.partial().parse);
  const [row] = await db
    .update(issueTemplates)
    .set(body)
    .where(eq(issueTemplates.id, existing.id))
    .returning();

  return { template: row };
});
