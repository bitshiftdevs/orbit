import { currentUser, requireAuth } from "../../middleware/auth";
import type { User } from "../../db/schema";

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	return { user };
});
