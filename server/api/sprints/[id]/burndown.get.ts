import {
	and,
	eq,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { issues, sprints } from "../../../db/schema";
import { assertMember } from "../../../lib/access";
import { loadProject } from "../../../lib/access";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const sprintId = getRouterParam(event, "id") as string;
	const db = getDb();

	const [s] = await db
		.select()
		.from(sprints)
		.where(eq(sprints.id, sprintId))
		.limit(1);

	if (!s) throw createError({ statusCode: 404, statusMessage: "sprint not found" });
	await assertMember(user, s.projectId);

	const start = s.startsAt ?? s.createdAt;
	const end = s.endsAt ?? new Date();
	const items = await db
		.select({
			id: issues.id,
			storyPoints: issues.storyPoints,
			completedAt: issues.completedAt,
			status: issues.status,
			createdAt: issues.createdAt,
		})
		.from(issues)
		.where(eq(issues.sprintId, s.id));

	const total = items.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
	const days: Array<{ date: string; remaining: number; ideal: number }> = [];
	const startMs = new Date(start).setHours(0, 0, 0, 0);
	const endMs = new Date(end).setHours(23, 59, 59, 999);
	const spanDays = Math.max(
		1,
		Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)),
	);

	for (let i = 0; i <= spanDays; i++) {
		const day = new Date(startMs + i * 24 * 60 * 60 * 1000);
		const dayEnd = day.getTime() + 24 * 60 * 60 * 1000 - 1;
		const done = items
			.filter(
				(x) => x.completedAt && new Date(x.completedAt).getTime() <= dayEnd,
			)
			.reduce((sum, x) => sum + (x.storyPoints ?? 0), 0);
		days.push({
			date: day.toISOString().slice(0, 10),
			remaining: total - done,
			ideal: Math.max(0, total - (total / spanDays) * i),
		});
	}

	return {
		sprint: s,
		total,
		days,
		completed: total - (days[days.length - 1]?.remaining ?? 0),
	};
});
