// AKE Akademi · ücretsiz kullanım kotası (sunucu tarafı, hesaba bağlı)
// Ücretsiz pakette: günde 20 soru, ayda 1 deneme. Ücretli paketi olanlar sınırsızdır.
// Sayaç D1'deki "ucretsiz" tablosunda tutulur: (kid, donem, tur) -> adet.
// donem: soru için Türkiye saatine göre gün (YYYY-AA-GG), deneme için ay (YYYY-AA).
import { aktifPaket, bugunIso, ayAnahtar } from "./ortak.js";

export const KOTA_TURLERI = ["soru", "deneme"];

export function ucretsizLimit(env) {
  const n = (v, d) => { const x = parseInt(String(v || ""), 10); return Number.isFinite(x) && x >= 0 ? x : d; };
  return { soru: n(env.AKE_UCRETSIZ_SORU, 20), deneme: n(env.AKE_UCRETSIZ_DENEME, 1) };
}
const donemOf = tur => (tur === "deneme" ? ayAnahtar() : bugunIso());

export async function kotaTablo(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ucretsiz (kid TEXT NOT NULL, donem TEXT NOT NULL, tur TEXT NOT NULL, adet INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kid, donem, tur))").run();
}
async function kullanilan(env, kid, tur) {
  const r = await env.DB.prepare("SELECT adet FROM ucretsiz WHERE kid = ? AND donem = ? AND tur = ?").bind(kid, donemOf(tur), tur).first();
  return (r && r.adet) || 0;
}

/* Kalan haklar. Ücretli paketi olan için { sinirsiz: true }. */
export async function kotaDurum(env, kid) {
  if (await aktifPaket(env, kid)) return { sinirsiz: true };
  await kotaTablo(env);
  const l = ucretsizLimit(env), [s, d] = await Promise.all([kullanilan(env, kid, "soru"), kullanilan(env, kid, "deneme")]);
  return { sinirsiz: false, limit: l, kalanSoru: Math.max(0, l.soru - s), kalanDeneme: Math.max(0, l.deneme - d) };
}

/* Hak ayır: istenen kadar (en çok kalan kadar) düşer. Eşzamanlı isteklerde sayaç sınırı aşamaz
   (güncelleme, okunan değere şartlıdır; çakışırsa yeniden denenir). */
export async function kotaAl(env, kid, tur, adet) {
  if (!KOTA_TURLERI.includes(tur)) return { hata: "tur", durum: 400 };
  adet = Math.floor(Number(adet)); if (!Number.isFinite(adet) || adet < 1 || adet > 500) return { hata: "adet", durum: 400 };
  if (await aktifPaket(env, kid)) return { sinirsiz: true, verildi: adet };
  await kotaTablo(env);
  const l = ucretsizLimit(env), limit = tur === "deneme" ? l.deneme : l.soru, donem = donemOf(tur);
  if (tur === "deneme") adet = 1;
  await env.DB.prepare("INSERT OR IGNORE INTO ucretsiz (kid, donem, tur, adet) VALUES (?, ?, ?, 0)").bind(kid, donem, tur).run();
  for (let i = 0; i < 5; i++) {
    const eski = await kullanilan(env, kid, tur), kalan = limit - eski;
    if (kalan < 1) return { hata: "limit", durum: 402, ...(await kotaDurum(env, kid)) };
    const ver = Math.min(adet, kalan);
    const r = await env.DB.prepare("UPDATE ucretsiz SET adet = adet + ? WHERE kid = ? AND donem = ? AND tur = ? AND adet = ?").bind(ver, kid, donem, tur, eski).run();
    if (r && r.meta && r.meta.changes > 0) return { sinirsiz: false, verildi: ver, ...(await kotaDurum(env, kid)) };
  }
  return { hata: "mesgul", durum: 503 };
}
