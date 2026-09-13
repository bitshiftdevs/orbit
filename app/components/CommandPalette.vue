<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
	FolderKanban,
	KeyRound,
	Search,
	Sparkles,
	User,
} from "lucide-vue-next";
import { api } from "~/lib/api";

type SearchResults = {
	projects: Array<{ id: string; key: string; name: string; color: string }>;
	issues: Array<{
		id: string;
		title: string;
		number: number;
		status: string;
		projectKey: string;
		projectId: string;
	}>;
	members: Array<{
		id: string;
		name: string;
		handle: string;
		avatarUrl: string | null;
		accentColor: string;
	}>;
	secrets: Array<{
		id: string;
		name: string;
		projectKey: string;
		projectId: string;
	}>;
};

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const q = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const results = ref<SearchResults>({
	projects: [],
	issues: [],
	members: [],
	secrets: [],
});
const activeIndex = ref(0);
const router = useRouter();

const flat = computed(() => {
	const items: Array<
		| { kind: "project"; go: () => void; label: string; sub: string; color: string }
		| { kind: "issue"; go: () => void; label: string; sub: string; color: string }
		| { kind: "member"; go: () => void; label: string; sub: string; color: string }
		| { kind: "secret"; go: () => void; label: string; sub: string; color: string }
	> = [];
	for (const p of results.value.projects) {
		items.push({
			kind: "project",
			label: p.name,
			sub: p.key,
			color: p.color,
			go: () => router.push({ name: "project-board", params: { key: p.key } }),
		});
	}
	for (const i of results.value.issues) {
		items.push({
			kind: "issue",
			label: i.title,
			sub: `${i.projectKey}-${i.number}`,
			color: "#3b82f6",
			go: () =>
				router.push({
					name: "project-board",
					params: { key: i.projectKey },
					query: { issue: i.id },
				}),
		});
	}
	for (const m of results.value.members) {
		items.push({
			kind: "member",
			label: m.name,
			sub: `@${m.handle}`,
			color: m.accentColor,
			go: () => router.push({ name: "team" }),
		});
	}
	for (const s of results.value.secrets) {
		items.push({
			kind: "secret",
			label: s.name,
			sub: `${s.projectKey} · secret`,
			color: "#f59e0b",
			go: () =>
				router.push({
					name: "project-secrets",
					params: { key: s.projectKey },
				}),
		});
	}
	return items;
});

let searchAbort: AbortController | null = null;
async function runSearch(val: string) {
	if (!val.trim()) {
		results.value = { projects: [], issues: [], members: [], secrets: [] };
		return;
	}
	searchAbort?.abort();
	searchAbort = new AbortController();
	try {
		results.value = await api.get<SearchResults>(
			`/search?q=${encodeURIComponent(val)}`,
		);
		activeIndex.value = 0;
	} catch {}
}

watch(q, (v) => runSearch(v));
watch(
	() => props.open,
	async (v) => {
		if (v) {
			q.value = "";
			results.value = { projects: [], issues: [], members: [], secrets: [] };
			activeIndex.value = 0;
			await nextTick();
			inputRef.value?.focus();
		}
	},
);

function close() {
	emit("update:open", false);
}

function onKey(e: KeyboardEvent) {
	if (e.key === "ArrowDown") {
		e.preventDefault();
		activeIndex.value = Math.min(activeIndex.value + 1, flat.value.length - 1);
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		activeIndex.value = Math.max(0, activeIndex.value - 1);
	} else if (e.key === "Enter") {
		e.preventDefault();
		const item = flat.value[activeIndex.value];
		if (item) {
			item.go();
			close();
		}
	}
}

const iconFor = {
	project: FolderKanban,
	issue: Sparkles,
	member: User,
	secret: KeyRound,
};
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-100"
			enter-from-class="opacity-0"
			leave-active-class="transition-opacity duration-75"
			leave-to-class="opacity-0"
		>
			<div
				v-if="open"
				class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
				@click="close"
			/>
		</Transition>
		<Transition
			enter-active-class="transition-all duration-150 ease-out"
			enter-from-class="opacity-0 -translate-y-1"
			leave-active-class="transition-all duration-100"
			leave-to-class="opacity-0 -translate-y-1"
		>
			<div
				v-if="open"
				class="fixed left-1/2 top-[15vh] z-[81] -translate-x-1/2 w-[560px] max-w-[calc(100vw-2rem)] card glow overflow-hidden"
			>
				<div class="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)]">
					<Search class="h-4 w-4 text-[var(--color-fg-subtle)]" />
					<input
						ref="inputRef"
						v-model="q"
						class="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--color-fg-subtle)]"
						placeholder="Search projects, issues (try ORB-42), members, secrets…"
						@keydown="onKey"
					/>
					<kbd
						class="mono text-[10px] text-[var(--color-fg-subtle)] px-1.5 py-0.5 rounded border border-[var(--color-border)]"
					>
						esc
					</kbd>
				</div>
				<div class="max-h-[50vh] overflow-y-auto py-1">
					<button
						v-for="(item, idx) in flat"
						:key="idx"
						type="button"
						class="w-full flex items-center gap-3 px-3 py-2 text-left text-sm"
						:class="{
							'bg-[var(--color-panel-hover)]': activeIndex === idx,
						}"
						@mouseenter="activeIndex = idx"
						@click="() => { item.go(); close(); }"
					>
						<component
							:is="iconFor[item.kind]"
							class="h-4 w-4 shrink-0"
							:style="{ color: item.color }"
						/>
						<span class="flex-1 truncate">{{ item.label }}</span>
						<span class="mono text-[11px] text-[var(--color-fg-subtle)]">
							{{ item.sub }}
						</span>
					</button>
					<div
						v-if="q && !flat.length"
						class="px-4 py-6 text-center text-sm text-[var(--color-fg-subtle)]"
					>
						nothing matches "{{ q }}"
					</div>
					<div
						v-else-if="!q"
						class="px-4 py-6 text-center text-xs text-[var(--color-fg-subtle)]"
					>
						type to search · <kbd class="mono px-1">↑↓</kbd> nav ·
						<kbd class="mono px-1">↵</kbd> open
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
