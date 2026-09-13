import { inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { users, notifications } from "../db/schema";

const MENTION_RE = /(^|[^\w])@([a-z0-9_-]{2,40})/gi;

export function parseHandles(text: string | null | undefined): string[] {
  if (!text) return [];
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    set.add(m[2].toLowerCase());
  }
  return [...set];
}

export async function notifyMentions(opts: {
  text: string | null | undefined;
  actorId: string;
  projectId: string;
  issueId: string;
  message: string;
  excludeUserIds?: string[];
}) {
  const handles = parseHandles(opts.text);
  if (!handles.length) return 0;
  const db = getDb();
  const found = await db
    .select({ id: users.id, handle: users.handle })
    .from(users)
    .where(inArray(users.handle, handles));
  const exclude = new Set([opts.actorId, ...(opts.excludeUserIds ?? [])]);
  const rows = found.filter((u) => !exclude.has(u.id));
  if (!rows.length) return 0;
  await db.insert(notifications).values(
    rows.map((u) => ({
      userId: u.id,
      kind: "mention" as const,
      message: opts.message,
      projectId: opts.projectId,
      issueId: opts.issueId,
      actorId: opts.actorId,
    })),
  );
  return rows.length;
}

export async function notifyAssigned(opts: {
  assigneeId: string;
  actorId: string;
  projectId: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
}) {
  if (opts.assigneeId === opts.actorId) return;
  await getDb()
    .insert(notifications)
    .values({
      userId: opts.assigneeId,
      kind: "assigned",
      message: `Assigned you ${opts.issueKey} — ${opts.issueTitle}`,
      projectId: opts.projectId,
      issueId: opts.issueId,
      actorId: opts.actorId,
    });
}
