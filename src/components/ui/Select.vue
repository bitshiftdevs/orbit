<script setup lang="ts">
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
	modelValue?: string | null;
	options: Array<{ value: string; label: string }>;
	placeholder?: string;
	class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const classes = computed(() =>
	cn(
		"h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-fg)] appearance-none",
		"hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none",
		"bg-no-repeat bg-[right_0.5rem_center] pr-8",
		props.class,
	),
);
</script>

<template>
	<div class="relative">
		<select
			:class="classes"
			:value="modelValue ?? ''"
			@change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
		>
			<option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
			<option
				v-for="o in options"
				:key="o.value"
				:value="o.value"
				class="bg-[var(--color-bg-elevated)]"
			>
				{{ o.label }}
			</option>
		</select>
		<svg
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-fg-subtle)]"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path d="M4 6l4 4 4-4" />
		</svg>
	</div>
</template>
