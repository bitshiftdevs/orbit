import {
	and,
	asc,
	count,
	desc,
	isNotNull,
	eq,
	ilike,
	or,
	sql,
	innerJoin,
	leftJoin,
} from "drizzle-orm";
import { z } from "zod";
import type { H3Event } from "h3";
import { getDb } from "../../db/client";
import {
	projects,
	projectMembers,
	users,
	issues,
	issueComments,
	sprints,
	secrets,
	envVars,
	files,
	issueLinks,
	issueTemplates,
	apiTokens,
	invites,
	notifications,
} from "../../db/schema";
import { loadProject } from "../../lib/access";
import { assertMember } from "../../lib/access";
import type { User } from "../../db/schema";
import { encryptSecret, decryptSecret, lastFour, sha256Hex } from "../../lib/crypto";
import {
	generateBackupCodes,
	generateBase32Secret,
	otpauthUrl,
	verifyTotp,
} from "../../lib/totp";
import {
	initialRank,
	midpoint,
} from "../../lib/rank";
import { audit } from "../../lib/audit";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getToolUser(event: H3Event): Promise<User> {
	const user = event.context.user as User | undefined;
	if (!user) throw createError({ statusCode: 401, statusMessage: "unauthenticated" });
	return user;
}

async function toolLoadProject(idOrKey: string) {
	return loadProject(idOrKey);
}

