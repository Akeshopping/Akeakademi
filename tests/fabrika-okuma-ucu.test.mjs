// GET /api/yonetim/soru-taslak-oku: yönetici yetkisi ister, YALNIZ SELECT çalıştırır, sema()/fabrikaSema()/örtük tablo kurulumu yapmaz.
// Gerçek API çağrısı YOK; yerel SQLite; sentetik satırlar.
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { kur, yonetimIstek } from "./yardim/soru-v2.mjs";

const YAZMA = /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REPLACE|PRAGMA\s+\w+\s*=)/i;
const KOK = "https://akeakademi.com";
async function okuIstek(T, sorgu, cookie) {   // gerçek Pages gibi: params.yol sorgu dizesi İÇERMEZ
  const mod = await import(pathToFileURL(resolve("functions/api/yonetim/[[yol]].js")).href);
  const r = await mod.onRequest({ request: new Request(KOK + "/api/yonetim/soru-taslak-oku" + sorgu, { method: "GET", headers: { origin: KOK, ...(cookie ? { cookie } : {}) } }), env: T.env, params: { yol: ["soru-taslak-oku"] } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { } return { s: r.status, j, t };
}
const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com" } });
const tabloSayisi = () => T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type IN ('table','index','trigger')").get().n;
const degisim = () => T.DB.db.prepare("SELECT total_changes() AS n").get().n;
const sema = () => JSON.stringify(T.DB.db.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all());

test("1) HİÇ tablo yokken ve oturumsuz: 403; hiçbir tablo kurulmaz, yazan SQL yok (sema() çağrılsaydı tablolar oluşurdu)", async () => {
  assert.equal(tabloSayisi(), 0);
  const n0 = T.DB.sayac.sql.length;
  const r = await yonetimIstek(T, "soru-taslak-oku", { m: "GET" });
  assert.equal(r.s, 403); assert.equal(tabloSayisi(), 0, "uç tablo kurdu");
  assert.deepEqual(T.DB.sayac.sql.slice(n0).filter(q => YAZMA.test(q)), []);
  const r2 = await yonetimIstek(T, "soru-taslak-oku", { m: "GET", cookie: "ake_s=" + "x".repeat(50) });   // sahte oturum çerezi, tablolar yok
  assert.equal(r2.s, 403); assert.equal(tabloSayisi(), 0);
});

test("2) yönetici olmayan giriş 403; yönetici 200; fabrika tabloları YOKKEN yalnız SELECT, şema ve satırlar değişmez; içerik dönmez", async () => {
  await T.hazirla();
  const yon = await T.giris("yonetici@ornek.com"), ogr = await T.giris("ogrenci@ornek.com");
  const ins = T.DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, 'mat', 'x', 2, '{}', ?, 1, 1, 'ai', 'rk', ?, 'GÖVDE-GİZLİ', 0, 'x', NULL)");
  ins.run("t-01", "taslak", "h1"); ins.run("t-02", "taslak", "h2"); ins.run("o-01", "onayli", "h3");
  assert.equal((await yonetimIstek(T, "soru-taslak-oku", { m: "GET", cookie: ogr.cookie })).s, 403);
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0);
  const s0 = sema(), d0 = degisim(), n0 = T.DB.sayac.sql.length;
  const r = await okuIstek(T, "", yon.cookie);
  assert.equal(r.s, 200); assert.equal(r.j.soruTablosu, true);
  assert.deepEqual(r.j.satirlar.map(x => x.id), ["t-01", "t-02"]); assert.ok(r.j.satirlar.every(x => x.durum === "taslak"));
  assert.equal(r.j.durumlar.taslak, 2); assert.equal(r.j.durumlar.onayli, 1);
  assert.ok(!r.t.includes("GÖVDE-GİZLİ"), "içerik dönmemeli");
  const sorgular = T.DB.sayac.sql.slice(n0);
  assert.deepEqual(sorgular.filter(q => YAZMA.test(q)), [], "yazan SQL: " + sorgular.filter(q => YAZMA.test(q)).join(" | "));
  assert.ok(sorgular.every(q => /^\s*(SELECT|PRAGMA\s+table_info)/i.test(q) || /pragma_table_info/i.test(q)), sorgular.join(" | "));
  assert.equal(sema(), s0, "şema değişti"); assert.equal(degisim(), d0, "satır değişti");
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0, "fabrika tablosu kuruldu");
});

test("3) ids ile sorgu: yalnız istenen kimlikler, olmayanlar 'bulunmayan'; geçersiz kimlik ve POST reddedilir/yok sayılır; sorgu yazmaz", async () => {
  const yon = await T.giris("yonetici@ornek.com");
  const d0 = degisim(), s0 = sema();
  const r = await okuIstek(T, "?ids=t-01,o-01,yok-9,x'%20OR%201=1--", yon.cookie);
  assert.equal(r.s, 200); assert.deepEqual(r.j.satirlar.map(x => [x.id, x.durum]), [["o-01", "onayli"], ["t-01", "taslak"]]); assert.deepEqual(r.j.bulunmayan, ["yok-9"]);
  assert.equal(degisim(), d0); assert.equal(sema(), s0);
  const p = await yonetimIstek(T, "soru-taslak-oku", { m: "POST", cookie: yon.cookie, govde: {} }); assert.notEqual(p.s, 200);
  assert.equal(degisim(), d0);
});
