import {
	and,
	desc,
	eq,
	isNull,
	or,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { savedFilters } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);
	const db = getDb();
	const me = user;

	const rows = await db
		.select()
		.from(savedFilters)
		.where(
			and(
				eq(savedFilters.userId, me.id),
				or(
					eq(savedFilters.projectId, project.id),
					isNull(savedFilters.projectId),
				),
			),
		)
		.orderBy(desc(savedFilters.createdAt));

	return { filters: rows };
});
