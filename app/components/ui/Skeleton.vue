<script setup lang="ts">
import { cn } from "~/lib/utils";
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		/** Tailwind width class or arbitrary value, e.g. "w-32" or "w-full". */
		width?: string;
		/** Tailwind height class, e.g. "h-4". */
		height?: string;
		/** Render as a circle (for avatars). */
		circle?: boolean;
		/** Number of stacked lines to render. Overrides single-block mode. */
		lines?: number;
		class?: string;
	}>(),
	{ height: "h-4", lines: 1 },
);

const base = "animate-pulse bg-[var(--color-panel-hover)]";

const blockClass = computed(() =>
	cn(
		base,
		props.circle ? "rounded-full" : "rounded-md",
		props.width,
		props.height,
		props.class,
	),
);
</script>

<template>
	<div v-if="lines > 1" :class="cn('space-y-2', props.class)">
		<div
			v-for="n in lines"
			:key="n"
			:class="cn(base, 'rounded-md', height, n === lines ? 'w-2/3' : 'w-full')"
		/>
	</div>
	<div v-else :class="blockClass" />
</template>
