// gemivo-PWA-Standard: network-first, /VERSION + sw.js nie cachen; Push-Benachrichtigungen
const C = "anruf-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname === "/VERSION" || u.pathname === "/sw.js") return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/icons/"))) { const k = r.clone(); caches.open(C).then(c => c.put(e.request, k)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || new Response("Offline", { status: 503 }))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (x) { d = { titel: "Gemma", text: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titel || "Gemma Anrufassistent", { body: d.text || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: d.url || "/app" } }));
});
self.addEventListener("notificationclick", e => { e.notification.close(); e.waitUntil(self.clients.openWindow(e.notification.data && e.notification.data.url || "/app")); });
