<script setup lang="ts">
import { inject, onMounted, ref, type Ref } from "vue";
import { Download, Edit3, Eye, File as FileIcon, Trash2, Upload, X } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import Markdown from "@/components/ui/Markdown.vue";
import { api, type FileRow, type Project } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { formatBytes, timeAgo } from "@/lib/utils";
import { useConfirmDialog } from "@/composables/useConfirmDialog";

const { confirm } = useConfirmDialog();
const project = inject<Ref<Project | null>>("project")!;
const files = ref<FileRow[]>([]);
const uploading = ref(false);
const dragOver = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const MAX = 5 * 1024 * 1024;

async function load() {
	if (!project.value) return;
	try {
		const { files: rows } = await api.get<{ files: FileRow[] }>(
			`/projects/${project.value.key}/files`,
		);
		files.value = rows;
	} catch (err) {
		notifyError(err);
	}
}

onMounted(load);

async function upload(list: FileList | null) {
	if (!list || !project.value) return;
	uploading.value = true;
	try {
		for (const file of Array.from(list)) {
			if (file.size > MAX) {
				notify(`${file.name} > 5 MB — skipping`, "error");
				continue;
			}
			const form = new FormData();
			form.append("file", file);
			const { file: row } = await api.post<{ file: FileRow }>(
				`/projects/${project.value.key}/files`,
				form,
			);
			files.value.unshift(row);
		}
		notify("Upload complete", "success");
	} catch (err) {
		notifyError(err);
	} finally {
		uploading.value = false;
	}
}

async function remove(f: FileRow) {
	if (!await confirm(`Delete ${f.name}?`, { danger: true, confirmText: "Delete" })) return;
	try {
		await api.del(`/files/${f.id}`);
		files.value = files.value.filter((x) => x.id !== f.id);
	} catch (err) {
		notifyError(err);
	}
}

function download(f: FileRow) {
	window.open(`/api/files/${f.id}/download`, "_blank");
}

const previewing = ref<FileRow | null>(null);
const previewBlobUrl = ref<string | null>(null);
const previewText = ref<string | null>(null);
const previewLoading = ref(false);

function previewable(f: FileRow) {
	return (
		f.mimeType.startsWith("image/") ||
		f.mimeType.startsWith("video/") ||
		f.mimeType.startsWith("audio/") ||
		f.mimeType === "application/pdf" ||
		f.mimeType.startsWith("text/") ||
		f.mimeType === "application/json" ||
		f.mimeType === "application/xml"
	);
}

