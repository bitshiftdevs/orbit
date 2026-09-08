<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Copy, Mail, Plus, RefreshCw } from "lucide-vue-next";
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

const session = useSession();
const team = ref<SessionUser[]>([]);
const invites = ref<Array<{ id: string; email: string; role: string; expiresAt: string }>>([]);
const dialogOpen = ref(false);
const form = ref({ email: "", role: "member" });
const lastInviteUrl = ref<string | null>(null);
const refreshing = ref(false);

async function load(force = false) {
	refreshing.value = true;
	try {
		const [{ team: t }, { invites: i }] = await Promise.all([
			api.get<{ team: SessionUser[] }>("/team", { force }),
			api
				.get<{ invites: typeof invites.value }>("/auth/invites", { force })
				.catch(() => ({ invites: [] })),
		]);
		team.value = t;
		invites.value = i;
	} catch (err) {
		notifyError(err);
	} finally {
		refreshing.value = false;
	}
}

onMounted(load);

async function invite() {
	try {
		const { url } = await api.post<{ url: string }>("/auth/invites", form.value);
		lastInviteUrl.value = url;
		notify("Invite created — share the link", "success");
		await load();
	} catch (err) {
		notifyError(err);
	}
}

async function copyUrl(url: string) {
	await navigator.clipboard.writeText(url);
	notify("Copied", "success");
}

const canInvite = () => session.user?.role !== "member";
</script>

<template>
	<div class="flex-1 overflow-y-auto">
		<header class="border-b border-[var(--color-border)] px-8 py-5 flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold tracking-tight">Team</h1>
				<p class="text-xs text-[var(--color-fg-subtle)] mt-1">
					{{ team.length }} members
				</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)] disabled:opacity-40"
					title="Refresh"
					:disabled="refreshing"
					@click="load(true)"
				>
					<RefreshCw class="h-4 w-4" :class="refreshing && 'animate-spin'" />
				</button>
				<Button v-if="canInvite()" variant="primary" @click="dialogOpen = true">
					<Plus class="h-4 w-4" />
					Invite
				</Button>
			</div>
		</header>

		<div class="p-8 space-y-8">
			<section>
				<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold mb-3">
					Members
				</h2>
				<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					<div v-for="m in team" :key="m.id" class="card p-4 flex items-center gap-3">
						<Avatar :name="m.name" :src="m.avatarUrl" :color="m.accentColor" size="lg" />
						<div class="min-w-0 flex-1">
							<div class="text-sm font-medium truncate">{{ m.name }}</div>
							<div class="mono text-[11px] text-[var(--color-fg-subtle)] truncate">
								@{{ m.handle }} · {{ m.email }}
							</div>
						</div>
						<Badge :tone="m.role === 'owner' ? 'blue' : m.role === 'admin' ? 'violet' : 'neutral'">
							{{ m.role }}
						</Badge>
					</div>
				</div>
			</section>

			<section v-if="invites.length">
				<h2 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold mb-3">
					Pending invites
				</h2>
				<div class="card divide-y divide-[var(--color-border)]">
					<div v-for="i in invites" :key="i.id" class="px-4 py-3 flex items-center gap-3">
						<Mail class="h-4 w-4 text-[var(--color-fg-subtle)]" />
						<div class="min-w-0 flex-1">
							<div class="text-sm truncate">{{ i.email }}</div>
							<div class="text-[11px] text-[var(--color-fg-subtle)]">
								expires {{ timeAgo(i.expiresAt) }}
							</div>
						</div>
						<Badge>{{ i.role }}</Badge>
					</div>
				</div>
			</section>
		</div>

		<Dialog v-model:open="dialogOpen" title="Invite a teammate" width="440px">
			<div class="p-5 space-y-4">
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Email</label>
					<Input v-model="form.email" type="email" placeholder="teammate@bitshiftdevs.com" />
				</div>
				<div class="space-y-1">
					<label class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">Role</label>
					<Select
						v-model="form.role"
						:options="[
							{ value: 'member', label: 'Member' },
							{ value: 'admin', label: 'Admin' },
						]"
					/>
				</div>
				<div v-if="lastInviteUrl" class="p-3 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] space-y-2">
					<p class="text-[11px] text-[var(--color-fg-muted)]">
						Share this link — it expires in 7 days.
					</p>
					<div class="flex items-center gap-2">
						<code class="mono text-xs text-[var(--color-fg)] truncate flex-1">
							{{ lastInviteUrl }}
						</code>
						<Button size="sm" variant="outline" @click="copyUrl(lastInviteUrl)">
							<Copy class="h-3 w-3" />
						</Button>
					</div>
				</div>
			</div>
			<template #footer>
				<Button variant="ghost" @click="dialogOpen = false">Close</Button>
				<Button variant="primary" @click="invite">Create invite</Button>
			</template>
		</Dialog>
	</div>
</template>
