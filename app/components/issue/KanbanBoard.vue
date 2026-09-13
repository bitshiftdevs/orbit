<script setup lang="ts">
import { computed, ref } from "vue";
import type { Issue, IssueStatus } from "~/lib/api";
import { api } from "~/lib/api";
import { notifyError } from "~/lib/notify";
import IssueCard from "./IssueCard.vue";
import { BOARD_STATUSES, STATUS_META } from "./meta";

const props = defineProps<{
	issues: Issue[];
	projectKey: string;
}>();

const emit = defineEmits<{
	open: [id: string];
	changed: [issue: Issue];
	newIn: [status: IssueStatus];
}>();

const dragging = ref<string | null>(null);
const dragOver = ref<IssueStatus | null>(null);

const grouped = computed(() => {
	const g: Record<IssueStatus, Issue[]> = {
		backlog: [],
		todo: [],
		in_progress: [],
		in_review: [],
		done: [],
		cancelled: [],
	};
	for (const i of props.issues) g[i.status].push(i);
	for (const k of Object.keys(g) as IssueStatus[]) {
		g[k].sort((a, b) => (a.rank < b.rank ? -1 : 1));
	}
	return g;
});

function onDragStart(e: DragEvent, id: string) {
	dragging.value = id;
	e.dataTransfer?.setData("text/plain", id);
	if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e: DragEvent, status: IssueStatus) {
	e.preventDefault();
	dragOver.value = status;
}

async function onDrop(e: DragEvent, status: IssueStatus, index: number | null) {
	e.preventDefault();
	const id = e.dataTransfer?.getData("text/plain") ?? dragging.value;
	dragging.value = null;
	dragOver.value = null;
	if (!id) return;
	const col = grouped.value[status].filter((i) => i.id !== id);
	const before = index != null ? col[index - 1] ?? null : col[col.length - 1] ?? null;
	const after = index != null ? col[index] ?? null : null;
	try {
		const { issue } = await api.post<{ issue: Issue }>(
			`/issues/${id}/reorder`,
			{
				status,
				beforeId: before?.id ?? null,
				afterId: after?.id ?? null,
			},
		);
		emit("changed", issue);
	} catch (err) {
		notifyError(err);
	}
}
</script>

<template>
	<div class="flex gap-3 overflow-x-auto pb-2 h-full">
		<section
			v-for="status in BOARD_STATUSES"
			:key="status"
			class="w-72 shrink-0 flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60"
			:class="{
				'ring-2 ring-[var(--color-accent)]/60': dragOver === status,
			}"
			@dragover="(e) => onDragOver(e, status)"
			@dragleave="dragOver = null"
			@drop="(e) => onDrop(e, status, null)"
		>
			<header
				class="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]"
			>
				<div class="flex items-center gap-2">
					<component
						:is="STATUS_META[status].icon"
						class="h-3.5 w-3.5"
						:class="STATUS_META[status].text"
					/>
					<h3 class="text-xs uppercase tracking-wider font-semibold text-[var(--color-fg)]">
						{{ STATUS_META[status].label }}
					</h3>
					<span
						class="mono text-[10px] text-[var(--color-fg-subtle)] px-1.5 py-[1px] rounded border border-[var(--color-border)]"
					>
						{{ grouped[status].length }}
					</span>
				</div>
				<button
					class="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors text-lg leading-none px-1"
					title="Add issue"
					@click="emit('newIn', status)"
				>
					+
				</button>
			</header>
			<div
				class="flex-1 flex flex-col gap-2 p-2 overflow-y-auto min-h-[100px]"
			>
				<div
					v-for="(issue, idx) in grouped[status]"
					:key="issue.id"
					draggable="true"
					@dragstart="(e) => onDragStart(e, issue.id)"
					@dragover.stop.prevent
					@drop.stop="(e) => onDrop(e, status, idx)"
				>
					<IssueCard
						:issue="issue"
						:project-key="projectKey"
						@open="(id) => emit('open', id)"
					/>
				</div>
				<div
					v-if="grouped[status].length === 0"
					class="text-center text-xs text-[var(--color-fg-subtle)] py-8"
				>
					no issues
				</div>
			</div>
		</section>
	</div>
</template>
