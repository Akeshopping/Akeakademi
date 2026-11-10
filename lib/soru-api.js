// AKE Akademi · korumalı soru bankası · sunucu taraflı soru oturumu çekirdeği (PR 2/6, "karanlık API")
//
// ÖNCELİK SIRASI (değişmez): bayrak → (yöntem/yol) → aynı-origin → oturum → şema → iş.
//   AKE_SORU_V2 ortam değişkeni "1" değilse 404 döner; bu noktaya kadar env.DB'ye HİÇ dokunulmaz (soruKanonikSema/ALTER/CREATE yok).
//   Bayrak yalnız sunucu ortamından okunur (sorgu, çerez, başlık, localStorage ile açılamaz).
//
// KOTA + OTURUM ATOMİKLİĞİ: tek bir env.DB.batch() çağrısı. Cloudflare D1 belgesi: "Batched statements are SQL transactions ...
//   each statement in the list will execute and commit, sequentially, non-concurrently"; bir ifade hata verirse tüm dizi geri alınır.
//   D1 batch'te JS sonucuna göre dallanma yoktur; bu yüzden tüm karar SQL şartlarındadır (INSERT..SELECT..WHERE, UPDATE..WHERE EXISTS):
//     S1 sayaç satırını (yoksa) sıfırla oluştur            (yalnız ücretsiz)
//     S2 oturumu 'hazirlaniyor' olarak ekle — ŞARTLAR: (kid,istek) yok, açık oturum < 3, sayaç + hak <= limit (ücretsiz)
//     S3 soruları json_each ile ekle — ŞART: oturum satırı var ve her soru hâlâ uygun
//     S4 sayacı artır   — ŞART: bu batch'te eklenen oturum satırı var ve sayaç + hak <= limit      (yalnız ücretsiz)
//     S5 doğrula+etkinleştir: soru sayısı tamam (ve ücretsizde changes()=1, yani S4 sayacı gerçekten artırdı) ise 'acik', değilse durum=NULL → NOT NULL ihlali →
//        TÜM BATCH GERİ ALINIR (kota da). Yani "kota düştü, oturum yok" ya da "oturum var, kota düşmedi" durumu kalıcı olamaz.
//   S2'nin şartları sağlanmazsa S3-S5 hiçbir şey yapmaz (sessiz no-op); çağıran nedeni okuyup (429/402/idempotent) yanıtlar.
//   'hazirlaniyor' durumu yalnız bu işlemin içinde vardır; commit'ten sonra hiçbir satır bu durumda kalmaz.
import { json, oturum, rastgele, aktifPaket } from "./ortak.js";
import { kotaRezervasyonKonumu } from "./kota.js";
import { soruKanonikSema, rkUret } from "./soru-kanonik.js";

export const SINIR = { practice: 50, exam: 120 };                       // tek istekte en çok soru (kazıma/payload sınırı; ürün kotası DEĞİL)
export const SURE_MS = { practice: 24 * 3600e3, exam: 6 * 3600e3 };     // sunucu tarafı oturum ömrü
export const MAKS_ACIK = 3;                                             // kullanıcı başına eşzamanlı açık oturum (teknik koruma)
export const DERSLER = ["turkce", "tarih", "cografya", "felsefe", "din", "mat", "geo", "fizik", "kimya", "biyoloji", "amat", "afizik", "akimya", "abiyoloji", "edebiyat", "tarih2", "cografya2", "psikoloji", "sosyoloji", "mantik", "ingilizce"];
const KOTA_TURU = { practice: "soru", exam: "deneme" };

