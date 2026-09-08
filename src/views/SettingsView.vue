<script setup lang="ts">
import { onMounted, ref, watchEffect } from "vue";
import { Copy, KeyRound, ShieldCheck, ShieldOff, Trash2 } from "lucide-vue-next";
import Avatar from "@/components/ui/Avatar.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import { api, type SessionUser } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { timeAgo } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { useConfirmDialog } from "@/composables/useConfirmDialog";

const { confirm, prompt } = useConfirmDialog();
const session = useSession();

const form = ref({ name: "", handle: "", avatarUrl: "", accentColor: "#3b82f6" });

watchEffect(() => {
	if (session.user) {
		form.value = {
			name: session.user.name,
			handle: session.user.handle,
			avatarUrl: session.user.avatarUrl ?? "",
			accentColor: session.user.accentColor,
		};
	}
});

async function save() {
	try {
		const { user } = await api.patch<{ user: SessionUser }>("/team/me", form.value);
		session.user = user;
		notify("Saved", "success");
	} catch (err) {
		notifyError(err);
	}
}

// ─── API tokens ─────────────────────────────────────────────
type Token = {
	id: string;
	name: string;
	lastFour: string;
	scopes: string[];
	lastUsedAt: string | null;
	expiresAt: string | null;
	revokedAt: string | null;
	createdAt: string;
};
const tokens = ref<Token[]>([]);
const tokenOpen = ref(false);
const tokenForm = ref({ name: "", expiresInDays: "" });
const freshToken = ref<string | null>(null);

async function loadTokens() {
	try {
		const { tokens: rows } = await api.get<{ tokens: Token[] }>("/tokens");
		tokens.value = rows;
	} catch (err) {
		notifyError(err);
	}
}

