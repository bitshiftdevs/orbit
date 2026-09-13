import {
	eq,
	select,
	from,
	update,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";
import type { H3Event } from "h3";

const profileSchema = z.object({
	name: z.string().min(1).max(120).optional(),
	handle: z
		.string()
		.min(2)
		.max(40)
		.regex(/^[a-z0-9_-]+$/i)
		.optional(),
	accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	avatarUrl: z.string().url().optional().or(z.literal("")),
});

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const body = await readValidatedBody(event, profileSchema.parse);
	const db = getDb();

	const [row] = await db
		.update(users)
		.set({
			name: body.name,
			handle: body.handle?.toLowerCase(),
			accentColor: body.accentColor,
			avatarUrl: body.avatarUrl || null,
		})
		.where(eq(users.id, user.id))
		.returning({
			id: users.id,
			email: users.email,
			name: users.name,
			handle: users.handle,
			avatarUrl: users.avatarUrl,
			role: users.role,
			accentColor: users.accentColor,
			lastSeenAt: users.lastSeenAt,
			createdAt: users.createdAt,
		});

	return { user: row };
});