async function openPreview(f: FileRow) {
	previewing.value = f;
	previewBlobUrl.value = null;
	previewText.value = null;
	previewLoading.value = true;
	try {
		const res = await fetch(`/api/files/${f.id}/preview`, { credentials: "include" });
		const isText =
			f.mimeType.startsWith("text/") ||
			f.mimeType === "application/json" ||
			f.mimeType === "application/xml";
		if (isText) {
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
}

function closePreview() {
	if (previewBlobUrl.value) URL.revokeObjectURL(previewBlobUrl.value);
	previewing.value = null;
	previewBlobUrl.value = null;
	previewText.value = null;
	editMode.value = false;
	editContent.value = "";
}

function onPreviewKey(e: KeyboardEvent) {
	if (e.key === "Escape") closePreview();
}

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

function enterEdit() {
	editContent.value = previewText.value ?? "";
	editMode.value = true;
}

async function saveEdit() {
	if (!previewing.value) return;
	saving.value = true;
	try {
		const { file: updated } = await api.patch<{ file: FileRow }>(
			`/files/${previewing.value.id}/content`,
			{ content: editContent.value },
		);
		previewText.value = editContent.value;
		const idx = files.value.findIndex((f) => f.id === updated.id);
		if (idx >= 0) files.value[idx] = { ...files.value[idx], ...updated };
		editMode.value = false;
		notify("Saved", "success");
	} catch (err) {
		notifyError(err);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="px-8 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
			<div class="text-xs text-[var(--color-fg-subtle)]">
				{{ files.length }} files · 5 MB per-file cap
			</div>
			<Button variant="primary" size="sm" :loading="uploading" @click="inputRef?.click()">
				<Upload class="h-3.5 w-3.5" />
				Upload
			</Button>
			<input
				ref="inputRef"
				type="file"
				multiple
				class="hidden"
				@change="upload(($event.target as HTMLInputElement).files)"
			/>
		</div>

		<div class="flex-1 overflow-y-auto p-8 space-y-4">
			<div
				class="card border-dashed py-10 text-center text-sm text-[var(--color-fg-subtle)] cursor-pointer transition-colors"
				:class="{ 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]': dragOver }"
				@dragover.prevent="dragOver = true"
				@dragleave="dragOver = false"
				@drop.prevent="
					(dragOver = false), upload(($event as DragEvent).dataTransfer?.files ?? null)
				"
				@click="inputRef?.click()"
			>
				drop files here or click to browse
			</div>

			<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				<div
					v-for="f in files"
					:key="f.id"
					class="card card-hover overflow-hidden flex flex-col"
				>
					<div
						class="h-36 bg-[var(--color-bg-elevated)] grid place-items-center border-b border-[var(--color-border)] overflow-hidden"
					>
						<img
							v-if="f.mimeType.startsWith('image/')"
							:src="`/api/files/${f.id}/preview`"
							:alt="f.name"
							class="h-full w-full object-cover"
						/>
						<embed
							v-else-if="f.mimeType === 'application/pdf'"
							:src="`/api/files/${f.id}/preview#toolbar=0&navpanes=0`"
							type="application/pdf"
							class="h-full w-full"
						/>
						<FileIcon v-else class="h-8 w-8 text-[var(--color-fg-subtle)]" />
					</div>
					<div class="p-3 flex items-center gap-3">
						<div class="min-w-0 flex-1">
							<div class="text-sm truncate">{{ f.name }}</div>
							<div class="text-[11px] text-[var(--color-fg-subtle)]">
								{{ formatBytes(f.sizeBytes) }} · {{ timeAgo(f.createdAt) }}
							</div>
						</div>
						<button
							v-if="previewable(f)"
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-hover)]"
							title="Preview"
							@click="openPreview(f)"
						>
							<Eye class="h-4 w-4" />
						</button>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-hover)]"
							title="Download"
							@click="download(f)"
						>
							<Download class="h-4 w-4" />
						</button>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
							@click="remove(f)"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-150"
			enter-from-class="opacity-0"
			leave-active-class="transition-opacity duration-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="previewing"
				class="fixed inset-0 z-50 bg-black/90 flex flex-col"
				@keydown="onPreviewKey"
				tabindex="-1"
			>
				<header class="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-white truncate">{{ previewing.name }}</p>
						<p class="text-[11px] text-white/50">
							{{ formatBytes(previewing.sizeBytes) }} · {{ previewing.mimeType }}
						</p>
					</div>
					<div class="flex items-center gap-2 ml-4">
						<template v-if="isMarkdown(previewing) && previewText !== null">
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
						<Button size="sm" variant="outline" @click="download(previewing)">
							<Download class="h-3.5 w-3.5" />
							Download
						</Button>
						<button
							class="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
							@click="closePreview"
						>
							<X class="h-5 w-5" />
						</button>
					</div>
				</header>

				<div class="flex-1 overflow-auto flex items-center justify-center p-6" @click.self="closePreview">
					<div v-if="previewLoading" class="text-white/50 text-sm">Loading…</div>

					<template v-else-if="previewBlobUrl">
						<img
							v-if="previewing.mimeType.startsWith('image/')"
							:src="previewBlobUrl"
							:alt="previewing.name"
							class="max-h-full max-w-full object-contain rounded"
						/>
						<embed
							v-else-if="previewing.mimeType === 'application/pdf'"
							:src="previewBlobUrl"
							type="application/pdf"
							class="w-full rounded"
							style="height: 80vh"
						/>
						<video
							v-else-if="previewing.mimeType.startsWith('video/')"
							:src="previewBlobUrl"
							controls
							class="max-h-full max-w-full rounded"
						/>
						<audio
							v-else-if="previewing.mimeType.startsWith('audio/')"
							:src="previewBlobUrl"
							controls
							class="w-80"
						/>
					</template>

					<template v-else-if="previewText !== null">
						<div
							v-if="isMarkdown(previewing) && !editMode"
							class="bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] p-8 max-h-full overflow-auto max-w-3xl w-full"
						>
							<Markdown :source="previewText" />
						</div>
						<textarea
							v-else-if="isMarkdown(previewing) && editMode"
							v-model="editContent"
							class="w-full max-w-3xl bg-[var(--color-bg)] text-[var(--color-fg)] rounded-lg border border-[var(--color-border)] p-6 font-mono text-sm resize-none outline-none focus:border-[var(--color-accent)] transition-colors"
							style="height: 80vh"
							placeholder="Write markdown here…"
						/>
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
