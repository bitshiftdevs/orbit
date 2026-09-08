import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "@server/db/client";
import { users } from "@server/db/schema";
import type { User } from "@server/db/schema";

export function register(server: McpServer, db: DB, _user: User): void {
	server.tool("list_team", "List all workspace members", {}, async () => {
		const rows = await db
			.select({
				id: users.id,
				name: users.name,
				handle: users.handle,
				email: users.email,
				avatarUrl: users.avatarUrl,
				role: users.role,
				accentColor: users.accentColor,
			})
			.from(users);
		return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
	});
}
