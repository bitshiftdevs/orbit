<script setup lang="ts">
import { computed, inject, onMounted, ref, type Ref } from "vue";
import { Bookmark, ListChecks, Plus, X } from "lucide-vue-next";
import Avatar from "@/components/ui/Avatar.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import IssueDrawer from "@/components/issue/IssueDrawer.vue";
import NewIssueDialog from "@/components/issue/NewIssueDialog.vue";
import { PRIORITY_META, STATUS_META, TYPE_META } from "@/components/issue/meta";
import { useShortcuts } from "@/composables/useShortcuts";
import {
	api,
	type Issue,
	type IssuePriority,
	type IssueStatus,
	type Project,
	type SessionUser,
	type Sprint,
} from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

const project = inject<Ref<Project | null>>("project")!;
const members = inject<
	Ref<
		Array<
			Pick<
				SessionUser,
				"id" | "name" | "handle" | "email" | "avatarUrl" | "accentColor" | "role"
			>
		>
	>
>("members")!;

const issues = ref<Issue[]>([]);
const sprints = ref<Sprint[]>([]);
const selectedIssueId = ref<string | null>(null);
const newDialog = ref(false);
const filterName = ref("");
const saveFilterOpen = ref(false);

const filter = ref<{
	status: IssueStatus[];
	priority: IssuePriority[];
	assigneeId: string[];
	text: string;
}>({
	status: [],
	priority: [],
	assigneeId: [],
	text: "",
});

type SavedFilter = {
	id: string;
	name: string;
	query: typeof filter.value;
	createdAt: string;
};
const savedFilters = ref<SavedFilter[]>([]);
const activeFilterId = ref<string | null>(null);

const selected = ref<Set<string>>(new Set());
const bulkPatch = ref<{
	status: IssueStatus | "";
	priority: IssuePriority | "";
	assigneeId: string;
	sprintId: string;
}>({ status: "", priority: "", assigneeId: "", sprintId: "" });
const bulkOpen = ref(false);

async function load() {
	if (!project.value) return;
	try {
		const [{ issues: rows }, { filters }, { sprints: sprintRows }] = await Promise.all([
			api.get<{ issues: Issue[] }>(`/projects/${project.value.key}/issues`),
			api.get<{ filters: SavedFilter[] }>(`/projects/${project.value.key}/filters`),
			api.get<{ sprints: Sprint[] }>(`/projects/${project.value.key}/sprints`),
		]);
		issues.value = rows;
		savedFilters.value = filters;
		sprints.value = sprintRows;
	} catch (err) {
		notifyError(err);
	}
}

onMounted(load);

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
	if (!confirm(`Delete filter "${f.name}"?`)) return;
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

