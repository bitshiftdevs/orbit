<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ChevronDown } from "lucide-vue-next";
import type { IssuePriority } from "~/types/domain";
import { PRIORITY_META } from "./meta";

const props = defineProps<{ modelValue: IssuePriority }>();
const emit = defineEmits<{ "update:modelValue": [v: IssuePriority] }>();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref<{ top: string; left: string; width: string }>({ top: "0px", left: "0px", width: "0px" });

const PRIORITIES = Object.keys(PRIORITY_META) as IssuePriority[];

function toggle() {
	if (!open.value) {
		const rect = triggerRef.value!.getBoundingClientRect();
		dropdownStyle.value = {
			top: `${rect.bottom + 4}px`,
			left: `${rect.left}px`,
			width: `${rect.width}px`,
		};
	}
	open.value = !open.value;
}

function select(v: IssuePriority) {
	emit("update:modelValue", v);
	open.value = false;
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
		class="h-9 w-full flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-fg)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none"
		@click="toggle"
	>
		<span class="flex items-center gap-1.5">
			<component
				:is="PRIORITY_META[modelValue].icon"
				class="h-3.5 w-3.5"
				:class="PRIORITY_META[modelValue].text"
			/>
			{{ PRIORITY_META[modelValue].label }}
		</span>
		<ChevronDown class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" />
	</button>

	<Teleport to="body">
		<div
			v-if="open"
			ref="dropdownRef"
			class="fixed z-[200] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl py-1"
			:style="dropdownStyle"
		>
			<button
				v-for="p in PRIORITIES"
				:key="p"
				type="button"
				class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="p === modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click="select(p)"
			>
				<component
					:is="PRIORITY_META[p].icon"
					class="h-3.5 w-3.5 shrink-0"
					:class="PRIORITY_META[p].text"
				/>
				{{ PRIORITY_META[p].label }}
			</button>
		</div>
	</Teleport>
</template>
