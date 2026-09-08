<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import Avatar from "@/components/ui/Avatar.vue";
import Markdown from "@/components/ui/Markdown.vue";

type Member = {
	id: string;
	name: string;
	handle: string;
	avatarUrl?: string | null;
	accentColor?: string | null;
};

const props = withDefaults(
	defineProps<{
		modelValue: string;
		members: Member[];
		placeholder?: string;
		rows?: number;
		previewable?: boolean;
	}>(),
	{ rows: 3, previewable: false },
);

const previewing = ref(false);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const areaRef = ref<HTMLTextAreaElement | null>(null);
const showList = ref(false);
const query = ref("");
const activeIdx = ref(0);
const anchorPos = ref(0);

const suggestions = computed(() => {
	const q = query.value.toLowerCase();
	return props.members
		.filter((m) => m.handle.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
		.slice(0, 6);
});

function onInput(e: Event) {
	const t = e.target as HTMLTextAreaElement;
	emit("update:modelValue", t.value);
	const upto = t.value.slice(0, t.selectionStart);
	const m = /(?:^|\s)@([a-z0-9_-]*)$/i.exec(upto);
	if (m) {
		query.value = m[1];
		anchorPos.value = upto.length - m[0].length + (m[0].startsWith(" ") ? 1 : 0);
		activeIdx.value = 0;
		showList.value = true;
	} else {
		showList.value = false;
	}
}

function pick(m: Member) {
	if (!areaRef.value) return;
	const before = props.modelValue.slice(0, anchorPos.value);
	const afterStart = areaRef.value.selectionStart;
	const after = props.modelValue.slice(afterStart);
	const inserted = `@${m.handle} `;
	const next = `${before}${inserted}${after}`;
	emit("update:modelValue", next);
	showList.value = false;
	nextTick(() => {
		const pos = before.length + inserted.length;
		areaRef.value!.focus();
		areaRef.value!.setSelectionRange(pos, pos);
	});
}

function onKey(e: KeyboardEvent) {
	if (!showList.value || !suggestions.value.length) return;
	if (e.key === "ArrowDown") {
		e.preventDefault();
		activeIdx.value = (activeIdx.value + 1) % suggestions.value.length;
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		activeIdx.value =
			(activeIdx.value - 1 + suggestions.value.length) % suggestions.value.length;
	} else if (e.key === "Enter" || e.key === "Tab") {
		e.preventDefault();
		pick(suggestions.value[activeIdx.value]);
	} else if (e.key === "Escape") {
		showList.value = false;
	}
}
</script>

<template>
	<div class="relative">
		<div v-if="previewable" class="flex items-center gap-2 mb-1">
			<button
				type="button"
				class="text-[11px] px-2 py-0.5 rounded"
				:class="!previewing ? 'text-[var(--color-fg)] bg-[var(--color-panel-hover)]' : 'text-[var(--color-fg-subtle)]'"
				@click="previewing = false"
			>Edit</button>
			<button
				type="button"
				class="text-[11px] px-2 py-0.5 rounded"
				:class="previewing ? 'text-[var(--color-fg)] bg-[var(--color-panel-hover)]' : 'text-[var(--color-fg-subtle)]'"
				@click="previewing = true"
			>Preview</button>
		</div>

		<div
			v-if="previewing && previewable"
			class="min-h-[80px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2"
		>
			<Markdown :source="modelValue || '*Nothing to preview.*'" />
		</div>
		<textarea
			v-else
			ref="areaRef"
			:value="modelValue"
			:placeholder="placeholder"
			:rows="rows"
			class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] transition-colors resize-y hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none"
			@input="onInput"
			@keydown="onKey"
		/>
		<div
			v-if="showList && suggestions.length"
			class="absolute left-2 top-full mt-1 z-10 card glow w-56 overflow-hidden"
		>
			<button
				v-for="(m, i) in suggestions"
				:key="m.id"
				type="button"
				class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-[var(--color-panel-hover)]"
				:class="{ 'bg-[var(--color-panel-hover)]': activeIdx === i }"
				@click="pick(m)"
			>
				<Avatar
					:name="m.name"
					:src="m.avatarUrl"
					:color="m.accentColor ?? '#3b82f6'"
					size="xs"
				/>
				<span class="flex-1 truncate">{{ m.name }}</span>
				<span class="mono text-[10px] text-[var(--color-fg-subtle)]">
					@{{ m.handle }}
				</span>
			</button>
		</div>
	</div>
</template>
