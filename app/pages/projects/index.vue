<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Plus } from "lucide-vue-next";
import Badge from "~/components/ui/Badge.vue";
import Button from "~/components/ui/Button.vue";
import Dialog from "~/components/ui/Dialog.vue";
import Input from "~/components/ui/Input.vue";
import Skeleton from "~/components/ui/Skeleton.vue";
import Textarea from "~/components/ui/Textarea.vue";
import { notify, notifyError } from "~/lib/notify";
import { useProjects } from "~/stores/projects";
import { useSession } from "~/stores/session";
import { timeAgo } from "~/lib/utils";
import { useRoute, navigateTo } from "nuxt/app";

const session = useSession();
const projects = useProjects();

const dialogOpen = ref(false);
const form = ref({
	key: "",
	name: "",
	description: "",
	color: "#3b82f6",
	repoUrl: "",
	productionUrl: "",
});
const saving = ref(false);

onMounted(() => projects.ensureLoaded());

const canCreate = () => session.user?.role !== "member";

async function submit() {
	saving.value = true;
	try {
		const p = await projects.create({
			key: form.value.key.toUpperCase(),
			name: form.value.name,
			description: form.value.description || undefined,
			color: form.value.color,
			repoUrl: form.value.repoUrl || undefined,
			productionUrl: form.value.productionUrl || undefined,
		});
		dialogOpen.value = false;
		form.value = {
			key: "",
			name: "",
			description: "",
			color: "#3b82f6",
			repoUrl: "",
			productionUrl: "",
		};
		notify(`Created ${p.key}`, "success");
		navigateTo({ name: "project-board", params: { key: p.key } });
	} catch (err) {
		notifyError(err);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<div class="flex-1 overflow-y-auto">
		<header
			class="border-b border-[var(--color-border)] px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3"
		>
			<div>
				<h1 class="text-xl font-semibold tracking-tight">Projects</h1>
				<p class="text-xs text-[var(--color-fg-subtle)] mt-1">
					{{ projects.items.length }} total
				</p>
			</div>
			<Button v-if="canCreate()" variant="primary" @click="dialogOpen = true">
				<Plus class="h-4 w-4" />
				New project
			</Button>
		</header>

		<div class="p-4 sm:p-8">
			<div class="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
				<template v-if="projects.loading && !projects.items.length">
					<div v-for="n in 6" :key="`sk-${n}`" class="card p-5 flex flex-col gap-3">
						<div class="flex items-start justify-between">
							<Skeleton width="h-10 w-10" height="h-10" class="rounded-md" />
						</div>
						<div class="space-y-2">
							<Skeleton width="w-12" height="h-2.5" />
							<Skeleton width="w-32" height="h-4" />
							<Skeleton :lines="2" height="h-2.5" />
						</div>
						<div class="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
							<Skeleton width="w-16" height="h-2.5" />
							<Skeleton width="w-20" height="h-2.5" />
						</div>
					</div>
				</template>
				<NuxtLink
					v-for="p in projects.items"
					:key="p.id"
					:to="{ name: 'project-board', params: { key: p.key } }"
					class="card card-hover p-5 flex flex-col gap-3 relative overflow-hidden"
				>
					<div
						class="absolute -top-16 -right-16 h-32 w-32 rounded-full opacity-40 blur-2xl"
						:style="{ background: p.color }"
					/>
					<div class="flex items-start justify-between relative">
						<div
							class="h-10 w-10 rounded-md grid place-items-center text-white text-sm font-bold"
							:style="{ background: p.color }"
						>
							{{ p.icon || p.key.slice(0, 2) }}
						</div>
						<Badge
							v-if="p.status !== 'active'"
							:tone="p.status === 'archived' ? 'slate' : 'amber'"
						>
							{{ p.status }}
						</Badge>
					</div>
					<div class="relative">
						<div class="mono text-[10px] text-[var(--color-fg-subtle)]">{{ p.key }}</div>
						<h3 class="text-base font-semibold text-[var(--color-fg)]">{{ p.name }}</h3>
						<p
							v-if="p.description"
							class="text-xs text-[var(--color-fg-muted)] mt-1 line-clamp-2"
						>
							{{ p.description }}
						</p>
					</div>
					<div class="flex items-center justify-between text-[11px] text-[var(--color-fg-subtle)] pt-2 border-t border-[var(--color-border)] relative">
						<span>{{ p.issueCounter }} issues</span>
						<span>updated {{ timeAgo(p.updatedAt) }}</span>
					</div>
				</NuxtLink>

				<button
				v-if="canCreate() && !projects.loading && !projects.items.length"
				class="card card-hover p-5 border-dashed flex flex-col items-center justify-center text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] py-16"
				@click="dialogOpen = true"
			>
					<Plus class="h-6 w-6 mb-2" />
					<span class="text-sm">Create your first project</span>
				</button>
			</div>
		</div>

		<Dialog
			v-model:open="dialogOpen"
			title="New project"
			description="A project is a self-contained board with its own issues, sprints, secrets and files."
			width="520px"
		>
			<div class="p-5 space-y-4">
				<div class="grid grid-cols-[1fr_auto] gap-3">
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
							Name
						</label>
						<Input v-model="form.name" placeholder="Runner X" />
					</div>
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
							Key
						</label>
						<Input
							v-model="form.key"
							class="w-24 mono uppercase"
							placeholder="RUN"
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Description</label>
					<Textarea v-model="form.description" :rows="3" placeholder="What is this project about?" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Repo URL</label>
						<Input v-model="form.repoUrl" placeholder="https://github.com/…" />
					</div>
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Production URL</label>
						<Input v-model="form.productionUrl" placeholder="https://…" />
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Accent</label>
					<div class="flex gap-2">
						<button
							v-for="c in ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899']"
							:key="c"
							type="button"
							class="h-7 w-7 rounded-md border-2 transition-transform"
							:class="form.color === c ? 'border-white scale-105' : 'border-transparent'"
							:style="{ background: c }"
							@click="form.color = c"
						/>
					</div>
				</div>
			</div>
			<template #footer>
				<Button variant="ghost" @click="dialogOpen = false">Cancel</Button>
				<Button variant="primary" :loading="saving" @click="submit">Create</Button>
			</template>
		</Dialog>
	</div>
</template>
