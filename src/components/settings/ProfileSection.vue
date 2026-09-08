<script setup lang="ts">
import { watchEffect } from "vue";
import { ref } from "vue";
import Avatar from "@/components/ui/Avatar.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import { api } from "@/lib/api";
import type { SessionUser } from "@/types/domain";
import { notify, notifyError } from "@/lib/notify";
import { useSession } from "@/stores/session";

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
</script>

<template>
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
</template>