/* Uygun soru: PR1 kanonik havuz. Bu metin partial indekslerin WHERE'i ile BİREBİR aynıdır (planlayıcı yalnız o zaman kullanır). */
export const UYGUN = "durum IN ('banka','onayli') AND kopya_of IS NULL AND govde IS NOT NULL AND a IS NOT NULL AND x IS NOT NULL";
export const SEMA_SQL = [
  "CREATE TABLE IF NOT EXISTS soru_oturum (id TEXT PRIMARY KEY, kid TEXT NOT NULL, mod TEXT NOT NULL, durum TEXT NOT NULL, olusturma INTEGER NOT NULL, sona_erme INTEGER NOT NULL, bitis INTEGER, adet INTEGER NOT NULL, kota_tur TEXT, kota_verilen INTEGER NOT NULL DEFAULT 0, istek TEXT NOT NULL, filtre TEXT, UNIQUE (kid, istek))",
  "CREATE INDEX IF NOT EXISTS soru_oturum_kid ON soru_oturum (kid, durum, sona_erme)",
  "CREATE TABLE IF NOT EXISTS soru_oturum_soru (oturum TEXT NOT NULL, sira INTEGER NOT NULL, soru_id TEXT NOT NULL, secim INTEGER, cevap_zamani INTEGER, dogru INTEGER, PRIMARY KEY (oturum, sira), UNIQUE (oturum, soru_id))",
  `CREATE INDEX IF NOT EXISTS soru_sec_rk ON soru (rk) WHERE ${UYGUN}`,
  `CREATE INDEX IF NOT EXISTS soru_sec_s_rk ON soru (s, rk) WHERE ${UYGUN}`,
  `CREATE INDEX IF NOT EXISTS soru_sec_st_rk ON soru (s, t, rk) WHERE ${UYGUN}`
];

/* ---------- yardımcılar ---------- */
const yanit = (status, obj) => json(status, obj, { "cache-control": "private, no-store" });
const hata = (status, error, message) => yanit(status, { error, message: message || "" });

const GUVENLI_YONTEM = new Set(["GET", "HEAD", "OPTIONS"]);
/* Yönetim API'sindeki aynı-origin mantığı: Origin varsa birebir aynı; yoksa Sec-Fetch-Site: same-origin ya da aynı origin'li Referer; hiçbiri yoksa red. */
export function ayniKaynak(request) {
  if (GUVENLI_YONTEM.has(request.method)) return true;
  const beklenen = new URL(request.url).origin, o = request.headers.get("origin");
  if (o !== null) return o === beklenen;
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  const ref = request.headers.get("referer");
  if (ref) { try { return new URL(ref).origin === beklenen; } catch (e) { return false; } }
  return false;
}
export const bayrakAcik = env => !!env && String(env.AKE_SORU_V2 == null ? "" : env.AKE_SORU_V2).trim() === "1";

const semaHazir = new WeakSet();   // D1 bağlantısı başına bir kez (isolate ömrü); hata olursa işaretlenmez
async function sema(env) {
  if (semaHazir.has(env.DB)) return;
  await soruKanonikSema(env.DB);
  await env.DB.batch(SEMA_SQL.map(s => env.DB.prepare(s)));
  semaHazir.add(env.DB);
}

async function govdeOku(request) {
  const t = await request.text();
  if (t.length > 4096) return { e: "buyuk" };
  try { const j = JSON.parse(t); return j && typeof j === "object" && !Array.isArray(j) ? { j } : { e: "json" }; } catch (e) { return { e: "json" }; }
}
const tamsayi = v => typeof v === "number" && Number.isInteger(v);
const OTURUM_ID = /^[0-9a-f]{48}$/;

