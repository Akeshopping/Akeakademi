// Haftalık veli raporu testleri · çalıştırma: node --test tests/veli-raporu.test.mjs
// Gerçek D1 yerine aynı SQL'i çalıştıran bellek içi SQLite kullanılır (node:sqlite). Gerçek veriye dokunmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { sema, kullaniciBulVeyaAc, oturumAc } from "../lib/ortak.js";
import * as V from "../lib/veli.js";
import { onRequest as yonetimIstek } from "../functions/api/yonetim/[[yol]].js";
import { onRequest as veliIstek } from "../functions/api/veli/[[yol]].js";

/* ---- D1 benzeri sarmalayıcı ---- */
function d1() {
  const db = new DatabaseSync(":memory:");
  const mk = (sql, a) => ({
    bind: (...x) => mk(sql, x),
    first: async () => db.prepare(sql).get(...a) || null,
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    _run: () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }
  });
  return { raw: db, prepare: sql => mk(sql, []), batch: async list => { db.exec("BEGIN"); try { const o = list.map(s => s._run()); db.exec("COMMIT"); return o; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}
const SEMA_SQL = [];
const SIMDI = Date.UTC(2026, 10, 8, 16, 0, 0); // Türkiye saatiyle 8 Kasım 2026 pazar 19:00
const gonderilen = []; let resendDurum = 200;
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("api.resend.com")) { const b = JSON.parse(opt.body); if (resendDurum === 200) gonderilen.push(b); return new Response("{}", { status: resendDurum }); }
  throw new Error("beklenmeyen ağ isteği " + url);
};
async function ortam(ek) {
  const db = d1(), env = Object.assign({ DB: db, AKE_GIZLI: "test-gizli", RESEND_API_KEY: "re_test", AKE_YONETICI: "yonetici@test.dev", VELI_RAPORU: "1" }, ek);
  db.raw.exec(readFileSync("migrations/0001_veli_raporu.sql", "utf8"));
  if (!SEMA_SQL.length) { const ham = db.prepare; db.prepare = q => { SEMA_SQL.push(q); return ham(q); }; await sema(env); db.prepare = ham; }
  else SEMA_SQL.forEach(q => db.raw.exec(q)); // sema() süreç başına bir kez çalışır; sonraki bellek içi veritabanlarına aynı tablolar uygulanır
  gonderilen.length = 0; resendDurum = 200; return env;
}
async function ogrenci(env, eposta, plan, bitis) {
  const kid = await kullaniciBulVeyaAc(env, { eposta, ad: "Deniz" });
  if (plan) await env.DB.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih) VALUES (?, ?, ?, ?, ?)").bind("K" + Math.random(), kid, plan, bitis || "2099-01-01", Date.now()).run();
  return kid;
}
const veriYaz = (env, kid, alan, o) => env.DB.prepare("INSERT INTO veri (kid, alan, json, u) VALUES (?, ?, ?, 1) ON CONFLICT (kid, alan) DO UPDATE SET json = excluded.json").bind(kid, alan, JSON.stringify(o)).run();
const tokenDon = ep => (ep.text.match(/[?&]t=([0-9a-f]+)/) || [])[1];
async function hazirOgrenci(env, plan = "premium") {
  const kid = await ogrenci(env, "ogr" + Math.random() + "@test.dev", plan);
  const r = await V.adresKaydet(env, kid, { eposta: "veli@test.dev", yas: "kucuk", ogrenciAd: "Deniz", origin: "https://akeakademi.com" }); assert.ok(r.ok, JSON.stringify(r));
  return { kid, tok: tokenDon(gonderilen.at(-1)) };
}
async function tamAkis(env, plan) { const o = await hazirOgrenci(env, plan); assert.ok((await V.onayVer(env, o.tok)).ok); assert.ok((await V.etkinDegistir(env, o.kid, true)).ok); return o; }
const STATS = { daily: { "2026-11-02": { q: 10, c: 7, tp: { "mat|Problemler": 6, "turkce|Paragraf": 4 } }, "2026-11-04": { q: 20, c: 10, tp: { "mat|Problemler": 20 } }, "2026-11-08": { q: 5, c: 5, tp: { "fizik|Kuvvet": 5 } }, "2026-10-28": { q: 30, c: 24, tp: { "mat|Problemler": 30 } } }, topic: { "mat|Problemler": [20, 36, 0], "fizik|Kuvvet": [5, 0, 0], "turkce|Paragraf": [3, 2, 0] } };

