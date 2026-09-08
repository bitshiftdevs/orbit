<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Edit3, Eye, Trash2, X } from "lucide-vue-next";
import Avatar from "@/components/ui/Avatar.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Markdown from "@/components/ui/Markdown.vue";
import MentionTextarea from "@/components/MentionTextarea.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { api, type Issue, type IssuePriority, type IssueStatus, type IssueType, type Project, type SessionUser, type Sprint } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { timeAgo } from "@/lib/utils";

const props = defineProps<{
	issueId: string | null;
	members: Array<Pick<SessionUser, "id" | "name" | "handle" | "avatarUrl" | "accentColor">>;
}>();

const emit = defineEmits<{
	close: [];
	updated: [issue: Issue];
	deleted: [id: string];
}>();

type Comment = {
	id: string;
	body: string;
	createdAt: string;
	author: { id: string; name: string; handle: string; avatarUrl: string | null; accentColor: string };
};

const issue = ref<Issue | null>(null);
const project = ref<Project | null>(null);
const comments = ref<Comment[]>([]);
const sprints = ref<Sprint[]>([]);
const loading = ref(false);
const newComment = ref("");
const editingDescription = ref(false);

const STATUS_OPTIONS = [
	{ value: "backlog", label: "Backlog" },
	{ value: "todo", label: "Todo" },
	{ value: "in_progress", label: "In progress" },
	{ value: "in_review", label: "In review" },
	{ value: "done", label: "Done" },
	{ value: "cancelled", label: "Cancelled" },
];
const PRIORITY_OPTIONS = [
	{ value: "trivial", label: "Trivial" },
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
	{ value: "urgent", label: "Urgent" },
];
const TYPE_OPTIONS = [
	{ value: "task", label: "Task" },
	{ value: "bug", label: "Bug" },
	{ value: "story", label: "Story" },
	{ value: "chore", label: "Chore" },
	{ value: "epic", label: "Epic" },
];

const assigneeOptions = computed(() => [
	{ value: "", label: "Unassigned" },
	...props.members.map((m) => ({ value: m.id, label: m.name })),
]);

watch(
	() => props.issueId,
	async (id) => {
		if (!id) {
			issue.value = null;
			return;
		}
		loading.value = true;
		try {
			const res = await api.get<{
				issue: Issue;
				project: Project;
				comments: Comment[];
			}>(`/issues/${id}`);
			issue.value = res.issue;
			project.value = res.project;
			comments.value = res.comments;
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

async function patch<K extends keyof Issue>(key: K, value: Issue[K]) {
	if (!issue.value) return;
	try {
		const { issue: updated } = await api.patch<{ issue: Issue }>(
			`/issues/${issue.value.id}`,
			{ [key]: value },
		);
		issue.value = { ...updated, key: issue.value.key, assignee: issue.value.assignee };
		emit("updated", issue.value);
	} catch (err) {
		notifyError(err);
	}
}

async function submitComment() {
	if (!issue.value || !newComment.value.trim()) return;
	try {
		const { comment } = await api.post<{ comment: Comment }>(
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
	if (!confirm(`Delete ${issue.value.key}?`)) return;
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
					class="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3"
				>
					<div class="flex items-center gap-3">
						<span class="mono text-xs text-[var(--color-fg-subtle)]">
							{{ issue?.key ?? "…" }}
						</span>
					</div>
					<div class="flex items-center gap-1">
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

				<div v-if="loading || !issue" class="flex-1 flex items-center justify-center text-sm text-[var(--color-fg-subtle)]">
					loading…
				</div>

				<div v-else class="flex-1 overflow-y-auto p-5 space-y-5">
					<div>
						<input
							v-model="issue.title"
							class="w-full bg-transparent text-xl font-semibold text-[var(--color-fg)] outline-none focus:bg-[var(--color-panel)] rounded px-2 -mx-2 py-1"
							@change="patch('title', issue.title)"
						/>
					</div>

					<div class="grid grid-cols-2 gap-3 text-xs">
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Status</span>
							<Select
								:model-value="issue.status"
								:options="STATUS_OPTIONS"
								@update:model-value="(v) => patch('status', v as IssueStatus)"
							/>
						</label>
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Priority</span>
							<Select
								:model-value="issue.priority"
								:options="PRIORITY_OPTIONS"
								@update:model-value="(v) => patch('priority', v as IssuePriority)"
							/>
						</label>
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Type</span>
							<Select
								:model-value="issue.type"
								:options="TYPE_OPTIONS"
								@update:model-value="(v) => patch('type', v as IssueType)"
							/>
						</label>
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Assignee</span>
							<Select
								:model-value="issue.assigneeId ?? ''"
								:options="assigneeOptions"
								@update:model-value="(v) => patch('assigneeId', (v || null) as any)"
							/>
						</label>
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Story points</span>
							<Input
								type="number"
								:model-value="issue.storyPoints ?? ''"
								@update:model-value="(v) => patch('storyPoints', v === '' ? null : Number(v))"
							/>
						</label>
						<label class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Due</span>
							<Input
								type="date"
								:model-value="issue.dueAt ? issue.dueAt.slice(0, 10) : ''"
								@update:model-value="(v) => patch('dueAt', v ? new Date(v).toISOString() : null)"
							/>
						</label>
						<label class="space-y-1 col-span-2">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Sprint</span>
							<Select
								:model-value="issue.sprintId ?? ''"
								:options="[
									{ value: '', label: '— no sprint —' },
									...sprints.map((s) => ({ value: s.id, label: s.name })),
								]"
								@update:model-value="(v) => patch('sprintId', (v || null) as any)"
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
							v-if="editingDescription || !issue.description"
							v-model="issue.description"
							:rows="8"
							placeholder="Markdown supported. **bold**, `code`, - lists, @mentions…"
							class="mono"
							@change="patch('description', issue!.description); editingDescription = false"
						/>
						<div
							v-else
							class="card p-3 cursor-text"
							@click="editingDescription = true"
						>
							<Markdown :source="issue.description" />
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