/* ---------- /oturum isteği doğrulama (yalnız bilinen alanlar; "idler" vb. reddedilir) ---------- */
export function dogrulaOturumIstegi(b) {
  const izinli = new Set(["istek", "mod", "adet", "ders", "konu", "zorluk"]);
  for (const k of Object.keys(b)) if (!izinli.has(k)) return { e: "bilinmeyen_alan" };
  if (typeof b.istek !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(b.istek)) return { e: "istek", m: "istek 16-100 karakter (harf, rakam, _ ve -) olmalı." };
  if (b.mod !== "practice" && b.mod !== "exam") return { e: "mod", m: "mod practice ya da exam olmalı." };
  const ust = SINIR[b.mod];
  if (!tamsayi(b.adet) || b.adet < 1 || b.adet > ust) return { e: "adet", m: `adet 1..${ust} arasında tamsayı olmalı.` };
  const f = { adet: b.adet };
  if (b.ders !== undefined && b.ders !== null) { if (typeof b.ders !== "string" || !DERSLER.includes(b.ders)) return { e: "ders", m: "ders geçersiz." }; f.ders = b.ders; }
  if (b.konu !== undefined && b.konu !== null) { if (typeof b.konu !== "string" || !b.konu.trim() || b.konu.length > 120) return { e: "konu", m: "konu 1-120 karakter olmalı." }; f.konu = b.konu; }
  if (b.zorluk !== undefined && b.zorluk !== null) {
    const a = [].concat(b.zorluk);
    if (!a.length || a.length > 3 || a.some(z => !tamsayi(z) || z < 1 || z > 3)) return { e: "zorluk", m: "zorluk 1, 2 ya da 3 olmalı." };
    f.zorluk = [...new Set(a)].sort();
  }
  return { b: { istek: b.istek, mod: b.mod, adet: b.adet, ders: f.ders, konu: f.konu, zorluk: f.zorluk }, filtre: JSON.stringify([f.adet, f.ders || null, f.konu || null, f.zorluk || null]) };
}

/* ---------- soru seçimi: rk + sınırlı LIMIT (SQL rastgele sıralama yok, banka JS'ye çekilmez, a/x okunmaz) ---------- */
export async function soruSec(env, f, n) {
  const kosul = [], bag = [];
  if (f.ders) { kosul.push("s = ?"); bag.push(f.ders); }
  if (f.konu) { kosul.push("t = ?"); bag.push(f.konu); }
  if (f.zorluk) { kosul.push(`d IN (${f.zorluk.map(() => "?").join(",")})`); bag.push(...f.zorluk); }
  const ek = kosul.length ? " AND " + kosul.join(" AND ") : "";
  const r = rkUret(), taban = `SELECT id, s, t, d, govde FROM soru WHERE ${UYGUN} AND rk `;
  let rows = ((await env.DB.prepare(taban + ">= ?" + ek + " ORDER BY rk LIMIT ?").bind(r, ...bag, n).all()).results) || [];
  if (rows.length < n) rows = rows.concat(((await env.DB.prepare(taban + "< ?" + ek + " ORDER BY rk LIMIT ?").bind(r, ...bag, n - rows.length).all()).results) || []);
  return rows;
}
/* satır → istemciye giden soru (yalnız id,s,t,d,p?,q,o); bozuk gövde null döner */
export function soruCikti(row) {
  let g; try { g = JSON.parse(row.govde); } catch (e) { return null; }
  if (!g || typeof g.q !== "string" || !Array.isArray(g.o) || g.o.length !== 5) return null;
  const o = { id: row.id, s: row.s, t: row.t, d: row.d };
  if (typeof g.p === "string" && g.p) o.p = g.p;
  o.q = g.q; o.o = g.o.map(String);
  return o;
}

