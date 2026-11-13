// B4 · soru bankası ve cevap anahtarı güvenliği: SUNUCU tarafı (gerçek handler'lar + yerel D1 kabuğu). Çalıştırma: node --test tests/soru-b4.test.mjs
// Sentetik sorular (gerçek banka metni yok). İstemci uyumu için ayrı dosya: tests/soru-b4-istemci.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { kur, tohumla, sizintiBul, yonetimIstek, SORU_ANAHTARLARI } from "./yardim/soru-v2.mjs";

const T = await kur();
const { DB, api, giris, yeniIstek } = T;
await T.hazirla();
const HIZ = readFileSync(resolve("migrations/0001_hiz_siniri.sql"), "utf8").split("\n").filter(l => !l.trim().startsWith("--")).join("\n").split(";").map(x => x.trim()).filter(Boolean);
for (const d of HIZ) DB.db.exec(d);
tohumla(DB, 400, { onek: "m", s: "mat", konular: ["Fonksiyonlar", "Limit"], zorluklar: [1, 2, 3] });
tohumla(DB, 60, { onek: "f", s: "fizik", konular: ["Kuvvet"], zorluklar: [2] });
tohumla(DB, 40, { onek: "t", s: "turkce", konular: ["Paragraf"], zorluklar: [1, 2] });
let e = 0, ipn = 0;
const yeni = async (paket) => { const k = await giris(`b4k${++e}@ornek.com`); if (paket) T.premiumYap(k.kid); k.ip = `203.0.113.${++ipn % 250}`; return k; };
const oturum = (k, g) => api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), ...g }, ek: { "cf-connecting-ip": k.ip } });
const kimlikler = j => j.sorular.map(q => q.id);

/* ---------- çok parçalı oturum (TYT/AYT deneme bölümleri) ---------- */
test("1) parcalar: tek oturum, parçalar sırayla, bölümler arası tekrar yok, cevap anahtarı sızmaz", async () => {
  const k = await yeni(true);
  const r = await oturum(k, { mod: "exam", parcalar: [{ ders: "turkce", adet: 10 }, { ders: "mat", adet: 12, konu: "Limit" }, { ders: "fizik", adet: 7, zorluk: [2] }] });
  assert.equal(r.s, 200); assert.deepEqual(r.j.parcalar, [10, 12, 7]); assert.equal(r.j.sorular.length, 29); assert.equal(r.j.adet, 29);
  assert.deepEqual(r.j.sorular.slice(0, 10).map(q => q.s), Array(10).fill("turkce")); assert.ok(r.j.sorular.slice(10, 22).every(q => q.s === "mat" && q.t === "Limit")); assert.ok(r.j.sorular.slice(22).every(q => q.s === "fizik"));
  assert.equal(new Set(kimlikler(r.j)).size, 29);
  assert.deepEqual(sizintiBul(r.j), []); for (const q of r.j.sorular) assert.ok(Object.keys(q).every(a => SORU_ANAHTARLARI.has(a))); assert.ok(!r.t.includes("COZUM-"));
});
test("2) parcalar: aynı ders iki bölümde → çakışmadan farklı sorular; tekrar istek (idempotent) aynı oturum + aynı bölüm sayıları", async () => {
  const k = await yeni(true), istek = yeniIstek(), g = { istek, mod: "exam", parcalar: [{ ders: "mat", adet: 15 }, { ders: "mat", adet: 15 }] };
  const a = await api("oturum", { cookie: k.cookie, govde: g, ek: { "cf-connecting-ip": k.ip } }), b = await api("oturum", { cookie: k.cookie, govde: g, ek: { "cf-connecting-ip": k.ip } });
  assert.equal(a.s, 200); assert.equal(new Set(kimlikler(a.j)).size, 30); assert.equal(b.j.oturum, a.j.oturum); assert.deepEqual(b.j.parcalar, [15, 15]); assert.deepEqual(kimlikler(b.j), kimlikler(a.j));
});
test("3) parcalar: ücretsiz kullanıcıda deneme kotası TEK düşer; kota bitince 402", async () => {
  const k = await yeni(false), onceki = await T.hesapKota(k.cookie, "deneme", 0);
  const r = await oturum(k, { mod: "exam", parcalar: [{ ders: "mat", adet: 20 }, { ders: "fizik", adet: 20 }] });
  assert.equal(r.s, 200); assert.equal(r.j.kota.kalan, (r.j.kota.limit || 1) - 1);
  const ikinci = await oturum(k, { mod: "exam", parcalar: [{ ders: "mat", adet: 5 }] });
  assert.equal(ikinci.s, 402);
});
test("4) parcalar: ücretsiz pratikte kota parçalar toplamı kadar düşer ve parçalar sırayla kısılır", async () => {
  const k = await yeni(false);
  const r = await oturum(k, { mod: "practice", parcalar: [{ ders: "mat", adet: 15 }, { ders: "fizik", adet: 15 }] });
  assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 20); assert.deepEqual(r.j.parcalar, [15, 5]);
  assert.equal((await oturum(k, { mod: "practice", adet: 1, ders: "mat" })).s, 402);
});
test("5) parcalar doğrulaması: adet/ders birlikte, >12 parça, toplam > sınır, bilinmeyen alan, boş dizi → 400", async () => {
  const k = await yeni(true), dene = async g => (await oturum(k, g)).s;
  assert.equal(await dene({ mod: "exam", adet: 5, parcalar: [{ ders: "mat", adet: 5 }] }), 400);
  assert.equal(await dene({ mod: "exam", ders: "mat", parcalar: [{ adet: 5 }] }), 400);
  assert.equal(await dene({ mod: "exam", parcalar: [] }), 400);
  assert.equal(await dene({ mod: "exam", parcalar: Array(13).fill({ ders: "mat", adet: 1 }) }), 400);
  assert.equal(await dene({ mod: "exam", parcalar: [{ ders: "mat", adet: 100 }, { ders: "fizik", adet: 30 }] }), 400);
  assert.equal(await dene({ mod: "practice", parcalar: [{ ders: "mat", adet: 40 }, { ders: "fizik", adet: 20 }] }), 400);
  assert.equal(await dene({ mod: "exam", parcalar: [{ ders: "mat", adet: 5, idler: ["m-1"] }] }), 400);
  assert.equal(await dene({ mod: "exam", parcalar: [{ ders: "yok", adet: 5 }] }), 400);
  assert.equal(await dene({ mod: "exam", parcalar: [{ ders: "mat", adet: 0 }] }), 400);
  assert.equal(await dene({ mod: "exam", parcalar: "mat" }), 400);
});

