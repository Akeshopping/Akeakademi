// Korumalı soru bankası · PR 1: şema genişlemesi ve göç aracı (SENTETİK sorularla; gerçek soru metni içermez)
// Çalıştırma: node --test tests/soru-migration.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { soruKanonikSema, SORU_TABLO_SQL, YENI_SUTUNLAR, kanonikHash, cevapHash, govdeOf, normalize, dogrulaSoru, DURUM_BANKA } from "../lib/soru-kanonik.js";
import { planla, uygula, rapor, d1Yerel, satirlariOku } from "../fabrika/soru-migrate.mjs";

/* ---- sentetik soru üretici: metinler belirgin biçimde uydurma ---- */
const sentetik = (id, i = 0, ek = {}) => Object.assign({ id, s: "mat", t: "Sentetik konu", d: 1 + (i % 3), q: `SENTETIK-SORU-${id}-${i}`, o: [0, 1, 2, 3, 4].map(k => `SENTETIK-SIK-${id}-${k}`), a: i % 5, x: `SENTETIK-COZUM-${id}` }, ek);
const kaynak = (ad, tur, sorular) => ({ ad, tur, sorular });
const SERBEST = null; /* beklenen sayı denetimi kapalı: sentetik veri */
let rkSayac = 100; const rkSabit = () => (rkSayac += 7);
const DERS = ["mat", "turkce", "fizik"];

async function yeniDb({ legacy = 0 } = {}) {
  const db = new DatabaseSync(":memory:"); db.exec(SORU_TABLO_SQL);
  const ek = db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, ?, ?, ?, ?, 'onayli', ?, ?)");
  for (let i = 0; i < legacy; i++) { const q = sentetik("ok-" + String(i).padStart(3, "0"), i, { t: "AI konusu" }); ek.run(q.id, q.s, q.t, q.d, JSON.stringify(q), 1000 + i, 2000 + i); }
  return db;
}
const plan = async (db, kaynaklar, ek = {}) => planla({ kaynaklar, mevcut: satirlariOku(db), dersler: DERS, beklenen: SERBEST, rk: rkSabit, ...ek });
const say = (db, w = "1=1") => db.prepare(`SELECT COUNT(*) AS n FROM soru WHERE ${w}`).get().n;

test("1-2) eski soru tablosunda şema genişler; mevcut sütunlar ve veri bozulmaz; tekrar çalışınca hata yok", async () => {
  const db = await yeniDb({ legacy: 3 }), onceki = db.prepare("SELECT * FROM soru ORDER BY id").all();
  await soruKanonikSema(d1Yerel(db)); await soruKanonikSema(d1Yerel(db));
  const sut = db.prepare("PRAGMA table_info(soru)").all().map(r => r.name);
  for (const c of ["id", "s", "t", "d", "json", "durum", "tarih", "karar", ...YENI_SUTUNLAR.map(x => x[0])]) assert.ok(sut.includes(c), "sütun yok: " + c);
  const sonra = db.prepare("SELECT id, s, t, d, json, durum, tarih, karar FROM soru ORDER BY id").all();
  assert.deepEqual(sonra.map(r => ({ ...r })), onceki.map(({ id, s, t, d, json, durum, tarih, karar }) => ({ id, s, t, d, json, durum, tarih, karar })), "mevcut sütun değerleri aynen durmalı");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM soru WHERE kaynak IS NOT NULL OR rk IS NOT NULL OR h IS NOT NULL").get().n, 0, "yeni sütunlar NULL başlar");
});

test("3) legacy D1 satırları (ok-*) yeni sütunlara doldurulur; kimlik/durum/tarih/karar korunur; legacy json'a dokunulmaz", async () => {
  const db = await yeniDb({ legacy: 5 }); await soruKanonikSema(d1Yerel(db));
  const jsonOnce = db.prepare("SELECT id, json, durum, tarih, karar FROM soru ORDER BY id").all();
  const p = await plan(db, []); assert.equal(p.basarili, true); assert.equal(p.sayim.backfill, 5); assert.equal(p.sayim.new_insert, 0);
  await uygula(db, p);
  const r = db.prepare("SELECT * FROM soru WHERE id = 'ok-002'").get();
  assert.equal(r.kaynak, "ai"); assert.ok(Number.isInteger(r.rk) && r.rk >= 0 && r.rk <= 2147483647); assert.match(r.h, /^[0-9a-f]{64}$/);
  assert.deepEqual(JSON.parse(r.govde), { q: "SENTETIK-SORU-ok-002-2", o: [0, 1, 2, 3, 4].map(k => `SENTETIK-SIK-ok-002-${k}`) }, "govde yalnız p?/q/o; a/x yok");
  assert.equal(r.a, 2); assert.equal(r.x, "SENTETIK-COZUM-ok-002");
  assert.deepEqual(db.prepare("SELECT id, json, durum, tarih, karar FROM soru ORDER BY id").all(), jsonOnce, "legacy json/durum/tarih/karar aynen");
});

