// AKE Akademi · B4 Aşama 3A · gösterim bayraklarını (os = ÖSYM tarzı, fix = şık sırası sabit) D1 `soru_meta` tablosuna taşır.
// NEDEN: gömülü BANK'taki os/fix bayrakları soru-migrate/soru-d1-migrate çıktısında YOKTU (gomuluBankaCikar yalnız id,s,t,d,p,q,o,a,x alır) →
//   BANK kaldırıldığında 52 ÖSYM işareti ve 37 sabit-sıra işareti kaybolurdu (27 sabit-sıra sorusunu istemci sezgisi `sabitSira` yakalamaz: şıklar karışırdı).
// Bayraklar cevap anahtarı DEĞİLDİR; `soru` tablosuna dokunulmaz (ALTER/UPDATE yok), yalnız `soru_meta` doldurulur. Tekrar çalıştırılabilir, bayrak ASLA silmez (MAX birleşimi).
// Kopya (kopya_of dolu) kimliğin bayrağı kanonik kimliğe yazılır (V2 oturumu yalnız kanonik satırı sunar).
// Kullanım (3A: YALNIZ yerel):   node fabrika/soru-bayrak-doldur.mjs --local-db <dosya.sqlite> [--embedded-json <yol>] [--apply] [--json]
//   --dogrula: yazmaz; soru_meta ile kaynak bayrakları birebir mi (52 os / 37 fix) denetler, değilse çıkış kodu 1.
//   varsayılan = DRY RUN (yazmaz). Uzak D1 (--remote) bu aşamada YOK: Aşama 3B'de ayrı onayla eklenir. Çıktıda soru metni yoktur (yalnız sayı).
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gomuluBankaCikar } from "./soru-migrate.mjs";
import { BAYRAK_HAZIR_ID } from "../lib/soru-api.js";

/* şema TEK kaynaktan: migrations/0003_soru_meta.sql (API tablo oluşturmaz; bu araç yalnız YEREL provada aynı dosyayı uygular) */
export const META_SQL = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations", "0003_soru_meta.sql"), "utf8").split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();
export { BAYRAK_HAZIR_ID };

/* kaynak: [{id, os?, fix?}], db: DatabaseSync(soru tablosu var). Döner: { hedef: Map(id→{os,fix}), sayim } — YAZMAZ. */
export function planla(kaynak, db) {
  const sayim = { kaynak_toplam: kaynak.length, bayrakli: 0, os: 0, fix: 0, eslesen: 0, kopyaya_yonlendirilen: 0, eslesmeyen: 0, hedef_satir: 0 };
  const hedef = new Map(), satir = db.prepare("SELECT id, kopya_of FROM soru WHERE id = ?");
  for (const q of kaynak) {
    if (!q || !(q.os || q.fix)) continue;
    sayim.bayrakli++; if (q.os) sayim.os++; if (q.fix) sayim.fix++;
    const r = satir.get(q.id);
    if (!r) { sayim.eslesmeyen++; continue; }
    sayim.eslesen++;
    let id = r.id; if (r.kopya_of) { id = r.kopya_of; sayim.kopyaya_yonlendirilen++; }
    const m = hedef.get(id) || { os: 0, fix: 0 }; if (q.os) m.os = 1; if (q.fix) m.fix = 1; hedef.set(id, m);
  }
  sayim.hedef_satir = hedef.size;
  return { hedef, sayim };
}
/* YAZMA + DOĞRULAMA: önce bayrak satırları (tek işlem), sonra beklenen kümeyle BİREBİR karşılaştırma; yalnız tam eşleşmede `#doldu` işaret satırı yazılır
   (os/fix = beklenen toplamlar). Böylece API, doldurulmamış/yarım tabloyu asla "hazir" saymaz. */
