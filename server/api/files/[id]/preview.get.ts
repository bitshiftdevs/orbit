import { eq } from "drizzle-orm";
import { getHeader } from "h3";
import { getDb } from "~~/server/db/client";
import { User, files } from "~~/server/db/schema";
import { assertMember } from "~~/server/lib/access";
import { requireAuth } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const id = getRouterParam(event, "id") as string;
  const db = getDb();

  const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);

  if (!row)
    throw createError({ statusCode: 404, statusMessage: "file not found" });
  await assertMember(user, row.projectId);

  const etag = `"${row.sha256}"`;
  if (getHeader(event, "if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        "cache-control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  return new Response(row.data, {
    headers: {
      "content-type": row.mimeType,
      "content-length": String(row.sizeBytes),
      "content-disposition": `inline; filename="${encodeURIComponent(row.name)}"`,
      etag,
      "cache-control": "private, max-age=86400, stale-while-revalidate=604800",
    },
  });
});
