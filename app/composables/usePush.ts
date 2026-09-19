import { computed, ref } from "vue";
import { api } from "~/lib/api";

function urlBase64ToUint8Array(base64: string) {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(b64);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

const supported = ref(false);
const permission = ref<NotificationPermission>("default");
const subscribed = ref(false);
const busy = ref(false);
let initialized = false;

async function detect() {
	if (initialized) return;
	initialized = true;
	if (typeof window === "undefined") return;
	supported.value =
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window;
	if (!supported.value) return;
	permission.value = Notification.permission;
	try {
		const reg = await navigator.serviceWorker.getRegistration("/sw.js");
		if (reg) {
			const sub = await reg.pushManager.getSubscription();
			subscribed.value = !!sub;
		}
	} catch {}
}

async function subscribe() {
	if (busy.value) return;
	const config = useRuntimeConfig();
	const publicKey = config.public.vapidPublicKey;
	if (!publicKey) throw new Error("VAPID public key not configured");
	busy.value = true;
	try {
		const perm = await Notification.requestPermission();
		permission.value = perm;
		if (perm !== "granted") return;
		const reg =
			(await navigator.serviceWorker.getRegistration("/sw.js")) ||
			(await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
		await navigator.serviceWorker.ready;
		let sub = await reg.pushManager.getSubscription();
		if (!sub) {
			sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey),
			});
		}
		const json = sub.toJSON();
		await api.post("/push/subscribe", {
			endpoint: sub.endpoint,
			keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
		});
		subscribed.value = true;
	} finally {
		busy.value = false;
	}
}

async function unsubscribe() {
	if (busy.value) return;
	busy.value = true;
	try {
		const reg = await navigator.serviceWorker.getRegistration("/sw.js");
		if (!reg) {
			subscribed.value = false;
			return;
		}
		const sub = await reg.pushManager.getSubscription();
		if (sub) {
			await api
				.post("/push/unsubscribe", { endpoint: sub.endpoint })
				.catch(() => {});
			await sub.unsubscribe().catch(() => {});
		}
		subscribed.value = false;
	} finally {
		busy.value = false;
	}
}

export function usePush() {
	if (import.meta.client) detect();
	return {
		supported: computed(() => supported.value),
		permission: computed(() => permission.value),
		subscribed: computed(() => subscribed.value),
		busy: computed(() => busy.value),
		subscribe,
		unsubscribe,
	};
}
