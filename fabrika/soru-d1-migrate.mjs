// AKE Akademi · korumalı soru bankası · D1 göç OPERASYON hattı (PR 4/6)
//
// Planlama/doğrulama/hash mantığı fabrika/soru-migrate.mjs ve lib/soru-kanonik.js'tedir; burada TEKRAR YAZILMAZ (planla, rapor, kanonikHash...).
// Bu dosya yalnız: D1'e bağlanma (Cloudflare REST / yerel SQLite / Miniflare), kimlik koruması, salt-okuma preflight, yedek, kapılı apply,
// parçalı (chunk) idempotent yazım ve apply sonrası doğrulama işlerini yapar.
//
// GÜVENLİ VARSAYILAN = SALT OKUMA. Bayraksız çalıştırma hiçbir yere bağlanmaz; --apply yoksa D1 sürücüsü fiziksel olarak salt-okunurdur
// (yazma ifadeleri prepare() aşamasında reddedilir). Apply için ÇOK kapı gerekir (bkz. kapilariDegerlendir). AKE_SORU_V2'ye ve herhangi bir
// ortam değişkenine/bayrağa DOKUNMAZ. Üretime karşı bu PR'da çalıştırılmaz.
//
// Kullanım (ayrıntı: docs/soru-bankasi-production-migration.md):
//   node fabrika/soru-d1-migrate.mjs --remote --environment production --db-id <id> --db-name <ad>            # preflight + dry-run (salt okuma)
//   ... --backup-out /gizli/yedek.json                                                                        # salt-okuma export (soru metni içerir: repo DIŞINDA)
//   ... --backup-file /gizli/yedek.json                                                                       # dry-run + onay belirteci
//   ... --backup-file F --apply --confirm <belirteç> --expect-pre-count <N> --freeze-confirmed --recovery-manifest-out F   # APPLY
//   --local-db <dosya.sqlite>  yerel prova (uzak API yok)   --manifest-out <yol>  --chunk <n>  --embedded-json <yol>  --json
// Gizli bilgiler: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (yalnız ortamdan; asla basılmaz), AKE_MIGRATE_PRODUCTION_DB_ID (üretim kimliği).
// Çıkış kodu: 0 başarılı · 1 kapı/plan/doğrulama başarısız · 2 kullanım hatası · 3 HARD STOP (yanlış veritabanı/ortam).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { planla, rapor, satirdanSoru, gomuluBankaCikar, statikKaynaklar } from "./soru-migrate.mjs";
import { soruKanonikSema, govdeOf, kanonikHash, cevapHash } from "../lib/soru-kanonik.js";
import { SEMA_SQL } from "../lib/soru-api.js";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const sirala = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const DOLU = ["kaynak", "rk", "h", "govde", "a", "x"];
export const VARSAYILAN_PARCA = 40, EN_COK_PARCA = 50;   // D1 batch: Workers ücretsiz planda çağrı başına 50 sorgu; ifade başına ≤100 bağlı parametre, ≤100 KB SQL
export class HardStop extends Error { constructor(m) { super(m); this.name = "HardStop"; } }

/* ---------------- salt-okuma sarmalayıcı: dry-run'da yazma FİZİKSEL olarak imkânsız ---------------- */
const OKUMA = /^\s*(SELECT|PRAGMA\s+table_(x)?info|EXPLAIN)\b/i;
export function saltOkunur(d1, sayac = { engellenen: 0 }) {
  return {
    sayac,
    prepare(sql) { if (!OKUMA.test(sql) || /;\s*\S/.test(String(sql).trim())) { sayac.engellenen++; throw new Error("SALT-OKUMA: yazma/şema ifadesi engellendi"); } return d1.prepare(sql); },
    async batch(arr) { return d1.batch(arr); }
  };
}

