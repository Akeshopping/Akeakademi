// B4 3B-2 · katalog API'sinin HTTP önbellek güvenliği (SUNUCU) + Service Worker'ın /api/ yollarını önbelleğe almaması.
// Gerçek handler'lar + yerel D1 kabuğu (tests/yardim/soru-v2.mjs). Sentetik sorular/hesaplar. Çalıştırma: node --test tests/soru-katalog-onbellek.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { kur, tohumla, SORU_ANAHTARLARI } from "./yardim/soru-v2.mjs";

const T = await kur(); const { DB, api, giris } = T; await T.hazirla();
const HIZ = readFileSync(resolve("migrations/0001_hiz_siniri.sql"), "utf8").split("\n").filter(l => !l.trim().startsWith("--")).join("\n").split(";").map(x => x.trim()).filter(Boolean);
for (const d of HIZ) DB.db.exec(d);
tohumla(DB, 60, { onek: "m", s: "mat", konular: ["Fonksiyonlar", "Limit"], zorluklar: [1, 2, 3] });
const hesapMod = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href), soruMod = await import(pathToFileURL(resolve("functions/api/soru/[[yol]].js")).href);
const KOK = "https://akeakademi.com"; let n = 0, ipn = 0;
const yeni = async () => { const k = await giris(`onb${++n}@ornek.com`); k.ip = `198.51.100.${++ipn % 250}`; return k; };
const kat = (k, q = "", ek = {}) => api("katalog" + q, { m: "GET", cookie: k && k.cookie, ek: { ...(k ? { "cf-connecting-ip": k.ip } : {}), ...ek } });
const cc = r => r.h.get("cache-control");
const cikis = async k => { const r = await hesapMod.onRequest({ request: new Request(KOK + "/api/hesap/cikis", { method: "POST", headers: { cookie: k.cookie, origin: KOK, "content-type": "application/json", "cf-connecting-ip": k.ip } }), env: T.env, params: { yol: ["cikis"] } }); return r.status; };

test("1) girişli katalog GET: 200 ve Cache-Control tam olarak 'private, no-store' (her sayfada)", async () => {
  const k = await yeni(); let sonra = null, sayfa = 0;
  do { const r = await kat(k, "?limit=25" + (sonra ? "&sonra=" + encodeURIComponent(sonra) : "")); assert.equal(r.s, 200); assert.equal(cc(r), "private, no-store"); assert.ok(!/max-age|public/.test(cc(r))); assert.ok(r.j.sorular.length > 0); sonra = r.j.sonraki; sayfa++; } while (sonra && sayfa < 5);
  assert.ok(sayfa >= 2, "birden çok sayfa denendi");
  const r = await kat(k); assert.equal(r.s, 200); assert.equal(cc(r), "private, no-store");
  assert.ok(Object.keys(r.j).every(a => ["n", "bayrak", "sorular", "sonraki"].includes(a)), "gövdede kullanıcıya özel alan yok"); for (const q of r.j.sorular.slice(0, 30)) assert.ok(Object.keys(q).every(a => SORU_ANAHTARLARI.has(a)));
});
test("2) diğer uçların davranışı DEĞİŞMEDİ: özet/oturum hataları 'private, no-store'; eski /api/sorular 'public, max-age=300'", async () => {
  const k = await yeni();
  const o = await api("ozet", { m: "GET", cookie: k.cookie }); assert.equal(o.s, 200); assert.equal(cc(o), "private, no-store");
  const g = await api("oturum", { cookie: k.cookie, govde: { yanlis: 1 }, ek: { "cf-connecting-ip": k.ip } }); assert.ok(g.s >= 400 && g.s < 500); assert.equal(cc(g), "private, no-store");
  const eski = await import(pathToFileURL(resolve("functions/api/sorular.js")).href); const r = await eski.onRequest({ request: new Request(KOK + "/api/sorular"), env: { ...T.env, AKE_SORU_V2: undefined, AKE_SORU_ESKI_KAPAT: undefined } });
  assert.ok(r.status === 200 || r.status === 404 || r.status === 410 || r.status === 503, "eski uç yanıt verdi"); if (r.status === 200) assert.equal(r.headers.get("cache-control"), "public, max-age=300");
  const src = readFileSync(resolve("lib/soru-api.js"), "utf8"); assert.equal((src.match(/max-age/g) || []).length, 0, "soru-api.js içinde artık hiçbir max-age yok");
});
test("3) anonim / geçersiz oturum: 401, 'private, no-store', gövdede soru yok", async () => {
  const a = await kat(null); assert.equal(a.s, 401); assert.equal(cc(a), "private, no-store"); assert.ok(!("sorular" in (a.j || {})));
  const b = await api("katalog", { m: "GET", cookie: "ake_s=gecersiz-oturum" }); assert.equal(b.s, 401); assert.equal(cc(b), "private, no-store");
});
test("4) çıkıştan sonra AYNI istek (aynı çerez) sunucuya gider ve 401 alır; önceki 200 yanıt tekrar kullanılamaz", async () => {
  const k = await yeni(); const once = await kat(k); assert.equal(once.s, 200); assert.equal(cc(once), "private, no-store");
  assert.equal(await cikis(k), 200);
  const sonra = await kat(k); assert.equal(sonra.s, 401, "oturum silindi → aynı çerezle 401"); assert.ok(!("sorular" in (sonra.j || {}))); assert.equal(cc(sonra), "private, no-store");
  const ozet = await api("ozet", { m: "GET", cookie: k.cookie }); assert.equal(ozet.s, 401);
});
test("5) hesap değişimi: A'nın oturumu kapanınca A 401, B 200; yanıtlar kullanıcıya özel veri taşımaz ve önbelleğe alınamaz", async () => {
  const A = await yeni(), B = await yeni(); const a1 = await kat(A), b1 = await kat(B); assert.equal(a1.s, 200); assert.equal(b1.s, 200);
  assert.equal(cc(a1), "private, no-store"); assert.equal(cc(b1), "private, no-store");
  assert.ok(!a1.t.includes(A.kid + "@") && !a1.t.includes("ornek.com") && !a1.t.includes("ake_s"), "yanıtta e-posta/oturum izi yok");
  assert.equal(await cikis(A), 200);
  assert.equal((await kat(A)).s, 401); assert.equal((await kat(B)).s, 200, "B etkilenmedi");
  assert.equal((await kat(A, "", { cookie: B.cookie })).s, 200, "çerez B'ye aitse B olarak yanıtlanır (kimlik yalnız sunucu çerezinden)");
});
test("6) hata davranışları korundu: 401, 429 (Retry-After), 405, 5xx hepsi 'private, no-store'", async () => {
  const k = await yeni(); let ilk429 = null;
  for (let i = 1; i <= 32; i++) { const r = await kat(k, "?limit=1"); if (r.s === 429) { ilk429 = r; break; } assert.equal(r.s, 200); assert.equal(cc(r), "private, no-store"); }
  assert.ok(ilk429, "31. istekte 429"); assert.equal(cc(ilk429), "private, no-store"); assert.ok(Number(ilk429.h.get("retry-after")) > 0); assert.ok(!("sorular" in ilk429.j));
  const m = await api("katalog", { m: "POST", cookie: k.cookie, govde: {} }); assert.equal(m.s, 405); assert.equal(cc(m), "private, no-store");
  /* 5xx: veritabanı yok → 500; veritabanı hata verirse → 503 */
  const dbsiz = await soruMod.onRequest({ request: new Request(KOK + "/api/soru/katalog", { headers: { cookie: k.cookie } }), env: { ...T.env, DB: undefined }, params: { yol: ["katalog"] } }); assert.equal(dbsiz.status, 500); assert.equal(dbsiz.headers.get("cache-control"), "private, no-store");
  const k2 = await yeni(); const bozukDb = new Proxy(T.env.DB, { get(h, p) { const v = h[p]; if (p !== "prepare") return typeof v === "function" ? v.bind(h) : v; return sql => { if (/FROM soru\b/.test(sql) && !/soru_/.test(sql) && /id|rk/.test(sql)) throw new Error("db-hata-SIRRI"); return h.prepare(sql); }; } });
  const r5 = await soruMod.onRequest({ request: new Request(KOK + "/api/soru/katalog?limit=5", { headers: { cookie: k2.cookie, "cf-connecting-ip": k2.ip } }), env: { ...T.env, DB: bozukDb }, params: { yol: ["katalog"] } }); const t5 = await r5.text();
  assert.ok(r5.status >= 500, "5xx beklenir: " + r5.status); assert.equal(r5.headers.get("cache-control"), "private, no-store"); assert.ok(!t5.includes("SIRRI"), "ayrıntı sızmaz");
});