/* ---------- oturum okuma ---------- */
const oturumBulIstek = (env, kid, istek) => env.DB.prepare("SELECT id, mod, durum, sona_erme, adet, filtre, kota_tur, kota_verilen FROM soru_oturum WHERE kid = ? AND istek = ?").bind(kid, istek).first();
const oturumBulKendi = (env, kid, id) => env.DB.prepare("SELECT id, mod, durum, sona_erme, adet, kota_tur, kota_verilen FROM soru_oturum WHERE id = ? AND kid = ?").bind(id, kid).first();
async function oturumSorulari(env, id) {
  const { results } = await env.DB.prepare("SELECT s.id, s.s, s.t, s.d, s.govde FROM soru_oturum_soru q JOIN soru s ON s.id = q.soru_id WHERE q.oturum = ? ORDER BY q.sira").bind(id).all();
  return (results || []).map(soruCikti).filter(Boolean);
}
async function kotaOzeti(env, kid, tur) {
  const k = await kotaRezervasyonKonumu(env, kid, tur);
  return { tur, limit: k.limit, kalan: Math.max(0, k.limit - k.kullanilan) };
}
async function oturumYaniti(env, kid, o, sorular, paketli, durum) {
  const y = { oturum: o.id, mod: o.mod, adet: o.adet, sonaErme: o.sona_erme, sorular };
  y.kota = paketli ? { sinirsiz: true } : await kotaOzeti(env, kid, KOTA_TURU[o.mod]);
  return yanit(durum || 200, y);
}
/* oturumun şu an cevap kabul edip etmediği: null = açık; değilse hata yanıtı. Süresi dolmuş açık oturum tembel olarak iptal edilir. */
async function durumHatasi(env, o, simdi) {
  if (o.durum === "bitti") return hata(409, "oturum_bitti", "Bu oturum bitti.");
  if (o.durum === "iptal") return hata(410, "sure_doldu", "Oturumun süresi doldu.");
  if (o.sona_erme <= simdi) {
    await env.DB.prepare("UPDATE soru_oturum SET durum = 'iptal' WHERE id = ? AND durum = 'acik'").bind(o.id).run();
    return hata(410, "sure_doldu", "Oturumun süresi doldu.");
  }
  return null;
}

