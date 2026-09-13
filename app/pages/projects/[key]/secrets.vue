<script setup lang="ts">
import { computed, inject, onMounted, ref, watch, type Ref } from "vue";
import { Copy, Download, Eye, EyeOff, Plus, RefreshCw, Trash2 } from "lucide-vue-next";
import Button from "~/components/ui/Button.vue";
import Dialog from "~/components/ui/Dialog.vue";
import Input from "~/components/ui/Input.vue";
import Select from "~/components/ui/Select.vue";
import Textarea from "~/components/ui/Textarea.vue";
import { api, type EnvVar, type Project, type Secret } from "~/lib/api";
import { notify, notifyError } from "~/lib/notify";
import { timeAgo } from "~/lib/utils";
import { useConfirmDialog } from "~/composables/useConfirmDialog";

const { confirm, prompt } = useConfirmDialog();
const project = inject<Ref<Project | null>>("project")!;

const secrets = ref<Secret[]>([]);
const envVars = ref<EnvVar[]>([]);
const revealed = ref<Record<string, string>>({});
const envRevealed = ref<Record<string, string>>({});
const activeScope = ref<"development" | "staging" | "production">("development");

const secretDialog = ref(false);
const secretForm = ref({ name: "", description: "", value: "" });

const envDialog = ref(false);
const envForm = ref({ name: "", value: "" });

const envByScope = computed(() =>
	envVars.value.filter((e) => e.scope === activeScope.value),
);

const refreshing = ref(false);

async function load(force = false) {
	if (!project.value) return;
	refreshing.value = true;
	try {
		const [{ secrets: s }, { envVars: e }] = await Promise.all([
			api.get<{ secrets: Secret[] }>(`/projects/${project.value.key}/secrets`, { force }),
			api.get<{ envVars: EnvVar[] }>(`/projects/${project.value.key}/env`, { force }),
		]);
		secrets.value = s;
		envVars.value = e;
	} catch (err) {
		notifyError(err);
	} finally {
		refreshing.value = false;
	}
}

onMounted(load);
watch(() => project.value?.key, (key, prev) => { if (key && key !== prev) load(); });

async function reveal(secret: Secret) {
	if (revealed.value[secret.id]) {
		delete revealed.value[secret.id];
		return;
	}
	const reason = await prompt(
		`Reveal '${secret.name}'? A note is optional but logged with the audit event.`,
		{ title: "Reveal secret", placeholder: "Optional audit note…", confirmText: "Reveal" },
	);
	if (reason === null) return;
	try {
		const { value } = await api.get<{ value: string }>(
			`/secrets/${secret.id}/reveal${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`,
		);
		revealed.value[secret.id] = value;
	} catch (err) {
		notifyError(err);
	}
}

async function revealEnv(v: EnvVar) {
	if (envRevealed.value[v.id]) {
		delete envRevealed.value[v.id];
		return;
	}
	try {
		const { value } = await api.get<{ value: string }>(
			`/env/${v.id}/reveal`,
		);
		envRevealed.value[v.id] = value;
	} catch (err) {
		notifyError(err);
	}
}

async function copy(text: string) {
	await navigator.clipboard.writeText(text);
	notify("Copied", "success");
}

async function createSecret() {
	if (!project.value) return;
	try {
		const { secret } = await api.post<{ secret: Secret }>(
			`/projects/${project.value.key}/secrets`,
			secretForm.value,
		);
		secrets.value.unshift(secret);
		secretDialog.value = false;
		secretForm.value = { name: "", description: "", value: "" };
		notify("Secret saved", "success");
	} catch (err) {
		notifyError(err);
	}
}

async function deleteSecret(s: Secret) {
	if (!await confirm(`Delete secret '${s.name}'?`, { danger: true, confirmText: "Delete" })) return;
	try {
		await api.del(`/secrets/${s.id}`);
		secrets.value = secrets.value.filter((x) => x.id !== s.id);
	} catch (err) {
		notifyError(err);
	}
}

async function saveEnvVar() {
	if (!project.value) return;
	try {
		const { envVar } = await api.post<{ envVar: EnvVar }>(
			`/projects/${project.value.key}/env`,
			{
				scope: activeScope.value,
				name: envForm.value.name,
				value: envForm.value.value,
			},
		);
		const idx = envVars.value.findIndex(
			(v) => v.scope === envVar.scope && v.name === envVar.name,
		);
		if (idx >= 0) envVars.value[idx] = envVar;
		else envVars.value.push(envVar);
		envDialog.value = false;
		envForm.value = { name: "", value: "" };
		notify(`${envVar.name} saved`, "success");
	} catch (err) {
		notifyError(err);
	}
}

async function deleteEnv(v: EnvVar) {
	if (!await confirm(`Delete ${v.scope}:${v.name}?`, { danger: true, confirmText: "Delete" })) return;
	try {
		await api.del(`/env/${v.id}`);
		envVars.value = envVars.value.filter((x) => x.id !== v.id);
	} catch (err) {
		notifyError(err);
	}
}

