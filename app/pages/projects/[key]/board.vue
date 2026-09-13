<script setup lang="ts">
definePageMeta({ name: "project-board" });
import { computed, inject, onMounted, ref, watch, type Ref } from "vue";
import { useRoute, navigateTo } from "nuxt/app";
import { Plus, RefreshCw } from "lucide-vue-next";
import Button from "~/components/ui/Button.vue";
import Skeleton from "~/components/ui/Skeleton.vue";
import IssueDrawer from "~/components/issue/IssueDrawer.vue";
import KanbanBoard from "~/components/issue/KanbanBoard.vue";
import NewIssueDialog from "~/components/issue/NewIssueDialog.vue";
import { BOARD_STATUSES, STATUS_META } from "~/components/issue/meta";
import { useShortcuts } from "~/composables/useShortcuts";
import { api, type Issue, type IssueStatus, type Project, type SessionUser, type Sprint } from "~/lib/api";
import { notifyError } from "~/lib/notify";

const project = inject<Ref<Project | null>>("project")!;
const members = inject<
	Ref<
		Array<
			Pick<SessionUser, "id" | "name" | "handle" | "email" | "avatarUrl" | "accentColor" | "role">
		>
	>
>("members")!;

const issues = ref<Issue[]>([]);
const sprints = ref<Sprint[]>([]);
const selectedIssueId = ref<string | null>(null);

const activeSprint = computed(() => sprints.value.find((s) => s.status === "active") ?? null);
const boardIssues = computed(() => {
	const all = issues.value ?? [];
	return activeSprint.value
		? all.filter((i) => i.sprintId === activeSprint.value!.id)
		: all;
});
const newDialog = ref(false);
const newStatus = ref<IssueStatus>("todo");
const refreshing = ref(false);
const initialLoading = ref(true);

async function load(force = false) {
	if (!project.value) return;
	refreshing.value = true;
	try {
		const [{ issues: rows }, { sprints: sprintRows }] = await Promise.all([
			api.get<{ issues: Issue[] }>(`/projects/${project.value.key}/issues`, { force }),
			api.get<{ sprints: Sprint[] }>(`/projects/${project.value.key}/sprints`, { force }),
		]);
		issues.value = rows;
		sprints.value = sprintRows;
	} catch (err) {
		notifyError(err);
	} finally {
		refreshing.value = false;
		initialLoading.value = false;
	}
}

onMounted(load);
watch(() => project.value?.key, (key, prev) => { if (key && key !== prev) load(); });

const route = useRoute();

// Sync ?issue=<id> query to drawer state so notification links & search open
// the right card.
watch(
	() => route.query.issue,
	(v) => {
		selectedIssueId.value = typeof v === "string" ? v : null;
	},
	{ immediate: true },
);
watch(selectedIssueId, (v) => {
	const current = route.query.issue;
	if (v === current) return;
	navigateTo({
		query: v ? { ...route.query, issue: v } : { ...route.query, issue: undefined },
	});
});

useShortcuts({
	c: () => newIn("todo"),
	Escape: () => {
		if (selectedIssueId.value) selectedIssueId.value = null;
	},
});

function onChanged(u: Issue) {
	const i = issues.value.findIndex((x) => x.id === u.id);
	if (i >= 0) {
		issues.value[i] = { ...issues.value[i], ...u };
	}
}

function onCreated(issue: Issue) {
	issues.value.push(issue);
}

function onDeleted(id: string) {
	issues.value = issues.value.filter((i) => i.id !== id);
}

function newIn(status: IssueStatus) {
	newStatus.value = status;
	newDialog.value = true;
}
</script>

<template>
	<div class="h-full flex flex-col">
		<div class="flex items-center justify-between px-8 py-3 border-b border-[var(--color-border)]">
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-[var(--color-fg)]">
					{{ activeSprint ? activeSprint.name : "All issues" }}
				</span>
				<span v-if="activeSprint" class="chip bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]/30 text-[10px]">
					active sprint
				</span>
				<span v-else class="text-xs text-[var(--color-fg-subtle)]">no active sprint</span>
				<span class="text-xs text-[var(--color-fg-subtle)]">· {{ boardIssues.length }} issues</span>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)] disabled:opacity-40"
					title="Refresh"
					:disabled="refreshing"
					@click="load(true)"
				>
					<RefreshCw class="h-3.5 w-3.5" :class="refreshing && 'animate-spin'" />
				</button>
				<Button variant="primary" size="sm" @click="newIn('todo')">
					<Plus class="h-3.5 w-3.5" />
					New issue
				</Button>
			</div>
		</div>
		<div v-if="project" class="flex-1 overflow-hidden px-8 py-4">
			<div v-if="initialLoading" class="flex gap-3 overflow-x-auto pb-2 h-full">
				<section
					v-for="status in BOARD_STATUSES"
					:key="status"
					class="w-72 shrink-0 flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60"
				>
					<div class="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)]">
						<component
							:is="STATUS_META[status].icon"
							class="h-3.5 w-3.5"
							:class="STATUS_META[status].text"
						/>
						<span class="text-xs font-medium text-[var(--color-fg-muted)]">
							{{ STATUS_META[status].label }}
						</span>
					</div>
					<div class="flex-1 p-2 space-y-2">
						<div
							v-for="n in 3"
							:key="n"
							class="card p-3 space-y-2.5"
						>
							<Skeleton width="w-20" height="h-2.5" />
							<Skeleton :lines="2" height="h-3" />
							<div class="flex items-center gap-2 pt-1">
								<Skeleton circle width="h-5 w-5" height="h-5" />
								<Skeleton width="w-12" height="h-2.5" />
							</div>
						</div>
					</div>
				</section>
			</div>
			<KanbanBoard
				v-else
				:issues="boardIssues"
				:project-key="project.key"
				@open="(id) => (selectedIssueId = id)"
				@changed="onChanged"
				@new-in="newIn"
			/>
		</div>

		<NewIssueDialog
			v-if="project"
			v-model:open="newDialog"
			:project-key="project.key"
			:default-status="newStatus"
			:default-sprint-id="activeSprint?.id"
			:members="members"
			:sprints="sprints"
			@created="onCreated"
		/>
		<IssueDrawer
			:issue-id="selectedIssueId"
			:members="members"
			@close="selectedIssueId = null"
			@updated="onChanged"
			@deleted="onDeleted"
		/>
	</div>
</template>
