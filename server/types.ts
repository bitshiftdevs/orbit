import type { User } from "@server/db/schema";

export type AppEnv = {
	Variables: {
		user: User;
	};
};