/* ---------- önce görmediğin sorular ---------- */
test("6) tekrar önleme: ardışık oturumlar önce görülmemiş soruları verir; havuz bitince görülmüşlere döner", async () => {
  const k = await yeni(true), filtre = { mod: "practice", adet: 10, ders: "turkce" };   // 40 soruluk havuz
  const ids = [];
  for (let i = 0; i < 4; i++) { const r = await oturum(k, filtre); assert.equal(r.s, 200); ids.push(kimlikler(r.j)); }
  assert.equal(new Set(ids.flat()).size, 40, "ilk 4 oturum havuzu çakışmadan tüketir");
  const bes = await oturum(k, filtre); assert.equal(bes.s, 200); assert.equal(bes.j.sorular.length, 10, "havuz bitince görülmüşlerden doldurur");
  const diger = await yeni(true), d1 = await oturum(diger, filtre); assert.equal(d1.s, 200, "başka kullanıcının geçmişi etkilemez");
});

/* ---------- oturum oluşturma hız sınırı ---------- */
test("7) oturum oluşturma hız sınırı: kullanıcı başına saatte 60; Retry-After var; başka kullanıcı etkilenmez", async () => {
  const k = await yeni(true), diger = await yeni(true);
  let ilk429 = 0;
  for (let i = 1; i <= 62; i++) { const r = await oturum(k, { mod: "practice", adet: 1, ders: "mat" }); if (r.s === 429) { ilk429 = i; assert.ok(Number(r.h.get("retry-after")) >= 1); assert.equal(r.j.error, "cok_istek"); break; } assert.equal(r.s, 200); }
  assert.equal(ilk429, 61);
  assert.equal((await oturum(diger, { mod: "practice", adet: 1, ders: "mat" })).s, 200);
});

