// PR 4 · D1 göç operasyon hattı: yerel SQLite ile staging provası (production'a/ağa HİÇ bağlanmaz).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { sqliteSurucu, calistir, preflight, kimlikDogrula, HardStop, saltOkunur, yedekAl, yedekOku, onayBelirteci, kapilariDegerlendir, cloudflareSurucu, uygula, dogrula, satirlariOku } from "../fabrika/soru-d1-migrate.mjs";
import { planla } from "../fabrika/soru-migrate.mjs";
import { kaynaklar as kaynakUret, legacyDb, legacyEkle, soru, izle, yeni, say, sutunlar } from "./yardim/d1-gocu.mjs";

const K = kaynakUret();
const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), "ake-d1-"));
const dosya = ad => path.join(DIZIN, ad + "-" + Math.random().toString(36).slice(2));
const sessiz = () => { const s = []; const f = m => s.push(m); f.satirlar = s; return f; };
const ORTAM = "staging", URETIM = "prod-id-0000000000";
const kos = (T, secenek = {}, ek = {}) => { const c = sessiz(); return calistir({ surucu: T.surucu, ortam: ORTAM, beklenen: T.kimlik, uretimId: URETIM, secenek, kaynaklar: K, cikti: c, ...ek }).then(s => ({ ...s, cikti: c.satirlar })); };
/* tam apply: yedek al → dry-run (belirteç) → apply */
async function tamApply(T, ek = {}, parca) {
  const f = dosya("yedek"), y = await kos(T, { yedekCikis: f });
  const d = await kos(T, { yedekDosya: f }), belirtec = d.kapilar.belirtec, n = d.preflight.mevcut_toplam;
  return kos(T, { apply: true, confirm: belirtec, beklenenOnSayim: n, freeze: true, yedekDosya: f, kurtarmaManifest: dosya("kurtarma"), parca, ...ek });
}

