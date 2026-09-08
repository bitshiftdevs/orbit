<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Sparkles } from "lucide-vue-next";
import Avatar from "@/components/ui/Avatar.vue";
import Badge from "@/components/ui/Badge.vue";
import { api, type Issue } from "@/lib/api";
import { STATUS_META } from "@/components/issue/meta";
import { useSession } from "@/stores/session";
import { useProjects } from "@/stores/projects";

const session = useSession();
const projectStore = useProjects();

const mine = ref<Array<Issue & { projectKey: string }>>([]);
const loading = ref(true);

onMounted(async () => {
	await projectStore.load();
	// Fetch issues across all my projects.
	const all: Array<Issue & { projectKey: string }> = [];
	for (const p of projectStore.items) {
		try {
			const { issues } = await api.get<{ issues: Issue[] }>(
				`/projects/${p.key}/issues`,
			);
			for (const i of issues) {
				if (i.assigneeId === session.user?.id && i.status !== "done" && i.status !== "cancelled") {
					all.push({ ...i, projectKey: p.key });
				}
			}
		} catch {}
	}
	mine.value = all;
	loading.value = false;
});
</script>

<template>
	<div class="flex-1 overflow-y-auto">
		<header class="border-b border-[var(--color-border)] px-8 py-5 flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold tracking-tight">
					Hey {{ session.user?.name?.split(" ")[0] ?? "there" }}
					<span class="text-[var(--color-fg-subtle)] font-normal ml-1">— welcome back.</span>
				</h1>
				<p class="text-xs text-[var(--color-fg-subtle)] mt-1">
					{{ new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) }}
				</p>
			</div>
			<Badge tone="blue" dot>
				<Sparkles class="h-3 w-3 mr-1" />
				{{ mine.length }} open · assigned to you
			</Badge>
		</header>

		<div class="p-8 grid gap-8 xl:grid-cols-3">
			<section class="xl:col-span-2">
				<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold mb-3">
					My work
				</h2>
				<div class="card divide-y divide-[var(--color-border)]">
					<router-link
						v-for="i in mine"
						:key="i.id"
						:to="{ name: 'project-board', params: { key: i.projectKey } }"
						class="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-panel-hover)] transition-colors"
					>
						<component
							:is="STATUS_META[i.status].icon"
							class="h-4 w-4"
							:class="STATUS_META[i.status].text"
						/>
						<span class="mono text-[11px] text-[var(--color-fg-subtle)] w-16 shrink-0">
							{{ i.key }}
						</span>
						<span class="flex-1 truncate text-sm">{{ i.title }}</span>
						<Badge :tone="i.priority === 'urgent' ? 'red' : i.priority === 'high' ? 'amber' : 'neutral'">
							{{ i.priority }}
						</Badge>
					</router-link>
					<div
						v-if="!loading && mine.length === 0"
						class="text-center py-8 text-sm text-[var(--color-fg-subtle)]"
					>
						nothing on your plate — nice.
					</div>
				</div>
			</section>

			<section>
				<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold mb-3">
					Projects
				</h2>
				<div class="space-y-2">
					<router-link
						v-for="p in projectStore.items"
						:key="p.id"
						:to="{ name: 'project-board', params: { key: p.key } }"
						class="card card-hover p-3 flex items-center gap-3"
					>
						<div
							class="h-8 w-8 rounded-md grid place-items-center text-white text-xs font-bold"
							:style="{ background: p.color }"
						>
							{{ p.key.slice(0, 2) }}
						</div>
						<div class="min-w-0 flex-1">
							<div class="text-sm font-medium truncate">{{ p.name }}</div>
							<div class="mono text-[10px] text-[var(--color-fg-subtle)]">
								{{ p.key }} · {{ p.issueCounter }} issues
							</div>
						</div>
						<Badge
							v-if="p.status !== 'active'"
							:tone="p.status === 'archived' ? 'slate' : 'amber'"
						>
							{{ p.status }}
						</Badge>
					</router-link>
					<router-link
						v-if="!projectStore.items.length"
						:to="{ name: 'projects' }"
						class="card p-4 text-center text-sm text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
					>
						+ create your first project
					</router-link>
				</div>
			</section>
		</div>
	</div>
</template>
