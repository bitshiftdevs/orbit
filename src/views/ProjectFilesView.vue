<script setup lang="ts">
import { inject, onMounted, ref, type Ref } from "vue";
import { Download, File as FileIcon, Trash2, Upload } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
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
							:src="`/api/files/${f.id}/download`"
							:alt="f.name"
							class="h-full w-full object-cover"
						/>
						<embed
							v-else-if="f.mimeType === 'application/pdf'"
							:src="`/api/files/${f.id}/download#toolbar=0&navpanes=0`"
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
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-hover)]"
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
</template>
