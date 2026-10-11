const VERSION = "v2";
const STATIC_CACHE = `orbit-static-${VERSION}`;
const RUNTIME_CACHE = `orbit-runtime-${VERSION}`;
const PREVIEW_CACHE = `orbit-preview-${VERSION}`;

self.addEventListener("install", (event) => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((k) => k.startsWith("orbit-") && !k.endsWith(VERSION))
					.map((k) => caches.delete(k)),
			);
			await self.clients.claim();
		})(),
	);
});

function isHashedAsset(url) {
	return url.pathname.startsWith("/_nuxt/");
}

function isStaticAsset(url) {
	return (
		url.pathname === "/favicon.svg" ||
		url.pathname === "/manifest.json" ||
		url.pathname.startsWith("/_fonts/") ||
		url.pathname.startsWith("/images/")
	);
}

function isPreview(url) {
	return /^\/api\/files\/[^/]+\/preview$/.test(url.pathname);
}

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;
	const res = await fetch(request);
	if (res.ok) cache.put(request, res.clone());
	return res;
}

async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const network = fetch(request)
		.then((res) => {
			if (res.ok) cache.put(request, res.clone());
			return res;
		})
		.catch(() => cached);
	return cached || network;
}

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	if (isHashedAsset(url)) {
		event.respondWith(cacheFirst(req, STATIC_CACHE));
		return;
	}
	if (isStaticAsset(url)) {
		event.respondWith(cacheFirst(req, STATIC_CACHE));
		return;
	}
	if (isPreview(url)) {
		event.respondWith(staleWhileRevalidate(req, PREVIEW_CACHE));
		return;
	}
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
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clients) => {
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
