<script setup lang="ts">
import { inject, onMounted, ref, type Ref } from "vue";
import { Copy, ExternalLink, Plus, Radio, RefreshCw, Trash2, Webhook as WebhookIcon } from "lucide-vue-next";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import { api } from "@/lib/api";
import type { Project, Webhook, WebhookDelivery } from "@/types/domain";
import { notify, notifyError } from "@/lib/notify";
import { timeAgo } from "@/lib/utils";
import { useConfirmDialog } from "@/composables/useConfirmDialog";

const { confirm } = useConfirmDialog();
const project = inject<Ref<Project | null>>("project")!;

const hooks = ref<Webhook[]>([]);
const deliveries = ref<Record<string, WebhookDelivery[]>>({});
const expandedId = ref<string | null>(null);
const dialogOpen = ref(false);
const secretShown = ref<string | null>(null);

type WebhookPreset = "generic" | "slack" | "discord";

const form = ref<{
	name: string;
	url: string;
	preset: WebhookPreset;
	events: string[];
}>({
	name: "",
	url: "",
	preset: "generic",
	events: ["issue.created", "issue.status_changed"],
});

const ALL_EVENTS = [
	"issue.created",
	"issue.updated",
	"issue.status_changed",
	"issue.commented",
	"sprint.started",
	"sprint.completed",
	"secret.created",
];

const refreshing = ref(false);

async function load(force = false) {
	if (!project.value) return;
	refreshing.value = true;
	try {
		const { webhooks } = await api.get<{ webhooks: Webhook[] }>(
			`/projects/${project.value.key}/webhooks`,
			{ force },
		);
		hooks.value = webhooks;
	} catch (err) {
		notifyError(err);
	} finally {
		refreshing.value = false;
	}
}

onMounted(load);

async function create() {
	if (!project.value) return;
	try {
		const { webhook, signingSecret } = await api.post<{
			webhook: Webhook;
			signingSecret: string;
		}>(`/projects/${project.value.key}/webhooks`, form.value);
		hooks.value.unshift(webhook);
		secretShown.value = form.value.preset === "generic" ? signingSecret : null;
		dialogOpen.value = false;
		form.value = { name: "", url: "", preset: "generic", events: ["issue.created", "issue.status_changed"] };
		notify("Webhook created", "success");
	} catch (err) {
		notifyError(err);
	}
}

async function toggleActive(h: Webhook) {
	try {
		const { webhook } = await api.patch<{ webhook: Webhook }>(
			`/webhooks/${h.id}`,
			{ active: !h.active },
		);
		const i = hooks.value.findIndex((x) => x.id === h.id);
		if (i >= 0) hooks.value[i] = webhook;
	} catch (err) {
		notifyError(err);
	}
}

async function remove(h: Webhook) {
	if (!await confirm(`Delete '${h.name}'?`, { danger: true, confirmText: "Delete" })) return;
	await api.del(`/webhooks/${h.id}`);
	hooks.value = hooks.value.filter((x) => x.id !== h.id);
}

async function toggleDeliveries(h: Webhook) {
	if (expandedId.value === h.id) {
		expandedId.value = null;
		return;
	}
	expandedId.value = h.id;
	if (!deliveries.value[h.id]) {
		try {
			const { deliveries: rows } = await api.get<{ deliveries: WebhookDelivery[] }>(
				`/webhooks/${h.id}/deliveries`,
			);
			deliveries.value[h.id] = rows;
		} catch (err) {
			notifyError(err);
		}
	}
}

async function copy(v: string) {
	await navigator.clipboard.writeText(v);
	notify("Copied", "success");
}

function toggleEvent(e: string) {
	const idx = form.value.events.indexOf(e);
	if (idx >= 0) form.value.events.splice(idx, 1);
	else form.value.events.push(e);
}

