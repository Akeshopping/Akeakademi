/* AKE Akademi çevrimdışı çalışma: site bir kez açıldıktan sonra internet olmadan da açılır.
   Sayfa ve ayarlar her açılışta önce internetten denenir; güncellemeler bu sayede hemen gelir. */
const V = "ake-780b76f2a9", FONTS = "ake-fonts";
const SHELL = ["/", "/ayar.js", "/manifest.webmanifest", "/icons/apple-touch-icon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/favicon-32.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname.startsWith("/api/")) return; /* sunucu istekleri (hesap, AI) asla önbelleğe alınmaz */
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