/* ---------- sınav: cevap anahtarı yalnız bitince, puan sunucuda ---------- */
test("8) sınav: bitirmeden anahtar yok; toplu cevapla bitirince puan SUNUCUDA hesaplanır, sızıntı yok", async () => {
  const k = await yeni(true), r = await oturum(k, { mod: "exam", adet: 6, ders: "mat" }), ids = kimlikler(r.j);
  const anahtar = Object.fromEntries(DB.db.prepare("SELECT id, a FROM soru WHERE id IN (" + ids.map(() => "?").join(",") + ")").all(...ids).map(x => [x.id, x.a]));
  const c1 = await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: ids[0], secim: anahtar[ids[0]] } });
  assert.deepEqual(c1.j, { kaydedildi: true }); assert.ok(!c1.t.includes("COZUM-"));
  const cevaplar = ids.map((id, i) => ({ soru: id, secim: i < 4 ? anahtar[id] : i === 4 ? (anahtar[id] + 1) % 5 : null }));   // 4 doğru, 1 yanlış, 1 boş
  const b = await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum, cevaplar } });
  assert.equal(b.s, 200); assert.equal(b.j.dogru, 4); assert.equal(b.j.yanlis, 1); assert.equal(b.j.bos, 1);
  assert.ok(b.j.sorular.every(q => q.a !== undefined && String(q.x).startsWith("COZUM-")), "bitince tüm sorular için anahtar + çözüm");
  const tekrar = await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum, cevaplar: ids.map(id => ({ soru: id, secim: anahtar[id] })) } });
  assert.equal(tekrar.j.dogru, 4, "bitmiş oturuma gelen cevaplar yok sayılır (idempotent)");
  assert.equal((await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: ids[0], secim: 0 } })).s, 409, "bitti: cevap değiştirilemez");
});
test("9) sahte puan: istemci doğru/puan/anahtar alanı gönderemez (400); oturumda olmayan soru cevabı yok sayılır; yinelenen soru 400", async () => {
  const k = await yeni(true), r = await oturum(k, { mod: "exam", adet: 4, ders: "mat" }), ids = kimlikler(r.j);
  for (const ek of [{ dogru: 4 }, { puan: 100 }, { net: 4 }, { a: [0, 0, 0, 0] }, { sonuc: {} }]) assert.equal((await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum, ...ek } })).s, 400, JSON.stringify(ek));
  for (const c of [[{ soru: ids[0], secim: 0, dogru: true }], [{ soru: ids[0], secim: 9 }], [{ soru: ids[0], secim: "1" }], [{ soru: ids[0], secim: 1 }, { soru: ids[0], secim: 2 }], "x", Array(201).fill({ soru: "a", secim: 1 })])
    assert.equal((await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum, cevaplar: c } })).s, 400, JSON.stringify(c).slice(0, 60));
  const baska = "m-399" === ids[0] ? "m-398" : "m-399";
  const b = await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum, cevaplar: [{ soru: baska, secim: 1 }] } });
  assert.equal(b.s, 200); assert.equal(b.j.bos, 4, "oturumda olmayan soruya cevap yazılamaz");
});
test("10) toplu cevap yalnız sınavda; pratikte 400; süresi dolan oturum 410 ve cevap yazılmaz", async () => {
  const k = await yeni(true), p = await oturum(k, { mod: "practice", adet: 2, ders: "mat" });
  assert.equal((await api("bitir", { cookie: k.cookie, govde: { oturum: p.j.oturum, cevaplar: [] } })).s, 400);
  const s = await oturum(k, { mod: "exam", adet: 3, ders: "mat" }), ids = kimlikler(s.j);
  DB.db.prepare("UPDATE soru_oturum SET sona_erme = ? WHERE id = ?").run(Date.now() - 5, s.j.oturum);
  assert.equal((await api("bitir", { cookie: k.cookie, govde: { oturum: s.j.oturum, cevaplar: ids.map(id => ({ soru: id, secim: 1 })) } })).s, 410);
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum_soru WHERE oturum = ? AND secim IS NOT NULL").get(s.j.oturum).n, 0);
});
test("11) başka kullanıcı: oturumu ne cevaplayabilir ne bitirebilir (404); anahtar sızmaz", async () => {
  const a = await yeni(true), b = await yeni(true), r = await oturum(a, { mod: "exam", adet: 3, ders: "mat" }), ids = kimlikler(r.j);
  const x = await api("bitir", { cookie: b.cookie, govde: { oturum: r.j.oturum, cevaplar: ids.map(id => ({ soru: id, secim: 0 })) } });
  assert.equal(x.s, 404); assert.ok(!x.t.includes("COZUM-"));
  assert.equal((await api("cevap", { cookie: b.cookie, govde: { oturum: r.j.oturum, soru: ids[0], secim: 0 } })).s, 404);
  assert.equal(DB.db.prepare("SELECT durum FROM soru_oturum WHERE id = ?").get(r.j.oturum).durum, "acik");
});
test("12) çalışma modu: cevaptan SONRA doğru şık ve açıklama gelir; önce gelmez; kilitlenir", async () => {
  const k = await yeni(true), r = await oturum(k, { mod: "practice", adet: 3, ders: "fizik" }), id = r.j.sorular[0].id;
  assert.ok(!r.t.includes("COZUM-")); assert.deepEqual(sizintiBul(r.j), []);
  const a = DB.db.prepare("SELECT a FROM soru WHERE id = ?").get(id).a, c = await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: id, secim: (a + 1) % 5 } });
  assert.equal(c.s, 200); assert.equal(c.j.dogru, false); assert.equal(c.j.a, a); assert.equal(c.j.x, "COZUM-" + id);
  assert.equal((await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: id, secim: a } })).s, 409);
});
test("13) anonim: toplu anahtar yolları yok — oturum/cevap/bitir/ozet 401; tahmin edilen yollar 404", async () => {
  for (const [y, m, g] of [["oturum", "POST", {}], ["cevap", "POST", {}], ["bitir", "POST", {}], ["ozet", "GET"]]) assert.equal((await api(y, { m, govde: g })).s, 401, y);
  for (const y of ["anahtar", "liste", "hepsi", "sorular", "export", "bank", "oturum/hepsi"]) { const r = await api(y, { m: "GET" }); assert.equal(r.s, 404, y); assert.ok(!r.t.includes("COZUM-")); }
});

