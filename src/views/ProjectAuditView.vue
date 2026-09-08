<script setup lang="ts">
import { inject, onMounted, ref, type Ref } from "vue";
import Avatar from "@/components/ui/Avatar.vue";
import Badge from "@/components/ui/Badge.vue";
import { api, type AuditEntry, type Project } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import { timeAgo } from "@/lib/utils";

const project = inject<Ref<Project | null>>("project")!;
const entries = ref<AuditEntry[]>([]);

async function load() {
	if (!project.value) return;
	try {
		const { entries: rows } = await api.get<{ entries: AuditEntry[] }>(
			`/projects/${project.value.key}/audit`,
		);
		entries.value = rows;
	} catch (err) {
		notifyError(err);
	}
}

onMounted(load);

function toneFor(action: string) {
	if (action.startsWith("secret") || action.startsWith("envvar")) return "amber";
	if (action.startsWith("file")) return "blue";
	if (action.startsWith("project") || action.startsWith("member")) return "violet";
	return "neutral";
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="px-8 py-3 border-b border-[var(--color-border)] text-xs text-[var(--color-fg-subtle)]">
			last 200 events in this project
		</div>
		<div class="flex-1 overflow-y-auto p-8">
			<div class="card divide-y divide-[var(--color-border)]">
				<div
					v-for="e in entries"
					:key="e.id"
					class="px-4 py-3 flex items-center gap-3"
				>
					<Avatar
						v-if="e.actor?.name"
						:name="e.actor.name"
						:src="e.actor.avatarUrl"
						size="sm"
					/>
					<div v-else class="h-6 w-6 rounded-full bg-[var(--color-panel-hover)]" />
					<div class="min-w-0 flex-1">
						<div class="text-sm">
							<span class="font-medium">{{ e.actor?.name ?? "unknown" }}</span>
							<span class="text-[var(--color-fg-muted)]"> · </span>
							<Badge :tone="toneFor(e.action) as any" class="mono">
								{{ e.action }}
							</Badge>
							<span v-if="e.targetName" class="mono text-xs text-[var(--color-fg-muted)] ml-2">
								{{ e.targetName }}
							</span>
						</div>
						<div class="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">
							{{ timeAgo(e.createdAt) }}
							<span v-if="e.ip"> · from {{ e.ip }}</span>
							<span
								v-if="e.meta && (e.meta as any).reason"
								class="italic"
							>
								· “{{ (e.meta as any).reason }}”
							</span>
						</div>
					</div>
				</div>
				<div v-if="!entries.length" class="text-center py-10 text-sm text-[var(--color-fg-subtle)]">
					no events yet.
				</div>
			</div>
		</div>
	</div>
</template>
