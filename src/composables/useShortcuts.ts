import { onMounted, onUnmounted } from "vue";

type Handler = (e: KeyboardEvent) => void;
type Binding = string | string[];

function isEditable(el: EventTarget | null): boolean {
	if (!(el instanceof HTMLElement)) return false;
	const tag = el.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return el.isContentEditable;
}

function comboOf(e: KeyboardEvent): string {
	const parts: string[] = [];
	if (e.metaKey || e.ctrlKey) parts.push("mod");
	if (e.shiftKey) parts.push("shift");
	if (e.altKey) parts.push("alt");
	parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());
	return parts.join("+");
}

/**
 * Register a keydown handler that only fires when the user isn't typing in an
 * input, unless the binding uses a modifier (⌘/ctrl). Supports single-key
 * chords like "g b" — the two keys must land within 800ms of each other.
 */
export function useShortcuts(
	map: Record<string, Handler>,
	options: { allowInInput?: boolean } = {},
) {
	let buffer: { key: string; expiresAt: number } | null = null;

	function onKey(e: KeyboardEvent) {
		const combo = comboOf(e);
		const inInput = isEditable(e.target);
		const isModified = combo.startsWith("mod+");

		if (inInput && !isModified && !options.allowInInput) return;

		// Chord: `g b` → look for previous "g" within 800ms.
		if (buffer && buffer.expiresAt > Date.now()) {
			const chord = `${buffer.key} ${combo}`;
			buffer = null;
			const handler = map[chord];
			if (handler) {
				e.preventDefault();
				handler(e);
				return;
			}
		}

		const handler = map[combo];
		if (handler) {
			e.preventDefault();
			handler(e);
			return;
		}
		// Start a chord if we have a "g x" binding matching this leader key.
		const isLeader = Object.keys(map).some((k) => k.startsWith(`${combo} `));
		if (isLeader) buffer = { key: combo, expiresAt: Date.now() + 800 };
	}

	onMounted(() => window.addEventListener("keydown", onKey));
	onUnmounted(() => window.removeEventListener("keydown", onKey));
}