test("4-6) 1127 kaynak + 89 mevcut = 1216; ikinci göç yine 1216 ve hepsi no-op; mevcutlar kaynak sayısına karışmaz", async () => {
  const db = await yeniDb({ legacy: 89 }); await soruKanonikSema(d1Yerel(db));
  const g = Array.from({ length: 728 }, (_, i) => sentetik("g-" + i, i)), r01 = Array.from({ length: 99 }, (_, i) => sentetik("r01-" + i, i)), pl = Array.from({ length: 100 }, (_, i) => sentetik("AKE-YKS-PILOT-" + i, i)), y2 = Array.from({ length: 200 }, (_, i) => sentetik("AKE-YKS-02-" + i, i));
  const K = () => [kaynak("embedded", "gomulu", g), kaynak("r01", "statik", r01), kaynak("pilot-100", "statik", pl), kaynak("ake-yks-02-200", "statik", y2)];
  const p1 = await plan(db, K(), { beklenen: { embedded: 728, r01: 99, "pilot-100": 100, "ake-yks-02-200": 200 } });
  assert.equal(p1.basarili, true, JSON.stringify(p1.sapma.concat(p1.catisma, p1.gecersiz)));
  assert.deepEqual(p1.sayim.kaynaklar, { embedded: 728, r01: 99, "pilot-100": 100, "ake-yks-02-200": 200 }); assert.equal(p1.sayim.existing_d1, 89);
  assert.equal(p1.sayim.expected_total, 1216); assert.equal(p1.sayim.new_insert, 1127); assert.equal(p1.sayim.backfill, 89); assert.equal(p1.sayim.final_total, 1216);
  await uygula(db, p1); assert.equal(say(db), 1216);
  assert.equal(say(db, "durum = 'banka'"), 1127, "göçle gelenler dormant 'banka' durumunda (legacy /api/sorular onayli filtreler)");
  assert.equal(say(db, "durum = 'onayli'"), 89, "legacy onaylı sorular aynen");
  const p2 = await plan(db, K(), { beklenen: { embedded: 728, r01: 99, "pilot-100": 100, "ake-yks-02-200": 200 } });
  assert.equal(p2.basarili, true); assert.equal(p2.sayim.new_insert, 0); assert.equal(p2.sayim.backfill, 0); assert.equal(p2.sayim.idempotent_noop, 1216); assert.equal(p2.sayim.final_total, 1216);
  await uygula(db, p2); assert.equal(say(db), 1216, "ikinci uygulama sayıyı artırmaz");
});

test("7) aynı kimlik + aynı özet → no-op (eksik sütun varsa güvenle doldurulur, mevcut değer değişmez)", async () => {
  const db = await yeniDb(); await soruKanonikSema(d1Yerel(db)); const k = [kaynak("a", "statik", [sentetik("x1", 1)])];
  await uygula(db, await plan(db, k)); const once = db.prepare("SELECT * FROM soru").all();
  const p = await plan(db, k); assert.equal(p.sayim.idempotent_noop, 1); assert.equal(p.sayim.new_insert, 0); await uygula(db, p);
  assert.deepEqual(db.prepare("SELECT * FROM soru").all(), once);
  db.prepare("UPDATE soru SET rk = NULL, kaynak = NULL WHERE id = 'x1'").run(); /* yarım kalmış satır */
  const p3 = await plan(db, k); assert.equal(p3.sayim.backfill, 1); await uygula(db, p3);
  const r = db.prepare("SELECT kaynak, rk, a, x, h FROM soru WHERE id = 'x1'").get(); assert.equal(r.kaynak, "statik"); assert.ok(r.rk != null); assert.equal(r.a, 1);
});

