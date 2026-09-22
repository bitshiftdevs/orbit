import { relations, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	customType,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; default: false }>({
	dataType() {
		return "bytea";
	},
});

const tsvector = customType<{ data: string }>({
	dataType() {
		return "tsvector";
	},
});

export const userRole = pgEnum("user_role", ["owner", "admin", "member"]);
export const projectStatus = pgEnum("project_status", [
	"active",
	"paused",
	"archived",
]);
export const issueType = pgEnum("issue_type", [
	"task",
	"bug",
	"story",
	"epic",
	"chore",
]);
export const issueStatus = pgEnum("issue_status", [
	"backlog",
	"todo",
	"in_progress",
	"in_review",
	"done",
	"cancelled",
]);
export const issuePriority = pgEnum("issue_priority", [
	"trivial",
	"low",
	"medium",
	"high",
	"urgent",
]);
export const sprintStatus = pgEnum("sprint_status", [
	"planned",
	"active",
	"completed",
]);
export const envScope = pgEnum("env_scope", [
	"development",
	"staging",
	"production",
]);
export const auditAction = pgEnum("audit_action", [
	"secret.read",
	"secret.create",
	"secret.update",
	"secret.delete",
	"envvar.read",
	"envvar.create",
	"envvar.update",
	"envvar.delete",
	"file.download",
	"file.upload",
	"file.edit",
	"file.delete",
	"member.invite",
	"member.remove",
	"project.create",
	"project.archive",
	"token.create",
	"token.revoke",
	"webhook.create",
	"webhook.update",
	"webhook.delete",
	"webhook.deliver",
	"mfa.enable",
	"mfa.disable",
]);

export const notificationKind = pgEnum("notification_kind", [
	"mention",
	"assigned",
	"comment",
	"status_change",
	"invite",
]);

export const issueLinkKind = pgEnum("issue_link_kind", [
	"blocks",
	"duplicates",
	"relates_to",
]);

export const webhookEvent = pgEnum("webhook_event", [
	"issue.created",
	"issue.updated",
	"issue.status_changed",
	"issue.commented",
	"sprint.started",
	"sprint.completed",
	"secret.created",
]);

