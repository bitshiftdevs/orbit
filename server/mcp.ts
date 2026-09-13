#!/usr/bin/env bun
/**
 * Orbit MCP server — exposes project/issue management as MCP tools.
 *
 * Required env vars:
 *   ORBIT_BASE_URL  — e.g. http://localhost:8888
 *   ORBIT_API_TOKEN — an `orb_...` token created in Settings → API Tokens
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildStdioServer } from "./mcp/stdio/index";

const BASE_URL = (process.env.ORBIT_BASE_URL ?? "http://orbit.local:3000").replace(/\/$/, "");
const TOKEN = process.env.ORBIT_API_TOKEN ?? "";

if (!TOKEN) {
	process.stderr.write("ORBIT_API_TOKEN is not set\n");
	process.exit(1);
}

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${BASE_URL}/api${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${TOKEN}`,
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new Error(`${method} ${path} → ${res.status}: ${text}`);
	}
	return res.json() as Promise<T>;
}

const server = buildStdioServer(api);
const transport = new StdioServerTransport();
await server.connect(transport);
