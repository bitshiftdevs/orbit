<script setup lang="ts">
import { ref, watch } from "vue";
import type { Component } from "vue";

export type SlashItem = {
	title: string;
	description: string;
	icon: Component;
	command: (props: { editor: any; range: any }) => void;
};

const props = defineProps<{
	items: SlashItem[];
	command: (item: SlashItem) => void;
}>();

const selected = ref(0);
watch(() => props.items, () => { selected.value = 0; });

function onKeyDown(e: KeyboardEvent): boolean {
	if (!props.items.length) return false;
	if (e.key === "ArrowUp") { selected.value = (selected.value - 1 + props.items.length) % props.items.length; return true; }
	if (e.key === "ArrowDown") { selected.value = (selected.value + 1) % props.items.length; return true; }
	if (e.key === "Enter") { props.command(props.items[selected.value]); return true; }
	return false;
}

defineExpose({ onKeyDown });
</script>

<template>
	<div v-if="items.length" class="card glow w-64 overflow-hidden max-h-72 overflow-y-auto">
		<button
			v-for="(item, i) in items"
			:key="item.title"
			type="button"
			class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-panel-hover)]"
			:class="{ 'bg-[var(--color-panel-hover)]': selected === i }"
			@click="command(item)"
		>
			<div class="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center bg-[var(--color-panel-hover)]">
				<component :is="item.icon" class="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
			</div>
			<div>
				<div class="text-sm text-[var(--color-fg)]">{{ item.title }}</div>
				<div class="text-[11px] text-[var(--color-fg-subtle)]">{{ item.description }}</div>
			</div>
		</button>
	</div>
</template>
