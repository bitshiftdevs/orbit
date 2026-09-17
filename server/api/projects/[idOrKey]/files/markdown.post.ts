import { z } from "zod";
import { getDb } from "~~/server/db/client";
import { User, files } from "~~/server/db/schema";
import { loadProject, assertMember } from "~~/server/lib/access";
import { audit } from "~~/server/lib/audit";
import { sha256Hex } from "~~/server/lib/crypto";
import { requireAuth } from "~~/server/middleware/auth";

const bodySchema = z.object({
  name: z.string().min(1).max(255).regex(/\.md(?:own)?$/i, "name must end in .md or .markdown"),
  content: z.string().max(500_000).default(""),
  issueId: z.string().uuid().nullish(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const idOrKey = getRouterParam(event, "idOrKey") as string;
  const project = await loadProject(idOrKey);
  await assertMember(user, project.id);

  const body = await readValidatedBody(event, bodySchema.parse);
  const buf = Buffer.from(body.content, "utf-8");
  const db = getDb();

  const [row] = await db
    .insert(files)
    .values({
      projectId: project.id,
      issueId: body.issueId ?? null,
      name: body.name,
      mimeType: "text/markdown",
      sizeBytes: buf.byteLength,
      sha256: sha256Hex(buf),
      data: buf,
      uploadedById: user.id,
    })
    .returning({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      sha256: files.sha256,
      issueId: files.issueId,
      createdAt: files.createdAt,
    });

  await audit(event, {
    action: "file.upload",
    projectId: project.id,
    targetId: row.id,
    targetName: row.name,
    meta: { size: row.sizeBytes, mime: row.mimeType },
  });

  return { file: row };
});
