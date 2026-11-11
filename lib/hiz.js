// AKE Akademi · dağıtık hız sınırlayıcı (B2) · Cloudflare Pages Functions + D1
//
// Neden: Bellek içi Map sayaçları her Worker örneğinde ayrıdır; istekler farklı örneklere dağıldığı için sınır fiilen uygulanmaz.
// Bu modül sayacı D1'de tutar. Karar TEK ATOMİK SQL komutunda verilir (önce oku, sonra yaz yarışı yok):
//   - pencere bittiyse sayaç 1'e döner; sürüyorsa yalnızca sınırın altındayken artar; sınırdaysa satıra DOKUNULMAZ (changes = 0 → reddet).
//   - reddedilen istekler yazma üretmez (saldırı, yazma yükünü büyütmez).
// Gizlilik: IP/kullanıcı kimliği veritabanına AÇIK METİN yazılmaz; anahtar = SHA-256(tuz | kova | kimlik) ilk 32 hex.
//   Tuz: env.AKE_HIZ_TUZ, yoksa env.AKE_GIZLI (üretimde tanımlı olmalı; yoksa IPv4 özetleri tahmin edilebilir).
//   IPv6 adresleri /64 önekine indirilir (aynı /64 içinde adres değiştirerek sınır aşılamaz).
// Büyüme: her satır pencere bitiminden sonra silinebilir; izinli isteklerin ~%2'sinde en çok 100 süresi dolmuş satır temizlenir
//   (beklenen silme > beklenen ekleme, tablo sınırlı kalır). Tablo bitis indeksiyle temizlenir.
// Güvenli hata: tablo yoksa / D1 hata verirse İSTEK ENGELLENMEZ (kullanıcı mağdur edilmez); o örnekte eski bellek içi sayaca düşülür
//   ve hata günlüğe yazılır. İSTİSNA: yedekIzin:false ile çağrılan maliyetli uçlar (ücretli AI) arızada KAPALI kalır (503). Tablo migrations/0001_hiz_siniri.sql ile kurulur (uygulama tablo OLUŞTURMAZ).
import { sha256, fail } from "./ortak.js";

const yedek = new Map();           /* yalnızca tablo yokken/hata varken: bu Worker örneğinde bellek içi (eski davranış) */
let hataGunlukZamani = 0;