/* ---------------- sürücüler (hepsi D1 benzeri: prepare().bind().first/all/run + batch) ---------------- */
const API = "https://api.cloudflare.com/client/v4";
export function cloudflareSurucu({ hesap, dbId, token, fetchFn = globalThis.fetch }) {
  if (!hesap || !dbId || !token) throw new HardStop("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / --db-id eksik");
  const temiz = m => String(m).split(token).join("[gizli]");
  /* beklenen: /query için beklenen sonuç sayısı (tek sorgu 1, batch = ifade sayısı); null = dizi beklenmez (kimlik/bookmark GET).
     Üst düzey success TEK BAŞINA yetmez: result dizisi, uzunluk ve HER result[i].success === true doğrulanır (eksik/bozuk = hata). */
  const cagri = async (yol, yontem, govde, beklenen = null) => {
    const r = await fetchFn(`${API}/accounts/${hesap}/d1/database/${dbId}${yol}`, { method: yontem, headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: govde ? JSON.stringify(govde) : undefined });
    let j; try { j = await r.json(); } catch (e) { throw new Error("Cloudflare yanıtı çözülemedi (HTTP " + r.status + ")"); }
    if (!r.ok || !j || !j.success) throw new Error(temiz("Cloudflare D1 hatası (HTTP " + r.status + "): " + (((j && j.errors) || []).map(e => e.message).join("; ") || "bilinmiyor")));
    if (beklenen !== null) {
      if (!Array.isArray(j.result)) throw new Error("Cloudflare D1 yanıtı bozuk: result dizisi yok");
      if (j.result.length !== beklenen) throw new Error(`Cloudflare D1 yanıtı bozuk: ${beklenen} sonuç beklendi, ${j.result.length} geldi`);
      j.result.forEach((x, i) => { if (!x || typeof x !== "object" || x.success !== true) throw new Error(temiz(`Cloudflare D1 sorgu #${i + 1} başarısız` + (x && x.error ? ": " + x.error : ""))); });
    }
    return j.result;
  };
  const st = (sql, a = []) => ({ _sql: sql, _a: a, bind: (...x) => st(sql, x),
    first: async () => { const r = await cagri("/query", "POST", { sql, params: a }, 1); return (r[0].results || [])[0] || null; },
    all: async () => { const r = await cagri("/query", "POST", { sql, params: a }, 1); return { results: r[0].results || [] }; },
    run: async () => { const r = await cagri("/query", "POST", { sql, params: a }, 1); return { meta: { changes: (r[0].meta || {}).changes } }; } });
  return { tur: "remote", kimlik: async () => { const r = await cagri("", "GET"); return { id: r.uuid, name: r.name }; },
    /* Time Travel: YALNIZ güncel bookmark okunur (GET). Restore bu araçta YOKTUR. Desteklenmiyorsa/alınamıyorsa null. */
    bookmarkAl: async () => { try { const r = await cagri("/time_travel/bookmark", "GET"); return r && typeof r.bookmark === "string" && r.bookmark ? r.bookmark : null; } catch (e) { return null; } },
    d1: { prepare: sql => st(sql), batch: async arr => cagri("/query", "POST", { batch: arr.map(s => ({ sql: s._sql, params: s._a })) }, arr.length) } };
}
/* yerel SQLite dosyası/bellek (staging provası ve testler). batch = tek işlem */
export function sqliteSurucu(db, { id = "yerel", name = "yerel" } = {}) {
  const st = (sql, a = []) => ({ _sql: sql, _a: a, bind: (...x) => st(sql, x),
    first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
  return { tur: "local", kimlik: async () => ({ id, name }),
    d1: { prepare: sql => st(sql), batch: async arr => { db.exec("BEGIN"); try { const o = []; for (const s of arr) { if (/^\s*(SELECT|PRAGMA)/i.test(s._sql)) o.push({ results: db.prepare(s._sql).all(...s._a) }); else { const r = db.prepare(s._sql).run(...s._a); o.push({ meta: { changes: r.changes } }); } } db.exec("COMMIT"); return o; } catch (e) { try { db.exec("ROLLBACK"); } catch (_) { } throw e; } } } };
}
/* Miniflare/workerd D1 nesnesi ya da başka D1: doğrudan sar */
export const d1Surucu = (d1, { id, name }) => ({ tur: "local", kimlik: async () => ({ id, name }), d1 });

/* ---------------- kimlik / ortam koruması ---------------- */
export async function kimlikDogrula({ surucu, ortam, beklenen, uretimId }) {
  if (!["production", "staging", "local"].includes(ortam)) throw new HardStop("--environment production|staging|local zorunlu");
  if (!beklenen || !beklenen.id || !beklenen.name) throw new HardStop("--db-id ve --db-name zorunlu (beklenen veritabanı kimliği)");
  const k = await surucu.kimlik();
  if (k.id !== beklenen.id || k.name !== beklenen.name) throw new HardStop("YANLIŞ VERİTABANI: bağlanılan D1, beklenen kimlik/ad ile uyuşmuyor");
  if (ortam === "production") {
    if (!uretimId) throw new HardStop("AKE_MIGRATE_PRODUCTION_DB_ID tanımlı değil: üretim kimliği doğrulanamaz");
    if (k.id !== uretimId) throw new HardStop("YANLIŞ ORTAM: --environment production ama veritabanı üretim kimliği değil");
  } else if (uretimId && k.id === uretimId) throw new HardStop("YANLIŞ ORTAM: --environment " + ortam + " ama bu veritabanı ÜRETİM veritabanı");
  if (surucu.tur === "remote" && ortam === "local") throw new HardStop("uzak veritabanı için --environment local olamaz");
  return k;
}

/* ---------------- yapı koruması: soru tablosu VAR ve legacy temel kolonları tam olmalı; araç sıfırdan tablo KURMAZ ---------------- */
export const LEGACY_KOLONLAR = ["id", "s", "t", "d", "json", "durum", "tarih", "karar"];
export async function yapiDogrula(d1, { bootstrap = false } = {}) {
  const varMi = !!(await d1.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'soru'").first());
  if (!varMi) { if (bootstrap) return { bootstrap: true }; throw new HardStop("`soru` tablosu YOK: araç sıfırdan tablo kurmaz (yanlış/bozuk veritabanı olabilir)"); }
  const kol = new Set((await d1.prepare("PRAGMA table_info(soru)").all()).results.map(r => r.name));
  const eksik = LEGACY_KOLONLAR.filter(c => !kol.has(c));
  if (eksik.length) throw new HardStop("`soru` tablosunda legacy temel kolon(lar) eksik: " + eksik.join(", "));
  return { bootstrap: false, kolonlar: [...kol] };
}

/* ---------------- okuma ---------------- */
export async function tabloVarMi(d1) { return !!(await d1.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'soru'").first()); }
export async function satirlariOku(d1) {
  if (!(await tabloVarMi(d1))) return [];
  const rows = []; let son = "";
  for (;;) { const { results } = await d1.prepare("SELECT * FROM soru WHERE id > ? ORDER BY id LIMIT 200").bind(son).all(); if (!results.length) break; rows.push(...results); son = results[results.length - 1].id; }
  return rows;
}
const satirlarOzeti = rows => sha(JSON.stringify([...rows].sort((a, b) => sirala(a.id, b.id))));
const legacyApiOzeti = rows => sha(rows.filter(r => r.durum === "onayli").sort((a, b) => sirala(a.id, b.id)).map(r => r.id + "\u0001" + (r.json == null ? "" : r.json)).join("\n"));
export async function kaynaklariTopla(embeddedJson) {
  const gomulu = embeddedJson ? JSON.parse(fs.readFileSync(embeddedJson, "utf8")) : await gomuluBankaCikar();
  return [{ ad: "embedded", tur: "gomulu", sorular: gomulu }, ...statikKaynaklar()];
}

/* ---------------- preflight raporu (soru metni YOK: yalnız sayı/hash) ---------------- */
export async function preflight({ d1, kimlik, ortam, kaynaklar }) {
  const rows = await satirlariOku(d1), plan = await planla({ kaynaklar, mevcut: rows }), r = rapor(plan);
  const durum = { onayli: 0, bekliyor: 0, red: 0, banka: 0, diger: 0 }; for (const w of rows) durum[w.durum in durum ? w.durum : "diger"]++;
  const tam = rows.filter(w => DOLU.every(c => w[c] != null)).length;
  const kaynakIdleri = new Set(); for (const k of kaynaklar) for (const q of k.sorular) if (q && q.id) kaynakIdleri.add(q.id);
  const sayim = r.sayim;
  return { rows, plan, rapor: r, ozet: {
    veritabani: kimlik.name + " (" + kimlik.id.slice(0, 8) + "…)", ortam, mevcut_toplam: rows.length, durum, canonical_tam: tam, canonical_eksik: rows.length - tam,
    kaynak_toplam: Object.values(sayim.kaynaklar).reduce((t, n) => t + n, 0), kaynaklar: sayim.kaynaklar, id_cakisma: rows.filter(w => kaynakIdleri.has(w.id)).length,
    yeni_ekleme: sayim.new_insert, backfill: sayim.backfill, idempotent_noop: sayim.idempotent_noop, kopya_guncelle: sayim.kopya_guncelle, duplicate: sayim.duplicate_content, conflict: sayim.conflicts, invalid: sayim.invalid, sapma: sayim.sapma,
    beklenen_final: sayim.final_total, beklenen_final_kontrol: sayim.expected_total, durum_hash: satirlarOzeti(rows) } };
}

/* ---------------- yedek (private dosya; repo'ya girmez) ---------------- */
function repoDisi(yol, ad) { const y = path.resolve(yol); if (y === KOK || y.startsWith(KOK + path.sep)) throw new Error(ad + " repo DIŞINDA bir yol olmalı (soru metni repoya girmesin)"); return y; }
export async function yedekAl({ d1, kimlik, ortam, yol }) {
  const y = repoDisi(yol, "--backup-out"); if (fs.existsSync(y)) throw new Error("--backup-out zaten var: üzerine yazılmaz");
  const rows = await satirlariOku(d1);
  const sema = (await d1.prepare("PRAGMA table_info(soru)").all()).results;
  const durum = {}; for (const w of rows) durum[w.durum] = (durum[w.durum] || 0) + 1;
  const meta = { surum: 1, olusturma: new Date().toISOString(), veritabani_id: kimlik.id, veritabani_adi: kimlik.name, ortam, satir_sayisi: rows.length, durum_dagilimi: durum, canonical_dolu: rows.filter(w => DOLU.every(c => w[c] != null)).length, sutunlar: sema.map(c => c.name), durum_hash: satirlarOzeti(rows) };
  fs.writeFileSync(y, JSON.stringify({ meta, rows }), { mode: 0o600, flag: "wx" });
  return { yol: y, sha256: sha(fs.readFileSync(y)), meta };
}
export function yedekOku(yol) {
  const y = path.resolve(yol); if (!fs.existsSync(y)) throw new Error("yedek dosyası yok: " + yol);
  const buf = fs.readFileSync(y); let j; try { j = JSON.parse(buf); } catch (e) { throw new Error("yedek dosyası çözülemedi"); }
  if (!j.meta || !Array.isArray(j.rows) || j.meta.satir_sayisi !== j.rows.length) throw new Error("yedek dosyası tutarsız");
  return { sha256: sha(buf), meta: j.meta };
}

/* ---------------- kurtarma manifesti: İLK YAZMADAN ÖNCE (şema ALTER dahil) yazılır; soru metni YOK; 0600; üzerine yazılmaz ---------------- */
export function kurtarmaManifestiYaz({ yol, kimlik, ortam, ozet, plan, yedek, bookmark }) {
  const y = repoDisi(yol, "--recovery-manifest-out"); if (fs.existsSync(y)) throw new Error("--recovery-manifest-out zaten var: üzerine yazılmaz");
  const m = { surum: 1, durum: "planned", olusturma: new Date().toISOString(), veritabani_id: kimlik.id, veritabani_adi: kimlik.name, ortam,
    on_sayim: ozet.mevcut_toplam, on_durum_hash: ozet.durum_hash, yedek_sha256: yedek.sha256, beklenen_final: ozet.beklenen_final, kaynak_sayilari: ozet.kaynaklar,
    time_travel_bookmark: bookmark || null,
    planlanan_ekleme_idleri: plan._ekle.map(e => e.id).sort(sirala), planlanan_backfill_idleri: plan._doldur.map(d => d.id).sort(sirala), planlanan_kopya_of_idleri: plan._kopyaGuncelle.map(k => k.id).sort(sirala) };
  fs.writeFileSync(y, JSON.stringify(m, null, 1), { mode: 0o600, flag: "wx" });
  return { yol: y, manifest: m };
}
/* atomik güncelleme: geçici dosya (0600) + rename; başarısızlıkta eski içerik bozulmaz */
export function kurtarmaManifestiGuncelle(yol, ek) {
  const y = path.resolve(yol), m = Object.assign(JSON.parse(fs.readFileSync(y, "utf8")), ek), tmp = y + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(m, null, 1), { mode: 0o600, flag: "w" }); fs.renameSync(tmp, y); return m;
}

/* ---------------- onay belirteci + apply kapıları ---------------- */
export const onayBelirteci = ({ kimlikId, ortam, onSayim, beklenenFinal, yedekSha }) => sha(["ake-soru-migrate-v1", kimlikId, ortam, onSayim, beklenenFinal, yedekSha].join("|")).slice(0, 20);
/* Apply YALNIZ tüm kapılar true ise. Her kapı adıyla raporlanır; biri yoksa apply RED. */
export function kapilariDegerlendir({ ozet, kimlikId, ortam, secenek, yedek }) {
  const k = [];
  const ekle = (ad, ok, ek) => k.push({ ad, ok: !!ok, ek: ek || "" });
  ekle("conflict == 0", ozet.conflict === 0, ozet.conflict); ekle("invalid == 0", ozet.invalid === 0, ozet.invalid); ekle("kaynak sapması == 0", ozet.sapma === 0, ozet.sapma);
  ekle("beklenen final hesaplandı ve tutarlı", Number.isInteger(ozet.beklenen_final) && ozet.beklenen_final === ozet.beklenen_final_kontrol, ozet.beklenen_final + " / " + ozet.beklenen_final_kontrol);
  ekle("--apply verildi", secenek.apply === true);
  ekle("yedek dosyası var ve okundu", !!yedek); ekle("yedek hash'i biliniyor", !!(yedek && yedek.sha256));
  ekle("yedek satır sayısı == mevcut satır sayısı", !!yedek && yedek.meta.satir_sayisi === ozet.mevcut_toplam, yedek ? yedek.meta.satir_sayisi + " / " + ozet.mevcut_toplam : "");
  ekle("yedekten sonra veri değişmemiş (durum hash)", !!yedek && yedek.meta.durum_hash === ozet.durum_hash);
  ekle("yedek bu veritabanından", !!yedek && yedek.meta.veritabani_id === kimlikId && yedek.meta.ortam === ortam);
  ekle("admin yazma dondurması onaylandı (--freeze-confirmed)", secenek.freeze === true);
  let kurtarmaOk = false; try { if (secenek.kurtarmaManifest) { const y = repoDisi(secenek.kurtarmaManifest, "--recovery-manifest-out"); kurtarmaOk = !fs.existsSync(y) && fs.existsSync(path.dirname(y)); } } catch (e) { }
  ekle("kurtarma manifesti yolu (--recovery-manifest-out: repo dışı, yeni dosya, dizin var)", kurtarmaOk);
  ekle("ön sayım operatörce doğrulandı (--expect-pre-count)", Number.isInteger(secenek.beklenenOnSayim) && secenek.beklenenOnSayim === ozet.mevcut_toplam, String(secenek.beklenenOnSayim));
  const bel = yedek ? onayBelirteci({ kimlikId, ortam, onSayim: ozet.mevcut_toplam, beklenenFinal: ozet.beklenen_final, yedekSha: yedek.sha256 }) : null;
  ekle("onay belirteci (--confirm) eşleşiyor", !!bel && secenek.confirm === bel);
  return { izinli: k.every(x => x.ok), kapilar: k, belirtec: bel };
}

/* ---------------- yazma: şema → parçalı idempotent veri → indeks ---------------- */
const sicrama = async (f, n = 3) => { let e; for (let i = 0; i < n; i++) { try { return await f(); } catch (x) { e = x; } } throw e; };
/* Her ifade TEKRAR ÇALIŞTIRILABİLİR: ekleme yalnız kimlik yoksa, doldurma yalnız boşsa (COALESCE), kopya_of sabit değer atar. */
export function yazmaIfadeleri(d1, plan) {
  const simdi = Date.now(), st = [];
  const ins = "INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, grup, kopya_of) SELECT ?, ?, ?, ?, NULL, 'banka', ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ? WHERE NOT EXISTS (SELECT 1 FROM soru WHERE id = ?)";
  for (const e of plan._ekle) st.push(d1.prepare(ins).bind(e.q.id, e.q.s, String(e.q.t).trim(), e.q.d, simdi, e.kaynak, e.rk, e.h, govdeOf(e.q), e.q.a, String(e.q.x).trim(), e.kopya_of, e.q.id));
  const dol = "UPDATE soru SET kaynak = COALESCE(kaynak, ?), rk = COALESCE(rk, ?), h = COALESCE(h, ?), govde = COALESCE(govde, ?), a = COALESCE(a, ?), x = COALESCE(x, ?) WHERE id = ?";
  for (const d of plan._doldur) st.push(d1.prepare(dol).bind(d.kaynak, d.rk, d.h, govdeOf(d.q), d.q.a, String(d.q.x).trim(), d.id));
  for (const k of plan._kopyaGuncelle) st.push(d1.prepare("UPDATE soru SET kopya_of = ? WHERE id = ?").bind(k.kopya_of, k.id));
  return st;
}
export async function uygula({ d1, plan, parca = VARSAYILAN_PARCA, log = () => { } }) {
  if (!plan.basarili) throw new Error("Plan başarısız (çatışma/geçersiz/sapma): apply reddedildi, hiçbir şey yazılmadı.");
  const n = Math.max(1, Math.min(EN_COK_PARCA, parca | 0 || VARSAYILAN_PARCA));
  await soruKanonikSema(d1); log("şema hazır (yalnız nullable kolon ekleme; yıkıcı değişiklik yok)");
  const hepsi = yazmaIfadeleri(d1, plan), parcalar = []; for (let i = 0; i < hepsi.length; i += n) parcalar.push(hepsi.slice(i, i + n));
  let yapilan = 0;
  for (let i = 0; i < parcalar.length; i++) {
    try { await sicrama(() => d1.batch(parcalar[i])); }
    catch (e) { const h = new Error(`parça ${i + 1}/${parcalar.length} başarısız (${yapilan} ifade yazıldı): yeniden çalıştırmak güvenlidir (plan veritabanı durumundan yeniden hesaplanır): ` + String(e.message).slice(0, 160)); h.parca = i + 1; throw h; }
    yapilan += parcalar[i].length; log(`parça ${i + 1}/${parcalar.length} tamam`);
  }
  const indeksler = SEMA_SQL.filter(s => /^CREATE INDEX IF NOT EXISTS soru_sec_/.test(s));
  await sicrama(() => d1.batch(indeksler.map(s => d1.prepare(s)))); log("indeksler tamam");
  return { ifade: hepsi.length, parca: parcalar.length, eklenen: plan._ekle.length, doldurulan: plan._doldur.length, kopya_guncellenen: plan._kopyaGuncelle.length, eklenen_idler: plan._ekle.map(e => e.id).sort(sirala) };
}

/* ---------------- apply sonrası doğrulama ---------------- */
export async function dogrula({ d1, onceki, kaynaklar, plan }) {
  const rows = await satirlariOku(d1), k = [], ekle = (ad, ok, ek) => k.push({ ad, ok: !!ok, ek: ek === undefined ? "" : String(ek) });
  const onceMap = new Map(onceki.rows.map(r => [r.id, r])), sonraMap = new Map(rows.map(r => [r.id, r]));
  ekle("satır sayısı beklenenle aynı", rows.length === plan.sayim.final_total, rows.length + " / " + plan.sayim.final_total);
  const kaynakIdler = new Set(); for (const s of kaynaklar) for (const q of s.sorular) kaynakIdler.add(q.id);
  ekle("static/embedded tüm kimlikler mevcut", [...kaynakIdler].every(id => sonraMap.has(id)), [...kaynakIdler].filter(id => !sonraMap.has(id)).length + " eksik");
  const pilotKaynak = kaynaklar.find(s => s.ad === "pilot-100"), pilotIdler = pilotKaynak ? pilotKaynak.sorular.map(q => q.id) : [];
  ekle("Pilot 100/100", pilotIdler.length === 100 && pilotIdler.every(id => sonraMap.has(id)), pilotIdler.filter(id => sonraMap.has(id)).length + "/" + pilotIdler.length);
  if (pilotKaynak) { const hs = []; for (const id of pilotIdler) hs.push(await kanonikHash(satirdanSoru(sonraMap.get(id)))); ekle("Pilot içerik özeti değişmedi", sha(hs.sort(sirala).join("\n")) === sha((await Promise.all(pilotKaynak.sorular.map(q => kanonikHash(q)))).sort(sirala).join("\n"))); }
  ekle("canonical alanlar tüm satırlarda dolu", rows.every(r => DOLU.every(c => r[c] != null)), rows.filter(r => !DOLU.every(c => r[c] != null)).length + " eksik");
  ekle("eligible satırlarda h/rk/govde/a/x eksiği yok", rows.filter(r => ["banka", "onayli"].includes(r.durum) && r.kopya_of == null).every(r => DOLU.every(c => r[c] != null)));
  const koru = onceki.rows.every(r => { const s = sonraMap.get(r.id); return s && ["json", "durum", "tarih", "karar", "s", "t", "d"].every(c => (s[c] ?? null) === (r[c] ?? null)); });
  ekle("migration öncesi satırlar (legacy json/durum/tarih) korunmuş", koru, onceki.rows.length + " satır");
  ekle("legacy /api/sorular çıktısı aynı (durum='onayli' json özeti)", legacyApiOzeti(rows) === legacyApiOzeti(onceki.rows));
  const bankaOnce = onceki.rows.filter(r => r.durum === "banka").length;
  ekle("içe aktarılan satırlar durum='banka'", rows.filter(r => r.durum === "banka").length === bankaOnce + plan.sayim.new_insert, rows.filter(r => r.durum === "banka").length + " / " + (bankaOnce + plan.sayim.new_insert));
  /* planı SON durumdan yeniden hesapla: çatışma/geçersiz 0, yapılacak iş 0 (= kopya_of'lar doğru, hepsi idempotent) */
  const p2 = await planla({ kaynaklar, mevcut: rows }), s2 = p2.sayim;
  ekle("yeniden plan: çatışma 0, geçersiz 0, sapma 0", s2.conflicts === 0 && s2.invalid === 0 && s2.sapma === 0, `${s2.conflicts}/${s2.invalid}/${s2.sapma}`);
  ekle("yeniden plan: yeni 0, doldurma 0, kopya_of düzeltmesi 0 (duplicate politikası doğru)", s2.new_insert === 0 && s2.backfill === 0 && s2.kopya_guncelle === 0, `${s2.new_insert}/${s2.backfill}/${s2.kopya_guncelle}`);
  ekle("kopya sayısı planla aynı", s2.duplicate_content === plan.sayim.duplicate_content, s2.duplicate_content + " / " + plan.sayim.duplicate_content);
  const hler = [], hallar = [];
  for (const r of rows) { const q = satirdanSoru(r); hler.push(await kanonikHash(q)); hallar.push(await cevapHash(q)); }
  const manifest = { satir_sayisi: rows.length, id_hash: sha(rows.map(r => r.id).sort(sirala).join("\n")), icerik_hash: sha(hler.sort(sirala).join("\n")), cevap_hash: sha(hallar.sort(sirala).join("\n")), legacy_api_hash: legacyApiOzeti(rows) };
  return { ok: k.every(x => x.ok), kontroller: k, manifest };
}

/* ---------------- ana akış (CLI ve testler bunu çağırır) ---------------- */
export async function calistir({ surucu, ortam, beklenen, uretimId, secenek = {}, kaynaklar, cikti = console.log }) {
  const sonuc = { cikis: 0 };
  const kimlik = await kimlikDogrula({ surucu, ortam, beklenen, uretimId });
  await yapiDogrula(saltOkunur(surucu.d1), { bootstrap: secenek.bootstrap === true && surucu.tur === "local" });   // tablo/legacy kolon yoksa HARD STOP (yazma öncesi)
  cikti(`MOD: ${secenek.apply ? "APPLY istendi (kapılar denetlenecek)" : "SALT OKUMA / DRY-RUN"} · ortam: ${ortam} · veritabanı: ${kimlik.name} (${kimlik.id.slice(0, 8)}…)`);
  const pf = await preflight({ d1: saltOkunur(surucu.d1), kimlik, ortam, kaynaklar });   // preflight/dry-run: fiziksel salt-okuma; yazma yalnız uygula() içinde
  sonuc.preflight = pf.ozet; sonuc.plan = pf.plan;
  const o = pf.ozet;
  cikti(`mevcut toplam: ${o.mevcut_toplam} (onayli ${o.durum.onayli} · bekliyor ${o.durum.bekliyor} · red ${o.durum.red} · banka ${o.durum.banka} · diğer ${o.durum.diger})`);
  cikti(`canonical tam: ${o.canonical_tam} · eksik: ${o.canonical_eksik}`);
  cikti(`kaynak: ${Object.entries(o.kaynaklar).map(([a, n]) => a + " " + n).join(" · ")} (toplam ${o.kaynak_toplam}) · kimlik çakışması: ${o.id_cakisma}`);
  cikti(`yeni ekleme: ${o.yeni_ekleme} · backfill: ${o.backfill} · idempotent no-op: ${o.idempotent_noop} · kopya_of düzeltme: ${o.kopya_guncelle}`);
  cikti(`duplicate: ${o.duplicate} · conflict: ${o.conflict} · invalid: ${o.invalid} · sapma: ${o.sapma}`);
  cikti(`beklenen final toplam: ${o.beklenen_final} (dinamik: mevcut ${o.mevcut_toplam} + yeni ${o.yeni_ekleme})`);
  if (secenek.yedekCikis) { const y = await yedekAl({ d1: saltOkunur(surucu.d1), kimlik, ortam, yol: secenek.yedekCikis }); sonuc.yedek = y; cikti(`YEDEK yazıldı (private, 0600): satır ${y.meta.satir_sayisi} · sha256 ${y.sha256}`); }
  let yedek = null; if (secenek.yedekDosya) { yedek = yedekOku(secenek.yedekDosya); cikti(`yedek: satır ${yedek.meta.satir_sayisi} · sha256 ${yedek.sha256}`); }
  const g = kapilariDegerlendir({ ozet: o, kimlikId: kimlik.id, ortam, secenek, yedek }); sonuc.kapilar = g;
  if (g.belirtec && !secenek.apply) cikti("ONAY BELİRTECİ (apply için --confirm): " + g.belirtec);
  if (typeof surucu.bookmarkAl === "function") { const b = await surucu.bookmarkAl(); sonuc.bookmarkVar = !!b; cikti(`Time Travel bookmark (salt okuma GET): ${b ? "alınabildi" : "ALINAMADI/desteklenmiyor"}`); }
  if (!secenek.apply) {
    cikti(`DRY-RUN SONUCU: ${pf.plan.basarili ? "plan başarılı (apply için kapılar ayrıca gerekir)" : "PLAN BAŞARISIZ: çatışma/geçersiz/sapma var, apply reddedilir"}`);
    sonuc.cikis = pf.plan.basarili ? 0 : 1; return sonuc;
  }
  for (const x of g.kapilar) cikti(`  kapı ${x.ok ? "TAMAM" : "RED  "}: ${x.ad}${x.ek && !x.ok ? " (" + x.ek + ")" : ""}`);
  if (!g.izinli) { cikti("APPLY REDDEDİLDİ: hiçbir şey yazılmadı."); sonuc.cikis = 1; return sonuc; }
  /* İLK YAZMADAN ÖNCE: Time Travel bookmark + kurtarma manifesti. Biri başarısız olursa hiçbir production yazması başlamaz. */
  let bookmark = null; if (typeof surucu.bookmarkAl === "function") bookmark = await surucu.bookmarkAl();
  if (ortam === "production" && !bookmark) throw new HardStop("Time Travel bookmark alınamadı (destek yok/erişim yok): bookmark'sız production apply YAPILMAZ. Ayrı, doğrulanmış manuel yedek şartını runbook'a göre karşıla.");
  const km = kurtarmaManifestiYaz({ yol: secenek.kurtarmaManifest, kimlik, ortam, ozet: o, plan: pf.plan, yedek, bookmark }); sonuc.kurtarma = km;
  cikti(`kurtarma manifesti yazıldı (0600, yalnız kimlik/sayı/hash; soru metni yok) · bookmark: ${bookmark ? "kaydedildi" : "yok (yalnız staging/local)"}`);
  let u; try { u = await uygula({ d1: surucu.d1, plan: pf.plan, parca: secenek.parca, log: m => cikti("  " + m) }); }
  catch (e) { try { kurtarmaManifestiGuncelle(km.yol, { durum: "basarisiz_kismi_olabilir", hata_zamani: new Date().toISOString(), hata: String(e.message).slice(0, 200) }); } catch (_) { } throw e; }
  sonuc.uygulama = u;
  cikti(`UYGULANDI: eklenen ${u.eklenen} · doldurulan ${u.doldurulan} · kopya_of ${u.kopya_guncellenen} · ${u.parca} parça`);
  const v = await dogrula({ d1: saltOkunur(surucu.d1), onceki: { rows: pf.rows }, kaynaklar, plan: pf.plan }); sonuc.dogrulama = v;
  for (const x of v.kontroller) cikti(`  doğrulama ${x.ok ? "TAMAM" : "KALDI"}: ${x.ad}${x.ek ? " [" + x.ek + "]" : ""}`);
  cikti(`DOĞRULAMA: ${v.ok ? "BAŞARILI" : "BAŞARISIZ (otomatik rollback YOK; runbook'a bak)"}`);
  try { kurtarmaManifestiGuncelle(km.yol, { durum: v.ok ? "completed" : "tamamlandi_dogrulama_basarisiz", tamamlanma: new Date().toISOString(), sonra: v.manifest }); } catch (e) { cikti("UYARI: kurtarma manifesti güncellenemedi (planned kaldı): " + String(e.message).slice(0, 80)); }
  if (secenek.manifestCikis) { const y = repoDisi(secenek.manifestCikis, "--manifest-out"); fs.writeFileSync(y, JSON.stringify({ olusturma: new Date().toISOString(), veritabani_id: kimlik.id, ortam, once: { satir_sayisi: pf.rows.length, durum_hash: o.durum_hash }, sonra: v.manifest, eklenen_idler: u.eklenen_idler }, null, 1), { mode: 0o600 }); cikti("manifest yazıldı (yalnız hash/sayı/kimlik)"); }
  cikti("AKE_SORU_V2 DEĞİŞTİRİLMEDİ. Bir sonraki adım: insan onayı → AKE_SORU_V2 açma ayrı bir manuel adımdır.");
  sonuc.cikis = v.ok ? 0 : 1; return sonuc;
}

/* ---------------- CLI ---------------- */
const cli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (cli) {
  const a = process.argv.slice(2), bayrak = k => a.includes(k), deger = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const yardim = "Kullanım: node fabrika/soru-d1-migrate.mjs (--remote | --local-db <dosya>) --environment production|staging|local --db-id <id> --db-name <ad> [--backup-out F] [--backup-file F] [--apply --confirm T --expect-pre-count N --freeze-confirmed --recovery-manifest-out F] [--manifest-out F] [--chunk N] [--embedded-json F]\nBayraksız çalıştırma hiçbir yere bağlanmaz ve hiçbir şey yazmaz. Ayrıntı: docs/soru-bankasi-production-migration.md";
  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  const redakte = m => { m = String(m); return token ? m.split(token).join("[gizli]") : m; };
  (async () => {
    if (!bayrak("--remote") && !deger("--local-db")) { console.error(yardim); process.exit(2); }
    if (bayrak("--remote") && deger("--local-db")) { console.error("--remote ve --local-db birlikte verilemez"); process.exit(2); }
    const secenek = { apply: bayrak("--apply"), confirm: deger("--confirm"), freeze: bayrak("--freeze-confirmed"), beklenenOnSayim: deger("--expect-pre-count") == null ? null : +deger("--expect-pre-count"), yedekCikis: deger("--backup-out"), yedekDosya: deger("--backup-file"), manifestCikis: deger("--manifest-out"), kurtarmaManifest: deger("--recovery-manifest-out"), bootstrap: bayrak("--bootstrap-table") && !bayrak("--remote"), parca: +deger("--chunk") || VARSAYILAN_PARCA };
    const beklenen = { id: deger("--db-id"), name: deger("--db-name") }, ortam = deger("--environment");
    let surucu;
    if (deger("--local-db")) { const f = deger("--local-db"); if (!fs.existsSync(f)) { console.error("yerel veritabanı dosyası yok: " + f); process.exit(2); } surucu = sqliteSurucu(new DatabaseSync(f), beklenen.id ? { id: beklenen.id, name: beklenen.name } : undefined); }
    else surucu = cloudflareSurucu({ hesap: process.env.CLOUDFLARE_ACCOUNT_ID, dbId: beklenen.id, token });
    const kaynaklar = await kaynaklariTopla(deger("--embedded-json"));
    const s = await calistir({ surucu, ortam, beklenen, uretimId: process.env.AKE_MIGRATE_PRODUCTION_DB_ID || "", secenek, kaynaklar });
    process.exit(s.cikis);
  })().catch(e => { console.error((e instanceof HardStop ? "HARD STOP: " : "HATA: ") + redakte(e.message)); process.exit(e instanceof HardStop ? 3 : 1); });
}
