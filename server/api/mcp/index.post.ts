import { sendWebResponse, toWebRequest } from "h3";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildServer } from "../../mcp/index";
import type { User } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const user = event.context.user as User | undefined;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "unauthenticated" });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = buildServer(user);
  await server.connect(transport);

  const response = await transport.handleRequest(toWebRequest(event));
  return sendWebResponse(event, response);
});
