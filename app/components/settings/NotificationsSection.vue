<script setup lang="ts">
import { Bell, BellOff } from "lucide-vue-next";
import Badge from "~/components/ui/Badge.vue";
import Button from "~/components/ui/Button.vue";
import { usePush } from "~/composables/usePush";
import { notify, notifyError } from "~/lib/notify";

const { supported, permission, subscribed, busy, subscribe, unsubscribe } = usePush();

async function enable() {
	try {
		await subscribe();
		if (permission.value === "granted" && subscribed.value) {
			notify("Push notifications enabled on this device", "success");
		} else if (permission.value === "denied") {
			notify("Permission denied. Enable notifications in your browser settings.", "error");
		}
	} catch (err) {
		notifyError(err);
	}
}

async function disable() {
	try {
		await unsubscribe();
		notify("Push notifications disabled on this device", "success");
	} catch (err) {
		notifyError(err);
	}
}
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
	</section>
</template>
