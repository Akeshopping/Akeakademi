// AKE Akademi · Soru Fabrikası · aday soru ZIP/JSONL içe aktarma (ön kontrol + YEREL staging)
//
// Güvenli varsayılan: YAZMAZ. Bayraksız çalışma yalnız ön kontrol raporu üretir.
// Aktarım = soruları mevcut akıştaki 'bekliyor' (yönetici incelemesi) durumuna yazmak. 'onayli' YAZILMAZ; /api/sorular yalnız 'onayli' okur,
// V2 havuzu yalnız banka/onayli okur → öğrencilere görünen soru sayısı değişmez. Kanonik sütunlar (h, govde, a, x, rk, kaynak) BOŞ bırakılır:
// onay anında lib/soru-yaz.js soruOnayla bunları atomik doldurur ve tekrar/çatışma denetimini yapar (burada yeniden yazılmaz).
// ÜRETİM D1'E BU ARAÇ BAĞLANMAZ (yalnız --local-db <sqlite>). Üretim için gereken adımlar: docs/soru-fabrika-aktarim.md
//
// Kullanım:
//   node fabrika/soru-fabrika-aktar.mjs --girdi <zip-icerigi-klasoru> --bagimsiz <bagimsiz.json> --cikti <rapor-klasoru>             # ön kontrol
//   ... --local-db /tmp/staging.sqlite --apply                                                                                       # yerel staging'e aktar
// --bagimsiz: python3 fabrika/uretim_py/bagimsiz_cozum.py <girdi> <bagimsiz.json> çıktısı (soru metninden bağımsız çözüm).
// Çıktılar (repo DIŞINA yazın; soru metni içerir): ledger.jsonl (soru başına sonuç), inceleme.jsonl, rapor.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { dogrulaSoru, kanonikHash, cevapHash, normalize, soruKanonikSema } from "../lib/soru-kanonik.js";
import { DERSLER } from "../lib/soru-api.js";
import { statikKaynaklar, d1Yerel } from "./soru-migrate.mjs";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DERS_HARITA = { tyt_matematik: "mat" };      // üreticideki ders anahtarı → sitedeki ders kodu (lib/soru-api.js DERSLER)
export const PARCA = 40;                                    // D1 batch sınırı (≤50)
const KIMLIK = /^py-[a-z0-9_]+-[0-9a-f]{8}$/;

