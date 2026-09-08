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
	const response = await transport.handleRequest(c.req.raw);

	if (!response.body) {
		await server.close();
		return response;
	}

	const { readable, writable } = new TransformStream();
	response.body.pipeTo(writable).finally(() => server.close());
	return new Response(readable, response);
});

export default app;
