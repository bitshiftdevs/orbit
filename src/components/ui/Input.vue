<script setup lang="ts">
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
	modelValue?: string | number | null;
	type?: string;
	placeholder?: string;
	autocomplete?: string;
	disabled?: boolean;
	mono?: boolean;
	class?: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

const classes = computed(() =>
	cn(
		"h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] transition-colors",
		"hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-0",
		"disabled:opacity-50",
		props.mono && "mono",
		props.class,
	),
);
</script>

<template>
	<input
		:class="classes"
		:type="type ?? 'text'"
		:value="modelValue ?? ''"
		:placeholder="placeholder"
		:autocomplete="autocomplete"
		:disabled="disabled"
		@input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
	/>
</template>
