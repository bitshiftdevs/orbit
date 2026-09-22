<script setup lang="ts">
import { UserRound } from "lucide-vue-next";
import Avatar from "~/components/ui/Avatar.vue";
import type { SessionUser } from "~/types/domain";
import { useInlinePopover } from "./usePopover";

type MemberLite = Pick<SessionUser, "id" | "name" | "handle" | "avatarUrl" | "accentColor">;

const props = defineProps<{
	modelValue: string | null;
	assignee?: { name: string; avatarUrl: string | null; accentColor: string } | null;
	members: MemberLite[];
	disabled?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [v: string | null] }>();

const { open, triggerRef, popRef, style, toggle, close } = useInlinePopover();

function select(id: string | null) {
	close();
	if (id !== (props.modelValue ?? null)) emit("update:modelValue", id);
}
</script>

<template>
	<button
		ref="triggerRef"
		type="button"
		data-inline-picker
		class="rounded-full hover:ring-2 hover:ring-[var(--color-border-strong)] transition-shadow disabled:opacity-60"
		:title="assignee ? `Assignee: ${assignee.name}` : 'Unassigned'"
		:disabled="disabled"
		@click="toggle"
	>
		<Avatar
			v-if="assignee"
			:name="assignee.name"
			:src="assignee.avatarUrl"
			:color="assignee.accentColor"
			size="xs"
		/>
		<span
			v-else
			class="block h-5 w-5 rounded-full border border-dashed border-[var(--color-border-strong)] flex items-center justify-center"
		>
			<UserRound class="h-2.5 w-2.5 text-[var(--color-fg-subtle)]" />
		</span>
	</button>
	<Teleport to="body">
		<div
			v-if="open"
			ref="popRef"
			data-inline-picker
			class="fixed z-[200] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl py-1 max-h-64 overflow-y-auto"
			:style="style"
		>
			<button
				type="button"
				class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="!modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click.stop="select(null)"
			>
				<UserRound class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" />
				Unassigned
			</button>
			<button
				v-for="m in members"
				:key="m.id"
				type="button"
				class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
				:class="m.id === modelValue ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
				@click.stop="select(m.id)"
			>
				<Avatar :name="m.name" :src="m.avatarUrl" :color="m.accentColor" size="xs" />
				<span class="truncate">{{ m.name }}</span>
			</button>
			<div v-if="!members.length" class="px-3 py-2 text-xs text-[var(--color-fg-subtle)]">
				No members
			</div>
		</div>
	</Teleport>
</template>
