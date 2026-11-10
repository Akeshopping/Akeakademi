// PR 4 düzeltme turu: kurtarma manifesti (ilk yazmadan ÖNCE), tablo/şema HARD STOP, REST sert doğrulama, Time Travel bookmark, runbook sırası.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { calistir, cloudflareSurucu, HardStop, sqliteSurucu, yapiDogrula } from "../fabrika/soru-d1-migrate.mjs";
import { kaynaklar as kaynakUret, legacyDb, izle, yeni, say, sutunlar } from "./yardim/d1-gocu.mjs";

const K = kaynakUret(), URETIM = "prod-id-0000000000";
const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), "ake-kur-")), dosya = ad => path.join(DIZIN, ad + "-" + Math.random().toString(36).slice(2));
const sessiz = () => { const s = []; const f = m => s.push(m); f.satirlar = s; return f; };
const kos = (T, secenek = {}, ek = {}) => { const c = sessiz(); return calistir({ surucu: T.surucu, ortam: "staging", beklenen: T.kimlik, uretimId: URETIM, secenek, kaynaklar: K, cikti: c, ...ek }).then(s => ({ ...s, cikti: c.satirlar })); };
async function hazir(T, ek = {}, ortam = "staging", sec = {}) {
  const f = dosya("yedek"); await kos(T, { yedekCikis: f }, { ortam }); const d = await kos(T, { yedekDosya: f }, { ortam });
  return { f, apply: { apply: true, confirm: d.kapilar.belirtec, beklenenOnSayim: d.preflight.mevcut_toplam, freeze: true, yedekDosya: f, kurtarmaManifest: dosya("kurtarma"), ...sec }, d };
}
const prodT = db => yeni(db, { id: URETIM, name: "prod-db" });
const bookmarkli = (T, bm = "bm-0000-pre-apply") => { T.surucu.bookmarkAl = async () => bm; return T; };