async function toolAssertMember(user: User, projectId: string) {
	return assertMember(user, projectId);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(
	_args: Record<string, any>,
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const rows =
		user.role === "owner"
			? await db.select().from(projects).orderBy(desc(projects.updatedAt))
			: await db
					.select({ project: projects })
					.from(projects)
					.innerJoin(
						projectMembers,
						and(
							eq(projectMembers.projectId, projects.id),
							eq(projectMembers.userId, user.id),
						),
					)
					.orderBy(desc(projects.updatedAt))
					.then((r) => r.map((x) => x.project));

	return JSON.stringify(rows, null, 2);
}

export async function getProject(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const members = await db
		.select({
			id: users.id,
			name: users.name,
			handle: users.handle,
			email: users.email,
			avatarUrl: users.avatarUrl,
			accentColor: users.accentColor,
			role: users.role,
			joinedAt: projectMembers.joinedAt,
		})
		.from(projectMembers)
		.innerJoin(users, eq(users.id, projectMembers.userId))
		.where(eq(projectMembers.projectId, project.id));

	return JSON.stringify({ project, members }, null, 2);
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

const assigneeShape = {
	id: users.id,
	name: users.name,
	handle: users.handle,
	avatarUrl: users.avatarUrl,
	accentColor: users.accentColor,
};

export async function listIssues(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({ issue: issues, assignee: assigneeShape })
		.from(issues)
		.leftJoin(users, eq(users.id, issues.assigneeId))
		.where(eq(issues.projectId, project.id))
		.orderBy(asc(issues.rank));

	const shaped = rows.map((r) => ({
		...r.issue,
		key: `${project.key}-${r.issue.number}`,
		assignee: r.assignee?.id ? r.assignee : null,
	}));

	return JSON.stringify(shaped, null, 2);
}

export async function getIssue(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [row] = await db
		.select({ issue: issues, project: projects, assignee: assigneeShape })
		.from(issues)
		.innerJoin(projects, eq(projects.id, issues.projectId))
		.leftJoin(users, eq(users.id, issues.assigneeId))
		.where(eq(issues.id, args.id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await toolAssertMember(user, row.project.id);

	return JSON.stringify(row, null, 2);
}

export async function createIssue(
	args: {
		idOrKey: string;
		title: string;
		description?: string;
		type?: "task" | "bug" | "story" | "epic" | "chore";
		status?: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
		priority?: "trivial" | "low" | "medium" | "high" | "urgent";
		assigneeId?: string;
		sprintId?: string;
		labels?: string[];
		storyPoints?: number;
		prUrl?: string;
		dueAt?: string;
	},
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();
	const actor = user;

	const inserted = await db.transaction(async (tx) => {
		const [projRow] = await tx
			.update(projects)
			.set({
				issueCounter: sql`${projects.issueCounter} + 1`,
				updatedAt: new Date(),
			})
			.where(eq(projects.id, project.id))
			.returning({ counter: projects.issueCounter });

		const [last] = await tx
			.select({ rank: issues.rank })
			.from(issues)
			.where(
				and(
					eq(issues.projectId, project.id),
					eq(issues.status, args.status ?? "backlog"),
				),
			)
			.orderBy(desc(issues.rank))
			.limit(1);
		const rank = last ? midpoint(last.rank, null) : initialRank();

		const [row] = await tx
			.insert(issues)
			.values({
				projectId: project.id,
				number: projRow.counter,
				title: args.title,
				description: args.description,
				type: args.type ?? "task",
				status: args.status ?? "backlog",
				priority: args.priority ?? "medium",
				storyPoints: args.storyPoints,
				assigneeId: args.assigneeId ?? null,
				reporterId: actor.id,
				sprintId: args.sprintId ?? null,
				labels: args.labels ?? [],
				prUrl: args.prUrl ?? null,
				dueAt: args.dueAt ? new Date(args.dueAt) : null,
				rank,
			})
			.returning();
		return { ...row, key: `${project.key}-${projRow.counter}` };
	});

	return JSON.stringify(inserted, null, 2);
}

export async function updateIssue(
	args: {
		id: string;
		title?: string;
		description?: string;
		type?: "task" | "bug" | "story" | "epic" | "chore";
		status?: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
		priority?: "trivial" | "low" | "medium" | "high" | "urgent";
		assigneeId?: string;
		sprintId?: string;
		labels?: string[];
		storyPoints?: number;
		prUrl?: string;
		dueAt?: string;
	},
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [existing] = await db
		.select()
		.from(issues)
		.where(eq(issues.id, args.id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await toolAssertMember(user, existing.projectId);

	const patch: Record<string, any> = { updatedAt: new Date() };
	for (const [k, v] of Object.entries(args)) {
		if (v !== undefined) {
			patch[k] = k === "dueAt" && v ? new Date(v as string) : v;
		}
	}

	const [updated] = await db
		.update(issues)
		.set(patch)
		.where(eq(issues.id, args.id))
		.returning();

	return JSON.stringify(updated, null, 2);
}

export async function deleteIssue(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [existing] = await db
		.select()
		.from(issues)
		.where(eq(issues.id, args.id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await toolAssertMember(user, existing.projectId);

	await db.delete(issues).where(eq(issues.id, args.id));
	return "Deleted.";
}

export async function addComment(
	args: { id: string; body: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [existing] = await db
		.select()
		.from(issues)
		.where(eq(issues.id, args.id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await toolAssertMember(user, existing.projectId);

	const [comment] = await db
		.insert(issueComments)
		.values({ issueId: args.id, authorId: user.id, body: args.body })
		.returning();

	return JSON.stringify(comment, null, 2);
}

// ---------------------------------------------------------------------------
// Issue links
// ---------------------------------------------------------------------------

export async function getIssueLinks(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [issue] = await db
		.select({ projectId: issues.projectId })
		.from(issues)
		.where(eq(issues.id, args.id))
		.limit(1);

	if (!issue) throw createError({ statusCode: 404, statusMessage: "issue not found" });
	await toolAssertMember(user, issue.projectId);

	const rows = await db
		.select({
			link: issueLinks,
			linked: issues,
			project: { key: projects.key },
		})
		.from(issueLinks)
		.innerJoin(
			issues,
			or(
				and(eq(issueLinks.sourceId, args.id), eq(issues.id, issueLinks.targetId)),
				and(eq(issueLinks.targetId, args.id), eq(issues.id, issueLinks.sourceId)),
			),
		)
		.innerJoin(projects, eq(projects.id, issues.projectId))
		.where(or(eq(issueLinks.sourceId, args.id), eq(issueLinks.targetId, args.id)));

	return JSON.stringify(rows, null, 2);
}

export async function addIssueLink(
	args: { sourceId: string; targetId: string; kind?: "blocks" | "duplicates" | "relates_to" },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [src] = await db
		.select({ projectId: issues.projectId })
		.from(issues)
		.where(eq(issues.id, args.sourceId))
		.limit(1);

	if (!src) throw createError({ statusCode: 404, statusMessage: "source issue not found" });
	await toolAssertMember(user, src.projectId);

	const [row] = await db
		.insert(issueLinks)
		.values({
			sourceId: args.sourceId,
			targetId: args.targetId,
			kind: args.kind ?? "relates_to",
			createdById: user.id,
		})
		.onConflictDoNothing()
		.returning();

	return JSON.stringify(row, null, 2);
}

export async function removeIssueLink(
	args: { linkId: string },
	event: H3Event,
) {
	const db = getDb();
	await db.delete(issueLinks).where(eq(issueLinks.id, args.linkId));
	return "Link removed.";
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

export async function listSprints(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select()
		.from(sprints)
		.where(eq(sprints.projectId, project.id))
		.orderBy(desc(sprints.createdAt));

	return JSON.stringify(rows, null, 2);
}

export async function createSprint(
	args: {
		idOrKey: string;
		name: string;
		goal?: string;
		status?: "planned" | "active" | "completed";
		startsAt?: string;
		endsAt?: string;
	},
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const [row] = await db
		.insert(sprints)
		.values({
			projectId: project.id,
			name: args.name,
			goal: args.goal,
			status: args.status ?? "planned",
			startsAt: args.startsAt ? new Date(args.startsAt) : null,
			endsAt: args.endsAt ? new Date(args.endsAt) : null,
		})
		.returning();

	return JSON.stringify(row, null, 2);
}

export async function updateSprint(
	args: {
		id: string;
		name?: string;
		goal?: string;
		status?: "planned" | "active" | "completed";
		startsAt?: string;
		endsAt?: string;
	},
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const patch: Record<string, any> = { updatedAt: new Date() };
	for (const [k, v] of Object.entries(args)) {
		if (v !== undefined) {
			patch[k] = (k === "startsAt" || k === "endsAt") && v ? new Date(v as string) : v;
		}
	}

	const [row] = await db
		.update(sprints)
		.set(patch)
		.where(eq(sprints.id, args.id))
		.returning();

	if (!row) throw createError({ statusCode: 404, statusMessage: "sprint not found" });
	return JSON.stringify(row, null, 2);
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function listTeam(
	_args: Record<string, any>,
	event: H3Event,
) {
	const db = getDb();

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

	return JSON.stringify(rows, null, 2);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function search(
	args: { q: string },
	event: H3Event,
) {
	if (!args.q.trim()) return JSON.stringify({}) ;

	const user = await getToolUser(event);
	const db = getDb();
	const wildcard = `%${args.q}%`;
	const issueKeyMatch = /^([A-Za-z]+)[-\s]?(\d+)$/.exec(args.q);

	const [projectRows, issueRows, memberRows] = await Promise.all([
		db
			.select({ id: projects.id, key: projects.key, name: projects.name })
			.from(projects)
			.where(or(ilike(projects.key, wildcard), ilike(projects.name, wildcard)))
			.limit(6),

		issueKeyMatch
			? db
					.select({
						id: issues.id,
						title: issues.title,
						number: issues.number,
						status: issues.status,
						projectKey: projects.key,
					})
					.from(issues)
					.innerJoin(projects, eq(projects.id, issues.projectId))
					.where(
						and(
							eq(projects.key, issueKeyMatch[1].toUpperCase()),
							eq(issues.number, Number(issueKeyMatch[2])),
						),
					)
					.limit(6)
			: db
					.select({
						id: issues.id,
						title: issues.title,
						number: issues.number,
						status: issues.status,
						projectKey: projects.key,
					})
					.from(issues)
					.innerJoin(projects, eq(projects.id, issues.projectId))
					.where(ilike(issues.title, wildcard))
					.limit(8),

		db
			.select({ id: users.id, name: users.name, handle: users.handle })
			.from(users)
			.where(or(ilike(users.name, wildcard), ilike(users.handle, wildcard)))
			.limit(6),
	]);

	return JSON.stringify({ projects: projectRows, issues: issueRows, members: memberRows }, null, 2);
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function getVelocity(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			sprintId: sprints.id,
			sprintName: sprints.name,
			status: sprints.status,
			committed: sql<number>`coalesce(sum(${issues.storyPoints}), 0)`.mapWith(
				Number,
			),
			completed: sql<number>`coalesce(sum(${issues.storyPoints}) filter (where ${issues.status} = 'done'), 0)`.mapWith(
				Number,
			),
			issueCount: count(issues.id),
		})
		.from(sprints)
		.leftJoin(issues, eq(issues.sprintId, sprints.id))
		.where(eq(sprints.projectId, project.id))
		.groupBy(sprints.id)
		.orderBy(sprints.createdAt);

	return JSON.stringify(rows, null, 2);
}

export async function getCycleTime(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			type: issues.type,
			avgDays: sql<number>`round(avg(extract(epoch from ${issues.completedAt} - ${issues.createdAt}) / 86400), 1)`.mapWith(
				Number,
			),
			count: count(issues.id),
		})
		.from(issues)
		.where(
			and(
				eq(issues.projectId, project.id),
				isNotNull(issues.completedAt),
			),
		)
		.groupBy(issues.type)
		.orderBy(issues.type);

	return JSON.stringify(rows, null, 2);
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export async function listSecrets(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		})
		.from(secrets)
		.where(eq(secrets.projectId, project.id))
		.orderBy(desc(secrets.updatedAt));

	return JSON.stringify(rows, null, 2);
}

export async function revealSecret(
	args: { id: string; reason?: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [row] = await db
		.select()
		.from(secrets)
		.where(eq(secrets.id, args.id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "secret not found" });
	await toolAssertMember(user, row.projectId);

	const value = decryptSecret(row.ciphertext);

	return JSON.stringify({ name: row.name, value }, null, 2);
}

export async function createSecret(
	args: { idOrKey: string; name: string; value: string; description?: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();
	const ciphertext = encryptSecret(args.value);

	const [row] = await db
		.insert(secrets)
		.values({
			projectId: project.id,
			name: args.name,
			description: args.description,
			ciphertext,
			lastFour: lastFour(args.value),
			createdById: user.id,
		})
		.returning({
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		});

	return JSON.stringify(row, null, 2);
}

export async function updateSecret(
	args: { id: string; value?: string; description?: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [existing] = await db
		.select()
		.from(secrets)
		.where(eq(secrets.id, args.id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "secret not found" });
	await toolAssertMember(user, existing.projectId);

	const patch: Record<string, any> = { updatedAt: new Date() };
	if (args.description !== undefined) patch.description = args.description;
	if (args.value !== undefined) {
		patch.ciphertext = encryptSecret(args.value);
		patch.lastFour = lastFour(args.value);
	}

	const [row] = await db
		.update(secrets)
		.set(patch)
		.where(eq(secrets.id, args.id))
		.returning({
			id: secrets.id,
			name: secrets.name,
			description: secrets.description,
			lastFour: secrets.lastFour,
			createdAt: secrets.createdAt,
			updatedAt: secrets.updatedAt,
		});

	return JSON.stringify(row, null, 2);
}

export async function deleteSecret(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [existing] = await db
		.select()
		.from(secrets)
		.where(eq(secrets.id, args.id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "secret not found" });
	await toolAssertMember(user, existing.projectId);

	await db.delete(secrets).where(eq(secrets.id, args.id));
	return "Deleted.";
}

// ---------------------------------------------------------------------------
// Env vars
// ---------------------------------------------------------------------------

export async function listEnvVars(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			id: envVars.id,
			scope: envVars.scope,
			name: envVars.name,
			lastFour: envVars.lastFour,
			createdAt: envVars.createdAt,
			updatedAt: envVars.updatedAt,
		})
		.from(envVars)
		.where(eq(envVars.projectId, project.id))
		.orderBy(envVars.scope, envVars.name);

	return JSON.stringify(rows, null, 2);
}

export async function revealEnvVar(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [row] = await db
		.select()
		.from(envVars)
		.where(eq(envVars.id, args.id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "env var not found" });
	await toolAssertMember(user, row.projectId);

	const value = decryptSecret(row.ciphertext);

	return JSON.stringify({ name: row.name, scope: row.scope, value }, null, 2);
}

export async function setEnvVar(
	args: { idOrKey: string; scope: "development" | "staging" | "production"; name: string; value: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();
	const ciphertext = encryptSecret(args.value);

	const [row] = await db
		.insert(envVars)
		.values({
			projectId: project.id,
			scope: args.scope,
			name: args.name,
			ciphertext,
			lastFour: lastFour(args.value),
			createdById: user.id,
		})
		.onConflictDoUpdate({
			target: [envVars.projectId, envVars.scope, envVars.name],
			set: { ciphertext, lastFour: lastFour(args.value), updatedAt: new Date() },
		})
		.returning({
			id: envVars.id,
			scope: envVars.scope,
			name: envVars.name,
			lastFour: envVars.lastFour,
			createdAt: envVars.createdAt,
			updatedAt: envVars.updatedAt,
		});

	return JSON.stringify(row, null, 2);
}

export async function deleteEnvVar(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [existing] = await db
		.select()
		.from(envVars)
		.where(eq(envVars.id, args.id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "env var not found" });
	await toolAssertMember(user, existing.projectId);

	await db.delete(envVars).where(eq(envVars.id, args.id));
	return "Deleted.";
}

export async function exportDotenv(
	args: { idOrKey: string; scope: "development" | "staging" | "production" },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select()
		.from(envVars)
		.where(
			and(
				eq(envVars.projectId, project.id),
				eq(envVars.scope, args.scope),
			),
		)
		.orderBy(envVars.name);

	const dotenv = rows
		.map((r) => `${r.name}=${JSON.stringify(decryptSecret(r.ciphertext))}`)
		.join("\n");

	return dotenv;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export async function listFiles(
	args: { idOrKey: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const project = await toolLoadProject(args.idOrKey);
	await toolAssertMember(user, project.id);
	const db = getDb();

	const rows = await db
		.select({
			id: files.id,
			name: files.name,
			mimeType: files.mimeType,
			sizeBytes: files.sizeBytes,
			sha256: files.sha256,
			issueId: files.issueId,
			uploadedById: files.uploadedById,
			createdAt: files.createdAt,
		})
		.from(files)
		.where(eq(files.projectId, project.id))
		.orderBy(desc(files.createdAt));

	return JSON.stringify(rows, null, 2);
}

export async function deleteFile(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [existing] = await db
		.select()
		.from(files)
		.where(eq(files.id, args.id))
		.limit(1);

	if (!existing) throw createError({ statusCode: 404, statusMessage: "file not found" });
	await toolAssertMember(user, existing.projectId);

	await db.delete(files).where(eq(files.id, args.id));
	return "Deleted.";
}

export async function getFileContent(
	args: { id: string },
	event: H3Event,
) {
	const user = await getToolUser(event);
	const db = getDb();

	const [row] = await db
		.select()
		.from(files)
		.where(eq(files.id, args.id))
		.limit(1);

	if (!row) throw createError({ statusCode: 404, statusMessage: "file not found" });
	await toolAssertMember(user, row.projectId);

	const isText =
		row.mimeType.startsWith("text/") ||
		row.mimeType === "application/json" ||
		row.name.endsWith(".md") ||
		row.name.endsWith(".markdown");

	if (!isText) throw createError({ statusCode: 400, statusMessage: "file is not a text file" });

	return row.data.toString("utf-8");
}
