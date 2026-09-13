import { eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, files } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);

  if (!row)
    throw createError({ statusCode: 404, statusMessage: "file not found" });
  await assertMember(user, row.projectId);

  await audit(event, {
    action: "file.download",
    projectId: row.projectId,
    targetId: row.id,
    targetName: row.name,
  });

  return new Response(row.data, {
    headers: {
      "content-type": row.mimeType,
      "content-length": String(row.sizeBytes),
      "content-disposition": `attachment; filename="${encodeURIComponent(row.name)}"`,
    },
  });
});