async function createToken() {
	try {
		const { token, secret } = await api.post<{ token: Token; secret: string }>(
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

async function revokeToken(t: Token) {
	if (!await confirm(`Revoke '${t.name}'? Any script using it will stop working immediately.`, { danger: true, confirmText: "Revoke" }))
		return;
	await api.del(`/tokens/${t.id}`);
	tokens.value = tokens.value.filter((x) => x.id !== t.id);
}

async function copy(v: string) {
	await navigator.clipboard.writeText(v);
	notify("Copied", "success");
}

// ─── MFA ──────────────────────────────────────────────────
type MfaStatus = { enabled: boolean; lastUsedAt: string | null };
const mfa = ref<MfaStatus>({ enabled: false, lastUsedAt: null });
const mfaSetup = ref<{
	secret: string;
	otpauth: string;
	backupCodes: string[];
} | null>(null);
const mfaCode = ref("");

async function loadMfa() {
	mfa.value = await api.get<MfaStatus>("/auth/mfa/status");
}

async function startMfa() {
	mfaSetup.value = await api.post<typeof mfaSetup.value>("/auth/mfa/setup");
}

async function confirmMfa() {
	try {
		await api.post("/auth/mfa/enable", { code: mfaCode.value });
		mfaSetup.value = null;
		mfaCode.value = "";
		await loadMfa();
		notify("MFA enabled", "success");
	} catch (err) {
		notifyError(err);
	}
}

async function disableMfa() {
	const code = await prompt("Enter your current 6-digit code to disable MFA:", {
		title: "Disable MFA",
		inputLabel: "Authenticator code",
		placeholder: "000000",
		confirmText: "Disable",
		danger: true,
	});
	if (!code) return;
	try {
		await api.post("/auth/mfa/disable", { code });
		await loadMfa();
		notify("MFA disabled", "success");
	} catch (err) {
		notifyError(err);
	}
}

const qrUrl = (uri: string) =>
	`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}&margin=1&bgcolor=101014&color=f4f4f5`;

onMounted(() => {
	loadTokens();
	loadMfa();
});
</script>

<template>
	<div class="flex-1 overflow-y-auto">
		<header class="border-b border-[var(--color-border)] px-8 py-5">
			<h1 class="text-xl font-semibold tracking-tight">Settings</h1>
			<p class="text-xs text-[var(--color-fg-subtle)] mt-1">Profile · security · integrations</p>
		</header>

		<div class="p-8 max-w-3xl space-y-8">
			<!-- Profile -->
			<section class="card p-6 space-y-5">
				<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold">
					Profile
				</h2>
				<div class="flex items-center gap-4">
					<Avatar
						v-if="session.user"
						:name="form.name || session.user.name"
						:src="form.avatarUrl || null"
						:color="form.accentColor"
						size="lg"
					/>
					<div class="min-w-0">
						<div class="text-sm font-semibold">{{ session.user?.name }}</div>
						<div class="mono text-[11px] text-[var(--color-fg-subtle)]">
							{{ session.user?.email }}
						</div>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
						<Input v-model="form.name" />
					</div>
					<div class="space-y-1">
						<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Handle</label>
						<Input v-model="form.handle" mono />
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Avatar URL</label>
					<Input v-model="form.avatarUrl" placeholder="https://…" />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Accent</label>
					<div class="flex gap-2">
						<button
							v-for="c in ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#22d3ee']"
							:key="c"
							type="button"
							class="h-8 w-8 rounded-md border-2 transition-transform"
							:class="form.accentColor === c ? 'border-white scale-105' : 'border-transparent'"
							:style="{ background: c }"
							@click="form.accentColor = c"
						/>
					</div>
				</div>
				<div class="flex justify-end">
					<Button variant="primary" @click="save">Save</Button>
				</div>
			</section>

			<!-- MFA -->
			<section class="card p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold">
							Two-factor auth
						</h2>
						<p class="text-sm text-[var(--color-fg)] mt-1">
							{{ mfa.enabled ? "Enabled" : "Off" }}
							<Badge v-if="mfa.enabled" tone="green" dot class="ml-2">active</Badge>
						</p>
					</div>
					<div class="flex gap-2">
						<Button
							v-if="!mfa.enabled && !mfaSetup"
							variant="primary"
							size="sm"
							@click="startMfa"
						>
							<ShieldCheck class="h-3.5 w-3.5" />
							Enable
						</Button>
						<Button
							v-if="mfa.enabled"
							variant="danger"
							size="sm"
							@click="disableMfa"
						>
							<ShieldOff class="h-3.5 w-3.5" />
							Disable
						</Button>
					</div>
				</div>
				<div v-if="mfaSetup" class="space-y-4 border-t border-[var(--color-border)] pt-4">
					<div class="flex gap-6 items-start">
						<img
							:src="qrUrl(mfaSetup.otpauth)"
							alt="TOTP QR"
							class="rounded-md border border-[var(--color-border)]"
						/>
						<div class="flex-1 space-y-3">
							<p class="text-xs text-[var(--color-fg-muted)]">
								Scan with 1Password, Google Authenticator, Authy, etc. Or paste the secret:
							</p>
							<div class="flex items-center gap-2">
								<code class="mono text-xs flex-1 truncate">{{ mfaSetup.secret }}</code>
								<Button size="sm" variant="outline" @click="copy(mfaSetup.secret)">
									<Copy class="h-3 w-3" />
								</Button>
							</div>
							<div class="space-y-1">
								<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
									Confirm current 6-digit code
								</label>
								<div class="flex gap-2">
									<Input v-model="mfaCode" mono placeholder="123456" class="max-w-[140px]" />
									<Button variant="primary" @click="confirmMfa">Enable</Button>
								</div>
							</div>
						</div>
					</div>
					<div>
						<p class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-1">
							Backup codes
						</p>
						<p class="text-xs text-[var(--color-fg-muted)] mb-2">
							Save these somewhere safe — each can be used once if you lose your device.
						</p>
						<div class="grid grid-cols-2 gap-1 mono text-xs">
							<code
								v-for="c in mfaSetup.backupCodes"
								:key="c"
								class="px-2 py-1 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border)]"
							>
								{{ c }}
							</code>
						</div>
					</div>
				</div>
			</section>

			<!-- API tokens -->
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
		</div>

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
				<div v-else class="space-y-3">
					<p class="text-xs text-[var(--color-fg-muted)]">
						Copy this now — it won't be shown again.
					</p>
					<div class="flex items-center gap-2 p-3 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]">
						<code class="mono text-xs flex-1 break-all">{{ freshToken }}</code>
						<Button size="sm" variant="outline" @click="copy(freshToken)">
							<Copy class="h-3 w-3" />
						</Button>
					</div>
					<pre class="mono text-xs p-3 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] overflow-x-auto">curl -H "Authorization: Bearer {{ freshToken }}" \
  {{ location.origin }}/api/projects</pre>
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
	</div>
</template>
