<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { api, type Issue, type IssueStatus, type SessionUser } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

const props = defineProps<{
	open: boolean;
	projectKey: string;
	defaultStatus?: IssueStatus;
	members: Array<Pick<SessionUser, "id" | "name">>;
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
const saving = ref(false);

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
					<Select
						v-model="type"
						:options="[
							{ value: 'task', label: 'Task' },
							{ value: 'bug', label: 'Bug' },
							{ value: 'story', label: 'Story' },
							{ value: 'chore', label: 'Chore' },
							{ value: 'epic', label: 'Epic' },
						]"
					/>
				</label>
				<label class="space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Priority</span>
					<Select
						v-model="priority"
						:options="[
							{ value: 'trivial', label: 'Trivial' },
							{ value: 'low', label: 'Low' },
							{ value: 'medium', label: 'Medium' },
							{ value: 'high', label: 'High' },
							{ value: 'urgent', label: 'Urgent' },
						]"
					/>
				</label>
				<label class="space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Status</span>
					<Select
						v-model="status"
						:options="[
							{ value: 'backlog', label: 'Backlog' },
							{ value: 'todo', label: 'Todo' },
							{ value: 'in_progress', label: 'In progress' },
							{ value: 'in_review', label: 'In review' },
						]"
					/>
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
			</div>
		</div>
		<template #footer>
			<Button variant="ghost" @click="emit('update:open', false)">Cancel</Button>
			<Button variant="primary" :loading="saving" @click="submit">Create issue</Button>
		</template>
	</Dialog>
</template>