/* ---------- POST /oturum ---------- */
async function oturumOlustur(env, u, d) {
  const kid = u.id, b = d.b, tur = KOTA_TURU[b.mod], pratik = b.mod === "practice";
  await env.DB.prepare("UPDATE soru_oturum SET durum = 'iptal' WHERE kid = ? AND durum = 'acik' AND sona_erme <= ?").bind(kid, Date.now()).run();   // tembel temizlik (kullanıcıya özel, indeksli)
  const paket = await aktifPaket(env, kid), paketli = !!paket;

  const tekrar = async mevcut => {   // aynı kid+istek: yeni kota yok, mevcut oturum (idempotent)
    if (mevcut.filtre !== d.filtre || mevcut.mod !== b.mod) return hata(409, "istek_cakisma", "Bu istek kimliği farklı bir istekle kullanılmış.");
    if (mevcut.durum === "bitti") return hata(409, "oturum_bitti", "Bu oturum bitti.");
    if (mevcut.durum !== "acik" || mevcut.sona_erme <= Date.now()) return hata(410, "sure_doldu", "Oturumun süresi doldu.");
    return oturumYaniti(env, kid, mevcut, await oturumSorulari(env, mevcut.id), paketli);
  };
  const ilk = await oturumBulIstek(env, kid, b.istek);
  if (ilk) return tekrar(ilk);

  for (let deneme = 0; deneme < 3; deneme++) {
    let n = b.adet, kota = null;
    if (!paketli) {
      kota = await kotaRezervasyonKonumu(env, kid, tur);
      const kalan = kota.limit - kota.kullanilan;
      if (kalan < 1) return yanit(402, { error: "limit", message: "Ücretsiz hakkın bitti.", kota: { tur, limit: kota.limit, kalan: 0 } });
      if (pratik) n = Math.min(n, kalan);
    }
    const secilen = (await soruSec(env, b, n)).map(r => ({ r, o: soruCikti(r) })).filter(x => x.o);
    if (!secilen.length) return hata(503, "banka_yok", "Bu filtreyle uygun soru bulunamadı.");
    const adet = secilen.length, hak = paketli ? 0 : (pratik ? adet : 1);
    const id = rastgele(24), simdi = Date.now(), sona = simdi + SURE_MS[b.mod];
    const idler = JSON.stringify(secilen.map(x => x.r.id));
    const P = s => env.DB.prepare(s), st = [];
    if (!paketli) st.push(P(`INSERT OR IGNORE INTO ${kota.t} (${kota.c}, donem, tur, adet) VALUES (?, ?, ?, 0)`).bind(kota.id, kota.donem, tur));
    st.push(P(`INSERT INTO soru_oturum (id, kid, mod, durum, olusturma, sona_erme, bitis, adet, kota_tur, kota_verilen, istek, filtre)
      SELECT ?, ?, ?, 'hazirlaniyor', ?, ?, NULL, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM soru_oturum WHERE kid = ? AND istek = ?)
        AND (SELECT COUNT(*) FROM soru_oturum WHERE kid = ? AND durum = 'acik' AND sona_erme > ?) < ?` +
      (paketli ? "" : ` AND (SELECT adet FROM ${kota.t} WHERE ${kota.c} = ? AND donem = ? AND tur = ?) + ? <= ?`))
      .bind(id, kid, b.mod, simdi, sona, adet, paketli ? null : tur, hak, b.istek, d.filtre, kid, b.istek, kid, simdi, MAKS_ACIK, ...(paketli ? [] : [kota.id, kota.donem, tur, hak, kota.limit])));
    st.push(P(`INSERT INTO soru_oturum_soru (oturum, sira, soru_id)
      SELECT ?, CAST(j.key AS INTEGER) + 1, j.value FROM json_each(?) j
      WHERE EXISTS (SELECT 1 FROM soru_oturum WHERE id = ? AND durum = 'hazirlaniyor') AND EXISTS (SELECT 1 FROM soru WHERE id = j.value AND ${UYGUN})`).bind(id, idler, id));
    if (!paketli) st.push(P(`UPDATE ${kota.t} SET adet = adet + ? WHERE ${kota.c} = ? AND donem = ? AND tur = ? AND adet + ? <= ? AND EXISTS (SELECT 1 FROM soru_oturum WHERE id = ? AND durum = 'hazirlaniyor')`)
      .bind(hak, kota.id, kota.donem, tur, hak, kota.limit, id));
    st.push(P(`UPDATE soru_oturum SET durum = CASE WHEN (SELECT COUNT(*) FROM soru_oturum_soru WHERE oturum = ?) = ?${paketli ? "" : " AND changes() = 1"} THEN 'acik' ELSE NULL END WHERE id = ? AND durum = 'hazirlaniyor'`).bind(id, adet, id));
    // S5'in changes() = 1 şartı hemen önceki ifadeyi (S4, sayaç artırma) doğrular; sayaç artmadıysa NOT NULL ihlaliyle her şey geri alınır
    try { await env.DB.batch(st); }
    catch (e) {
      if (!/NOT NULL/i.test(String(e && e.message))) throw e;   // doğrulama başarısız → batch geri alındı (kota dahil); yeniden dene
    }
    const sonuc = await oturumBulIstek(env, kid, b.istek);
    if (sonuc && sonuc.id === id) return oturumYaniti(env, kid, sonuc, secilen.map(x => x.o), paketli);
    if (sonuc) return tekrar(sonuc);                           // eşzamanlı aynı istek kazandı: aynı oturum
    const acik = await env.DB.prepare("SELECT COUNT(*) AS n FROM soru_oturum WHERE kid = ? AND durum = 'acik' AND sona_erme > ?").bind(kid, Date.now()).first();
    if (acik && acik.n >= MAKS_ACIK) return hata(429, "cok_acik_oturum", "Çok fazla açık oturumun var; önce birini bitir.");
    /* aksi halde kota yarışı kaybedildi: kalan yeniden okunup tekrar denenir (en sonunda 402/503) */
  }
  return hata(503, "mesgul", "Şu an yoğun, tekrar dene.");
}

