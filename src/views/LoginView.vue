<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import { notifyError } from "@/lib/notify";
import { useSession } from "@/stores/session";

const email = ref("");
const password = ref("");
const loading = ref(false);
const router = useRouter();
const route = useRoute();
const session = useSession();

async function submit() {
	loading.value = true;
	try {
		await session.login(email.value.trim(), password.value);
		const redirect = (route.query.r as string) || "/";
		router.replace(redirect);
	} catch (err) {
		notifyError(err);
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div
		class="min-h-screen grid-bg flex items-center justify-center px-4"
	>
		<div class="w-full max-w-sm">
			<div class="flex flex-col items-center gap-2 mb-8">
				<div
					class="h-12 w-12 rounded-lg grid place-items-center bg-[var(--color-accent)] text-white text-lg font-bold shadow-[0_0_40px_var(--color-accent-glow)] dot-pulse"
				>
					◆
				</div>
				<h1 class="text-lg font-semibold tracking-tight">Orbit</h1>
				<p class="text-xs text-[var(--color-fg-subtle)] uppercase tracking-widest">
					BitShift mission control
				</p>
			</div>

			<form
				class="card p-6 space-y-4 shadow-2xl shadow-black/40"
				@submit.prevent="submit"
			>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
						Email
					</label>
					<Input v-model="email" type="email" autocomplete="email" required />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
						Password
					</label>
					<Input
						v-model="password"
						type="password"
						autocomplete="current-password"
						required
					/>
				</div>
				<Button
					variant="primary"
					type="submit"
					class="w-full"
					size="lg"
					:loading="loading"
				>
					Sign in
				</Button>
				<p class="text-[11px] text-[var(--color-fg-subtle)] text-center">
					Access is invite-only. Ask an owner for a link.
				</p>
			</form>
		</div>
	</div>
</template>
