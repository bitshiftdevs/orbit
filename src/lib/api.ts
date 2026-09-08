export type {
	ApiError,
	Role,
	SessionUser,
	Project,
	IssueStatus,
	IssueType,
	IssuePriority,
	IssueAssignee,
	Issue,
	IssueComment,
	IssueFilterState,
	SavedFilter,
	BulkIssuePatch,
	Sprint,
	SprintBurndown,
	Secret,
	EnvVar,
	FileRow,
	AuditEntry,
	ApiToken,
	MfaStatus,
	MfaSetup,
	Webhook,
	WebhookDelivery,
} from "@/types/domain";

import type { ApiError } from "@/types/domain";

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
	get: <T = unknown>(p: string, { force }: { force?: boolean } = {}) =>
		request<T>(p, force ? { cache: "reload" } : {}),
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