test("8) aynı kimlik + farklı içerik özeti → HARD CONFLICT; eski soru overwrite edilmez; uygulama reddedilir", async () => {
  const db = await yeniDb(); await soruKanonikSema(d1Yerel(db)); await uygula(db, await plan(db, [kaynak("a", "statik", [sentetik("c1", 1)])]));
  const degisik = sentetik("c1", 1, { q: "SENTETIK-SORU-DEGISTI" }), once = db.prepare("SELECT * FROM soru").all();
  const p = await plan(db, [kaynak("a", "statik", [degisik, sentetik("c2", 2)])]);
  assert.equal(p.basarili, false); assert.equal(p.sayim.conflicts, 1); assert.deepEqual(p.catisma[0], { tur: "icerik", id: "c1", kaynak: "a" });
  await assert.rejects(() => uygula(db, p), /reddedildi/); assert.deepEqual(db.prepare("SELECT * FROM soru").all(), once, "hiçbir şey yazılmadı (c2 de eklenmedi)");
  /* aynı gövde, farklı doğru cevap → ayrı bir 'cevap' çatışması (sessiz değişiklik yok) */
  const cevapFarkli = await plan(db, [kaynak("a", "statik", [sentetik("c1", 1, { a: 4 })])]); assert.equal(cevapFarkli.catisma[0].tur, "cevap");
});

test("9) içerik kopyası farklı kimliklerle: ikisi de korunur, kopya_of kanonik kimliğe işaret eder; q-only farkı kopya sayılmaz", async () => {
  const db = await yeniDb(); await soruKanonikSema(d1Yerel(db));
  const A = sentetik("z-old", 1), B = Object.assign({}, A, { id: "a-new" }), C = Object.assign({}, A, { id: "q-only", o: A.o.map((x, i) => i === 4 ? "BASKA-SIK" : x) });
  const p = await plan(db, [kaynak("embedded", "gomulu", [A]), kaynak("r01", "statik", [B, C])]);
  assert.equal(p.basarili, true); assert.equal(p.sayim.duplicate_content, 1); assert.equal(p.sayim.q_only_duplicate_groups, 1, "yalnız q aynı grup sayılır ama kopya_of verilmez");
  await uygula(db, p); assert.equal(say(db), 3, "hiçbir satır silinmedi");
  assert.equal(db.prepare("SELECT kopya_of FROM soru WHERE id = 'z-old'").get().kopya_of, null, "kanonik: kaynak önceliği (gömülü) kazanır");
  assert.equal(db.prepare("SELECT kopya_of FROM soru WHERE id = 'a-new'").get().kopya_of, "z-old");
  assert.equal(db.prepare("SELECT kopya_of FROM soru WHERE id = 'q-only'").get().kopya_of, null, "yalnız q aynı diye kopya_of verilmez");
});

test("10) h UNIQUE değil: aynı h'li iki satır eklenebilir; h için normal (UNIQUE olmayan) indeks var", async () => {
  const db = await yeniDb(); await soruKanonikSema(d1Yerel(db));
  const ix = db.prepare("PRAGMA index_list(soru)").all().find(i => i.name === "soru_h"); assert.ok(ix, "soru_h indeksi var"); assert.equal(ix.unique, 0, "UNIQUE değil");
  db.prepare("INSERT INTO soru (id, h) VALUES ('d1', 'AYNI'), ('d2', 'AYNI')").run(); assert.equal(say(db, "h = 'AYNI'"), 2);
  assert.deepEqual(db.prepare("PRAGMA index_info(soru_h)").all().map(r => r.name), ["h"], "PR 1'de tek indeks: soru(h)");
  assert.equal(db.prepare("PRAGMA index_list(soru)").all().filter(i => i.origin === "c").length, 1, "gereksiz ek indeks yok");
});

test("11) kopya_of deterministik: sıra/kaynak sırası değişse de aynı kanonik; kimlikler kod sırasına göre", async () => {
  const A = sentetik("b-2", 1), B = Object.assign({}, A, { id: "a-1" }), C = Object.assign({}, A, { id: "c-3" });
  const hesapla = async kaynaklar => { const db = await yeniDb(); await soruKanonikSema(d1Yerel(db)); const p = await plan(db, kaynaklar); return JSON.stringify(p.kopyaGruplari); };
  const x = await hesapla([kaynak("r01", "statik", [A, B, C])]), y = await hesapla([kaynak("r01", "statik", [C, B, A])]);
  assert.equal(x, y); assert.deepEqual(JSON.parse(x), [{ kanonik: "a-1", kopyalar: ["b-2", "c-3"] }]);
  const k2 = await hesapla([kaynak("r01", "statik", [B, C]), kaynak("embedded", "gomulu", [A])]); assert.deepEqual(JSON.parse(k2), [{ kanonik: "b-2", kopyalar: ["a-1", "c-3"] }], "gömülü kaynak önceliği kazanır");
  /* kopyalarda doğru cevap farklıysa sessizce kopya sayılmaz: çatışma */
  const db = await yeniDb(); await soruKanonikSema(d1Yerel(db)); const p = await plan(db, [kaynak("r01", "statik", [A, Object.assign({}, A, { id: "zz", a: (A.a + 1) % 5 })])]);
  assert.equal(p.basarili, false); assert.equal(p.catisma[0].tur, "cevap_farki_kopya");
});

