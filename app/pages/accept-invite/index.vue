<script setup lang="ts">
import { ref } from "vue";
import Button from "~/components/ui/Button.vue";
import Input from "~/components/ui/Input.vue";
import { notifyError } from "~/lib/notify";
import { useSession } from "~/stores/session";
import { useRoute, navigateTo } from "nuxt/app";

const route = useRoute();
const session = useSession();

const name = ref("");
const handle = ref("");
const password = ref("");
const loading = ref(false);

async function submit() {
	const token = route.params.token;
	if (!token) return;
	loading.value = true;
	try {
		await session.acceptInvite({
			token: token as string,
			name: name.value.trim(),
			handle: handle.value.trim(),
			password: password.value,
		});
		navigateTo("/");
	} catch (err) {
		notifyError(err);
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div class="min-h-screen grid-bg flex items-center justify-center px-4">
		<div class="w-full max-w-sm">
			<div class="flex flex-col items-center gap-2 mb-8">
				<div
					class="h-12 w-12 rounded-lg grid place-items-center bg-[var(--color-accent)] text-white text-lg font-bold shadow-[0_0_40px_var(--color-accent-glow)]"
				>
					◆
				</div>
				<h1 class="text-lg font-semibold tracking-tight">Join Orbit</h1>
				<p class="text-xs text-[var(--color-fg-subtle)] text-center">
					Set up your BitShift account
				</p>
			</div>

			<form class="card p-6 space-y-4" @submit.prevent="submit">
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Name</label>
					<Input v-model="name" required />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Handle</label>
					<Input v-model="handle" mono placeholder="e.g. kratos" required />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
						Password (min 10 chars)
					</label>
					<Input v-model="password" type="password" required />
				</div>
				<Button
					variant="primary"
					type="submit"
					class="w-full"
					size="lg"
					:loading="loading"
				>
					Accept invite
				</Button>
			</form>
		</div>
	</div>
</template>
