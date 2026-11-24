// Web istemcisinin "stats" senkronu · index.html'deki GERÇEK blok (STATS-SENKRON-BASLA…BITIS) + GERÇEK sunucu kodu (node:sqlite).
// Kapsam: çevrimdışı/gönderilmemiş cevaplar mobil yazımıyla ezilmez; eskimiş sekme mobilin ilerlemesini silmez; kayıp yanıtta çift sayım yok;
// eşzamanlı web+mobil+ikinci web cihazı; sunucu koşullu yazma (_b); gönderilemeyen olaylar kaybolmaz.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { kur, tohumla } from "./yardim/soru-v2.mjs";

const T = await kur();
const { env, giris, api, yeniIstek, DB } = T;
await T.hazirla();
tohumla(DB, 80, { onek: "w", s: "mat", konular: ["Sayılar"], zorluklar: [1, 2, 3] });
const { onRequest } = await import("../functions/api/hesap/[[yol]].js");
let ipn = 0;
const hesapCagir = (tok, yontem, yol, govde) => onRequest({ request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: yontem, headers: { "content-type": "application/json", authorization: "Bearer " + tok, "cf-connecting-ip": "10.7." + (++ipn >> 8 & 255) + "." + (ipn & 255) }, body: govde ? JSON.stringify(govde) : undefined }), env, params: { yol: yol.split("/") } });
const tokenAl = async e => decodeURIComponent(/^ake_s=([^;]*)/.exec((await giris(e)).cookie)[1]);
const kullanici = async e => { const g = await giris(e); T.premiumYap(g.kid); return { cookie: g.cookie, tok: decodeURIComponent(/^ake_s=([^;]*)/.exec(g.cookie)[1]) }; };
const remote = async tok => { const j = await (await hesapCagir(tok, "GET", "veri")).json(); return { st: j.alanlar.stats, u: (j.u || {}).stats }; };
const topla = st => Object.values((st && st.topic) || {}).reduce((a, t) => a + t[0] + t[1] + t[2], 0);

/* index.html'deki gerçek bloğu çıkar */
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bas = html.indexOf("/* STATS-SENKRON-BASLA"), bit = html.indexOf("/* STATS-SENKRON-BITIS */");
assert.ok(bas > 0 && bit > bas, "senkron bloğu index.html'de yok");
const BLOK = html.slice(bas, bit);

/* Bir "web cihazı": kendi S durumu, kendi ağ kesme/kayıp-yanıt anahtarları */
function webCihaz(tok, { S0 } = {}) {
  const h = { cevrimdisi: false, kayipYanit: 0, kayipOnce: 0 };
  const dayKey = () => "2026-11-24";
  const S = S0 || { upd: {}, ans: {}, topic: {}, daily: {}, para: { times: [], c: 0, w: 0 }, badges: {}, tr: {}, td: {}, pend: [], sb: 0 };
  const fetchFn = async (url, opt = {}) => {
    if (h.cevrimdisi) throw new TypeError("network");
    const yol = new URL(url, "https://akeakademi.com").pathname.replace("/api/hesap/", "");
    const put = (opt.method || "GET") === "PUT";
    if (put && h.kayipOnce > 0) { h.kayipOnce--; throw new TypeError("istek gitmedi"); }
    const r = await hesapCagir(tok, opt.method || "GET", yol, opt.body ? JSON.parse(opt.body) : undefined);
    if (put && h.kayipYanit > 0) { h.kayipYanit--; throw new TypeError("yanıt kayboldu"); }
    return r;
  };
  const ctx = {
    S, AREA: { stats: ["ans", "topic", "daily", "para", "badges", "tr", "td"] }, clone: o => JSON.parse(JSON.stringify(o)), uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7), dayKey,
    BYTES: s => new TextEncoder().encode(s).length, DOC_LIMIT: 230000, HESAP: { user: {} }, fetch: fetchFn, normalize() { }, saveLocal() { },
    hesapIstek: async (path, opt) => { const r = await fetchFn("/api/hesap/" + path, opt); let j = {}; try { j = await r.json(); } catch (e) { } return { r, j }; },
    TextEncoder, JSON, Math, Date, Set, Object, Array, Number, String
  };
  const f = vm.runInNewContext(BLOK + "\n({ olayEkle, statsOlay, olayId, statsSenkron, olayUygula, statsMaks, statsBirlestir })", ctx);
  /* record() eşdeğeri: yerel sayaç + olay (index.html record() ile aynı iki adım) */
  const cevapla = (id, res = 1, s = "mat", t = "Sayılar", d = 2) => { const q = { id, s, t, d }; f.olayUygula(S, f.statsOlay(q, res)); /* yerel sayaç */ f.olayEkle(S.pend.length >= 0 ? S.__son || null : null); };
  return { S, f, h, ctx };
}
/* gerçek record(): yerelde sayaç uygula + AYNI olayı pend'e ekle */
function kayit(c, id, res = 1, ek = {}) {
  const q = { id, s: "mat", t: "Sayılar", d: 2, ...ek }, ev = c.f.statsOlay(q, res);
  c.f.olayUygula(c.S, ev); c.f.olayEkle(ev);
}
/* mobil: sunucu tarafı cevap + ilerleme */
async function mobilCevapla(c, n) {
  const o = await api("oturum", { cookie: c.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: n, ders: "mat" } });
  assert.equal(o.s, 200);
  for (const s of o.j.sorular) await api("cevap", { cookie: c.cookie, govde: { oturum: o.j.oturum, soru: s.id, secim: 0 } });
  await api("bitir", { cookie: c.cookie, govde: { oturum: o.j.oturum } });
  return o.j.oturum;
}
const mobilIlerle = (c, oturum) => api("ilerleme", { cookie: c.cookie, govde: { oturum } });

