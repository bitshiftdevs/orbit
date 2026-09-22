export type ApiError = {
	status: number;
	message: string;
	issues?: unknown;
};

export type Role = "owner" | "admin" | "member";

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	handle: string;
	avatarUrl: string | null;
	role: Role;
	accentColor: string;
	lastSeenAt: string | null;
	createdAt: string;
};

export type Project = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	status: "active" | "paused" | "archived";
	color: string;
	icon: string;
	repoUrl: string | null;
	productionUrl: string | null;
	leadId: string | null;
	issueCounter: number;
	createdAt: string;
	updatedAt: string;
};

export type IssueStatus =
	| "backlog"
	| "todo"
	| "in_progress"
	| "in_review"
	| "done"
	| "cancelled";

export type IssueType = "task" | "bug" | "story" | "epic" | "chore";
export type IssuePriority = "trivial" | "low" | "medium" | "high" | "urgent";

export type IssueAssignee = {
	id: string;
	name: string;
	handle: string;
	avatarUrl: string | null;
	accentColor: string;
};

export type Issue = {
	id: string;
	projectId: string;
	number: number;
	key: string;
	title: string;
	description: string | null;
	type: IssueType;
	status: IssueStatus;
	priority: IssuePriority;
	rank: string;
	storyPoints: number | null;
	assigneeId: string | null;
	assignee: IssueAssignee | null;
	reporterId: string | null;
	reporter: IssueAssignee | null;
	parentId: string | null;
	sprintId: string | null;
	labels: string[];
	prUrl: string | null;
	dueAt: string | null;
	completedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type IssueLinkKind = "blocks" | "duplicates" | "relates_to";

export type IssueLink = {
	id: string;
	sourceId: string;
	targetId: string;
	kind: IssueLinkKind;
	createdAt: string;
	linked: Pick<Issue, "id" | "key" | "title" | "status" | "type" | "priority">;
};

export type IssueTemplate = {
	id: string;
	projectId: string;
	name: string;
	description: string | null;
	type: IssueType;
	priority: IssuePriority;
	labels: string[];
	body: string | null;
	createdAt: string;
};

export type SprintVelocity = {
	sprintId: string;
	sprintName: string;
	status: string;
	committed: number;
	completed: number;
	issueCount: number;
};

export type CycleTimeEntry = {
	type: IssueType;
	avgDays: number;
	count: number;
};

export type IssueComment = {
	id: string;
	body: string;
	createdAt: string;
	author: {
		id: string;
		name: string;
		handle: string;
		avatarUrl: string | null;
		accentColor: string;
	};
};

export type IssueFilterState = {
	status: IssueStatus[];
	priority: IssuePriority[];
	assigneeId: string[];
	text: string;
};

export type SavedFilter = {
	id: string;
	name: string;
	query: IssueFilterState;
	createdAt: string;
};

export type BulkIssuePatch = {
	status: IssueStatus | "";
	priority: IssuePriority | "";
	assigneeId: string;
	sprintId: string;
};

export type Sprint = {
	id: string;
	projectId: string;
	name: string;
	goal: string | null;
	status: "planned" | "active" | "completed";
	startsAt: string | null;
	endsAt: string | null;
	createdAt: string;
};

export type SprintBurndown = {
	total: number;
	completed: number;
	days: Array<{ date: string; remaining: number; ideal: number }>;
};

export type Secret = {
	id: string;
	name: string;
	description: string | null;
	lastFour: string | null;
	createdAt: string;
	updatedAt: string;
};

export type EnvVar = {
	id: string;
	scope: "development" | "staging" | "production";
	name: string;
	lastFour: string | null;
	createdAt: string;
	updatedAt: string;
};

export type FileRow = {
	id: string;
	name: string;
	mimeType: string;
	sizeBytes: number;
	sha256: string;
	issueId: string | null;
	uploadedById: string | null;
	createdAt: string;
};

export type AuditEntry = {
	id: string;
	actorId: string | null;
	projectId: string | null;
	action: string;
	targetId: string | null;
	targetName: string | null;
	meta: Record<string, unknown> | null;
	ip: string | null;
	createdAt: string;
	actor: {
		id: string | null;
		name: string | null;
		handle: string | null;
		avatarUrl: string | null;
	} | null;
};

export type ApiToken = {
	id: string;
	name: string;
	lastFour: string;
	scopes: string[];
	projectId: string | null;
	lastUsedAt: string | null;
	expiresAt: string | null;
	revokedAt: string | null;
	createdAt: string;
};

export type MfaStatus = {
	enabled: boolean;
	lastUsedAt: string | null;
};

export type MfaSetup = {
	secret: string;
	otpauth: string;
	backupCodes: string[];
};

export type Webhook = {
	id: string;
	name: string;
	url: string;
	events: string[];
	preset: string | null;
	config: Record<string, string> | null;
	active: boolean;
	createdAt: string;
};

export type WebhookDelivery = {
	id: string;
	event: string;
	statusCode: number | null;
	error: string | null;
	durationMs: number | null;
	createdAt: string;
};
