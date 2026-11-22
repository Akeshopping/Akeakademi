// fabrika-* GET uçları okuma sırasında DDL/yazma YAPMAZ; tablo kurulumu AÇIK, yalnız Preview'da çalışan hazırlık adımıdır (23 Kas 2026).
// Gerçek API çağrısı YOK; yerel SQLite. Uzman/yayım kaydı oluşturulmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { kur, yonetimIstek } from "./yardim/soru-v2.mjs";
import { adaylar, fabrikaDurum, cagrilar, fabrikaHazirMi, fabrikaHazirla, onizlemeMi, GEREKLI_TABLOLAR } from "../lib/fabrika.js";
import { cevrimdisiDurum } from "../lib/fabrika-cevrimdisi.js";

const YAZMA = /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REPLACE|PRAGMA\s+\w+\s*=)/i;
const sema = T => JSON.stringify(T.DB.db.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all());
const degisim = T => T.DB.db.prepare("SELECT total_changes() AS n").get().n;
async function ortam() { const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com" } }); await T.hazirla(); const yon = await T.giris("yonetici@ornek.com"); return { T, yon }; }
const E = await ortam();   // çekirdek sema() modül düzeyinde önbellekli: dosya başına TEK ortam (sıra önemli: önce tablosuz testler, en son hazırlık)
async function izle(T, f) {   // f çalışırken hazırlanan SQL'ler + şema + satır değişimi
  const a0 = sema(T), d0 = degisim(T), n0 = T.DB.sayac.sql.length; const sonuc = await f();
  const sql = T.DB.sayac.sql.slice(n0);
  return { sonuc, yazanSql: sql.filter(q => YAZMA.test(q)), semaAyni: sema(T) === a0, degisimAyni: degisim(T) === d0, sorguSayisi: sql.length };
}

test("tablolar KURULU DEĞİLKEN dört okuma işlevi hiçbir şey kurmaz/yazmaz; boş + hazir:false döner", async () => {
  const { T } = E; assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0);
  const r = await izle(T, async () => ({ a: await adaylar(T.env), d: await fabrikaDurum(T.env), c: await cagrilar(T.env), cd: await cevrimdisiDurum(T.env), h: await fabrikaHazirMi(T.env) }));
  assert.deepEqual(r.yazanSql, []); assert.equal(r.semaAyni, true); assert.equal(r.degisimAyni, true); assert.ok(r.sorguSayisi > 0);
  assert.deepEqual(r.sonuc.a, []); assert.deepEqual(r.sonuc.c, []); assert.deepEqual(r.sonuc.cd, []);
  assert.equal(r.sonuc.d.hazir, false); assert.ok(r.sonuc.d.eksik.includes("fabrika_soru")); assert.equal(r.sonuc.h.hazir, false);
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0);   // hâlâ yok
});

test("yönetim GET uçları (fabrika-durum/adaylar/cagrilar/cevrimdisi-durum): tablo yokken DDL YOK, { hazir:false } döner", async () => {
  const { T, yon } = E;
  for (const yol of ["fabrika-durum", "fabrika-adaylar", "fabrika-cagrilar", "fabrika-cevrimdisi-durum"]) {
    const r = await izle(T, () => yonetimIstek(T, yol, { m: "GET", cookie: yon.cookie }));
    assert.equal(r.sonuc.s, 200, yol); assert.equal(r.sonuc.j.hazir, false, yol); assert.ok(r.sonuc.j.eksik.length > 0);
    assert.deepEqual(r.yazanSql, [], yol + " yazan SQL: " + r.yazanSql.join(" | ")); assert.equal(r.semaAyni, true, yol); assert.equal(r.degisimAyni, true, yol);
  }
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0);
});

test("hazırlık adımı: production adresinde REDDEDİLİR; onay cümlesi yoksa reddedilir; Preview adresinde kurar; kurulumdan sonra GET'ler yine yazmaz", async () => {
  const { T, yon } = E;
  let r = await yonetimIstek(T, "fabrika-hazirla", { cookie: yon.cookie, govde: { onay: "preview-tablolarini-kur" } });   // istek adresi akeakademi.com
  assert.equal(r.s, 403); assert.equal(r.j.error, "yalniz_onizleme"); assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0);
  const mod = await import(pathToFileURL(resolve("functions/api/yonetim/[[yol]].js")).href);
  const onizleme = async (host, govde) => { const o = "https://" + host; const x = await mod.onRequest({ request: new Request(o + "/api/yonetim/fabrika-hazirla", { method: "POST", headers: { "content-type": "application/json", origin: o, cookie: yon.cookie }, body: JSON.stringify(govde) }), env: T.env, params: { yol: ["fabrika-hazirla"] } }); return { s: x.status, j: await x.json() }; };
  for (const host of ["akeakademi.pages.dev", "akeakademi.com", "www.akeakademi.com", "evil-akeakademi.pages.dev", "akeakademi.pages.dev.evil.com"]) { const x = await onizleme(host, { onay: "preview-tablolarini-kur" }); assert.equal(x.s, 403, host); }
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0);
  let x = await onizleme("fabrika-cevrimdisi-inceleme.akeakademi.pages.dev", {}); assert.equal(x.s, 400); assert.equal(x.j.error, "onay_eksik");
  x = await onizleme("fabrika-cevrimdisi-inceleme.akeakademi.pages.dev", { onay: "evet" }); assert.equal(x.s, 400);
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'fabrika_%'").get().n, 0);
  x = await onizleme("918215b0.akeakademi.pages.dev", { onay: "preview-tablolarini-kur" }); assert.equal(x.s, 200); assert.equal(x.j.once.hazir, false); assert.equal(x.j.sonra.hazir, true, JSON.stringify(x.j.sonra));
  for (const t of GEREKLI_TABLOLAR) assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name = ?").get(t).n, 1, t);
  /* kurulumdan sonra: GET'ler tablo VAR iken de DDL/yazma yapmaz ve gerçek veriyi döndürür */
  for (const yol of ["fabrika-durum", "fabrika-adaylar", "fabrika-cagrilar", "fabrika-cevrimdisi-durum"]) {
    const g = await izle(T, () => yonetimIstek(T, yol, { m: "GET", cookie: yon.cookie }));
    assert.equal(g.sonuc.s, 200, yol); assert.notEqual(g.sonuc.j.hazir, false, yol); assert.deepEqual(g.yazanSql, [], yol + ": " + g.yazanSql.join(" | ")); assert.equal(g.semaAyni, true); assert.equal(g.degisimAyni, true);
  }
  const d = await fabrikaDurum(T.env); assert.equal(d.sayilar.uretilen, 0); assert.equal(d.robot, false);
});

test("onizlemeMi: yalnız <alt>.akeakademi.pages.dev", () => {
  for (const u of ["https://fabrika-cevrimdisi-inceleme.akeakademi.pages.dev/x", "https://918215b0.akeakademi.pages.dev/"]) assert.equal(onizlemeMi(u), true, u);
  for (const u of ["https://akeakademi.pages.dev/", "https://akeakademi.com/", "https://.akeakademi.pages.dev/", "https://x.akeakademi.pages.dev.evil.com/", "not a url", ""]) assert.equal(onizlemeMi(u), false, u);
});
