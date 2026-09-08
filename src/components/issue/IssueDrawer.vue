<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { Edit3, Eye, Trash2, X } from "lucide-vue-next";
import Avatar from "@/components/ui/Avatar.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Markdown from "@/components/ui/Markdown.vue";
import MentionTextarea from "@/components/MentionTextarea.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import PrioritySelect from "@/components/issue/PrioritySelect.vue";
import AssigneeSelect from "@/components/issue/AssigneeSelect.vue";
import { api } from "@/lib/api";
import type { Issue, IssueComment, IssueStatus, IssueType, Project, SessionUser, Sprint } from "@/types/domain";
import { notify, notifyError } from "@/lib/notify";
import { timeAgo } from "@/lib/utils";
import { STATUS_META, TYPE_META } from "@/components/issue/meta";

const props = defineProps<{
	issueId: string | null;
	members: Array<Pick<SessionUser, "id" | "name" | "handle" | "avatarUrl" | "accentColor">>;
}>();

const emit = defineEmits<{
	close: [];
	updated: [issue: Issue];
	deleted: [id: string];
}>();

const issue = ref<Issue | null>(null);
const project = ref<Project | null>(null);
const comments = ref<IssueComment[]>([]);
const sprints = ref<Sprint[]>([]);
const loading = ref(false);
const saving = ref(false);
const newComment = ref("");
const editingDescription = ref(false);

type Draft = {
	title: string;
	description: string | null;
	status: IssueStatus;
	priority: Issue["priority"];
	type: IssueType;
	assigneeId: string | null;
	storyPoints: number | null;
	dueAt: string | null;
	sprintId: string | null;
};

const draft = ref<Draft | null>(null);

function initDraft() {
	if (!issue.value) { draft.value = null; return; }
	const i = issue.value;
	draft.value = {
		title: i.title,
		description: i.description ?? null,
		status: i.status,
		priority: i.priority,
		type: i.type,
		assigneeId: i.assigneeId ?? null,
		storyPoints: i.storyPoints ?? null,
		dueAt: i.dueAt ?? null,
		sprintId: i.sprintId ?? null,
	};
}

const isDirty = computed(() => {
	if (!issue.value || !draft.value) return false;
	const d = draft.value;
	const i = issue.value;
	return (
		d.title !== i.title ||
		(d.description ?? null) !== (i.description ?? null) ||
		d.status !== i.status ||
		d.priority !== i.priority ||
		d.type !== i.type ||
		(d.assigneeId ?? null) !== (i.assigneeId ?? null) ||
		(d.storyPoints ?? null) !== (i.storyPoints ?? null) ||
		(d.dueAt ?? null) !== (i.dueAt ?? null) ||
		(d.sprintId ?? null) !== (i.sprintId ?? null)
	);
});

const STATUS_OPTIONS = (Object.keys(STATUS_META) as IssueStatus[]).map((k) => ({
	value: k,
	label: STATUS_META[k].label,
	icon: STATUS_META[k].icon,
	iconClass: STATUS_META[k].text,
}));

const TYPE_OPTIONS = (Object.keys(TYPE_META) as IssueType[]).map((k) => ({
	value: k,
	label: TYPE_META[k].label,
	icon: TYPE_META[k].icon,
	iconClass: TYPE_META[k].text,
}));

const { confirm } = useConfirmDialog();

watch(
	() => props.issueId,
	async (id) => {
		if (!id) {
			issue.value = null;
			draft.value = null;
			return;
		}
		loading.value = true;
		try {
			const res = await api.get<{
				issue: Issue;
				project: Project;
				comments: IssueComment[];
			}>(`/issues/${id}`);
			issue.value = res.issue;
			project.value = res.project;
			comments.value = res.comments;
			initDraft();
			const { sprints: rows } = await api.get<{ sprints: Sprint[] }>(
				`/projects/${res.project.key}/sprints`,
			);
			sprints.value = rows;
		} catch (err) {
			notifyError(err);
			emit("close");
		} finally {
			loading.value = false;
		}
	},
	{ immediate: true },
);

async function save() {
	if (!issue.value || !draft.value || !isDirty.value) return;
	saving.value = true;
	try {
		const { issue: updated } = await api.patch<{ issue: Issue }>(
			`/issues/${issue.value.id}`,
			{
				title: draft.value.title,
				description: draft.value.description,
				status: draft.value.status,
				priority: draft.value.priority,
				type: draft.value.type,
				assigneeId: draft.value.assigneeId,
				storyPoints: draft.value.storyPoints,
				dueAt: draft.value.dueAt,
				sprintId: draft.value.sprintId,
			},
		);
		issue.value = { ...updated, key: issue.value.key };
		initDraft();
		editingDescription.value = false;
		emit("updated", issue.value);
		notify("Issue saved", "success");
	} catch (err) {
		notifyError(err);
	} finally {
		saving.value = false;
	}
}

function discard() {
	initDraft();
	editingDescription.value = false;
}

async function submitComment() {
	if (!issue.value || !newComment.value.trim()) return;
	try {
		const { comment } = await api.post<{ comment: IssueComment }>(
			`/issues/${issue.value.id}/comments`,
			{ body: newComment.value.trim() },
		);
		comments.value.push(comment);
		newComment.value = "";
	} catch (err) {
		notifyError(err);
	}
}

