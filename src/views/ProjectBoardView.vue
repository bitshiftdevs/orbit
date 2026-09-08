<script setup lang="ts">
import { computed, inject, onMounted, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import IssueDrawer from "@/components/issue/IssueDrawer.vue";
import KanbanBoard from "@/components/issue/KanbanBoard.vue";
import NewIssueDialog from "@/components/issue/NewIssueDialog.vue";
import { useShortcuts } from "@/composables/useShortcuts";
import { api, type Issue, type IssueStatus, type Project, type SessionUser, type Sprint } from "@/lib/api";
import { notifyError } from "@/lib/notify";

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
const boardIssues = computed(() =>
	activeSprint.value
		? issues.value.filter((i) => i.sprintId === activeSprint.value!.id)
		: issues.value,
);
const newDialog = ref(false);
const newStatus = ref<IssueStatus>("todo");

async function load() {
	if (!project.value) return;
	try {
		const [{ issues: rows }, { sprints: sprintRows }] = await Promise.all([
			api.get<{ issues: Issue[] }>(`/projects/${project.value.key}/issues`),
			api.get<{ sprints: Sprint[] }>(`/projects/${project.value.key}/sprints`),
		]);
		issues.value = rows;
		sprints.value = sprintRows;
	} catch (err) {
		notifyError(err);
	}
}

onMounted(load);

const route = useRoute();
const router = useRouter();

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
	router.replace({
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
			<Button variant="primary" size="sm" @click="newIn('todo')">
				<Plus class="h-3.5 w-3.5" />
				New issue
			</Button>
		</div>
		<div v-if="project" class="flex-1 overflow-hidden px-8 py-4">
			<KanbanBoard
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
