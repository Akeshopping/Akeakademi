// AKE Akademi · korumalı soru bankası · göç aracı (PR 1/6, karanlık altyapı)
//
// Amaç: mevcut çözülebilir soruları (gömülü 728 + r01 99 + pilot-100 100 + ake-yks-02-200 200 + D1'deki ok-* satırları) `soru` tablosunun
// kanonik sütunlarına, kimlikleri koruyarak, yinelenebilir (idempotent) biçimde taşımak.
//
// GÜVENLİ VARSAYILAN = DRY RUN. Uzak/üretim D1'e ASLA kendiliğinden bağlanmaz (ağ, wrangler, Cloudflare API yok).
// Yalnız yerel SQLite dosyası (--db) ya da dışa aktarılmış satırlar (--d1-satirlar) üzerinde çalışır; D1, SQLite'tır.
// Üretim uygulaması ayrı onay ve ayrı bir adaptörle (sonraki PR) yapılır; bu PR'da çalıştırılmaz.
//
// Kullanım:
//   node fabrika/soru-migrate.mjs                                   # dry run, mevcut D1 satırları yok sayılır (uyarı verir)
//   node fabrika/soru-migrate.mjs --d1-satirlar satirlar.json       # dry run, dışa aktarılmış soru satırlarıyla
//   node fabrika/soru-migrate.mjs --db yerel.sqlite                 # dry run, yerel veritabanından (hiçbir şey yazmaz)
//   node fabrika/soru-migrate.mjs --db yerel.sqlite --apply         # YEREL uygulama (şema genişletir, tek işlemde yazar)
//   --manifest <yol>  yalnız hash/sayı içeren manifesti yaz (repo DIŞINDA bir yol olmalı)
//   --json            raporu JSON olarak yaz
// Çıkış kodu: 0 = plan başarılı, 1 = çatışma/geçersiz/sapma var (apply reddedilir), 2 = kullanım hatası.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "../lib/ortak.js";
import { DERSLER } from "./lib.mjs";
import { KAYNAK_ONCELIK, DURUM_BANKA, YENI_SUTUNLAR, soruKanonikSema, kanonikHash, cevapHash, kokAnahtari, govdeOf, dogrulaSoru, rkUret } from "../lib/soru-kanonik.js";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/* PR 1 taban çizgisi: bu sayılar sabitlenmiştir. 1127 = 728 + 99 + 100 + 200; D1'deki ok-* soruları bunun DIŞINDADIR. */
export const BEKLENEN = { embedded: 728, r01: 99, "pilot-100": 100, "ake-yks-02-200": 200 };
export const PILOT = "pilot-100", PILOT_BEKLENEN = 100;
const SUTUN_ADLARI = YENI_SUTUNLAR.map(x => x[0]);
const DOLU_SUTUNLAR = ["kaynak", "rk", "h", "govde", "a", "x"];
const kodSirasi = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const ozet = async liste => sha256(liste.join("\n"));

/* ---- yerel SQLite'ı D1 benzeri arayüzle sar (soruKanonikSema için) ---- */
export function d1Yerel(db) {
  const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
    first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
  return { prepare: st };
}

/* ---- satırdan soru: sütunlar doluysa sütunlar, değilse legacy json ---- */
export function satirdanSoru(row) {
  if (row.govde != null && row.a != null && row.x != null) return Object.assign({ id: row.id, s: row.s, t: row.t, d: row.d }, JSON.parse(row.govde), { a: row.a, x: row.x });
  const j = JSON.parse(row.json);
  return { id: row.id, s: row.s || j.s, t: row.t || j.t, d: row.d != null ? row.d : j.d, p: j.p, q: j.q, o: j.o, a: j.a, x: j.x };
}

/* =====================================================================
   PLAN: saf hesap (hiçbir şey yazmaz). kaynaklar: [{ad, tur:'gomulu'|'statik', sorular:[...]}], mevcut: soru tablosu satırları
   ===================================================================== */
