<script setup lang="ts">
import type { IssueType } from "~/types/domain";
import { TYPE_META } from "../meta";
import { useInlinePopover } from "./usePopover";

const props = defineProps<{ modelValue: IssueType; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [v: IssueType] }>();

const TYPES = Object.keys(TYPE_META) as IssueType[];
const { open, triggerRef, popRef, style, toggle, close } = useInlinePopover();

function select(t: IssueType) {
	close();
	if (t !== props.modelValue) emit("update:modelValue", t);
}
</script>

<template>
	<button
		ref="triggerRef"
		type="button"
		data-inline-picker
		class="p-0.5 -m-0.5 rounded hover:bg-[var(--color-panel-hover)] transition-colors disabled:opacity-60"
		:title="`Type: ${TYPE_META[modelValue].label}`"
		:disabled="disabled"
		@click="toggle"
	>
		<component
			:is="TYPE_META[modelValue].icon"
			class="h-3.5 w-3.5"
			:class="TYPE_META[modelValue].text"
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
				v-for="t in TYPES"
				:key="t"
				type="button"
				class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="t === modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click.stop="select(t)"
			>
				<component
					:is="TYPE_META[t].icon"
					class="h-3.5 w-3.5 shrink-0"
					:class="TYPE_META[t].text"
				/>
				{{ TYPE_META[t].label }}
			</button>
		</div>
	</Teleport>
</template>
