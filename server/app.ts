import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import auth from "./routes/auth";
import projects from "./routes/projects";
import issues from "./routes/issues";
import sprints from "./routes/sprints";
import secrets from "./routes/secrets";
import files from "./routes/files";
import team from "./routes/team";
import audit from "./routes/audit";
import notifications from "./routes/notifications";
import tokens from "./routes/tokens";
import webhooks from "./routes/webhooks";
import filters from "./routes/filters";
import mfa from "./routes/mfa";
import search from "./routes/search";
import analytics from "./routes/analytics";
import links from "./routes/links";
import templates from "./routes/templates";
import mcp from "./routes/mcp";
import type { AppEnv } from "./types";

export function createApp() {
	const app = new Hono<AppEnv>();

	app.get("/health", (c) =>
		c.json({ ok: true, ts: new Date().toISOString() }),
	);

	// Cache GET responses for 30 s; stale-while-revalidate lets the browser
	// serve the cached copy instantly while fetching a fresh one in the background.
	// Excluded: auth, MCP (stateful protocol), and notifications (user-specific, fetched on demand).
	app.use("*", async (c, next) => {
		await next();
		const method = c.req.method;
		const path = c.req.path;
		const skip =
			path.startsWith("/auth") ||
			path.startsWith("/mcp") ||
			path.startsWith("/notifications");
		if (method === "GET" && !skip) {
			c.header("Cache-Control", "max-age=30, stale-while-revalidate=60");
		} else {
			c.header("Cache-Control", "no-store");
		}
	});

	app.route("/auth", auth);
	app.route("/auth/mfa", mfa);
	app.route("/projects", projects);
	app.route("/", issues);
	app.route("/", sprints);
	app.route("/", secrets);
	app.route("/", files);
	app.route("/team", team);
	app.route("/", audit);
	app.route("/notifications", notifications);
	app.route("/tokens", tokens);
	app.route("/", webhooks);
	app.route("/", filters);
	app.route("/search", search);
	app.route("/", analytics);
	app.route("/", links);
	app.route("/", templates);
	app.route("/mcp", mcp);

	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status);
		}
		if (err instanceof ZodError) {
			return c.json(
				{ error: "validation failed", issues: err.issues },
				400,
			);
		}
		console.error(err);
		return c.json({ error: "internal server error" }, 500);
	});

	app.notFound((c) => c.json({ error: "not found" }, 404));

	return app;
}
