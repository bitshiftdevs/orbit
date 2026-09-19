<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useConfirmDialog } from "~/composables/useConfirmDialog";
import { Link2, Plus, Trash2, X } from "lucide-vue-next";
import Avatar from "~/components/ui/Avatar.vue";
import Badge from "~/components/ui/Badge.vue";
import Button from "~/components/ui/Button.vue";
import Input from "~/components/ui/Input.vue";
import TiptapEditor from "~/components/ui/TiptapEditor.vue";
import Select from "~/components/ui/Select.vue";
import Spinner from "~/components/ui/Spinner.vue";
import DatePicker from "~/components/ui/DatePicker.vue";
import PrioritySelect from "~/components/issue/PrioritySelect.vue";
import AssigneeSelect from "~/components/issue/AssigneeSelect.vue";
import { api } from "~/lib/api";
import type { Issue, IssueComment, IssueLink, IssueLinkKind, IssueStatus, IssueType, Project, SessionUser, Sprint } from "~/types/domain";
import { notify, notifyError } from "~/lib/notify";
import { timeAgo } from "~/lib/utils";
import { STATUS_META, TYPE_META } from "~/components/issue/meta";

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
	prUrl: string | null;
};

const draft = ref<Draft | null>(null);
const links = ref<IssueLink[]>([]);
const addLinkOpen = ref(false);
const newLinkTargetKey = ref("");
const newLinkKind = ref<IssueLinkKind>("relates_to");
const addingLink = ref(false);

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
		prUrl: i.prUrl ?? null,
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
		(d.sprintId ?? null) !== (i.sprintId ?? null) ||
		(d.prUrl ?? null) !== (i.prUrl ?? null)
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
			const [{ sprints: rows }, { links: linkRows }] = await Promise.all([
				api.get<{ sprints: Sprint[] }>(`/projects/${res.project.key}/sprints`),
				api.get<{ links: IssueLink[] }>(`/issues/${id}/links`),
			]);
			sprints.value = rows ?? [];
			links.value = linkRows ?? [];
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
				prUrl: draft.value.prUrl,
			},
		);
		issue.value = { ...updated, key: issue.value.key };
		initDraft();
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

async function addLink() {
	if (!issue.value || !newLinkTargetKey.value.trim()) return;
	addingLink.value = true;
	try {
		// Resolve the issue key to an ID via search
		const { issues: found } = await api.get<{ issues: Array<{ id: string; key: string }> }>(
			`/search?q=${encodeURIComponent(newLinkTargetKey.value.trim())}`,
		);
		const target = found.find(
			(x) => x.key.toLowerCase() === newLinkTargetKey.value.trim().toLowerCase(),
		);
		if (!target) {
			notify(`Issue "${newLinkTargetKey.value}" not found`, "error");
			return;
		}
		await api.post(`/issues/${issue.value.id}/links`, {
			targetId: target.id,
			kind: newLinkKind.value,
		});
		const { links: linkRows } = await api.get<{ links: IssueLink[] }>(
			`/issues/${issue.value.id}/links`,
			{ force: true },
		);
		links.value = linkRows;
		newLinkTargetKey.value = "";
		addLinkOpen.value = false;
	} catch (err) {
		notifyError(err);
	} finally {
		addingLink.value = false;
	}
}

async function removeLink(linkId: string) {
	try {
		await api.del(`/issues/links/${linkId}`);
		links.value = links.value.filter((l) => l.id !== linkId);
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

				<div v-if="loading || !issue || !draft" class="flex-1 flex items-center justify-center">
					<Spinner size="lg" label="Loading issue…" />
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
						<div class="space-y-1">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">Reporter</span>
							<div v-if="issue.reporter" class="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--color-panel)] text-[var(--color-fg)]">
								<Avatar
									:name="issue.reporter.name"
									:src="issue.reporter.avatarUrl"
									:color="issue.reporter.accentColor"
									size="xs"
								/>
								<span class="truncate">{{ issue.reporter.name }}</span>
							</div>
							<div v-else class="px-2 py-1.5 rounded bg-[var(--color-panel)] text-[var(--color-fg-subtle)] italic">
								Unknown
							</div>
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
						<label v-if="project?.repoUrl" class="space-y-1 col-span-2">
							<span class="uppercase tracking-wider text-[var(--color-fg-subtle)]">PR / branch URL</span>
							<Input
								v-model="draft.prUrl"
								placeholder="https://github.com/…/pull/42"
							/>
						</label>
					</div>

					<!-- Issue links -->
					<div>
						<div class="flex items-center justify-between mb-2">
							<h3 class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Links</h3>
							<button
								class="flex items-center gap-1 text-[11px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
								@click="addLinkOpen = !addLinkOpen"
							>
								<Plus class="h-3 w-3" />
								Add
							</button>
						</div>
						<div v-if="addLinkOpen" class="flex items-center gap-2 mb-2">
							<Select
								:model-value="newLinkKind"
								:options="[
									{ value: 'blocks', label: 'blocks' },
									{ value: 'duplicates', label: 'duplicates' },
									{ value: 'relates_to', label: 'relates to' },
								]"
								class="w-32"
								@update:model-value="(v) => newLinkKind = v as IssueLinkKind"
							/>
							<Input
								v-model="newLinkTargetKey"
								placeholder="ORB-42"
								class="flex-1"
								@keydown.enter="addLink"
							/>
							<Button size="sm" variant="primary" :loading="addingLink" @click="addLink">Link</Button>
						</div>
						<ul v-if="links.length" class="space-y-1.5">
							<li
								v-for="l in links"
								:key="l.id"
								class="flex items-center gap-2 text-xs"
							>
								<span class="text-[var(--color-fg-subtle)] w-20 shrink-0 italic">{{ l.kind.replace(/_/g, " ") }}</span>
								<component :is="TYPE_META[l.linked.type].icon" class="h-3.5 w-3.5 shrink-0" :class="TYPE_META[l.linked.type].text" />
								<span class="mono text-[var(--color-fg-subtle)]">{{ l.linked.key }}</span>
								<span class="flex-1 truncate text-[var(--color-fg)]">{{ l.linked.title }}</span>
								<button
									class="p-0.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400"
									@click="removeLink(l.id)"
								>
									<X class="h-3 w-3" />
								</button>
							</li>
						</ul>
						<div v-else-if="!addLinkOpen" class="text-[12px] text-[var(--color-fg-subtle)]">No links.</div>
					</div>

					<div>
						<h3 class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-2">
							Description
						</h3>
						<TiptapEditor
							v-model="draft.description"
							:members="members"
							placeholder="Add a description… @mention teammates"
						/>
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
									<TiptapEditor :model-value="c.body" :readonly="true" class="mt-1" />
								</div>
							</li>
						</ul>
					</div>
				</div>

				<footer v-if="issue" class="border-t border-[var(--color-border)] p-4">
					<TiptapEditor
						v-model="newComment"
						:members="members"
						placeholder="Add a comment · @mention teammates"
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
