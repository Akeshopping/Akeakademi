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
const kullanici = async e => { const g = await giris(e); T.premiumYap(g.kid); return { cookie: g.cookie, kid: g.kid, tok: decodeURIComponent(/^ake_s=([^;]*)/.exec(g.cookie)[1]) }; };
const remote = async tok => { const j = await (await hesapCagir(tok, "GET", "veri")).json(); return { st: j.alanlar.stats, u: (j.u || {}).stats }; };
const topla = st => Object.values((st && st.topic) || {}).reduce((a, t) => a + t[0] + t[1] + t[2], 0);

/* index.html'deki gerçek bloğu çıkar */
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bas = html.indexOf("/* STATS-SENKRON-BASLA"), bit = html.indexOf("/* STATS-SENKRON-BITIS */");
assert.ok(bas > 0 && bit > bas, "senkron bloğu index.html'de yok");
const BLOK = html.slice(bas, bit);

/* Bir "web cihazı": kendi S durumu, kendi ağ kesme/kayıp-yanıt anahtarları */
function webCihaz(c0, { S0, evMax, evidMax } = {}) {
  const h = { cevrimdisi: false, kayipYanit: 0, kayipOnce: 0, tok: c0.tok, kanca: null, toasts: [] };
  let blok = BLOK; if (evMax) blok = blok.replace("EV_MAX = 2000", "EV_MAX = " + evMax); if (evidMax) blok = blok.replace("EVID_MAX = 3000", "EVID_MAX = " + evidMax);
  const dayKey = () => "2026-11-24";
  const S = S0 || { upd: {}, ans: {}, topic: {}, daily: {}, para: { times: [], c: 0, w: 0 }, badges: {}, tr: {}, td: {}, pend: [], sb: 0 };
  const fetchFn = async (url, opt = {}) => {
    if (h.cevrimdisi) throw new TypeError("network");
    const yol = new URL(url, "https://akeakademi.com").pathname.replace("/api/hesap/", "");
    const put = (opt.method || "GET") === "PUT";
    if (put && h.kayipOnce > 0) { h.kayipOnce--; throw new TypeError("istek gitmedi"); }
    if (h.kanca) await h.kanca(put ? "PUT-oncesi" : "GET-oncesi");
    const r = await hesapCagir(h.tok, opt.method || "GET", yol, opt.body ? JSON.parse(opt.body) : undefined);
    if (h.kanca) await h.kanca(put ? "PUT-sonrasi" : "GET-sonrasi");
    if (put && h.kayipYanit > 0) { h.kayipYanit--; throw new TypeError("yanıt kayboldu"); }
    return r;
  };
  const ctx = {
    S, AREA: { stats: ["ans", "topic", "daily", "para", "badges", "tr", "td"] }, clone: o => JSON.parse(JSON.stringify(o)), uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7), dayKey,
    BYTES: s => new TextEncoder().encode(s).length, DOC_LIMIT: 230000, HESAP: { user: { id: c0.kid } }, fetch: fetchFn, normalize() { }, saveLocal() { },
    hesapIstek: async (path, opt) => { const r = await fetchFn("/api/hesap/" + path, opt); let j = {}; try { j = await r.json(); } catch (e) { } return { r, j }; },
    cloud: { state: "cloud" }, paintSave() { }, toast: m => h.toasts.push(m),
    TextEncoder, JSON, Math, Date, Set, Object, Array, Number, String
  };
  const f = vm.runInNewContext(blok + "\n({ olayEkle, statsOlay, olayId, statsSenkron, olayUygula, statsMaks, statsBirlestir, hesapKimlik })", ctx);
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
  const c = await kullanici("web1@ornek.com"), w = webCihaz(c);
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
  const c = await kullanici("web2@ornek.com"), w = webCihaz(c);
  kayit(w, "b1"); await w.f.statsSenkron();
  const o = await mobilCevapla(c, 4); await mobilIlerle(c, o);   // mobil yazdı; web sekmesi bunu bilmiyor
  kayit(w, "b2"); kayit(w, "b3");                                // eski sekmede devam
  await w.f.statsSenkron();
  const { st } = await remote(c.tok);
  assert.equal(topla(st), 1 + 4 + 2);
  assert.equal(topla(w.S), 7, "web de mobil ilerlemesini aldı");
});

