<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Copy, KeyRound, Trash2 } from "lucide-vue-next";
import Badge from "~/components/ui/Badge.vue";
import Button from "~/components/ui/Button.vue";
import Dialog from "~/components/ui/Dialog.vue";
import Input from "~/components/ui/Input.vue";
import Select from "~/components/ui/Select.vue";
import { api } from "~/lib/api";
import type { ApiToken, Project } from "~/types/domain";
import { notify, notifyError } from "~/lib/notify";
import { timeAgo } from "~/lib/utils";
import { useConfirmDialog } from "~/composables/useConfirmDialog";
import { useProjects } from "~/stores/projects";

const { confirm } = useConfirmDialog();
const projectsStore = useProjects();

const tokens = ref<ApiToken[]>([]);
const projects = computed<Project[]>(() => projectsStore.items);
const tokenOpen = ref(false);
const tokenForm = ref({
	name: "",
	expiresInDays: "",
	projectKey: "",
	scopes: {
		read: true,
		write: true,
		"env:read": false,
		"secrets:read": false,
	} as Record<string, boolean>,
});
const freshToken = ref<string | null>(null);
const freshTokenProjectKey = ref<string>("");
const freshTokenScopes = ref<string[]>([]);

const projectById = computed(() => {
	const map: Record<string, Project> = {};
	for (const p of projects.value) map[p.id] = p;
	return map;
});

const projectOptions = computed(() => [
	{ value: "", label: "Account-wide (no project scope)" },
	...projects.value.map((p) => ({ value: p.key, label: `${p.key} — ${p.name}` })),
]);

const isCiToken = computed(() =>
	freshTokenScopes.value.some((s) => s === "env:read" || s === "secrets:read"),
);

const mcpConfig = computed(() =>
	JSON.stringify(
		{
			mcpServers: {
				orbit: {
					type: "http",
					url: `${location.origin}/api/mcp`,
					headers: { Authorization: `Bearer ${freshToken.value}` },
				},
			},
		},
		null,
		2,
	),
);

const actionSnippet = computed(() => {
	const project = freshTokenProjectKey.value || "YOUR_PROJECT_KEY";
	const wantsSecrets = freshTokenScopes.value.includes("secrets:read");
	return `- name: Load Orbit env
  uses: bitshiftdevs/orbit/action@v1
  with:
    orbit-url: ${location.origin}
    token: \${{ secrets.ORBIT_TOKEN }}
    project: ${project}
    scope: production${wantsSecrets ? "" : "\n    include-secrets: false"}`;
});

const curlSnippet = computed(() => {
	const project = freshTokenProjectKey.value || "YOUR_PROJECT_KEY";
	const include = freshTokenScopes.value.includes("secrets:read")
		? "?include=secrets"
		: "";
	return `curl -H "Authorization: Bearer ${freshToken.value}" \\
  "${location.origin}/api/projects/${project}/env/production/dotenv${include}"`;
});

async function loadTokens() {
	try {
		const [{ tokens: rows }] = await Promise.all([
			api.get<{ tokens: ApiToken[] }>("/tokens"),
			projectsStore.ensureLoaded(),
		]);
		tokens.value = rows;
	} catch (err) {
		notifyError(err);
	}
}

async function createToken() {
	try {
		const scopes = Object.entries(tokenForm.value.scopes)
			.filter(([, on]) => on)
			.map(([k]) => k);
		if (!scopes.length) {
			notify("Pick at least one scope", "error");
			return;
		}
		const { token, secret } = await api.post<{ token: ApiToken; secret: string }>(
			"/tokens",
			{
				name: tokenForm.value.name,
				scopes,
				projectKey: tokenForm.value.projectKey || undefined,
				expiresInDays: tokenForm.value.expiresInDays
					? Number(tokenForm.value.expiresInDays)
					: undefined,
			},
		);
		tokens.value.unshift(token);
		freshToken.value = secret;
		freshTokenProjectKey.value = tokenForm.value.projectKey;
		freshTokenScopes.value = scopes;
	} catch (err) {
		notifyError(err);
	}
}

async function revokeToken(t: ApiToken) {
	if (!await confirm(`Revoke '${t.name}'? Any script using it will stop working immediately.`, { danger: true, confirmText: "Revoke" }))
		return;
	await api.del(`/tokens/${t.id}`);
	tokens.value = tokens.value.filter((x) => x.id !== t.id);
}

async function copy(v: string) {
	await navigator.clipboard.writeText(v);
	notify("Copied", "success");
}

function resetForm() {
	tokenForm.value = {
		name: "",
		expiresInDays: "",
		projectKey: "",
		scopes: { read: true, write: true, "env:read": false, "secrets:read": false },
	};
	freshToken.value = null;
	freshTokenProjectKey.value = "";
	freshTokenScopes.value = [];
}

function tokenScopeBadges(t: ApiToken): string[] {
	return t.scopes ?? [];
}

onMounted(loadTokens);
</script>

