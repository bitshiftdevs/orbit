self.addEventListener("install", (event) => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { title: "Orbit", body: event.data ? event.data.text() : "" };
	}
	const title = data.title || "Orbit";
	const options = {
		body: data.body || "",
		icon: data.icon || "/favicon.svg",
		badge: "/favicon.svg",
		tag: data.tag,
		data: { url: data.url || "/" },
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || "/";
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
			for (const c of clients) {
				if ("focus" in c) {
					c.focus();
					if ("navigate" in c) c.navigate(url).catch(() => {});
					return;
				}
			}
			if (self.clients.openWindow) return self.clients.openWindow(url);
		}),
	);
});
