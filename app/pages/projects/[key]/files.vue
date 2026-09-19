<script setup lang="ts">
definePageMeta({ name: "project-files" });
import { inject, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { Download, Eye, File as FileIcon, FilePlus, RefreshCw, Trash2, Upload } from "lucide-vue-next";
import Button from "~/components/ui/Button.vue";
import Dialog from "~/components/ui/Dialog.vue";
import Skeleton from "~/components/ui/Skeleton.vue";
import FilePreview from "~/components/files/FilePreview.vue";
import { api } from "~/lib/api";
import type { FileRow, Project } from "~/types/domain";
import { notify, notifyError } from "~/lib/notify";
import { formatBytes, timeAgo } from "~/lib/utils";
import { useConfirmDialog } from "~/composables/useConfirmDialog";

const { confirm } = useConfirmDialog();
const project = inject<Ref<Project | null>>("project")!;

const files = ref<FileRow[]>([]);
const uploading = ref(false);
const dragOver = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const previewing = ref<FileRow | null>(null);
const refreshing = ref(false);
const initialLoading = ref(true);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const thumbUrls = ref<Record<string, string>>({});

async function loadThumb(f: FileRow) {
	if (thumbUrls.value[f.id]) return;
	if (!f.mimeType.startsWith("image/") && f.mimeType !== "application/pdf") return;
	try {
		const blob = await api.raw<Blob>(`/files/${f.id}/preview`);
		thumbUrls.value[f.id] = URL.createObjectURL(blob);
	} catch {}
}

watch(files, (rows) => rows.forEach(loadThumb));
onUnmounted(() => Object.values(thumbUrls.value).forEach(URL.revokeObjectURL));

async function load(force = false) {
	if (!project.value) return;
	refreshing.value = true;
	try {
		const { files: rows } = await api.get<{ files: FileRow[] }>(
			`/projects/${project.value.key}/files`,
			{ force },
		);
		files.value = rows;
		rows.forEach(loadThumb);
	} catch (err) {
		notifyError(err);
	} finally {
		refreshing.value = false;
		initialLoading.value = false;
	}
}

onMounted(load);
watch(() => project.value?.key, (key, prev) => { if (key && key !== prev) load(); });

async function upload(list: FileList | null) {
	if (!list || !project.value) return;
	uploading.value = true;
	try {
		for (const file of Array.from(list)) {
			if (file.size > MAX_FILE_SIZE) {
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

function onFileSaved(updated: FileRow) {
	const idx = files.value.findIndex((f) => f.id === updated.id);
	if (idx >= 0) files.value[idx] = { ...files.value[idx], ...updated };
}

const createOpen = ref(false);
const createName = ref("");
const createSaving = ref(false);

function openCreate() {
	createName.value = "";
	createOpen.value = true;
}

async function createMarkdown() {
	if (!project.value || createSaving.value) return;
	const raw = createName.value.trim();
	if (!raw) return;
	const name = /\.md$|\.markdown$/i.test(raw) ? raw : `${raw}.md`;
	createSaving.value = true;
	try {
		const { file: row } = await api.post<{ file: FileRow }>(
			`/projects/${project.value.key}/files/markdown`,
			{ name, content: "" },
		);
		files.value.unshift(row);
		createOpen.value = false;
		previewing.value = row;
		notify("Created", "success");
	} catch (err) {
		notifyError(err);
	} finally {
		createSaving.value = false;
	}
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="px-8 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
			<div class="text-xs text-[var(--color-fg-subtle)]">
				{{ files.length }} files · 5 MB per-file cap
			</div>
			<div class="flex items-center gap-2">
				<button
					class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)] disabled:opacity-40"
					title="Refresh"
					:disabled="refreshing"
					@click="load(true)"
				>
					<RefreshCw class="h-3.5 w-3.5" :class="refreshing && 'animate-spin'" />
				</button>
				<Button variant="outline" size="sm" @click="openCreate">
					<FilePlus class="h-3.5 w-3.5" />
					New markdown
				</Button>
				<Button variant="primary" size="sm" :loading="uploading" @click="inputRef?.click()">
					<Upload class="h-3.5 w-3.5" />
					Upload
				</Button>
			</div>
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
				@drop.prevent="(dragOver = false), upload(($event as DragEvent).dataTransfer?.files ?? null)"
				@click="inputRef?.click()"
			>
				drop files here or click to browse
			</div>

			<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				<template v-if="initialLoading">
					<div v-for="n in 6" :key="`sk-${n}`" class="card overflow-hidden flex flex-col">
						<Skeleton width="w-full" height="h-36" class="rounded-none" />
						<div class="p-3 flex items-center gap-3">
							<div class="min-w-0 flex-1 space-y-1.5">
								<Skeleton width="w-32" height="h-3.5" />
								<Skeleton width="w-24" height="h-2.5" />
							</div>
							<Skeleton width="h-7 w-7" height="h-7" />
						</div>
					</div>
				</template>
				<div
					v-for="f in files"
					:key="f.id"
					class="card card-hover overflow-hidden flex flex-col"
				>
					<div class="h-36 bg-[var(--color-bg-elevated)] grid place-items-center border-b border-[var(--color-border)] overflow-hidden">
						<img
							v-if="f.mimeType.startsWith('image/') && thumbUrls[f.id]"
							:src="thumbUrls[f.id]"
							:alt="f.name"
							class="h-full w-full object-cover"
						/>
						<embed
							v-else-if="f.mimeType === 'application/pdf' && thumbUrls[f.id]"
							:src="thumbUrls[f.id]"
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
							@click="previewing = f"
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

	<FilePreview
		:file="previewing"
		@close="previewing = null"
		@saved="onFileSaved"
	/>

	<Dialog
		:open="createOpen"
		title="New markdown file"
		description="Give the file a name — .md is added if you leave it off."
		@update:open="createOpen = $event"
	>
		<form class="px-5 py-4 space-y-3" @submit.prevent="createMarkdown">
			<label class="block text-xs text-[var(--color-fg-muted)]">Filename</label>
			<input
				v-model="createName"
				type="text"
				maxlength="255"
				autofocus
				placeholder="notes.md"
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
				:disabled="createSaving"
			/>
		</form>
		<template #footer>
			<Button variant="ghost" size="sm" :disabled="createSaving" @click="createOpen = false">
				Cancel
			</Button>
			<Button
				variant="primary"
				size="sm"
				:loading="createSaving"
				:disabled="!createName.trim()"
				@click="createMarkdown"
			>
				Create
			</Button>
		</template>
	</Dialog>
</template>
