<script setup lang="ts">
definePageMeta({ name: "project-settings" });
import { inject, ref, watch, type Ref } from "vue";
import Button from "~/components/ui/Button.vue";
import Input from "~/components/ui/Input.vue";
import Textarea from "~/components/ui/Textarea.vue";
import { api, type Project } from "~/lib/api";
import { notify, notifyError } from "~/lib/notify";
import { useProjects } from "~/stores/projects";

const project = inject<Ref<Project | null>>("project")!;
const store = useProjects();

const form = ref({
	name: "",
	description: "",
	color: "",
	icon: "",
	repoUrl: "",
	productionUrl: "",
});
const saving = ref(false);

watch(
	() => project.value,
	(p) => {
		if (!p) return;
		form.value = {
			name: p.name,
			description: p.description ?? "",
			color: p.color,
			icon: p.icon,
			repoUrl: p.repoUrl ?? "",
			productionUrl: p.productionUrl ?? "",
		};
	},
	{ immediate: true },
);

async function save() {
	if (!project.value) return;
	saving.value = true;
	try {
		const { project: updated } = await api.patch<{ project: Project }>(
			`/projects/${project.value.key}`,
			{
				name: form.value.name || undefined,
				description: form.value.description || undefined,
				color: form.value.color || undefined,
				icon: form.value.icon || undefined,
				repoUrl: form.value.repoUrl || undefined,
				productionUrl: form.value.productionUrl || undefined,
			},
		);
		project.value = updated;
		const idx = store.items.findIndex((p) => p.id === updated.id);
		if (idx >= 0) store.items[idx] = updated;
		notify("Project updated", "success");
	} catch (err) {
		notifyError(err);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<div class="h-full overflow-y-auto px-4 sm:px-8 py-6 max-w-xl">
		<h2 class="text-sm font-semibold mb-6">Project settings</h2>
		<div class="space-y-5">
			<label class="block space-y-1">
				<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</span>
				<Input v-model="form.name" placeholder="Project name" />
			</label>
			<label class="block space-y-1">
				<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Description</span>
				<Textarea v-model="form.description" :rows="3" placeholder="What is this project about?" />
			</label>
			<div class="grid grid-cols-2 gap-4">
				<label class="block space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Color</span>
					<div class="flex items-center gap-2">
						<input
							v-model="form.color"
							type="color"
							class="h-8 w-10 rounded border border-[var(--color-border)] bg-transparent cursor-pointer p-0.5"
						/>
						<Input v-model="form.color" placeholder="#3b82f6" class="flex-1" />
					</div>
				</label>
				<label class="block space-y-1">
					<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Icon</span>
					<Input v-model="form.icon" placeholder="rocket" />
				</label>
			</div>
			<label class="block space-y-1">
				<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Repository URL</span>
				<Input v-model="form.repoUrl" placeholder="https://github.com/org/repo" />
			</label>
			<label class="block space-y-1">
				<span class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Production URL</span>
				<Input v-model="form.productionUrl" placeholder="https://example.com" />
			</label>
			<div class="pt-2">
				<Button variant="primary" :loading="saving" @click="save">Save changes</Button>
			</div>
		</div>
	</div>
</template>