// ---------------------------------------------------------------------------
// Users, sessions, invites
// ---------------------------------------------------------------------------
export const users = pgTable(
	"users",
	{
		id: uuid().primaryKey().defaultRandom(),
		email: varchar({ length: 255 }).notNull(),
		name: varchar({ length: 120 }).notNull(),
		handle: varchar({ length: 40 }).notNull(),
		avatarUrl: text(),
		passwordHash: text().notNull(),
		role: userRole().notNull().default("member"),
		accentColor: varchar({ length: 16 }).notNull().default("#3b82f6"),
		lastSeenAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("users_email_key").on(t.email),
		uniqueIndex("users_handle_key").on(t.handle),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: text().primaryKey(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		userAgent: text(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("sessions_user_idx").on(t.userId)],
);

export const invites = pgTable(
	"invites",
	{
		id: uuid().primaryKey().defaultRandom(),
		token: text().notNull(),
		email: varchar({ length: 255 }).notNull(),
		role: userRole().notNull().default("member"),
		invitedBy: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		acceptedAt: timestamp({ withTimezone: true }),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("invites_token_key").on(t.token)],
);

// ---------------------------------------------------------------------------
// Projects & membership
// ---------------------------------------------------------------------------
export const projects = pgTable(
	"projects",
	{
		id: uuid().primaryKey().defaultRandom(),
		// Short capitalised code e.g. "ORB", "RUN" — used in issue keys like ORB-42.
		key: varchar({ length: 10 }).notNull(),
		name: varchar({ length: 120 }).notNull(),
		description: text(),
		status: projectStatus().notNull().default("active"),
		color: varchar({ length: 16 }).notNull().default("#3b82f6"),
		icon: varchar({ length: 40 }).notNull().default("rocket"),
		repoUrl: text(),
		productionUrl: text(),
		leadId: uuid().references(() => users.id, { onDelete: "set null" }),
		// Auto-incrementing counter per project used to mint issue keys.
		issueCounter: integer().notNull().default(0),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("projects_key_uniq").on(t.key)],
);

export const projectMembers = pgTable(
	"project_members",
	{
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Sprints & issues
// ---------------------------------------------------------------------------
export const sprints = pgTable(
	"sprints",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		name: varchar({ length: 120 }).notNull(),
		goal: text(),
		status: sprintStatus().notNull().default("planned"),
		startsAt: timestamp({ withTimezone: true }),
		endsAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("sprints_project_idx").on(t.projectId)],
);

export const issues = pgTable(
	"issues",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Numeric per-project id — combined with project.key it becomes "ORB-42".
		number: integer().notNull(),
		title: varchar({ length: 240 }).notNull(),
		description: text(),
		type: issueType().notNull().default("task"),
		status: issueStatus().notNull().default("backlog"),
		priority: issuePriority().notNull().default("medium"),
		// Fractional index (lexorank-style) used for drag-and-drop ordering.
		rank: varchar({ length: 40 }).notNull(),
		storyPoints: integer(),
		assigneeId: uuid().references(() => users.id, { onDelete: "set null" }),
		reporterId: uuid().references(() => users.id, { onDelete: "set null" }),
		parentId: uuid().references((): any => issues.id, {
			onDelete: "set null",
		}),
		sprintId: uuid().references(() => sprints.id, { onDelete: "set null" }),
		labels: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
		prUrl: text(),
		dueAt: timestamp({ withTimezone: true }),
		completedAt: timestamp({ withTimezone: true }),
		searchVector: tsvector(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("issues_project_number_uniq").on(t.projectId, t.number),
		index("issues_project_status_idx").on(t.projectId, t.status),
		index("issues_assignee_idx").on(t.assigneeId),
		index("issues_sprint_idx").on(t.sprintId),
	],
);

export const issueComments = pgTable(
	"issue_comments",
	{
		id: uuid().primaryKey().defaultRandom(),
		issueId: uuid()
			.notNull()
			.references(() => issues.id, { onDelete: "cascade" }),
		authorId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		body: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		editedAt: timestamp({ withTimezone: true }),
	},
	(t) => [index("issue_comments_issue_idx").on(t.issueId)],
);

// ---------------------------------------------------------------------------
// Secrets, env vars (encrypted at rest)
// ---------------------------------------------------------------------------
export const secrets = pgTable(
	"secrets",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		name: varchar({ length: 120 }).notNull(),
		description: text(),
		// AES-256-GCM: 12-byte iv || 16-byte tag || ciphertext.
		ciphertext: bytea().notNull(),
		lastFour: varchar({ length: 4 }),
		createdById: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("secrets_project_name_uniq").on(t.projectId, t.name)],
);

export const envVars = pgTable(
	"env_vars",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		scope: envScope().notNull().default("development"),
		name: varchar({ length: 120 }).notNull(),
		ciphertext: bytea().notNull(),
		lastFour: varchar({ length: 4 }),
		createdById: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("env_vars_project_scope_name_uniq").on(
			t.projectId,
			t.scope,
			t.name,
		),
	],
);

// ---------------------------------------------------------------------------
// Files (blob storage in Postgres)
// ---------------------------------------------------------------------------
export const files = pgTable(
	"files",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		issueId: uuid().references(() => issues.id, { onDelete: "set null" }),
		name: varchar({ length: 255 }).notNull(),
		mimeType: varchar({ length: 120 }).notNull(),
		sizeBytes: bigint({ mode: "number" }).notNull(),
		sha256: varchar({ length: 64 }).notNull(),
		data: bytea().notNull(),
		uploadedById: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("files_project_idx").on(t.projectId),
		index("files_issue_idx").on(t.issueId),
		index("files_sha_idx").on(t.sha256),
	],
);

