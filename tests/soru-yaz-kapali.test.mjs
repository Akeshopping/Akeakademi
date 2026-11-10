// PR 3 · AKE_SORU_V2 KAPALI regresyon: yönetim soru yazımı bugünkü legacy davranışıyla AYNEN çalışır; kanonik şema/ALTER/kolon yazımı yok.
// Çalıştırma: node --test tests/soru-yaz-kapali.test.mjs   (kanonik şema bu dosyada HİÇ kurulmaz: PRAGMA ile kanıtlanır)
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, aiStub, sentetik } from "./yardim/soru-v2.mjs";
import { soruSema } from "../lib/ortak.js";

const T = await kur({ bayrak: null, kanonik: false, ekEnv: { AKE_YONETICI: "yonetici@ornek.com", ANTHROPIC_API_KEY: "test-anahtar-sahte", AKE_SORU_GUNLUK: "1000" } });
const { DB, api, giris } = T;
await T.hazirla(); await soruSema(T.env);
const yonetici = await giris("yonetici@ornek.com");
const sutunlar = () => DB.db.prepare("PRAGMA table_info(soru)").all().map(r => r.name);
const KANONIK = ["kaynak", "rk", "h", "govde", "a", "x", "grup", "kopya_of"];
const uret = async (sorular, b = {}) => { const st = aiStub(sorular); try { return { ...(await yonetimIstek(T, "soru-uret", { cookie: yonetici.cookie, govde: { s: "mat", t: "Sentetik Konu", d: 2, n: sorular.length, ...b } })), ai: st.cagri.n }; } finally { st.geriAl(); } };

test("1) bayrak kapalı: soru-uret eski legacy davranışı (8 kolon, durum='onayli', json içinde a/x, yanıt {uretilen, gecen})", async () => {
  const r = await uret([sentetik(1), sentetik(2, { p: "SENTETIK-PASAJ" })]);
  assert.equal(r.s, 200); assert.deepEqual(r.j, { uretilen: 2, gecen: 2 }); assert.equal(r.ai, 1);   // yalnız sahte AI çağrıldı
  const rows = DB.db.prepare("SELECT * FROM soru ORDER BY tarih, id").all(); assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.match(row.id, /^ok-[0-9a-f]{10}$/); assert.equal(row.s, "mat"); assert.equal(row.t, "Sentetik Konu"); assert.equal(row.d, 2); assert.equal(row.durum, "onayli"); assert.ok(row.tarih > 0 && row.karar > 0);
    const q = JSON.parse(row.json); assert.deepEqual(Object.keys(q).slice(0, 8), ["id", "s", "t", "d", "q", "o", "a", "x"]); assert.equal(q.id, row.id); assert.equal(typeof q.a, "number"); assert.ok(q.x.startsWith("SENTETIK-COZUM-"));
  }
  assert.deepEqual(Object.keys(JSON.parse(rows.find(r => r.json.includes("PASAJ")).json)).slice(-1), ["p"]);
});
test("2) bayrak kapalı: kanonik şema çağrısı YOK — soru tablosuna ALTER/kolon/indeks eklenmedi, kanonik kolon yazımı denenmedi", async () => {
  assert.deepEqual(sutunlar().filter(c => KANONIK.includes(c)), []);
  assert.equal(DB.sayac.sql.filter(s => /ALTER TABLE|soru_h|soru_sec_|soru_oturum|govde|kopya_of/i.test(s)).length, 0);
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('soru_oturum','soru_oturum_soru','soru_h')").get().n, 0);
});
test("kapalıyken soru-karar: onay/red eski tek-UPDATE davranışı; kanonik kolon yok", async () => {
  const ekle = (id) => DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, 'mat', 'K', 1, ?, 'bekliyor', 1, 0)").run(id, JSON.stringify({ id, s: "mat", t: "K", d: 1, ...sentetik(9) }));
  ekle("ok-bek1"); ekle("ok-bek2"); ekle("ok-bek3");
  const a = await yonetimIstek(T, "soru-karar", { cookie: yonetici.cookie, govde: { id: ["ok-bek1", "ok-bek2"], karar: "onay" } });
  assert.deepEqual(a.j, { ok: true, n: 2 });
  const b = await yonetimIstek(T, "soru-karar", { cookie: yonetici.cookie, govde: { id: "ok-bek3", karar: "red" } }); assert.deepEqual(b.j, { ok: true, n: 1 });
  const d = id => DB.db.prepare("SELECT durum, karar FROM soru WHERE id = ?").get(id);
  assert.equal(d("ok-bek1").durum, "onayli"); assert.equal(d("ok-bek2").durum, "onayli"); assert.equal(d("ok-bek3").durum, "red"); assert.ok(d("ok-bek1").karar > 1);
  assert.deepEqual(sutunlar().filter(c => KANONIK.includes(c)), []);
  /* geçersiz/bozuk json bile eski davranışla onaylanır (bayrak kapalı: doğrulama yok) */
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES ('ok-bozuk', 'x', 'K', 9, '{bozuk', 'bekliyor', 1, 0)").run();
  assert.deepEqual((await yonetimIstek(T, "soru-karar", { cookie: yonetici.cookie, govde: { id: "ok-bozuk", karar: "onay" } })).j, { ok: true, n: 1 }); assert.equal(d("ok-bozuk").durum, "onayli");
});
test("19-24) üretim garantisi: bayrak yokken V2 API 404 ve D1 şeması dokunulmaz; /api/sorular legacy satırı okur; legacy yazım sürer", async () => {
  for (const [y, m] of [["ozet", "GET"], ["oturum", "POST"], ["cevap", "POST"], ["bitir", "POST"]]) assert.equal((await api(y, { m, cookie: yonetici.cookie, govde: m === "POST" ? {} : undefined })).s, 404, y);
  const mod = await import("../functions/api/sorular.js");
  const r = await mod.onRequest({ request: new Request("https://akeakademi.com/api/sorular"), env: T.env });
  const j = await r.json(); const liste = Array.isArray(j) ? j : (j.sorular || j.q || []);
  assert.ok(liste.length >= 3 && liste.every(q => q.q && q.a !== undefined)); assert.deepEqual(sutunlar().filter(c => KANONIK.includes(c)), []);
  assert.equal(DB.sayac.sql.filter(s => /ALTER TABLE|soru_oturum|soru_sec_/i.test(s)).length, 0);
});
test("bayrak değerleri: '', '0', 'true', 'yes' da kapalı sayılır (yalnız '1' açar) — soru-uret legacy kalır", async () => {
  for (const v of ["", "0", "true", "yes", " 2 "]) {
    T.env.AKE_SORU_V2 = v; const r = await uret([sentetik(100 + v.length)]); assert.deepEqual(r.j, { uretilen: 1, gecen: 1 }, JSON.stringify(v));
  }
  delete T.env.AKE_SORU_V2; assert.deepEqual(sutunlar().filter(c => KANONIK.includes(c)), []);
});
