<script setup lang="ts">
definePageMeta({ name: "project-backlog" });
import { computed, inject, onMounted, ref, watch, type Ref } from "vue";
import { navigateTo } from "nuxt/app";
import { Bookmark, ListChecks, Plus, RefreshCw, X } from "lucide-vue-next";
import Button from "~/components/ui/Button.vue";
import Dialog from "~/components/ui/Dialog.vue";
import Input from "~/components/ui/Input.vue";
import Skeleton from "~/components/ui/Skeleton.vue";
import Spinner from "~/components/ui/Spinner.vue";
import BulkEditDialog from "~/components/issue/BulkEditDialog.vue";
import IssueDrawer from "~/components/issue/IssueDrawer.vue";
import NewIssueDialog from "~/components/issue/NewIssueDialog.vue";
import AssigneePicker from "~/components/issue/inline/AssigneePicker.vue";
import PriorityPicker from "~/components/issue/inline/PriorityPicker.vue";
import StatusPicker from "~/components/issue/inline/StatusPicker.vue";
import TypePicker from "~/components/issue/inline/TypePicker.vue";
import { useShortcuts } from "~/composables/useShortcuts";
import { api } from "~/lib/api";
import type {
	BulkIssuePatch,
	Issue,
	IssueFilterState,
	IssuePriority,
	IssueStatus,
	Project,
	SavedFilter,
	SessionUser,
	Sprint,
} from "~/types/domain";
import { useConfirmDialog } from "~/composables/useConfirmDialog";
import { notify, notifyError } from "~/lib/notify";

const { confirm } = useConfirmDialog();
const project = inject<Ref<Project | null>>("project")!;
const members = inject<
	Ref<Array<Pick<SessionUser, "id" | "name" | "handle" | "email" | "avatarUrl" | "accentColor" | "role">>>
>("members")!;

const issues = ref<Issue[]>([]);
const issueTotal = ref(0);
const issueOffset = ref(0);
const ISSUE_PAGE = 250;
const sprints = ref<Sprint[]>([]);
const selectedIssueId = ref<string | null>(null);
const newDialog = ref(false);
const filterName = ref("");
const saveFilterOpen = ref(false);

const filter = ref<IssueFilterState>({
	status: [],
	priority: [],
	assigneeId: [],
	text: "",
});

const savedFilters = ref<SavedFilter[]>([]);
const activeFilterId = ref<string | null>(null);

const selected = ref<Set<string>>(new Set());
const bulkOpen = ref(false);

const refreshing = ref(false);
const initialLoading = ref(true);

async function load(force = false) {
	if (!project.value) return;
	refreshing.value = true;
	issueOffset.value = 0;
	try {
		const [{ issues: rows, total }, { filters }, { sprints: sprintRows }] = await Promise.all([
			api.get<{ issues: Issue[]; total: number; hasMore: boolean }>(
				`/projects/${project.value.key}/issues?limit=${ISSUE_PAGE}&offset=0`,
				{ force },
			),
			api.get<{ filters: SavedFilter[] }>(`/projects/${project.value.key}/filters`, { force }),
			api.get<{ sprints: Sprint[] }>(`/projects/${project.value.key}/sprints`, { force }),
		]);
		issues.value = rows;
		issueTotal.value = total;
		issueOffset.value = rows.length;
		savedFilters.value = filters;
		sprints.value = sprintRows;
	} catch (err) {
		notifyError(err);
	} finally {
		refreshing.value = false;
		initialLoading.value = false;
	}
}

const loadingMore = ref(false);

async function loadMore() {
	if (!project.value || loadingMore.value) return;
	loadingMore.value = true;
	try {
		const { issues: rows, total } = await api.get<{ issues: Issue[]; total: number; hasMore: boolean }>(
			`/projects/${project.value.key}/issues?limit=${ISSUE_PAGE}&offset=${issueOffset.value}`,
			{ force: true },
		);
		issues.value.push(...rows);
		issueTotal.value = total;
		issueOffset.value += rows.length;
	} catch (err) {
		notifyError(err);
	} finally {
		loadingMore.value = false;
	}
}

