<script setup lang="ts">
import { cn } from "~/lib/utils";
import { computed } from "vue";

const props = defineProps<{
	modelValue?: string | null;
	placeholder?: string;
	rows?: number;
	disabled?: boolean;
	class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const classes = computed(() =>
	cn(
		"w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] transition-colors resize-y",
		"hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none",
		props.class,
	),
);
</script>

<template>
	<textarea
		:class="classes"
		:rows="rows ?? 4"
		:value="modelValue ?? ''"
		:placeholder="placeholder"
		:disabled="disabled"
		@input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
	/>
</template>
