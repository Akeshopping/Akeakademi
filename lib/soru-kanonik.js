// AKE Akademi · korumalı soru bankası · kanonik biçim, içerik özeti ve şema genişlemesi (PR 1/6, "karanlık altyapı")
// Bu dosyayı henüz hiçbir istek yolu (functions/) içe aktarmaz; üretim davranışı değişmez.
//
// LEGACY UYARISI: `soru.json` sütunu DEPRECATED LEGACY'dir. İçinde p/q/o ile birlikte a/x de durur ve PR 1 süresince
// durmaya devam eder (geri dönüş güvenliği). Yeni sunucu API'si ASLA `SELECT json` ile soru döndürmez; yalnız açık
// sütunlardan (govde, a, x, ...) çalışır. `a/x ayrı sütuna alındı, json'dan sızamaz` DEMEK YANLIŞTIR: json, kapanış
// PR'ında gövde-only hale getirilene ya da kullanımdan kalkana kadar a/x içerir.
import { sha256 } from "./ortak.js";

/* ---- kaynak önceliği (kopya adaylarında kanonik kimlik seçimi): küçük olan önce ---- */
export const KAYNAK_ONCELIK = { gomulu: 0, statik: 1, ai: 2 };
/* Göç ile eklenen satırların durumu: ne /api/sorular ('onayli' filtreler) ne yönetim paneli ('bekliyor'/'onayli') görür.
   Böylece PR 1'de canlı davranış ve /api/sorular çıktısı değişmez. PR 2/kapanış PR'ında seçim bu duruma bakar ya da 'onayli'ye çevrilir. */
export const DURUM_BANKA = "banka";

/* ---- şema genişlemesi (geriye uyumlu; mevcut sütunlar silinmez/yeniden adlandırılmaz) ---- */
export const YENI_SUTUNLAR = [
  ["kaynak", "TEXT"],    // gomulu | statik | ai
  ["rk", "INTEGER"],     // kararlı rastgele seçim anahtarı, 0..2147483647; eklenirken bir kez atanır, sonra değişmez
  ["h", "TEXT"],         // kanonik içerik özeti (SHA-256 hex). UNIQUE DEĞİL: aynı içerik farklı eski kimliklerle bulunabilir
  ["govde", "TEXT"],     // yalnız gövde: {"p"?:..,"q":..,"o":[5 şık]}; p yoksa/boşsa alan HİÇ yazılmaz (tek kural)
  ["a", "INTEGER"],      // doğru şık 0-4
  ["x", "TEXT"],         // çözüm/açıklama
  ["grup", "TEXT"],      // ortak pasaj grubu (PR 2'de doldurulacak; PR 1'de NULL)
  ["kopya_of", "TEXT"]   // tam içerik kopyası ise kanonik kimlik; yeni oturum seçiminden ileride çıkarılır (WHERE kopya_of IS NULL)
];
export const INDEKS_SQL = "CREATE INDEX IF NOT EXISTS soru_h ON soru (h)";
export const SORU_TABLO_SQL = "CREATE TABLE IF NOT EXISTS soru (id TEXT PRIMARY KEY, s TEXT, t TEXT, d INTEGER, json TEXT, durum TEXT, tarih INTEGER, karar INTEGER)";

/* d1: { prepare(sql).all()/run() } (Cloudflare D1 ya da yerel SQLite sarmalayıcısı). Yinelenebilir: olmayan sütunları ekler. */
export async function soruKanonikSema(d1) {
  await d1.prepare(SORU_TABLO_SQL).run();
  const { results } = await d1.prepare("PRAGMA table_info(soru)").all();
  const var_ = new Set((results || []).map(r => r.name));
  for (const [ad, tur] of YENI_SUTUNLAR) if (!var_.has(ad)) await d1.prepare(`ALTER TABLE soru ADD COLUMN ${ad} ${tur}`).run();
  await d1.prepare(INDEKS_SQL).run();
}

/* ---- kanonik içerik ---- */
/* Tek normalize kuralı: Unicode NFC + ardışık boşlukları tek boşluk + baş/son boşluk kırp. Büyük/küçük harf KORUNUR. */
export const normalize = s => String(s == null ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim();

/* Kimlik, kaynak ve a/x HARİÇ: s + p + q + o[0..4] (şıklar SIRALI = konumsal; yeniden sıralanmış şıklar farklı içeriktir).
   Gerekçe (a/x dahil değil): "aynı soru"yu tanımlayan şey gövde+şıklardır. a/x farklıysa bu iki ayrı soru değil, bir
   editoryal ÇATIŞMADIR ve sessizce kopya sayılmaz: ayrıca `cevapHash` ile yakalanıp raporlanır. */
export const kanonikMetin = q => [String(q.s == null ? "" : q.s), normalize(q.p), normalize(q.q), ...[0, 1, 2, 3, 4].map(i => normalize((q.o || [])[i]))].join("\n");
export const cevapMetin = q => String(q.a) + "\n" + normalize(q.x);
export const kanonikHash = q => sha256(kanonikMetin(q));
export const cevapHash = q => sha256(cevapMetin(q));
/* yalnız soru kökü (+ders) aynı olanları saymak için; kopya_of VERMEZ */
export const kokAnahtari = q => String(q.s == null ? "" : q.s) + "\n" + normalize(q.q);

/* canonical gövde JSON'u (p yalnız doluysa) */
export function govdeOf(q) {
  const p = normalize(q.p), g = {};
  if (p) g.p = String(q.p).trim();
  g.q = String(q.q).trim(); g.o = q.o.map(x => String(x).trim());
  return JSON.stringify(g);
}

/* ---- doğrulama: geçersiz soru sessizce atlanmaz; çağıran raporlar ve apply'i durdurur ---- */
export function dogrulaSoru(q, dersler) {
  const e = [], dolu = v => typeof v === "string" && v.trim().length > 0;
  if (!q || typeof q !== "object") return ["soru nesnesi değil"];
  if (!dolu(q.id)) e.push("id boş");
  if (!dolu(q.s)) e.push("ders (s) boş"); else if (Array.isArray(dersler) && !dersler.includes(q.s)) e.push("ders geçersiz: " + q.s);
  if (!dolu(q.t)) e.push("konu (t) boş");
  if (![1, 2, 3].includes(q.d)) e.push("zorluk (d) 1-3 değil");
  if (!dolu(q.q)) e.push("soru kökü (q) boş");
  if (!Array.isArray(q.o) || q.o.length !== 5) e.push("şık sayısı 5 değil");
  else {
    if (q.o.some(x => !dolu(x))) e.push("boş ya da string olmayan şık");
    else if (new Set(q.o.map(x => normalize(x))).size !== 5) e.push("şıklar birbirinden farklı değil");
  }
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 4) e.push("a 0-4 tamsayı değil");
  if (!dolu(q.x)) e.push("çözüm (x) boş");
  if (q.p !== undefined && q.p !== null && typeof q.p !== "string") e.push("p string değil");
  return e;
}

/* rk: 0..2147483647, kriptografik rastgele; ekleme anında BİR KEZ atanır */
export function rkUret() { const u = new Uint32Array(1); globalThis.crypto.getRandomValues(u); return u[0] >>> 1; }
