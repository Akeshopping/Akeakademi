// Bölümlü (çok dersli) deneme: sunucu sözleşmesi · GERÇEK sunucu koduyla (node:sqlite)
//   POST /oturum {mod:"exam", adet, bolumler:[{bolum, ders, adet}], tur?, uzunluk?}: ders başına seçim, bölüm sırası korunur.
//   Doğrulama sıkıdır; eski tek-ders istekleri değişmez. Bitince exams özetinde ders ders netler, site ile aynı başlık/tür.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, tohumla } from "./yardim/soru-v2.mjs";

const T = await kur();
const { giris, api, yeniIstek, DB } = T;
await T.hazirla();
tohumla(DB, 12, { onek: "tr", s: "turkce", konular: ["Paragraf"], zorluklar: [1, 2, 3] });
tohumla(DB, 12, { onek: "ma", s: "mat", konular: ["Sayılar"], zorluklar: [1, 2, 3] });
tohumla(DB, 12, { onek: "ge", s: "geo", konular: ["Açılar"], zorluklar: [1, 2, 3] });
const { onRequest } = await import("../functions/api/hesap/[[yol]].js");
let ipn = 0;
const cagir = (tok, yontem, yol) => onRequest({ request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: yontem, headers: { "content-type": "application/json", authorization: "Bearer " + tok, "cf-connecting-ip": "10.9.9." + (++ipn) } }), env: T.env, params: { yol: yol.split("/") } });
const kullanici = async e => { const g = await giris(e); T.premiumYap(g.kid); return { cookie: g.cookie, kid: g.kid, tok: decodeURIComponent(/^ake_s=([^;]*)/.exec(g.cookie)[1]) }; };
const alanlar = async tok => (await (await cagir(tok, "GET", "veri")).json()).alanlar;

const BOLUMLER = [{ bolum: "Türkçe", ders: "turkce", adet: 3 }, { bolum: "Temel Matematik", ders: "mat", adet: 2 }, { bolum: "Temel Matematik", ders: "geo", adet: 2 }];
const olustur = (c, ek = {}) => api("oturum", { cookie: c.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 7, bolumler: BOLUMLER, tur: "TYT", uzunluk: "quarter", ...ek } });

test("1) bölümlü oturum: bölüm sırası ve ders başına adet korunur; cevap anahtarı sızmaz", async () => {
  const c = await kullanici("bd1@ornek.com");
  const o = await olustur(c);
  assert.equal(o.s, 200); assert.equal(o.j.mod, "exam"); assert.equal(o.j.adet, 7);
  assert.deepEqual(o.j.sorular.map(q => q.s), ["turkce", "turkce", "turkce", "mat", "mat", "geo", "geo"]);
  for (const q of o.j.sorular) { assert.equal(q.a, undefined); assert.equal(q.x, undefined); }
  assert.equal(new Set(o.j.sorular.map(q => q.id)).size, 7);
});

test("2) doğrulama: toplam uyuşmazlığı, yinelenen ders, geçersiz ders/tur/uzunluk, fazla anahtar, practice, tek-ders filtresiyle birlikte, 12 satır sınırı", async () => {
  const c = await kullanici("bd2@ornek.com");
  const kotu = async (ek, kod) => { const r = await olustur(c, ek); assert.equal(r.s, 400, JSON.stringify(ek).slice(0, 80)); if (kod) assert.equal(r.j.error, kod); };
  await kotu({ adet: 8 }, "bolumler");
  await kotu({ bolumler: [{ bolum: "A", ders: "mat", adet: 3 }, { bolum: "B", ders: "mat", adet: 4 }] }, "bolumler");
  await kotu({ bolumler: [{ bolum: "A", ders: "yok", adet: 7 }] }, "bolumler");
  await kotu({ bolumler: [{ bolum: "A", ders: "mat", adet: 7, ekstra: 1 }] }, "bolumler");
  await kotu({ bolumler: [{ bolum: "", ders: "mat", adet: 7 }] }, "bolumler");
  await kotu({ bolumler: [{ bolum: "A", ders: "mat", adet: 0 }], adet: 0 });
  await kotu({ bolumler: [] }, "bolumler");
  await kotu({ bolumler: "mat" }, "bolumler");
  await kotu({ tur: "LGS" }, "tur");
  await kotu({ uzunluk: "dev" }, "uzunluk");
  await kotu({ mod: "practice" }, "bolumler");
  await kotu({ ders: "mat" }, "bolumler");
  await kotu({ konu: "Sayılar" }, "bolumler");
  const cok = ["turkce", "tarih", "cografya", "felsefe", "din", "mat", "geo", "fizik", "kimya", "biyoloji", "amat", "afizik", "akimya"].map(d => ({ bolum: "B", ders: d, adet: 1 }));
  await kotu({ bolumler: cok, adet: 13 }, "bolumler");
  const yalnizTur = await api("oturum", { cookie: c.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 3, ders: "mat", tur: "TYT" } });
  assert.equal(yalnizTur.s, 400, "tur yalnız bolumler ile");
});

