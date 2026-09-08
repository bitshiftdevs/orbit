import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api } from "@/lib/api";

export type Notification = {
	id: string;
	kind: "mention" | "assigned" | "comment" | "status_change" | "invite";
	message: string;
	projectId: string | null;
	issueId: string | null;
	actorId: string | null;
	readAt: string | null;
	createdAt: string;
	actor: {
		id: string | null;
		name: string | null;
		handle: string | null;
		avatarUrl: string | null;
		accentColor: string | null;
	} | null;
};

export const useNotifications = defineStore("notifications", () => {
	const items = ref<Notification[]>([]);
	const unread = ref(0);
	let pollHandle: number | null = null;

	async function refresh() {
		try {
			const res = await api.get<{
				notifications: Notification[];
				unread: number;
			}>("/notifications");
			items.value = res.notifications;
			unread.value = res.unread;
		} catch {}
	}

	async function markAllRead() {
		await api.post("/notifications/read", {});
		for (const n of items.value) if (!n.readAt) n.readAt = new Date().toISOString();
		unread.value = 0;
	}

	async function markRead(id: string) {
		await api.post("/notifications/read", { ids: [id] });
		const n = items.value.find((x) => x.id === id);
		if (n && !n.readAt) {
			n.readAt = new Date().toISOString();
			unread.value = Math.max(0, unread.value - 1);
		}
	}

	function startPolling() {
		if (pollHandle) return;
		refresh();
		pollHandle = window.setInterval(refresh, 30_000);
	}

	function stopPolling() {
		if (pollHandle) {
			clearInterval(pollHandle);
			pollHandle = null;
		}
	}

	return {
		items,
		unread,
		hasUnread: computed(() => unread.value > 0),
		refresh,
		markAllRead,
		markRead,
		startPolling,
		stopPolling,
	};
});
