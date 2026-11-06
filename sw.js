/* AKE Akademi çevrimdışı çalışma: site bir kez açıldıktan sonra internet olmadan da açılır.
   Sayfa ve ayarlar her açılışta önce internetten denenir; güncellemeler bu sayede hemen gelir. */
const V = "ake-f3337beeb0", FONTS = "ake-fonts";
const SHELL = ["/", "/ayar.js", "/manifest.webmanifest", "/icons/apple-touch-icon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/favicon-32.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: "AKE Akademi", b: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.t || "AKE Akademi", { body: d.b || "", icon: "/icons/icon-192.png", badge: "/icons/favicon-32.png", tag: d.tag || "ake", renotify: true, data: { u: d.u || "/" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const u = (e.notification.data && e.notification.data.u) || "/";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => { for (const c of l) { if ("focus" in c) { c.navigate(u).catch(() => { }); return c.focus(); } } return clients.openWindow(u); }));
});
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname.startsWith("/api/")) return; /* sunucu istekleri (hesap, AI) asla önbelleğe alınmaz */
    if (r.mode === "navigate" && u.pathname !== "/") { e.respondWith(fetch(r).catch(() => caches.match("/"))); return; } /* ayrı sayfalar (ör. /sss/) uygulama kabuğunu ezmez */
    const key = r.mode === "navigate" ? "/" : u.pathname;
    if (r.mode === "navigate" || u.pathname === "/ayar.js") {
      e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(key, cp)); } return res; }).catch(() => caches.match(key)));
      return;
    }
    e.respondWith(caches.match(key).then(m => m || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(key, cp)); } return res; })));
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(FONTS).then(c => c.put(r, cp)); return res; })));
  }
});