export async function planla({ kaynaklar, mevcut = [], dersler = DERSLER, beklenen = BEKLENEN, rk = rkUret }) {
  const gecersiz = [], catisma = [], sapma = [], kaynakOzet = {};
  const sayimlar = { kaynak_ortak_id: 0 };
  /* 1) kaynak soruları: doğrula, özetle, kaynaklar arası kimlik çakışmasına bak */
  const gorulen = new Map(), ogeler = [];
  for (const k of kaynaklar) {
    kaynakOzet[k.ad] = { sorular: k.sorular.length, ogeler: [] };
    if (beklenen && !(k.ad in beklenen)) sapma.push({ kaynak: k.ad, tur: "beklenmeyen_kaynak", sayi: k.sorular.length });
    else if (beklenen && k.sorular.length !== beklenen[k.ad]) sapma.push({ kaynak: k.ad, tur: "sayi_uyusmuyor", beklenen: beklenen[k.ad], gelen: k.sorular.length });
    for (const q of k.sorular) {
      const hatalar = dogrulaSoru(q, dersler);
      if (hatalar.length) { gecersiz.push({ kaynak: k.ad, id: q && q.id, hatalar }); continue; }
      const h = await kanonikHash(q), ha = await cevapHash(q), oge = { kaynak: k.ad, tur: k.tur, q, h, ha };
      const onceki = gorulen.get(q.id);
      if (onceki) { if (onceki.h === h && onceki.ha === ha) sayimlar.kaynak_ortak_id++; else catisma.push({ tur: "kaynaklar_arasi_id", id: q.id, kaynaklar: [onceki.kaynak, k.ad] }); continue; }
      gorulen.set(q.id, oge); ogeler.push(oge); kaynakOzet[k.ad].ogeler.push(oge);
    }
  }
  /* 2) mevcut D1 satırları */
  const mevcutMap = new Map(); const mevcutOgeler = [];
  for (const row of mevcut) {
    let q; try { q = satirdanSoru(row); } catch (e) { gecersiz.push({ kaynak: "existing_d1", id: row.id, hatalar: ["json/gövde çözülemedi"] }); continue; }
    const hatalar = dogrulaSoru(q, dersler); if (hatalar.length) { gecersiz.push({ kaynak: "existing_d1", id: row.id, hatalar }); continue; }
    const h = await kanonikHash(q), ha = await cevapHash(q);
    if (row.h && row.h !== h) catisma.push({ tur: "saklanan_h_uyusmuyor", id: row.id });
    const m = { row, q, h, ha, dolu: DOLU_SUTUNLAR.every(c => row[c] != null) }; mevcutMap.set(row.id, m); mevcutOgeler.push(m);
  }
  /* 3) eylemler: ekle / doldur / noop / çatışma */
  const ekle = [], doldur = [], noop = []; const nihai = []; /* kopya analizi için {id, kaynak, h, ha, q} */
  for (const o of ogeler) {
    const m = mevcutMap.get(o.q.id);
    if (!m) { const e = { id: o.q.id, q: o.q, h: o.h, ha: o.ha, kaynak: o.tur, rk: rk(), kaynakAd: o.kaynak }; ekle.push(e); nihai.push({ id: e.id, kaynak: e.kaynak, h: e.h, ha: e.ha }); continue; }
    if (m.h !== o.h) { catisma.push({ tur: "icerik", id: o.q.id, kaynak: o.kaynak }); continue; }
    if (m.ha !== o.ha) { catisma.push({ tur: "cevap", id: o.q.id, kaynak: o.kaynak }); continue; }
    m.kaynakliSatir = true; m.hedefKaynak = m.row.kaynak || o.tur; m.kaynakAd = o.kaynak;
  }
  for (const m of mevcutOgeler) {
    const kaynak = m.hedefKaynak || m.row.kaynak || "ai";
    if (!m.kaynakAd) m.kaynakAd = "existing_d1";
    nihai.push({ id: m.row.id, kaynak, h: m.h, ha: m.ha });
    if (!(catisma.some(c => c.id === m.row.id && c.tur !== "kaynaklar_arasi_id"))) {
      if (m.dolu) noop.push(m.row.id); else doldur.push({ id: m.row.id, q: m.q, h: m.h, kaynak, rk: m.row.rk != null ? m.row.rk : rk() });
    }
  }
  /* 4) tam içerik kopyaları (aynı kanonik özet): kanonik = kaynak önceliği, sonra en küçük kimlik; hiçbir satır silinmez */
  const gruplar = new Map(); for (const n of nihai) { if (!gruplar.has(n.h)) gruplar.set(n.h, []); gruplar.get(n.h).push(n); }
  const hedefKopya = new Map(), kopyaGruplari = [];
  for (const [h, uyeler] of gruplar) {
    if (uyeler.length < 2) continue;
    uyeler.sort((a, b) => (KAYNAK_ONCELIK[a.kaynak] ?? 9) - (KAYNAK_ONCELIK[b.kaynak] ?? 9) || kodSirasi(a.id, b.id));
    const kanonik = uyeler[0]; kopyaGruplari.push({ kanonik: kanonik.id, kopyalar: uyeler.slice(1).map(u => u.id) });
    for (const u of uyeler.slice(1)) hedefKopya.set(u.id, kanonik.id);
    if (new Set(uyeler.map(u => u.ha)).size > 1) catisma.push({ tur: "cevap_farki_kopya", idler: uyeler.map(u => u.id) });
  }
  for (const e of ekle) e.kopya_of = hedefKopya.get(e.id) || null;
  const kopyaGuncelle = [];
  for (const m of mevcutOgeler) { const hedef = hedefKopya.get(m.row.id) || null; if ((m.row.kopya_of || null) !== hedef) kopyaGuncelle.push({ id: m.row.id, kopya_of: hedef }); }
  /* 5) yalnız soru kökü aynı (tam kopya değil) gruplar: kopya_of VERİLMEZ, yalnız sayılır */
  const kokGruplari = new Map();
  for (const e of ekle) { const a = kokAnahtari(e.q); if (!kokGruplari.has(a)) kokGruplari.set(a, []); kokGruplari.get(a).push({ id: e.id, h: e.h }); }
  for (const m of mevcutOgeler) { const a = kokAnahtari(m.q); if (!kokGruplari.has(a)) kokGruplari.set(a, []); kokGruplari.get(a).push({ id: m.row.id, h: m.h }); }
  let qOnlyGruplar = 0, qOnlyUyeler = 0, tumTekrarGruplar = 0;
  for (const uyeler of kokGruplari.values()) { if (uyeler.length < 2) continue; tumTekrarGruplar++; if (new Set(uyeler.map(u => u.h)).size > 1) { qOnlyGruplar++; qOnlyUyeler += uyeler.length; } }
  /* 6) manifest (yalnız hash/sayı) ve pilot bütünlüğü */
  const manifest = {};
  for (const [ad, k] of Object.entries(kaynakOzet)) manifest[ad] = { sayi: k.ogeler.length, id_hash: await ozet(k.ogeler.map(o => o.q.id).sort(kodSirasi)), icerik_hash: await ozet(k.ogeler.map(o => o.h).sort(kodSirasi)), cevap_hash: await ozet(k.ogeler.map(o => o.ha).sort(kodSirasi)) };
  manifest.existing_d1 = { sayi: mevcutOgeler.length, id_hash: await ozet(mevcutOgeler.map(m => m.row.id).sort(kodSirasi)), icerik_hash: await ozet(mevcutOgeler.map(m => m.h).sort(kodSirasi)), cevap_hash: await ozet(mevcutOgeler.map(m => m.ha).sort(kodSirasi)) };
  const pilotOgeler = (kaynakOzet[PILOT] || { ogeler: [] }).ogeler, pilotIdler = pilotOgeler.map(o => o.q.id).sort(kodSirasi);
  const pilotHedef = pilotIdler.filter(id => ekle.some(e => e.id === id) || mevcutMap.has(id));
  const pilot = { beklenen: PILOT_BEKLENEN, kaynak_id: pilotIdler.length, hedef_id: pilotHedef.length, eksik: pilotIdler.length - pilotHedef.length,
    icerik_hash_once: await ozet(pilotOgeler.map(o => o.h).sort(kodSirasi)), idler: pilotIdler };
  if (((beklenen && PILOT in beklenen) || kaynakOzet[PILOT]) && (pilotIdler.length !== PILOT_BEKLENEN || pilot.eksik)) sapma.push({ kaynak: PILOT, tur: "pilot_eksik", beklenen: PILOT_BEKLENEN, kaynak_id: pilotIdler.length, eksik: pilot.eksik });
  const kaynakToplam = Object.values(kaynakOzet).reduce((t, k) => t + k.ogeler.length, 0), mevcutKaynaksiz = mevcutOgeler.filter(m => !m.kaynakliSatir).length;
  const sayim = {
    kaynaklar: Object.fromEntries(Object.entries(kaynakOzet).map(([ad, k]) => [ad, k.sorular])),
    existing_d1: mevcut.length,
    expected_total: kaynakToplam + mevcutKaynaksiz + (mevcut.length - mevcutOgeler.length),
    new_insert: ekle.length, backfill: doldur.length, idempotent_noop: noop.length,
    kopya_guncelle: kopyaGuncelle.length,
    duplicate_content: hedefKopya.size, duplicate_content_groups: kopyaGruplari.length,
    q_only_duplicate_groups: qOnlyGruplar, q_only_duplicate_members: qOnlyUyeler, same_q_groups_total: tumTekrarGruplar,
    conflicts: catisma.length, invalid: gecersiz.length, sapma: sapma.length,
    final_total: ekle.length + mevcut.length, ...sayimlar
  };
  const basarili = !catisma.length && !gecersiz.length && !sapma.length;
  return { basarili, sayim, catisma, gecersiz, sapma, manifest, pilot, kopyaGruplari,
    /* içerik taşıyan kısım: yalnız uygula() kullanır, rapor() asla yazdırmaz */
    _ekle: ekle, _doldur: doldur, _kopyaGuncelle: kopyaGuncelle };
}