test("1) yanlış DB kimliği / ortam → HARD STOP (hiçbir şey okunmaz/yazılmaz)", async () => {
  const T = yeni(legacyDb()), iz = izle(T.surucu);
  await assert.rejects(() => kimlikDogrula({ surucu: T.surucu, ortam: "staging", beklenen: { id: "baska", name: "stg-db" }, uretimId: URETIM }), HardStop);
  await assert.rejects(() => kimlikDogrula({ surucu: T.surucu, ortam: "staging", beklenen: { id: T.kimlik.id, name: "baska-ad" }, uretimId: URETIM }), HardStop);
  await assert.rejects(() => kimlikDogrula({ surucu: T.surucu, ortam: "production", beklenen: T.kimlik, uretimId: URETIM }), /ÜRETİM|üretim/);   // production etiketi ama üretim kimliği değil
  await assert.rejects(() => kimlikDogrula({ surucu: T.surucu, ortam: "production", beklenen: T.kimlik, uretimId: "" }), HardStop);          // üretim kimliği tanımsız
  await assert.rejects(() => kimlikDogrula({ surucu: T.surucu, ortam: "staging", beklenen: T.kimlik, uretimId: T.kimlik.id }), /ÜRETİM/);   // staging etiketi ama bu DB üretim
  await assert.rejects(() => kimlikDogrula({ surucu: T.surucu, ortam: "staging", beklenen: {}, uretimId: URETIM }), HardStop);
  await assert.rejects(() => kos(T, {}, { beklenen: { id: "x", name: "y" } }), HardStop);
  assert.equal(iz.sql.length, 0); assert.equal(iz.yazma, 0);
});
test("2-3) varsayılan komut ve dry-run: yazma 0, şema değişmez, kanonik kolon eklenmez", async () => {
  const T = yeni(legacyDb()), iz = izle(T.surucu), once = sutunlar(T.db), n0 = say(T.db);
  const r = await kos(T, {}); assert.equal(r.cikis, 0); assert.equal(iz.yazma, 0); assert.equal(iz.batch, 0);
  assert.deepEqual(sutunlar(T.db), once); assert.equal(say(T.db), n0); assert.equal(r.preflight.mevcut_toplam, 89);
  const bos = spawnSync("node", ["fabrika/soru-d1-migrate.mjs"], { encoding: "utf8" }); assert.equal(bos.status, 2); assert.match(bos.stderr, /Kullanım/);   // bayraksız: bağlanmaz
  const salt = saltOkunur(T.surucu.d1); for (const sql of ["INSERT INTO soru (id) VALUES ('x')", "UPDATE soru SET s='x'", "ALTER TABLE soru ADD COLUMN z TEXT", "CREATE INDEX i ON soru(s)", "DELETE FROM soru", "DROP TABLE soru", "SELECT 1; DROP TABLE soru"]) assert.throws(() => salt.prepare(sql), /SALT-OKUMA/);
  assert.equal(salt.sayac.engellenen, 7);
});
test("4) apply onaysız/eksik kapılarla RED: yazma 0 (confirm yok, freeze yok, yanlış ön sayım, yanlış belirteç, yedek yok)", async () => {
  const T = yeni(legacyDb()), f = dosya("yedek"); await kos(T, { yedekCikis: f });
  const d = await kos(T, { yedekDosya: f }), b = d.kapilar.belirtec, n = d.preflight.mevcut_toplam, iz = izle(T.surucu);
  const temel = { apply: true, confirm: b, beklenenOnSayim: n, freeze: true, yedekDosya: f, kurtarmaManifest: dosya("kurtarma") };
  for (const [ad, ek] of [["confirm yok", { confirm: null }], ["yanlış belirteç", { confirm: "0".repeat(20) }], ["freeze yok", { freeze: false }], ["ön sayım yok", { beklenenOnSayim: null }], ["ön sayım yanlış", { beklenenOnSayim: n + 1 }], ["yedek yok", { yedekDosya: null }], ["kurtarma manifesti yok", { kurtarmaManifest: null }]]) {
    const r = await kos(T, { ...temel, ...ek }); assert.equal(r.cikis, 1, ad); assert.ok(r.cikti.some(l => /APPLY REDDEDİLDİ/.test(l)), ad);
  }
  assert.equal(iz.yazma, 0); assert.equal(say(T.db), 89); assert.ok(!sutunlar(T.db).includes("h"));
});
test("5-6) conflict ve invalid → apply RED (kapılar geçse bile plan başarısız)", async () => {
  for (const [ad, ek] of [["conflict", (db) => legacyEkle(db, { ...soru("emb-3", 3), a: 4 })], ["invalid", (db) => db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES ('ok-bozuk','mat','T',1,'{bozuk','onayli',1,1)").run()]]) {
    const T = yeni(legacyDb(89, { ek: db => ek(db) })), iz = izle(T.surucu), r = await tamApply(T);
    assert.equal(r.cikis, 1, ad); assert.equal(iz.yazma, 0, ad); assert.equal(say(T.db), 90, ad); assert.ok(!sutunlar(T.db).includes("h"), ad);
    assert.ok(r.preflight.conflict + r.preflight.invalid >= 1, ad);
  }
});
test("7) beklenen sayı uyuşmazlığı (kaynak sapması) → red", async () => {
  const T = yeni(legacyDb()), bozuk = kaynakUret(); bozuk[1].sorular.pop();
  const c = sessiz(), r = await calistir({ surucu: T.surucu, ortam: ORTAM, beklenen: T.kimlik, uretimId: URETIM, secenek: {}, kaynaklar: bozuk, cikti: c });
  assert.equal(r.cikis, 1); assert.ok(r.preflight.sapma >= 1);
});
test("8-9) staging mutlu yol: 89 legacy + 1127 → 1216; ikinci apply idempotent no-op; Pilot 100; legacy korunur; banka durumu", async () => {
  const T = yeni(legacyDb()), once = T.db.prepare("SELECT id, json, durum, tarih, karar FROM soru ORDER BY id").all(), legacyApi = T.db.prepare("SELECT json FROM soru WHERE durum='onayli' ORDER BY id").all();
  const r = await tamApply(T); assert.equal(r.cikis, 0, r.cikti.join("\n")); assert.equal(say(T.db), 1216);
  assert.equal(r.preflight.beklenen_final, 1216); assert.ok(r.dogrulama.ok, JSON.stringify(r.dogrulama.kontroller.filter(k => !k.ok)));
  assert.equal(say(T.db, "WHERE durum='banka'"), 1127); assert.equal(say(T.db, "WHERE id LIKE 'AKE-YKS-PILOT-%'"), 100);   // 14) statik = banka, 12) Pilot 100
  assert.equal(say(T.db, "WHERE h IS NULL OR govde IS NULL OR a IS NULL OR x IS NULL OR rk IS NULL OR kaynak IS NULL"), 0);
  for (const o of once) { const s = T.db.prepare("SELECT id, json, durum, tarih, karar FROM soru WHERE id = ?").get(o.id); assert.deepEqual(s, o); }   // 13) legacy aynen
  assert.deepEqual(T.db.prepare("SELECT json FROM soru WHERE durum='onayli' ORDER BY id").all(), legacyApi);                                          // 15) /api/sorular çıktısı aynı
  const rk1 = T.db.prepare("SELECT id, rk FROM soru ORDER BY id").all();
  const r2 = await tamApply(T); assert.equal(r2.cikis, 0); assert.equal(say(T.db), 1216); assert.equal(r2.preflight.yeni_ekleme, 0); assert.equal(r2.preflight.backfill, 0); assert.equal(r2.uygulama.ifade, 0);
  assert.deepEqual(T.db.prepare("SELECT id, rk FROM soru ORDER BY id").all(), rk1);   // rk değişmedi
});
test("11) duplicate politikası: legacy satır embedded ile aynı içerik → kopya_of embedded kanonik; çok-kopya; kaynak önceliği", async () => {
  const T = yeni(legacyDb(89, { ek: db => legacyEkle(db, { ...soru("emb-5", 5), id: "ok-kopya1" }) })); const r = await tamApply(T);
  assert.equal(r.cikis, 0, r.cikti.join("\n")); assert.equal(r.preflight.duplicate, 1);
  assert.equal(T.db.prepare("SELECT kopya_of FROM soru WHERE id='ok-kopya1'").get().kopya_of, "emb-5"); assert.equal(T.db.prepare("SELECT kopya_of FROM soru WHERE id='emb-5'").get().kopya_of, null);
  assert.equal(say(T.db), 1217); assert.equal(say(T.db, "WHERE kopya_of IS NOT NULL"), 1);
});
test("hazır canonical + id çakışması (aynı içerik): no-op; farklı yerde toplam dinamik", async () => {
  const T = yeni(legacyDb(89, { ek: db => legacyEkle(db, { ...soru("emb-9", 9) }) })); const r = await tamApply(T);   // id overlap, aynı içerik: backfill
  assert.equal(r.cikis, 0); assert.equal(r.preflight.id_cakisma, 1); assert.equal(r.preflight.mevcut_toplam, 90); assert.equal(say(T.db), 1216);
  assert.equal(r.preflight.beklenen_final, 90 + 1126);   // 1216 sabit değil: dinamik
});
test("10) parça hatası → güvenli yeniden deneme (kısmi yazım sonrası tekrar tam sonuca ulaşır; mükerrer yok; legacy çalışır)", async () => {
  const T = yeni(legacyDb()), legacyApi = T.db.prepare("SELECT json FROM soru WHERE durum='onayli' ORDER BY id").all();
  const iz = izle(T.surucu, { batchHata: (n, arr) => n >= 6 });   // 3.+ parçada kalıcı hata (sicrama 3 deneme de başarısız)
  const r = await tamApply(T, {}, 10).catch(e => e); assert.ok(r instanceof Error && /parça \d+\/\d+ başarısız/.test(r.message) && /güvenlidir/.test(r.message));
  const yarim = say(T.db); assert.ok(yarim > 89 && yarim < 1216, "yarım durum: " + yarim);
  assert.deepEqual(T.db.prepare("SELECT json FROM soru WHERE durum='onayli' AND json IS NOT NULL AND id LIKE 'ok-%' ORDER BY id").all().map(x => x.json), legacyApi.map(x => x.json));   // legacy etkilenmedi
  assert.equal(T.db.prepare("SELECT COUNT(*) n FROM soru WHERE durum='onayli'").get().n, 80);   // /api/sorular'ın gördüğü satırlar aynı
  /* hata enjeksiyonu olmayan yeni sürücüyle aynı veritabanında yeniden dene */
  const T3 = { db: T.db, surucu: sqliteSurucu(T.db, T.kimlik), kimlik: T.kimlik };
  const r2 = await tamApply(T3, {}, 10); assert.equal(r2.cikis, 0, r2.cikti.join("\n")); assert.equal(say(T.db), 1216); assert.equal(say(T.db, "WHERE kopya_of IS NOT NULL"), 0); assert.ok(r2.dogrulama.ok);
  assert.equal(T.db.prepare("SELECT COUNT(*) n FROM (SELECT id FROM soru GROUP BY id HAVING COUNT(*) > 1)").get().n, 0);
});
test("parça boyutu sınırı: en çok 50 ifade/batch; istenen daha büyükse kırpılır", async () => {
  const T = yeni(legacyDb()), boyut = []; const iz = izle(T.surucu, { batchHata: (n, arr) => { boyut.push(arr.length); return false; } });
  const r = await tamApply(T, {}, 9999); assert.equal(r.cikis, 0); assert.ok(Math.max(...boyut) <= 50, JSON.stringify(boyut)); assert.ok(boyut.length > 20);
});
test("16-17) yedek: sır içermez, repo dışı, 0600, üzerine yazmaz; loglar soru metni dökmez", async () => {
  const T = yeni(legacyDb()), f = dosya("yedek"), c = sessiz();
  const r = await calistir({ surucu: T.surucu, ortam: ORTAM, beklenen: T.kimlik, uretimId: URETIM, secenek: { yedekCikis: f }, kaynaklar: K, cikti: c });
  assert.equal((fs.statSync(f).mode & 0o777), 0o600); const m = yedekOku(f); assert.equal(m.meta.satir_sayisi, 89); assert.match(m.sha256, /^[0-9a-f]{64}$/);
  assert.ok(!/token|secret|gizli|CLOUDFLARE|AKE_GIZLI|@/i.test(JSON.stringify(m.meta)));
  await assert.rejects(() => yedekAl({ d1: T.surucu.d1, kimlik: T.kimlik, ortam: ORTAM, yol: f }), /zaten var/);
  await assert.rejects(() => yedekAl({ d1: T.surucu.d1, kimlik: T.kimlik, ortam: ORTAM, yol: path.resolve("yedek-repo.json") }), /repo DIŞINDA/);
  const tum = c.satirlar.join("\n") + JSON.stringify(r.preflight); assert.ok(!/SENTETIK-(KOK|SIK|COZUM)/.test(tum), "log soru metni içeriyor");
  const ap = await tamApply(yeni(legacyDb())); assert.ok(!/SENTETIK-(KOK|SIK|COZUM)/.test(ap.cikti.join("\n")));
});
test("yedekten sonra veri değişirse (admin yazdı) apply RED; yedek başka DB'den ise RED", async () => {
  const T = yeni(legacyDb()), f = dosya("yedek"); await kos(T, { yedekCikis: f }); const d = await kos(T, { yedekDosya: f });
  legacyEkle(T.db, soru("ok-sonradan", 5000));   // admin yazımı (dondurma ihlali)
  const iz = izle(T.surucu), d2 = await kos(T, { yedekDosya: f }), r = await kos(T, { apply: true, confirm: d.kapilar.belirtec, beklenenOnSayim: 90, freeze: true, yedekDosya: f, kurtarmaManifest: dosya("kurtarma") });
  assert.equal(r.cikis, 1); assert.equal(iz.yazma, 0); assert.ok(r.kapilar.kapilar.some(k => !k.ok && /durum hash|yedek satır sayısı/.test(k.ad)));
});
test("18) migration AKE_SORU_V2'yi / ortam değişkenlerini değiştirmez; yalnız soru tablosu + soru_sec indeksleri", async () => {
  const env0 = JSON.stringify(process.env), T = yeni(legacyDb()), iz = izle(T.surucu); const r = await tamApply(T); assert.equal(r.cikis, 0);
  assert.equal(JSON.stringify(process.env), env0); assert.ok(!process.env.AKE_SORU_V2);
  const yazan = iz.sql.filter(s => !/^\s*(SELECT|PRAGMA)/i.test(s)); assert.ok(yazan.every(s => /INSERT INTO soru |UPDATE soru |ALTER TABLE soru |CREATE (TABLE|INDEX) IF NOT EXISTS (soru|soru_h|soru_sec_)/.test(s)), yazan.filter(s => !/INSERT INTO soru |UPDATE soru /.test(s)).join(" | "));
  assert.ok(!iz.sql.some(s => /DROP|DELETE|soru_oturum|ake_gizli|ayar|kod /i.test(s)));   // yıkıcı/ilgisiz SQL yok
  assert.equal(r.cikti.at(-1).includes("AKE_SORU_V2 DEĞİŞTİRİLMEDİ"), true);
});
test("Cloudflare REST sürücüsü (sahte fetch): token yalnız Authorization'da; hata mesajlarında/loglarda token yok; batch gövdesi", async () => {
  const TOK = "cf-sahte-token-ABCDEF123456", cagrilar = [];
  const fetchFn = async (url, o) => { cagrilar.push({ url, o }); const g = o.body ? JSON.parse(o.body) : null;
    if (url.endsWith("/database/dbid")) return new Response(JSON.stringify({ success: true, result: { uuid: "dbid", name: "stg" } }), { status: 200 });
    if (g && g.sql && /FAIL/.test(g.sql)) return new Response(JSON.stringify({ success: false, errors: [{ message: "hata " + TOK }] }), { status: 400 });
    return new Response(JSON.stringify({ success: true, result: (g.batch || [g]).map(() => ({ success: true, results: [{ n: 1 }], meta: { changes: 1 } })) }), { status: 200 }); };
  const s = cloudflareSurucu({ hesap: "hesap1", dbId: "dbid", token: TOK, fetchFn });
  assert.deepEqual(await s.kimlik(), { id: "dbid", name: "stg" });
  assert.deepEqual(await s.d1.prepare("SELECT 1 n").first(), { n: 1 }); await s.d1.batch([s.d1.prepare("UPDATE soru SET a = ?").bind(1), s.d1.prepare("UPDATE soru SET a = ?").bind(2)]);
  const e = await s.d1.prepare("SELECT FAIL").first().catch(x => x); assert.ok(e instanceof Error && !e.message.includes(TOK) && /\[gizli\]/.test(e.message));
  assert.ok(cagrilar.every(c => !c.url.includes(TOK) && !(c.o.body || "").includes(TOK)) && cagrilar.every(c => c.o.headers.authorization === "Bearer " + TOK));
  assert.equal(JSON.parse(cagrilar.at(-2).o.body).batch.length, 2);   // batch: tek istekte iki ifade
  assert.throws(() => cloudflareSurucu({ hesap: "", dbId: "x", token: "y" }), HardStop);
});
test("CLI: uzak mod token olmadan HARD STOP (exit 3), yanlış kullanım exit 2; hiçbir ağ çağrısı yok", async () => {
  const env = { ...process.env }; delete env.CLOUDFLARE_API_TOKEN; delete env.CLOUDFLARE_ACCOUNT_ID;
  const r = spawnSync("node", ["fabrika/soru-d1-migrate.mjs", "--remote", "--environment", "production", "--db-id", "x", "--db-name", "y"], { encoding: "utf8", env }); assert.equal(r.status, 3); assert.match(r.stderr, /HARD STOP/);
  assert.equal(spawnSync("node", ["fabrika/soru-d1-migrate.mjs", "--remote", "--local-db", "x"], { encoding: "utf8", env }).status, 2);
});
