import postgres from "npm:postgres";

const SESSION_COOKIE = "orbit_session";
const POLL_MS = 5_000;

export default async function handler(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionToken = parseCookies(cookieHeader)[SESSION_COOKIE];

  if (!sessionToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dbUrl = Deno.env.get("DATABASE_URL");
  if (!dbUrl) return new Response("Server error", { status: 500 });

  const ssl = Deno.env.get("NODE_ENV") !== "production"
    ? ({ rejectUnauthorized: false } as const)
    : true;

  const sql = postgres(dbUrl, { max: 1, ssl });

  try {
    const rows = await sql`
      SELECT u.id
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${sessionToken} AND s.expires_at > NOW()
      LIMIT 1
    `;

    if (!rows.length) {
      await sql.end();
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = rows[0].id as string;
    let since = new Date();

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();

        const enqueue = (text: string) => {
          try { controller.enqueue(enc.encode(text)); } catch {}
        };

        const emit = (data: unknown) =>
          enqueue(`data: ${JSON.stringify(data)}\n\n`);

        enqueue(": connected\n\n");

        while (true) {
          await sleep(POLL_MS);
          const now = new Date();

          try {
            const notifs = await sql`
              SELECT
                n.id, n.kind, n.message,
                n.project_id, n.issue_id, n.actor_id,
                n.read_at, n.created_at,
                u.id    AS u_id,
                u.name  AS u_name,
                u.handle AS u_handle,
                u.avatar_url AS u_avatar,
                u.accent_color AS u_color
              FROM notifications n
              LEFT JOIN users u ON u.id = n.actor_id
              WHERE n.user_id = ${userId} AND n.created_at > ${since}
              ORDER BY n.created_at ASC
            `;

            since = now;

            if (notifs.length > 0) {
              emit({
                type: "notifications",
                items: notifs.map((r) => ({
                  id: r.id,
                  kind: r.kind,
                  message: r.message,
                  projectId: r.project_id,
                  issueId: r.issue_id,
                  actorId: r.actor_id,
                  readAt: r.read_at,
                  createdAt: r.created_at,
                  actor: r.u_id
                    ? {
                        id: r.u_id,
                        name: r.u_name,
                        handle: r.u_handle,
                        avatarUrl: r.u_avatar,
                        accentColor: r.u_color,
                      }
                    : null,
                })),
              });
            } else {
              enqueue(": keepalive\n\n");
            }
          } catch {
            break;
          }
        }

        await sql.end().catch(() => {});
        controller.close();
      },
      cancel() {
        sql.end().catch(() => {});
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      },
    });
  } catch {
    await sql.end().catch(() => {});
    return new Response("Server error", { status: 500 });
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export const config = { path: "/api/sse" };
