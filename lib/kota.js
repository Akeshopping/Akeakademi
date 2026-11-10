// AKE Akademi · ücretsiz kullanım kotası (sunucu tarafı, hesaba bağlı)
// Ücretsiz pakette: günde 20 soru, ayda 1 deneme. Ücretli paketi olanlar sınırsızdır.
//
// Sayaç, hesap kimliğine (kid) değil, e-postadan türetilen takma adlı bir kota kimliğine bağlıdır:
//   kimlik = HMAC-SHA-256(AKE_GIZLI, "ucretsiz-kota:" + trim(küçük harf(e-posta)))
// Böylece hesap silinip aynı e-postayla yeniden açılsa bile ücretsiz hak sıfırlanmaz; ama kayıtta düz e-posta, e-postanın
// çıplak özeti, ad, Google kimliği ya da eski kid bulunmaz. Sır olmadan kimlik geri çözülemez ve tahmin edilemez.
// Tablo: ucretsiz_kimlik (kimlik, donem, tur, adet), birincil anahtar (kimlik, donem, tur).
// donem: soru için Türkiye saatine göre gün (YYYY-AA-GG), deneme için ay (YYYY-AA). Eski dönemler tembel temizlenir.
// Eski tablo ucretsiz (kid, donem, tur, adet) geriye uyumluluk için durur: geçişte okunur (MAX ile, iki kez toplanmaz),
// yeni kullanım yalnız ucretsiz_kimlik'te tutulur. AKE_GIZLI yoksa eski kid tabanlı sayaca düşülür (kesinti olmaz).
import { aktifPaket, bugunIso, ayAnahtar, hmacHex } from "./ortak.js";

export const KOTA_TURLERI = ["soru", "deneme"];

export function ucretsizLimit(env) {
  const n = (v, d) => { const x = parseInt(String(v || ""), 10); return Number.isFinite(x) && x >= 0 ? x : d; };
  return { soru: n(env.AKE_UCRETSIZ_SORU, 20), deneme: n(env.AKE_UCRETSIZ_DENEME, 1) };
}
const donemOf = tur => (tur === "deneme" ? ayAnahtar() : bugunIso());
export const normEposta = e => String(e || "").trim().toLowerCase();

/* e-postadan takma adlı kota kimliği (64 hane onaltılık). Sır yoksa null. */
export async function kotaKimligiEposta(env, eposta) {
  const sir = String(env.AKE_GIZLI || "").trim(), e = normEposta(eposta);
  if (!sir || !e) return null;
  return (await hmacHex(sir, "ucretsiz-kota:" + e)).hex;
}
/* hesap için kota kimliği; e-postası olmayan hesapta kid'den (yine sırla) türetilir */
async function kimlikOf(env, kid) {
  const sir = String(env.AKE_GIZLI || "").trim(); if (!sir) return null;
  const u = await env.DB.prepare("SELECT eposta FROM kullanici WHERE id = ?").bind(kid).first();
  const e = normEposta(u && u.eposta);
  return (await hmacHex(sir, e ? "ucretsiz-kota:" + e : "ucretsiz-kota-kid:" + kid)).hex;
}

export async function kotaTablo(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ucretsiz (kid TEXT NOT NULL, donem TEXT NOT NULL, tur TEXT NOT NULL, adet INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kid, donem, tur))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ucretsiz_kimlik (kimlik TEXT NOT NULL, donem TEXT NOT NULL, tur TEXT NOT NULL, adet INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kimlik, donem, tur))")
  ]);
}

