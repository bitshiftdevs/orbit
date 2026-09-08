<script setup lang="ts">
import { computed } from "vue";

type SprintVelocity = {
	sprintId: string;
	sprintName: string;
	status: string;
	committed: number;
	completed: number;
};

const props = defineProps<{ sprints: SprintVelocity[] }>();

const W = 600;
const H = 220;
const PAD = { top: 16, right: 20, bottom: 50, left: 44 };

const view = computed(() => {
	const data = props.sprints.filter(
		(s) => s.status === "completed" || s.committed > 0,
	);
	if (!data.length) return null;

	const maxY = Math.max(...data.map((s) => Math.max(s.committed, s.completed)), 1);
	const barW = Math.max(
		4,
		((W - PAD.left - PAD.right) / data.length) * 0.6,
	);
	const groupW = (W - PAD.left - PAD.right) / data.length;
	const scaleY = (v: number) =>
		PAD.top + (1 - v / maxY) * (H - PAD.top - PAD.bottom);
	const barH = (v: number) => H - PAD.bottom - scaleY(v);

	const ticks = [
		0,
		Math.round(maxY / 2),
		maxY,
	];

	return {
		data,
		barW,
		groupW,
		scaleY,
		barH,
		ticks,
		maxY,
		xOf: (i: number) => PAD.left + i * groupW + groupW / 2,
	};
});
</script>

<template>
	<div v-if="view" class="card p-4 overflow-hidden">
		<div class="text-xs text-[var(--color-fg-subtle)] uppercase tracking-widest mb-3">Velocity</div>
		<svg :viewBox="`0 0 ${W} ${H}`" class="w-full">
			<!-- Grid lines -->
			<line
				v-for="t in view.ticks"
				:key="t"
				:x1="PAD.left"
				:x2="W - PAD.right"
				:y1="view.scaleY(t)"
				:y2="view.scaleY(t)"
				stroke="var(--color-border)"
				stroke-dasharray="2 3"
			/>
			<text
				v-for="t in view.ticks"
				:key="`l${t}`"
				:x="PAD.left - 6"
				:y="view.scaleY(t) + 4"
				text-anchor="end"
				fill="var(--color-fg-subtle)"
				font-size="10"
				font-family="var(--font-mono)"
			>{{ t }}</text>

			<!-- Bars per sprint -->
			<g v-for="(s, i) in view.data" :key="s.sprintId">
				<!-- Committed bar (background) -->
				<rect
					v-if="s.committed > 0"
					:x="view.xOf(i) - view.barW / 2 - 1"
					:y="view.scaleY(s.committed)"
					:width="view.barW + 2"
					:height="view.barH(s.committed)"
					fill="var(--color-panel-hover)"
					rx="2"
				/>
				<!-- Completed bar (foreground) -->
				<rect
					v-if="s.completed > 0"
					:x="view.xOf(i) - view.barW / 2"
					:y="view.scaleY(s.completed)"
					:width="view.barW"
					:height="view.barH(s.completed)"
					fill="var(--color-accent)"
					rx="2"
				/>
				<!-- Value label -->
				<text
					:x="view.xOf(i)"
					:y="view.scaleY(s.completed) - 4"
					text-anchor="middle"
					fill="var(--color-accent)"
					font-size="9"
					font-family="var(--font-mono)"
				>{{ s.completed }}</text>
				<!-- Sprint label -->
				<text
					:x="view.xOf(i)"
					:y="H - 8"
					text-anchor="middle"
					fill="var(--color-fg-subtle)"
					font-size="9"
					font-family="var(--font-mono)"
				>{{ s.sprintName.length > 10 ? s.sprintName.slice(0, 9) + "…" : s.sprintName }}</text>
			</g>
		</svg>

		<div class="flex items-center gap-4 mt-2 text-[11px] text-[var(--color-fg-subtle)]">
			<div class="flex items-center gap-1.5">
				<span class="h-3 w-3 rounded-sm bg-[var(--color-accent)]" />
				Completed pts
			</div>
			<div class="flex items-center gap-1.5">
				<span class="h-3 w-3 rounded-sm bg-[var(--color-panel-hover)]" />
				Committed pts
			</div>
		</div>
	</div>
	<div v-else class="card p-6 text-center text-sm text-[var(--color-fg-subtle)]">
		No sprint data yet.
	</div>
</template>