<template>
	<section class="card p-6 space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold">
					API tokens
				</h2>
				<p class="text-xs text-[var(--color-fg-muted)] mt-1">
					Bearer tokens for CLI, CI, and MCP integrations. Prefix: <code class="mono">orb_</code>
				</p>
			</div>
			<Button variant="primary" size="sm" @click="tokenOpen = true">
				<KeyRound class="h-3.5 w-3.5" />
				New token
			</Button>
		</div>
		<div class="divide-y divide-[var(--color-border)] -mx-2">
			<div
				v-for="t in tokens"
				:key="t.id"
				class="px-2 py-2.5 flex items-center gap-3"
			>
				<KeyRound class="h-4 w-4 text-[var(--color-fg-subtle)]" />
				<div class="min-w-0 flex-1">
					<div class="text-sm truncate flex items-center gap-2">
						<span>{{ t.name }}</span>
						<Badge v-if="t.projectId" tone="blue">
							{{ projectById[t.projectId]?.key ?? "project" }}
						</Badge>
						<Badge
							v-for="s in tokenScopeBadges(t)"
							:key="s"
							tone="neutral"
						>
							{{ s }}
						</Badge>
					</div>
					<div class="text-[11px] text-[var(--color-fg-subtle)] mono">
						orb_…{{ t.lastFour }} · used {{ t.lastUsedAt ? timeAgo(t.lastUsedAt) : "never" }}
					</div>
				</div>
				<Badge v-if="t.revokedAt" tone="red">revoked</Badge>
				<button
					v-else
					class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
					@click="revokeToken(t)"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>
			<div
				v-if="!tokens.length"
				class="py-6 text-center text-sm text-[var(--color-fg-subtle)]"
			>
				no tokens yet.
			</div>
		</div>
	</section>

	<Dialog v-model:open="tokenOpen" title="New API token" width="520px" @close="resetForm">
		<div class="p-5 space-y-4">
			<div v-if="!freshToken" class="space-y-4">
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
					<Input v-model="tokenForm.name" placeholder="Local dev CLI · CI pipeline · ..." />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Project</label>
					<Select
						v-model="tokenForm.projectKey"
						:options="projectOptions"
					/>
					<p class="text-[11px] text-[var(--color-fg-subtle)]">
						Project-scoped tokens can only touch that project's env vars and secrets — recommended for CI.
					</p>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Scopes</label>
					<div class="grid grid-cols-2 gap-2">
						<label
							v-for="(_, key) in tokenForm.scopes"
							:key="key"
							class="flex items-center gap-2 px-2.5 py-1.5 rounded border border-[var(--color-border)] text-xs cursor-pointer hover:bg-[var(--color-panel-hover)]"
						>
							<input
								type="checkbox"
								v-model="tokenForm.scopes[key]"
								class="accent-[var(--color-accent)]"
							/>
							<code class="mono">{{ key }}</code>
						</label>
					</div>
					<p class="text-[11px] text-[var(--color-fg-subtle)]">
						For a GitHub Actions token: pick <code class="mono">env:read</code> (and <code class="mono">secrets:read</code> if you need secrets). Leave <code class="mono">write</code> unchecked.
					</p>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Expires in</label>
					<Select
						v-model="tokenForm.expiresInDays"
						:options="[
							{ value: '', label: 'Never' },
							{ value: '7', label: '7 days' },
							{ value: '30', label: '30 days' },
							{ value: '90', label: '90 days' },
							{ value: '365', label: '1 year' },
						]"
					/>
				</div>
			</div>
			<div v-else class="space-y-4">
				<p class="text-xs text-[var(--color-fg-muted)]">
					Copy this token now — it won't be shown again.
				</p>
				<div class="flex items-center gap-2 p-3 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]">
					<code class="mono text-xs flex-1 break-all">{{ freshToken }}</code>
					<Button size="sm" variant="outline" @click="copy(freshToken!)">
						<Copy class="h-3 w-3" />
					</Button>
				</div>

				<div v-if="isCiToken" class="space-y-1.5">
					<p class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
						GitHub Actions
					</p>
					<p class="text-xs text-[var(--color-fg-muted)]">
						Add the token as a repo secret named <code class="mono">ORBIT_TOKEN</code>, then paste this step into your workflow.
					</p>
					<div class="relative">
						<pre class="mono text-xs p-3 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] overflow-x-auto whitespace-pre">{{ actionSnippet }}</pre>
						<Button
							size="sm"
							variant="outline"
							class="absolute top-2 right-2"
							@click="copy(actionSnippet)"
						>
							<Copy class="h-3 w-3" />
						</Button>
					</div>
					<p class="text-[11px] text-[var(--color-fg-subtle)] pt-1">
						Or fetch directly with curl:
					</p>
					<div class="relative">
						<pre class="mono text-xs p-3 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] overflow-x-auto whitespace-pre">{{ curlSnippet }}</pre>
						<Button
							size="sm"
							variant="outline"
							class="absolute top-2 right-2"
							@click="copy(curlSnippet)"
						>
							<Copy class="h-3 w-3" />
						</Button>
					</div>
				</div>

				<div v-else class="space-y-1.5">
					<p class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
						MCP configuration
					</p>
					<p class="text-xs text-[var(--color-fg-muted)]">
						Paste this into your AI tool's MCP settings (Claude Code, Cursor, etc.) to let it read and manage your Orbit projects directly.
					</p>
					<div class="relative">
						<pre class="mono text-xs p-3 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] overflow-x-auto">{{ mcpConfig }}</pre>
						<Button
							size="sm"
							variant="outline"
							class="absolute top-2 right-2"
							@click="copy(mcpConfig)"
						>
							<Copy class="h-3 w-3" />
						</Button>
					</div>
				</div>
			</div>
		</div>
		<template #footer>
			<Button
				v-if="!freshToken"
				variant="ghost"
				@click="tokenOpen = false; resetForm()"
			>
				Cancel
			</Button>
			<Button
				v-if="!freshToken"
				variant="primary"
				@click="createToken"
			>
				Create
			</Button>
			<Button
				v-else
				variant="primary"
				@click="tokenOpen = false; resetForm()"
			>
				Done
			</Button>
		</template>
	</Dialog>
</template>