function arg(ad, varsayilan = null) { const i = process.argv.indexOf("--" + ad); return i < 0 ? varsayilan : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); }
const sirasiz = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sablon = q => q.replace(/\d+([.,]\d+)?/g, "#");
/* fabrika/dogrula.mjs ile AYNI benzerlik ölçüsü: 3-gram Jaccard >= 0.8 → "tekrar" (mevcut akışın kuralı). Karşılaştırma aynı şablon grubu içindedir. */
const norm = s => String(s).toLocaleLowerCase("tr").replace(/[^a-zçğıöşüâîû0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const golge = s => { const w = norm(s).split(" "); const k = new Set(); for (let i = 0; i + 2 < w.length; i++) k.add(w.slice(i, i + 3).join(" ")); if (!k.size) k.add(w.join(" ")); return k; };
const jac = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };
export const BENZERLIK = 0.8;

/* ---- 1) dosyaları oku: bütünlük + rapor sayıları ---- */
export function dosyalariOku(girdi) {
  const konular = [], dosyaHata = [];
  for (const ad of fs.readdirSync(girdi).sort()) {
    const dir = path.join(girdi, ad);
    if (!fs.statSync(dir).isDirectory()) continue;
    const k = { konu: ad, sorular: [], bozukSatir: 0, redSatir: 0, rapor: null };
    for (const f of ["onayli.jsonl", "red.jsonl", "rapor.json"]) if (!fs.existsSync(path.join(dir, f))) dosyaHata.push({ konu: ad, hata: f + " yok" });
    const oku = f => fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(s => s.trim()) : [];
    for (const s of oku("onayli.jsonl")) { try { k.sorular.push(JSON.parse(s)); } catch (e) { k.bozukSatir++; } }
    k.redSatir = oku("red.jsonl").length;
    try { k.rapor = JSON.parse(fs.readFileSync(path.join(dir, "rapor.json"), "utf8")); } catch (e) { dosyaHata.push({ konu: ad, hata: "rapor.json okunamadı" }); }
    konular.push(k);
  }
  return { konular, dosyaHata };
}

/* ---- 2) soru başına karar (saf hesap, yazmaz) ---- */
export async function degerlendir({ konular, bagimsiz, mevcutKonu, mevcutHash, mevcutId, mevcutKok, mevcutGolge = [] }) {
  const ledger = [], gorulenId = new Map(), gorulenH = new Map(), tutulan = new Map();
  const rapor = { konu: {}, genel: {} };
  for (const k of konular) {
    const r = rapor.konu[k.konu] = { okunan: 0, uygun: 0, tekrar: 0, gecersiz: 0, inceleme: 0, bozukSatir: k.bozukSatir, raporOnayli: k.rapor && k.rapor.onayli, raporRed: k.rapor && k.rapor.red, redDosyaSatiri: k.redSatir, sayiUyusmazligi: [], sablon: new Set(), konuAdi: new Set(), konumlar: [0, 0, 0, 0, 0], zorluk: { 1: 0, 2: 0, 3: 0 } };
    if (k.rapor && k.rapor.onayli !== k.sorular.length) r.sayiUyusmazligi.push(`rapor.onayli=${k.rapor.onayli} dosya=${k.sorular.length}`);
    if (k.rapor && k.rapor.red !== k.redSatir) r.sayiUyusmazligi.push(`rapor.red=${k.rapor.red} red.jsonl=${k.redSatir}`);
    for (const ham of k.sorular) {
      r.okunan++;
      const kayit = { id: ham && ham.id, konu: k.konu, sonuc: "uygun", neden: [] };
      const q = { id: ham.id, s: DERS_HARITA[ham.s] || ham.s, t: ham.t, d: ham.d, q: ham.q, o: ham.o, a: ham.a, x: ham.x }; if (ham.p) q.p = ham.p;
      const hatalar = dogrulaSoru(q, DERSLER);
      if (!KIMLIK.test(String(q.id))) hatalar.push("id biçimi beklenen py-<ders>-<8 hex> değil");
      if (!DERS_HARITA[ham.s]) hatalar.push("ders eşlemesi yok: " + ham.s);
      if (typeof q.x === "string" && !q.x.includes("ABCDE"[q.a] + " şıkkıdır")) hatalar.push("çözüm işaretli şıkkı söylemiyor");
      if (typeof q.x === "string" && Array.isArray(q.o) && !q.x.includes(String(q.o[q.a]).replace(/^%/, ""))) hatalar.push("çözüm doğru şık değerini içermiyor");
      if (Number.isInteger(ham.dUret) && ham.dUret !== ham.d) kayit.not = "üretim zorluğu " + ham.dUret + " → ölçülen " + ham.d;
      if (hatalar.length) { kayit.sonuc = "gecersiz"; kayit.neden = hatalar; }
      else {
        if (gorulenId.has(q.id)) { kayit.sonuc = "tekrar"; kayit.neden.push("aynı id bu yüklemede tekrar"); }
        else gorulenId.set(q.id, k.konu);
        if (mevcutId.has(q.id)) { kayit.sonuc = "tekrar"; kayit.neden.push("id depodaki statik bankada var"); }
        const h = await kanonikHash(q), ha = await cevapHash(q);
        kayit.h = h;
        const onceki = gorulenH.get(h) || mevcutHash.get(h);
        if (onceki && kayit.sonuc === "uygun") {
          if (onceki.ha === ha) { kayit.sonuc = "tekrar"; kayit.neden.push("aynı içerik (hash) " + onceki.id); }
          else { kayit.sonuc = "inceleme"; kayit.neden.push("aynı soru, farklı cevap/çözüm: " + onceki.id); }
        } else if (!onceki) gorulenH.set(h, { id: q.id, ha });
        if (kayit.sonuc === "uygun" && mevcutKok.has(q.s + "\n" + normalize(q.q))) { kayit.sonuc = "inceleme"; kayit.neden.push("soru kökü depodaki mevcut soruyla aynı"); }
        const b = bagimsiz[q.id];
        if (kayit.sonuc === "uygun") {
          if (!b) { kayit.sonuc = "inceleme"; kayit.neden.push("bağımsız çözüm kaydı yok"); }
          else if (b.s !== "dogru") { kayit.sonuc = "inceleme"; kayit.neden.push("bağımsız çözüm: " + b.s + (b.n ? " · " + b.n : "")); }
        }
        if (kayit.sonuc === "uygun") {
          const g = golge((q.p || "") + " " + q.q), grup = q.s + "|" + sablon(q.q);
          const liste = tutulan.get(grup) || []; tutulan.set(grup, liste);
          const ikiz = liste.find(y => jac(g, y.g) >= BENZERLIK);
          if (ikiz) { kayit.sonuc = "tekrar"; kayit.neden.push(`çok benzer (3-gram Jaccard ≥ ${BENZERLIK}): ${ikiz.id}`); kayit.benzer = true; }
          else {
            liste.push({ id: q.id, g });
            const m = mevcutGolge.find(y => y.s === q.s && jac(g, y.g) >= BENZERLIK);
            if (m) { kayit.sonuc = "inceleme"; kayit.neden.push("sitede var olan soruya çok benziyor: " + m.q.slice(0, 80)); }
          }
        }
        if (q.t && !(mevcutKonu[q.s] && q.t in mevcutKonu[q.s])) { r.konuAdi.add(q.t); kayit.yeniKonu = true; }
        r.sablon.add(sablon(q.q)); r.konumlar[q.a]++; r.zorluk[q.d] = (r.zorluk[q.d] || 0) + 1;
      }
      const alan = { uygun: "uygun", tekrar: "tekrar", gecersiz: "gecersiz", inceleme: "inceleme" }[kayit.sonuc];
      r[alan]++;
      kayit.aday = kayit.sonuc === "uygun" ? q : undefined;
      ledger.push(kayit);
    }
  }
  for (const r of Object.values(rapor.konu)) { r.sablonSayisi = r.sablon.size; r.yeniKonuAdlari = [...r.konuAdi]; delete r.sablon; delete r.konuAdi; }
  rapor.genel = Object.values(rapor.konu).reduce((t, r) => { for (const a of ["okunan", "uygun", "tekrar", "gecersiz", "inceleme", "bozukSatir"]) t[a] = (t[a] || 0) + r[a]; return t; }, {});
  return { ledger, rapor };
}

/* ---- 3) yerel staging'e yaz: yalnız 'bekliyor', idempotent, parçalı ---- */
export async function yerelAktar(dbYol, ledger) {
  const db = new DatabaseSync(dbYol); const d1 = d1Yerel(db);
  await soruKanonikSema(d1);                                  // mevcut şema (soru + kanonik sütunlar) — yinelenebilir
  const say = sql => db.prepare(sql).get().n;
  const once = { toplam: say("SELECT COUNT(*) n FROM soru"), onayli: say("SELECT COUNT(*) n FROM soru WHERE durum='onayli'"), banka: say("SELECT COUNT(*) n FROM soru WHERE durum='banka'") };
  const ekle = db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) SELECT ?, ?, ?, ?, ?, 'bekliyor', ?, NULL WHERE NOT EXISTS (SELECT 1 FROM soru WHERE id = ?)");
  const bak = db.prepare("SELECT json FROM soru WHERE id = ?");
  const sonuclar = { aktarildi: 0, zaten_var: 0, catisma: 0 };
  const aday = ledger.filter(l => l.sonuc === "uygun");
  const simdi = Date.now();
  for (let i = 0; i < aday.length; i += PARCA) {
    db.exec("BEGIN");
    try {
      for (const l of aday.slice(i, i + PARCA)) {
        const q = l.aday, js = JSON.stringify({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, a: q.a, x: q.x });
        const r = ekle.run(q.id, q.s, q.t, q.d, js, simdi, q.id);
        if (r.changes === 1) { l.sonuc = "aktarildi"; sonuclar.aktarildi++; }
        else { const var_ = bak.get(q.id); if (var_ && var_.json === js) { l.sonuc = "zaten_var"; sonuclar.zaten_var++; } else { l.sonuc = "catisma"; l.neden.push("aynı id farklı içerikle veritabanında var"); sonuclar.catisma++; } }
      }
      db.exec("COMMIT");
    } catch (e) { try { db.exec("ROLLBACK"); } catch (_) { } throw e; }
  }
  const sonra = { toplam: say("SELECT COUNT(*) n FROM soru"), onayli: say("SELECT COUNT(*) n FROM soru WHERE durum='onayli'"), banka: say("SELECT COUNT(*) n FROM soru WHERE durum='banka'"), bekliyor: say("SELECT COUNT(*) n FROM soru WHERE durum='bekliyor'") };
  if (sonra.onayli !== once.onayli || sonra.banka !== once.banka) throw new Error("DURDUR: yayımlanmış/banka soru sayısı değişti");
  db.close();
  return { once, sonra, sonuclar };
}

