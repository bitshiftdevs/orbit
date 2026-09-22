<script setup lang="ts">
import type { IssuePriority } from "~/types/domain";
import { PRIORITY_META } from "../meta";
import { useInlinePopover } from "./usePopover";

const props = defineProps<{ modelValue: IssuePriority; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [v: IssuePriority] }>();

const PRIORITIES = Object.keys(PRIORITY_META) as IssuePriority[];
const { open, triggerRef, popRef, style, toggle, close } = useInlinePopover();

function select(p: IssuePriority) {
	close();
	if (p !== props.modelValue) emit("update:modelValue", p);
}
</script>

<template>
	<button
		ref="triggerRef"
		type="button"
		data-inline-picker
		class="p-0.5 -m-0.5 rounded hover:bg-[var(--color-panel-hover)] transition-colors disabled:opacity-60"
		:title="`Priority: ${PRIORITY_META[modelValue].label}`"
		:disabled="disabled"
		@click="toggle"
	>
		<component
			:is="PRIORITY_META[modelValue].icon"
			class="h-3.5 w-3.5"
			:class="PRIORITY_META[modelValue].text"
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
				v-for="p in PRIORITIES"
				:key="p"
				type="button"
				class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="p === modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click.stop="select(p)"
			>
				<component
					:is="PRIORITY_META[p].icon"
					class="h-3.5 w-3.5 shrink-0"
					:class="PRIORITY_META[p].text"
				/>
				{{ PRIORITY_META[p].label }}
			</button>
		</div>
	</Teleport>
</template>
