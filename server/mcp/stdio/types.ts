export type ApiFn = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;