test("3) PUT işlendi ama yanıt kayboldu: tekrar denemede ÇİFT SAYIM yok; istek hiç gitmediyse olay korunur", async () => {
  const c = await kullanici("web3@ornek.com"), w = webCihaz(c);
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
    const c = await kullanici(`web4-${d}@ornek.com`), w1 = webCihaz(c), w2 = webCihaz(c);
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
  const w = webCihaz(c, { S0: yerel });
  await w.f.statsSenkron();
  const { st } = await remote(c.tok);
  assert.ok(st.topic["mat|Eski"][0] === 4, "yalnız yerelde olan konu korunur");
  assert.ok(topla(st) >= 3 + 4, "hiçbir taraf geriye gitmedi"); assert.equal(st.badges.ilk, 7); assert.ok(st.daily["2026-11-23"].q === 5);
  assert.equal(w.S.sb, 1);
});

test("8) senkron sürerken gelen yeni cevap kaybolmaz; para ve odak olayları da taşınır", async () => {
  const c = await kullanici("web8@ornek.com"), w = webCihaz(c);
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

/* ===================== HESAP DEĞİŞİMİ YARIŞI ===================== */
const gec = (w, hesap) => { w.h.tok = hesap.tok; w.ctx.HESAP.user = { id: hesap.kid }; };
const bos = async tok => (await remote(tok)).st;

test("A1) GET ile PUT ARASINDA hesap değişir: A'nın olayları B'ye yazılmaz, B'nin verisiyle karışmaz; A geri dönünce kendi olayları yazılır", async () => {
  const A = await kullanici("hes-a1@ornek.com"), B = await kullanici("hes-b1@ornek.com"), w = webCihaz(A);
  kayit(w, "a1"); await w.f.statsSenkron();
  kayit(w, "a2"); kayit(w, "a3");
  w.h.kanca = async an => { if (an === "GET-sonrasi") { w.h.kanca = null; gec(w, B); } };       // GET döndü, kullanıcı çıkış yapıp B ile girdi
  await assert.rejects(w.f.statsSenkron(), e => e.code === "hesap_degisti");
  assert.equal(topla(await bos(A.tok)), 1, "A'ya yazılmadı");
  assert.equal(await bos(B.tok), undefined, "B'ye hiçbir şey yazılmadı");
  assert.equal(w.S.pend.length, 2, "A'nın bekleyen olayları kaybolmadı");
  kayit(w, "b1");                                                                                // artık B
  await w.f.statsSenkron();
  const b = await bos(B.tok);
  assert.equal(topla(b), 1, "B yalnız kendi cevabını gördü (A'nın sayaçları karışmadı)");
  assert.equal(topla(w.S), 1); assert.equal(w.S.hid, B.kid);
  assert.equal(w.S.pend.filter(e => e.h === A.kid).length, 2, "A'nın olayları hâlâ A'ya bağlı bekliyor");
  gec(w, A);
  await w.f.statsSenkron();
  assert.equal(topla(await bos(A.tok)), 3, "A geri dönünce olayları kendi hesabına yazıldı");
  assert.equal(topla(await bos(B.tok)), 1, "B etkilenmedi");
  assert.equal(w.S.pend.length, 0); assert.equal(topla(w.S), 3);
});

test("A2) PUT sürerken (sunucu yazdıktan sonra) hesap değişir: olaylar A için onaylanır ve silinir; B'ye hiçbir şey benimsenmez", async () => {
  const A = await kullanici("hes-a2@ornek.com"), B = await kullanici("hes-b2@ornek.com"), w = webCihaz(A);
  kayit(w, "a1"); await w.f.statsSenkron();
  kayit(w, "a2"); kayit(w, "a3");
  w.h.kanca = async an => { if (an === "PUT-sonrasi") { w.h.kanca = null; gec(w, B); } };
  await assert.rejects(w.f.statsSenkron(), e => e.code === "hesap_degisti");
  assert.equal(topla(await bos(A.tok)), 3, "A'ya yazma onaylandı");
  assert.equal(w.S.pend.length, 0, "onaylanan olaylar silindi (yeniden yazılmayacak)");
  assert.equal(await bos(B.tok), undefined);
  kayit(w, "b1"); await w.f.statsSenkron();
  assert.equal(topla(await bos(B.tok)), 1); assert.equal(topla(await bos(A.tok)), 3);
});

test("A3) tarayıcı oturumu (çerez) başka sekmede B'ye geçti ama bu sekmede HESAP hâlâ A: GET yanıtındaki hesap uyuşmaz → yazma yok", async () => {
  const A = await kullanici("hes-a3@ornek.com"), B = await kullanici("hes-b3@ornek.com"), w = webCihaz(A);
  kayit(w, "x1");
  w.h.tok = B.tok;                                                                                // çerez B, HESAP.user A
  await assert.rejects(w.f.statsSenkron(), e => e.code === "hesap_degisti");
  assert.equal(await bos(B.tok), undefined); assert.equal(await bos(A.tok), undefined); assert.equal(w.S.pend.length, 1);
});

test("A4) oturum, GET'ten sonra PUT'tan hemen ÖNCE B'ye geçer (HESAP bilmez): sunucu _h ile reddeder; B'ye yazılmaz, deneme işareti silinir", async () => {
  const A = await kullanici("hes-a4@ornek.com"), B = await kullanici("hes-b4@ornek.com"), w = webCihaz(A);
  await w.f.statsSenkron(); kayit(w, "x1");
  w.h.kanca = async an => { if (an === "PUT-oncesi") { w.h.kanca = null; w.h.tok = B.tok; } };
  await assert.rejects(w.f.statsSenkron(), e => e.code === "hesap_degisti");
  assert.equal(await bos(B.tok), undefined, "B'ye yazılmadı");
  assert.equal(w.S.pend.length, 1); assert.ok(w.S.pend.every(e => e.tg === undefined), "reddedilen denemede tg temizlenir (yazılmadığı kesin)");
  w.h.tok = A.tok; await w.f.statsSenkron();
  assert.equal(topla(await bos(A.tok)), 1);
});

test("A5) sunucu: GET hesap kimliğini döner; PUT _h uyuşmazsa 409 hesap; doğruysa yazar ve _h saklanmaz", async () => {
  const A = await kullanici("hes-a5@ornek.com");
  assert.equal((await (await hesapCagir(A.tok, "GET", "veri")).json()).hesap, A.kid);
  const yanlis = await hesapCagir(A.tok, "PUT", "veri/stats", { _b: 0, _h: "baska", topic: {} });
  assert.equal(yanlis.status, 409); assert.equal((await yanlis.json()).error, "hesap");
  assert.equal(await bos(A.tok), undefined, "yanlış hesaba yazılmadı");
  assert.equal((await hesapCagir(A.tok, "PUT", "veri/stats", { _b: 0, _h: A.kid, topic: { k: [1, 0, 0] } })).status, 200);
  assert.equal(Object.prototype.hasOwnProperty.call(await bos(A.tok), "_h"), false);
  assert.equal((await hesapCagir(A.tok, "PUT", "veri/plan", { _h: "baska", _u: 1, plan: { tasks: [] } })).status, 409, "koşulsuz yolda da _h doğrulanır");
});

/* ===================== OLAY SINIRI VE _ev YAŞLANMASI ===================== */
test("B1) bekleyen olay sınırı dolunca ESKİ OLAYLAR SİLİNMEZ: açık uyarı + sayaçlar korunur; bağlanınca hepsi hesapta", async () => {
  const c = await kullanici("sinir-b1@ornek.com"), w = webCihaz(c, { evMax: 5 });
  await w.f.statsSenkron();
  w.h.cevrimdisi = true;
  const ilk = []; for (let i = 0; i < 8; i++) kayit(w, "o" + i);
  assert.equal(w.S.pend.length, 5, "liste büyümedi, eski olaylar atılmadı");
  assert.equal(w.S.pend[0].i, "o0", "en eski olay yerinde");
  assert.equal(w.S.kayipRisk, 3, "yakalanamayan 3 cevap AÇIKÇA sayıldı");
  assert.equal(w.ctx.cloud.state, "dolu", "arayüz durumu: sınır doldu"); assert.ok(w.h.toasts.length >= 1, "kullanıcıya uyarı gösterildi");
  assert.equal(topla(w.S), 8, "yerel sayaçlar hepsini tutuyor");
  w.h.cevrimdisi = false;
  await w.f.statsSenkron();
  assert.equal(topla(await bos(c.tok)), 8, "8 cevabın hepsi hesapta (3'ü yerel sayaçlardan korundu)");
  assert.equal(w.S.kayipRisk, 0); assert.equal(w.S.pend.length, 0);
});

test("B2) sınır dolu iken mobil de yazmışsa: hiçbir sayaç iki taraftan büyüğünün altına düşmez (bilinen küçük sapma, sessiz silme yok)", async () => {
  const c = await kullanici("sinir-b2@ornek.com"), w = webCihaz(c, { evMax: 4 });
  await w.f.statsSenkron(); w.h.cevrimdisi = true;
  for (let i = 0; i < 7; i++) kayit(w, "m" + i);
  const o = await mobilCevapla(c, 3); await mobilIlerle(c, o);
  w.h.cevrimdisi = false; await w.f.statsSenkron();
  const t = topla(await bos(c.tok));
  assert.ok(t >= 7 && t <= 10, `toplam ${t}: en az web'in 7'si, en çok 7+3`);
});

test("B3) _ev sınırı aşıldıktan sonra YANIT KAYBI: eski olay tekrar sayılmaz (doğrulanamayan olay açıkça bildirilir); hiç denenmemiş eski olay ise yine yazılır", async () => {
  const c = await kullanici("yas-b3@ornek.com"), a = webCihaz(c, { evidMax: 6 }), b = webCihaz(c, { evidMax: 6 }), d = webCihaz(c, { evidMax: 6 });
  await a.f.statsSenkron(); await b.f.statsSenkron(); await d.f.statsSenkron();
  kayit(d, "never1"); kayit(d, "never2");                            // d çevrimdışı çözdü, HİÇ gönderme denemesi yok
  kayit(a, "p1"); kayit(a, "p2"); a.h.kayipYanit = 1;                // a'nın PUT'u sunucuda işlendi, yanıt kayboldu
  await assert.rejects(a.f.statsSenkron());
  assert.equal(topla(await bos(c.tok)), 2);
  for (let k = 0; k < 3; k++) { kayit(b, "q" + k + "a"); kayit(b, "q" + k + "b"); kayit(b, "q" + k + "c"); await b.f.statsSenkron(); } // başka cihaz çok olay yazar; a'nın partisi _ev'den atılır
  const r = (await remote(c.tok)).st; assert.ok(r._ed >= 1, "eski partiler atıldı (_ed)");
  assert.equal(topla(r), 2 + 9);
  await a.f.statsSenkron();
  assert.equal(topla((await remote(c.tok)).st), 2 + 9, "a'nın 2 olayı TEKRAR SAYILMADI");
  assert.equal(a.S.belirsiz, 2, "doğrulanamayan 2 olay açıkça sayıldı"); assert.ok(a.h.toasts.length >= 1); assert.equal(a.S.pend.length, 0);
  await d.f.statsSenkron();
  assert.equal(topla((await remote(c.tok)).st), 2 + 9 + 2, "hiç denenmemiş eski olaylar (never1/2) yazıldı: ne kayıp ne tekrar");
  assert.equal(d.S.belirsiz, undefined);
});

test("B4) sınır aşılmadıysa yanıt kaybı sonrası tekrar denemede belirsizlik YOK (tam doğru sayım)", async () => {
  const c = await kullanici("yas-b4@ornek.com"), a = webCihaz(c), b = webCihaz(c);
  await a.f.statsSenkron(); await b.f.statsSenkron();
  kayit(a, "p1"); kayit(a, "p2"); a.h.kayipYanit = 1; await assert.rejects(a.f.statsSenkron());
  for (let k = 0; k < 5; k++) { kayit(b, "q" + k); await b.f.statsSenkron(); }
  await a.f.statsSenkron();
  assert.equal(topla((await remote(c.tok)).st), 7); assert.equal(a.S.belirsiz, undefined);
});
