<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import Dialog from "~/components/ui/Dialog.vue";

const open = defineModel<boolean>("open", { default: false });

function onKey(e: KeyboardEvent) {
	if (e.key === "?" && !isEditable(e.target)) {
		e.preventDefault();
		open.value = !open.value;
	}
	if (e.key === "Escape") open.value = false;
}

function isEditable(el: EventTarget | null) {
	if (!(el instanceof HTMLElement)) return false;
	const tag = el.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

const SHORTCUTS = [
	{
		group: "Navigation",
		bindings: [
			{ keys: ["g", "d"], label: "Go to Dashboard" },
			{ keys: ["g", "p"], label: "Go to Projects" },
			{ keys: ["g", "t"], label: "Go to Team" },
			{ keys: ["g", "s"], label: "Go to Settings" },
		],
	},
	{
		group: "Global",
		bindings: [
			{ keys: ["⌘K", "/"], label: "Open command palette" },
			{ keys: ["?"], label: "Show keyboard shortcuts" },
			{ keys: ["c"], label: "Create new issue" },
			{ keys: ["Esc"], label: "Close panel / deselect" },
		],
	},
	{
		group: "Issue drawer",
		bindings: [
			{ keys: ["Esc"], label: "Close drawer" },
		],
	},
];
</script>

<template>
	<Dialog v-model:open="open" title="Keyboard shortcuts" width="480px">
		<div class="p-5 space-y-5">
			<div v-for="section in SHORTCUTS" :key="section.group">
				<h4 class="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold mb-2">
					{{ section.group }}
				</h4>
				<ul class="space-y-1.5">
					<li
						v-for="b in section.bindings"
						:key="b.label"
						class="flex items-center justify-between text-sm"
					>
						<span class="text-[var(--color-fg-muted)]">{{ b.label }}</span>
						<span class="flex items-center gap-1">
							<kbd
								v-for="k in b.keys"
								:key="k"
								class="mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-panel-hover)] border border-[var(--color-border)] text-[var(--color-fg-subtle)]"
							>{{ k }}</kbd>
						</span>
					</li>
				</ul>
			</div>
		</div>
	</Dialog>
</template>
