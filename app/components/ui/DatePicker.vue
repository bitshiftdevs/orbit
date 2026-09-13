<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const props = defineProps<{
	modelValue?: string; // YYYY-MM-DD or ""
	placeholder?: string;
	class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref({ top: "0px", left: "0px" });

const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const selected = computed(() => {
	if (!props.modelValue) return null;
	const [y, m, d] = props.modelValue.split("-").map(Number);
	return { year: y, month: m - 1, day: d };
});

const displayValue = computed(() => {
	if (!props.modelValue) return "";
	const [y, m, d] = props.modelValue.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
});

const monthLabel = computed(() =>
	new Date(viewYear.value, viewMonth.value).toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	}),
);

const calendarDays = computed(() => {
	const firstDow = new Date(viewYear.value, viewMonth.value, 1).getDay();
	const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
	const cells: Array<{ day: number | null; iso: string }> = [];
	for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: "" });
	for (let d = 1; d <= daysInMonth; d++) {
		const m = String(viewMonth.value + 1).padStart(2, "0");
		const dd = String(d).padStart(2, "0");
		cells.push({ day: d, iso: `${viewYear.value}-${m}-${dd}` });
	}
	return cells;
});

const todayIso = computed(() => {
	const m = String(today.getMonth() + 1).padStart(2, "0");
	const d = String(today.getDate()).padStart(2, "0");
	return `${today.getFullYear()}-${m}-${d}`;
});

function prevMonth() {
	if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; }
	else viewMonth.value--;
}

function nextMonth() {
	if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; }
	else viewMonth.value++;
}

function selectDate(iso: string) {
	emit("update:modelValue", iso);
	open.value = false;
}

function clear(e: MouseEvent) {
	e.stopPropagation();
	emit("update:modelValue", "");
}

function toggle() {
	if (!open.value) {
		if (selected.value) {
			viewYear.value = selected.value.year;
			viewMonth.value = selected.value.month;
		} else {
			viewYear.value = today.getFullYear();
			viewMonth.value = today.getMonth();
		}
		const rect = triggerRef.value!.getBoundingClientRect();
		const CAL_H = 300;
		const spaceBelow = window.innerHeight - rect.bottom - 8;
		const flipUp = spaceBelow < CAL_H && rect.top > spaceBelow;
		dropdownStyle.value = {
			top: flipUp
				? `${rect.top - Math.min(rect.top - 8, CAL_H) - 4}px`
				: `${rect.bottom + 4}px`,
			left: `${rect.left}px`,
		};
	}
	open.value = !open.value;
}

function onPointerDown(e: PointerEvent) {
	if (triggerRef.value?.contains(e.target as Node)) return;
	if (dropdownRef.value?.contains(e.target as Node)) return;
	open.value = false;
}

onMounted(() => document.addEventListener("pointerdown", onPointerDown));
onUnmounted(() => document.removeEventListener("pointerdown", onPointerDown));
</script>

<template>
	<button
		ref="triggerRef"
		type="button"
		:class="cn(
			'h-9 w-full flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm',
			'hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none',
			displayValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-subtle)]',
			props.class,
		)"
		@click="toggle"
	>
		<span class="flex items-center gap-2 min-w-0">
			<CalendarDays class="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-subtle)]" />
			<span class="truncate">{{ displayValue || placeholder || "Pick a date" }}</span>
		</span>
		<button
			v-if="modelValue"
			type="button"
			class="shrink-0 rounded p-0.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel-hover)]"
			@click="clear"
		>
			<X class="h-3 w-3" />
		</button>
		<ChevronDown
			v-else
			class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0"
		/>
	</button>

	<Teleport to="body">
		<div
			v-if="open"
			ref="dropdownRef"
			class="fixed z-[200] w-[280px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl p-3"
			:style="dropdownStyle"
		>
			<!-- Month nav -->
			<div class="flex items-center justify-between mb-3">
				<button
					type="button"
					class="p-1 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel-hover)]"
					@click="prevMonth"
				>
					<ChevronLeft class="h-4 w-4" />
				</button>
				<span class="text-sm font-medium text-[var(--color-fg)]">{{ monthLabel }}</span>
				<button
					type="button"
					class="p-1 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel-hover)]"
					@click="nextMonth"
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>

			<!-- Weekday headers -->
			<div class="grid grid-cols-7 mb-1">
				<span
					v-for="wd in WEEKDAYS"
					:key="wd"
					class="text-center text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] py-1"
				>
					{{ wd }}
				</span>
			</div>

			<!-- Day grid -->
			<div class="grid grid-cols-7 gap-y-0.5">
				<div v-for="(cell, i) in calendarDays" :key="i" class="aspect-square">
					<button
						v-if="cell.day"
						type="button"
						class="w-full h-full flex items-center justify-center rounded text-sm transition-colors"
						:class="[
							cell.iso === modelValue
								? 'bg-[var(--color-accent)] text-white font-semibold'
								: cell.iso === todayIso
									? 'border border-[var(--color-accent)] text-[var(--color-accent)]'
									: 'text-[var(--color-fg)] hover:bg-[var(--color-panel-hover)]',
						]"
						@click="selectDate(cell.iso)"
					>
						{{ cell.day }}
					</button>
				</div>
			</div>

			<!-- Today shortcut -->
			<div class="mt-2 pt-2 border-t border-[var(--color-border)] flex justify-between">
				<button
					type="button"
					class="text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] transition-colors"
					@click="selectDate(todayIso)"
				>
					Today
				</button>
				<button
					v-if="modelValue"
					type="button"
					class="text-xs text-[var(--color-fg-subtle)] hover:text-red-400 transition-colors"
					@click="emit('update:modelValue', ''); open = false"
				>
					Clear
				</button>
			</div>
		</div>
	</Teleport>
</template>