// ---------------------------------------------------------------------------
// Audit log — every secret/file access lands here.
// ---------------------------------------------------------------------------
export const auditLog = pgTable(
	"audit_log",
	{
		id: uuid().primaryKey().defaultRandom(),
		actorId: uuid().references(() => users.id, { onDelete: "set null" }),
		projectId: uuid().references(() => projects.id, { onDelete: "cascade" }),
		action: auditAction().notNull(),
		targetId: uuid(),
		targetName: text(),
		meta: jsonb().$type<Record<string, unknown>>(),
		ip: varchar({ length: 64 }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("audit_project_idx").on(t.projectId, t.createdAt),
		index("audit_actor_idx").on(t.actorId, t.createdAt),
	],
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notifications = pgTable(
	"notifications",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		kind: notificationKind().notNull(),
		message: text().notNull(),
		projectId: uuid().references(() => projects.id, { onDelete: "cascade" }),
		issueId: uuid().references(() => issues.id, { onDelete: "cascade" }),
		actorId: uuid().references(() => users.id, { onDelete: "set null" }),
		readAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("notifications_user_unread_idx").on(t.userId, t.readAt),
		index("notifications_user_created_idx").on(t.userId, t.createdAt),
	],
);

export const pushSubscriptions = pgTable(
	"push_subscriptions",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		endpoint: text().notNull(),
		p256dh: text().notNull(),
		auth: text().notNull(),
		userAgent: text(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("push_subscriptions_endpoint_uniq").on(t.endpoint),
		index("push_subscriptions_user_idx").on(t.userId),
	],
);

// ---------------------------------------------------------------------------
// Personal API tokens (bearer)
// ---------------------------------------------------------------------------
export const apiTokens = pgTable(
	"api_tokens",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		projectId: uuid().references(() => projects.id, { onDelete: "cascade" }),
		name: varchar({ length: 120 }).notNull(),
		tokenHash: varchar({ length: 64 }).notNull(),
		lastFour: varchar({ length: 8 }).notNull(),
		scopes: jsonb().$type<string[]>().notNull().default(sql`'["read","write"]'::jsonb`),
		lastUsedAt: timestamp({ withTimezone: true }),
		expiresAt: timestamp({ withTimezone: true }),
		revokedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("api_tokens_hash_uniq").on(t.tokenHash),
		index("api_tokens_user_idx").on(t.userId),
		index("api_tokens_project_idx").on(t.projectId),
	],
);

// ---------------------------------------------------------------------------
// Saved filters (per user, optionally scoped to a project)
// ---------------------------------------------------------------------------
export const savedFilters = pgTable(
	"saved_filters",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		projectId: uuid().references(() => projects.id, { onDelete: "cascade" }),
		name: varchar({ length: 120 }).notNull(),
		query: jsonb().$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("saved_filters_owner_idx").on(t.userId, t.projectId)],
);

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
export const webhooks = pgTable(
	"webhooks",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		name: varchar({ length: 120 }).notNull(),
		url: text().notNull(),
		// Used to sign the X-Orbit-Signature HMAC header.
		signingSecret: text().notNull(),
		events: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
		preset: varchar({ length: 32 }),
		// Preset-specific configuration (e.g. Telegram { botToken, chatId }).
		config: jsonb().$type<Record<string, string>>(),
		active: boolean().notNull().default(true),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("webhooks_project_idx").on(t.projectId)],
);

