import z from "zod";
import { getDb } from "~~/server/db/client";
import { User, sprints } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";

const schema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().max(4000).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  status: z.enum(["planned", "active", "completed"]).default("planned"),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const body = await readValidatedBody(event, schema.parse);
  const db = getDb();

  const [row] = await db
    .insert(sprints)
    .values({
      projectId: project.id,
      name: body.name,
      goal: body.goal,
      status: body.status,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    })
    .returning();

  return { sprint: row };
});
