<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Copy, ShieldCheck, ShieldOff } from "lucide-vue-next";
import Badge from "~/components/ui/Badge.vue";
import Button from "~/components/ui/Button.vue";
import Input from "~/components/ui/Input.vue";
import { api } from "~/lib/api";
import type { MfaSetup, MfaStatus } from "~/types/domain";
import { notify, notifyError } from "~/lib/notify";
import { useConfirmDialog } from "~/composables/useConfirmDialog";

const { prompt } = useConfirmDialog();

const mfa = ref<MfaStatus>({ enabled: false, lastUsedAt: null });
const mfaSetup = ref<MfaSetup | null>(null);
const mfaCode = ref("");

async function load() {
	mfa.value = await api.get<MfaStatus>("/auth/mfa/status");
}

async function startMfa() {
	mfaSetup.value = await api.post<MfaSetup>("/auth/mfa/setup");
}

async function confirmMfa() {
	try {
		await api.post("/auth/mfa/enable", { code: mfaCode.value });
		mfaSetup.value = null;
		mfaCode.value = "";
		await load();
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
		await load();
		notify("MFA disabled", "success");
	} catch (err) {
		notifyError(err);
	}
}

async function copy(v: string) {
	await navigator.clipboard.writeText(v);
	notify("Copied", "success");
}

const qrUrl = (uri: string) =>
	`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}&margin=1&bgcolor=101014&color=f4f4f5`;

onMounted(load);
</script>

<template>
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
</template>
