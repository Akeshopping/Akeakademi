// Mobil istemcinin kullandığı uçların GERÇEK sunucu koduyla uçtan uca sözleşme testi (Dart istemcisi bu sözleşmeye göre yazıldı).
// Kimlik yalnızca Authorization: Bearer; Origin, Referer ve çerez GÖNDERİLMEZ. Çalıştırma: node --test tests/mobil-akis-sozlesme.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { kur, tohumla } from "./yardim/soru-v2.mjs";

const T = await kur();
const { DB, api, giris, yeniIstek } = T;
await T.hazirla();
tohumla(DB, 40, { onek: "m", s: "mat", konular: ["Sayılar", "Limit"], zorluklar: [1, 2, 3] });
tohumla(DB, 10, { onek: "t", s: "turkce", konular: ["Paragraf"], zorluklar: [2] });

const mobil = async eposta => { const g = await giris(eposta); return { kid: g.kid, tok: decodeURIComponent(/^ake_s=([^;]*)/.exec(g.cookie)[1]) }; };
const m = (tok, yol, govde, yontem = "POST") => api(yol, { m: yontem, govde, origin: null, ek: { authorization: "Bearer " + tok } });

test("özet → oturum → cevap → bitir: yalnız Bearer ile; anahtar cevaptan önce sızmaz", async () => {
  const { tok } = await mobil("mobil-akis-1@ornek.com");
  const oz = await m(tok, "ozet", undefined, "GET");
  assert.equal(oz.s, 200); assert.equal(oz.j.dersler.mat.konular["Sayılar"].toplam > 0, true);
  const o = await m(tok, "oturum", { istek: yeniIstek(), mod: "practice", adet: 3, ders: "mat", konu: "Sayılar" });
  assert.equal(o.s, 200); assert.equal(o.j.sorular.length, 3);
  for (const s of o.j.sorular) { assert.deepEqual(Object.keys(s).sort().filter(k => !["p"].includes(k)), ["d", "id", "o", "q", "s", "t"], "istemciye giden soruda a/x (cevap anahtarı) yok"); assert.equal(s.o.length, 5); }
  const s0 = o.j.sorular[0];
  const c = await m(tok, "cevap", { oturum: o.j.oturum, soru: s0.id, secim: 0 });
  assert.equal(c.s, 200); assert.equal(typeof c.j.dogru, "boolean"); assert.equal(typeof c.j.a, "number");
  const tekrar = await m(tok, "cevap", { oturum: o.j.oturum, soru: s0.id, secim: 0 });
  assert.equal(tekrar.s, 200, "aynı şık tekrarı (ağ yeniden denemesi) idempotent");
  const baska = await m(tok, "cevap", { oturum: o.j.oturum, soru: s0.id, secim: 1 });
  assert.equal(baska.s, 409); assert.equal(baska.j.error, "cevap_kilitli", "cevap kilitlenir: farklı şık reddedilir");
  const b = await m(tok, "bitir", { oturum: o.j.oturum });
  assert.equal(b.s, 200); assert.equal(b.j.dogru + b.j.yanlis + b.j.bos, 3);
});
test("başka kullanıcının oturumuna Bearer ile erişilemez (404); oturum süresi dolunca 401", async () => {
  const a = await mobil("mobil-akis-2a@ornek.com"), b = await mobil("mobil-akis-2b@ornek.com");
  const o = await m(a.tok, "oturum", { istek: yeniIstek(), mod: "practice", adet: 2, ders: "mat" });
  const s = o.j.sorular[0];
  assert.equal((await m(b.tok, "cevap", { oturum: o.j.oturum, soru: s.id, secim: 0 })).s, 404);
  assert.equal((await m(b.tok, "bitir", { oturum: o.j.oturum })).s, 404);
  DB.db.prepare("UPDATE oturum SET bitis = ? WHERE kid = ?").run(Date.now() - 1000, a.kid);
  assert.equal((await m(a.tok, "cevap", { oturum: o.j.oturum, soru: s.id, secim: 0 })).s, 401);
});
test("ücretsiz hak dolunca 402 (uygulama 'hakkın bitti' ekranı); aynı istek kimliği tekrarında kota bir kez düşer", async () => {
  const { tok } = await mobil("mobil-akis-3@ornek.com");
  const istek = yeniIstek();
  const a = await m(tok, "oturum", { istek, mod: "practice", adet: 5, ders: "mat" }), b = await m(tok, "oturum", { istek, mod: "practice", adet: 5, ders: "mat" });
  assert.equal(a.s, 200); assert.equal(b.s, 200); assert.equal(a.j.oturum, b.j.oturum);
  assert.equal(a.j.kota.kalan, b.j.kota.kalan, "ikinci istek kotadan düşmedi");
});
test("ilerleme: Bearer ile stats okunur/yazılır ve web alanları korunur (mobil yalnız sayaçları günceller)", async () => {
  const { tok } = await mobil("mobil-akis-4@ornek.com");
  const { onRequest } = await import("../functions/api/hesap/[[yol]].js");
  const cagir = (yontem, yol, govde) => onRequest({ request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: yontem, headers: { "content-type": "application/json", authorization: "Bearer " + tok, "cf-connecting-ip": "10.9.9.9" }, body: govde ? JSON.stringify(govde) : undefined }), env: T.env, params: { yol: yol.split("/") } });
  const webStats = { _u: 1000, ans: { "mat-1": [1, 0, 0, 1, 1] }, badges: { ilk: 1 }, topic: { "mat|Sayılar": [3, 1, 0] } };
  assert.equal((await cagir("PUT", "veri/stats", webStats)).status, 200);
  const okunan = (await (await cagir("GET", "veri")).json()).alanlar.stats;
  const yeni = { ...okunan, topic: { ...okunan.topic, "mat|Sayılar": [4, 1, 0] }, _u: 2000 };
  assert.equal((await cagir("PUT", "veri/stats", yeni)).status, 200);
  const son = (await (await cagir("GET", "veri")).json()).alanlar.stats;
  assert.deepEqual(son.ans, webStats.ans); assert.deepEqual(son.badges, webStats.badges); assert.deepEqual(son.topic["mat|Sayılar"], [4, 1, 0]);
  assert.equal((await cagir("PUT", "veri/stats", { ...yeni, _u: 1500 })).status, 409, "eski yazma reddedilir (istemci yeniden okur)");
});
