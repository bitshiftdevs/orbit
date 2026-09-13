<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { AtSign, Bell, MessageSquare, UserCheck } from "lucide-vue-next";
import Avatar from "~/components/ui/Avatar.vue";
import { useNotifications } from "~/stores/notifications";
import { timeAgo } from "~/lib/utils";

const store = useNotifications();
const open = ref(false);
const router = useRouter();
const containerRef = ref<HTMLElement | null>(null);

watch(open, (val) => { if (val) store.refresh(); });

function onClickOutside(e: MouseEvent) {
	if (open.value && containerRef.value && !containerRef.value.contains(e.target as Node)) {
		open.value = false;
	}
}

onMounted(() => document.addEventListener("mousedown", onClickOutside));
onUnmounted(() => document.removeEventListener("mousedown", onClickOutside));

const iconFor = {
	mention: AtSign,
	assigned: UserCheck,
	comment: MessageSquare,
	status_change: Bell,
	invite: Bell,
} as const;

async function go(n: (typeof store.items)[number]) {
	if (!n.readAt) await store.markRead(n.id);
	open.value = false;
	if (n.issueId) {
		router.push({ name: "issue-jump", params: { issueId: n.issueId } });
	}
}
</script>

<template>
	<div ref="containerRef" class="relative">
		<button
			class="relative p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)]"
			title="Notifications"
			@click="open = !open"
		>
			<Bell class="h-4 w-4" />
			<span
				v-if="store.unread > 0"
				class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-semibold grid place-items-center px-1"
			>
				{{ store.unread > 99 ? "99+" : store.unread }}
			</span>
		</button>

		<Transition
			enter-active-class="transition-all duration-100 ease-out"
			enter-from-class="opacity-0 translate-y-1"
			leave-active-class="transition-all duration-75"
			leave-to-class="opacity-0 translate-y-1"
		>
			<div
				v-if="open"
				class="absolute left-full bottom-0 ml-2 w-[360px] card glow z-50 max-h-[70vh] overflow-hidden flex flex-col"
			>
				<div class="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
					<h3 class="text-xs uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold">
						Notifications
					</h3>
					<button
						class="text-[11px] text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)]"
						@click="store.markAllRead()"
					>
						mark all read
					</button>
				</div>
				<div class="flex-1 overflow-y-auto">
					<button
						v-for="n in store.items"
						:key="n.id"
						type="button"
						class="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-panel-hover)] border-l-2 transition-colors"
						:class="n.readAt ? 'border-transparent' : 'border-[var(--color-accent)]'"
						@click="go(n)"
					>
						<Avatar
							v-if="n.actor?.name"
							:name="n.actor.name"
							:src="n.actor.avatarUrl"
							:color="n.actor.accentColor"
							size="sm"
						/>
						<div v-else class="h-6 w-6 rounded-full bg-[var(--color-panel-hover)] grid place-items-center">
							<component :is="iconFor[n.kind]" class="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-sm text-[var(--color-fg)] leading-snug">
								{{ n.message }}
							</p>
							<p class="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">
								{{ timeAgo(n.createdAt) }}
							</p>
						</div>
					</button>
					<div
						v-if="!store.items.length"
						class="py-10 text-center text-sm text-[var(--color-fg-subtle)]"
					>
						nothing new — you're all caught up.
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>