export const webhookDeliveries = pgTable(
	"webhook_deliveries",
	{
		id: uuid().primaryKey().defaultRandom(),
		webhookId: uuid()
			.notNull()
			.references(() => webhooks.id, { onDelete: "cascade" }),
		event: varchar({ length: 40 }).notNull(),
		statusCode: integer(),
		error: text(),
		durationMs: integer(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("webhook_deliveries_hook_idx").on(t.webhookId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Issue links (blocks / duplicates / relates_to)
// ---------------------------------------------------------------------------
export const issueLinks = pgTable(
	"issue_links",
	{
		id: uuid().primaryKey().defaultRandom(),
		sourceId: uuid()
			.notNull()
			.references(() => issues.id, { onDelete: "cascade" }),
		targetId: uuid()
			.notNull()
			.references(() => issues.id, { onDelete: "cascade" }),
		kind: issueLinkKind().notNull().default("relates_to"),
		createdById: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("issue_links_uniq").on(t.sourceId, t.targetId, t.kind),
		index("issue_links_source_idx").on(t.sourceId),
		index("issue_links_target_idx").on(t.targetId),
	],
);

// ---------------------------------------------------------------------------
// Issue templates per project
// ---------------------------------------------------------------------------
export const issueTemplates = pgTable(
	"issue_templates",
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: uuid()
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		name: varchar({ length: 120 }).notNull(),
		description: text(),
		type: issueType().notNull().default("task"),
		priority: issuePriority().notNull().default("medium"),
		labels: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
		body: text(),
		createdById: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("issue_templates_project_idx").on(t.projectId)],
);

// ---------------------------------------------------------------------------
// MFA (TOTP)
// ---------------------------------------------------------------------------
export const userMfa = pgTable("user_mfa", {
	userId: uuid()
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	// AES-256-GCM ciphertext of the base32 TOTP secret.
	secretCiphertext: bytea().notNull(),
	backupCodes: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
	enabledAt: timestamp({ withTimezone: true }),
	lastUsedAt: timestamp({ withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	memberships: many(projectMembers),
	assignedIssues: many(issues, { relationName: "assignee" }),
	reportedIssues: many(issues, { relationName: "reporter" }),
	comments: many(issueComments),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
	lead: one(users, { fields: [projects.leadId], references: [users.id] }),
	members: many(projectMembers),
	issues: many(issues),
	sprints: many(sprints),
	secrets: many(secrets),
	envVars: many(envVars),
	files: many(files),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
	project: one(projects, {
		fields: [projectMembers.projectId],
		references: [projects.id],
	}),
	user: one(users, {
		fields: [projectMembers.userId],
		references: [users.id],
	}),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
	project: one(projects, {
		fields: [issues.projectId],
		references: [projects.id],
	}),
	assignee: one(users, {
		fields: [issues.assigneeId],
		references: [users.id],
		relationName: "assignee",
	}),
	reporter: one(users, {
		fields: [issues.reporterId],
		references: [users.id],
		relationName: "reporter",
	}),
	sprint: one(sprints, {
		fields: [issues.sprintId],
		references: [sprints.id],
	}),
	parent: one(issues, {
		fields: [issues.parentId],
		references: [issues.id],
		relationName: "children",
	}),
	children: many(issues, { relationName: "children" }),
	comments: many(issueComments),
	attachments: many(files),
}));

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
	project: one(projects, {
		fields: [sprints.projectId],
		references: [projects.id],
	}),
	issues: many(issues),
}));

export const commentsRelations = relations(issueComments, ({ one }) => ({
	issue: one(issues, {
		fields: [issueComments.issueId],
		references: [issues.id],
	}),
	author: one(users, {
		fields: [issueComments.authorId],
		references: [users.id],
	}),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id],
	}),
	actor: one(users, {
		fields: [notifications.actorId],
		references: [users.id],
	}),
	project: one(projects, {
		fields: [notifications.projectId],
		references: [projects.id],
	}),
	issue: one(issues, {
		fields: [notifications.issueId],
		references: [issues.id],
	}),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
	project: one(projects, {
		fields: [webhooks.projectId],
		references: [projects.id],
	}),
	deliveries: many(webhookDeliveries),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;
export type Sprint = typeof sprints.$inferSelect;
export type Secret = typeof secrets.$inferSelect;
export type EnvVar = typeof envVars.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type SavedFilter = typeof savedFilters.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type IssueLink = typeof issueLinks.$inferSelect;
export type IssueTemplate = typeof issueTemplates.$inferSelect;