/* ---------- eski herkese açık yolların kapatılması (Aşama 3 anahtarı) ---------- */
const sorularMod = await import(pathToFileURL(resolve("functions/api/sorular.js")).href);
const statikMod = await import(pathToFileURL(resolve("functions/sorular/[[yol]].js")).href);
const kokUrl = "https://akeakademi.com";
async function eskiApi(ekEnv) { const r = await sorularMod.onRequest({ request: new Request(kokUrl + "/api/sorular"), env: { ...T.env, ...ekEnv } }); return { s: r.status, j: await r.json(), cc: r.headers.get("cache-control") }; }
test("14) /api/sorular: kapatma anahtarı + V2 birlikte → boş liste (no-store); tek başına etkisiz; kapalıyken bugünkü davranış", async () => {
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES ('ok-eski1','mat','K',2,?,'onayli',1,1)").run(JSON.stringify({ id: "ok-eski1", s: "mat", t: "K", d: 2, q: "Eski soru", o: ["a", "b", "c", "d", "e"], a: 3, x: "ESKI-COZUM" }));
  const kapali = await eskiApi({ AKE_SORU_ESKI_KAPAT: "1" }); assert.deepEqual(kapali.j.sorular, []); assert.equal(kapali.j.kapali, true); assert.equal(kapali.cc, "no-store");
  const yalnizAnahtar = await eskiApi({ AKE_SORU_V2: undefined, AKE_SORU_ESKI_KAPAT: "1" }); assert.equal(yalnizAnahtar.j.sorular.length, 1, "V2 kapalıyken anahtar tek başına soru kaybettirmez");
  const acik = await eskiApi({}); assert.equal(acik.j.sorular.length, 1); assert.equal(acik.cc, "public, max-age=300");
  for (const v of ["0", "true", "", " "]) assert.equal((await eskiApi({ AKE_SORU_ESKI_KAPAT: v })).j.sorular.length, 1, "yalnız '1' kapatır: " + JSON.stringify(v));
});
test("15) /sorular/* statik dosyalar: kapatma anahtarı + V2 → 404 ve varlığa HİÇ gidilmez; kapalıyken aynen iletilir", async () => {
  let cagri = 0; const ASSETS = { fetch: async r => { cagri++; return new Response("[]", { status: 200 }); } };
  const iste = (env, yol = "/sorular/ake-yks-02-200.json") => statikMod.onRequest({ request: new Request(kokUrl + yol), env: { ASSETS, ...env } });
  for (const yol of ["/sorular/liste.json", "/sorular/ake-yks-02-200.json", "/sorular/pilot-100.json", "/sorular/r01.json", "/sorular/", "/sorular"]) { const r = await iste({ AKE_SORU_V2: "1", AKE_SORU_ESKI_KAPAT: "1" }, yol); assert.equal(r.status, 404, yol); assert.equal(r.headers.get("cache-control"), "no-store"); }
  assert.equal(cagri, 0);
  assert.equal((await iste({})).status, 200); assert.equal((await iste({ AKE_SORU_ESKI_KAPAT: "1" })).status, 200, "V2 kapalıyken statik dosyalar bugünkü gibi yayında"); assert.equal(cagri, 2);
});
test("16) sw.js: /sorular/ yolları hiçbir zaman önbelleğe alınmaz (ağ-önce kaydı yok)", () => {
  const sw = readFileSync(resolve("sw.js"), "utf8"); assert.ok(/pathname\.startsWith\("\/sorular\/"\)\) return;/.test(sw));
});

