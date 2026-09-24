<script setup lang="ts">
definePageMeta({ name: "project-secrets" });
import { computed, inject, onMounted, ref, watch, type Ref } from "vue";
import { Copy, Download, Eye, EyeOff, Github, Plus, RefreshCw, Trash2 } from "lucide-vue-next";
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
const envRows = ref<{ name: string; value: string }[]>([{ name: "", value: "" }]);
const envBulk = ref("");
const envMode = ref<"rows" | "paste">("rows");

const envByScope = computed(() =>
	envVars.value.filter((e) => e.scope === activeScope.value),
);

const ciDialog = ref(false);
const ciSnippet = computed(() => {
	const key = project.value?.key ?? "YOUR_PROJECT_KEY";
	const origin = typeof window !== "undefined" ? window.location.origin : "https://orbit.example.com";
	return `- name: Load Orbit env
  uses: bitshiftdevs/orbit/action@v1
  with:
    orbit-url: ${origin}
    token: \${{ secrets.ORBIT_TOKEN }}
    project: ${key}
    scope: ${activeScope.value}`;
});

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

function openEnvDialog() {
	envMode.value = "rows";
	envRows.value = [{ name: "", value: "" }];
	envBulk.value = "";
	envDialog.value = true;
}

function addEnvRow() {
	envRows.value.push({ name: "", value: "" });
}

function removeEnvRow(idx: number) {
	envRows.value.splice(idx, 1);
	if (!envRows.value.length) envRows.value.push({ name: "", value: "" });
}

// Parse a .env-style block into name/value pairs.
// Supports `KEY=value`, `export KEY=value`, quoted values and comments.
function parseDotEnv(text: string): { name: string; value: string }[] {
	const out: { name: string; value: string }[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const stripped = line.replace(/^export\s+/, "");
		const eq = stripped.indexOf("=");
		if (eq === -1) continue;
		const name = stripped.slice(0, eq).trim();
		let value = stripped.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (name) out.push({ name, value });
	}
	return out;
}

