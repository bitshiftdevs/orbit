import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { files } from "../../db/schema";
import { assertMember } from "../../lib/access";
import { audit } from "../../lib/audit";
import { requireAuth } from "../../middleware/auth";

const patchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name required")
    .max(255)
    .refine((v) => !/[\\/]/.test(v), "name cannot contain path separators"),
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

  const body = await readValidatedBody(event, patchSchema.parse);

  if (body.name === existing.name) {
    return {
      file: {
        id: existing.id,
        name: existing.name,
        mimeType: existing.mimeType,
        sizeBytes: existing.sizeBytes,
        sha256: existing.sha256,
        issueId: existing.issueId,
        uploadedById: existing.uploadedById,
        createdAt: existing.createdAt,
      },
    };
  }

  const [row] = await db
    .update(files)
    .set({ name: body.name })
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
    meta: { rename: { from: existing.name, to: row.name } },
  });

  return { file: row };
});