export function uygula(db, hedef) {
  db.exec(META_SQL);
  const ek = db.prepare("INSERT INTO soru_meta (id, os, fix) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET os = MAX(os, excluded.os), fix = MAX(fix, excluded.fix)");
  db.exec("BEGIN");
  try { for (const [id, m] of hedef) ek.run(id, m.os, m.fix); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
  const d = dogrula(db, hedef);
  if (!d.tamam) throw new Error("doğrulama başarısız, işaret satırı YAZILMADI: " + JSON.stringify({ eksik: d.eksik, fazla: d.fazla, farkli: d.farkli }));
  const topOs = [...hedef.values()].reduce((t, m) => t + m.os, 0), topFix = [...hedef.values()].reduce((t, m) => t + m.fix, 0);
  db.prepare("INSERT INTO soru_meta (id, os, fix) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET os = excluded.os, fix = excluded.fix").run(BAYRAK_HAZIR_ID, topOs, topFix);
  return { yazilan: hedef.size, os: topOs, fix: topFix };
}
/* soru_meta ile beklenen küme (planla.hedef) birebir mi? İşaret satırı varsa toplamları da denetler. Döner: { tamam, eksik, fazla, farkli, isaret } — YAZMAZ. */
export function dogrula(db, hedef) {
  const var_ = db.prepare("SELECT name FROM sqlite_master WHERE name = 'soru_meta'").all().length > 0;
  if (!var_) return { tamam: false, tablo: false, eksik: [...hedef.keys()], fazla: [], farkli: [], isaret: false };
  const satirlar = db.prepare("SELECT id, os, fix FROM soru_meta WHERE id != ?").all(BAYRAK_HAZIR_ID), mevcut = new Map(satirlar.map(r => [r.id, r]));
  const eksik = [], farkli = [], fazla = [];
  for (const [id, m] of hedef) { const r = mevcut.get(id); if (!r) eksik.push(id); else if (r.os !== m.os || r.fix !== m.fix) farkli.push(id); }
  for (const r of satirlar) if (!hedef.has(r.id) && (r.os || r.fix)) fazla.push(r.id);
  const isaret = db.prepare("SELECT os, fix FROM soru_meta WHERE id = ?").get(BAYRAK_HAZIR_ID);
  const topOs = [...hedef.values()].reduce((t, m) => t + m.os, 0), topFix = [...hedef.values()].reduce((t, m) => t + m.fix, 0);
  const isaretTamam = !isaret || (isaret.os === topOs && isaret.fix === topFix);
  return { tamam: !eksik.length && !farkli.length && !fazla.length && isaretTamam, tablo: true, eksik, fazla, farkli, isaret: !!isaret, isaretTamam };
}

const cli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (cli) {
  const a = process.argv.slice(2), has = k => a.includes(k), val = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  (async () => {
    if (has("--remote")) { console.error("HARD STOP: uzak D1 yazımı Aşama 3A'da yoktur (ayrı onay + yedek + dry-run gerekir). Yalnız --local-db."); process.exit(3); }
    const yol = val("--local-db"); if (!yol || !fs.existsSync(yol)) { console.error("Kullanım: node fabrika/soru-bayrak-doldur.mjs --local-db <dosya.sqlite> [--embedded-json <yol>] [--apply] [--json]"); process.exit(2); }
    const kaynak = val("--embedded-json") ? JSON.parse(fs.readFileSync(val("--embedded-json"), "utf8")) : await gomuluBankaCikar(undefined, { bayrak: true });
    const db = new DatabaseSync(yol), { hedef, sayim } = planla(kaynak, db);
    const cikti = { mod: has("--dogrula") ? "DOĞRULA" : has("--apply") ? "APPLY (yerel)" : "DRY RUN", ...sayim };
    if (has("--apply")) cikti.uygulandi = uygula(db, hedef);
    if (has("--dogrula")) { const d = dogrula(db, hedef); cikti.dogrulama = { tamam: d.tamam, tablo: d.tablo, isaret: d.isaret, eksik: d.eksik.length, fazla: d.fazla.length, farkli: d.farkli.length }; if (!d.tamam) sayim.eslesmeyen++; }
    db.close();
    console.log(has("--json") ? JSON.stringify(cikti, null, 1) : Object.entries(cikti).map(([k, v]) => k + ": " + (typeof v === "object" ? JSON.stringify(v) : v)).join("\n"));
    process.exit(sayim.eslesmeyen ? 1 : 0);
  })().catch(e => { console.error("HATA: " + e.message); process.exit(1); });
}
