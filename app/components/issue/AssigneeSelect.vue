<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ChevronDown, UserRound } from "lucide-vue-next";
import Avatar from "~/components/ui/Avatar.vue";
import type { SessionUser } from "~/types/domain";

const props = defineProps<{
	modelValue: string | null;
	members: Array<Pick<SessionUser, "id" | "name" | "handle" | "avatarUrl" | "accentColor">>;
}>();
const emit = defineEmits<{ "update:modelValue": [v: string | null] }>();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref<{ top: string; left: string; width: string }>({ top: "0px", left: "0px", width: "0px" });

const current = computed(() =>
	props.modelValue ? props.members.find((m) => m.id === props.modelValue) ?? null : null,
);

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

function select(id: string | null) {
	emit("update:modelValue", id);
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
		<span class="flex items-center gap-1.5 min-w-0">
			<Avatar
				v-if="current"
				:name="current.name"
				:src="current.avatarUrl"
				:color="current.accentColor"
				size="xs"
			/>
			<UserRound v-else class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" />
			<span class="truncate">{{ current?.name ?? "Unassigned" }}</span>
		</span>
		<ChevronDown class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" />
	</button>

	<Teleport to="body">
		<div
			v-if="open"
			ref="dropdownRef"
			class="fixed z-[200] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl py-1 max-h-60 overflow-y-auto"
			:style="dropdownStyle"
		>
			<button
				type="button"
				class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="!modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click="select(null)"
			>
				<UserRound class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" />
				Unassigned
			</button>
			<button
				v-for="m in members"
				:key="m.id"
				type="button"
				class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="m.id === modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click="select(m.id)"
			>
				<Avatar :name="m.name" :src="m.avatarUrl" :color="m.accentColor" size="xs" />
				<span class="truncate">{{ m.name }}</span>
			</button>
		</div>
	</Teleport>
</template>
