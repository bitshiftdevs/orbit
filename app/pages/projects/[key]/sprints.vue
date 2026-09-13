<script setup lang="ts">
definePageMeta({ name: "project-sprints" });
import { inject, onMounted, ref, watch, type Ref } from "vue";
import { BarChart3, Play, Plus, Check, RefreshCw, TrendingUp } from "lucide-vue-next";
import Badge from "~/components/ui/Badge.vue";
import BurndownChart from "~/components/BurndownChart.vue";
import VelocityChart from "~/components/VelocityChart.vue";
import Button from "~/components/ui/Button.vue";
import Dialog from "~/components/ui/Dialog.vue";
import Input from "~/components/ui/Input.vue";
import Textarea from "~/components/ui/Textarea.vue";
import DatePicker from "~/components/ui/DatePicker.vue";
import { api } from "~/lib/api";
import type { CycleTimeEntry, Project, Sprint, SprintBurndown, SprintVelocity } from "~/types/domain";
import { notify, notifyError } from "~/lib/notify";
import { timeAgo } from "~/lib/utils";

const project = inject<Ref<Project | null>>("project")!;

const sprints = ref<Sprint[]>([]);
const dialogOpen = ref(false);
const form = ref({ name: "", goal: "", startsAt: "", endsAt: "" });
const refreshing = ref(false);
const velocity = ref<SprintVelocity[]>([]);
const cycleTime = ref<CycleTimeEntry[]>([]);
const analyticsOpen = ref(false);

async function load(force = false) {
	if (!project.value) return;
	refreshing.value = true;
	try {
		const [{ sprints: rows }, { velocity: v }, { cycleTime: ct }] = await Promise.all([
			api.get<{ sprints: Sprint[] }>(`/projects/${project.value.key}/sprints`, { force }),
			api.get<{ velocity: SprintVelocity[] }>(`/projects/${project.value.key}/velocity`, { force }),
			api.get<{ cycleTime: CycleTimeEntry[] }>(`/projects/${project.value.key}/cycle-time`, { force }),
		]);
		sprints.value = rows;
		velocity.value = v;
		cycleTime.value = ct;
	} catch (err) {
		notifyError(err);
	} finally {
		refreshing.value = false;
	}
}

onMounted(load);
watch(() => project.value?.key, (key, prev) => { if (key && key !== prev) load(); });

async function create() {
	if (!project.value) return;
	try {
		const { sprint } = await api.post<{ sprint: Sprint }>(
			`/projects/${project.value.key}/sprints`,
			{
				name: form.value.name,
				goal: form.value.goal || undefined,
				startsAt: form.value.startsAt
					? new Date(form.value.startsAt).toISOString()
					: null,
				endsAt: form.value.endsAt
					? new Date(form.value.endsAt).toISOString()
					: null,
			},
		);
		sprints.value.unshift(sprint);
		dialogOpen.value = false;
		form.value = { name: "", goal: "", startsAt: "", endsAt: "" };
		notify("Sprint created", "success");
	} catch (err) {
		notifyError(err);
	}
}

async function setStatus(s: Sprint, status: Sprint["status"]) {
	try {
		const { sprint } = await api.patch<{ sprint: Sprint }>(
			`/sprints/${s.id}`,
			{ status },
		);
		const i = sprints.value.findIndex((x) => x.id === s.id);
		if (i >= 0) sprints.value[i] = sprint;
	} catch (err) {
		notifyError(err);
	}
}

const openSprintId = ref<string | null>(null);
const burndown = ref<SprintBurndown | null>(null);
const burndownLoading = ref(false);