test("1) ÇEVRİMDIŞI/gönderilmemiş web cevapları, mobil yazımından sonra ezilmez (ikisi de sayılır)", async () => {
  const c = await kullanici("web1@ornek.com"), w = webCihaz(c.tok);
  kayit(w, "a1"); await w.f.statsSenkron();            // ilk senkron
  assert.equal(w.S.sb, 1);
  w.h.cevrimdisi = true;
  kayit(w, "a2"); kayit(w, "a3", 0);                  // çevrimdışı 2 cevap
  await assert.rejects(w.f.statsSenkron());
  assert.equal(w.S.pend.length, 2, "gönderilemeyen olaylar kaybolmamalı");
  const o = await mobilCevapla(c, 3); await mobilIlerle(c, o); // mobil, web çevrimdışıyken 3 cevap
  w.h.cevrimdisi = false;
  await w.f.statsSenkron();
  const { st } = await remote(c.tok);
  assert.equal(topla(st), 1 + 2 + 3, "web (1+2) + mobil (3) hepsi hesapta");
  assert.equal(topla(w.S), 6); assert.equal(w.S.pend.length, 0);
  assert.equal(st.ans["a3"][1], 1, "web'in kendi ans alanı korunur");
});

test("2) ESKİMİŞ web sekmesi daha yeni yerel zamanla yazsa bile mobilin ilerlemesini silmez", async () => {
  const c = await kullanici("web2@ornek.com"), w = webCihaz(c.tok);
  kayit(w, "b1"); await w.f.statsSenkron();
  const o = await mobilCevapla(c, 4); await mobilIlerle(c, o);   // mobil yazdı; web sekmesi bunu bilmiyor
  kayit(w, "b2"); kayit(w, "b3");                                // eski sekmede devam
  await w.f.statsSenkron();
  const { st } = await remote(c.tok);
  assert.equal(topla(st), 1 + 4 + 2);
  assert.equal(topla(w.S), 7, "web de mobil ilerlemesini aldı");
});

test("3) PUT işlendi ama yanıt kayboldu: tekrar denemede ÇİFT SAYIM yok; istek hiç gitmediyse olay korunur", async () => {
  const c = await kullanici("web3@ornek.com"), w = webCihaz(c.tok);
  kayit(w, "c0"); await w.f.statsSenkron();
  kayit(w, "c1"); kayit(w, "c2");
  w.h.kayipYanit = 1;
  await assert.rejects(w.f.statsSenkron());
  assert.equal((await remote(c.tok)).st.topic["mat|Sayılar"].reduce((a, b) => a + b, 0), 3, "sunucu yazdı");
  assert.equal(w.S.pend.length, 2, "onay gelmedi: olaylar bekler");
  await w.f.statsSenkron();                                       // yeniden dene
  assert.equal(topla((await remote(c.tok)).st), 3, "çift sayılmadı (_ev ile tekil)");
  assert.equal(w.S.pend.length, 0);
  kayit(w, "c3"); w.h.kayipOnce = 1;
  await assert.rejects(w.f.statsSenkron());
  assert.equal(w.S.pend.length, 1); await w.f.statsSenkron();
  assert.equal(topla((await remote(c.tok)).st), 4);
});

