const CACHE_NAME = "edgehunter-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = event.request.url;
  if (url.startsWith("chrome-extension")) return;

  // Never cache API/data calls
  if (
    url.includes("supabase") ||
    url.includes("anthropic") ||
    url.includes("polymarket") ||
    url.includes("kalshi") ||
    url.includes("corsproxy")
  ) {
    return;
  }

  // NetworkFirst for HTML navigations and app shell
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/index.html"))
      )
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-suggestions") {
    event.waitUntil((async () => { console.log("EdgeHunter: background sync triggered"); })());
  }
});