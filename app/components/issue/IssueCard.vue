<script setup lang="ts">
import Avatar from "~/components/ui/Avatar.vue";
import type { Issue } from "~/lib/api";
import { PRIORITY_META, TYPE_META } from "./meta";

const props = defineProps<{ issue: Issue; projectKey: string }>();
defineEmits<{ open: [id: string] }>();
</script>

<template>
	<button
		type="button"
		class="group w-full text-left card card-hover p-3 space-y-2 cursor-grab active:cursor-grabbing"
		@click="$emit('open', issue.id)"
	>
		<div class="flex items-center justify-between gap-2">
			<span class="mono text-[11px] text-[var(--color-fg-subtle)]">
				{{ issue.key }}
			</span>
			<component
				:is="PRIORITY_META[issue.priority].icon"
				class="h-3.5 w-3.5"
				:class="PRIORITY_META[issue.priority].text"
			/>
		</div>
		<p class="text-sm text-[var(--color-fg)] leading-snug line-clamp-3">
			{{ issue.title }}
		</p>
		<div class="flex items-center justify-between pt-1">
			<div class="flex items-center gap-1.5">
				<component
					:is="TYPE_META[issue.type].icon"
					class="h-3.5 w-3.5"
					:class="TYPE_META[issue.type].text"
				/>
				<span
					v-if="issue.storyPoints != null"
					class="mono text-[10px] text-[var(--color-fg-subtle)] px-1.5 py-[1px] rounded border border-[var(--color-border)]"
				>
					{{ issue.storyPoints }}
				</span>
			</div>
			<Avatar
				v-if="issue.assignee"
				:name="issue.assignee.name"
				:src="issue.assignee.avatarUrl"
				:color="issue.assignee.accentColor"
				size="xs"
			/>
			<div
				v-else
				class="h-5 w-5 rounded-full border border-dashed border-[var(--color-border-strong)]"
				title="Unassigned"
			/>
		</div>
	</button>
</template>