function pickPreset(p: WebhookPreset) {
	form.value.preset = p;
	if (p === "slack") form.value.name = form.value.name || "Slack";
	if (p === "discord") form.value.name = form.value.name || "Discord";
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="flex items-center justify-between px-8 py-3 border-b border-[var(--color-border)]">
			<div class="text-xs text-[var(--color-fg-subtle)]">
				{{ hooks.length }} endpoints · HMAC-signed with SHA-256
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
				<Button variant="primary" size="sm" @click="dialogOpen = true">
					<Plus class="h-3.5 w-3.5" />
					New webhook
				</Button>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto p-8 space-y-3">
			<div v-for="h in hooks" :key="h.id" class="card">
				<div class="p-4 flex items-start gap-3">
					<div
						class="h-8 w-8 rounded-md grid place-items-center shrink-0"
						:class="h.active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'bg-[var(--color-panel-hover)] text-[var(--color-fg-subtle)]'"
					>
						<WebhookIcon class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<h3 class="text-sm font-semibold">{{ h.name }}</h3>
							<Badge v-if="h.preset && h.preset !== 'generic'" tone="violet">
								{{ h.preset }}
							</Badge>
							<Badge v-if="!h.active" tone="slate">paused</Badge>
						</div>
						<a
							:href="h.url"
							target="_blank"
							rel="noopener"
							class="mono text-[11px] text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] flex items-center gap-1"
						>
							{{ h.url }}
							<ExternalLink class="h-3 w-3" />
						</a>
						<div class="flex flex-wrap gap-1 mt-2">
							<Badge v-for="e in h.events" :key="e" class="mono">{{ e }}</Badge>
						</div>
					</div>
					<div class="flex items-center gap-1">
						<Button size="sm" variant="ghost" @click="toggleDeliveries(h)">
							<Radio class="h-3 w-3" />
						</Button>
						<Button size="sm" variant="outline" @click="toggleActive(h)">
							{{ h.active ? "Pause" : "Resume" }}
						</Button>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
							@click="remove(h)"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				</div>
				<div
					v-if="expandedId === h.id"
					class="border-t border-[var(--color-border)] px-4 py-3"
				>
					<h4 class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-2">
						Recent deliveries
					</h4>
					<div class="space-y-1">
						<div
							v-for="d in deliveries[h.id]"
							:key="d.id"
							class="flex items-center gap-3 text-xs"
						>
							<span
								class="mono w-14 shrink-0"
								:class="d.statusCode && d.statusCode < 300 ? 'text-emerald-400' : 'text-red-400'"
							>
								{{ d.statusCode ?? "err" }}
							</span>
							<span class="mono text-[var(--color-fg-muted)] w-40 truncate">{{ d.event }}</span>
							<span class="mono text-[var(--color-fg-subtle)]">{{ d.durationMs ?? "-" }}ms</span>
							<span class="text-[var(--color-fg-subtle)] flex-1 truncate">{{ d.error ?? "" }}</span>
							<span class="text-[var(--color-fg-subtle)]">{{ timeAgo(d.createdAt) }}</span>
						</div>
						<div
							v-if="!(deliveries[h.id]?.length)"
							class="text-xs text-[var(--color-fg-subtle)] text-center py-3"
						>
							no deliveries yet.
						</div>
					</div>
				</div>
			</div>
			<div
				v-if="!hooks.length"
				class="card p-10 text-center text-sm text-[var(--color-fg-subtle)]"
			>
				no webhooks yet — post events to Slack, Discord, or any URL.
			</div>
		</div>

		<Dialog v-model:open="dialogOpen" title="New webhook" width="520px">
			<div class="p-5 space-y-4">
				<div class="grid grid-cols-3 gap-2">
					<button
						v-for="p in ['generic', 'slack', 'discord'] as const"
						:key="p"
						type="button"
						class="p-3 rounded-md border text-sm capitalize transition-colors"
						:class="form.preset === p
							? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-fg)]'
							: 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]'"
						@click="pickPreset(p)"
					>
						{{ p === "generic" ? "Custom" : p }}
					</button>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
					<Input v-model="form.name" placeholder="Team channel alerts" />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
						{{ form.preset === "slack" ? "Slack incoming-webhook URL" : form.preset === "discord" ? "Discord webhook URL" : "Endpoint URL" }}
					</label>
					<Input v-model="form.url" placeholder="https://…" />
				</div>
				<div>
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-1 block">
						Events
					</label>
					<div class="flex flex-wrap gap-1.5">
						<button
							v-for="e in ALL_EVENTS"
							:key="e"
							type="button"
							class="chip cursor-pointer mono"
							:class="form.events.includes(e)
								? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]/40'
								: 'bg-[var(--color-panel)] text-[var(--color-fg-muted)] border-[var(--color-border)]'"
							@click="toggleEvent(e)"
						>
							{{ e }}
						</button>
					</div>
				</div>
			</div>
			<template #footer>
				<Button variant="ghost" @click="dialogOpen = false">Cancel</Button>
				<Button variant="primary" @click="create">Create</Button>
			</template>
		</Dialog>

		<Dialog
			:open="!!secretShown"
			title="Signing secret"
			width="480px"
			@update:open="secretShown = null"
		>
			<div class="p-5 space-y-3">
				<p class="text-xs text-[var(--color-fg-muted)]">
					Verify inbound requests using <code class="mono">X-Orbit-Signature: sha256=&lt;HMAC&gt;</code>.
					Save this now — it won't be shown again.
				</p>
				<div class="flex items-center gap-2 p-3 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]">
					<code class="mono text-xs flex-1 break-all">{{ secretShown }}</code>
					<Button size="sm" variant="outline" @click="copy(secretShown!)">
						<Copy class="h-3 w-3" />
					</Button>
				</div>
			</div>
			<template #footer>
				<Button variant="primary" @click="secretShown = null">Done</Button>
			</template>
		</Dialog>
	</div>
</template>
