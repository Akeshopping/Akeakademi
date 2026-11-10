/* AKE Akademi çevrimdışı çalışma: site bir kez açıldıktan sonra internet olmadan da açılır.
   Kural: ağ başarılıysa her zaman ağdaki sürüm kullanılır; önbellek yalnızca ağ yokken (ya da sunucu 5xx verirken) devreye girer.
   Önbellek "son başarılı sürüm" olarak her başarılı yanıtta yenilenir; bu yüzden eski sürüm kullanıcıda takılı kalmaz.
   V, önbellek düzeni değiştiğinde artırılır: etkinleşirken V ve fontlar dışındaki bütün önbellekler silinir. */
const V = "ake-s2", FONTS = "ake-fonts";
const SHELL = ["/", "/ayar.js", "/manifest.webmanifest", "/icons/apple-touch-icon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/favicon-32.png"];
const ESKI_MS = 30 * 86400000; /* ziyaret edilmeyen eski kayıtlar bu süreden sonra temizlenir */
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: "AKE Akademi", b: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.t || "AKE Akademi", { body: d.b || "", icon: "/icons/icon-192.png", badge: "/icons/favicon-32.png", tag: d.tag || "ake", renotify: true, data: { u: d.u || "/" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const u = (e.notification.data && e.notification.data.u) || "/";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => { for (const c of l) { if ("focus" in c) { c.navigate(u).catch(() => { }); return c.focus(); } } return clients.openWindow(u); }));
});
/* son başarılı sürümü sakla; yalnızca tam (200), aynı kaynaklı yanıtlar */
function sakla(key, res) {
  if (res && res.status === 200 && res.type === "basic") { const cp = res.clone(); caches.open(V).then(c => c.put(key, cp)).catch(() => { }); }
  return res;
}
/* uzun süredir hiç yenilenmemiş (artık sunulmayan) kayıtları temizle; uygulama kabuğu hariç */
function eskiTemizle() {
  return caches.open(V).then(c => c.keys().then(ks => Promise.all(ks.map(k => {
    const p = new URL(k.url).pathname; if (SHELL.includes(p)) return null;
    return c.match(k).then(m => { const t = m && Date.parse(m.headers.get("date") || ""); if (t && Date.now() - t > ESKI_MS) return c.delete(k); }); })))).catch(() => { });
}
/* önce ağ; ağ yoksa ya da 5xx ise önbellek (varsa), yoksa geri dönüş */
function agOnce(r, key, geri) {
  return fetch(r).then(res => {
    if (res.status >= 500) return caches.match(key).then(m => m || res);
    return sakla(key, res);
  }).catch(() => caches.match(key).then(m => m || (geri ? caches.match(geri) : null) || Response.error()));
}
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname.startsWith("/api/")) return; /* sunucu istekleri (hesap, kota, AI, ödeme, yönetim) asla önbelleğe alınmaz */
    if (r.headers.has("range")) return; /* kısmi istekler (medya) doğrudan ağa */
    if (r.mode === "navigate") {
      /* uygulama kabuğu "/" ; ayrı sayfalar (/sss/, /matematik-yks-sorulari/ ...) kendi adresiyle saklanır ve kabuğu ezmez.
         Ağ varken her zaman sayfanın kendisi gelir; yalnızca çevrimdışıyken, o sayfa hiç görülmediyse kabuğa dönülür. */
      const key = u.pathname === "/" ? "/" : u.pathname;
      e.respondWith(agOnce(r, key, "/"));
      if (key === "/") e.waitUntil(eskiTemizle());
      return;
    }
    /* sorular, ayarlar, simgeler ve diğer her şey: önce ağ (tarayıcı HTTP önbelleği _headers kurallarıyla verimli çalışır) */
    e.respondWith(agOnce(r, u.pathname, null));
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(FONTS).then(c => c.put(r, cp)).catch(() => { }); return res; })));
  }
});
