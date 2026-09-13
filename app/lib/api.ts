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
  IssueLink,
  IssueLinkKind,
  IssueTemplate,
  SavedFilter,
  BulkIssuePatch,
  Sprint,
  SprintBurndown,
  SprintVelocity,
  CycleTimeEntry,
  Secret,
  EnvVar,
  FileRow,
  AuditEntry,
  ApiToken,
  MfaStatus,
  MfaSetup,
  Webhook,
  WebhookDelivery,
} from "~/types/domain";

import type { ApiError } from "~/types/domain";

type RequestInitWithAuth = RequestInit & {
  authToken?: string | null;
};

async function request<T = unknown>(
  path: string,
  init: RequestInitWithAuth = {},
): Promise<T> {
  const config = useRuntimeConfig();
  const base = config.public.apiBase ?? "/api";
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  // Stateless bearer token auth: no cookies.
  const authToken = init.authToken ?? getCurrentAuthToken();
  if (authToken) {
    headers.set("authorization", `Bearer ${authToken}`);
  }
  const res = await fetch(`${base}${path}`, {
    credentials: "omit",
    ...init,
    headers,
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearCurrentAuth();
      await navigateTo("/login");
    }
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

const TOKEN_KEY = "orbit_auth_token";

let currentAuthToken: string | null = null;

export function setCurrentAuthToken(token: string | null) {
  currentAuthToken = token;
  if (import.meta.client) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

export function getCurrentAuthToken(): string | null {
  if (!currentAuthToken && import.meta.client) {
    currentAuthToken = localStorage.getItem(TOKEN_KEY);
  }
  return currentAuthToken;
}

export function clearCurrentAuth() {
  currentAuthToken = null;
  if (import.meta.client) localStorage.removeItem(TOKEN_KEY);
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
  // Explicit auth variant for login / token-based flows.
  auth: {
    get: <T = unknown>(p: string) =>
      request<T>(p, { authToken: getCurrentAuthToken() }),
    post: <T = unknown>(p: string, body?: unknown) =>
      request<T>(p, {
        method: "POST",
        body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
        authToken: getCurrentAuthToken(),
      }),
    patch: <T = unknown>(p: string, body?: unknown) =>
      request<T>(p, {
        method: "PATCH",
        body: JSON.stringify(body ?? {}),
        authToken: getCurrentAuthToken(),
      }),
    del: <T = unknown>(p: string) =>
      request<T>(p, { method: "DELETE", authToken: getCurrentAuthToken() }),
  },
};
