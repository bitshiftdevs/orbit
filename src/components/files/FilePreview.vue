<script setup lang="ts">
import { ref, watch } from "vue";
import { Download, Edit3, Eye, X } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import TiptapEditor from "@/components/ui/TiptapEditor.vue";
import type { FileRow } from "@/types/domain";
import { notify, notifyError } from "@/lib/notify";
import { formatBytes } from "@/lib/utils";
import { api } from "@/lib/api";

const props = defineProps<{ file: FileRow | null }>();
const emit = defineEmits<{
	close: [];
	saved: [file: FileRow];
}>();

const previewBlobUrl = ref<string | null>(null);
const previewText = ref<string | null>(null);
const previewLoading = ref(false);
const editMode = ref(false);
const editContent = ref("");
const saving = ref(false);

function isMarkdown(f: FileRow) {
	return (
		f.mimeType === "text/markdown" ||
		f.mimeType === "text/x-markdown" ||
		f.mimeType === "text/plain" ||
		f.name.endsWith(".md") ||
		f.name.endsWith(".markdown")
	);
}

function isText(f: FileRow) {
	return (
		f.mimeType.startsWith("text/") ||
		f.mimeType === "application/json" ||
		f.mimeType === "application/xml"
	);
}

function cleanup() {
	if (previewBlobUrl.value) URL.revokeObjectURL(previewBlobUrl.value);
	previewBlobUrl.value = null;
	previewText.value = null;
	editMode.value = false;
	editContent.value = "";
}

watch(
	() => props.file,
	async (f) => {
		cleanup();
		if (!f) return;
		previewLoading.value = true;
		try {
			const res = await fetch(`/api/files/${f.id}/preview`, { credentials: "include" });
			if (isText(f)) {
				previewText.value = await res.text();
			} else {
				const blob = await res.blob();
				previewBlobUrl.value = URL.createObjectURL(blob);
			}
		} catch {
			previewText.value = null;
		} finally {
			previewLoading.value = false;
		}
	},
);

function enterEdit() {
	editContent.value = previewText.value ?? "";
	editMode.value = true;
}

async function saveEdit() {
	if (!props.file) return;
	saving.value = true;
	try {
		const { file: updated } = await api.patch<{ file: FileRow }>(
			`/files/${props.file.id}/content`,
			{ content: editContent.value },
		);
		previewText.value = editContent.value;
		editMode.value = false;
		emit("saved", updated);
		notify("Saved", "success");
	} catch (err) {
		notifyError(err);
	} finally {
		saving.value = false;
	}
}

function close() {
	cleanup();
	emit("close");
}

function onKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") close();
}

function download(f: FileRow) {
	window.open(`/api/files/${f.id}/download`, "_blank");
}
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-150"
			enter-from-class="opacity-0"
			leave-active-class="transition-opacity duration-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="file"
				class="fixed inset-0 z-50 bg-black/90 flex flex-col"
				tabindex="-1"
				@keydown="onKeydown"
			>
				<header class="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-white truncate">{{ file.name }}</p>
						<p class="text-[11px] text-white/50">
							{{ formatBytes(file.sizeBytes) }} · {{ file.mimeType }}
						</p>
					</div>
					<div class="flex items-center gap-2 ml-4">
						<template v-if="isMarkdown(file) && previewText !== null">
							<div class="flex items-center rounded border border-white/15 overflow-hidden text-xs">
								<button
									class="px-3 py-1.5 flex items-center gap-1.5 transition-colors"
									:class="!editMode ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'"
									@click="editMode = false"
								>
									<Eye class="h-3.5 w-3.5" />
									Preview
								</button>
								<button
									class="px-3 py-1.5 flex items-center gap-1.5 transition-colors"
									:class="editMode ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'"
									@click="enterEdit"
								>
									<Edit3 class="h-3.5 w-3.5" />
									Edit
								</button>
							</div>
							<Button v-if="editMode" size="sm" variant="primary" :loading="saving" @click="saveEdit">
								Save
							</Button>
						</template>
						<Button size="sm" variant="outline" @click="download(file)">
							<Download class="h-3.5 w-3.5" />
							Download
						</Button>
						<button
							class="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
							@click="close"
						>
							<X class="h-5 w-5" />
						</button>
					</div>
				</header>

				<div class="flex-1 overflow-auto flex items-center justify-center p-6" @click.self="close">
					<div v-if="previewLoading" class="text-white/50 text-sm">Loading…</div>

					<template v-else-if="previewBlobUrl">
						<img
							v-if="file.mimeType.startsWith('image/')"
							:src="previewBlobUrl"
							:alt="file.name"
							class="max-h-full max-w-full object-contain rounded"
						/>
						<embed
							v-else-if="file.mimeType === 'application/pdf'"
							:src="previewBlobUrl"
							type="application/pdf"
							class="w-full rounded"
							style="height: 80vh"
						/>
						<video
							v-else-if="file.mimeType.startsWith('video/')"
							:src="previewBlobUrl"
							controls
							class="max-h-full max-w-full rounded"
						/>
						<audio
							v-else-if="file.mimeType.startsWith('audio/')"
							:src="previewBlobUrl"
							controls
							class="w-80"
						/>
					</template>

					<template v-else-if="previewText !== null">
						<div
							v-if="isMarkdown(file)"
							class="bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] max-h-full overflow-auto max-w-3xl w-full"
							:class="editMode ? '' : 'p-8'"
						>
							<TiptapEditor
								v-if="editMode"
								v-model="editContent"
								placeholder="Write markdown here…"
							/>
							<TiptapEditor
								v-else
								:model-value="previewText ?? ''"
								:readonly="true"
								class="p-8"
							/>
						</div>
						<pre
							v-else
							class="text-sm text-white/90 bg-white/5 rounded p-5 max-h-full overflow-auto max-w-4xl w-full font-mono whitespace-pre-wrap break-all"
						>{{ previewText }}</pre>
					</template>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