/* raporda soru metni, seçenek, a/x ASLA bulunmaz: yalnız sayı, kimlik ve hash */
export function rapor(plan) {
  const p = JSON.parse(JSON.stringify({ basarili: plan.basarili, sayim: plan.sayim, catisma: plan.catisma, gecersiz: plan.gecersiz, sapma: plan.sapma, manifest: plan.manifest,
    pilot: Object.assign({}, plan.pilot, { idler: undefined }), kopya_gruplari: plan.kopyaGruplari }));
  return p;
}

/* =====================================================================
   UYGULA: yalnız YEREL SQLite (DatabaseSync). Plan başarısızsa reddeder. Tek işlem: ya hepsi ya hiçbiri.
   ===================================================================== */
export async function uygula(db, plan) {
  if (!plan.basarili) throw new Error("Plan başarısız (çatışma/geçersiz/sapma): uygulama reddedildi, hiçbir şey yazılmadı.");
  const once = db.prepare("SELECT COUNT(*) AS n FROM soru").get().n;
  db.exec("BEGIN IMMEDIATE");
  try {
    const ins = db.prepare(`INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, grup, kopya_of) VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?)`);
    const simdi = Date.now();
    for (const e of plan._ekle) ins.run(e.q.id, e.q.s, String(e.q.t).trim(), e.q.d, DURUM_BANKA, simdi, e.kaynak, e.rk, e.h, govdeOf(e.q), e.q.a, String(e.q.x).trim(), e.kopya_of);
    /* eksik kanonik sütunları doldur; dolu olanlara (özellikle rk'ya) DOKUNMAZ */
    const dol = db.prepare("UPDATE soru SET kaynak = COALESCE(kaynak, ?), rk = COALESCE(rk, ?), h = COALESCE(h, ?), govde = COALESCE(govde, ?), a = COALESCE(a, ?), x = COALESCE(x, ?) WHERE id = ?");
    for (const d of plan._doldur) dol.run(d.kaynak, d.rk, d.h, govdeOf(d.q), d.q.a, String(d.q.x).trim(), d.id);
    const kop = db.prepare("UPDATE soru SET kopya_of = ? WHERE id = ?");
    for (const k of plan._kopyaGuncelle) kop.run(k.kopya_of, k.id);
    /* doğrulama (işlem içinde): sayı + her etkilenen satırın kanonik özeti */
    const sonra = db.prepare("SELECT COUNT(*) AS n FROM soru").get().n;
    if (sonra !== once + plan._ekle.length || sonra !== plan.sayim.final_total) throw new Error(`satır sayısı tutmuyor: ${once} + ${plan._ekle.length} != ${sonra}`);
    const oku = db.prepare("SELECT id, s, t, d, govde, a, x, h FROM soru WHERE id = ?");
    for (const e of [...plan._ekle, ...plan._doldur]) {
      const r = oku.get(e.id), q = Object.assign({ id: r.id, s: r.s, t: r.t, d: r.d }, JSON.parse(r.govde), { a: r.a, x: r.x });
      if ((await kanonikHash(q)) !== e.h || r.h !== e.h) throw new Error("yazılan satırın kanonik özeti uyuşmuyor: " + e.id);
    }
    /* pilot: yazıldıktan sonra içerik özeti, öncekiyle aynı olmalı */
    if (plan.pilot.kaynak_id) {
      const hs = []; for (const id of plan.pilot.idler) { const r = oku.get(id); if (!r || r.govde == null) throw new Error("pilot kaydı eksik: " + id); hs.push(await kanonikHash(Object.assign({ id: r.id, s: r.s, t: r.t, d: r.d }, JSON.parse(r.govde), { a: r.a, x: r.x }))); }
      if ((await ozet(hs.sort(kodSirasi))) !== plan.pilot.icerik_hash_once) throw new Error("pilot içerik özeti göçten sonra değişti");
    }
    db.exec("COMMIT");
    return { once, sonra, eklenen: plan._ekle.length, doldurulan: plan._doldur.length, kopya_guncellenen: plan._kopyaGuncelle.length };
  } catch (e) { try { db.exec("ROLLBACK"); } catch (_) { } throw e; }
}

