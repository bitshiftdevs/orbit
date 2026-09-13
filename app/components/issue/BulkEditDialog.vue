<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "~/components/ui/Button.vue";
import Dialog from "~/components/ui/Dialog.vue";
import Select from "~/components/ui/Select.vue";
import type { BulkIssuePatch, IssuePriority, IssueStatus, SessionUser, Sprint } from "~/types/domain";
import { STATUS_META, PRIORITY_META } from "~/components/issue/meta";

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

const STATUS_OPTIONS = [
	{ value: "", label: "— unchanged —" },
	...(Object.keys(STATUS_META) as IssueStatus[]).map((k) => ({
		value: k,
		label: STATUS_META[k].label,
		icon: STATUS_META[k].icon,
		iconClass: STATUS_META[k].text,
	})),
];

const PRIORITY_OPTIONS = [
	{ value: "", label: "— unchanged —" },
	...(Object.keys(PRIORITY_META) as IssuePriority[]).map((k) => ({
		value: k,
		label: PRIORITY_META[k].label,
		icon: PRIORITY_META[k].icon,
		iconClass: PRIORITY_META[k].text,
	})),
];

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
				<Select v-model="patch.status" :options="STATUS_OPTIONS" />
			</div>
			<div class="space-y-1">
				<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Priority</label>
				<Select v-model="patch.priority" :options="PRIORITY_OPTIONS" />
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
