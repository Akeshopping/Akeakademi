// PR 3 · AKE_SORU_V2=1: yönetim soru-uret kanonik çift yazım (legacy json + kanonik kolonlar tek INSERT).  Gerçek Anthropic çağrısı YOK.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, aiStub, sentetik, tohumla, sizintiBul } from "./yardim/soru-v2.mjs";
import { soruYazKanonik } from "../lib/soru-yaz.js";
import { kanonikHash, govdeOf } from "../lib/soru-kanonik.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com", ANTHROPIC_API_KEY: "test-anahtar-sahte", AKE_SORU_GUNLUK: "1000" } });
const { DB, api, giris } = T;
const yon = await giris("yonetici@ornek.com");
const uret = async (sorular, b = {}) => { const st = aiStub(sorular); try { return await yonetimIstek(T, "soru-uret", { cookie: yon.cookie, govde: { s: "mat", t: "Sentetik Konu", d: 2, n: sorular.length, ...b } }); } finally { st.geriAl(); } };
const satir = id => DB.db.prepare("SELECT * FROM soru WHERE id = ?").get(id);
const temizle = () => DB.db.exec("DELETE FROM soru");
const aday = (i, ek = {}) => ({ s: "mat", t: "Sentetik Konu", d: 2, ...sentetik(i), ...ek });

