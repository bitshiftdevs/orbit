<script setup lang="ts">
import { computed } from "vue";

type Day = { date: string; remaining: number; ideal: number };

const props = defineProps<{ days: Day[]; total: number }>();

const W = 600;
const H = 220;
const PAD = { top: 16, right: 20, bottom: 30, left: 40 };

const view = computed(() => {
	const n = props.days.length;
	if (n < 2) return null;
	const maxY = Math.max(props.total, 1);
	const stepX = (W - PAD.left - PAD.right) / (n - 1);
	const scaleY = (v: number) =>
		PAD.top + (1 - v / maxY) * (H - PAD.top - PAD.bottom);
	const scaleX = (i: number) => PAD.left + i * stepX;

	const ideal = props.days
		.map((d, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(d.ideal)}`)
		.join(" ");
	const real = props.days
		.map((d, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(d.remaining)}`)
		.join(" ");
	const area = `${real} L${scaleX(n - 1)},${H - PAD.bottom} L${scaleX(0)},${H - PAD.bottom} Z`;

	const ticks = [0, Math.round(maxY / 2), maxY];
	return {
		ideal,
		real,
		area,
		maxY,
		ticks,
		scaleY,
		scaleX,
		xLabels: props.days.map((d, i) => ({
			x: scaleX(i),
			label: d.date.slice(5),
		})),
	};
});
</script>

<template>
	<div
		v-if="view"
		class="card p-4 overflow-hidden"
	>
		<svg :viewBox="`0 0 ${W} ${H}`" class="w-full">
			<!-- Grid -->
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
			>
				{{ t }}
			</text>

			<!-- Ideal trend -->
			<path
				:d="view.ideal"
				fill="none"
				stroke="var(--color-fg-subtle)"
				stroke-width="1"
				stroke-dasharray="4 4"
			/>

			<!-- Real remaining area + line -->
			<path :d="view.area" fill="var(--color-accent-soft)" />
			<path
				:d="view.real"
				fill="none"
				stroke="var(--color-accent)"
				stroke-width="2"
				stroke-linejoin="round"
			/>

			<!-- Dots -->
			<circle
				v-for="(d, i) in days"
				:key="d.date"
				:cx="view.scaleX(i)"
				:cy="view.scaleY(d.remaining)"
				r="2.5"
				fill="var(--color-accent)"
			/>

			<!-- X labels (sparse) -->
			<text
				v-for="(l, i) in view.xLabels.filter((_, i) => i % Math.ceil(view.xLabels.length / 6) === 0)"
				:key="`x${i}`"
				:x="l.x"
				:y="H - 10"
				text-anchor="middle"
				fill="var(--color-fg-subtle)"
				font-size="10"
				font-family="var(--font-mono)"
			>
				{{ l.label }}
			</text>
		</svg>

		<div class="flex items-center gap-4 mt-2 text-[11px] text-[var(--color-fg-subtle)]">
			<div class="flex items-center gap-1.5">
				<span class="h-2 w-4 rounded-sm bg-[var(--color-accent)]" />
				Remaining
			</div>
			<div class="flex items-center gap-1.5">
				<span class="h-[2px] w-4 bg-[var(--color-fg-subtle)]" style="border-top: 1px dashed;" />
				Ideal
			</div>
			<div class="ml-auto">Total: <span class="mono text-[var(--color-fg)]">{{ total }}</span></div>
		</div>
	</div>
	<div v-else class="card p-6 text-center text-sm text-[var(--color-fg-subtle)]">
		Not enough data to chart yet.
	</div>
</template>
