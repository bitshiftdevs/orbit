<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { api, type Issue, type IssueStatus, type SessionUser, type Sprint } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { STATUS_META, TYPE_META, PRIORITY_META } from "@/components/issue/meta";
import type { IssueType, IssuePriority } from "@/types/domain";

const props = defineProps<{
	open: boolean;
	projectKey: string;
	defaultStatus?: IssueStatus;
	defaultSprintId?: string;
	members: Array<Pick<SessionUser, "id" | "name">>;
	sprints?: Sprint[];
}>();

const emit = defineEmits<{
	"update:open": [value: boolean];
	created: [issue: Issue];
}>();

const title = ref("");
const description = ref("");
const type = ref("task");
const priority = ref("medium");
const status = ref<IssueStatus>("todo");
const assigneeId = ref("");
const sprintId = ref("");
const saving = ref(false);

const TYPE_OPTIONS = (Object.keys(TYPE_META) as IssueType[]).map((k) => ({
	value: k,
	label: TYPE_META[k].label,
	icon: TYPE_META[k].icon,
	iconClass: TYPE_META[k].text,
}));

const PRIORITY_OPTIONS = (Object.keys(PRIORITY_META) as IssuePriority[]).map((k) => ({
	value: k,
	label: PRIORITY_META[k].label,
	icon: PRIORITY_META[k].icon,
	iconClass: PRIORITY_META[k].text,
}));

const STATUS_OPTIONS = (["backlog", "todo", "in_progress", "in_review"] as IssueStatus[]).map((k) => ({
	value: k,
	label: STATUS_META[k].label,
	icon: STATUS_META[k].icon,
	iconClass: STATUS_META[k].text,
}));

watch(
	() => props.open,
	(v) => {
		if (v) {
			title.value = "";
			description.value = "";
			type.value = "task";
			priority.value = "medium";
			status.value = props.defaultStatus ?? "todo";
			assigneeId.value = "";
			sprintId.value = props.defaultSprintId ?? "";
		}
	},
);

async function submit() {
	if (!title.value.trim()) return;
	saving.value = true;
	try {
		const { issue } = await api.post<{ issue: Issue }>(
			`/projects/${props.projectKey}/issues`,
			{
				title: title.value.trim(),
				description: description.value || undefined,
				type: type.value,
				priority: priority.value,
				status: status.value,
				assigneeId: assigneeId.value || null,
				sprintId: sprintId.value || null,
			},
		);
		emit("created", issue);
		emit("update:open", false);
		notify(`Created ${issue.key}`, "success");
	} catch (err) {
		notifyError(err);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<Dialog
		:open="open"
		title="New issue"
		width="560px"
		@update:open="emit('update:open', $event)"
	>
		<div class="p-5 space-y-4">
			<div class="space-y-1">
				<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Title</label>
				<Input v-model="title" placeholder="What needs doing?" autofocus />
			</div>
			<div class="space-y-1">
				<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Description</label>
				<Textarea v-model="description" :rows="4" placeholder="Add details, links, acceptance criteria…" />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<label class="space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Type</span>
					<Select v-model="type" :options="TYPE_OPTIONS" />
				</label>
				<label class="space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Priority</span>
					<Select v-model="priority" :options="PRIORITY_OPTIONS" />
				</label>
				<label class="space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Status</span>
					<Select v-model="status" :options="STATUS_OPTIONS" />
				</label>
				<label class="space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Assignee</span>
					<Select
						v-model="assigneeId"
						:options="[
							{ value: '', label: 'Unassigned' },
							...members.map((m) => ({ value: m.id, label: m.name })),
						]"
					/>
				</label>
				<label v-if="sprints?.length" class="space-y-1 col-span-2">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Sprint</span>
					<Select
						v-model="sprintId"
						:options="[
							{ value: '', label: '— no sprint —' },
							...sprints.map((s) => ({ value: s.id, label: s.name })),
						]"
					/>
				</label>
			</div>
		</div>
		<template #footer>
			<Button variant="ghost" @click="emit('update:open', false)">Cancel</Button>
			<Button variant="primary" :loading="saving" @click="submit">Create issue</Button>
		</template>
	</Dialog>
</template>
