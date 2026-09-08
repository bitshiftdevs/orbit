import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { currentUser } from "@server/lib/auth";
import type { AppEnv } from "@server/types";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
	const user = await currentUser(c);
	if (!user) throw new HTTPException(401, { message: "unauthenticated" });
	c.set("user", user);
	await next();
};

export const requireRole =
	(...roles: Array<"owner" | "admin" | "member">): MiddlewareHandler<AppEnv> =>
	async (c, next) => {
		const user = c.get("user");
		if (!user || !roles.includes(user.role as any)) {
			throw new HTTPException(403, { message: "forbidden" });
		}
		await next();
	};
