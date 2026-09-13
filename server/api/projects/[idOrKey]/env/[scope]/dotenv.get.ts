import {
	and,
	eq,
	asc,
	select,
	from,
} from "drizzle-orm";
import { getDb } from "../../../db/client";
import { envVars } from "../../../db/schema";
import { loadProject } from "../../../lib/access";
import { assertMember } from "../../../lib/access";
import { audit } from "../../../lib/audit";
import { decryptSecret } from "../../../lib/crypto";
import { requireAuth } from "../../../middleware/auth";
import type { User } from "../../../db/schema";
import type { H3Event } from "h3";

const scopes = ["development", "staging", "production"] as const;
type Scope = (typeof scopes)[number];

export default defineEventHandler(async (event) => {
	await requireAuth(event);
	const user = event.context.user as User;
	const idOrKey = getRouterParam(event, "idOrKey") as string;
	const scope = getRouterParam(event, "scope") as Scope;
	const project = await loadProject(idOrKey);
	await assertMember(user, project.id);

	if (!scopes.includes(scope)) {
		throw createError({ statusCode: 400, statusMessage: "invalid scope" });
	}

	const db = getDb();
	const rows = await db
		.select()
		.from(envVars)
		.where(and(eq(envVars.projectId, project.id), eq(envVars.scope, scope)))
		.orderBy(envVars.name);

	const body = rows
		.map((r) => `${r.name}=${JSON.stringify(decryptSecret(r.ciphertext))}`)
		.join("\n");

	await audit(event, {
		action: "envvar.read",
		projectId: project.id,
		targetName: `${scope}:dotenv-export`,
		meta: { count: rows.length },
	});

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"content-disposition": `attachment; filename="${project.key.toLowerCase()}.${scope}.env"`,
		},
	});
});
