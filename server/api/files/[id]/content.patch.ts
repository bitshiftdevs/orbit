import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~~/server/db/client";
import { User, files } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { sha256Hex } from "~~/server/lib/crypto";
const patchSchema = z.object({ content: z.string().max(500_000) });

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(files)
    .where(eq(files.id, id))
    .limit(1);

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "file not found" });
  await assertMember(user, existing.projectId);

  const isEditable =
    existing.mimeType.startsWith("text/") ||
    existing.mimeType === "application/json" ||
    existing.name.endsWith(".md") ||
    existing.name.endsWith(".markdown");

  if (!isEditable)
    throw createError({
      statusCode: 400,
      statusMessage: "file is not editable",
    });

  const body = await readValidatedBody(event, patchSchema.parse);
  const buf = Buffer.from(body.content, "utf-8");

  const [row] = await db
    .update(files)
    .set({ data: buf, sizeBytes: buf.byteLength, sha256: sha256Hex(buf) })
    .where(eq(files.id, existing.id))
    .returning({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      sha256: files.sha256,
      issueId: files.issueId,
      uploadedById: files.uploadedById,
      createdAt: files.createdAt,
    });

  await audit(event, {
    action: "file.edit",
    projectId: existing.projectId,
    targetId: row.id,
    targetName: row.name,
  });

  return { file: row };
});
