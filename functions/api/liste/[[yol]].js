// AKE Akademi · "Açıldığında haber ver" listesi · adres: /api/liste/...  (mantık: lib/liste.js)
//   POST kaydet     {eposta, izin:true, paket?}  kayıt başlatır, onay e-postası gönderir (çift onay)
//   GET  onayla?t=  onay sayfası (durum DEĞİŞTİRMEZ); düğme POST /onayla yapar
//   POST onayla     {t}                            kaydı onaylar
//   GET  cik?e=&t=  silme sayfası (durum değiştirmez); düğme POST /cik yapar
//   POST cik        {e, t}                         kaydı ve izni siler (imzalı bağlantı)
//   POST sil-iste   {eposta}                       adrese silme bağlantısı gönderir
// Gerekenler: DB (D1), AKE_GIZLI (Secret), RESEND_API_KEY (Secret; onay e-postası için). Ödeme/sipariş koduna dokunmaz.
import { fail } from "../../../lib/ortak.js";
import { kaydet, onayla, cik, silIste, sayfa, onayFormu, cikFormu, epostaTemizle, cikisBelirteci } from "../../../lib/liste.js";

const SONUC = {
  onaylandi: ["Kaydın onaylandı", "Ücretli paketler açıldığında sana bir kez e-posta ile haber vereceğiz. İstediğin zaman her e-postadaki bağlantıdan kaydını silebilirsin."],
  zaten_onayli: ["Kaydın zaten onaylı", "Başka bir işlem gerekmiyor."],
  silindi: ["Kaydın silindi", "Adresin ve iznin listeden tamamen kaldırıldı. Bu adrese artık açılış haberi gönderilmez."]
};
const HATA = ["Bağlantı geçersiz", "Bağlantının süresi dolmuş ya da bağlantı hatalı olabilir. Sitedeki formu yeniden doldurabilirsin."];

export async function onRequest({ request, env, params }) {
  const yol = [].concat(params.yol || []), ad = yol[0] || "", m = request.method, url = new URL(request.url);
  if (!env.DB) return fail(500, "yapilandirma");
  try {
    if (ad === "kaydet" && m === "POST") return await kaydet(env, request);
    if (ad === "sil-iste" && m === "POST") return await silIste(env, request);
    if (ad === "onayla") {
      if (m === "GET") { const t = url.searchParams.get("t") || ""; return /^[0-9a-f]{32}$/.test(t) ? sayfa("Onayını tamamla", "Açıldığında haber verme isteğini onaylamak için düğmeye bas.", onayFormu(t)) : sayfa(HATA[0], HATA[1]); }
      if (m === "POST") return await bitir(await onayla(env, request.clone()), request);
    }
    if (ad === "cik") {
      if (m === "GET") {
        const e = epostaTemizle(url.searchParams.get("e")), t = url.searchParams.get("t") || "";
        if (!e || !env.AKE_GIZLI || !/^[0-9a-f]{64}$/.test(t) || (await cikisBelirteci(env, e)) !== t) return sayfa(HATA[0], HATA[1]);
        return sayfa("Kaydını silmek mi istiyorsun?", "Düğmeye basınca adresin ve izin kaydın listeden tamamen silinir.", cikFormu(e, t));
      }
      if (m === "POST") return await bitir(await cik(env, request.clone()), request);
    }
  } catch (e) { console.error("liste", e); return fail(500, "islem"); }
  return fail(404, "yok");
}

/* Bağlantı sayfasındaki form (urlencoded) POST ederse insan okunur sayfa; fetch (JSON) ise JSON döner. */
async function bitir(yanit, request) {
  if (!String(request.headers.get("content-type") || "").includes("application/x-www-form-urlencoded")) return yanit;
  let j = {}; try { j = await yanit.clone().json(); } catch (e) { }
  if (yanit.status === 200 && SONUC[j.durum]) return sayfa(SONUC[j.durum][0], SONUC[j.durum][1]);
  return sayfa(HATA[0], j.error === "cok_istek" ? "Çok fazla deneme yaptın; biraz sonra tekrar dene." : HATA[1]);
}