async function remove() {
	if (!issue.value) return;
	if (!await confirm(`Delete ${issue.value.key}?`, { danger: true, confirmText: "Delete" })) return;
	try {
		await api.del(`/issues/${issue.value.id}`);
		emit("deleted", issue.value.id);
		emit("close");
		notify("Issue deleted", "success");
	} catch (err) {
		notifyError(err);
	}
}
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-150"
			enter-from-class="opacity-0"
			leave-active-class="transition-opacity duration-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="issueId"
				class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
				@click="emit('close')"
			/>
		</Transition>
		<Transition
			enter-active-class="transition-transform duration-200 ease-out"
			enter-from-class="translate-x-full"
			leave-active-class="transition-transform duration-150 ease-in"
			leave-to-class="translate-x-full"
		>
			<aside
				v-if="issueId"
				class="fixed right-0 top-0 z-50 h-full w-full sm:w-[640px] bg-[var(--color-bg)] border-l border-[var(--color-border)] flex flex-col"
			>
				<header
					class="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3 gap-3"
				>
					<span class="mono text-xs text-[var(--color-fg-subtle)] shrink-0">
						{{ issue?.key ?? "…" }}
					</span>

					<div class="flex items-center gap-1 ml-auto">
						<template v-if="isDirty && draft">
							<span class="text-[11px] text-[var(--color-fg-subtle)] mr-1">Unsaved changes</span>
							<Button variant="ghost" size="sm" @click="discard">Discard</Button>
							<Button variant="primary" size="sm" :loading="saving" @click="save">Save</Button>
						</template>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
							title="Delete"
							@click="remove"
						>
							<Trash2 class="h-4 w-4" />
						</button>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel-hover)]"
							@click="emit('close')"
						>
							<X class="h-4 w-4" />
						</button>
					</div>
				</header>

				<div v-if="loading || !issue || !draft" class="flex-1 flex items-center justify-center text-sm text-[var(--color-fg-subtle)]">
					loading…
				</div>

				<div v-else class="flex-1 overflow-y-auto p-5 space-y-5">
					<div>
						<input
							v-model="draft.title"
							class="w-full bg-transparent text-xl font-semibold text-[var(--color-fg)] outline-none focus:bg-[var(--color-panel)] rounded px-2 -mx-2 py-1"
						/>
					</div>

					<div class="grid grid-cols-2 gap-3 text-xs">
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Status</span>
							<Select
								:model-value="draft.status"
								:options="STATUS_OPTIONS"
								@update:model-value="(v) => draft!.status = v as IssueStatus"
							/>
						</label>
						<div class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Priority</span>
							<PrioritySelect
								:model-value="draft.priority"
								@update:model-value="(v) => draft!.priority = v"
							/>
						</div>
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Type</span>
							<Select
								:model-value="draft.type"
								:options="TYPE_OPTIONS"
								@update:model-value="(v) => draft!.type = v as IssueType"
							/>
						</label>
						<div class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Assignee</span>
							<AssigneeSelect
								:model-value="draft.assigneeId"
								:members="members"
								@update:model-value="(v) => draft!.assigneeId = v"
							/>
						</div>
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Story points</span>
							<Input
								type="number"
								:model-value="draft.storyPoints ?? ''"
								@update:model-value="(v) => draft!.storyPoints = (v === '' ? null : Number(v))"
							/>
						</label>
						<div class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Due</span>
							<DatePicker
								:model-value="draft.dueAt ? draft.dueAt.slice(0, 10) : ''"
								@update:model-value="(v) => draft!.dueAt = (v ? new Date(v).toISOString() : null)"
							/>
						</div>
						<label class="space-y-1 col-span-2">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Sprint</span>
							<Select
								:model-value="draft.sprintId ?? ''"
								:options="[
									{ value: '', label: '— no sprint —' },
									...sprints.map((s) => ({ value: s.id, label: s.name })),
								]"
								@update:model-value="(v) => draft!.sprintId = (v || null)"
							/>
						</label>
					</div>

					<div>
						<div class="flex items-center justify-between mb-2">
							<h3 class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
								Description
							</h3>
							<button
								class="p-1 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel-hover)]"
								:title="editingDescription ? 'Preview' : 'Edit'"
								@click="editingDescription = !editingDescription"
							>
								<component
									:is="editingDescription ? Eye : Edit3"
									class="h-3.5 w-3.5"
								/>
							</button>
						</div>
						<Textarea
							v-if="editingDescription || !draft.description"
							v-model="draft.description"
							:rows="8"
							placeholder="Markdown supported. **bold**, `code`, - lists, @mentions…"
							class="mono"
							@change="editingDescription = false"
						/>
						<div
							v-else
							class="card p-3 cursor-text"
							@click="editingDescription = true"
						>
							<Markdown :source="draft.description" />
						</div>
					</div>

					<div>
						<h3 class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-2">
							Activity
						</h3>
						<ul class="space-y-3">
							<li v-for="c in comments" :key="c.id" class="flex gap-3">
								<Avatar
									:name="c.author.name"
									:src="c.author.avatarUrl"
									:color="c.author.accentColor"
									size="sm"
								/>
								<div class="flex-1">
									<div class="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
										<span class="font-medium text-[var(--color-fg)]">{{ c.author.name }}</span>
										<span>·</span>
										<span>{{ timeAgo(c.createdAt) }}</span>
									</div>
									<Markdown :source="c.body" class="mt-1" />
								</div>
							</li>
						</ul>
					</div>
				</div>

				<footer v-if="issue" class="border-t border-[var(--color-border)] p-4">
					<MentionTextarea
						v-model="newComment"
						:members="members"
						placeholder="Add a comment · @mention teammates · **markdown** supported"
						:rows="2"
					/>
					<div class="flex justify-end mt-2">
						<Button variant="primary" size="sm" @click="submitComment" :disabled="!newComment.trim()">
							Comment
						</Button>
					</div>
				</footer>
			</aside>
		</Transition>
	</Teleport>
</template>
