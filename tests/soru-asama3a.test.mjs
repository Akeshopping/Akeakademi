// B4 Aşama 3A · cevap anahtarı güvenliği + gösterim bayrakları (os/fix) · yerel izole SQLite (Production/Preview D1'e dokunmaz)
// çalıştırma: node --test tests/soru-asama3a.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { kur, tohumla, sizintiBul, SORU_ANAHTARLARI } from "./yardim/soru-v2.mjs";
import { sizintiVar, SORU_IZINLI_ANAHTAR, SEMA_SQL, BAYRAK_HAZIR_ID } from "../lib/soru-api.js";
import { planla, uygula, dogrula, META_SQL } from "../fabrika/soru-bayrak-doldur.mjs";

const GOC = fs.readFileSync("migrations/0003_soru_meta.sql", "utf8");   // soru_meta şeması YALNIZ bu dosyada (API oluşturmaz)

const T = await kur(), { DB, api, giris, yeniIstek } = T;
await T.hazirla(); tohumla(DB, 120, { onek: "m", s: "mat", konular: ["K1", "K2"] }); tohumla(DB, 40, { onek: "f", s: "fizik" });
let e = 0; const yeni = async (paket) => { const k = await giris(`a3a${++e}@ornek.com`); if (paket) T.premiumYap(k.kid); return k; };
const iz = (t, id) => t.includes('COZUM-' + id + '"');   // sınırlayıcılı arama: "m-1" ile "m-10" öneki karışmasın
const sahip = r => (r.t || "").includes("COZUM-");
const oturum = (k, ek = {}) => api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 5, ders: "mat", ...ek } });
const YASAK = ["a", "x", "h", "rk", "json", "kopya_of", "kaynak", "govde"];
const bayrakYaz = (id, o, f) => DB.db.prepare("INSERT INTO soru_meta (id, os, fix) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET os = excluded.os, fix = excluded.fix").run(id, o, f);
const metaVar = () => DB.db.prepare("SELECT name FROM sqlite_master WHERE name = 'soru_meta'").all().length > 0;

/* ---- 1) oturum başlamadan / cevap verilmeden: hiçbir uçta anahtar yok ---- */
test("1) tüm okuma uçları (oturum, katalog, özet, sınav cevabı) çözüm/anahtar sızdırmaz — yapı + metin taraması", async () => {
  const k = await yeni(true);
  const pr = await oturum(k), ex = await oturum(k, { mod: "exam", adet: 10 });
  assert.equal(pr.s, 200); assert.equal(ex.s, 200);
  const yanitlar = [pr, ex];
  let sonra = null;
  for (let i = 0; i < 5; i++) { const r = await api("katalog?limit=50" + (sonra ? "&sonra=" + encodeURIComponent(sonra) : ""), { m: "GET", cookie: k.cookie }); assert.equal(r.s, 200); yanitlar.push(r); sonra = r.j.sonraki; if (!sonra) break; }
  yanitlar.push(await api("ozet", { m: "GET", cookie: k.cookie }));
  for (const q of ex.j.sorular.slice(0, 5)) yanitlar.push(await api("cevap", { cookie: k.cookie, govde: { oturum: ex.j.oturum, soru: q.id, secim: 2 } }));   // sınavda cevap: anahtar YOK
  for (const r of yanitlar) { assert.equal(r.s, 200); assert.deepEqual(sizintiBul(r.j, YASAK), []); assert.ok(!sahip(r)); }
  for (const r of yanitlar.filter(r => r.j && r.j.sorular)) for (const q of r.j.sorular) assert.ok(Object.keys(q).every(a => SORU_ANAHTARLARI.has(a)), Object.keys(q).join());
  assert.deepEqual(yanitlar.at(-1).j, { kaydedildi: true });
});

test("2) katalog oturum ister (401) ve a/x/h/rk/json/kopya_of/kaynak/govde içermez; kopya satır listelenmez", async () => {
  assert.equal((await api("katalog", { m: "GET" })).s, 401);
  assert.equal((await api("katalog", { m: "GET", cookie: "ake_s=" + "c".repeat(64) })).s, 401);
  const k = await yeni(); const r = await api("katalog?limit=1000", { m: "GET", cookie: k.cookie });
  assert.equal(r.s, 200); assert.ok(r.j.sorular.length >= 100); assert.deepEqual(sizintiBul(r.j, YASAK), []); assert.ok(!sahip(r));
  assert.equal(r.h.get("cache-control").includes("private"), true);
});