onMounted(load);
watch(() => project.value?.key, (key, prev) => { if (key && key !== prev) load(); });

useShortcuts({
	c: () => (newDialog.value = true),
	Escape: () => {
		if (selectedIssueId.value) selectedIssueId.value = null;
		else selected.value = new Set();
	},
});

const filtered = computed(() => {
	const f = filter.value;
	return issues.value.filter((i) => {
		if (f.status.length && !f.status.includes(i.status)) return false;
		if (f.priority.length && !f.priority.includes(i.priority)) return false;
		if (f.assigneeId.length) {
			const a = i.assigneeId ?? "__none__";
			if (!f.assigneeId.includes(a)) return false;
		}
		if (f.text) {
			const q = f.text.toLowerCase();
			if (!i.title.toLowerCase().includes(q) && !i.key.toLowerCase().includes(q))
				return false;
		}
		return true;
	});
});

const activeFilterCount = computed(
	() =>
		filter.value.status.length +
		filter.value.priority.length +
		filter.value.assigneeId.length +
		(filter.value.text ? 1 : 0),
);

function toggleSet<T>(arr: T[], v: T) {
	const idx = arr.indexOf(v);
	if (idx >= 0) arr.splice(idx, 1);
	else arr.push(v);
}

function clearFilters() {
	filter.value = { status: [], priority: [], assigneeId: [], text: "" };
	activeFilterId.value = null;
}

function applyFilter(f: SavedFilter) {
	filter.value = {
		status: f.query.status ?? [],
		priority: f.query.priority ?? [],
		assigneeId: f.query.assigneeId ?? [],
		text: f.query.text ?? "",
	};
	activeFilterId.value = f.id;
}

async function saveFilter() {
	if (!project.value || !filterName.value.trim()) return;
	try {
		const { filter: saved } = await api.post<{ filter: SavedFilter }>(
			`/projects/${project.value.key}/filters`,
			{ name: filterName.value.trim(), query: filter.value },
		);
		savedFilters.value.unshift(saved);
		filterName.value = "";
		saveFilterOpen.value = false;
		notify("Filter saved", "success");
	} catch (err) {
		notifyError(err);
	}
}

async function deleteFilter(f: SavedFilter) {
	if (!await confirm(`Delete filter "${f.name}"?`, { danger: true, confirmText: "Delete" })) return;
	await api.del(`/filters/${f.id}`);
	savedFilters.value = savedFilters.value.filter((x) => x.id !== f.id);
	if (activeFilterId.value === f.id) activeFilterId.value = null;
}

function toggleAll() {
	if (selected.value.size === filtered.value.length) {
		selected.value = new Set();
	} else {
		selected.value = new Set(filtered.value.map((i) => i.id));
	}
}

async function patchRow(row: Issue, body: Record<string, unknown>) {
	try {
		const { issue: updated } = await api.patch<{ issue: Issue }>(`/issues/${row.id}`, body);
		const idx = issues.value.findIndex((x) => x.id === row.id);
		if (idx >= 0) issues.value[idx] = { ...issues.value[idx], ...updated };
	} catch (err) {
		notifyError(err);
	}
}