/* ---------- POST /cevap ---------- */
async function cevapVer(env, u, b) {
  const izinli = new Set(["oturum", "soru", "secim"]);
  for (const k of Object.keys(b)) if (!izinli.has(k)) return hata(400, "bilinmeyen_alan");
  if (typeof b.oturum !== "string" || !OTURUM_ID.test(b.oturum)) return hata(404, "yok");
  if (typeof b.soru !== "string" || !b.soru || b.soru.length > 100) return hata(404, "yok");
  if (!tamsayi(b.secim) || b.secim < 0 || b.secim > 4) return hata(400, "secim", "secim 0-4 arasında tamsayı olmalı.");
  const o = await oturumBulKendi(env, u.id, b.oturum);
  if (!o) return hata(404, "yok");
  const simdi = Date.now(), dh = await durumHatasi(env, o, simdi); if (dh) return dh;
  const satir = await env.DB.prepare("SELECT secim FROM soru_oturum_soru WHERE oturum = ? AND soru_id = ?").bind(o.id, b.soru).first();
  if (!satir) return hata(404, "yok");
  const acik = "EXISTS (SELECT 1 FROM soru_oturum WHERE id = ? AND kid = ? AND durum = 'acik' AND sona_erme > ?)";

  if (o.mod === "exam") {   // sınav: anahtar YOK; bitene kadar seçim değişebilir
    const r = await env.DB.prepare(`UPDATE soru_oturum_soru SET secim = ?, cevap_zamani = ? WHERE oturum = ? AND soru_id = ? AND ${acik}`).bind(b.secim, simdi, o.id, b.soru, o.id, u.id, simdi).run();
    if (r && r.meta && r.meta.changes > 0) return yanit(200, { kaydedildi: true });
    const o2 = await oturumBulKendi(env, u.id, o.id);   // yarış: arada bitti/süresi doldu
    return (o2 && (await durumHatasi(env, o2, Date.now()))) || hata(409, "oturum_bitti", "Bu oturum bitti.");
  }
  /* pratik: ilk cevapta anahtar; cevap kilitlenir */
  const r = await env.DB.prepare(`UPDATE soru_oturum_soru SET secim = ?, cevap_zamani = ?, dogru = (SELECT CASE WHEN a = ? THEN 1 ELSE 0 END FROM soru WHERE id = ?) WHERE oturum = ? AND soru_id = ? AND secim IS NULL AND ${acik}`)
    .bind(b.secim, simdi, b.secim, b.soru, o.id, b.soru, o.id, u.id, simdi).run();
  const yeni = r && r.meta && r.meta.changes > 0;
  const k = await env.DB.prepare("SELECT q.secim, q.dogru, s.a, s.x FROM soru_oturum_soru q JOIN soru s ON s.id = q.soru_id WHERE q.oturum = ? AND q.soru_id = ?").bind(o.id, b.soru).first();
  if (!k || k.secim == null) {   // cevap yazılamadı: oturum arada kapandı
    const o2 = await oturumBulKendi(env, u.id, o.id);
    return (o2 && (await durumHatasi(env, o2, Date.now()))) || hata(409, "cevap_yazilamadi", "Cevap kaydedilemedi.");
  }
  if (!yeni && k.secim !== b.secim) return hata(409, "cevap_kilitli", "Bu soru zaten cevaplandı.");
  return yanit(200, { dogru: !!k.dogru, a: k.a, x: k.x });
}