test("ücretsiz kullanıcı veli raporu açamaz; Atılım ve Premium açabilir; deneme planı ve süresi dolan paket açamaz", async () => {
  const env = await ortam(), g = { eposta: "veli@test.dev", yas: "kucuk", origin: "https://akeakademi.com" };
  assert.equal((await V.adresKaydet(env, await ogrenci(env, "u@test.dev", null), g)).hata, "paket_gerekli");
  assert.equal((await V.adresKaydet(env, await ogrenci(env, "s@test.dev", "orta", "2020-01-01"), g)).hata, "paket_gerekli");
  assert.ok((await V.adresKaydet(env, await ogrenci(env, "a@test.dev", "orta"), g)).ok);
  assert.ok((await V.adresKaydet(env, await ogrenci(env, "p@test.dev", "premium"), g)).ok);
  const dn = await ortam({ AKE_DENEME_GUN: "7" }); assert.equal((await V.adresKaydet(dn, await ogrenci(dn, "d@test.dev", null), g)).hata, "paket_gerekli");
});
test("özellik varsayılan kapalı: VELI_RAPORU=1 yoksa adres, e-posta ve gönderim yok", async () => {
  const env = await ortam({ VELI_RAPORU: "0" }), kid = await ogrenci(env, "k@test.dev", "premium");
  assert.equal((await V.adresKaydet(env, kid, { eposta: "veli@test.dev", yas: "kucuk", origin: "x" })).hata, "kapali");
  assert.equal(gonderilen.length, 0); assert.equal((await V.haftalikGonder(env, { now: SIMDI })).aday, 0);
  const a = await V.durumGetir(env, kid); assert.equal(a.acik, false);
});
test("veli adresi girilince yalnızca doğrulama e-postası gider; belirteç düz metin saklanmaz; durum bekliyor, kapalı", async () => {
  const env = await ortam(), { kid, tok } = await hazirOgrenci(env);
  assert.equal(gonderilen.length, 1); assert.deepEqual(gonderilen[0].to, ["veli@test.dev"]); assert.match(gonderilen[0].subject, /onay/i); assert.ok(tok && tok.length >= 40);
  const d = JSON.stringify(env.DB.raw.prepare("SELECT * FROM veli_token").all()); assert.ok(!d.includes(tok), "belirteç düz metin saklanmış");
  const a = await V.ayarGetir(env, kid); assert.equal(a.durum, "bekliyor"); assert.equal(a.etkin, 0);
  assert.ok(!/Deniz.*çözülen|doğruluk/i.test(gonderilen[0].html), "onay e-postası öğrenci verisi içermemeli");
});
test("onay verilmeden gönderim engeli: bekleyen adres, zorla etkinleştirme ve öğrenci açma denemesi", async () => {
  const env = await ortam(), { kid } = await hazirOgrenci(env);
  assert.equal((await V.etkinDegistir(env, kid, true)).hata, "onay_gerekli");
  env.DB.raw.prepare("UPDATE veli_ayar SET etkin = 1 WHERE kid = ?").run(kid); // doğrudan veritabanında zorlanmış
  gonderilen.length = 0; const o = await V.haftalikGonder(env, { now: SIMDI });
  assert.equal(o.gonderildi, 0); assert.equal(gonderilen.length, 0); assert.equal(o.aday, 0, "onaysız kayıt gönderim adayı bile olmamalı");
});
test("veli onayı: tek kullanımlık, süreli; yanlış veya kullanılmış belirteç reddedilir", async () => {
  const env = await ortam(), { kid, tok } = await hazirOgrenci(env);
  assert.equal((await V.onayVer(env, "a".repeat(48))).hata, "gecersiz");
  assert.ok((await V.onayVer(env, tok)).ok); assert.equal((await V.onayVer(env, tok)).hata, "gecersiz");
  assert.equal((await V.ayarGetir(env, kid)).durum, "onayli");
  const s = await hazirOgrenci(env); env.DB.raw.prepare("UPDATE veli_token SET bitis = ? WHERE kullanildi = 0").run(Date.now() - 1);
  assert.equal((await V.onayVer(env, s.tok)).hata, "gecersiz");
});
test("tam akış: onay + etkinleştirme sonrası rapor gider; içerik ve başlık doğru", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await veriYaz(env, kid, "stats", STATS); await veriYaz(env, kid, "profile", { name: "Deniz Yılmaz" });
  gonderilen.length = 0; const o = await V.haftalikGonder(env, { now: SIMDI });
  assert.equal(o.gonderildi, 1); assert.equal(gonderilen.length, 1); const e = gonderilen[0];
  assert.equal(e.subject, "AKE Akademi | Haftalık Öğrenci Gelişim Raporu"); assert.deepEqual(e.to, ["veli@test.dev"]);
  assert.match(e.html, /Deniz Yılmaz/); assert.match(e.html, /35/); assert.match(e.html, /Matematik/); assert.match(e.html, /api\/veli\/yonet\?t=/);
  assert.match(e.text, /Gönderimi durdur/);
});
test("rapor metrikleri: yalnızca kayıtlı veriden; önceki hafta karşılaştırması; süre uydurulmaz; boş yalnızca denemede", () => {
  const r = V.raporHesapla(STATS, [], SIMDI, "Deniz");
  assert.equal(r.bas, "2026-11-02"); assert.equal(r.bit, "2026-11-08"); assert.equal(r.q, 35); assert.equal(r.d, 22); assert.equal(r.y, 13); assert.equal(r.dogruluk, 63);
  assert.equal(r.aktifGun, 3); assert.equal(r.deneme, 0); assert.equal(r.bos, null); assert.deepEqual(r.dersler.map(d => [d.ad, d.n]), [["Matematik", 26], ["Türkçe", 4], ["Fizik", 5]].sort((a, b) => b[1] - a[1]));
  assert.deepEqual(r.once, { q: 30, dogruluk: 80, aktifGun: 1 }); assert.match(r.degerlendirme, /\+5/); assert.ok(!/süre|dakika|saat/i.test(V.raporHtml(r, "https://x").replace(/Çalışma süresi kaydedilmediği/, "")));
  assert.equal(r.zayif.length, 1); assert.equal(r.zayif[0].konu, "Problemler"); // yalnızca >=8 soru ve <%50
  const d = V.raporHesapla(STATS, [{ date: Date.UTC(2026, 10, 5, 9), b: 4 }, { date: Date.UTC(2026, 9, 1), b: 9 }], SIMDI, "D"); assert.equal(d.deneme, 1); assert.equal(d.bos, 4);
});
test("yetersiz veri: açık 'yeterli çalışma verisi bulunmuyor' mesajı, uydurma metrik yok", () => {
  const r = V.raporHesapla({ daily: { "2026-11-03": { q: 4, c: 2 } } }, [], SIMDI, "D"); assert.equal(r.yeterli, false);
  assert.equal(r.degerlendirme, "Bu hafta yeterli çalışma verisi bulunmuyor."); const h = V.raporHtml(r, "https://x"); assert.match(h, /Bu hafta yeterli çalışma verisi bulunmuyor/); assert.ok(!/Doğruluk<\/div>/.test(h));
  assert.equal(V.raporHesapla({}, null, SIMDI).q, 0);
});
test("izin geri çekme (öğrenci): gönderim durur, etkin kapanır, belirteçler geçersiz olur", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await V.izinGeriCek(env, kid, "ogrenci");
  const a = await V.ayarGetir(env, kid); assert.equal(a.durum, "iptal"); assert.equal(a.etkin, 0); assert.equal(a.onayli_hash, null);
  gonderilen.length = 0; assert.equal((await V.haftalikGonder(env, { now: SIMDI })).gonderildi, 0); assert.equal(gonderilen.length, 0);
  assert.equal((await V.etkinDegistir(env, kid, true)).hata, "onay_gerekli");
});
test("izin geri çekme (veli bağlantısı): tek kullanımlık, gönderimi durdurur", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await veriYaz(env, kid, "stats", STATS); gonderilen.length = 0; await V.haftalikGonder(env, { now: SIMDI });
  const raw = tokenDon({ text: gonderilen[0].text }); assert.ok(raw);
  assert.ok((await V.veliDurdur(env, raw)).ok); assert.equal((await V.veliDurdur(env, raw)).hata, "gecersiz");
  assert.equal((await V.ayarGetir(env, kid)).durum, "iptal"); gonderilen.length = 0; assert.equal((await V.haftalikGonder(env, { now: SIMDI + 7 * 86400000 })).gonderildi, 0);
});
test("e-posta adresi değişince eski onay geçersiz olur; yeni onay gerekir; eski bağlantı çalışmaz", async () => {
  const env = await ortam(), { kid, tok } = await tamAkis(env);
  const yeni = await hazirYeniAdres(env, kid);
  const a = await V.ayarGetir(env, kid); assert.equal(a.durum, "bekliyor"); assert.equal(a.etkin, 0); assert.equal(a.onayli_hash, null);
  gonderilen.length = 0; assert.equal((await V.haftalikGonder(env, { now: SIMDI })).gonderildi, 0);
  assert.equal((await V.onayVer(env, tok)).hata, "gecersiz"); assert.ok((await V.onayVer(env, yeni)).ok);
  // onay hâlâ eski adrese kalmış gibi zorlanırsa gönderim engellenir
  env.DB.raw.prepare("UPDATE veli_ayar SET veli_eposta = 'baska@test.dev', etkin = 1 WHERE kid = ?").run(kid);
  assert.equal((await V.haftalikGonder(env, { now: SIMDI })).gonderildi, 0);
});
async function hazirYeniAdres(env, kid) { gonderilen.length = 0; const r = await V.adresKaydet(env, kid, { eposta: "yeni@test.dev", yas: "kucuk", origin: "https://akeakademi.com" }); assert.ok(r.ok); assert.deepEqual(gonderilen[0].to, ["yeni@test.dev"]); return tokenDon(gonderilen[0]); }
test("abonelik bitince gönderim durur", async () => {
  const env = await ortam(), { kid } = await tamAkis(env, "orta"); env.DB.raw.prepare("UPDATE kod SET bitis = '2020-01-01' WHERE kid = ?").run(kid);
  gonderilen.length = 0; const o = await V.haftalikGonder(env, { now: SIMDI }); assert.equal(o.gonderildi, 0); assert.equal(o.atlandi, 1); assert.equal(gonderilen.length, 0);
  assert.equal((await V.etkinDegistir(env, kid, true)).hata, "paket_gerekli");
});
test("haftalık zamanlama: Türkiye saatiyle pazar 19:00 = UTC 16:00; saat dilimi ve hafta hesabı", async () => {
  const sa = ms => new Date(ms).toISOString();
  assert.equal(sa(V.sonrakiGonderim(Date.UTC(2026, 10, 9, 8))), "2026-11-15T16:00:00.000Z");   // pazartesi → sonraki pazar
  assert.equal(sa(V.sonrakiGonderim(Date.UTC(2026, 10, 8, 15, 59))), "2026-11-08T16:00:00.000Z"); // pazar 18:59 TR → aynı gün 19:00
  assert.equal(sa(V.sonrakiGonderim(SIMDI)), "2026-11-15T16:00:00.000Z");                      // tam 19:00 → bir sonraki hafta
  assert.equal(new Date("2026-11-08T16:00:00Z").toLocaleString("sv", { timeZone: "Europe/Istanbul" }), "2026-11-08 19:00:00");
  assert.equal(new Date(2026, 10, 8).getDay(), 0); // 8 Kasım 2026 pazar
  assert.equal(V.isoHafta("2026-11-08"), "2026-W45"); assert.equal(V.isoHafta("2026-11-09"), "2026-W46"); assert.equal(V.isoHafta("2027-01-03"), "2026-W53");
  const toml = readFileSync("workers/veli-rapor/wrangler.toml", "utf8"); assert.match(toml, /"0 16 \* \* SUN"/); assert.match(toml, /VELI_RAPORU = "0"/);
  assert.equal(V.pencere(Date.UTC(2026, 10, 8, 22, 0)).bit, "2026-11-09"); // TR'de gece yarısını geçti
});
test("aynı hafta mükerrer rapor gönderilmez (art arda ve eşzamanlı çalıştırma)", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await veriYaz(env, kid, "stats", STATS); gonderilen.length = 0;
  const [a, b] = await Promise.all([V.haftalikGonder(env, { now: SIMDI }), V.haftalikGonder(env, { now: SIMDI })]);
  await V.haftalikGonder(env, { now: SIMDI + 3600e3 });
  assert.equal(gonderilen.length, 1); assert.equal(a.gonderildi + b.gonderildi, 1);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM veli_log").get().n, 1);
  await V.haftalikGonder(env, { now: SIMDI + 7 * 86400000 }); assert.equal(gonderilen.length, 2, "ertesi hafta yeni rapor gitmeli");
});
test("Resend başarısızlığı: sınırlı yeniden deneme, kalıcı hata kaydı, sonra gönderim durur", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await veriYaz(env, kid, "stats", STATS); resendDurum = 500;
  let o = await V.haftalikGonder(env, { now: SIMDI }); assert.equal(o.hata, 1);
  o = await V.haftalikGonder(env, { now: SIMDI + 60e3 }); assert.equal(o.hata, 0, "bekleme süresi dolmadan yeniden denenmemeli");
  o = await V.haftalikGonder(env, { now: SIMDI + V.YENIDEN_MS + 1 }); assert.equal(o.hata, 1);
  o = await V.haftalikGonder(env, { now: SIMDI + 2 * V.YENIDEN_MS + 2 }); assert.equal(o.hata, 1);
  o = await V.haftalikGonder(env, { now: SIMDI + 3 * V.YENIDEN_MS + 3 }); assert.equal(o.hata, 0); assert.equal(o.gonderildi, 0);
  const l = env.DB.raw.prepare("SELECT durum, deneme, hata FROM veli_log").get(); assert.equal(l.durum, "hata"); assert.equal(l.deneme, V.MAKS_DENEME); assert.ok(l.hata);
  const y = await V.yoneticiOzet(env, SIMDI + 3 * V.YENIDEN_MS + 9); assert.equal(y.kalici, 1); assert.equal(y.basarili, 0); assert.equal(y.gecmis[0].durum, "hata");
  const env2 = await ortam(), t2 = await tamAkis(env2); await veriYaz(env2, t2.kid, "stats", STATS); resendDurum = 500;
  await V.haftalikGonder(env2, { now: SIMDI }); resendDurum = 200; gonderilen.length = 0;
  assert.equal((await V.haftalikGonder(env2, { now: SIMDI + V.YENIDEN_MS + 1 })).gonderildi, 1); assert.equal(gonderilen.length, 1);
});
test("RESEND_API_KEY yoksa kalıcı olmayan hata olarak kaydedilir, çökmez", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); delete env.RESEND_API_KEY; await veriYaz(env, kid, "stats", STATS);
  const o = await V.haftalikGonder(env, { now: SIMDI }); assert.equal(o.hata, 1); assert.equal(env.DB.raw.prepare("SELECT hata FROM veli_log").get().hata, "yapilandirma");
});
test("mobil e-posta: tek sütun uyumlu, ≤560px, satır içi stil, script/svg/değişken yok, 14px+ metin, durdurma bağlantısı", () => {
  const h = V.raporHtml(V.raporHesapla(STATS, [], SIMDI, "Deniz"), "https://akeakademi.com/api/veli/yonet?t=abc");
  assert.match(h, /name="viewport"/); assert.match(h, /max-width:560px/); assert.match(h, /alt="AKE Akademi"/); assert.match(h, /https:\/\/akeakademi\.com\/icons\/eposta-logo-v2\.png/);
  assert.ok(!/<script|<svg|<link|<style|@media|var\(--|@import|position:fixed|width:[6-9]\d\dpx/i.test(h));
  assert.ok(![...h.matchAll(/font-size:(\d+)px/g)].some(m => m[1] < 12)); assert.match(h, /Rapor gönderimini durdur/); assert.match(h, /#171715/); assert.match(h, /#C5A572/);
});
test("denetim kaydı: izin ve ayar değişiklikleri tutulur, e-posta adresi düz yazılmaz", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await V.izinGeriCek(env, kid, "ogrenci");
  const olaylar = env.DB.raw.prepare("SELECT olay FROM veli_denetim WHERE kid = ? ORDER BY id").all(kid).map(r => r.olay);
  for (const o of ["adres_girildi", "onay_eposta_gonderildi", "veli_onayladi", "etkinlestirildi", "izin_geri_cekildi"]) assert.ok(olaylar.includes(o), o);
  assert.ok(!JSON.stringify(env.DB.raw.prepare("SELECT * FROM veli_denetim").all()).includes("veli@test.dev"));
});
test("adres girme sınırı: günde en fazla 5 deneme", async () => {
  const env = await ortam(), kid = await ogrenci(env, "s@test.dev", "premium");
  for (let i = 0; i < V.ADRES_GUNLUK_SINIR; i++) assert.ok((await V.adresKaydet(env, kid, { eposta: `v${i}@test.dev`, yas: "kucuk", origin: "x" })).ok);
  assert.equal((await V.adresKaydet(env, kid, { eposta: "son@test.dev", yas: "kucuk", origin: "x" })).hata, "cok_istek");
  assert.equal((await V.adresKaydet(env, kid, { eposta: "gecersiz", yas: "kucuk", origin: "x" })).hata, "eposta_gecersiz");
  assert.equal((await V.adresKaydet(env, kid, { eposta: "a@b.co", yas: "?", origin: "x" })).hata, "yas_gerekli");
});
test("yönetici yetkilendirmesi: giriş yok/öğrenci 403, yönetici 200; özet öğrenci adı ve tam e-posta içermez", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await veriYaz(env, kid, "stats", STATS); await V.haftalikGonder(env, { now: SIMDI });
  const istek = async (kullanici) => { const h = {}; if (kullanici) h.cookie = "ake_s=" + (await oturumAc(env, kullanici)).match(/ake_s=([^;]+)/)[1]; return yonetimIstek({ request: new Request("https://akeakademi.com/api/yonetim/veli", { headers: h }), env, params: { yol: ["veli"] } }); };
  assert.equal((await istek(null)).status, 403); assert.equal((await istek(kid)).status, 403);
  const yon = await kullaniciBulVeyaAc(env, { eposta: "yonetici@test.dev" }), r = await istek(yon); assert.equal(r.status, 200);
  const j = await r.json(), t = JSON.stringify(j); assert.equal(j.etkin, 1); assert.equal(j.dogrulanmis, 1); assert.equal(j.basarili, 1); assert.equal(j.gecmis.length, 1);
  assert.ok(!t.includes("veli@test.dev") && !t.includes("Deniz") && !t.includes(kid), "hassas veri sızmış"); assert.match(j.gecmis[0].veli, /^v\*\*\*@test\.dev$/);
});
test("öğrenci uçları: oturum şart; öğrenci yalnızca kendi raporunu görür; veli sayfası belirteçsiz açılmaz", async () => {
  const env = await ortam(), a = await tamAkis(env), b = await tamAkis(env); await veriYaz(env, a.kid, "profile", { name: "Ayşe" }); await veriYaz(env, b.kid, "profile", { name: "Burak" });
  const cagri = async (yol, kid, ek) => { const h = {}; if (kid) h.cookie = "ake_s=" + (await oturumAc(env, kid)).match(/ake_s=([^;]+)/)[1]; return veliIstek({ request: new Request("https://akeakademi.com/api/veli/" + yol, Object.assign({ headers: h }, ek)), env, params: { yol: yol.split("?")[0].split("/") } }); };
  assert.equal((await cagri("durum", null)).status, 401); assert.equal((await cagri("onizleme", null)).status, 401);
  const ra = await (await cagri("onizleme", a.kid)).json(); assert.equal(ra.rapor.ad, "Ayşe"); assert.ok(!JSON.stringify(ra).includes("Burak"));
  assert.equal((await cagri("onay", null)).status, 400); assert.equal((await cagri("onay?t=" + "0".repeat(48), null)).status, 400); assert.equal((await cagri("yonet?t=x", null)).status, 400);
  const dd = await (await cagri("durum", a.kid)).json(); assert.equal(dd.durum, "onayli"); assert.equal(dd.etkin, true); assert.equal(dd.veli, "v***@test.dev"); assert.ok(dd.sonraki > Date.now());
  const kapali = await ortam({ VELI_RAPORU: "0" }); assert.equal((await veliIstek({ request: new Request("https://x/api/veli/durum"), env: kapali, params: { yol: ["durum"] } })).status, 403);
});
test("veli onay sayfası: GET durum değiştirmez (e-posta tarayıcıları belirteci tüketemez); POST onaylar; kullanılmış bağlantı reddedilir", async () => {
  const env = await ortam(), { kid, tok } = await hazirOgrenci(env);
  const g = await veliIstek({ request: new Request("https://akeakademi.com/api/veli/onay?t=" + tok), env, params: { yol: ["onay"] } });
  assert.equal(g.status, 200); const html = await g.text(); assert.match(html, /Aydınlatma metni/); assert.match(html, /name="t"/); assert.match(g.headers.get("content-security-policy"), /default-src 'none'/);
  assert.equal((await V.ayarGetir(env, kid)).durum, "bekliyor");
  const f = new URLSearchParams({ t: tok, karar: "onay" }), p = () => veliIstek({ request: new Request("https://akeakademi.com/api/veli/onay", { method: "POST", body: f, headers: { "content-type": "application/x-www-form-urlencoded" } }), env, params: { yol: ["onay"] } });
  assert.equal((await p()).status, 200); assert.equal((await V.ayarGetir(env, kid)).durum, "onayli"); assert.equal((await p()).status, 400);
  const red = await hazirOgrenci(env); const pr = await veliIstek({ request: new Request("https://akeakademi.com/api/veli/onay", { method: "POST", body: new URLSearchParams({ t: red.tok, karar: "red" }), headers: { "content-type": "application/x-www-form-urlencoded" } }), env, params: { yol: ["onay"] } });
  assert.equal(pr.status, 200); assert.equal((await V.ayarGetir(env, red.kid)).durum, "iptal");
});
test("hesap silinince veli verileri silinir; migration tekrar çalışınca hata vermez; üretimde otomatik tablo oluşturulmaz", async () => {
  const env = await ortam(), { kid } = await tamAkis(env); await V.hesapSilVeli(env, kid);
  for (const t of ["veli_ayar", "veli_token", "veli_log", "veli_denetim"]) assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE kid = ?`).get(kid).n, 0, t);
  env.DB.raw.exec(readFileSync("migrations/0001_veli_raporu.sql", "utf8"));
  assert.ok(!/veli_/.test(readFileSync("lib/ortak.js", "utf8")), "sema() veli tablolarını kendiliğinden oluşturmamalı (migration onay sonrası elle)");
  const bos = d1(); assert.equal(await V.veliHazirMi({ DB: bos }), false); assert.deepEqual(await V.yoneticiOzet({ DB: bos, VELI_RAPORU: "1" }), { hazir: false, acik: true });
});