/* ---- 2) alıştırma / deneme akışı ---- */
test("3) alıştırma: anahtar yalnız o soruya cevap gönderilince gelir; diğer sorular kapalı kalır", async () => {
  const k = await yeni(true), o = await oturum(k); const [q1, q2] = o.j.sorular;
  const c = await api("cevap", { cookie: k.cookie, govde: { oturum: o.j.oturum, soru: q1.id, secim: 1 } });
  assert.equal(c.s, 200); assert.ok(iz(c.t, q1.id)); assert.ok(!iz(c.t, q2.id));
  const b = await api("bitir", { cookie: k.cookie, govde: { oturum: o.j.oturum } });   // cevaplanmamış sorular için anahtar verilmez
  assert.ok(iz(b.t, q1.id)); for (const q of o.j.sorular.slice(1)) assert.ok(!iz(b.t, q.id), q.id);
});
test("4) deneme: bitirmeden hiçbir yoldan anahtar yok; bitirince hepsi ve puan sunucuda hesaplanır; boş bırakılan da gösterilir", async () => {
  const k = await yeni(true), o = await oturum(k, { mod: "exam", adet: 8 }), ids = o.j.sorular.map(q => q.id);
  for (const id of ids.slice(0, 4)) assert.ok(!(await api("cevap", { cookie: k.cookie, govde: { oturum: o.j.oturum, soru: id, secim: 0 } })).t.includes("COZUM-"));
  const tekrar = await oturum(k, { mod: "exam", adet: 8 }); assert.notEqual(tekrar.j.oturum, o.j.oturum);   // yeni istek kimliği = yeni oturum; önceki hâlâ kapalı
  assert.ok(!tekrar.t.includes("COZUM-"));
  const b = await api("bitir", { cookie: k.cookie, govde: { oturum: o.j.oturum, cevaplar: ids.map((id, i) => ({ soru: id, secim: i < 6 ? 0 : null })) } });
  assert.equal(b.s, 200); assert.equal(b.j.dogru + b.j.yanlis + b.j.bos, 8); assert.equal(b.j.bos, 2);
  for (const id of ids) assert.ok(iz(b.t, id), id);
});
test("5) tekrarlanan istekler: aynı istek kimliği aynı oturumu verir (kota ikinci kez düşmez); bitir idempotent; farklı gövdeyle aynı kimlik 409", async () => {
  const k = await yeni(), g = { istek: yeniIstek(), mod: "exam", adet: 6, ders: "mat" };
  const a = await api("oturum", { cookie: k.cookie, govde: g }), b = await api("oturum", { cookie: k.cookie, govde: g });
  assert.equal(a.j.oturum, b.j.oturum); assert.deepEqual(a.j.sorular.map(q => q.id), b.j.sorular.map(q => q.id)); assert.equal(b.j.kota.kalan, a.j.kota.kalan);
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { ...g, adet: 7 } })).s, 409);
  const f1 = await api("bitir", { cookie: k.cookie, govde: { oturum: a.j.oturum } }), f2 = await api("bitir", { cookie: k.cookie, govde: { oturum: a.j.oturum, cevaplar: [{ soru: a.j.sorular[0].id, secim: 4 }] } });
  assert.deepEqual(f2.j, f1.j);   // bitmiş oturuma sonradan gelen cevaplar yok sayılır
});
test("6) başka kullanıcı: oturum/cevap/bitir/oturum tekrarı 404-409, anahtar sızmaz; yetkisiz 401", async () => {
  const A = await yeni(true), B = await yeni(true), g = { istek: yeniIstek(), mod: "practice", adet: 5, ders: "mat" };
  const o = await api("oturum", { cookie: A.cookie, govde: g }), id = o.j.sorular[0].id;
  for (const r of [await api("cevap", { cookie: B.cookie, govde: { oturum: o.j.oturum, soru: id, secim: 0 } }), await api("bitir", { cookie: B.cookie, govde: { oturum: o.j.oturum } })]) { assert.equal(r.s, 404); assert.ok(!sahip(r)); }
  const bg = await api("oturum", { cookie: B.cookie, govde: g }); assert.notEqual(bg.j.oturum, o.j.oturum);   // istek kimliği kullanıcıya özel
  for (const y of ["cevap", "bitir"]) assert.equal((await api(y, { govde: { oturum: o.j.oturum, soru: id, secim: 0 } })).s, 401);
  assert.equal((await api("cevap", { cookie: A.cookie, govde: { oturum: o.j.oturum, soru: "f-0", secim: 0 } })).s, 404);   // oturumda olmayan soru
});

