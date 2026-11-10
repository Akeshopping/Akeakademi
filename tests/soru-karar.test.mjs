// PR 3 · soru-karar (yönetim onay/red), AKE_SORU_V2=1: onayda kanonik alanlar doldurulur, hepsi-ya-hiçbiri.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, sentetik } from "./yardim/soru-v2.mjs";
import { soruYazKanonik } from "../lib/soru-yaz.js";
import { kanonikHash } from "../lib/soru-kanonik.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com" } });
const { DB, giris } = T; const yon = await giris("yonetici@ornek.com");
const karar = (id, k) => yonetimIstek(T, "soru-karar", { cookie: yon.cookie, govde: { id, karar: k } });
const bek = (id, i, ek = {}, jsonHam) => { const q = { id, s: "mat", t: "K", d: 2, ...sentetik(i), ...ek }; DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, ?, 'K', 2, ?, 'bekliyor', 1, 0)").run(id, q.s, jsonHam ?? JSON.stringify(q)); return q; };
const w = id => DB.db.prepare("SELECT * FROM soru WHERE id = ?").get(id);
const temizle = () => DB.db.exec("DELETE FROM soru");

test("12) onay: canonical boşsa json'dan doldurulur (kaynak/rk/h/govde/a/x) ve durum='onayli'", async () => {
  temizle(); const q = bek("b1", 1);
  const r = await karar(["b1"], "onay"); assert.equal(r.s, 200, r.t); assert.equal(r.j.ok, true); assert.equal(r.j.n, 1);
  const s = w("b1"); assert.equal(s.durum, "onayli"); assert.equal(s.kaynak, "ai"); assert.equal(s.h, await kanonikHash(q)); assert.equal(s.a, q.a); assert.equal(s.x, q.x); assert.ok(s.govde && s.rk >= 0); assert.equal(s.kopya_of, null); assert.ok(s.karar > 1);
});
test("geçersiz soru: 409, hiçbiri onaylanmaz (atomik), satır 'bekliyor' ve canonical NULL kalır", async () => {
  temizle(); bek("c1", 1); bek("c2", 2, { a: 9 });
  const r = await karar(["c1", "c2"], "onay"); assert.equal(r.s, 409); assert.equal(r.j.error, "dogrulama"); assert.equal(r.j.hatalar[0].id, "c2");
  for (const id of ["c1", "c2"]) { const s = w(id); assert.equal(s.durum, "bekliyor"); assert.equal(s.h, null); assert.equal(s.kaynak, null); }
});
test("bozuk json: 409 json_bozuk, kısmi onay yok", async () => {
  temizle(); bek("d1", 1); bek("d2", 2, {}, "{bozuk");
  const r = await karar(["d1", "d2"], "onay"); assert.equal(r.s, 409); assert.equal(r.j.hatalar[0].neden, "json_bozuk"); assert.equal(w("d1").durum, "bekliyor");
});
test("13) red eski davranış: canonical'e dokunmaz, durum='red'", async () => {
  temizle(); bek("e1", 1); const r = await karar("e1", "red"); assert.deepEqual(r.j, { ok: true, n: 1 });
  const s = w("e1"); assert.equal(s.durum, "red"); assert.equal(s.h, null); assert.equal(s.kaynak, null);
});
test("çoklu ID: biri çatışırsa (mevcut kanonikle aynı h, farklı cevap) hiçbiri onaylanmaz", async () => {
  temizle(); const a = await soruYazKanonik(T.env, { s: "mat", t: "K", d: 2, ...sentetik(3) });
  bek("f1", 4); bek("f2", 3, { a: (sentetik(3).a + 1) % 5 });
  const r = await karar(["f1", "f2"], "onay"); assert.equal(r.s, 409); assert.match(r.j.hatalar[0].neden, /catisma/); assert.equal(w("f1").durum, "bekliyor"); assert.equal(w("f2").durum, "bekliyor"); assert.equal(w(a.id).durum, "onayli");
});
test("istek içi çatışma (aynı h, farklı çözüm) → 409; aynı istekte tam kopya → ikisi onaylanır, ikincisi kopya_of", async () => {
  temizle(); bek("g1", 7); bek("g2", 7, { x: "FARKLI" });
  assert.equal((await karar(["g1", "g2"], "onay")).s, 409); assert.equal(w("g1").durum, "bekliyor");
  temizle(); bek("h1", 8); bek("h2", 8);
  const r = await karar(["h1", "h2"], "onay"); assert.equal(r.s, 200); assert.equal(r.j.onaylanan, 2); assert.equal(r.j.kopya, 1);
  const ks = [w("h1").kopya_of, w("h2").kopya_of].filter(Boolean); assert.equal(ks.length, 1); assert.ok(["h1", "h2"].includes(ks[0]));
});
test("eşzamanlı değişiklik (araya giren çatışma) → ASSERT/WHERE ile batch geri alınır, hiçbir satır onaylanmaz", async () => {
  temizle(); bek("i1", 11); bek("i2", 12);
  const k = { s: "mat", t: "K", d: 2, ...sentetik(12), a: (sentetik(12).a + 1) % 5 }, h = await kanonikHash({ id: "x", ...k });
  DB.hook.hedef = /UPDATE soru SET durum = 'onayli'/;
  DB.hook.araSql = [0, `INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x) VALUES ('araya', 'mat', 'K', 2, NULL, 'banka', 0, 0, 'ai', 1, '${h}', '{}', ${k.a}, '${k.x}')`];
  const r = await karar(["i1", "i2"], "onay"); DB.hook.hedef = null; DB.hook.araSql = null;
  assert.equal(r.s, 409); assert.equal(w("i1").durum, "bekliyor"); assert.equal(w("i2").durum, "bekliyor"); assert.equal(w("i1").h, null);
});