/* =====================================================================
   GİRDİLER
   ===================================================================== */
/* Gömülü BANK: index.html'i yerel sunucudan çalıştırıp çıkarır. /api ve /sorular engellenir, yani YALNIZ gömülü banka. Deterministiktir. */
export async function gomuluBankaCikar(kok = KOK) {
  let pw; for (const taban of [process.cwd() + "/", "/opt/npm-tools/node_modules/"]) { try { pw = createRequire(taban)("playwright"); break; } catch (e) { } }
  if (!pw) throw new Error("playwright bulunamadı (gömülü banka çıkarılamaz). --embedded-json ile hazır çıktı verilebilir.");
  const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(fs.readFileSync(path.join(kok, "index.html"))); } r.statusCode = 404; r.end("yok"); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const b = await pw.chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] } : {});
  try {
    const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage();
    await p.route("**/api/**", r => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
    await p.route("**/sorular/**", r => r.fulfill({ status: 404, body: "yok" }));
    await p.goto("http://127.0.0.1:" + srv.address().port + "/", { waitUntil: "load" });
    await p.waitForFunction(() => typeof BANK !== "undefined" && BANK.length > 0, null, { timeout: 30000 }); await p.waitForTimeout(1500);
    return await p.evaluate(() => BANK.map(q => { const o = { id: q.id, s: q.s, t: q.t, d: q.d }; if (q.p) o.p = q.p; o.q = q.q; o.o = q.o.slice(); o.a = q.a; o.x = q.x; return o; }));
  } finally { await b.close(); srv.close(); }
}
export function statikKaynaklar(kok = KOK) {
  const dizin = path.join(kok, "sorular"), liste = JSON.parse(fs.readFileSync(path.join(dizin, "liste.json"), "utf8"));
  return liste.filter(f => /^[a-z0-9_-]+\.json$/i.test(f)).map(f => ({ ad: f.replace(/\.json$/i, ""), tur: "statik", sorular: JSON.parse(fs.readFileSync(path.join(dizin, f), "utf8")) }));
}
export function satirlariOku(db) { return db.prepare("SELECT * FROM soru ORDER BY id").all(); }
function satirDosyasi(yol) { const j = JSON.parse(fs.readFileSync(yol, "utf8")); return Array.isArray(j) && j[0] && Array.isArray(j[0].results) ? j[0].results : j; }