test("3) idempotent: aynı istek kimliği aynı oturumu verir; farklı bölümlerle aynı kimlik 409", async () => {
  const c = await kullanici("bd3@ornek.com"); const istek = yeniIstek();
  const a = await olustur(c, { istek }); const b = await olustur(c, { istek });
  assert.equal(a.s, 200); assert.equal(b.s, 200); assert.equal(a.j.oturum, b.j.oturum);
  const f = await olustur(c, { istek, bolumler: [{ bolum: "Türkçe", ders: "turkce", adet: 3 }, { bolum: "Temel Matematik", ders: "mat", adet: 4 }] });
  assert.equal(f.s, 409); assert.equal(f.j.error, "istek_cakisma");
});

test("4) ücretsiz hesapta bölümlü deneme de tek deneme hakkı harcar", async () => {
  const g = await giris("bd4@ornek.com"); const c = { cookie: g.cookie, kid: g.kid };
  const a = await olustur(c); assert.equal(a.s, 200); assert.equal(a.j.kota.tur, "deneme");
  assert.equal(a.j.kota.kalan, a.j.kota.limit - 1, "7 soru ama tek hak");
});

test("5) bitince exams özeti: site ile aynı başlık/tür, ders ders netler, stats her ders için işlenir; tekrar işlemek çift saymaz", async () => {
  const c = await kullanici("bd5@ornek.com");
  const o = await olustur(c);
  /* doğru şık: tohum a = sira % 5; soru kimliğinden okunur (id "<önek>-<i>") */
  const dogruSecim = q => Number(q.id.split("-")[1]) % 5;
  const planlanan = [dogruSecim, dogruSecim, null, dogruSecim, (q) => (dogruSecim(q) + 1) % 5, null, dogruSecim];   // tr: D D B · mat: D Y · geo: B D
  for (const [i, q] of o.j.sorular.entries()) { const f = planlanan[i]; if (f === null) continue; assert.equal((await api("cevap", { cookie: c.cookie, govde: { oturum: o.j.oturum, soru: q.id, secim: f(q) } })).s, 200); }
  assert.equal((await api("bitir", { cookie: c.cookie, govde: { oturum: o.j.oturum } })).s, 200);
  const r = await api("ilerleme", { cookie: c.cookie, govde: { oturum: o.j.oturum, tz: 180 } }); assert.equal(r.s, 200);
  const A = await alanlar(c.tok); const e = A.exams.exams;
  assert.equal(e.length, 1); assert.equal(e[0].title, "TYT denemesi · mini"); assert.equal(e[0].type, "TYT");
  assert.deepEqual(e[0].sections.map(s => [s.n, s.d, s.y, s.b]), [["Türkçe", 2, 0, 1], ["Temel Matematik", 2, 1, 1]]);
  assert.deepEqual([e[0].d, e[0].y, e[0].b], [4, 1, 2]); assert.equal(e[0].net, 4 - 1 / 4);
  assert.equal(e[0].sections[1].net, 2 - 1 / 4);
  const t = A.stats.topic; assert.deepEqual(t["turkce|Paragraf"], [2, 0, 1]); assert.deepEqual(t["mat|Sayılar"], [1, 1, 0]); assert.deepEqual(t["geo|Açılar"], [1, 0, 1]);
  await api("ilerleme", { cookie: c.cookie, govde: { oturum: o.j.oturum, tz: 180 } });
  const B = await alanlar(c.tok); assert.deepEqual(B.stats, A.stats); assert.deepEqual(B.exams, A.exams);
});

test("6) eski tek-ders deneme değişmedi: başlık 'Mobil deneme', tek bölüm", async () => {
  const c = await kullanici("bd6@ornek.com");
  const o = await api("oturum", { cookie: c.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 3, ders: "mat" } }); assert.equal(o.s, 200);
  await api("bitir", { cookie: c.cookie, govde: { oturum: o.j.oturum } });
  await api("ilerleme", { cookie: c.cookie, govde: { oturum: o.j.oturum, tz: 180 } });
  const e = (await alanlar(c.tok)).exams.exams[0];
  assert.equal(e.title, "Mobil deneme"); assert.equal(e.type, null); assert.equal(e.sections.length, 1);
});