async function toggleBurndown(s: Sprint) {
	if (openSprintId.value === s.id) {
		openSprintId.value = null;
		return;
	}
	openSprintId.value = s.id;
	burndown.value = null;
	burndownLoading.value = true;
	try {
		burndown.value = await api.get<SprintBurndown>(`/sprints/${s.id}/burndown`);
	} catch (err) {
		notifyError(err);
	} finally {
		burndownLoading.value = false;
	}
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="flex items-center justify-between px-8 py-3 border-b border-[var(--color-border)]">
			<div class="text-xs text-[var(--color-fg-subtle)]">
				{{ sprints.length }} sprints
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
				<Button variant="ghost" size="sm" @click="analyticsOpen = !analyticsOpen">
					<TrendingUp class="h-3.5 w-3.5" />
					Analytics
				</Button>
				<Button variant="primary" size="sm" @click="dialogOpen = true">
					<Plus class="h-3.5 w-3.5" />
					New sprint
				</Button>
			</div>
		</div>

		<!-- Analytics panel -->
		<div v-if="analyticsOpen" class="px-8 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] space-y-4">
			<VelocityChart :sprints="velocity" />
			<div v-if="cycleTime.length" class="card p-4">
				<div class="text-xs text-[var(--color-fg-subtle)] uppercase tracking-widest mb-3">Cycle time (avg days to completion)</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
					<div
						v-for="ct in cycleTime"
						:key="ct.type"
						class="text-center p-3 rounded-md bg-[var(--color-panel)]"
					>
						<div class="text-2xl font-semibold mono text-[var(--color-accent)]">{{ ct.avgDays }}</div>
						<div class="text-[11px] text-[var(--color-fg-subtle)] mt-0.5 capitalize">{{ ct.type }}</div>
						<div class="text-[10px] text-[var(--color-fg-subtle)]">{{ ct.count }} issues</div>
					</div>
				</div>
			</div>
			<div v-else-if="!refreshing" class="text-center text-sm text-[var(--color-fg-subtle)] py-4">
				No completed issues to calculate cycle time yet.
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-8 py-4 space-y-3">
			<div v-for="s in sprints" :key="s.id" class="card p-4">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<h3 class="text-sm font-semibold">{{ s.name }}</h3>
							<Badge
								dot
								:tone="s.status === 'active' ? 'blue' : s.status === 'completed' ? 'green' : 'slate'"
							>
								{{ s.status }}
							</Badge>
						</div>
						<p v-if="s.goal" class="text-xs text-[var(--color-fg-muted)] mt-1">
							{{ s.goal }}
						</p>
						<div class="text-[11px] text-[var(--color-fg-subtle)] mt-2 flex gap-4">
							<span v-if="s.startsAt">Starts {{ new Date(s.startsAt).toLocaleDateString() }}</span>
							<span v-if="s.endsAt">Ends {{ new Date(s.endsAt).toLocaleDateString() }}</span>
							<span>Created {{ timeAgo(s.createdAt) }}</span>
						</div>
					</div>
					<div class="flex items-center gap-1">
						<Button
							size="sm"
							variant="ghost"
							@click="toggleBurndown(s)"
							:title="openSprintId === s.id ? 'Hide burndown' : 'Show burndown'"
						>
							<BarChart3 class="h-3 w-3" />
						</Button>
						<Button
							v-if="s.status === 'planned'"
							size="sm"
							variant="outline"
							@click="setStatus(s, 'active')"
						>
							<Play class="h-3 w-3" />
							Start
						</Button>
						<Button
							v-if="s.status === 'active'"
							size="sm"
							variant="outline"
							@click="setStatus(s, 'completed')"
						>
							<Check class="h-3 w-3" />
							Complete
						</Button>
					</div>
				</div>
				<div v-if="openSprintId === s.id" class="mt-4">
					<div v-if="burndownLoading" class="text-xs text-[var(--color-fg-subtle)]">
						loading burndown…
					</div>
					<BurndownChart
						v-else-if="burndown"
						:days="burndown.days"
						:total="burndown.total"
					/>
				</div>
			</div>
			<div v-if="!sprints.length" class="text-center py-12 text-sm text-[var(--color-fg-subtle)]">
				no sprints yet — create one to plan a slice of work.
			</div>
		</div>

		<Dialog v-model:open="dialogOpen" title="New sprint" width="480px">
			<div class="p-5 space-y-4">
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
					<Input v-model="form.name" placeholder="Sprint 12 · Launch prep" />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Goal</label>
					<Textarea v-model="form.goal" :rows="3" placeholder="What are we trying to achieve?" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Starts</label>
						<DatePicker v-model="form.startsAt" />
					</div>
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Ends</label>
						<DatePicker v-model="form.endsAt" />
					</div>
				</div>
			</div>
			<template #footer>
				<Button variant="ghost" @click="dialogOpen = false">Cancel</Button>
				<Button variant="primary" @click="create">Create</Button>
			</template>
		</Dialog>
	</div>
</template>