/* ---------- POST /bitir ---------- */
async function sonucUret(env, o) {
  const { results } = await env.DB.prepare("SELECT q.soru_id AS id, q.secim, q.dogru, s.a, s.x FROM soru_oturum_soru q LEFT JOIN soru s ON s.id = q.soru_id WHERE q.oturum = ? ORDER BY q.sira").bind(o.id).all();
  let d = 0, y = 0, bos = 0; const sorular = [];
  for (const r of results || []) {
    if (r.secim == null) { bos++; sorular.push(o.mod === "exam" ? { id: r.id, secim: null, a: r.a, x: r.x, dogru: null } : { id: r.id, secim: null }); continue; }
    const dogru = r.dogru == null ? r.secim === r.a : !!r.dogru;
    dogru ? d++ : y++;
    sorular.push({ id: r.id, secim: r.secim, a: r.a, x: r.x, dogru });
  }
  return yanit(200, { oturum: o.id, mod: o.mod, dogru: d, yanlis: y, bos, sorular });
}
async function bitir(env, u, b) {
  for (const k of Object.keys(b)) if (k !== "oturum") return hata(400, "bilinmeyen_alan");
  if (typeof b.oturum !== "string" || !OTURUM_ID.test(b.oturum)) return hata(404, "yok");
  const o = await oturumBulKendi(env, u.id, b.oturum);
  if (!o) return hata(404, "yok");
  if (o.durum === "bitti") return sonucUret(env, o);   // idempotent: durum değişmez
  const simdi = Date.now(), dh = await durumHatasi(env, o, simdi); if (dh) return dh;
  await env.DB.batch([
    env.DB.prepare("UPDATE soru_oturum SET durum = 'bitti', bitis = ? WHERE id = ? AND kid = ? AND durum = 'acik' AND sona_erme > ?").bind(simdi, o.id, u.id, simdi),
    env.DB.prepare("UPDATE soru_oturum_soru SET dogru = (SELECT CASE WHEN s.a = soru_oturum_soru.secim THEN 1 ELSE 0 END FROM soru s WHERE s.id = soru_oturum_soru.soru_id) WHERE oturum = ? AND secim IS NOT NULL AND dogru IS NULL AND EXISTS (SELECT 1 FROM soru_oturum WHERE id = ? AND durum = 'bitti')").bind(o.id, o.id)
  ]);
  const o2 = await oturumBulKendi(env, u.id, o.id);
  if (o2 && o2.durum === "bitti") return sonucUret(env, o2);
  return (o2 && (await durumHatasi(env, o2, Date.now()))) || hata(409, "oturum_bitti", "Bu oturum bitirilemedi.");
}

/* ---------- GET /ozet: yalnız sayılar ---------- */
async function ozet(env) {
  const { results } = await env.DB.prepare(`SELECT s, t, d, COUNT(*) AS n FROM soru WHERE ${UYGUN} GROUP BY s, t, d`).all();
  const dersler = {}; let toplam = 0;
  for (const r of results || []) {
    const ds = dersler[r.s] || (dersler[r.s] = { toplam: 0, konular: {} });
    const ko = ds.konular[r.t] || (ds.konular[r.t] = { toplam: 0, zorluk: {} });
    ds.toplam += r.n; ko.toplam += r.n; ko.zorluk[r.d] = (ko.zorluk[r.d] || 0) + r.n; toplam += r.n;
  }
  return yanit(200, { toplam, dersler });
}

/* ---------- giriş noktası ---------- */
const YOLLAR = { oturum: "POST", cevap: "POST", bitir: "POST", ozet: "GET" };
export async function soruApi(request, env, params) {
  if (!bayrakAcik(env)) return hata(404, "yok");                    // 1) bayrak: kapalıyken D1'e dokunma
  const parca = [].concat((params && params.yol) || []);
  const ad = parca.length === 1 ? parca[0] : "";
  if (!Object.prototype.hasOwnProperty.call(YOLLAR, ad)) return hata(404, "yok");
  if (request.method !== YOLLAR[ad]) return hata(405, "yontem");
  if (!ayniKaynak(request)) return hata(403, "origin", "Bu istek farklı bir siteden geldiği için reddedildi.");   // 2) CSRF
  if (!env.DB) return hata(500, "yapilandirma");
  const u = await oturum(request, env);                              // 3) kimlik yalnız sunucu çerezinden
  if (!u) return hata(401, "oturum", "Giriş gerekli.");
  try {
    await sema(env);                                                 // 4) şema (bayrak açık + oturumlu)
    if (ad === "ozet") return await ozet(env);
    const g = await govdeOku(request);
    if (g.e) return hata(400, g.e === "buyuk" ? "buyuk" : "json", "Geçersiz istek gövdesi.");
    if (ad === "oturum") { const d = dogrulaOturumIstegi(g.j); return d.e ? hata(400, d.e, d.m) : await oturumOlustur(env, u, d); }
    if (ad === "cevap") return await cevapVer(env, u, g.j);
    return await bitir(env, u, g.j);
  } catch (e) {
    return hata(503, "gecici", "Geçici bir sorun oldu, tekrar dene.");   // ayrıntı sızdırma yok
  }
}