function downloadDotEnv() {
	if (!project.value) return;
	window.open(
		`/api/projects/${project.value.key}/env/${activeScope.value}/dotenv`,
		"_blank",
	);
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="px-8 py-3 border-b border-[var(--color-border)] text-xs text-[var(--color-fg-subtle)] flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dot-pulse" />
				Encrypted at rest with AES-256-GCM · reveal events are audit-logged
			</div>
			<button
				class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)] disabled:opacity-40"
				title="Refresh"
				:disabled="refreshing"
				@click="load(true)"
			>
				<RefreshCw class="h-3.5 w-3.5" :class="refreshing && 'animate-spin'" />
			</button>
		</div>
		<div class="flex-1 overflow-y-auto px-8 py-6 space-y-10">
			<section>
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-semibold">Secrets</h2>
					<Button variant="primary" size="sm" @click="secretDialog = true">
						<Plus class="h-3.5 w-3.5" />
						New secret
					</Button>
				</div>
				<div class="card divide-y divide-[var(--color-border)]">
					<div
						v-for="s in secrets"
						:key="s.id"
						class="px-4 py-3 flex items-center gap-3"
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<code class="mono text-sm text-[var(--color-fg)]">{{ s.name }}</code>
							</div>
							<p v-if="s.description" class="text-xs text-[var(--color-fg-subtle)] mt-0.5">
								{{ s.description }}
							</p>
						</div>
						<div class="mono text-xs text-[var(--color-fg-subtle)] truncate max-w-[280px]">
							<template v-if="revealed[s.id]">
								<span class="text-[var(--color-fg)]">{{ revealed[s.id] }}</span>
							</template>
							<template v-else>
								••••••••{{ s.lastFour ?? "" }}
							</template>
						</div>
						<div class="text-[11px] text-[var(--color-fg-subtle)] w-24 text-right">
							{{ timeAgo(s.updatedAt) }}
						</div>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-hover)]"
							@click="reveal(s)"
						>
							<component :is="revealed[s.id] ? EyeOff : Eye" class="h-4 w-4" />
						</button>
						<button
							v-if="revealed[s.id]"
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-hover)]"
							@click="copy(revealed[s.id])"
						>
							<Copy class="h-4 w-4" />
						</button>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
							@click="deleteSecret(s)"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
					<div
						v-if="!secrets.length"
						class="text-center py-8 text-sm text-[var(--color-fg-subtle)]"
					>
						no secrets yet.
					</div>
				</div>
			</section>

			<section>
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-3">
						<h2 class="text-sm font-semibold">Environment variables</h2>
						<div class="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5 text-xs">
							<button
								v-for="s in ['development', 'staging', 'production'] as const"
								:key="s"
								class="px-2.5 py-1 rounded"
								:class="activeScope === s ? 'bg-[var(--color-panel)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
								@click="activeScope = s"
							>
								{{ s }}
							</button>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" @click="downloadDotEnv">
							<Download class="h-3.5 w-3.5" />
							.env
						</Button>
						<Button variant="primary" size="sm" @click="envDialog = true">
							<Plus class="h-3.5 w-3.5" />
							Add
						</Button>
					</div>
				</div>
				<div class="card divide-y divide-[var(--color-border)]">
					<div
						v-for="v in envByScope"
						:key="v.id"
						class="px-4 py-3 flex items-center gap-3"
					>
						<code class="mono text-sm text-[var(--color-fg)] flex-1 truncate">{{ v.name }}</code>
						<div class="mono text-xs text-[var(--color-fg-subtle)] truncate max-w-[280px]">
							<template v-if="envRevealed[v.id]">
								<span class="text-[var(--color-fg)]">{{ envRevealed[v.id] }}</span>
							</template>
							<template v-else>
								••••••••{{ v.lastFour ?? "" }}
							</template>
						</div>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-hover)]"
							@click="revealEnv(v)"
						>
							<component :is="envRevealed[v.id] ? EyeOff : Eye" class="h-4 w-4" />
						</button>
						<button
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
							@click="deleteEnv(v)"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
					<div
						v-if="!envByScope.length"
						class="text-center py-8 text-sm text-[var(--color-fg-subtle)]"
					>
						no vars in {{ activeScope }} yet.
					</div>
				</div>
			</section>
		</div>

		<Dialog v-model:open="secretDialog" title="New secret" width="520px">
			<div class="p-5 space-y-4">
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
					<Input v-model="secretForm.name" mono placeholder="STRIPE_SECRET_KEY" />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Description</label>
					<Input v-model="secretForm.description" placeholder="What is this for?" />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Value</label>
					<Textarea v-model="secretForm.value" :rows="3" placeholder="sk_live_…" />
				</div>
			</div>
			<template #footer>
				<Button variant="ghost" @click="secretDialog = false">Cancel</Button>
				<Button variant="primary" @click="createSecret">Save</Button>
			</template>
		</Dialog>

		<Dialog v-model:open="envDialog" :title="`Add ${activeScope} var`" width="480px">
			<div class="p-5 space-y-4">
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
					<Input v-model="envForm.name" mono placeholder="DATABASE_URL" />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Value</label>
					<Textarea v-model="envForm.value" :rows="3" />
				</div>
			</div>
			<template #footer>
				<Button variant="ghost" @click="envDialog = false">Cancel</Button>
				<Button variant="primary" @click="saveEnvVar">Save</Button>
			</template>
		</Dialog>
	</div>
</template>
