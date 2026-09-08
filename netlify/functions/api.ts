import type { Context } from "@netlify/functions";
import { createApp } from "../../server/app";

const app = createApp();

export default async (req: Request, _context: Context) => {
	return app.fetch(req);
};

export const config = {
	path: "/api/*",
};
