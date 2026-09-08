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

	let evtSource: EventSource | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

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

	function _ingestNew(incoming: Notification[]) {
		let added = 0;
		for (const n of incoming) {
			if (!items.value.some((x) => x.id === n.id)) {
				items.value.unshift(n);
				if (!n.readAt) added++;
			}
		}
		unread.value += added;
	}

	function connect() {
		if (evtSource) return;

		evtSource = new EventSource("/api/sse");

		evtSource.addEventListener("message", (e) => {
			try {
				const payload = JSON.parse(e.data) as {
					type: string;
					items: Notification[];
				};
				if (payload.type === "notifications" && payload.items.length > 0) {
					_ingestNew(payload.items);
				}
			} catch {}
		});

		evtSource.addEventListener("error", () => {
			evtSource?.close();
			evtSource = null;
			// EventSource auto-reconnects; start a poll timer as extra fallback
			if (!pollTimer) {
				pollTimer = setInterval(refresh, 60_000);
			}
		});

		evtSource.addEventListener("open", () => {
			// SSE is up — cancel redundant poll timer
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
		});

		// Handle tab visibility: pause/resume SSE
		document.addEventListener("visibilitychange", _onVisibilityChange);
	}

	function disconnect() {
		evtSource?.close();
		evtSource = null;
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		document.removeEventListener("visibilitychange", _onVisibilityChange);
	}

	function _onVisibilityChange() {
		if (document.visibilityState === "visible") {
			// Reconnect and fetch any missed notifications
			if (!evtSource || evtSource.readyState === EventSource.CLOSED) {
				evtSource = null;
				connect();
			}
			refresh();
		}
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

	return {
		items,
		unread,
		hasUnread: computed(() => unread.value > 0),
		refresh,
		connect,
		disconnect,
		markAllRead,
		markRead,
	};
});
