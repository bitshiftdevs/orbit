import { z } from "zod";
import { getDb } from "../../db/client";
import type { User } from "../../db/schema";
import { apiTokens } from "../../db/schema";
import { assertMember, loadProject } from "../../lib/access";
import { audit } from "../../lib/audit";
import {
  createApiTokenSecret,
  hashToken,
  requireAuth,
} from "../../middleware/auth";

const TOKEN_SCOPES = ["read", "write", "env:read", "secrets:read"] as const;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(TOKEN_SCOPES)).default(["read", "write"]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  projectKey: z.string().min(1).optional(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const user = event.context.user as User;
  const body = await readValidatedBody(event, createSchema.parse);
  const db = getDb();
  const me = user;

  let projectId: string | null = null;
  if (body.projectKey) {
    const project = await loadProject(body.projectKey);
    await assertMember(me, project.id);
    projectId = project.id;
  }

  const secret = createApiTokenSecret();
  const hash = hashToken(secret);
  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: me.id,
      projectId,
      name: body.name,
      tokenHash: hash,
      lastFour: secret.slice(-6),
      scopes: body.scopes,
      expiresAt,
    })
    .returning({
      id: apiTokens.id,
      name: apiTokens.name,
      lastFour: apiTokens.lastFour,
      scopes: apiTokens.scopes,
      projectId: apiTokens.projectId,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    });

  await audit(event, {
    action: "token.create",
    targetId: row.id,
    targetName: row.name,
  });

  return { token: row, secret };
});
