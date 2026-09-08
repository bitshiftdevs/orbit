<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Select from "@/components/ui/Select.vue";
import type { BulkIssuePatch, IssuePriority, IssueStatus, SessionUser, Sprint } from "@/types/domain";

const props = defineProps<{
	open: boolean;
	selectedCount: number;
	members: Array<Pick<SessionUser, "id" | "name">>;
	sprints: Sprint[];
}>();

const emit = defineEmits<{
	"update:open": [value: boolean];
	apply: [patch: BulkIssuePatch];
}>();

const blank: BulkIssuePatch = { status: "", priority: "", assigneeId: "", sprintId: "" };
const patch = ref<BulkIssuePatch>({ ...blank });

watch(() => props.open, (v) => {
	if (v) patch.value = { ...blank };
});

function apply() {
	emit("apply", { ...patch.value });
	emit("update:open", false);
}
</script>

<template>
	<Dialog :open="open" title="Bulk edit" width="440px" @update:open="emit('update:open', $event)">
		<div class="p-5 space-y-4">
			<p class="text-xs text-[var(--color-fg-subtle)]">
				Applying to {{ selectedCount }} issues. Blank fields are left as-is.
			</p>
			<div class="space-y-1">
				<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Status</label>
				<Select
					v-model="patch.status"
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
					v-model="patch.priority"
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
					v-model="patch.assigneeId"
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
					v-model="patch.sprintId"
					:options="[
						{ value: '', label: '— unchanged —' },
						{ value: '__none__', label: 'Remove from sprint' },
						...sprints.map((s) => ({ value: s.id, label: s.name })),
					]"
				/>
			</div>
		</div>
		<template #footer>
			<Button variant="ghost" @click="emit('update:open', false)">Cancel</Button>
			<Button variant="primary" @click="apply">Apply</Button>
		</template>
	</Dialog>
</template>