async function saveEnvVar() {
	if (!project.value) return;
	const vars =
		envMode.value === "paste"
			? parseDotEnv(envBulk.value)
			: envRows.value
					.map((r) => ({ name: r.name.trim(), value: r.value }))
					.filter((r) => r.name);
	if (!vars.length) {
		notify("Add at least one variable", "info");
		return;
	}
	try {
		const { envVars: saved } = await api.post<{ envVars: EnvVar[] }>(
			`/projects/${project.value.key}/env`,
			{ scope: activeScope.value, vars },
		);
		for (const envVar of saved) {
			const idx = envVars.value.findIndex(
				(v) => v.scope === envVar.scope && v.name === envVar.name,
			);
			if (idx >= 0) envVars.value[idx] = envVar;
			else envVars.value.push(envVar);
		}
		envDialog.value = false;
		notify(
			saved.length === 1 && saved[0]
				? `${saved[0].name} saved`
				: `${saved.length} vars saved`,
			"success",
		);
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

async function fetchDotEnv(): Promise<Blob | null> {
	if (!project.value) return null;
	return api.get<Blob>(
		`/projects/${project.value.key}/env/${activeScope.value}/dotenv`,
	);
}

async function downloadDotEnv() {
	if (!project.value) return;
	try {
		const blob = await fetchDotEnv();
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${project.value.key.toLowerCase()}.${activeScope.value}.env`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (err) {
		notifyError(err);
	}
}

async function copyDotEnv() {
	if (!project.value) return;
	try {
		const blob = await fetchDotEnv();
		if (!blob) return;
		const text = await blob.text();
		if (!text) {
			notify(`No vars in ${activeScope.value}`, "info");
			return;
		}
		await navigator.clipboard.writeText(text);
		notify(`Copied ${activeScope.value} .env`, "success");
	} catch (err) {
		notifyError(err);
	}
}
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="px-4 sm:px-8 py-3 border-b border-[var(--color-border)] text-xs text-[var(--color-fg-subtle)] flex items-center justify-between">
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
		<div class="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-10">
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
						<Button variant="outline" size="sm" @click="ciDialog = true">
							<Github class="h-3.5 w-3.5" />
							Use in CI
						</Button>
						<Button variant="outline" size="sm" @click="copyDotEnv">
							<Copy class="h-3.5 w-3.5" />
							Copy all
						</Button>
						<Button variant="outline" size="sm" @click="downloadDotEnv">
							<Download class="h-3.5 w-3.5" />
							.env
						</Button>
						<Button variant="primary" size="sm" @click="openEnvDialog">
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
							v-if="envRevealed[v.id]"
							class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-panel-hover)]"
							@click="copy(envRevealed[v.id]!)"
						>
							<Copy class="h-4 w-4" />
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

		<Dialog v-model:open="envDialog" :title="`Add ${activeScope} vars`" width="560px">
			<div class="p-5 space-y-4">
				<div class="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5 text-xs w-fit">
					<button
						class="px-2.5 py-1 rounded"
						:class="envMode === 'rows' ? 'bg-[var(--color-panel)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
						@click="envMode = 'rows'"
					>
						Fields
					</button>
					<button
						class="px-2.5 py-1 rounded"
						:class="envMode === 'paste' ? 'bg-[var(--color-panel)] text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
						@click="envMode = 'paste'"
					>
						Paste .env
					</button>
				</div>

				<template v-if="envMode === 'rows'">
					<div class="space-y-2">
						<div
							v-for="(row, idx) in envRows"
							:key="idx"
							class="flex items-start gap-2"
						>
							<Input v-model="row.name" mono placeholder="DATABASE_URL" class="flex-1" />
							<Input v-model="row.value" mono placeholder="value" class="flex-1" />
							<button
								class="p-2 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
								title="Remove"
								@click="removeEnvRow(idx)"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
					<Button variant="outline" size="sm" @click="addEnvRow">
						<Plus class="h-3.5 w-3.5" />
						Add another
					</Button>
				</template>

				<template v-else>
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Paste a .env block</label>
						<Textarea
							v-model="envBulk"
							:rows="8"
							placeholder="DATABASE_URL=postgres://…
API_KEY=abc123
# comments and blank lines are ignored"
						/>
					</div>
				</template>
			</div>
			<template #footer>
				<Button variant="ghost" @click="envDialog = false">Cancel</Button>
				<Button variant="primary" @click="saveEnvVar">Save</Button>
			</template>
		</Dialog>

		<Dialog v-model:open="ciDialog" title="Load env into GitHub Actions" width="580px">
			<div class="p-5 space-y-4 text-sm">
				<ol class="space-y-2 text-[var(--color-fg-muted)] list-decimal list-inside">
					<li>
						Create a project-scoped token:
						<NuxtLink to="/settings" class="text-[var(--color-accent)] hover:underline">
							Settings → API tokens
						</NuxtLink>
						— pick this project, check <code class="mono">env:read</code> (and <code class="mono">secrets:read</code> if you need secrets).
					</li>
					<li>Store the token as a repo secret named <code class="mono">ORBIT_TOKEN</code>.</li>
					<li>Paste this step into <code class="mono">.github/workflows/*.yml</code>:</li>
				</ol>
				<div class="relative">
					<pre class="mono text-xs p-3 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] overflow-x-auto whitespace-pre">{{ ciSnippet }}</pre>
					<Button
						size="sm"
						variant="outline"
						class="absolute top-2 right-2"
						@click="copy(ciSnippet)"
					>
						<Copy class="h-3 w-3" />
					</Button>
				</div>
				<p class="text-xs text-[var(--color-fg-subtle)]">
					Values are auto-masked in job logs. Later steps see each variable via <code class="mono">$GITHUB_ENV</code>.
				</p>
			</div>
			<template #footer>
				<Button variant="primary" @click="ciDialog = false">Done</Button>
			</template>
		</Dialog>
	</div>
</template>
