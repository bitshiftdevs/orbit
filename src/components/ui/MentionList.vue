<script setup lang="ts">
import { ref, watch } from "vue";
import Avatar from "./Avatar.vue";

type Item = {
	id: string;
	name: string;
	handle: string;
	avatarUrl?: string | null;
	accentColor?: string | null;
};

const props = defineProps<{
	items: Item[];
	command: (attrs: { id: string; label: string }) => void;
}>();

const selected = ref(0);
watch(() => props.items, () => { selected.value = 0; });

function pick(item: Item) {
	props.command({ id: item.handle, label: item.name });
}

function onKeyDown(e: KeyboardEvent): boolean {
	if (!props.items.length) return false;
	if (e.key === "ArrowUp") {
		selected.value = (selected.value - 1 + props.items.length) % props.items.length;
		return true;
	}
	if (e.key === "ArrowDown") {
		selected.value = (selected.value + 1) % props.items.length;
		return true;
	}
	if (e.key === "Enter" || e.key === "Tab") {
		pick(props.items[selected.value]);
		return true;
	}
	return false;
}

defineExpose({ onKeyDown });
</script>

<template>
	<div v-if="items.length" class="card glow w-56 overflow-hidden">
		<button
			v-for="(m, i) in items"
			:key="m.id"
			type="button"
			class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-[var(--color-panel-hover)]"
			:class="{ 'bg-[var(--color-panel-hover)]': selected === i }"
			@click="pick(m)"
		>
			<Avatar :name="m.name" :src="m.avatarUrl" :color="m.accentColor ?? '#3b82f6'" size="xs" />
			<span class="flex-1 truncate">{{ m.name }}</span>
			<span class="mono text-[10px] text-[var(--color-fg-subtle)]">@{{ m.handle }}</span>
		</button>
	</div>
</template>