/* ---------- Service Worker: /api/ yolları HİÇ önbelleğe alınmaz ---------- */
test("7) sw.js: /api/ GET istekleri için respondWith çağrılmaz ve cache'e yazılmaz (katalog, hesap, özet, eski uç)", async () => {
  const kaynak = readFileSync(resolve("sw.js"), "utf8"); const dinleyici = {}, yazilan = [], acilan = [];
  const caches = { open: async ad => { acilan.push(ad); return { put: async (k) => { yazilan.push(String(k && k.url || k)); }, addAll: async () => { }, keys: async () => [], match: async () => undefined, delete: async () => true }; }, keys: async () => [], match: async () => undefined, delete: async () => true };
  const self = { addEventListener: (ad, f) => { dinleyici[ad] = f; }, skipWaiting() { }, clients: { claim() { } }, registration: {} }; const location = { origin: KOK };
  new Function("self", "caches", "location", "clients", "fetch", "Request", "Response", kaynak)(self, caches, location, { matchAll: async () => [] }, async () => new Response("{}", { status: 200 }), Request, Response);
  assert.equal(typeof dinleyici.fetch, "function");
  const dene = async (yol, mod = "cors") => { let cevap = false; const req = new Request(KOK + yol, { method: "GET" }); Object.defineProperty(req, "mode", { value: mod }); dinleyici.fetch({ request: req, respondWith() { cevap = true; }, waitUntil() { } }); await new Promise(r => setTimeout(r, 5)); return cevap; };
  for (const y of ["/api/soru/katalog", "/api/soru/katalog?limit=1000", "/api/soru/ozet", "/api/hesap/ben", "/api/sorular", "/api/ai"]) { assert.equal(await dene(y), false, y + " için respondWith çağrılmamalı"); assert.equal(await dene(y, "navigate"), false, y + " (navigate) için de çağrılmamalı"); }
  assert.deepEqual(yazilan, [], "/api/ hiçbir şey önbelleğe yazılmadı");
  /* olumlu kontrol: SW gerçekten çalışıyor; kabuk isteğine yanıt veriyor (sahte yeşil değil) */
  assert.equal(await dene("/", "navigate"), true, "olumlu kontrol: ana sayfa SW tarafından işlenir");
});
test("8) sw.js: /api/ koruması kaynakta duruyor ve başka bir yerde /api/ önbelleğe alan satır yok", () => {
  const s = readFileSync(resolve("sw.js"), "utf8"); assert.match(s, /pathname\.startsWith\("\/api\/"\)\) return;/); assert.ok(!/cache\.put\([^)]*api/i.test(s));
});
