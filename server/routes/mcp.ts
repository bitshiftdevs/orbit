import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { requireAuth } from "@server/middleware/auth";
import { buildServer } from "@server/mcp/index";
import type { AppEnv } from "@server/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.all("/", async (c) => {
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});
	const server = buildServer(c.get("user"));
	await server.connect(transport);

	// Strip SSE from Accept to force a single JSON response per call — no long-lived streams
	const headers = new Headers(c.req.raw.headers);
	headers.set("accept", "application/json, */*;q=0.1");
	const req = new Request(c.req.raw, { headers });

	const response = await transport.handleRequest(req);
	await server.close();
	return response;
});

export default app;
