import { desc, eq } from "drizzle-orm";
import { getDb } from "~~/server/db/client";
import { User, files } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);
  const db = getDb();

  const rows = await db
    .select({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      sha256: files.sha256,
      issueId: files.issueId,
      uploadedById: files.uploadedById,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(eq(files.projectId, project.id))
    .orderBy(desc(files.createdAt));

  return { files: rows };
});
