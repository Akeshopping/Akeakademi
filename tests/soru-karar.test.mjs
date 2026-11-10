// PR 3 · soru-karar (yönetim onay/red), AKE_SORU_V2=1: onayda kanonik alanlar doldurulur, hepsi-ya-hiçbiri.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, sentetik } from "./yardim/soru-v2.mjs";
import { soruYazKanonik, kanonikAlanlar } from "../lib/soru-yaz.js";
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

/* ---- PR 3 düzeltmesi: son assert hedeflerin HEPSİNİN onayli+kanonik olmasını ister; hazır-canonical satırlar da denetlenir ---- */
const HEDEF = /UPDATE soru SET durum = 'onayli'/;
const durumlar = ids => ids.map(id => (w(id) || { durum: "YOK" }).durum);
test("RACE: preflight sonrası, batch öncesi B red yapılır → istek BAŞARISIZ (409), A onaylı KALMAZ, 'onaylanan:2' yok", async () => {
  temizle(); bek("r1", 21); bek("r2", 22);
  DB.hook.hedef = HEDEF; DB.hook.once = () => DB.db.prepare("UPDATE soru SET durum = 'red' WHERE id = 'r2'").run();
  const r = await karar(["r1", "r2"], "onay"); DB.hook.hedef = null; DB.hook.once = null;
  assert.equal(r.s, 409); assert.equal(r.j.onaylanan, undefined); assert.equal(r.j.hatalar[0].id, "*");
  assert.deepEqual(durumlar(["r1", "r2"]), ["bekliyor", "red"]);   // A geri alındı; dış değişiklik (red) korunur
  assert.equal(w("r1").h, null); assert.equal(w("r1").kaynak, null);
});
test("RACE: aynı durum, hazır-canonical satırlarla da başarısız olur", async () => {
  temizle(); await soruYazKanonik(T.env, { s: "mat", t: "K", d: 2, ...sentetik(31) }, { durum: "bekliyor", idUret: () => "p1" }); await soruYazKanonik(T.env, { s: "mat", t: "K", d: 2, ...sentetik(32) }, { durum: "bekliyor", idUret: () => "p2" });
  DB.hook.hedef = HEDEF; DB.hook.once = () => DB.db.prepare("UPDATE soru SET durum = 'red' WHERE id = 'p2'").run();
  const r = await karar(["p1", "p2"], "onay"); DB.hook.hedef = null; DB.hook.once = null;
  assert.equal(r.s, 409); assert.deepEqual(durumlar(["p1", "p2"]), ["bekliyor", "red"]);
});
test("durum değişikliği (başka bir duruma) ve SİLİNME: bekleyen satır batch öncesi değişirse istek başarılı sayılmaz", async () => {
  for (const [ad, sql] of [["banka", "UPDATE soru SET durum = 'banka' WHERE id = 'v2'"], ["silinme", "DELETE FROM soru WHERE id = 'v2'"], ["onayli (başkası onayladı)", "UPDATE soru SET durum = 'onayli' WHERE id = 'v2'"]]) {
    temizle(); bek("v1", 41); bek("v2", 42);
    DB.hook.hedef = HEDEF; DB.hook.once = () => DB.db.exec(sql);
    const r = await karar(["v1", "v2"], "onay"); DB.hook.hedef = null; DB.hook.once = null;
    assert.equal(r.s, 409, ad); assert.equal(w("v1").durum, "bekliyor", ad); assert.equal(w("v1").h, null, ad);
  }
});
test("hazır canonical bekleyen + aynı h + FARKLI cevap/çözüm → onaylanmaz (409); satır 'bekliyor' kalır", async () => {
  temizle(); const m = await soruYazKanonik(T.env, { s: "mat", t: "K", d: 2, ...sentetik(51) });   // yayında kanonik
  const q = { id: "hz1", s: "mat", t: "K", d: 2, ...sentetik(51), a: (sentetik(51).a + 1) % 5 }, k = (await kanonikAlanlar(q)).alan;
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x) VALUES ('hz1','mat','K',2,?, 'bekliyor',1,0,?,?,?,?,?,?)").run(JSON.stringify(q), k.kaynak, k.rk, k.h, k.govde, k.a, k.x);
  const r = await karar(["hz1"], "onay"); assert.equal(r.s, 409); assert.match(r.j.hatalar[0].neden, /catisma/); assert.equal(w("hz1").durum, "bekliyor"); assert.equal(w(m.id).kopya_of, null);
});
test("hazır canonical bekleyen + tam duplicate → kopya_of kanonik ID'ye bağlanır, sonra onaylanır; eski kayıtlar değişmez", async () => {
  temizle(); const m = await soruYazKanonik(T.env, { s: "mat", t: "K", d: 2, ...sentetik(52) }); const once = w(m.id);
  await soruYazKanonik(T.env, { s: "mat", t: "K", d: 2, ...sentetik(52) }, { durum: "bekliyor", idUret: () => "hz2" });
  const r = await karar(["hz2"], "onay"); assert.equal(r.s, 200, r.t); assert.equal(r.j.kopya, 1);
  assert.equal(w("hz2").durum, "onayli"); assert.equal(w("hz2").kopya_of, m.id); assert.deepEqual(w(m.id), once);
});
test("hazır canonical ama tutarsız (h govdeyle uyuşmuyor / yarım dolu) → 409, onaylanmaz", async () => {
  temizle(); const q = { id: "hz3", s: "mat", t: "K", d: 2, ...sentetik(53) }, k = (await kanonikAlanlar(q)).alan;
  const ekle = (id, h, x) => DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x) VALUES (?,'mat','K',2,?, 'bekliyor',1,0,?,?,?,?,?,?)").run(id, JSON.stringify(q), k.kaynak, k.rk, h, k.govde, k.a, x);
  ekle("hz3", "yanlis-hash", k.x); ekle("hz4", k.h, null);
  assert.equal((await karar(["hz3"], "onay")).s, 409); assert.equal((await karar(["hz4"], "onay")).s, 409); assert.deepEqual(durumlar(["hz3", "hz4"]), ["bekliyor", "bekliyor"]);
});
test("hazır canonical bekleyen (kopya_of NULL) + tam duplicate: onayda UPDATE kopya_of'u bağlar", async () => {
  temizle(); const m = await soruYazKanonik(T.env, { s: "mat", t: "K", d: 2, ...sentetik(54) });
  const q = { id: "hz5", s: "mat", t: "K", d: 2, ...sentetik(54) }, k = (await kanonikAlanlar(q)).alan;
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x) VALUES ('hz5','mat','K',2,?, 'bekliyor',1,0,?,?,?,?,?,?)").run(JSON.stringify(q), k.kaynak, k.rk, k.h, k.govde, k.a, k.x);
  const r = await karar(["hz5"], "onay"); assert.equal(r.s, 200, r.t); assert.equal(w("hz5").durum, "onayli"); assert.equal(w("hz5").kopya_of, m.id); assert.equal(w(m.id).kopya_of, null);
});
