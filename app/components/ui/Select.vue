<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type Component } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const props = defineProps<{
	modelValue?: string | null;
	options: Array<{ value: string; label: string; icon?: Component; iconClass?: string }>;
	placeholder?: string;
	class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);

type DropdownStyle = {
	top?: string;
	left: string;
	minWidth: string;
	maxHeight: string;
};
const dropdownStyle = ref<DropdownStyle>({ top: "0px", left: "0px", minWidth: "0px", maxHeight: "240px" });

const current = computed(() =>
	props.options.find((o) => o.value === (props.modelValue ?? "")),
);

const currentLabel = computed(() => current.value?.label ?? props.placeholder ?? "");

function toggle() {
	if (!open.value) {
		const rect = triggerRef.value!.getBoundingClientRect();
		const MAX_H = 240;
		const spaceBelow = window.innerHeight - rect.bottom - 8;
		const spaceAbove = rect.top - 8;
		const flipUp = spaceBelow < MAX_H && spaceAbove > spaceBelow;

		if (flipUp) {
			const height = Math.min(spaceAbove, MAX_H);
			dropdownStyle.value = {
				top: `${rect.top - height - 4}px`,
				left: `${rect.left}px`,
				minWidth: `${rect.width}px`,
				maxHeight: `${height}px`,
			};
		} else {
			dropdownStyle.value = {
				top: `${rect.bottom + 4}px`,
				left: `${rect.left}px`,
				minWidth: `${rect.width}px`,
				maxHeight: `${Math.min(spaceBelow, MAX_H)}px`,
			};
		}
	}
	open.value = !open.value;
}

function select(value: string) {
	emit("update:modelValue", value);
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
		:class="cn(
			'h-9 w-full flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-fg)]',
			'hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none',
			props.class,
		)"
		@click="toggle"
	>
		<span class="flex items-center gap-1.5 min-w-0 truncate">
			<component
				v-if="current?.icon"
				:is="current.icon"
				class="h-3.5 w-3.5 shrink-0"
				:class="current.iconClass"
			/>
			<span class="truncate">{{ currentLabel }}</span>
		</span>
		<ChevronDown class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" />
	</button>

	<Teleport to="body">
		<div
			v-if="open"
			ref="dropdownRef"
			class="fixed z-[200] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl py-1 overflow-y-auto"
			:style="dropdownStyle"
		>
			<button
				v-for="o in options"
				:key="o.value"
				type="button"
				class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="o.value === (modelValue ?? '') ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click="select(o.value)"
			>
				<component
					v-if="o.icon"
					:is="o.icon"
					class="h-3.5 w-3.5 shrink-0"
					:class="o.iconClass"
				/>
				{{ o.label }}
			</button>
		</div>
	</Teleport>
</template>