/* =====================================================================
   CLI
   ===================================================================== */
const cli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (cli) {
  const a = process.argv.slice(2), bayrak = k => a.includes(k), deger = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const apply = bayrak("--apply"), dbYol = deger("--db"), satirYol = deger("--d1-satirlar"), manifestYol = deger("--manifest"), embYol = deger("--embedded-json");
  if (apply && !dbYol) { console.error("--apply yalnız yerel --db <dosya.sqlite> ile çalışır. Uzak/üretim D1'e bağlanmaz."); process.exit(2); }
  if (dbYol && /^[a-z]+:\/\//i.test(dbYol)) { console.error("--db bir yerel dosya olmalı."); process.exit(2); }
  if (manifestYol && path.resolve(manifestYol).startsWith(KOK + path.sep)) { console.error("--manifest repo dışında bir yola yazılmalı (repoya bank artıkları girmesin)."); process.exit(2); }
  (async () => {
    let db = null, mevcut = [];
    if (dbYol) {
      const var_ = fs.existsSync(dbYol);
      if (!var_ && !apply) { console.error("Dry run için --db dosyası yok: " + dbYol); process.exit(2); }
      db = new DatabaseSync(dbYol, apply ? {} : { readOnly: true });
      if (apply) await soruKanonikSema(d1Yerel(db));
      mevcut = satirlariOku(db);
    } else if (satirYol) mevcut = satirDosyasi(satirYol);
    else console.error("UYARI: mevcut D1 satırları verilmedi (--db ya da --d1-satirlar); existing_d1 = 0 sayılıyor.");
    const gomulu = embYol ? JSON.parse(fs.readFileSync(embYol, "utf8")) : await gomuluBankaCikar();
    const plan = await planla({ kaynaklar: [{ ad: "embedded", tur: "gomulu", sorular: gomulu }, ...statikKaynaklar()], mevcut });
    const r = rapor(plan), s = r.sayim;
    if (bayrak("--json")) console.log(JSON.stringify(r, null, 1));
    else {
      console.log(`MOD: ${apply ? "APPLY (yerel)" : "DRY RUN"}`);
      for (const [ad, n] of Object.entries(s.kaynaklar)) console.log(`${ad}: ${n}`);
      console.log(`existing_d1: ${s.existing_d1}\nexpected_total: ${s.expected_total}\n\nnew_insert: ${s.new_insert}\nbackfill: ${s.backfill}\nidempotent_noop: ${s.idempotent_noop}\nduplicate_content: ${s.duplicate_content} (${s.duplicate_content_groups} grup)\nq_only_duplicate: ${s.q_only_duplicate_groups} grup / ${s.q_only_duplicate_members} soru\nconflicts: ${s.conflicts}\ninvalid: ${s.invalid}\nsapma: ${s.sapma}\n\nfinal_total: ${s.final_total}`);
      console.log(`pilot: beklenen ${r.pilot.beklenen} · kaynak ${r.pilot.kaynak_id} · hedef ${r.pilot.hedef_id} · eksik ${r.pilot.eksik}`);
      for (const c of r.catisma.slice(0, 20)) console.log("  ÇATIŞMA", JSON.stringify(c));
      for (const g of r.gecersiz.slice(0, 20)) console.log("  GEÇERSİZ", g.kaynak, g.id, g.hatalar.join("; "));
      for (const x of r.sapma) console.log("  SAPMA", JSON.stringify(x));
      console.log(`SONUÇ: ${r.basarili ? "BAŞARILI" : "BAŞARISIZ"}`);
    }
    if (manifestYol) fs.writeFileSync(manifestYol, JSON.stringify(r.manifest, null, 1));
    if (apply && plan.basarili) { const u = await uygula(db, plan); console.log("UYGULANDI (yerel): " + JSON.stringify(u)); }
    if (db) db.close();
    process.exit(plan.basarili ? 0 : 1);
  })().catch(e => { console.error("HATA:", e.message); process.exit(1); });
}