/* ---- 3) savunma katmanı ---- */
test("7) sızıntı koruması (fail-closed): izin listesi dışı alan içeren soru listesi sızıntı sayılır", () => {
  assert.equal(sizintiVar([{ id: "1", s: "mat", t: "k", d: 1, q: "q", o: [] }]), false);
  assert.equal(sizintiVar([{ id: "1", q: "q", o: [], os: 1, fix: 1, p: "p" }]), false);
  for (const k of YASAK.concat(["dogru", "cozum", "secim"])) assert.equal(sizintiVar([{ id: "1", q: "q", o: [], [k]: 1 }]), true, k);
  assert.equal(sizintiVar([null]), true); assert.equal(sizintiVar([[]]), false);   // dizi nesne sayılır ama anahtarı yok; asıl koruma soruCikti izin listesi
  for (const k of YASAK) assert.ok(!SORU_IZINLI_ANAHTAR.has(k));
});

/* ---- 4) otomatik DDL YOK + soru_meta durumları: yok / boş / dolu ---- */
test("8) OTOMATİK DDL YOK: SEMA_SQL'de soru_meta yok; API istekleri soru_meta için CREATE/ALTER/DROP hazırlamaz; tablo hâlâ yok", async () => {
  assert.ok(!SEMA_SQL.some(s => /soru_meta/.test(s)));
  assert.ok(!/CREATE TABLE[^`"']*soru_meta/i.test(fs.readFileSync("lib/soru-api.js", "utf8").split("\n").filter(l => !l.trim().startsWith("//") && !l.trim().startsWith("/*") && !l.trim().startsWith("*")).join("\n")));
  const k = await yeni(true); DB.sayac.sql.length = 0;
  await oturum(k); await oturum(k, { mod: "exam", adet: 5 }); await api("katalog?limit=20", { m: "GET", cookie: k.cookie }); await api("ozet", { m: "GET", cookie: k.cookie });
  assert.deepEqual(DB.sayac.sql.filter(q => /^\s*(CREATE|ALTER|DROP)/i.test(q) && /soru_meta/.test(q)), []);
  assert.ok(DB.sayac.sql.some(q => /FROM soru_meta/.test(q)), "bayrak OKUNUR ama oluşturulmaz");
  assert.equal(metaVar(), false);
  const kolonlar = DB.db.prepare("PRAGMA table_info(soru)").all().map(r => r.name); assert.ok(!["os", "fix", "bayrak"].some(c => kolonlar.includes(c)));
});
test("9) soru_meta YOK: oturum + katalog 200 (çökmez), sorular verilir, bayrak: 'eksik' bildirilir, os/fix anahtarı yok, anahtar sızmaz", async () => {
  assert.equal(metaVar(), false);
  const k = await yeni(true);
  for (const r of [await oturum(k), await oturum(k, { mod: "exam", adet: 6 }), await api("katalog?limit=50", { m: "GET", cookie: k.cookie })]) {
    assert.equal(r.s, 200); assert.equal(r.j.bayrak, "eksik"); assert.ok(r.j.sorular.length > 0); assert.deepEqual(sizintiBul(r.j, YASAK), []); assert.ok(!sahip(r));
    assert.ok(r.j.sorular.every(q => !("os" in q) && !("fix" in q)));
  }
});
test("10) migration dosyası: yalnız soru_meta oluşturur (IF NOT EXISTS), UPDATE/DELETE/ALTER/DROP yok, tekrar çalıştırılabilir; araç aynı dosyayı kullanır", () => {
  const sql = GOC.split("\n").filter(l => !l.trim().startsWith("--")).join("\n");
  assert.ok(/CREATE TABLE IF NOT EXISTS soru_meta/.test(sql)); assert.ok(!/\b(ALTER|DROP|DELETE|UPDATE|INSERT|REPLACE|TRUNCATE)\b/i.test(sql));
  assert.deepEqual(sql.match(/CREATE TABLE/gi).length, 1); assert.equal(META_SQL, sql.trim());
  const d = new DatabaseSync(":memory:"); d.exec(GOC); d.exec(GOC); d.exec("INSERT INTO soru_meta (id, os, fix) VALUES ('a', 1, 0)"); d.exec(GOC);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM soru_meta").get().n, 1);   // tekrar çalıştırma veriyi silmez
});
test("11) soru_meta VAR ama BOŞ / işaret satırsız (yarım doldurma): bayrak 'eksik', satırlar gerçek sayılmaz, çökme yok", async () => {
  DB.db.exec(GOC);   // migration elle uygulandı (API değil)
  const k = await yeni(true);
  for (const r of [await oturum(k), await api("katalog?limit=50", { m: "GET", cookie: k.cookie })]) { assert.equal(r.s, 200); assert.equal(r.j.bayrak, "eksik"); assert.ok(r.j.sorular.every(q => !("os" in q) && !("fix" in q))); }
  bayrakYaz("m-3", 1, 0); bayrakYaz("m-4", 0, 1);   // satırlar var ama işaret (#doldu) yok → doldurma bitmedi/doğrulanmadı
  const r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", idler: ["m-3", "m-4", "m-5"] } });
  assert.equal(r.s, 200); assert.equal(r.j.bayrak, "eksik"); assert.ok(r.j.sorular.every(q => !("os" in q) && !("fix" in q)));
});
test("12) soru_meta DOLU + işaret satırı: bayrak 'hazir'; os/fix yalnız 1; bayraksız soruda anahtar yok; idempotent tekrar ve katalog aynı", async () => {
  const k = await yeni(true); bayrakYaz("m-3", 1, 0); bayrakYaz("m-4", 0, 1); bayrakYaz("m-5", 1, 1); bayrakYaz("m-6", 0, 0); bayrakYaz(BAYRAK_HAZIR_ID, 2, 2);
  const g = { istek: yeniIstek(), mod: "practice", idler: ["m-3", "m-4", "m-5", "m-6", "m-7"] };
  const a = await api("oturum", { cookie: k.cookie, govde: g }), b = await api("oturum", { cookie: k.cookie, govde: g });
  for (const r of [a, b]) {
    assert.equal(r.s, 200); assert.equal(r.j.bayrak, "hazir"); assert.deepEqual(sizintiBul(r.j, YASAK), []); const h = new Map(r.j.sorular.map(q => [q.id, q]));
    assert.deepEqual([h.get("m-3").os, h.get("m-3").fix], [1, undefined]); assert.deepEqual([h.get("m-4").os, h.get("m-4").fix], [undefined, 1]);
    assert.deepEqual([h.get("m-5").os, h.get("m-5").fix], [1, 1]); assert.ok(!("os" in h.get("m-6")) && !("fix" in h.get("m-6")) && !("os" in h.get("m-7")));
    assert.ok(![...h.keys()].includes(BAYRAK_HAZIR_ID));
  }
  const kat = await api("katalog?limit=1000", { m: "GET", cookie: k.cookie }), kh = new Map(kat.j.sorular.map(q => [q.id, q]));
  assert.equal(kat.j.bayrak, "hazir"); assert.equal(kh.get("m-5").os, 1); assert.equal(kh.get("m-5").fix, 1); assert.ok(!("os" in kh.get("m-6")));
});
test("13) tablo sonradan kaybolursa (DROP) soru yine verilir, durum 'eksik'; tekrar kurulunca 'hazir'", async () => {
  const k = await yeni(true), yedek = DB.db.prepare("SELECT id, os, fix FROM soru_meta").all();
  DB.db.exec("DROP TABLE soru_meta");
  try { const r = await oturum(k); assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 5); assert.equal(r.j.bayrak, "eksik"); assert.deepEqual(sizintiBul(r.j, YASAK), []); }
  finally { DB.db.exec(GOC); for (const y of yedek) bayrakYaz(y.id, y.os, y.fix); }
  assert.equal((await oturum(k)).j.bayrak, "hazir");
});
test("14) PUANLAMA metaveriden bağımsızdır: aynı seçim tablo yok / boş / dolu iken aynı doğru-yanlış ve aynı anahtarı verir (alıştırma + deneme); sızıntı yok", async () => {
  const k = await yeni(true), ids = ["m-3", "m-4", "m-5", "m-6"];
  const durumlar = { dolu: () => { }, bos: () => DB.db.exec("DELETE FROM soru_meta WHERE id = '" + BAYRAK_HAZIR_ID + "'"), yok: () => DB.db.exec("DROP TABLE soru_meta") };
  const yedek = DB.db.prepare("SELECT id, os, fix FROM soru_meta").all(), sonuc = {};
  try {
    for (const [ad, hazirla] of Object.entries(durumlar)) {
      hazirla();
      const pr = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", idler: ids } });
      assert.equal(pr.s, 200); const cevaplar = [];
      for (const [i, id] of ids.entries()) { const c = await api("cevap", { cookie: k.cookie, govde: { oturum: pr.j.oturum, soru: id, secim: i % 5 } }); cevaplar.push([c.j.dogru, c.j.a, c.j.x]); }
      const ex = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "exam", idler: ids } });
      for (const [i, id] of ids.entries()) assert.ok(!(await api("cevap", { cookie: k.cookie, govde: { oturum: ex.j.oturum, soru: id, secim: i % 5 } })).t.includes("COZUM-"));
      const b = await api("bitir", { cookie: k.cookie, govde: { oturum: ex.j.oturum, cevaplar: ids.map((id, i) => ({ soru: id, secim: i % 5 })) } });
      sonuc[ad] = { cevaplar, dogru: b.j.dogru, yanlis: b.j.yanlis, anahtar: b.j.sorular.map(q => [q.id, q.a, q.x]) };
    }
  } finally { DB.db.exec("DROP TABLE IF EXISTS soru_meta"); DB.db.exec(GOC); for (const y of yedek) bayrakYaz(y.id, y.os, y.fix); }
  assert.deepEqual(sonuc.bos, sonuc.dolu); assert.deepEqual(sonuc.yok, sonuc.dolu);
  for (const [i, id] of ids.entries()) { const idx = +id.split("-")[1]; assert.equal(sonuc.dolu.cevaplar[i][1], idx % 5); assert.equal(sonuc.dolu.cevaplar[i][2], "COZUM-" + id); }   // anahtarlar tohumdaki değerler: kimlik ve cevap DEĞİŞMEDİ
});

/* ---- 5) bayrak doldurma aracı (yerel) ---- */
function yerelDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE soru (id TEXT PRIMARY KEY, s TEXT, t TEXT, d INTEGER, json TEXT, durum TEXT, tarih INTEGER, karar INTEGER, kopya_of TEXT, govde TEXT, a INTEGER, x TEXT)");
  const ins = db.prepare("INSERT INTO soru (id, s, t, d, durum, kopya_of, govde, a, x) VALUES (?, 'mat', 'k', 1, 'banka', ?, '{}', 1, 'cozum')");
  ins.run("mat-1", null); ins.run("mat-2", null); ins.run("mat-3", "mat-1"); ins.run("mat-4", null);
  return db;
}
const tabloOzeti = db => crypto.createHash("sha256").update(JSON.stringify(db.prepare("SELECT * FROM soru ORDER BY id").all())).digest("hex");
test("15) bayrak doldurma: plan sayıları doğru; kopya kimliğin bayrağı kanonik kimliğe gider; eşleşmeyen raporlanır; `soru` tablosu değişmez", () => {
  const db = yerelDb(), once = tabloOzeti(db);
  const kaynak = [{ id: "mat-1", os: 1 }, { id: "mat-2", fix: 1 }, { id: "mat-3", fix: 1 }, { id: "yok-9", os: 1 }, { id: "mat-4" }, { id: "mat-4", os: 0, fix: 0 }];
  const { hedef, sayim } = planla(kaynak, db);
  assert.deepEqual(sayim, { kaynak_toplam: 6, bayrakli: 4, os: 2, fix: 2, eslesen: 3, kopyaya_yonlendirilen: 1, eslesmeyen: 1, hedef_satir: 2 });
  assert.deepEqual([...hedef.entries()].sort(), [["mat-1", { os: 1, fix: 1 }], ["mat-2", { os: 0, fix: 1 }]]);
  assert.equal(tabloOzeti(db), once);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'soru_meta'").all().length, 0);   // planlama (dry-run) hiçbir şey yazmaz
  uygula(db, hedef); assert.equal(tabloOzeti(db), once);   // uygulama yalnız soru_meta'ya yazar
  assert.deepEqual(db.prepare("SELECT id, os, fix FROM soru_meta ORDER BY id").all().map(r => ({ ...r })), [{ id: BAYRAK_HAZIR_ID, os: 1, fix: 2 }, { id: "mat-1", os: 1, fix: 1 }, { id: "mat-2", os: 0, fix: 1 }]);   // işaret satırı beklenen toplamları taşır
});
test("16) bayrak doldurma: tekrar çalıştırılabilir (aynı sonuç); eksik kaynakla çalıştırılırsa bayrak SİLİNMEZ, doğrulama başarısız olur ve işaret satırı değişmez", () => {
  const db = yerelDb(), tam = [{ id: "mat-1", os: 1, fix: 1 }, { id: "mat-2", fix: 1 }];
  const i1 = uygula(db, planla(tam, db).hedef), i2 = uygula(db, planla(tam, db).hedef); assert.deepEqual(i1, i2);
  const once = db.prepare("SELECT * FROM soru_meta ORDER BY id").all().map(r => ({ ...r }));
  assert.throws(() => uygula(db, planla([{ id: "mat-1", fix: 1 }], db).hedef), /doğrulama başarısız/);   // kaynak eksik: tablo fazlalığı/farkı yakalanır
  assert.throws(() => uygula(db, new Map([["mat-1", { os: 0, fix: 0 }]])), /doğrulama başarısız/);
  assert.deepEqual(db.prepare("SELECT * FROM soru_meta ORDER BY id").all().map(r => ({ ...r })), once);   // hiçbir bayrak/işaret değişmedi
  assert.equal(META_SQL, GOC.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim());   // araç ile migration aynı şema
});
test("16b) doğrulama: tablo yok / eksik / fazla / farklı / işaret toplamı uyuşmaz → tamam=false; birebir → true; işaret YALNIZ doğrulamadan sonra yazılır", () => {
  const db = yerelDb(), hedef = planla([{ id: "mat-1", os: 1 }, { id: "mat-2", fix: 1 }], db).hedef;
  assert.deepEqual([dogrula(db, hedef).tamam, dogrula(db, hedef).tablo], [false, false]);
  db.exec(GOC); assert.deepEqual(dogrula(db, hedef).eksik.sort(), ["mat-1", "mat-2"]);
  db.exec("INSERT INTO soru_meta VALUES ('mat-1', 1, 0), ('mat-2', 1, 0)"); const d = dogrula(db, hedef); assert.deepEqual([d.tamam, d.farkli], [false, ["mat-2"]]);
  db.exec("UPDATE soru_meta SET os = 0, fix = 1 WHERE id = 'mat-2'"); db.exec("INSERT INTO soru_meta VALUES ('mat-4', 0, 1)"); assert.deepEqual(dogrula(db, hedef).fazla, ["mat-4"]);
  db.exec("DELETE FROM soru_meta WHERE id = 'mat-4'"); assert.equal(dogrula(db, hedef).tamam, true); assert.equal(dogrula(db, hedef).isaret, false);
  db.exec("INSERT INTO soru_meta VALUES ('" + BAYRAK_HAZIR_ID + "', 9, 9)"); assert.equal(dogrula(db, hedef).tamam, false);   // işaret toplamları kaynakla uyuşmuyor
  const db2 = yerelDb(); db2.exec(GOC); db2.exec("INSERT INTO soru_meta VALUES ('mat-1', 0, 1)");   // yarım/hatalı tablo: uygula doğrulayamaz → işaret YAZILMAZ
  assert.throws(() => uygula(db2, planla([{ id: "mat-1", os: 1 }], db2).hedef), /doğrulama başarısız/); assert.equal(db2.prepare("SELECT COUNT(*) AS n FROM soru_meta WHERE id = ?").get(BAYRAK_HAZIR_ID).n, 0);
});
test("17) bayrak doldurma CLI: --remote HARD STOP; --local-db zorunlu; dry-run dosyaya yazmaz; çıktıda soru metni yok", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bayrak-")), f = path.join(d, "y.sqlite"), emb = path.join(d, "e.json");
  const db = new DatabaseSync(f); db.exec("CREATE TABLE soru (id TEXT PRIMARY KEY, kopya_of TEXT)"); db.prepare("INSERT INTO soru (id) VALUES ('mat-1')").run(); db.close();
  fs.writeFileSync(emb, JSON.stringify([{ id: "mat-1", os: 1, q: "GIZLI-SORU-METNI" }]));
  const cli = (...a) => spawnSync(process.execPath, ["fabrika/soru-bayrak-doldur.mjs", ...a], { encoding: "utf8" });
  assert.equal(cli("--remote").status, 3); assert.equal(cli().status, 2);
  const kuru = cli("--local-db", f, "--embedded-json", emb); assert.equal(kuru.status, 0); assert.ok(/DRY RUN/.test(kuru.stdout)); assert.ok(!kuru.stdout.includes("GIZLI-SORU-METNI"));
  const d2 = new DatabaseSync(f); assert.equal(d2.prepare("SELECT name FROM sqlite_master WHERE name = 'soru_meta'").all().length, 0); d2.close();
  assert.equal(cli("--local-db", f, "--embedded-json", emb, "--dogrula").status, 1);   // tablo yok → doğrulama başarısız
  const uy = cli("--local-db", f, "--embedded-json", emb, "--apply"); assert.equal(uy.status, 0); assert.ok(/APPLY/.test(uy.stdout));
  const d3 = new DatabaseSync(f); assert.equal(d3.prepare("SELECT COUNT(*) AS n FROM soru_meta").get().n, 2); d3.close();   // 1 bayrak + işaret satırı
  assert.equal(cli("--local-db", f, "--embedded-json", emb, "--dogrula").status, 0); fs.rmSync(d, { recursive: true });
});

/* ---- 6) eski yollar: bilinen açık ve kapatma anahtarı ---- */
test("20) eski /api/sorular: V2 açık + ESKI_KAPAT kapalıyken a/x İÇERİR (BİLİNEN AÇIK, Aşama 3C kapatır); ESKI_KAPAT=1 ile boş liste + no-store; V2 kapalıyken kapatma tek başına etkisiz", async () => {
  const sorular = await import("../functions/api/sorular.js"), get = env => sorular.onRequest({ request: new Request("https://akeakademi.com/api/sorular"), env });
  const K = await kur(); await K.hazirla();
  K.DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES ('ok-1', 'mat', 'K', 1, ?, 'onayli', 0, 1)").run(JSON.stringify({ id: "ok-1", s: "mat", t: "K", d: 1, q: "Sentetik soru", o: ["1", "2", "3", "4", "5"], a: 2, x: "SENTETIK-COZUM" }));
  const acik = await (await get(K.env)).json(); assert.ok(JSON.stringify(acik).includes("SENTETIK-COZUM"), "legacy yol bugün cevap anahtarı döndürür (açık)");
  const kapali = await get({ ...K.env, AKE_SORU_ESKI_KAPAT: "1" }), kj = await kapali.json();
  assert.deepEqual(kj.sorular, []); assert.equal(kapali.headers.get("cache-control"), "no-store"); assert.ok(!JSON.stringify(kj).includes("SENTETIK-COZUM"));
  const v2yok = await (await get({ DB: K.DB, AKE_SORU_ESKI_KAPAT: "1" })).json(); assert.ok(JSON.stringify(v2yok).includes("SENTETIK-COZUM"));   // V2 kapalıyken tek başına etkisiz (öğrenci ek soruları kaybolmasın)
});
test("21) istemci/SW: svBaslat sunucu os/fix bayrağını soruya taşır; sw.js /api/ ve /sorular/ asla önbelleğe almaz; sw kabuğu cevap anahtarlı JSON içermez", () => {
  const html = fs.readFileSync("index.html", "utf8"), sw = fs.readFileSync("sw.js", "utf8");
  assert.ok(html.includes("if (k.s.os) c.os = 1; if (k.s.fix) c.fix = 1;"));
  assert.ok(/pathname\.startsWith\("\/api\/"\)\) return/.test(sw) && /pathname\.startsWith\("\/sorular\/"\)\) return/.test(sw));
  assert.ok(!/SHELL\s*=\s*\[[^\]]*sorular\//.test(sw));
});