test("4) EŞZAMANLI: web senkronu + mobil ilerleme + ikinci web cihazı, farklı araya girme sıralarıyla — toplam her seferinde doğru", async () => {
  const bekle = n => new Promise(r => { let i = 0; const f = () => (i++ >= n ? r() : setImmediate(f)); f(); });
  let bozuk = 0;
  for (let d = 0; d < 12; d++) {
    const c = await kullanici(`web4-${d}@ornek.com`), w1 = webCihaz(c.tok), w2 = webCihaz(c.tok);
    await w1.f.statsSenkron(); await w2.f.statsSenkron();   // iki cihaz da yüklenirken bir kez senkron olur (başlangıç), sonra cevaplar
    kayit(w1, "d0"); await w1.f.statsSenkron(); kayit(w2, "dx"); await w2.f.statsSenkron();
    const o = await mobilCevapla(c, 2);
    kayit(w1, "d1"); kayit(w1, "d2"); kayit(w2, "d3");
    await Promise.all([
      (async () => { await bekle(d % 5); await w1.f.statsSenkron(); })(),
      (async () => { await bekle((d + 2) % 6); await mobilIlerle(c, o); })(),
      (async () => { await bekle((d * 3) % 7); await w2.f.statsSenkron(); })()
    ]);
    await w1.f.statsSenkron(); await w2.f.statsSenkron(); await mobilIlerle(c, o);
    const beklenen = 1 + 1 + 2 + 2 + 1; // w1(d0,d1,d2) + w2(dx,d3) -> d0,dx iki cihazda ayrı sayılır; mobil 2
    if (topla((await remote(c.tok)).st) !== beklenen) bozuk++;
  }
  assert.equal(bozuk, 0, `${bozuk}/12 denemede sayım yanlış`);
});

test("5) sunucu koşullu yazma: _b eşleşmezse 409; _b yoksa eski davranış; satır yokken _b:0 yalnız bir kez", async () => {
  const tok = await tokenAl("web5@ornek.com");
  assert.equal((await hesapCagir(tok, "PUT", "veri/stats", { _b: 0, topic: { x: [1, 0, 0] } })).status, 200);
  const ikinci = await hesapCagir(tok, "PUT", "veri/stats", { _b: 0, topic: { x: [9, 9, 9] } });
  assert.equal(ikinci.status, 409);
  const { st, u } = await remote(tok);
  assert.deepEqual(st.topic.x, [1, 0, 0]); assert.equal(st._u, u, "belgedeki _u = tablo u");
  const yanlis = await hesapCagir(tok, "PUT", "veri/stats", { _b: u - 1, topic: { x: [7, 7, 7] } });
  assert.equal(yanlis.status, 409); assert.equal((await yanlis.json()).u, u);
  const dogru = await hesapCagir(tok, "PUT", "veri/stats", { _b: u, topic: { x: [2, 0, 0] } });
  assert.equal(dogru.status, 200); assert.ok((await dogru.json()).u > u);
  assert.equal((await hesapCagir(tok, "PUT", "veri/stats", { _b: -1, topic: {} })).status, 400);
  assert.equal((await hesapCagir(tok, "PUT", "veri/stats", { _b: "1", topic: {} })).status, 400);
  const eski = await hesapCagir(tok, "PUT", "veri/stats", { _u: 5, topic: { x: [0, 0, 0] } });
  assert.equal(eski.status, 409, "eski istemci: daha eski _u hâlâ reddedilir");
  assert.equal((await hesapCagir(tok, "PUT", "veri/plan", { _u: 1, plan: { tasks: [] } })).status, 200, "diğer alanlar etkilenmez");
});

