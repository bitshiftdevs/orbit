export type ApiError = {
	status: number;
	message: string;
	issues?: unknown;
};

async function request<T = unknown>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.body && !(init.body instanceof FormData)) {
		headers.set("content-type", "application/json");
	}
	const res = await fetch(`/api${path}`, {
		credentials: "include",
		...init,
		headers,
	});
	if (!res.ok) {
		const err: ApiError = {
			status: res.status,
			message: `request failed (${res.status})`,
		};
		try {
			const data = await res.json();
			if (data?.error) err.message = data.error;
			if (data?.issues) err.issues = data.issues;
		} catch {}
		throw err;
	}
	if (res.status === 204) return undefined as T;
	const ctype = res.headers.get("content-type") ?? "";
	if (ctype.includes("application/json")) return (await res.json()) as T;
	return (await res.blob()) as unknown as T;
}

export const api = {
	get: <T = unknown>(p: string) => request<T>(p),
	post: <T = unknown>(p: string, body?: unknown) =>
		request<T>(p, {
			method: "POST",
			body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
		}),
	patch: <T = unknown>(p: string, body?: unknown) =>
		request<T>(p, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
	del: <T = unknown>(p: string) => request<T>(p, { method: "DELETE" }),
	raw: request,
};

// Domain models mirroring the server responses.
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
	assignee: {
		id: string;
		name: string;
		handle: string;
		avatarUrl: string | null;
		accentColor: string;
	} | null;
	reporterId: string | null;
	parentId: string | null;
	sprintId: string | null;
	labels: string[];
	dueAt: string | null;
	completedAt: string | null;
	createdAt: string;
	updatedAt: string;
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
