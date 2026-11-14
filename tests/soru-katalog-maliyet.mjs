// B4 3B-3 · katalog `beklenen` sayım sorgularının YEREL maliyet ölçümü (SQLite). D1'in faturalama sayacı DEĞİLDİR; D1'de "rows read" burada ölçülemez.
// Ölçülenler: (a) sorgu planı (EXPLAIN QUERY PLAN) (b) ana taramanın ziyaret ettiği satır sayısı (WHERE'e konan sayaç işleviyle) (c) süre (ms)
// çalıştırma: node tests/soru-katalog-maliyet.mjs [N=8000]
import { d1 } from "./yardim/soru-v2.mjs";
import fs from "node:fs";
import { SEMA_SQL, UYGUN, GECERLI_GOVDE_SQL, BAYRAK_HAZIR_ID } from "../lib/soru-api.js";
import { soruKanonikSema } from "../lib/soru-kanonik.js";
const N = +(process.argv[2] || 8000);
const D = d1(), db = D.db;
await soruKanonikSema(D); for (const q of SEMA_SQL) db.exec(q);
db.exec(fs.readFileSync("migrations/0003_soru_meta.sql", "utf8"));
const ins = db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, ?, ?, NULL, ?, 0, 0, 'gomulu', ?, ?, ?, ?, ?, ?)");
const metin = "Sentetik soru metni ".repeat(40);   // ~800 bayt; gerçek soru gövdesi değildir
db.exec("BEGIN");
for (let i = 0; i < N; i++) {
  const id = "q" + String(i).padStart(6, "0"), durum = i % 50 === 0 ? "red" : "banka", kopya = i % 97 === 0 ? "ana" : null, govde = i % 211 === 0 ? "{bozuk" : JSON.stringify({ q: metin + id, o: [0, 1, 2, 3, 4].map(k => "secenek " + k + " " + id) });
  ins.run(id, ["mat", "fizik", "kimya"][i % 3], "K" + (i % 12), 1 + (i % 3), durum, i * 7919 % 2147483647, "h" + id, govde, i % 5, "x", kopya);
}
const meta = db.prepare("INSERT INTO soru_meta (id, os, fix) VALUES (?, ?, ?)");
for (let i = 0; i < N; i += 2) meta.run("q" + String(i).padStart(6, "0"), i % 4 === 0 ? 1 : 0, i % 6 === 0 ? 1 : 0);
meta.run(BAYRAK_HAZIR_ID, 0, 0); db.exec("COMMIT");
let sayac = 0; db.function("say", () => { sayac++; return 1; });
const sorgular = {
  "A) meta'lı sayım (os/fix + toplam + işaret)": `SELECT COUNT(*) AS toplam, COALESCE(SUM(CASE WHEN m.os <> 0 THEN 1 ELSE 0 END), 0) AS os, COALESCE(SUM(CASE WHEN m.fix <> 0 THEN 1 ELSE 0 END), 0) AS fix, (SELECT COUNT(*) FROM soru_meta WHERE id = '${BAYRAK_HAZIR_ID}') AS hazir FROM soru LEFT JOIN soru_meta m ON m.id = soru.id WHERE SAYAC AND ${UYGUN} AND ${GECERLI_GOVDE_SQL}`,
  "B) yalnız toplam (tablo yokken yedek yol)": `SELECT COUNT(*) AS toplam FROM soru WHERE SAYAC AND ${UYGUN} AND ${GECERLI_GOVDE_SQL}`,
  "C) mevcut /ozet sayımı (karşılaştırma)": `SELECT s, t, d, COUNT(*) AS n FROM soru WHERE SAYAC AND ${UYGUN} GROUP BY s, t, d`,
  "D0) ESKİ katalog sayfa sorgusu (GECERLI_GOVDE_SQL yok; karşılaştırma)": `SELECT id, s, t, d, govde FROM soru WHERE SAYAC AND ${UYGUN} ORDER BY id LIMIT 1001`,
  "D) YENİ katalog sayfa sorgusu (sayımla aynı GECERLI_GOVDE_SQL kuralı, limit 1000)": `SELECT id, s, t, d, govde FROM soru WHERE SAYAC AND ${UYGUN} AND ${GECERLI_GOVDE_SQL} ORDER BY id LIMIT 1001`
};
const topSoru = db.prepare("SELECT COUNT(*) n FROM soru").get().n, uygun = db.prepare(`SELECT COUNT(*) n FROM soru WHERE ${UYGUN}`).get().n, servis = db.prepare(`SELECT COUNT(*) n FROM soru WHERE ${UYGUN} AND ${GECERLI_GOVDE_SQL}`).get().n;
console.log(`soru tablosu: ${topSoru} satır · UYGUN küme: ${uygun} · servis edilebilir (geçerli gövde): ${servis} · soru_meta: ${db.prepare("SELECT COUNT(*) n FROM soru_meta").get().n} satır\n`);
for (const [ad, sql] of Object.entries(sorgular)) {
  const duz = sql.replace("SAYAC AND ", "");
  console.log(ad); console.log("  plan:", db.prepare("EXPLAIN QUERY PLAN " + duz).all().map(r => r.detail).join(" | "));
  sayac = 0; const t0 = performance.now(); const sonuc = db.prepare(sql.replace("SAYAC", "say()")).all(); const ms = performance.now() - t0;
  console.log(`  ana tarama ziyaret edilen satır (ölçülen): ${sayac} · süre: ${ms.toFixed(1)} ms · sonuç: ${sonuc.length > 1 ? sonuc.length + " satır" : JSON.stringify(sonuc[0])}`);
}
const sayfa = Math.ceil(servis / 1000), sayim = sayfa === 1 ? 1 : 2;   // sözleşme: sayım yalnız ilk ve son sayfada; tek sayfada ilk=son → BİR sayım; ara sayfada sayım yok
const sayimSatir = sayim * uygun, sayfaSatir = sayfa * 1001;
console.log(`\n== ÖZET (yerel ölçüm; D1 fatura sayacı DEĞİL) ==`);
console.log(`Katalog ${servis} soru → ${sayfa} sayfa (limit 1000). Sayım sorgusu ${sayim} kez çalışır: ${sayfa === 1 ? "tek sayfa: ilk=son, sayım BİR kez" : "yalnız ilk ve son sayfada (ara sayfalarda yok)"}.`);
console.log(`Sayım: ${sayim} × ${uygun} = ${sayimSatir} ana-tarama satırı (ölçülen, A sorgusu; soru_meta anahtar aramaları ve json_each sanal tablo okumaları bu sayıya DAHİL DEĞİL).`);
console.log(`Sayfa sorguları: ≈ ${sayfa} × 1001 = ${sayfaSatir} satır (D sorgusunun ölçümünden). Toplam ana-tarama ≈ ${sayimSatir + sayfaSatir} satır.`);
console.log(`Karşılaştırma (eski tasarım, her sayfada sayım): ${sayfa} × ${uygun} = ${sayfa * uygun} sayım satırı.`);
console.log(`TAHMİN (ölçüm DEĞİL, D1 panelinde "rows read" ile doğrulanmalı): D1'in soru_meta aramalarını ve json_each okumalarını satır okuma sayıp saymadığı bu betikle bilinemez; sayılırsa gerçek değer yukarıdaki ana-tarama sayısından YÜKSEK olabilir. Bir üst sınır olarak sunulmaz.`);
