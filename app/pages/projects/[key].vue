<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from "vue";
import { ExternalLink, Github } from "lucide-vue-next";
import Badge from "~/components/ui/Badge.vue";
import { type Project, type SessionUser } from "~/lib/api";
import { notifyError } from "~/lib/notify";
import { useProjects } from "~/stores/projects";
import { useRoute } from "nuxt/app";

const route = useRoute();
const projects = useProjects();

const project = ref<Project | null>(null);
const members = ref<
	Array<
		Pick<SessionUser, "id" | "name" | "handle" | "email" | "avatarUrl" | "accentColor" | "role"> & {
			joinedAt: string;
		}
	>
>([]);

const key = computed(() => (route.params.key as string).toUpperCase());

async function load() {
	try {
		const res = await projects.get(key.value);
		project.value = res.project;
		members.value = res.members;
	} catch (err) {
		notifyError(err);
	}
}

onMounted(load);
watch(key, load);

provide("project", project);
provide("members", members);

const tabs = [
	{ name: "project-board", label: "Board" },
	{ name: "project-backlog", label: "Backlog" },
	{ name: "project-sprints", label: "Sprints" },
	{ name: "project-secrets", label: "Secrets" },
	{ name: "project-files", label: "Files" },
	{ name: "project-webhooks", label: "Webhooks" },
	{ name: "project-audit", label: "Audit" },
];
</script>

<template>
	<div class="flex-1 flex flex-col overflow-hidden">
		<header
			v-if="project"
			class="border-b border-[var(--color-border)] px-8 pt-5"
		>
			<div class="flex items-center gap-3">
				<div
					class="h-10 w-10 rounded-md grid place-items-center text-white text-sm font-bold shrink-0"
					:style="{ background: project.color }"
				>
					{{ project.key.slice(0, 2) }}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="mono text-[11px] text-[var(--color-fg-subtle)]">
							{{ project.key }}
						</span>
						<Badge
							v-if="project.status !== 'active'"
							:tone="project.status === 'archived' ? 'slate' : 'amber'"
						>
							{{ project.status }}
						</Badge>
					</div>
					<h1 class="text-lg font-semibold tracking-tight truncate">
						{{ project.name }}
					</h1>
				</div>
				<div class="flex items-center gap-2">
					<a
						v-if="project.repoUrl"
						:href="project.repoUrl"
						target="_blank"
						rel="noopener"
						class="p-2 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)]"
						title="Repository"
					>
						<Github class="h-4 w-4" />
					</a>
					<a
						v-if="project.productionUrl"
						:href="project.productionUrl"
						target="_blank"
						rel="noopener"
						class="p-2 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)]"
						title="Production"
					>
						<ExternalLink class="h-4 w-4" />
					</a>
				</div>
			</div>
			<nav class="flex items-center gap-1 mt-5 -mb-px">
				<NuxtLink
					v-for="t in tabs"
					:key="t.name"
					:to="{ name: t.name, params: { key: project.key } }"
					class="px-3 py-2 text-sm text-[var(--color-fg-muted)] border-b-2 border-transparent hover:text-[var(--color-fg)] transition-colors"
					active-class=""
					exact-active-class="text-[var(--color-fg)] border-[var(--color-accent)]"
				>
					{{ t.label }}
				</NuxtLink>
			</nav>
		</header>
		<div class="flex-1 overflow-hidden">
			<NuxtPage v-if="project" />
		</div>
	</div>
</template>