async function applyBulk(patch: BulkIssuePatch) {
	if (!project.value || !selected.value.size) return;
	const body: Record<string, unknown> = {};
	if (patch.status) body.status = patch.status;
	if (patch.priority) body.priority = patch.priority;
	if (patch.assigneeId)
		body.assigneeId = patch.assigneeId === "__unassign__" ? null : patch.assigneeId;
	if (patch.sprintId)
		body.sprintId = patch.sprintId === "__none__" ? null : patch.sprintId;
	if (!Object.keys(body).length) return;
	try {
		await api.post<{ updated: number }>(
			`/projects/${project.value.key}/issues/bulk`,
			{ ids: [...selected.value], patch: body },
		);
		notify(`Updated ${selected.value.size} issues`, "success");
		selected.value = new Set();
		bulkOpen.value = false;
		await load();
	} catch (err) {
		notifyError(err);
	}
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="flex items-center gap-2 px-4 sm:px-8 py-3 border-b border-[var(--color-border)] flex-wrap">
			<Input
				v-model="filter.text"
				placeholder="Search title or key…"
				class="max-w-[280px]"
			/>
			<div class="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5 text-xs">
				<button
					v-for="s in ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as IssueStatus[]"
					:key="s"
					class="px-2 py-1 rounded capitalize"
					:class="filter.status.includes(s) ? 'bg-[var(--color-panel)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
					@click="toggleSet(filter.status, s)"
				>
					{{ s.replace("_", " ") }}
				</button>
			</div>
			<div class="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5 text-xs">
				<button
					v-for="p in ['urgent', 'high', 'medium', 'low'] as IssuePriority[]"
					:key="p"
					class="px-2 py-1 rounded capitalize"
					:class="filter.priority.includes(p) ? 'bg-[var(--color-panel)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
					@click="toggleSet(filter.priority, p)"
				>
					{{ p }}
				</button>
			</div>

			<button
				v-if="activeFilterCount"
				class="text-[11px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] flex items-center gap-1"
				@click="clearFilters"
			>
				<X class="h-3 w-3" />
				clear
			</button>

			<div class="flex-1" />

			<Button size="sm" variant="outline" @click="saveFilterOpen = true">
				<Bookmark class="h-3.5 w-3.5" />
				Save filter
			</Button>
			<button
				class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)] disabled:opacity-40"
				title="Refresh"
				:disabled="refreshing"
				@click="load(true)"
			>
				<RefreshCw class="h-3.5 w-3.5" :class="refreshing && 'animate-spin'" />
			</button>
			<Button variant="primary" size="sm" @click="newDialog = true">
				<Plus class="h-3.5 w-3.5" />
				New issue
			</Button>
		</div>

		<div
			v-if="savedFilters.length"
			class="flex items-center gap-2 px-4 sm:px-8 py-2 border-b border-[var(--color-border)] overflow-x-auto"
		>
			<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] shrink-0">
				Saved
			</span>
			<button
				v-for="f in savedFilters"
				:key="f.id"
				class="chip cursor-pointer whitespace-nowrap"
				:class="activeFilterId === f.id ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]/40' : 'bg-[var(--color-panel)] text-[var(--color-fg-muted)] border-[var(--color-border)]'"
				@click="applyFilter(f)"
				@dblclick="deleteFilter(f)"
			>
				{{ f.name }}
			</button>
		</div>

		<div
			v-if="selected.size"
			class="flex items-center gap-3 px-4 sm:px-8 py-2 border-b border-[var(--color-border)] bg-[var(--color-accent-soft)]"
		>
			<ListChecks class="h-4 w-4 text-[var(--color-accent)]" />
			<span class="text-sm text-[var(--color-fg)]">{{ selected.size }} selected</span>
			<div class="flex-1" />
			<Button size="sm" variant="primary" @click="bulkOpen = true">Bulk edit</Button>
			<button
				class="text-[11px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
				@click="selected = new Set()"
			>
				Cancel
			</button>
		</div>

		<div class="flex-1 overflow-y-auto px-4 sm:px-8 py-4">
			<div class="card divide-y divide-[var(--color-border)]">
				<div class="px-4 py-2 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
					<input
						type="checkbox"
						:checked="selected.size > 0 && selected.size === filtered.length"
						class="accent-[var(--color-accent)]"
						@change="toggleAll"
					/>
					<span class="w-16">Key</span>
					<span class="flex-1">Title</span>
					<span class="w-24 text-right">Assignee</span>
				</div>
				<template v-if="initialLoading">
					<div
						v-for="n in 8"
						:key="`sk-${n}`"
						class="flex items-center gap-3 px-4 py-2.5"
					>
						<Skeleton width="w-4" height="h-4" />
						<Skeleton circle width="h-3.5 w-3.5" height="h-3.5" />
						<Skeleton width="w-16" height="h-3" />
						<Skeleton width="flex-1" height="h-3.5" />
						<Skeleton circle width="h-5 w-5" height="h-5" />
					</div>
				</template>
				<div
					v-for="i in filtered"
					:key="i.id"
					class="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-panel-hover)] transition-colors"
					:class="{ 'bg-[var(--color-accent-soft)]': selected.has(i.id) }"
				>
					<input
						type="checkbox"
						:checked="selected.has(i.id)"
						class="accent-[var(--color-accent)]"
						@change="selected.has(i.id) ? selected.delete(i.id) : selected.add(i.id); selected = new Set(selected)"
					/>
					<TypePicker
						:model-value="i.type"
						@update:model-value="(v) => patchRow(i, { type: v })"
					/>
					<button
						class="mono text-[11px] text-[var(--color-fg-subtle)] w-16 shrink-0 text-left"
						@click="selectedIssueId = i.id"
					>
						{{ i.key }}
					</button>
					<button
						class="flex-1 truncate text-sm text-left"
						@click="selectedIssueId = i.id"
					>
						{{ i.title }}
					</button>
					<StatusPicker
						:model-value="i.status"
						@update:model-value="(v) => patchRow(i, { status: v })"
					/>
					<PriorityPicker
						:model-value="i.priority"
						@update:model-value="(v) => patchRow(i, { priority: v })"
					/>
					<span
						v-if="i.storyPoints != null"
						class="mono text-[10px] text-[var(--color-fg-subtle)] px-1.5 py-0.5 rounded border border-[var(--color-border)] w-7 text-center"
					>
						{{ i.storyPoints }}
					</span>
					<AssigneePicker
						:model-value="i.assigneeId ?? null"
						:assignee="i.assignee"
						:members="members"
						@update:model-value="(v) => patchRow(i, { assigneeId: v })"
					/>
				</div>
				<div
					v-if="!initialLoading && !filtered.length"
					class="py-12 text-center text-sm text-[var(--color-fg-subtle)]"
				>
					no matches. try clearing filters, or press <kbd class="mono px-1">c</kbd> to create.
				</div>
				<div v-if="issueOffset < issueTotal" class="px-4 py-3 border-t border-[var(--color-border)]">
					<button
						class="text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] disabled:opacity-40 inline-flex items-center gap-2"
						:disabled="loadingMore"
						@click="loadMore"
					>
						<Spinner v-if="loadingMore" size="xs" />
						{{ loadingMore ? "loading…" : `load more (${issueTotal - issueOffset} remaining)` }}
					</button>
				</div>
			</div>
		</div>

		<NewIssueDialog
			v-if="project"
			v-model:open="newDialog"
			:project-key="project.key"
			:members="members"
			:sprints="sprints"
			@created="(i) => issues.push(i)"
		/>
		<IssueDrawer
			:issue-id="selectedIssueId"
			:members="members"
			@close="selectedIssueId = null"
			@updated="(u) => {
				const idx = issues.findIndex((x) => x.id === u.id);
				if (idx >= 0) issues[idx] = { ...issues[idx], ...u };
			}"
			@deleted="(id) => (issues = issues.filter((i) => i.id !== id))"
		/>

		<Dialog v-model:open="saveFilterOpen" title="Save filter" width="380px">
			<div class="p-5 space-y-3">
				<Input v-model="filterName" placeholder="e.g. My urgent bugs" />
			</div>
			<template #footer>
				<Button variant="ghost" @click="saveFilterOpen = false">Cancel</Button>
				<Button variant="primary" @click="saveFilter">Save</Button>
			</template>
		</Dialog>

		<BulkEditDialog
			v-model:open="bulkOpen"
			:selected-count="selected.size"
			:members="members"
			:sprints="sprints"
			@apply="applyBulk"
		/>
	</div>
</template>