test("1) production + doğru kimlik + soru tablosu YOK → HARD STOP, yazma 0 (tablo kurulmaz)", async () => {
  const db = new DatabaseSync(":memory:"), T = prodT(db), iz = izle(T.surucu);
  await assert.rejects(() => kos(T, {}, { ortam: "production" }), e => e instanceof HardStop && /tablosu YOK/.test(e.message));
  await assert.rejects(() => kos(T, { apply: true }, { ortam: "production" }), HardStop);
  assert.equal(iz.yazma, 0); assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='soru'").get().n, 0);
  /* bootstrap yalnız YEREL ve AÇIK istekle */
  await assert.rejects(() => yapiDogrula(sqliteSurucu(db).d1), HardStop); assert.deepEqual(await yapiDogrula(sqliteSurucu(db).d1, { bootstrap: true }), { bootstrap: true });
});
test("2) production + soru tablosu var ama legacy kolon eksik (json/durum) → HARD STOP, yazma 0", async () => {
  for (const eksik of ["json", "durum", "karar"]) {
    const db = new DatabaseSync(":memory:"); const kol = ["id TEXT PRIMARY KEY", "s TEXT", "t TEXT", "d INTEGER", "json TEXT", "durum TEXT", "tarih INTEGER", "karar INTEGER"].filter(c => !c.startsWith(eksik + " "));
    db.exec(`CREATE TABLE soru (${kol.join(", ")})`); const T = prodT(db), iz = izle(T.surucu), once = sutunlar(db);
    await assert.rejects(() => kos(T, {}, { ortam: "production" }), e => e instanceof HardStop && e.message.includes(eksik)); assert.equal(iz.yazma, 0); assert.deepEqual(sutunlar(db), once);
  }
});
test("3) kurtarma manifesti olmadan apply BAŞLAYAMAZ (kapı RED, yazma 0, şema değişmez)", async () => {
  const T = yeni(legacyDb()), { apply } = await hazir(T), iz = izle(T.surucu);
  const r = await kos(T, { ...apply, kurtarmaManifest: null }); assert.equal(r.cikis, 1); assert.ok(r.kapilar.kapilar.some(k => !k.ok && /kurtarma manifesti/.test(k.ad)));
  assert.equal(iz.yazma, 0); assert.ok(!sutunlar(T.db).includes("h"));
  const repoIci = await kos(T, { ...apply, kurtarmaManifest: path.resolve("kurtarma-repo.json") }); assert.equal(repoIci.cikis, 1);   // repo içi yol reddedilir
});
test("4) kurtarma manifesti yazılamazsa (dizin yok / dosya zaten var) hiçbir DB yazması başlamaz — ALTER dahil", async () => {
  const T = yeni(legacyDb()), { apply } = await hazir(T), iz = izle(T.surucu);
  assert.equal((await kos(T, { ...apply, kurtarmaManifest: path.join(DIZIN, "yok-dizin", "m.json") })).cikis, 1);   // kapı: dizin yok
  const var_ = dosya("var"); fs.writeFileSync(var_, "x"); assert.equal((await kos(T, { ...apply, kurtarmaManifest: var_ })).cikis, 1); assert.equal(fs.readFileSync(var_, "utf8"), "x");   // üzerine yazılmaz
  /* kapıları geçip yazma anında hata: yol kapıdan sonra dolu hale gelir (yarış) */
  const yol = dosya("yaris"); const cik = sessiz(); let hata;
  const orj = fs.existsSync; fs.existsSync = p => (p === yol ? false : orj(p)); fs.writeFileSync(yol, "baska");
  try { await calistir({ surucu: T.surucu, ortam: "staging", beklenen: T.kimlik, uretimId: URETIM, secenek: { ...apply, kurtarmaManifest: yol }, kaynaklar: K, cikti: cik }); } catch (e) { hata = e; } finally { fs.existsSync = orj; }
  assert.ok(hata && /EEXIST|zaten var/.test(hata.message + hata.code), String(hata)); assert.equal(iz.yazma, 0); assert.ok(!sutunlar(T.db).includes("h")); assert.equal(say(T.db), 89); assert.equal(fs.readFileSync(yol, "utf8"), "baska");
});
test("5-6) parça hatası: kurtarma manifesti ZATEN var, planlanan ID'ler doğru, başarılı final manifest yok, status kısmi", async () => {
  const T = yeni(legacyDb()), { apply } = await hazir(T), iz = izle(T.surucu, { batchHata: n => n >= 6 }), manifestYol = apply.kurtarmaManifest, final = dosya("final");
  const r = await kos(T, { ...apply, parca: 10, manifestCikis: final }).catch(e => e); assert.ok(r instanceof Error && /güvenlidir/.test(r.message));
  assert.ok(fs.existsSync(manifestYol)); assert.ok(!fs.existsSync(final));   // final başarı manifesti yok
  const m = JSON.parse(fs.readFileSync(manifestYol, "utf8")); assert.equal(m.durum, "basarisiz_kismi_olabilir"); assert.equal((fs.statSync(manifestYol).mode & 0o777), 0o600);
  assert.equal(m.planlanan_ekleme_idleri.length, 1127); assert.equal(m.planlanan_backfill_idleri.length, 89); assert.equal(m.on_sayim, 89); assert.equal(m.beklenen_final, 1216);
  const yazilan = T.db.prepare("SELECT id FROM soru WHERE durum='banka'").all().map(x => x.id); assert.ok(yazilan.length > 0 && yazilan.length < 1127);
  assert.ok(yazilan.every(id => m.planlanan_ekleme_idleri.includes(id)), "DB'ye yazılan her ekleme planlanan ID'lerde");   // recovery mümkün
});
test("6b) kurtarma manifesti içeriği: planlanan ID'ler doğru, alanlar tam, soru metni YOK; başarıdan sonra completed", async () => {
  const T = yeni(legacyDb()), { apply } = await hazir(T), r = await kos(T, apply); assert.equal(r.cikis, 0, r.cikti.join("\n"));
  const m = JSON.parse(fs.readFileSync(apply.kurtarmaManifest, "utf8"));
  for (const a of ["surum", "durum", "olusturma", "veritabani_id", "veritabani_adi", "ortam", "on_sayim", "on_durum_hash", "yedek_sha256", "beklenen_final", "kaynak_sayilari", "planlanan_ekleme_idleri", "planlanan_backfill_idleri", "planlanan_kopya_of_idleri", "time_travel_bookmark"]) assert.ok(a in m, a);
  assert.equal(m.durum, "completed"); assert.ok(m.sonra && m.sonra.satir_sayisi === 1216);
  const eklenen = T.db.prepare("SELECT id FROM soru WHERE durum='banka' ORDER BY id").all().map(x => x.id); assert.deepEqual(m.planlanan_ekleme_idleri, eklenen);
  assert.ok(!/SENTETIK-(KOK|SIK|COZUM)/.test(JSON.stringify(m)), "manifest soru metni içeriyor");
});
test("10-11) Time Travel: bookmark kurtarma manifestine yazılır; production'da bookmark yoksa HARD STOP (hiç yazma/manifest yok)", async () => {
  const T = bookmarkli(prodT(legacyDb()), "bm-ABC-123"), { apply } = await hazir(T, {}, "production");
  const r = await kos(T, apply, { ortam: "production" }); assert.equal(r.cikis, 0, r.cikti.join("\n"));
  assert.equal(JSON.parse(fs.readFileSync(apply.kurtarmaManifest, "utf8")).time_travel_bookmark, "bm-ABC-123"); assert.ok(r.cikti.some(l => /bookmark: kaydedildi/.test(l)));
  for (const sur of [prodT(legacyDb()), (() => { const x = prodT(legacyDb()); x.surucu.bookmarkAl = async () => null; return x; })()]) {
    const h = await hazir(sur, {}, "production"), iz = izle(sur.surucu);
    await assert.rejects(() => kos(sur, h.apply, { ortam: "production" }), e => e instanceof HardStop && /bookmark/i.test(e.message));
    assert.equal(iz.yazma, 0); assert.ok(!fs.existsSync(h.apply.kurtarmaManifest)); assert.ok(!sutunlar(sur.db).includes("h"));
  }
});
test("10b) staging'de bookmark yoksa devam eder ama manifest bunu 'null' kaydeder (production'da zorunlu)", async () => {
  const T = yeni(legacyDb()), { apply } = await hazir(T), r = await kos(T, apply); assert.equal(r.cikis, 0);
  assert.equal(JSON.parse(fs.readFileSync(apply.kurtarmaManifest, "utf8")).time_travel_bookmark, null);
});

