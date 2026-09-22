<script setup lang="ts">
import type { IssueStatus } from "~/types/domain";
import { STATUS_META } from "../meta";
import { useInlinePopover } from "./usePopover";

const props = defineProps<{ modelValue: IssueStatus; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [v: IssueStatus] }>();

const STATUSES = Object.keys(STATUS_META) as IssueStatus[];
const { open, triggerRef, popRef, style, toggle, close } = useInlinePopover();

function select(s: IssueStatus) {
	close();
	if (s !== props.modelValue) emit("update:modelValue", s);
}
</script>

<template>
	<button
		ref="triggerRef"
		type="button"
		data-inline-picker
		class="p-0.5 -m-0.5 rounded hover:bg-[var(--color-panel-hover)] transition-colors disabled:opacity-60"
		:title="`Status: ${STATUS_META[modelValue].label}`"
		:disabled="disabled"
		@click="toggle"
	>
		<component
			:is="STATUS_META[modelValue].icon"
			class="h-3.5 w-3.5"
			:class="STATUS_META[modelValue].text"
		/>
	</button>
	<Teleport to="body">
		<div
			v-if="open"
			ref="popRef"
			data-inline-picker
			class="fixed z-[200] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl py-1"
			:style="style"
		>
			<button
				v-for="s in STATUSES"
				:key="s"
				type="button"
				class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="s === modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click.stop="select(s)"
			>
				<component
					:is="STATUS_META[s].icon"
					class="h-3.5 w-3.5 shrink-0"
					:class="STATUS_META[s].text"
				/>
				{{ STATUS_META[s].label }}
			</button>
		</div>
	</Teleport>
</template>