/* İstemci IP'si: IPv4 olduğu gibi; IPv6 → ilk 64 bit (4 grup). Başlık yoksa "?" (Cloudflare her zaman ekler). */
export function ipOf(request) {
  const ham = String(request.headers.get("cf-connecting-ip") || "").trim().toLowerCase();
  if (!ham) return "?";
  if (!ham.includes(":")) return ham;
  const mapli = ham.match(/^(?:0:0:0:0:0:ffff|::ffff):(\d+\.\d+\.\d+\.\d+)$/);   /* IPv4-eşlemeli IPv6 → IPv4 */
  if (mapli) return mapli[1];
  const [bas, son] = ham.split("::"), a = bas ? bas.split(":") : [], b = son !== undefined ? (son ? son.split(":") : []) : [];
  const grup = son === undefined ? a : [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  return grup.slice(0, 4).map(g => (g || "0").replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

async function anahtarOf(env, kova, kimlik) {
  const tuz = env.AKE_HIZ_TUZ || env.AKE_GIZLI || "ake-hiz";
  return (await sha256(tuz + "|" + kova + "|" + kimlik)).slice(0, 32);
}

function yedekKontrol(anahtar, adet, ms, now) {
  const pencere = Math.floor(now / ms), k = yedek.get(anahtar);
  if (!k || k.pencere !== pencere) { if (yedek.size > 20000) yedek.clear(); yedek.set(anahtar, { pencere, adet: 1 }); return true; }
  if (k.adet >= adet) return false;
  k.adet++; return true;
}

/* hizSinir(env, { kova, kimlik, adet, ms }) → { izin, bekle (sn), yedek }
   kova: sınırın adı ("kod", "ai", ...); kimlik: IP veya kullanıcı kimliği; adet: pencere başına en çok istek; ms: pencere uzunluğu. */
export async function hizSinir(env, { kova, kimlik, adet, ms, now = Date.now(), yedekIzin = true }) {
  const pencere = Math.floor(now / ms), bitis = (pencere + 2) * ms, bekle = Math.max(1, Math.ceil(((pencere + 1) * ms - now) / 1000));
  const anahtar = await anahtarOf(env, kova, kimlik);
  if (!env || !env.DB) return { izin: yedekKontrol(anahtar, adet, ms, now), bekle, yedek: true };
  try {
    const r = await env.DB.prepare(
      `INSERT INTO hiz (anahtar, pencere, adet, bitis) VALUES (?, ?, 1, ?)
       ON CONFLICT (anahtar) DO UPDATE SET adet = CASE WHEN hiz.pencere = excluded.pencere THEN hiz.adet + 1 ELSE 1 END, pencere = excluded.pencere, bitis = excluded.bitis
       WHERE hiz.pencere <> excluded.pencere OR hiz.adet < ?`).bind(anahtar, pencere, bitis, adet).run();
    const izin = !!(r && r.meta && r.meta.changes > 0);
    if (izin && Math.random() < 0.02) {   /* büyüme kontrolü: süresi dolmuş satırlardan en çok 100'ü */
      await env.DB.prepare("DELETE FROM hiz WHERE anahtar IN (SELECT anahtar FROM hiz WHERE bitis < ? LIMIT 100)").bind(now).run().catch(() => { });
    }
    return { izin, bekle, yedek: false };
  } catch (e) {
    if (now - hataGunlukZamani > 60000) { hataGunlukZamani = now; console.error("hiz: D1 sınırlayıcı kullanılamadı, bellek içi yedeğe düşüldü:", e && e.message); }
    /* yedekIzin:false (ücretli/maliyetli uçlar, ör. AI): sınırlayıcı çalışmıyorsa İSTEK REDDEDİLİR (hata:true) — bellek içi yedek Worker
       örneği başına olduğundan maliyetli kullanımı sınırsıza açabilir. Diğer uçlarda kullanıcı mağdur edilmez (varsayılan: yedek). */
    if (!yedekIzin) return { izin: false, bekle: 30, yedek: false, hata: true };
    return { izin: yedekKontrol(anahtar, adet, ms, now), bekle, yedek: true };
  }
}

/* Kolaylık: IP'ye göre sınır. */
export const ipHiz = (env, request, kova, adet, ms) => hizSinir(env, { kova, kimlik: ipOf(request), adet, ms });
/* Reddedilen istek için ortak başlık (Retry-After). */
export const bekleBaslik = h => ({ "retry-after": String(h.bekle) });
/* Yalnızca testler için: bellek içi yedeği sıfırlar. */
export const _yedekSifirla = () => { yedek.clear(); hataGunlukZamani = 0; };

/* Erişim kodu deneme bütçesi: /api/hesap/kod-bagla ve /api/ai (b.code, b.check dahil) AYNI kovaları paylaşır; bir uçtan harcanan hak diğerinden düşer.
   IP başına saatte 60 + kullanıcı başına saatte 20 kod denemesi. D1 varken sınırlayıcı çalışmazsa deneme REDDEDİLİR (503): arızada kod tahmini açılmaz.
   Sınır dolmuşsa kod hiç değerlendirilmez (kodBagla çağrılmadan önce Response döner). Aşılmadıysa null. */
export async function kodDenemeSinir(env, request, kid) {
  const kapali = !!(env && env.DB), ms = 3600000;
  const ip = await hizSinir(env, { kova: "kodbagla-ip", kimlik: ipOf(request), adet: 60, ms, yedekIzin: !kapali });
  if (ip.hata) return fail(503, "gecici", "Servis geçici olarak kullanılamıyor. Biraz sonra tekrar dene.", bekleBaslik(ip));
  if (!ip.izin) return fail(429, "cok_istek", "", bekleBaslik(ip));
  if (kid) {
    const k = await hizSinir(env, { kova: "kodbagla-k", kimlik: kid, adet: 20, ms, yedekIzin: !kapali });
    if (k.hata) return fail(503, "gecici", "Servis geçici olarak kullanılamıyor. Biraz sonra tekrar dene.", bekleBaslik(k));
    if (!k.izin) return fail(429, "cok_istek", "", bekleBaslik(k));
  }
  return null;
}
