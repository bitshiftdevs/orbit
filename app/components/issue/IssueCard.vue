<script setup lang="ts">
import { ref } from "vue";
import { api, type Issue } from "~/lib/api";
import { notifyError } from "~/lib/notify";
import type { IssuePriority, IssueType, SessionUser } from "~/types/domain";
import AssigneePicker from "./inline/AssigneePicker.vue";
import PriorityPicker from "./inline/PriorityPicker.vue";
import TypePicker from "./inline/TypePicker.vue";

type MemberLite = Pick<SessionUser, "id" | "name" | "handle" | "avatarUrl" | "accentColor">;

const props = defineProps<{
	issue: Issue;
	projectKey: string;
	members?: MemberLite[];
	selected?: boolean;
}>();
const emit = defineEmits<{
	open: [id: string];
	changed: [issue: Issue];
	toggleSelect: [id: string];
}>();

const patching = ref(false);

async function patchIssue(body: Record<string, unknown>) {
	if (patching.value) return;
	patching.value = true;
	try {
		const { issue: updated } = await api.patch<{ issue: Issue }>(
			`/issues/${props.issue.id}`,
			body,
		);
		emit("changed", { ...updated, key: props.issue.key });
	} catch (err) {
		notifyError(err);
	} finally {
		patching.value = false;
	}
}

function onCardClick(e: MouseEvent) {
	const target = e.target as HTMLElement;
	if (target.closest("[data-inline-picker]")) return;
	if (e.shiftKey || e.metaKey || e.ctrlKey || props.selected) {
		e.preventDefault();
		emit("toggleSelect", props.issue.id);
		return;
	}
	emit("open", props.issue.id);
}
function onCardKey(e: KeyboardEvent) {
	if (e.key === "Enter" || e.key === " ") {
		e.preventDefault();
		emit("open", props.issue.id);
	}
}
</script>

<template>
	<div
		role="button"
		tabindex="0"
		class="group w-full text-left card card-hover p-3 space-y-2 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/60"
		:class="selected ? 'ring-2 ring-[var(--color-accent)]/70 bg-[var(--color-accent-soft)]' : ''"
		@click="onCardClick"
		@keydown="onCardKey"
	>
		<div class="flex items-center justify-between gap-2">
			<span class="mono text-[11px] text-[var(--color-fg-subtle)]">
				{{ issue.key }}
			</span>
			<PriorityPicker
				:model-value="issue.priority"
				:disabled="patching"
				@update:model-value="(v: IssuePriority) => patchIssue({ priority: v })"
			/>
		</div>
		<p class="text-sm text-[var(--color-fg)] leading-snug line-clamp-3">
			{{ issue.title }}
		</p>
		<div class="flex items-center justify-between pt-1">
			<div class="flex items-center gap-1.5">
				<TypePicker
					:model-value="issue.type"
					:disabled="patching"
					@update:model-value="(v: IssueType) => patchIssue({ type: v })"
				/>
				<span
					v-if="issue.storyPoints != null"
					class="mono text-[10px] text-[var(--color-fg-subtle)] px-1.5 py-[1px] rounded border border-[var(--color-border)]"
				>
					{{ issue.storyPoints }}
				</span>
			</div>
			<AssigneePicker
				:model-value="issue.assigneeId ?? null"
				:assignee="issue.assignee"
				:members="members ?? []"
				:disabled="patching"
				@update:model-value="(v: string | null) => patchIssue({ assigneeId: v })"
			/>
		</div>
	</div>
</template>