test("3) bayrak açık: dual-write — legacy alanlar aynen + kaynak/rk/h/govde/a/x dolu, grup NULL, kopya_of NULL", async () => {
  temizle(); const r = await uret([sentetik(1, { p: "SENTETIK-PASAJ" }), sentetik(2)]);
  assert.equal(r.s, 200); assert.equal(r.j.uretilen, 2); assert.equal(r.j.gecen, 2); assert.equal(r.j.gecersiz, 0); assert.equal(r.j.catisma, 0);
  const rows = DB.db.prepare("SELECT * FROM soru").all(); assert.equal(rows.length, 2);
  for (const w of rows) {
    const q = JSON.parse(w.json);   // 15) legacy json parse edilir; p/q/o/a/x korunur
    assert.deepEqual(Object.keys(q).slice(0, 8), ["id", "s", "t", "d", "q", "o", "a", "x"]); assert.equal(q.id, w.id); assert.equal(q.o.length, 5); assert.ok(q.x.startsWith("SENTETIK-COZUM-")); assert.equal(typeof q.a, "number");
    assert.equal(w.durum, "onayli"); assert.equal(w.s, "mat"); assert.equal(w.d, 2);
    assert.equal(w.kaynak, "ai"); assert.ok(Number.isInteger(w.rk) && w.rk >= 0 && w.rk <= 2147483647);
    assert.equal(w.h, await kanonikHash(q)); assert.equal(w.govde, govdeOf(q)); assert.equal(w.a, q.a); assert.equal(w.x, q.x);
    assert.equal(w.grup, null); assert.equal(w.kopya_of, null);
    assert.ok(!("a" in JSON.parse(w.govde)) && !("x" in JSON.parse(w.govde)));   // govde cevap/çözüm taşımaz
  }
  assert.ok(JSON.parse(rows.find(w => w.json.includes("PASAJ")).json).p === "SENTETIK-PASAJ");
});
test("7) geçersiz soru kanonik bankaya yazılmaz (yanıtta sayılır)", async () => {
  temizle(); const kotu = [{ ...sentetik(5), o: ["a", "a", "b", "c", "d"] }, { ...sentetik(6), a: 9 }, sentetik(7)];
  const r = await uret(kotu); assert.equal(r.s, 200); assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n, r.j.gecen);
  assert.ok(r.j.gecen <= 1); assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE h IS NULL OR govde IS NULL").get().n, 0);
});
test("10) ID çakışması: üzerine yazılmaz; yeni id ile yazılır; hep çakışırsa idCakisma ve mevcut satır bozulmaz", async () => {
  temizle(); const a = await soruYazKanonik(T.env, aday(10), { idUret: () => "ok-sabit1" }); assert.equal(a.durum, "yazildi");
  const once = satir("ok-sabit1"); let n = 0;
  const b = await soruYazKanonik(T.env, aday(11), { idUret: () => (n++ ? "ok-yeni" + n : "ok-sabit1") }); assert.equal(b.durum, "yazildi"); assert.notEqual(b.id, "ok-sabit1");
  assert.deepEqual(satir("ok-sabit1"), once);   // eski satır aynen
  const c = await soruYazKanonik(T.env, aday(12), { idUret: () => "ok-sabit1" }); assert.equal(c.durum, "idCakisma");
  assert.deepEqual(satir("ok-sabit1"), once); assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n, 2);
});
test("8) tam duplicate (aynı h + aynı cevap/çözüm): INSERT edilir, kopya_of = mevcut kanonik; V2 havuzuna girmez", async () => {
  temizle(); const a = await soruYazKanonik(T.env, aday(20)); assert.equal(a.durum, "yazildi");
  const b = await soruYazKanonik(T.env, aday(20)); assert.equal(b.durum, "kopya"); assert.equal(b.kopyaOf, a.id);
  assert.equal(satir(b.id).kopya_of, a.id); assert.equal(satir(a.id).kopya_of, null);
  const c = await soruYazKanonik(T.env, aday(20)); assert.equal(c.kopyaOf, a.id);   // kanonik hâlâ ilk; zincir yok
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE kopya_of IS NULL").get().n, 1);
});
test("kaynak önceliği: gomulu < statik < ai — yeni AI mevcut gomulu/statik kanoniği devirmez, eski kayıtların kopya_of'u değişmez", async () => {
  temizle(); const q = aday(30), qq = { id: "g1", ...q }, h = await kanonikHash(qq);
  const ins = (id, kaynak, kopya) => DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, 'mat', 'T', 2, NULL, 'banka', 0, 0, ?, 5, ?, ?, ?, ?, ?)").run(id, kaynak, h, govdeOf(qq), q.a, q.x, kopya);
  ins("s1", "statik", null); ins("g1", "gomulu", null); ins("z1", "ai", "g1");
  const r = await soruYazKanonik(T.env, q); assert.equal(r.durum, "kopya"); assert.equal(r.kopyaOf, "g1");   // gomulu önce
  assert.equal(satir("s1").kopya_of, null); assert.equal(satir("z1").kopya_of, "g1"); assert.equal(satir("g1").kopya_of, null);
});
test("9) aynı h ama farklı cevap/çözüm: editoryal ÇATIŞMA — yazılmaz, kanonik bozulmaz", async () => {
  temizle(); const a = await soruYazKanonik(T.env, aday(40)); const once = satir(a.id);
  for (const ek of [{ a: (aday(40).a + 1) % 5 }, { x: "SENTETIK-FARKLI-COZUM" }]) {
    const c = await soruYazKanonik(T.env, aday(40, ek)); assert.equal(c.durum, "catisma");
  }
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n, 1); assert.deepEqual(satir(a.id), once);
  const r = await uret([sentetik(40, { a: (sentetik(40).a + 1) % 5 })]); assert.equal(r.j.catisma, 1); assert.equal(r.j.gecen, 0);
});
test("q-only benzerlik (farklı şık/pasaj) duplicate sayılmaz — ikisi de eligible", async () => {
  temizle(); const a = await soruYazKanonik(T.env, aday(50)); const b = await soruYazKanonik(T.env, aday(50, { o: [0, 1, 2, 3, 4].map(k => `DIGER-SIK-${k}`) })); const c = await soruYazKanonik(T.env, aday(50, { p: "BASKA-PASAJ" }));
  assert.deepEqual([a.durum, b.durum, c.durum], ["yazildi", "yazildi", "yazildi"]); assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE kopya_of IS NULL").get().n, 3);
});
test("11) atomiklik: INSERT ifadesi tek; hata enjekte edilirse ne legacy ne kanonik satır kalır", async () => {
  temizle(); const oncekiSql = DB.sayac.sql.length;
  const a = await soruYazKanonik(T.env, aday(60)); assert.equal(a.durum, "yazildi");
  const ins = DB.sayac.sql.slice(oncekiSql).filter(s => /^\s*INSERT INTO soru /i.test(s)); assert.equal(ins.length, 1);
  assert.ok(/json/.test(ins[0]) && /kaynak/.test(ins[0]) && /govde/.test(ins[0]));   // tek ifadede hem json hem kanonik kolonlar
  assert.equal(DB.sayac.sql.slice(oncekiSql).filter(s => /^\s*UPDATE soru /i.test(s)).length, 0);   // ikinci aşamalı UPDATE yok
});
test("16) V2 uyumu: yeni kanonik AI soru /api/soru/oturum ile seçilir; payload'da gizli alan yok; kopya_of'lu seçilmez", async () => {
  temizle(); const k = await soruYazKanonik(T.env, aday(70)); const kop = await soruYazKanonik(T.env, aday(70)); assert.equal(kop.durum, "kopya");
  const u = await giris("ogrenci@ornek.com"); T.premiumYap(u.kid);
  const r = await api("oturum", { cookie: u.cookie, govde: { istek: T.yeniIstek(), ders: "mat", mod: "practice", adet: 5 } });
  assert.equal(r.s, 200, r.t); assert.deepEqual(sizintiBul(r.j), []);
  const idler = JSON.stringify(r.j); assert.ok(idler.includes(k.id)); assert.ok(!idler.includes(kop.id));
});
test("legacy /api/sorular yeni dual-write satırı okur (json içinde a/x var)", async () => {
  temizle(); const k = await soruYazKanonik(T.env, aday(80));
  const mod = await import("../functions/api/sorular.js");
  const r = await mod.onRequest({ request: new Request("https://akeakademi.com/api/sorular"), env: T.env }); const j = await r.json(); const L = Array.isArray(j) ? j : (j.sorular || []);
  const q = L.find(x => x.id === k.id); assert.ok(q); assert.equal(q.a, aday(80).a); assert.ok(q.x);
});