/* ---- Cloudflare REST: result[i].success / uzunluk / boş sonuç ---- */
const sahte = (yanit) => cloudflareSurucu({ hesap: "h", dbId: "dbid", token: "TOK-SAHTE-1234", fetchFn: async () => new Response(JSON.stringify(yanit), { status: 200 }) });
const ok = (n = 1, ek = {}) => ({ success: true, result: Array.from({ length: n }, () => ({ success: true, results: [{ n: 1 }], meta: { changes: 1 } })), ...ek });
test("7) batch: üst düzey success true ama result[1].success false → driver HATA", async () => {
  const s = sahte({ success: true, result: [{ success: true, results: [], meta: {} }, { success: false, error: "UNIQUE kısıtı TOK-SAHTE-1234" }, { success: true, results: [], meta: {} }] });
  const e = await s.d1.batch([1, 2, 3].map(() => s.d1.prepare("UPDATE soru SET a=1"))).catch(x => x); assert.ok(e instanceof Error && /#2 başarısız/.test(e.message) && !e.message.includes("TOK-SAHTE"));
});
test("8) batch: 3 ifade gönderildi, result uzunluğu 2 → HATA; result dizi değil → HATA", async () => {
  const e = await sahte(ok(2)).d1.batch([1, 2, 3].map(() => ({ _sql: "UPDATE soru SET a=1", _a: [] }))).catch(x => x); assert.ok(e instanceof Error && /3 sonuç beklendi, 2 geldi/.test(e.message));
  const e2 = await sahte({ success: true, result: {} }).d1.batch([{ _sql: "UPDATE soru SET a=1", _a: [] }]).catch(x => x); assert.ok(e2 instanceof Error && /bozuk/.test(e2.message));
});
test("9) tek sorgu: result [] → HATA; result[0].success false → HATA; success alanı yok → HATA", async () => {
  for (const y of [{ success: true, result: [] }, { success: true, result: [{ success: false, error: "x" }] }, { success: true, result: [{ results: [] }] }, { success: true, result: [null] }]) {
    const s = sahte(y); for (const f of [() => s.d1.prepare("SELECT 1").first(), () => s.d1.prepare("SELECT 1").all(), () => s.d1.prepare("UPDATE soru SET a=1").run()]) assert.ok((await f().catch(x => x)) instanceof Error);
  }
});
test("REST normal sonuç → PASS (first/all/run/batch/bookmark/kimlik)", async () => {
  const s = sahte(ok(1)); assert.deepEqual(await s.d1.prepare("SELECT 1").first(), { n: 1 }); assert.deepEqual((await s.d1.prepare("SELECT 1").all()).results, [{ n: 1 }]); assert.equal((await s.d1.prepare("UPDATE soru SET a=1").run()).meta.changes, 1);
  assert.equal((await sahte(ok(3)).d1.batch([1, 2, 3].map(() => ({ _sql: "x", _a: [] })))).length, 3);
  const b = cloudflareSurucu({ hesap: "h", dbId: "dbid", token: "T", fetchFn: async u => new Response(JSON.stringify({ success: true, result: u.endsWith("/time_travel/bookmark") ? { bookmark: "bm-1" } : { uuid: "dbid", name: "n" } }), { status: 200 }) });
  assert.equal(await b.bookmarkAl(), "bm-1"); assert.deepEqual(await b.kimlik(), { id: "dbid", name: "n" });
  const yok = cloudflareSurucu({ hesap: "h", dbId: "dbid", token: "T", fetchFn: async () => new Response(JSON.stringify({ success: false, errors: [{ message: "desteklenmiyor" }] }), { status: 400 }) }); assert.equal(await yok.bookmarkAl(), null);   // desteklenmiyor → null (HARD STOP çağıran tarafta)
});

/* ---- runbook sırası ve araç-V2 bağımsızlığı ---- */
test("12) runbook: AKE_SORU_V2 açılıp smoke edilmeden migration kilidi KALDIRILMAZ (A..M sırası); PR3 dokümanı çelişmez", () => {
  const d = fs.readFileSync("docs/soru-bankasi-production-migration.md", "utf8"), i = ad => { const k = d.indexOf(ad); assert.ok(k >= 0, ad + " yok"); return k; };
  const sira = ["PHASE A — ", "PHASE B — ", "PHASE C — ", "PHASE D — ", "PHASE E — ", "PHASE F — ", "PHASE G — ", "PHASE H — ", "PHASE I — ", "PHASE J — ", "PHASE K — ", "PHASE L — ", "PHASE M — "].map(i);
  assert.deepEqual([...sira].sort((a, b) => a - b), sira);
  const h = d.slice(sira[7], sira[8]), f = d.slice(sira[5], sira[6]), k = d.slice(sira[10], sira[11]);
  assert.match(f, /KİLİT AÇIK KALIR/i); assert.match(h, /AKE_SORU_V2=1/); assert.match(d.slice(sira[8], sira[9]), /kilit hâlâ açık/i); assert.match(k, /kilit|LOCK/i);
  const adimlar = d.slice(sira[0], sira[10]).split("\n").filter(l => /^\d+\. /.test(l));   // A..J'nin numaralı ADIMLARI: hiçbiri kilidi kaldırmaz
  assert.ok(adimlar.length >= 10 && !adimlar.some(l => /(LOCK|kilit)[^\n]*\b(sil|kaldır)/i.test(l)), "kilit K'dan önce kaldırılıyor");
  assert.match(d.slice(sira[10], sira[11]), /^\d+\. .*(sil|kaldır)/im);   // K adımı kaldırır
  assert.ok(sira[10] > sira[7] && sira[10] > sira[8] && sira[10] > sira[9]);
  const y = fs.readFileSync("docs/soru-bankasi-yazim.md", "utf8"); const v2 = y.search(/AKE_SORU_V2`? açılır/), kilitKaldir = y.search(/kili[td][^\n]*kaldırılır/i); assert.ok(v2 >= 0 && kilitKaldir > v2, "PR3 dokümanında kilit V2'den önce kalkıyor");
});
test("13) migration aracı AKE_SORU_V2'yi / ortamı hiçbir yolla değiştirmez (statik + çalışma zamanı)", async () => {
  const kod = fs.readFileSync("fabrika/soru-d1-migrate.mjs", "utf8").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/AKE_SORU_V2/.test(kod.replace(/"AKE_SORU_V2 DEĞİŞTİRİLMEDİ[^"]*"|`AKE_SORU_V2[^`]*`/g, "")), "kodda AKE_SORU_V2 geçiyor");
  assert.ok(!/process\.env(\.\w+|\[[^\]]+\])\s*=[^=]/.test(kod) && !/env\.\w+\s*=[^=]/.test(kod));
  const e0 = JSON.stringify(process.env), T = bookmarkli(yeni(legacyDb())), { apply } = await hazir(T); await kos(T, apply); assert.equal(JSON.stringify(process.env), e0);
});