/* ---------- yeni soru yükleme akışı (yönetici toplu yükleme) ---------- */
const sorularYeni = n => Array.from({ length: n }, (_, i) => ({ id: `ake-yuk-${i + 1}`, s: "mat", t: "Yükleme konusu", d: 2, q: `YUKLEME-SORU-${i + 1}`, o: [0, 1, 2, 3, 4].map(k => `YUK-SIK-${i + 1}-${k}`), a: i % 5, x: `YUKLEME-COZUM-${i + 1}` }));
test("17) soru-ice-aktar: yönetici olmayan 403; V2 kapalıyken 409; kilitliyken 503", async () => {
  const ogr = await yeni(false), yon = await giris("alikaaneren13@gmail.com");
  assert.equal((await yonetimIstek(T, "soru-ice-aktar", { cookie: ogr.cookie, govde: { sorular: sorularYeni(1) } })).s, 403);
  assert.equal((await yonetimIstek(T, "soru-ice-aktar", { govde: { sorular: sorularYeni(1) } })).s, 403);
  /* handler'ların şema önbelleği modül düzeyindedir: aynı DB üzerinde yalnız ortam değişkenleri değiştirilir */
  const varyant = ek => ({ ...T, env: { ...T.env, ...ek } });
  assert.equal((await yonetimIstek(varyant({ AKE_SORU_V2: undefined }), "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: sorularYeni(1) } })).s, 409);
  assert.equal((await yonetimIstek(varyant({ AKE_SORU_MIGRATION_LOCK: "1" }), "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: sorularYeni(1) } })).s, 503);
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE id LIKE 'ake-yuk-%'").get().n, 0, "reddedilen isteklerde yazma yok");
  assert.ok(yon.cookie);
});
test("18) soru-ice-aktar: geçerli sorular banka durumunda kanonik yazılır; tekrar yükleme yazmaz; çatışma/geçersiz raporlanır", async () => {
  const yon = await giris("alikaaneren13@gmail.com"), liste = sorularYeni(8);
  const r = await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: liste } });
  assert.equal(r.s, 200); assert.equal(r.j.yazildi, 8);
  const satir = DB.db.prepare("SELECT durum, kaynak, rk, h, govde, a, x, json FROM soru WHERE id = 'ake-yuk-3'").get();
  assert.equal(satir.durum, "banka"); assert.equal(satir.kaynak, "statik"); assert.ok(satir.h && satir.govde && satir.rk != null && satir.a === 2 && satir.x === "YUKLEME-COZUM-3");
  assert.ok(!JSON.parse(satir.govde).a, "gövde cevap içermez");
  const tekrar = await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: liste } });
  assert.equal(tekrar.j.yazildi, 0); assert.equal(tekrar.j.var, 8); assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE id LIKE 'ake-yuk-%'").get().n, 8);
  const karisik = await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: [{ ...liste[0], id: "ake-yuk-cat", a: (liste[0].a + 1) % 5 }, { ...liste[1], id: "ake-yuk-bos", o: ["a", "a", "a", "a", "a"] }, { id: "x y", s: "mat" }, { ...liste[2], id: "ake-yuk-kopya" }] } });
  assert.equal(karisik.s, 200); assert.equal(karisik.j.catisma, 1); assert.equal(karisik.j.gecersiz, 2); assert.equal(karisik.j.kopya, 1); assert.equal(DB.db.prepare("SELECT kopya_of FROM soru WHERE id = 'ake-yuk-kopya'").get().kopya_of, "ake-yuk-3", "tam kopya kanonik soruya bağlanır, havuza girmez");
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE id = 'ake-yuk-cat'").get().n, 0, "çatışan soru yazılmaz");
  for (const g of [{}, { sorular: [] }, { sorular: "x" }, { sorular: Array(101).fill(liste[0]) }]) assert.equal((await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: g })).s, 400);
});
test("19) yüklenen yeni soru güvenli sisteme OTOMATİK girer: oturumla cevapsız servis edilir, eski herkese açık uçta görünmez", async () => {
  const yon = await giris("alikaaneren13@gmail.com"), liste = sorularYeni(5).map(q => ({ ...q, id: q.id.replace("yuk", "oto"), s: "turkce", t: "Yüklenen konu", q: q.q.replace("YUKLEME", "OTO"), o: q.o.map(x => x.replace("YUK", "OTO")), x: q.x.replace("YUKLEME", "OTOCOZUM") }));
  assert.equal((await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: liste } })).j.yazildi, 5);
  const k = await yeni(true), r = await oturum(k, { mod: "practice", adet: 5, ders: "turkce", konu: "Yüklenen konu" });
  assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 5); assert.ok(r.j.sorular.every(q => q.id.startsWith("ake-oto-")));
  assert.ok(!r.t.includes("OTOCOZUM") && !r.t.includes('"a"')); assert.deepEqual(sizintiBul(r.j), []);
  const eski = await eskiApi({}); assert.ok(!JSON.stringify(eski.j).includes("OTOCOZUM"), "banka durumundaki soru eski uçta yok");
  const c = await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: r.j.sorular[0].id, secim: 0 } }); assert.ok(String(c.j.x).startsWith("OTOCOZUM"));
});

