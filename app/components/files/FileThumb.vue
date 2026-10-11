<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import { File as FileIcon } from "lucide-vue-next";
import { api } from "~/lib/api";
import type { FileRow } from "~/types/domain";

const props = defineProps<{ file: FileRow }>();

const root = ref<HTMLElement | null>(null);
const url = ref<string | null>(null);
const loaded = ref(false);

const canPreview =
	props.file.mimeType.startsWith("image/") ||
	props.file.mimeType === "application/pdf";

async function load() {
	if (loaded.value || !canPreview) return;
	loaded.value = true;
	try {
		const blob = await api.raw<Blob>(`/files/${props.file.id}/preview`);
		url.value = URL.createObjectURL(blob);
	} catch {
		loaded.value = false;
	}
}

const { stop } = useIntersectionObserver(
	root,
	([entry]) => {
		if (entry?.isIntersecting) {
			load();
			stop();
		}
	},
	{ rootMargin: "200px" },
);

onUnmounted(() => {
	if (url.value) URL.revokeObjectURL(url.value);
});
</script>

<template>
	<div
		ref="root"
		class="h-36 bg-[var(--color-bg-elevated)] grid place-items-center border-b border-[var(--color-border)] overflow-hidden"
	>
		<img
			v-if="file.mimeType.startsWith('image/') && url"
			:src="url"
			:alt="file.name"
			class="h-full w-full object-cover"
		/>
		<embed
			v-else-if="file.mimeType === 'application/pdf' && url"
			:src="url"
			type="application/pdf"
			class="h-full w-full"
		/>
		<FileIcon v-else class="h-8 w-8 text-[var(--color-fg-subtle)]" />
	</div>
</template>