async function applyBulk() {
	if (!project.value || !selected.value.size) return;
	const patch: Record<string, unknown> = {};
	if (bulkPatch.value.status) patch.status = bulkPatch.value.status;
	if (bulkPatch.value.priority) patch.priority = bulkPatch.value.priority;
	if (bulkPatch.value.assigneeId)
		patch.assigneeId =
			bulkPatch.value.assigneeId === "__unassign__"
				? null
				: bulkPatch.value.assigneeId;
	if (bulkPatch.value.sprintId)
		patch.sprintId =
			bulkPatch.value.sprintId === "__none__"
				? null
				: bulkPatch.value.sprintId;
	if (!Object.keys(patch).length) return;
	try {
		await api.post<{ updated: number }>(
			`/projects/${project.value.key}/issues/bulk`,
			{ ids: [...selected.value], patch },
		);
		notify(`Updated ${selected.value.size} issues`, "success");
		selected.value = new Set();
		bulkOpen.value = false;
		bulkPatch.value = { status: "", priority: "", assigneeId: "", sprintId: "" };
		await load();
	} catch (err) {
		notifyError(err);
	}
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="flex items-center gap-2 px-8 py-3 border-b border-[var(--color-border)] flex-wrap">
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
			<Button variant="primary" size="sm" @click="newDialog = true">
				<Plus class="h-3.5 w-3.5" />
				New issue
			</Button>
		</div>

		<div
			v-if="savedFilters.length"
			class="flex items-center gap-2 px-8 py-2 border-b border-[var(--color-border)] overflow-x-auto"
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
			class="flex items-center gap-3 px-8 py-2 border-b border-[var(--color-border)] bg-[var(--color-accent-soft)]"
		>
			<ListChecks class="h-4 w-4 text-[var(--color-accent)]" />
			<span class="text-sm text-[var(--color-fg)]">
				{{ selected.size }} selected
			</span>
			<div class="flex-1" />
			<Button size="sm" variant="primary" @click="bulkOpen = true">
				Bulk edit
			</Button>
			<button
				class="text-[11px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
				@click="selected = new Set()"
			>
				Cancel
			</button>
		</div>

		<div class="flex-1 overflow-y-auto px-8 py-4">
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
					<component
						:is="TYPE_META[i.type].icon"
						class="h-3.5 w-3.5 shrink-0"
						:class="TYPE_META[i.type].text"
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
					<component
						:is="STATUS_META[i.status].icon"
						class="h-3.5 w-3.5 shrink-0"
						:class="STATUS_META[i.status].text"
					/>
					<component
						:is="PRIORITY_META[i.priority].icon"
						class="h-3.5 w-3.5 shrink-0"
						:class="PRIORITY_META[i.priority].text"
					/>
					<span
						v-if="i.storyPoints != null"
						class="mono text-[10px] text-[var(--color-fg-subtle)] px-1.5 py-0.5 rounded border border-[var(--color-border)] w-7 text-center"
					>
						{{ i.storyPoints }}
					</span>
					<Avatar
						v-if="i.assignee"
						:name="i.assignee.name"
						:src="i.assignee.avatarUrl"
						:color="i.assignee.accentColor"
						size="xs"
					/>
					<div v-else class="h-5 w-5 rounded-full border border-dashed border-[var(--color-border-strong)]" />
				</div>
				<div
					v-if="!filtered.length"
					class="py-12 text-center text-sm text-[var(--color-fg-subtle)]"
				>
					no matches. try clearing filters, or press <kbd class="mono px-1">c</kbd> to create.
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

		<Dialog v-model:open="bulkOpen" title="Bulk edit" width="440px">
			<div class="p-5 space-y-4">
				<p class="text-xs text-[var(--color-fg-subtle)]">
					Applying to {{ selected.size }} issues. Blank fields are left as-is.
				</p>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Status</label>
					<Select
						v-model="bulkPatch.status"
						:options="[
							{ value: '', label: '— unchanged —' },
							{ value: 'backlog', label: 'Backlog' },
							{ value: 'todo', label: 'Todo' },
							{ value: 'in_progress', label: 'In progress' },
							{ value: 'in_review', label: 'In review' },
							{ value: 'done', label: 'Done' },
							{ value: 'cancelled', label: 'Cancelled' },
						]"
					/>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Priority</label>
					<Select
						v-model="bulkPatch.priority"
						:options="[
							{ value: '', label: '— unchanged —' },
							{ value: 'trivial', label: 'Trivial' },
							{ value: 'low', label: 'Low' },
							{ value: 'medium', label: 'Medium' },
							{ value: 'high', label: 'High' },
							{ value: 'urgent', label: 'Urgent' },
						]"
					/>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Assignee</label>
					<Select
						v-model="bulkPatch.assigneeId"
						:options="[
							{ value: '', label: '— unchanged —' },
							{ value: '__unassign__', label: 'Unassign' },
							...members.map((m) => ({ value: m.id, label: m.name })),
						]"
					/>
				</div>
				<div v-if="sprints.length" class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Sprint</label>
					<Select
						v-model="bulkPatch.sprintId"
						:options="[
							{ value: '', label: '— unchanged —' },
							{ value: '__none__', label: 'Remove from sprint' },
							...sprints.map((s) => ({ value: s.id, label: s.name })),
						]"
					/>
				</div>
			</div>
			<template #footer>
				<Button variant="ghost" @click="bulkOpen = false">Cancel</Button>
				<Button variant="primary" @click="applyBulk">Apply</Button>
			</template>
		</Dialog>
	</div>
</template>