/* ---------- katalog (cevapsız) + kimlikle oturum ---------- */
test("20) katalog: anonim 401; girişli kullanıcıya yalnız cevapsız alanlar; uygun olmayan satırlar yok; private, no-store", async () => {
  assert.equal((await api("katalog", { m: "GET" })).s, 401);
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, govde, a, x, kaynak, rk, h) VALUES ('kat-bekliyor','mat','K',1,NULL,'bekliyor',0,0,?,1,'GIZLI-BEKLEYEN-COZUM','ai',5,'hk1')").run(JSON.stringify({ q: "Bekleyen", o: ["a", "b", "c", "d", "e"] }));
  const k = await yeni(false), r = await api("katalog", { m: "GET", cookie: k.cookie });
  assert.equal(r.s, 200); assert.ok(r.j.n === 200 && r.j.sorular.length === r.j.n && typeof r.j.sonraki === "string", "varsayılan sayfa 200, tüm katalog tek seferde gelmez"); assert.equal(r.h.get("cache-control"), "private, no-store");
  assert.deepEqual(sizintiBul(r.j), []); for (const q of r.j.sorular.slice(0, 50)) assert.ok(Object.keys(q).every(a => SORU_ANAHTARLARI.has(a)));
  assert.ok(!r.t.includes("COZUM-") && !r.t.includes("GIZLI-BEKLEYEN") && !r.j.sorular.some(q => q.id === "kat-bekliyor"));
  assert.ok(!r.j.sorular.some(q => DB.db.prepare("SELECT kopya_of FROM soru WHERE id = ?").get(q.id).kopya_of), "kopya satırlar katalogda yok");
});
test("21) katalog: hız sınırı saatte 30; başka kullanıcı etkilenmez", async () => {
  const k = await yeni(false), diger = await yeni(false);
  let ilk429 = 0; for (let i = 1; i <= 32; i++) { const r = await api("katalog", { m: "GET", cookie: k.cookie, ek: { "cf-connecting-ip": k.ip } }); if (r.s === 429) { ilk429 = i; assert.ok(Number(r.h.get("retry-after")) >= 1); break; } }
  assert.equal(ilk429, 31); assert.equal((await api("katalog", { m: "GET", cookie: diger.cookie, ek: { "cf-connecting-ip": diger.ip } })).s, 200);
});
test("22) idler: katalogdan seçilen kimlikler SIRAYLA servis edilir; anahtar yok; geçersiz/uygunsuz kimlikler düşer", async () => {
  const k = await yeni(true), istenen = ["f-7", "m-3", "t-11", "yok-boyle", "kat-bekliyor", "m-1"];
  const r = await oturum(k, { mod: "practice", idler: istenen });
  assert.equal(r.s, 200); assert.deepEqual(kimlikler(r.j), ["f-7", "m-3", "t-11", "m-1"]); assert.equal(r.j.adet, 4);
  assert.deepEqual(sizintiBul(r.j), []); assert.ok(!r.t.includes("COZUM-"));
  const kopyaId = DB.db.prepare("SELECT id FROM soru WHERE kopya_of IS NULL LIMIT 1").get().id; DB.db.prepare("UPDATE soru SET kopya_of = ? WHERE id = 'm-9'").run(kopyaId);
  const r2 = await oturum(k, { mod: "practice", idler: ["m-9", "m-10"] }); assert.deepEqual(kimlikler(r2.j), ["m-10"]);
  DB.db.prepare("UPDATE soru SET kopya_of = NULL WHERE id = 'm-9'").run();
  const c = await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: "m-3", secim: 0 } }); assert.equal(c.j.x, "COZUM-m-3");
  assert.equal((await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: "m-1", secim: 0 } })).j.x, "COZUM-m-1");
  assert.equal((await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: "m-20", secim: 0 } })).s, 404, "oturumda olmayan soru");
});
test("23) idler kotası: ücretsiz pratikte kalan hakka kısılır (sırayla), sınavda tek deneme hakkı; doğrulama hataları 400", async () => {
  const k = await yeni(false), ids = Array.from({ length: 30 }, (_, i) => `m-${100 + i}`);
  const r = await oturum(k, { mod: "practice", idler: ids }); assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 20); assert.deepEqual(kimlikler(r.j), ids.slice(0, 20));
  assert.equal((await oturum(k, { mod: "practice", idler: ["m-200"] })).s, 402);
  const e1 = await yeni(false), s1 = await oturum(e1, { mod: "exam", idler: ids }); assert.equal(s1.s, 200); assert.equal(s1.j.kota.kalan, (s1.j.kota.limit || 1) - 1);
  const dene = async g => (await oturum(await yeni(true), g)).s;
  assert.equal(await dene({ mod: "practice", idler: [] }), 400); assert.equal(await dene({ mod: "practice", idler: ["a", "a"] }), 400);
  assert.equal(await dene({ mod: "practice", idler: Array.from({ length: 51 }, (_, i) => "m-" + i) }), 400); assert.equal(await dene({ mod: "practice", idler: [1, 2] }), 400);
  assert.equal(await dene({ mod: "practice", idler: ["m-1"], ders: "mat" }), 400); assert.equal(await dene({ mod: "practice", idler: ["m-1"], adet: 1 }), 400);
  assert.equal(await dene({ mod: "practice", idler: ["m-1"], parcalar: [{ adet: 1 }] }), 400); assert.equal(await dene({ mod: "exam", idler: "m-1" }), 400);
});
test("24) idler + sınav: cevap anahtarı bitirmeden alınamaz; toplu cevapla puan sunucuda", async () => {
  const k = await yeni(true), ids = Array.from({ length: 8 }, (_, i) => `m-${300 + i}`), r = await oturum(k, { mod: "exam", idler: ids });
  assert.equal(r.s, 200); assert.ok(!r.t.includes("COZUM-"));
  const anahtar = Object.fromEntries(DB.db.prepare("SELECT id, a FROM soru WHERE id IN (" + ids.map(() => "?").join(",") + ")").all(...ids).map(x => [x.id, x.a]));
  const b = await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum, cevaplar: ids.map((id, i) => ({ soru: id, secim: i < 5 ? anahtar[id] : (anahtar[id] + 2) % 5 })) } });
  assert.equal(b.j.dogru, 5); assert.equal(b.j.yanlis, 3); assert.equal(b.j.bos, 0);
});

