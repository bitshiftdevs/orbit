<script setup lang="ts">
import { computed, ref } from "vue";
import { AlertTriangle, Bell, BellOff, X } from "lucide-vue-next";
import Badge from "~/components/ui/Badge.vue";
import Button from "~/components/ui/Button.vue";
import { usePush, type Browser } from "~/composables/usePush";
import { notify } from "~/lib/notify";

const { supported, permission, subscribed, busy, browser, subscribe, unsubscribe } = usePush();

type Tip = { title: string; steps: string[] };
const tip = ref<Tip | null>(null);

const helpFor = (b: Browser): Record<"denied" | "pushService" | "unsupported", Tip> => ({
	denied: {
		brave: {
			title: "Brave has blocked notifications for this site",
			steps: [
				"Click the shield / lock icon left of the URL",
				"Site settings → Notifications → Allow",
				"Reload and click Enable again",
			],
		},
		chrome: {
			title: "Chrome has blocked notifications for this site",
			steps: [
				"Click the lock icon left of the URL",
				"Site settings → Notifications → Allow",
				"Reload and click Enable again",
			],
		},
		edge: {
			title: "Edge has blocked notifications for this site",
			steps: [
				"Click the lock icon left of the URL",
				"Permissions for this site → Notifications → Allow",
				"Reload and click Enable again",
			],
		},
		firefox: {
			title: "Firefox has blocked notifications for this site",
			steps: [
				"Click the lock icon left of the URL",
				"Clear the blocked Notifications permission",
				"Reload and click Enable again",
			],
		},
		safari: {
			title: "Safari has blocked notifications for this site",
			steps: [
				"Safari → Settings → Websites → Notifications",
				"Change this site to Allow",
				"Reload and click Enable again",
			],
		},
		other: {
			title: "Notifications are blocked for this site",
			steps: [
				"Open site permissions in your browser (usually the lock icon left of the URL)",
				"Change Notifications from Block to Allow",
				"Reload and click Enable again",
			],
		},
	}[b],
	pushService: {
		brave: {
			title: "Brave disables Google's push service by default",
			steps: [
				"Open brave://settings/privacy",
				"Under Security, turn on \"Use Google services for push messaging\"",
				"Quit Brave fully and reopen, then click Enable again",
			],
		},
		chrome: {
			title: "The browser's push service rejected the request",
			steps: [
				"Check that your network isn't blocking fcm.googleapis.com",
				"In DevTools → Application → Service Workers, unregister /sw.js",
				"Reload and try again",
			],
		},
		edge: {
			title: "The browser's push service rejected the request",
			steps: [
				"Check that your network isn't blocking fcm.googleapis.com",
				"In DevTools → Application → Service Workers, unregister /sw.js",
				"Reload and try again",
			],
		},
		firefox: {
			title: "Mozilla's push service rejected the request",
			steps: [
				"Check that your network isn't blocking updates.push.services.mozilla.com",
				"about:preferences#privacy → Permissions → clear this site's notification setting",
				"Reload and try again",
			],
		},
		safari: {
			title: "Apple's push service rejected the request",
			steps: [
				"Push in Safari requires macOS 13+ or iOS 16.4+ and installing the site to the Dock/Home Screen",
				"Try Chrome or Firefox as a fallback",
			],
		},
		other: {
			title: "The browser's push service rejected the request",
			steps: [
				"Try Chrome, Firefox, or Edge to confirm it's a browser-specific issue",
				"In DevTools → Application → Service Workers, unregister /sw.js and retry",
			],
		},
	}[b],
	unsupported: {
		brave: {
			title: "Web Push isn't available in this context",
			steps: [
				"Push requires a secure context — visit the site over HTTPS or on localhost",
				"If you're on the site normally, update Brave to the latest version",
			],
		},
		chrome: {
			title: "Web Push isn't available in this context",
			steps: [
				"Push requires a secure context — visit the site over HTTPS or on localhost",
			],
		},
		edge: {
			title: "Web Push isn't available in this context",
			steps: [
				"Push requires a secure context — visit the site over HTTPS or on localhost",
			],
		},
		firefox: {
			title: "Web Push isn't available in this context",
			steps: [
				"Push requires a secure context — visit the site over HTTPS or on localhost",
			],
		},
		safari: {
			title: "Web Push in Safari has extra requirements",
			steps: [
				"macOS 13+ or iOS 16.4+ is required",
				"On iOS, add the site to your Home Screen first",
			],
		},
		other: {
			title: "Web Push isn't supported in this browser",
			steps: [
				"Try Chrome, Firefox, Edge, or Safari — all support Web Push",
			],
		},
	}[b],
});

function classify(err: unknown): "pushService" | "denied" | "unsupported" | "unknown" {
	const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
	if (msg.includes("push service")) return "pushService";
	if (msg.includes("permission denied") || msg.includes("notallowed")) return "denied";
	if (msg.includes("not supported") || msg.includes("notsupported")) return "unsupported";
	return "unknown";
}

async function enable() {
	tip.value = null;
	try {
		await subscribe();
		if (permission.value === "granted" && subscribed.value) {
			notify("Push notifications enabled on this device", "success");
		} else if (permission.value === "denied") {
			tip.value = helpFor(browser.value).denied;
		}
	} catch (err) {
		const kind = classify(err);
		if (kind === "denied") tip.value = helpFor(browser.value).denied;
		else if (kind === "unsupported") tip.value = helpFor(browser.value).unsupported;
		else tip.value = helpFor(browser.value).pushService;
	}
}

async function disable() {
	tip.value = null;
	try {
		await unsubscribe();
		notify("Push notifications disabled on this device", "success");
	} catch {
		tip.value = helpFor(browser.value).pushService;
	}
}

const statusHint = computed(() => {
	if (!supported.value) return helpFor(browser.value).unsupported;
	if (permission.value === "denied") return helpFor(browser.value).denied;
	return null;
});
</script>

<template>
	<section class="card p-6 space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold">
					Push notifications
				</h2>
				<p class="text-sm text-[var(--color-fg)] mt-1">
					<template v-if="!supported">Not supported in this browser</template>
					<template v-else-if="permission === 'denied'">Blocked in browser settings</template>
					<template v-else-if="subscribed">
						Enabled on this device
						<Badge tone="green" dot class="ml-2">active</Badge>
					</template>
					<template v-else>Off</template>
				</p>
				<p class="text-xs text-[var(--color-fg-muted)] mt-1">
					Get browser alerts for mentions, assignments, comments, and status changes.
				</p>
			</div>
			<div class="flex gap-2">
				<Button
					v-if="supported && !subscribed"
					variant="primary"
					size="sm"
					:loading="busy"
					:disabled="permission === 'denied'"
					@click="enable"
				>
					<Bell class="h-3.5 w-3.5" />
					Enable
				</Button>
				<Button
					v-if="supported && subscribed"
					variant="outline"
					size="sm"
					:loading="busy"
					@click="disable"
				>
					<BellOff class="h-3.5 w-3.5" />
					Disable
				</Button>
			</div>
		</div>

		<div
			v-if="tip ?? statusHint"
			class="flex items-start gap-3 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
		>
			<AlertTriangle class="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
			<div class="flex-1 space-y-1.5">
				<p class="font-medium text-[var(--color-fg)]">{{ (tip ?? statusHint)!.title }}</p>
				<ol class="list-decimal ml-4 space-y-0.5 text-[var(--color-fg-muted)]">
					<li v-for="s in (tip ?? statusHint)!.steps" :key="s">{{ s }}</li>
				</ol>
			</div>
			<button
				v-if="tip"
				class="p-0.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
				@click="tip = null"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	</section>
</template>