/* Eski dönemleri sil: gün kayıtları geçmiş günlerden, deneme kayıtları geçmiş aylardan. En çok günde bir kez (isolate başına). */
let sonTemizlik = "";
export async function kotaTemizle(env, zorla) {
  const g = bugunIso(); if (!zorla && sonTemizlik === g) return; sonTemizlik = g;
  const a = ayAnahtar();
  await env.DB.batch(["ucretsiz_kimlik", "ucretsiz"].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE (tur = 'soru' AND donem < ?) OR (tur = 'deneme' AND donem < ?)`).bind(g, a)));
}

/* Geçiş: eski (kid) sayaçtaki bu dönem kullanımı kimlik tablosuna MAX ile aktarılır. Tekrar çalışması güvenlidir (iki kez toplanmaz,
   hak azaltılmaz). */
async function tasi(env, kid, kimlik, tur) {
  const eski = await env.DB.prepare("SELECT adet FROM ucretsiz WHERE kid = ? AND donem = ? AND tur = ?").bind(kid, donemOf(tur), tur).first();
  if (!eski || !(eski.adet > 0)) return;
  await env.DB.prepare("INSERT OR IGNORE INTO ucretsiz_kimlik (kimlik, donem, tur, adet) VALUES (?, ?, ?, 0)").bind(kimlik, donemOf(tur), tur).run();
  await env.DB.prepare("UPDATE ucretsiz_kimlik SET adet = MAX(adet, ?) WHERE kimlik = ? AND donem = ? AND tur = ?").bind(eski.adet, kimlik, donemOf(tur), tur).run();
}
/* Hesap silinmeden önce: bu dönemin kullanımı kimlik kaydına yazılmış olsun (eski kid'e hiç dokunulmamış olabilir). */
export async function kotaKorumaYaz(env, kid) {
  await kotaTablo(env);
  const kimlik = await kimlikOf(env, kid); if (!kimlik) return;
  for (const tur of KOTA_TURLERI) await tasi(env, kid, kimlik, tur);
}

/* Sayaç konumu: kimlik varsa yeni tablo, yoksa (sır tanımsız) eski kid tablosu */
async function konum(env, kid) {
  const kimlik = await kimlikOf(env, kid);
  return kimlik ? { t: "ucretsiz_kimlik", c: "kimlik", id: kimlik, yeni: true } : { t: "ucretsiz", c: "kid", id: kid, yeni: false };
}
async function kullanilan(env, k, tur) {
  const r = await env.DB.prepare(`SELECT adet FROM ${k.t} WHERE ${k.c} = ? AND donem = ? AND tur = ?`).bind(k.id, donemOf(tur), tur).first();
  return (r && r.adet) || 0;
}
async function hazirla(env, kid, turler) {
  await kotaTablo(env); await kotaTemizle(env).catch(() => { });
  const k = await konum(env, kid);
  if (k.yeni) for (const tur of turler) await tasi(env, kid, k.id, tur);
  return k;
}

/* Kalan haklar. Ücretli paketi olan için { sinirsiz: true }. */
export async function kotaDurum(env, kid) {
  if (await aktifPaket(env, kid)) return { sinirsiz: true };
  const k = await hazirla(env, kid, KOTA_TURLERI);
  const l = ucretsizLimit(env), [s, d] = await Promise.all([kullanilan(env, k, "soru"), kullanilan(env, k, "deneme")]);
  return { sinirsiz: false, limit: l, kalanSoru: Math.max(0, l.soru - s), kalanDeneme: Math.max(0, l.deneme - d) };
}

/* Hak ayır: istenen kadar (en çok kalan kadar) düşer. Eşzamanlı isteklerde sayaç sınırı aşamaz
   (güncelleme, okunan değere şartlıdır; çakışırsa yeniden denenir). */
export async function kotaAl(env, kid, tur, adet) {
  if (!KOTA_TURLERI.includes(tur)) return { hata: "tur", durum: 400 };
  adet = Math.floor(Number(adet)); if (!Number.isFinite(adet) || adet < 1 || adet > 500) return { hata: "adet", durum: 400 };
  if (await aktifPaket(env, kid)) return { sinirsiz: true, verildi: adet };
  const k = await hazirla(env, kid, [tur]);
  const l = ucretsizLimit(env), limit = tur === "deneme" ? l.deneme : l.soru, donem = donemOf(tur);
  if (tur === "deneme") adet = 1;
  await env.DB.prepare(`INSERT OR IGNORE INTO ${k.t} (${k.c}, donem, tur, adet) VALUES (?, ?, ?, 0)`).bind(k.id, donem, tur).run();
  for (let i = 0; i < 5; i++) {
    const eski = await kullanilan(env, k, tur), kalan = limit - eski;
    if (kalan < 1) return { hata: "limit", durum: 402, ...(await kotaDurum(env, kid)) };
    const ver = Math.min(adet, kalan);
    const r = await env.DB.prepare(`UPDATE ${k.t} SET adet = adet + ? WHERE ${k.c} = ? AND donem = ? AND tur = ? AND adet = ?`).bind(ver, k.id, donem, tur, eski).run();
    if (r && r.meta && r.meta.changes > 0) return { sinirsiz: false, verildi: ver, ...(await kotaDurum(env, kid)) };
  }
  return { hata: "mesgul", durum: 503 };
}

/* PR 2 (soru API'si) için: sayaç konumu + dönem + limit + kullanılan. Mevcut kotaAl/kotaDurum tüketim davranışını DEĞİŞTİRMEZ.
   Bu yardımcı yeni kullanım ayırmaz/artırmaz; ancak mevcut hazirla() yolunu çağırdığı için saf okuma değildir: kota tablolarını
   CREATE IF NOT EXISTS ile hazırlayabilir, eski dönem kayıtlarını tembel temizleyebilir ve eski kid tabanlı sayacı ucretsiz_kimlik'e
   taşıyabilir. Asıl soru oturumu kota artışı, çağıranın (lib/soru-api.js) tek atomik D1 batch'i içinde gerçekleşir. */
export async function kotaRezervasyonKonumu(env, kid, tur) {
  if (!KOTA_TURLERI.includes(tur)) return null;
  const k = await hazirla(env, kid, [tur]), l = ucretsizLimit(env);
  return { t: k.t, c: k.c, id: k.id, donem: donemOf(tur), tur, limit: tur === "deneme" ? l.deneme : l.soru, kullanilan: await kullanilan(env, k, tur) };
}
