import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~~/server/db/client";
import { User, files } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { sha256Hex } from "~~/server/lib/crypto";
import { applyTextPatch } from "~~/server/lib/diff";
import { requireAuth } from "~~/server/middleware/auth";

const MAX_BYTES = 500_000;

const patchSchema = z.object({
  baseSha256: z.string().length(64),
  patch: z.string().max(MAX_BYTES),
});

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

  if (body.baseSha256 !== existing.sha256)
    throw createError({
      statusCode: 409,
      statusMessage: "file changed, refresh and retry",
    });

  const current = existing.data.toString("utf-8");
  const result = applyTextPatch(current, body.patch);
  if (!result.ok)
    throw createError({
      statusCode: result.reason === "invalid_patch" ? 400 : 409,
      statusMessage:
        result.reason === "invalid_patch"
          ? "invalid patch"
          : "patch failed to apply",
    });

  const buf = Buffer.from(result.text, "utf-8");
  if (buf.byteLength > MAX_BYTES)
    throw createError({ statusCode: 413, statusMessage: "content too large" });

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