async function main() {
  const girdi = arg("girdi"), bagYol = arg("bagimsiz"), cikti = arg("cikti"), localDb = arg("local-db"), apply = !!arg("apply");
  if (!girdi || !bagYol || !cikti) { console.error("Kullanım: --girdi <klasor> --bagimsiz <json> --cikti <rapor-klasoru> [--local-db <sqlite> --apply]"); process.exit(2); }
  if (path.resolve(cikti).startsWith(KOK + path.sep)) { console.error("DURDUR: --cikti repo içinde olamaz (soru metni içerir)."); process.exit(2); }
  if (apply && !localDb) { console.error("DURDUR: --apply yalnız --local-db <sqlite> ile çalışır. Üretim D1'e bu araç bağlanmaz."); process.exit(3); }
  const { konular, dosyaHata } = dosyalariOku(girdi);
  const bagimsiz = JSON.parse(fs.readFileSync(bagYol, "utf8"));
  const mevcutKonu = JSON.parse(fs.readFileSync(path.join(KOK, "fabrika/mevcut_konular.json"), "utf8"));
  const mevcutHash = new Map(), mevcutId = new Set(), mevcutKok = new Set();
  for (const k of statikKaynaklar(KOK)) for (const q of k.sorular) { mevcutId.add(q.id); mevcutHash.set(await kanonikHash(q), { id: q.id, ha: await cevapHash(q) }); mevcutKok.add(q.s + "\n" + normalize(q.q)); }
  for (const m of JSON.parse(fs.readFileSync(path.join(KOK, "fabrika/mevcut_ozet.json"), "utf8"))) mevcutKok.add(m.s + "\n" + normalize(m.q));   // gömülü banka (yalnız metin)
  const mevcutGolge = JSON.parse(fs.readFileSync(path.join(KOK, "fabrika/mevcut_ozet.json"), "utf8")).map(m => ({ s: m.s, q: m.q, g: golge((m.p || "") + " " + m.q) }));
  const { ledger, rapor } = await degerlendir({ konular, bagimsiz, mevcutKonu, mevcutHash, mevcutId, mevcutKok, mevcutGolge });
  rapor.dosyaHata = dosyaHata; rapor.depoReferans = { statikId: mevcutId.size, statikHash: mevcutHash.size, kokAnahtari: mevcutKok.size };
  rapor.mod = apply ? "yerel-staging-yazma" : "on-kontrol (yazma yok)";
  if (apply) rapor.yazma = await yerelAktar(path.resolve(localDb), ledger);
  fs.mkdirSync(cikti, { recursive: true });
  fs.writeFileSync(path.join(cikti, "ledger.jsonl"), ledger.map(l => JSON.stringify({ id: l.id, konu: l.konu, sonuc: l.sonuc, neden: l.neden, yeniKonu: l.yeniKonu || undefined, not: l.not })).join("\n") + "\n");
  fs.writeFileSync(path.join(cikti, "inceleme.jsonl"), ledger.filter(l => l.sonuc === "inceleme" || l.sonuc === "gecersiz").map(l => JSON.stringify({ id: l.id, konu: l.konu, sonuc: l.sonuc, neden: l.neden })).join("\n") + "\n");
  fs.writeFileSync(path.join(cikti, "rapor.json"), JSON.stringify(rapor, null, 1));
  console.log(JSON.stringify({ genel: rapor.genel, konu: Object.fromEntries(Object.entries(rapor.konu).map(([k, r]) => [k, { okunan: r.okunan, uygun: r.uygun, tekrar: r.tekrar, gecersiz: r.gecersiz, inceleme: r.inceleme, sablon: r.sablonSayisi, uyusmazlik: r.sayiUyusmazligi, yeniKonu: r.yeniKonuAdlari }])), yazma: rapor.yazma, dosyaHata }, null, 1));
}
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exit(1); });
