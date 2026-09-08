<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Copy, KeyRound, Trash2 } from "lucide-vue-next";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import { api } from "@/lib/api";
import type { ApiToken } from "@/types/domain";
import { notify, notifyError } from "@/lib/notify";
import { timeAgo } from "@/lib/utils";
import { useConfirmDialog } from "@/composables/useConfirmDialog";

const { confirm } = useConfirmDialog();

const tokens = ref<ApiToken[]>([]);
const tokenOpen = ref(false);
const tokenForm = ref({ name: "", expiresInDays: "" });
const freshToken = ref<string | null>(null);

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

async function loadTokens() {
	try {
		const { tokens: rows } = await api.get<{ tokens: ApiToken[] }>("/tokens");
		tokens.value = rows;
	} catch (err) {
		notifyError(err);
	}
}

async function createToken() {
	try {
		const { token, secret } = await api.post<{ token: ApiToken; secret: string }>(
			"/tokens",
			{
				name: tokenForm.value.name,
				expiresInDays: tokenForm.value.expiresInDays
					? Number(tokenForm.value.expiresInDays)
					: undefined,
			},
		);
		tokens.value.unshift(token);
		freshToken.value = secret;
		tokenForm.value = { name: "", expiresInDays: "" };
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
					<div class="text-sm truncate">{{ t.name }}</div>
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

	<Dialog v-model:open="tokenOpen" title="New API token" width="440px">
		<div class="p-5 space-y-4">
			<div v-if="!freshToken" class="space-y-4">
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
					<Input v-model="tokenForm.name" placeholder="Local dev CLI" />
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

				<div class="space-y-1.5">
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
				@click="tokenOpen = false"
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
				@click="freshToken = null; tokenOpen = false"
			>
				Done
			</Button>
		</template>
	</Dialog>
</template>
