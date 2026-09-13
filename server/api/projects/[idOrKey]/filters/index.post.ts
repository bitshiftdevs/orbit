import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, savedFilters } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";

const querySchema = z.object({
  status: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  assigneeId: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  sprintId: z.string().nullable().optional(),
  text: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  query: querySchema,
  global: z.boolean().default(false),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const body = await readValidatedBody(event, createSchema.parse);
  const db = getDb();
  const me = user;

  const [row] = await db
    .insert(savedFilters)
    .values({
      userId: me.id,
      projectId: body.global ? null : project.id,
      name: body.name,
      query: body.query as Record<string, unknown>,
    })
    .returning();

  return { filter: row };
});