/* ---------- katalog sayfalama (tek seferde 20.000 gövde yok) ---------- */
const UYGUNSQL = "durum IN ('banka','onayli') AND kopya_of IS NULL AND govde IS NOT NULL AND a IS NOT NULL AND x IS NOT NULL";
test("25) katalog sayfalama: kararlı sıra, tekrar/eksik yok, sayfa üst sınırı, hiçbir sayfada a/x/json yok", async () => {
  const k = await yeni(false), ek = { "cf-connecting-ip": k.ip }, hepsi = []; let sonra = null, sayfa = 0, metin = "";
  do {
    const r = await api("katalog?limit=150" + (sonra ? "&sonra=" + encodeURIComponent(sonra) : ""), { m: "GET", cookie: k.cookie, ek }); assert.equal(r.s, 200, r.t);
    assert.ok(r.j.sorular.length <= 150 && r.j.n === r.j.sorular.length); assert.deepEqual(sizintiBul(r.j), []); metin += r.t;
    for (const q of r.j.sorular) { assert.ok(Object.keys(q).every(a => SORU_ANAHTARLARI.has(a))); hepsi.push(q.id); }
    sonra = r.j.sonraki; sayfa++; assert.ok(sayfa < 20);
  } while (sonra);
  const beklenen = DB.db.prepare(`SELECT id FROM soru WHERE ${UYGUNSQL} ORDER BY id`).all().map(x => x.id);
  assert.deepEqual(hepsi, beklenen, "sayfalar birleşince tüm uygun soru, id sırasıyla, tekrarsız"); assert.ok(sayfa >= 3);
  assert.ok(!/COZUM-|"json"|"govde"|"kopya_of"|"kaynak"/.test(metin), "hiçbir sayfada çözüm/legacy json/kanonik alan yok");
});
test("26) katalog sayfalama: sayfalar arasında kayıt eklenirse kaymaz (anahtar-kümesi imleci); sınır doğrulamaları; anonim 401", async () => {
  const k = await yeni(false), ek = { "cf-connecting-ip": k.ip }, g = (q) => api("katalog" + q, { m: "GET", cookie: k.cookie, ek });
  const ilk = await g("?limit=100"); const imlec = ilk.j.sonraki;
  const ins = DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, govde, a, x, kaynak, rk, h) VALUES (?, 'mat', 'K', 1, NULL, 'banka', 0, 0, ?, 0, 'C', 'statik', 1, ?)");
  const govde = JSON.stringify({ q: "Eklenen", o: ["a", "b", "c", "d", "e"] }); ins.run("0-onceki", govde, "h-onceki"); ins.run("zz-sonraki", govde, "h-sonraki");
  const tum = []; let s = imlec; while (s) { const r = await g("?limit=300&sonra=" + encodeURIComponent(s)); assert.equal(r.s, 200); tum.push(...r.j.sorular.map(q => q.id)); s = r.j.sonraki; }
  assert.ok(tum.includes("zz-sonraki") && !tum.includes("0-onceki") && new Set(tum).size === tum.length && tum.every(id => id > imlec), "ileri sayfalarda tekrar yok, öncekine eklenen kayma yaratmaz");
  DB.db.prepare("DELETE FROM soru WHERE id IN ('0-onceki','zz-sonraki')").run();
  for (const q of ["?limit=0", "?limit=1001", "?limit=abc", "?limit=-1", "?limit=1.5", "?limit=", "?sonra=", "?sonra=" + "x".repeat(101), "?foo=1", "?limit=5&offset=3"]) assert.equal((await g(q)).s, 400, q);
  const max = await g("?limit=1000"); assert.equal(max.s, 200); assert.ok(max.j.sorular.length <= 1000);
  const son = await g("?sonra=" + encodeURIComponent("zzzzzz")); assert.equal(son.s, 200); assert.equal(son.j.n, 0); assert.equal(son.j.sonraki, null);
  assert.equal((await api("katalog?limit=5", { m: "GET" })).s, 401);
});
test("27) katalog sayfalama: her sayfa isteği hız sınırına sayılır (saatte 30)", async () => {
  const k = await yeni(false), ek = { "cf-connecting-ip": k.ip }; let s429 = 0;
  for (let i = 1; i <= 32; i++) { const r = await api("katalog?limit=1", { m: "GET", cookie: k.cookie, ek }); if (r.s === 429) { s429 = i; assert.ok(!r.t.includes("sorular")); break; } }
  assert.equal(s429, 31);
});