test("12) rk: aralıkta, ikinci göçte değişmez; doldurmada mevcut rk korunur", async () => {
  const db = await yeniDb({ legacy: 3 }); await soruKanonikSema(d1Yerel(db));
  const k = [kaynak("a", "statik", Array.from({ length: 20 }, (_, i) => sentetik("r-" + i, i)))];
  await uygula(db, await planla({ kaynaklar: k, mevcut: satirlariOku(db), dersler: DERS, beklenen: SERBEST })); /* gerçek rkUret */
  const once = db.prepare("SELECT id, rk FROM soru ORDER BY id").all();
  for (const r of once) assert.ok(Number.isInteger(r.rk) && r.rk >= 0 && r.rk <= 2147483647);
  assert.ok(new Set(once.map(r => r.rk)).size > 15, "rastgele dağılım");
  for (let i = 0; i < 3; i++) await uygula(db, await planla({ kaynaklar: k, mevcut: satirlariOku(db), dersler: DERS, beklenen: SERBEST }));
  assert.deepEqual(db.prepare("SELECT id, rk FROM soru ORDER BY id").all(), once, "rk hiç değişmedi");
  db.prepare("UPDATE soru SET kaynak = NULL WHERE id = 'ok-001'").run(); /* kısmi satır: rk dolu kalır */
  const rk1 = db.prepare("SELECT rk FROM soru WHERE id = 'ok-001'").get().rk;
  await uygula(db, await planla({ kaynaklar: k, mevcut: satirlariOku(db), dersler: DERS, beklenen: SERBEST, rk: () => 5 })); assert.equal(db.prepare("SELECT rk FROM soru WHERE id = 'ok-001'").get().rk, rk1);
});

test("13) Pilot 100: tam 100 kimlik taşınır, içerik özeti önce/sonra aynı; eksik/fazla pilot sapma sayılır", async () => {
  const db = await yeniDb({ legacy: 2 }); await soruKanonikSema(d1Yerel(db));
  const pil = Array.from({ length: 100 }, (_, i) => sentetik("AKE-YKS-PILOT-" + String(i).padStart(3, "0"), i));
  const K = p => [kaynak("pilot-100", "statik", p)];
  const p = await plan(db, K(pil)); assert.equal(p.basarili, true); assert.deepEqual([p.pilot.kaynak_id, p.pilot.hedef_id, p.pilot.eksik], [100, 100, 0]);
  await uygula(db, p); assert.equal(say(db, "id LIKE 'AKE-YKS-PILOT-%'"), 100);
  const p2 = await plan(db, K(pil)); assert.equal(p2.pilot.icerik_hash_once, p.pilot.icerik_hash_once);
  const eksik = await plan(db, K(pil.slice(0, 99))); assert.equal(eksik.basarili, false); assert.equal(eksik.sapma[0].tur, "pilot_eksik");
});

test("14) geçersiz soru sessizce atlanmaz: raporlanır, uygulama durur, hiçbir şey yazılmaz", async () => {
  const db = await yeniDb(); await soruKanonikSema(d1Yerel(db));
  const kotu = [sentetik("k1", 1, { o: ["a", "b", "c", "d"] }), sentetik("k2", 2, { a: 7 }), sentetik("k3", 3, { x: "  " }), sentetik("k4", 4, { o: ["a", "a", "b", "c", "d"] }), sentetik("k5", 5, { d: 9 }), sentetik("k6", 6, { s: "yok-ders" }), sentetik("k7", 7, { p: 5 }), sentetik("k8", 8, { q: "" })];
  const p = await plan(db, [kaynak("a", "statik", [sentetik("iyi", 0), ...kotu])]);
  assert.equal(p.basarili, false); assert.equal(p.sayim.invalid, 8); assert.deepEqual(p.gecersiz.map(g => g.id).sort(), ["k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8"]);
  await assert.rejects(() => uygula(db, p), /reddedildi/); assert.equal(say(db), 0, "geçerli soru da yazılmadı");
  assert.ok(dogrulaSoru(sentetik("ok", 1), DERS).length === 0);
});

