// AKE Akademi · geliştirme dosyalarının web'den okunmasını engelleyen koruma (ACİL KAYNAK ERİŞİM YAMASI)
//
// NEDEN: Cloudflare Pages yayın klasörü depo kökü olduğundan, depodaki her dosya statik olarak herkese açıktı
// (ör. /fabrika/yazim/r01-mat.mjs soru yazım kodları, /functions/api/*.js sunucu kaynakları, /docs, /lib, /tests, /migrations).
// ÇÖZÜM: Bu klasörlerin her biri için bir Pages Function rotası vardır (functions/<klasör>/[[yol]].js). Pages'te Function rotası
// statik dosyadan ÖNCE çalışır; bu yüzden aynı adresteki gerçek dosya artık sunulmaz. Yanıt: 404 + no-store.
// Rotalar yalnız bu klasörlerde çalışır; ana sayfa, API'ler ve diğer statik dosyalar Function çağrısına girmez (kota/hız etkilenmez).
//
// Bir geliştirme klasörü eklenirse: KORUNAN_KLASORLER'e ve functions/<klasör>/[[yol]].js'e ekleyin; tests/yol-koruma.test.mjs
// depodaki her üst düzey öğenin "korunan" ya da "bilerek herkese açık" olarak sınıflandırılmasını zorunlu kılar.
export const KORUNAN_KLASORLER = ["fabrika", "docs", "tests", "lib", "migrations", "functions"];
// Bilerek herkese açık olanlar (site çalışması için gerekli):
export const HERKESE_ACIK_KLASORLER = ["acilis", "icons", "matematik-yks-sorulari", "sorular", "sss"];
export const HERKESE_ACIK_DOSYALAR = ["index.html", "sw.js", "ayar.js", "manifest.webmanifest", "favicon.ico", "apple-touch-icon.png", "apple-touch-icon-precomposed.png", "og.png", "robots.txt", "sitemap.xml"];
// Yayın dışı olması gereken kök dosyaları (Pages bunları sunmuyorsa fark etmez; tek tek test edilir):
export const YAYIN_DISI_DOSYALAR = [".gitignore", "_headers"];

/* Yol normalleştirme: statik sunucu "//fabrika/x", "/fabrika//x", "/%66abrika/x", "/fabrika%2fx", "/a/../fabrika/x" gibi biçimleri de çözüp
   dosyayı sunabildiği için (wrangler pages dev ile doğrulandı), Function rotası tek başına yetmez: karar NORMALLEŞTİRİLMİŞ yolla verilir. */
export function yolParcalari(pathname) {
  let p = String(pathname || "");
  for (let i = 0; i < 3; i++) { let d; try { d = decodeURIComponent(p); } catch (e) { return null; } if (d === p) break; p = d; }   // çift kodlama dahil
  p = p.replace(/\\/g, "/").replace(/\0/g, "");
  const out = []; for (const s of p.split("/")) { if (s === "" || s === ".") continue; if (s === "..") { out.pop(); continue; } out.push(s); }
  return out;
}
export function korunanMi(pathname) {
  const seg = yolParcalari(pathname); if (seg === null) return true;   // çözülemeyen kodlama: güvenli tarafta kal
  if (!seg.length) return false;
  const ilk = seg[0].toLowerCase().replace(/[.\s]+$/, "");
  if (KORUNAN_KLASORLER.includes(ilk)) return true;
  if (seg.some((x, i) => x.startsWith(".") && !(i === 0 && x === ".well-known"))) return true;                     // .git, .env, .gitignore, .dev.vars ...
  if (seg.length === 1 && /^_(headers|redirects|routes\.json|worker\.js|middleware\.js)$/i.test(seg[0])) return true;  // yapılandırma dosyaları
  return false;
}

export const korumaYaniti = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
