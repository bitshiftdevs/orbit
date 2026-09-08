import { and, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getDb } from "@server/db/client";
import { issueLinks, issues, projects } from "@server/db/schema";
import { assertMember } from "@server/lib/access";
import { requireAuth } from "@server/middleware/auth";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const kindEnum = z.enum(["blocks", "duplicates", "relates_to"]);

// GET /issues/:id/links — list all links for an issue
app.get("/issues/:id/links", async (c) => {
	const db = getDb();
	const issueId = c.req.param("id");

	const [issue] = await db
		.select({ projectId: issues.projectId })
		.from(issues)
		.where(eq(issues.id, issueId))
		.limit(1);
	if (!issue) throw new HTTPException(404, { message: "issue not found" });
	await assertMember(c.get("user"), issue.projectId);

	const rows = await db
		.select({
			link: issueLinks,
			linked: issues,
			project: { key: projects.key },
		})
		.from(issueLinks)
		.innerJoin(
			issues,
			or(
				and(eq(issueLinks.sourceId, issueId), eq(issues.id, issueLinks.targetId)),
				and(eq(issueLinks.targetId, issueId), eq(issues.id, issueLinks.sourceId)),
			),
		)
		.innerJoin(projects, eq(projects.id, issues.projectId))
		.where(or(eq(issueLinks.sourceId, issueId), eq(issueLinks.targetId, issueId)));

	return c.json({
		links: rows.map(({ link, linked, project }) => {
			const outbound = link.sourceId === issueId;
			return {
				id: link.id,
				kind: outbound ? link.kind : invertKind(link.kind),
				sourceId: link.sourceId,
				targetId: link.targetId,
				createdAt: link.createdAt,
				linked: {
					id: linked.id,
					key: `${project.key}-${linked.number}`,
					title: linked.title,
					status: linked.status,
					type: linked.type,
					priority: linked.priority,
				},
			};
		}),
	});
});

// POST /issues/:id/links — create a link
app.post("/issues/:id/links", async (c) => {
	const db = getDb();
	const issueId = c.req.param("id");

	const [issue] = await db
		.select({ projectId: issues.projectId })
		.from(issues)
		.where(eq(issues.id, issueId))
		.limit(1);
	if (!issue) throw new HTTPException(404, { message: "issue not found" });
	await assertMember(c.get("user"), issue.projectId);

	const body = z
		.object({ targetId: z.string().uuid(), kind: kindEnum })
		.parse(await c.req.json());

	if (body.targetId === issueId) {
		throw new HTTPException(400, { message: "cannot link issue to itself" });
	}

	const [target] = await db
		.select({ id: issues.id })
		.from(issues)
		.where(eq(issues.id, body.targetId))
		.limit(1);
	if (!target) throw new HTTPException(404, { message: "target issue not found" });

	const [row] = await db
		.insert(issueLinks)
		.values({
			sourceId: issueId,
			targetId: body.targetId,
			kind: body.kind,
			createdById: c.get("user").id,
		})
		.onConflictDoNothing()
		.returning();

	return c.json({ link: row }, 201);
});

// DELETE /issues/links/:linkId
app.delete("/issues/links/:linkId", async (c) => {
	const db = getDb();
	const [link] = await db
		.select({ link: issueLinks, projectId: issues.projectId })
		.from(issueLinks)
		.innerJoin(issues, eq(issues.id, issueLinks.sourceId))
		.where(eq(issueLinks.id, c.req.param("linkId")))
		.limit(1);

	if (!link) throw new HTTPException(404, { message: "link not found" });
	await assertMember(c.get("user"), link.projectId);
	await db.delete(issueLinks).where(eq(issueLinks.id, c.req.param("linkId")));
	return c.json({ ok: true });
});

function invertKind(kind: string) {
	if (kind === "blocks") return "blocked_by";
	return kind;
}

export default app;
