<script setup lang="ts">
import { cn, initials } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		name: string;
		src?: string | null;
		color?: string | null;
		size?: "xs" | "sm" | "md" | "lg";
	}>(),
	{ size: "sm" },
);

const dim = computed(
	() =>
		({ xs: "h-5 w-5 text-[10px]", sm: "h-6 w-6 text-[11px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" })[
			props.size
		],
);
</script>

<template>
	<div
		:class="
			cn(
				'inline-flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-inset ring-black/30 overflow-hidden shrink-0',
				dim,
			)
		"
		:style="{ background: color ?? '#3b82f6' }"
		:title="name"
	>
		<img v-if="src" :src="src" :alt="name" class="h-full w-full object-cover" />
		<span v-else>{{ initials(name) }}</span>
	</div>
</template>
