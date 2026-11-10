// Service worker güncelleme regresyonu: eski sürüm (V1 + eski worker) → yeni sürüm (V2) → V3 geçişi, gerçek tarayıcıda.
// Çalıştırma: node tests/sw-guncelleme-regresyon.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SW_ESKI = readFileSync(KOK + "/tests/sw-fixtures/sw-eski.js", "utf8"), SW_YENI = readFileSync(KOK + "/sw.js", "utf8"), INDEX = readFileSync(KOK + "/index.html", "utf8");
const HEADERS = readFileSync(KOK + "/_headers", "utf8");
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : ek); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/* ---- statik: _headers ve sw.js kuralları ---- */
const kural = yol => { const m = HEADERS.split(/\n(?=\S)/).find(b => b.split("\n")[0].trim() === yol); return m ? m.split("\n").slice(1).join(" ").trim() : ""; };
t("H1 /sw.js uzun süre önbelleğe alınmaz", /no-cache/.test(kural("/sw.js")) && /max-age=0/.test(kural("/sw.js")), kural("/sw.js"));
for (const y of ["/", "/index.html", "/sss/*", "/matematik-yks-sorulari/*", "/manifest.webmanifest", "/ayar.js"]) t(`H2 ${y} her seferinde doğrulanır (no-cache)`, /no-cache/.test(kural(y)), kural(y));
t("H3 simgeler verimli önbelleklenir (max-age)", /max-age=86400/.test(kural("/icons/*")), kural("/icons/*"));
t("S1 sw.js /api/ isteklerine hiç karışmaz", /pathname\.startsWith\("\/api\/"\)\) return/.test(SW_YENI));
const ayniKaynak = SW_YENI.slice(SW_YENI.indexOf("if (u.origin === location.origin) {"), SW_YENI.indexOf("} else if (/(^|"));
t("S2 sw.js aynı kaynakta 'önce önbellek' stratejisi içermez (yalnızca agOnce: önce ağ)", ayniKaynak.length > 100 && !/caches\.match/.test(ayniKaynak) && (ayniKaynak.match(/agOnce\(/g) || []).length === 2, ayniKaynak.length + "");
t("S3 skipWaiting + clients.claim korunmuş", /skipWaiting/.test(SW_YENI) && /clients\.claim/.test(SW_YENI));
t("S4 kayıt updateViaCache:none kullanıyor ve kayıttan sonra update soruyor", /updateViaCache: "none"/.test(INDEX) && /reg\.update\(\)/.test(INDEX));

/* ---- tarayıcı: V1 → V2 → V3 ---- */
const S = { s: "V1", down: false, istek: [] };
const sayfaHtml = (s, ad) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="surum" content="${s}"><title>${ad}</title></head><body>${ad} ${s}</body></html>`;
const V1HTML = s => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="surum" content="${s}"><title>Eski</title></head><body>eski uygulama<script>if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));</script></body></html>`;
const anaHtml = () => S.s === "V1" ? V1HTML("V1") : INDEX.replace("<head>", `<head><meta name="surum" content="${S.s}">`);
const srv = http.createServer((q, r) => {
  if (S.down) { q.socket.destroy(); return; }
  const f = q.url.split("?")[0]; S.istek.push(q.method + " " + f);
  const send = (tip, govde, cc) => { r.setHeader("content-type", tip); if (cc) r.setHeader("cache-control", cc); r.end(govde); };
  if (f === "/sw.js") return send("text/javascript", S.s === "V1" ? SW_ESKI : S.s === "V3" ? SW_YENI + "\n/* v3 */" : SW_YENI, "no-cache, max-age=0, must-revalidate");
  if (f === "/" || f === "/index.html") return send("text/html; charset=utf-8", anaHtml(), "no-cache");
  if (f === "/matematik-yks-sorulari/") return send("text/html; charset=utf-8", sayfaHtml("SEO-" + S.s, "Matematik SEO"), "no-cache");
  if (f === "/ayar.js") return send("text/javascript", `window.AYAR={};/*${S.s}*/`, "no-cache");
  if (f === "/manifest.webmanifest") return send("application/manifest+json", "{\"name\":\"t\"}", "no-cache");
  if (f.startsWith("/icons/")) return send("image/png", PNG, "public, max-age=86400");
  if (f.startsWith("/sorular/")) return send("application/json", "[]", "no-cache");
  if (f.startsWith("/api/")) return send("application/json", JSON.stringify({ api: f, s: S.s }), "no-store");
  r.statusCode = 404; r.end("yok");
});
await new Promise(r => srv.listen(0, r)); const B = "http://localhost:" + srv.address().port;
const bekle = async (fn, ms = 12000) => { const b0 = Date.now(); while (Date.now() - b0 < ms) { try { if (await fn()) return true; } catch (e) { } await new Promise(r => setTimeout(r, 150)); } return false; };
const br = await pw.chromium.launch(); const c = await br.newContext({ serviceWorkers: "allow", locale: "tr-TR" }); const p = await c.newPage();
let yuk = 0; p.on("load", () => yuk++); const hatalar = []; p.on("pageerror", e => hatalar.push(e.message));
const surum = () => p.evaluate(() => (document.querySelector('meta[name=surum]') || {}).content || null);
const onbellek = () => p.evaluate(async () => { const o = {}; for (const k of await caches.keys()) { const ca = await caches.open(k); o[k] = (await ca.keys()).map(r => new URL(r.url).pathname); } return o; });

/* A) V1 + eski worker yüklü, ana sayfa önbelleğe alındı */
S.s = "V1"; await p.goto(B + "/"); await bekle(() => p.evaluate(() => !!navigator.serviceWorker.controller));
t("A1 V1 açıldı, eski worker sayfayı denetliyor", (await surum()) === "V1" && await p.evaluate(() => !!navigator.serviceWorker.controller));
const eskiOn = await onbellek(); t("A2 V1 ana sayfası eski önbellekte (ake-b7d41e09c2)", !!eskiOn["ake-b7d41e09c2"] && eskiOn["ake-b7d41e09c2"].includes("/"), JSON.stringify(Object.keys(eskiOn)));
const v1fetch = await p.evaluate(() => fetch("/index.html").then(r => r.text())); t("A3 (hata yeniden üretimi) V1 '/index.html' alt isteği önbelleğe girdi", /V1/.test(v1fetch));
/* B) sunucu V2'ye geçti; kullanıcı siteyi normal şekilde yeniden açar (hard refresh/cache temizleme/unregister yok) */
S.s = "V2"; const stale = await p.evaluate(() => fetch("/index.html").then(r => r.text()));
t("B0 (hata yeniden üretimi) eski worker V2 yayınlanmışken alt istekte hâlâ V1 veriyor", /V1/.test(stale) && !/V2/.test(stale));
yuk = 0; await p.goto(B + "/");
t("B1 normal yeniden açışta V2 geldi", (await surum()) === "V2", String(await surum()));
const gecti = await bekle(async () => { const k = Object.keys(await onbellek()); const ctrl = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r && r.active ? r.active.scriptURL : ""; }); return k.includes("ake-s2") && !k.includes("ake-b7d41e09c2"); });
t("B2 yeni worker devraldı, eski önbellek (ake-b7d41e09c2) silindi", gecti, JSON.stringify(Object.keys(await onbellek())));
await bekle(async () => (await surum()) === "V2");
const v2fetch = await p.evaluate(() => fetch("/index.html").then(r => r.text())); t("B3 alt istek de artık V2 veriyor (eski sürüm takılı kalmıyor)", /content="V2"/.test(v2fetch) && !/content="V1"/.test(v2fetch));
await p.waitForTimeout(4500);
t("B4 sonsuz yenileme yok: toplam sayfa yükleme ≤ 2 (açılış + en çok 1 kontrollü yenileme) [yükleme=" + yuk + "]", yuk <= 2, "yuk=" + yuk);
t("B5 sayfa hatası yok", hatalar.length === 0, hatalar.join("|"));
/* C) API cevapları Cache Storage'a yazılmaz */
S.istek.length = 0;
await p.evaluate(async () => { await fetch("/api/hesap/kota"); await fetch("/api/hesap/kota", { method: "POST", body: "{}" }); await fetch("/api/hesap/ben"); await fetch("/api/ai/sor", { method: "POST", body: "{}" }); await fetch("/api/shopier/webhook", { method: "POST", body: "{}" }); await fetch("/api/yonetim/durum"); });
const apiOn = await onbellek(); const apiVar = Object.values(apiOn).flat().some(x => x.startsWith("/api/"));
t("C1 hesap, kota, AI, Shopier, yönetim API'leri Cache Storage'a yazılmadı", !apiVar, JSON.stringify(apiOn));
t("C2 API istekleri her seferinde sunucuya gitti (6/6)", S.istek.filter(x => /\/api\//.test(x)).length === 6, S.istek.join(","));
/* D) ayrı sayfa: çevrimiçi kendi içeriğini verir, kabuğa dönüşmez */
await p.goto(B + "/matematik-yks-sorulari/"); t("D1 SEO sayfası çevrimiçi kendi içeriği (uygulama kabuğu değil)", (await surum()) === "SEO-V2", String(await surum()));
/* E) çevrimdışı: son başarılı sürüm açılır */
S.down = true; await c.setOffline(true);
await p.goto(B + "/"); t("E1 çevrimdışı ana sayfa son başarılı sürümle (V2) açıldı", (await surum()) === "V2", String(await surum()));
await p.goto(B + "/matematik-yks-sorulari/"); t("E2 çevrimdışı, önceden görülen SEO sayfası kendi içeriğiyle açıldı", (await surum()) === "SEO-V2", String(await surum()));
await p.goto(B + "/sss/"); t("E3 çevrimdışı, hiç görülmemiş sayfa uygulama kabuğuna düşer", (await surum()) === "V2", String(await surum()));
S.down = false; await c.setOffline(false);
/* F) V3: yeni worker bayt değişimiyle devralır, eski önbellek anahtarı sürer, yenileme döngüsü yok */
S.s = "V3"; yuk = 0; await p.goto(B + "/");
t("F1 V3 normal açışta geldi", (await surum()) === "V3", String(await surum()));
await p.goto(B + "/matematik-yks-sorulari/"); t("F2 SEO sayfası V3 içeriğiyle geldi (eski önbellek tercih edilmedi)", (await surum()) === "SEO-V3", String(await surum()));
await p.waitForTimeout(3500); t("F3 V3 geçişinde yenileme döngüsü yok (yükleme ≤ 4)", yuk <= 4, "yuk=" + yuk);
await c.close(); await br.close(); srv.close();
console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