/* ---------- soru-ice-aktar: mevcut kimlikte içerik bütünlüğü ---------- */
test("28) soru-ice-aktar: aynı kimlik + aynı içerik idempotent; farklı içerik/cevap/çözüm GERÇEK ÇATIŞMA; mevcut kayıt değişmez", async () => {
  const yon = await giris("alikaaneren13@gmail.com"), liste = sorularYeni(3).map((q, i) => ({ ...q, id: "bt-ayni-" + i, q: q.q + " BT28-" + i, x: "BT28-COZUM-" + i }));
  assert.equal((await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: liste } })).j.yazildi, 3);
  const once = DB.db.prepare("SELECT * FROM soru WHERE id LIKE 'bt-ayni-%' ORDER BY id").all();
  const tekrar = await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: liste } });
  assert.equal(tekrar.j.var, 3); assert.equal(tekrar.j.kimlikCatismasi, 0); assert.equal(tekrar.j.yazildi, 0); assert.deepEqual(tekrar.j.sorunlu, []);
  const degisik = [
    { ...liste[0], a: (liste[0].a + 1) % 5 },                                  // farklı cevap anahtarı
    { ...liste[1], x: "BASKA-COZUM" },                                          // farklı çözüm
    { ...liste[2], q: liste[2].q + " (değişmiş)" },                             // farklı soru metni
    { ...liste[0], id: "bt-ayni-1", t: liste[1].t + "-baska" },                 // farklı konu
  ];
  const r = await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: degisik } });
  assert.equal(r.s, 200); assert.equal(r.j.kimlikCatismasi, 4); assert.equal(r.j.var, 0); assert.equal(r.j.yazildi, 0);
  assert.deepEqual(r.j.sorunlu.map(x => x.neden), Array(4).fill("kimlik_farkli_icerik"));
  assert.ok(r.j.sorunlu[0].farkli.includes("a") && r.j.sorunlu[1].farkli.includes("x") && r.j.sorunlu[2].farkli.includes("govde"), JSON.stringify(r.j.sorunlu));
  assert.ok(!r.t.includes("BASKA-COZUM") && !r.t.includes("BT28-COZUM"), "yanıt cevap/çözüm değeri içermez");
  assert.deepEqual(DB.db.prepare("SELECT * FROM soru WHERE id LIKE 'bt-ayni-%' ORDER BY id").all(), once, "mevcut kayıtlar bayt bayt aynı: sessizce değişmedi, silinmedi");
});
test("29) soru-ice-aktar: mevcut kayıtta kanonik alan yoksa (eski satır) 'aynı' sayılmaz; sayım ve soru havuzu korunur", async () => {
  const yon = await giris("alikaaneren13@gmail.com"), q = { ...sorularYeni(1)[0], id: "bt-eski-1", q: "BT29 eski satır metni" };
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES ('bt-eski-1', ?, ?, ?, ?, 'onayli', 0, 0)").run(q.s, q.t, q.d, JSON.stringify(q));
  const toplam = DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n;
  const r = await yonetimIstek(T, "soru-ice-aktar", { cookie: yon.cookie, govde: { sorular: [q] } });
  assert.equal(r.j.kimlikCatismasi, 1); assert.deepEqual(r.j.sorunlu[0].farkli, ["mevcut_kanonik_yok"]);
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n, toplam); assert.equal(DB.db.prepare("SELECT govde FROM soru WHERE id = 'bt-eski-1'").get().govde, null);
});