test("6) AYNI ANDA iki koşullu yazma aynı tabandan: tam biri kazanır (CAS atomik)", async () => {
  let cift = 0;
  for (let i = 0; i < 20; i++) {
    const tok = await tokenAl(`web6-${i}@ornek.com`);
    await hesapCagir(tok, "PUT", "veri/stats", { _b: 0, topic: {} });
    const { u } = await remote(tok);
    const [a, b] = await Promise.all([hesapCagir(tok, "PUT", "veri/stats", { _b: u, topic: { k: [1, 0, 0] } }), hesapCagir(tok, "PUT", "veri/stats", { _b: u, topic: { k: [2, 0, 0] } })]);
    if (!(a.status === 200 && b.status === 409) && !(a.status === 409 && b.status === 200)) cift++;
  }
  assert.equal(cift, 0);
});

test("7) tek seferlik başlangıç: eski (senkron görmemiş) cihazın sayaçları ile uzak sayaçlar büyüğünün altına düşmeden birleşir", async () => {
  const c = await kullanici("web7@ornek.com");
  const o = await mobilCevapla(c, 3); await mobilIlerle(c, o);                     // hesapta mobil: 3
  const yerel = { upd: {}, ans: { z1: [2, 1, 0, 5, 0] }, topic: { "mat|Sayılar": [2, 1, 0], "mat|Eski": [4, 0, 0] }, daily: { "2026-11-23": { q: 5, c: 4 } }, para: { times: [4], c: 1, w: 0 }, badges: { ilk: 7 }, tr: {}, td: {}, pend: [], sb: 0 };
  const w = webCihaz(c.tok, { S0: yerel });
  await w.f.statsSenkron();
  const { st } = await remote(c.tok);
  assert.ok(st.topic["mat|Eski"][0] === 4, "yalnız yerelde olan konu korunur");
  assert.ok(topla(st) >= 3 + 4, "hiçbir taraf geriye gitmedi"); assert.equal(st.badges.ilk, 7); assert.ok(st.daily["2026-11-23"].q === 5);
  assert.equal(w.S.sb, 1);
});

test("8) senkron sürerken gelen yeni cevap kaybolmaz; para ve odak olayları da taşınır", async () => {
  const c = await kullanici("web8@ornek.com"), w = webCihaz(c.tok);
  kayit(w, "p1"); await w.f.statsSenkron();
  kayit(w, "p2");
  const asil = w.ctx.fetch; let eklendi = false;
  w.ctx.fetch = async (u, o) => { if (!eklendi && o && o.method === "PUT") { eklendi = true; kayit(w, "p3"); } return asil(u, o); }; // PUT sırasında kullanıcı bir soru daha çözdü
  // vm içindeki fetch referansı ctx üzerinden okunur
  await w.f.statsSenkron();
  assert.equal(w.S.pend.length, 1, "araya giren cevap hâlâ beklemede");
  assert.equal(topla(w.S), 3, "yerelde sayılıyor");
  w.f.olayEkle({ e: w.f.olayId(), k: "p", secs: 9, r: 1, ts: Date.now() }); w.f.olayEkle({ e: w.f.olayId(), k: "f", g: "2026-11-24", ts: Date.now() });
  await w.f.statsSenkron();
  const { st } = await remote(c.tok);
  assert.equal(topla(st), 3); assert.equal(st.para.c, 1); assert.deepEqual(st.para.times, [9]); assert.equal(st.daily["2026-11-24"].fm, 25);
  assert.equal(w.S.pend.length, 0);
});

test("9) SINIR (belgelenmiş): koşulsuz (_b'siz) eski istemci yazması hâlâ son-yazan-kazanır — yalnızca önbellekteki ESKİ web sürümleri; yeni web ve mobil bu yolu kullanmaz", async () => {
  const c = await kullanici("web9@ornek.com");
  const o = await mobilCevapla(c, 3); await mobilIlerle(c, o);
  const eskiBelge = { _u: Date.now() + 5000, topic: { "mat|Sayılar": [1, 0, 0] } };     // eski web: yerel (eskimiş) belgeyi daha yeni zamanla yazar
  assert.equal((await hesapCagir(c.tok, "PUT", "veri/stats", eskiBelge)).status, 200);
  assert.equal(topla((await remote(c.tok)).st), 1, "eski istemci mobil ilerlemeyi ezebilir → yeni web sürümü yayınlanınca düzelir");
});
