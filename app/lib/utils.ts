import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function initials(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function timeAgo(input: string | Date | null | undefined): string {
	if (!input) return "";
	const d = typeof input === "string" ? new Date(input) : input;
	const diff = (Date.now() - d.getTime()) / 1000;
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
	return d.toLocaleDateString();
}
