<script setup lang="ts">
import { cn } from "@/lib/utils";
import { computed } from "vue";

type Tone =
	| "neutral"
	| "blue"
	| "green"
	| "amber"
	| "red"
	| "violet"
	| "slate";

const props = withDefaults(
	defineProps<{ tone?: Tone; dot?: boolean; class?: string }>(),
	{ tone: "neutral" },
);

const tones: Record<Tone, string> = {
	neutral:
		"bg-white/5 text-[var(--color-fg-muted)] border-white/10",
	blue: "bg-blue-500/10 text-blue-300 border-blue-500/25",
	green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
	amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
	red: "bg-red-500/10 text-red-300 border-red-500/30",
	violet: "bg-violet-500/10 text-violet-300 border-violet-500/25",
	slate: "bg-slate-500/10 text-slate-300 border-slate-500/25",
};

const dotClass: Record<Tone, string> = {
	neutral: "bg-zinc-400",
	blue: "bg-blue-400",
	green: "bg-emerald-400",
	amber: "bg-amber-400",
	red: "bg-red-400",
	violet: "bg-violet-400",
	slate: "bg-slate-400",
};

const classes = computed(() => cn("chip", tones[props.tone], props.class));
</script>

<template>
	<span :class="classes">
		<span v-if="dot" class="h-1.5 w-1.5 rounded-full" :class="dotClass[tone]" />
		<slot />
	</span>
</template>