test("15) rapor ve manifest soru metni/seçenek/a/x içermez; yalnız sayı, kimlik ve hash", async () => {
  const db = await yeniDb({ legacy: 2 }); await soruKanonikSema(d1Yerel(db));
  const p = await plan(db, [kaynak("a", "statik", [sentetik("m1", 1), sentetik("m2", 2)])]); const metin = JSON.stringify(rapor(p));
  assert.ok(!/SENTETIK-(SORU|SIK|COZUM)/.test(metin), "rapor soru içeriği taşımamalı");
  for (const ad of ["a", "existing_d1"]) { const m = p.manifest[ad]; assert.deepEqual(Object.keys(m).sort(), ["cevap_hash", "icerik_hash", "id_hash", "sayi"]); assert.match(m.id_hash, /^[0-9a-f]{64}$/); }
  /* aracın dosya çıktısı: --manifest repo içine yazamaz; varsayılan hiçbir dosya yazmaz */
  const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const { spawnSync } = await import("node:child_process"); const ic = spawnSync(process.execPath, ["fabrika/soru-migrate.mjs", "--manifest", path.join(kok, "m.json")], { cwd: kok, encoding: "utf8" });
  assert.equal(ic.status, 2); assert.ok(!fs.existsSync(path.join(kok, "m.json")));
  const uzak = spawnSync(process.execPath, ["fabrika/soru-migrate.mjs", "--apply"], { cwd: kok, encoding: "utf8" }); assert.equal(uzak.status, 2, "--apply yerel --db olmadan reddedilir (uzak D1'e bağlanmaz)");
});

test("kanonik özet: normalize (boşluk/Unicode), şık SIRASI özeti değiştirir, a/x özete girmez, p yoksa=boş", async () => {
  const q = sentetik("h1", 1), h = await kanonikHash(q);
  assert.equal(await kanonikHash(Object.assign({}, q, { q: "  " + q.q.replace(/-/g, "-  ") + " " })), await kanonikHash(Object.assign({}, q, { q: q.q.replace(/-/g, "-  ") })), "boşluk farkı normalize");
  assert.equal(await kanonikHash(Object.assign({}, q, { a: 4, x: "BASKA", id: "baska", t: "baska" })), h, "a/x/id/konu özete girmez");
  assert.notEqual(await cevapHash(Object.assign({}, q, { a: (q.a + 1) % 5 })), await cevapHash(q), "cevap özeti a/x'i yakalar");
  assert.notEqual(await kanonikHash(Object.assign({}, q, { o: [...q.o].reverse() })), h, "şık sırası değişirse içerik farklı");
  assert.equal(await kanonikHash(Object.assign({}, q, { p: "" })), await kanonikHash(Object.assign({}, q, { p: undefined })), "p yok = boş");
  assert.notEqual(await kanonikHash(Object.assign({}, q, { p: "SENTETIK-PASAJ" })), h);
  assert.equal(JSON.stringify(Object.keys(JSON.parse(govdeOf(q)))), '["q","o"]'); assert.equal(JSON.stringify(Object.keys(JSON.parse(govdeOf(Object.assign({}, q, { p: "P" }))))), '["p","q","o"]');
  assert.equal(normalize("é"), "é");
});

test("canlı davranışı değiştirmez: kanonik modülü yalnız bayrak-kapılı lib/soru-api.js içe aktarır, functions/ dosyaları doğrudan içe aktarmaz; göç durumu 'banka' legacy uçlara görünmez", async () => {
  const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."), tara = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? tara(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of [...tara(path.join(kok, "functions")), ...tara(path.join(kok, "lib")).filter(x => !x.endsWith("soru-kanonik.js") && !x.endsWith("soru-api.js"))]) assert.ok(!/soru-kanonik|soru-migrate/.test(fs.readFileSync(f, "utf8")), f + " yeni modülü içe aktarıyor");
  assert.ok(!/soru-kanonik|soru-migrate/.test(fs.readFileSync(path.join(kok, "index.html"), "utf8")));
  assert.equal(DURUM_BANKA, "banka"); const sorular = fs.readFileSync(path.join(kok, "functions/api/sorular.js"), "utf8"); assert.ok(/durum = 'onayli'/.test(sorular), "legacy uç yalnız 'onayli' okur");
});
