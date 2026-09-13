<script setup lang="ts">
import { cn } from "~/lib/utils";
import { computed } from "vue";

type Size = "xs" | "sm" | "md" | "lg";

const props = withDefaults(
	defineProps<{
		size?: Size;
		/** Optional label rendered next to the spinner. */
		label?: string;
		/** Center the spinner within its parent and fill available space. */
		center?: boolean;
		class?: string;
	}>(),
	{ size: "md" },
);

const sizes: Record<Size, string> = {
	xs: "h-3 w-3 border-2",
	sm: "h-4 w-4 border-2",
	md: "h-5 w-5 border-2",
	lg: "h-8 w-8 border-[3px]",
};

const spinnerClass = computed(() =>
	cn(
		"inline-block rounded-full border-current border-t-transparent animate-spin",
		sizes[props.size],
	),
);
</script>

<template>
	<div
		v-if="center"
		:class="cn('flex-1 flex items-center justify-center gap-2.5 py-8 text-[var(--color-fg-subtle)]', props.class)"
	>
		<span :class="spinnerClass" role="status" aria-label="Loading" />
		<span v-if="label" class="text-sm">{{ label }}</span>
	</div>
	<span
		v-else
		:class="cn('inline-flex items-center gap-2 text-[var(--color-fg-subtle)]', props.class)"
	>
		<span :class="spinnerClass" role="status" aria-label="Loading" />
		<span v-if="label" class="text-sm">{{ label }}</span>
	</span>
</template>
