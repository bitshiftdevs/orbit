import { currentUser } from "../../middleware/auth";

export default defineEventHandler(async (event) => {
	const user = await currentUser(event);
	return { user: user ?? null };
});
