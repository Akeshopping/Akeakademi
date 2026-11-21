// AKE Akademi · "Açıldığında haber ver" listesi · adres: /api/liste/...  (mantık: lib/liste.js)
//   POST kaydet     {eposta, izin:true, paket?}  kayıt başlatır, onay e-postası gönderir (çift onay)
//   GET  onayla?t=  onay sayfası (durum DEĞİŞTİRMEZ); düğme POST /onayla yapar
//   POST onayla     {t}                            kaydı onaylar
//   GET  cik?e=&t=  silme sayfası (durum değiştirmez); düğme POST /cik yapar
//   POST cik        {e, t}                         kaydı ve izni siler (imzalı bağlantı)
//   POST sil-iste   {eposta}                       adrese silme bağlantısı gönderir
//   POST temizle                                   zamanlanmış temizlik (Bearer AKE_TEMIZLIK): süresi dolan BEKLEYEN satırları siler; sayı döner
//   GET/POST yeni-onay {eposta}                    BEKLEYEN kayıt için yeni onay e-postası (eskisi geçersiz; kayıtla aynı hız sınırları; yanıt adresi sızdırmaz)
// Gerekenler: DB (D1), AKE_GIZLI (Secret), RESEND_API_KEY (Secret; onay e-postası için). Ödeme/sipariş koduna dokunmaz.
import { fail } from "../../../lib/ortak.js";
import { kaydet, onayla, yeniOnay, temizle, cik, silIste, sayfa, onayFormu, cikFormu, yeniOnayFormu, epostaTemizle, cikisBelirteci } from "../../../lib/liste.js";

const SONUC = {
  onaylandi: ["Kaydın onaylandı", "Ücretli paketler açıldığında sana bir kez e-posta ile haber vereceğiz. İstediğin zaman her e-postadaki bağlantıdan kaydını silebilirsin."],
  zaten_onayli: ["Kaydın zaten onaylı", "Başka bir işlem gerekmiyor."],
  onay_gonderildi: ["Kontrol et", "Bu adres onay bekliyorsa yeni bir onay e-postası gönderdik. E-posta en çok 10 dakikada bir gönderilir; gelmediyse biraz bekleyip spam klasörüne de bak. Yeni e-posta geldiğinde yalnızca <b>en son gelenin</b> bağlantısı çalışır. Kaydın silinmişse ya da süresi dolmuşsa <a href=\"/#premium\">formu yeniden doldur</a>."],
  silindi: ["Kaydın silindi", "Adresin ve iznin listeden tamamen kaldırıldı. Bu adrese artık açılış haberi gönderilmez."]
};
const HATA = ["Bağlantı geçersiz", "Bağlantının süresi dolmuş ya da bağlantı hatalı olabilir. Sitedeki formu yeniden doldurabilirsin."];
const FORM_LINK = ` Gerekirse <a href="/#premium">formu yeniden doldurabilirsin</a>.`;
/* Başarısız onay: neden ayrı ve yeni e-posta isteme yolu. "gecersiz" (bozuk bağlantı) da aynı çıkışı alır. */
const ONAY_HATA = {
  suresi_doldu: ["Bağlantının süresi dolmuş", "Onay bağlantıları 48 saat geçerlidir ve bu süre dolmuş. Süresi dolan kayıtlar silinir; lütfen formu yeniden doldur." + FORM_LINK, false],
  eski_baglanti: ["Bu bağlantı artık geçerli değil", "Daha yeni bir onay e-postası gelmiş olabilir: en son gelen e-postadaki bağlantıyı kullan. Bulamazsan aşağıdan yeni e-posta iste.", true],
  gecersiz: ["Bağlantı geçersiz", "Bağlantı eksik ya da bozuk olabilir. E-postadaki düğmeyi kullan ya da aşağıdan yeni onay e-postası iste.", true]
};
const onayHata = (kod) => { const [b, m, f] = ONAY_HATA[kod] || ONAY_HATA.gecersiz; return sayfa(b, m, f ? yeniOnayFormu() : ""); };

export async function onRequest({ request, env, params }) {
  const yol = [].concat(params.yol || []), ad = yol[0] || "", m = request.method, url = new URL(request.url);
  if (!env.DB) return fail(500, "yapilandirma");
  try {
    if (ad === "kaydet" && m === "POST") return await kaydet(env, request);
    if (ad === "sil-iste" && m === "POST") return await silIste(env, request);
    if (ad === "onayla") {
      if (m === "GET") { const t = url.searchParams.get("t") || ""; return /^[0-9a-f]{32}$/.test(t) ? sayfa("Onayını tamamla", "Açıldığında haber verme isteğini onaylamak için düğmeye bas.", onayFormu(t)) : onayHata("gecersiz"); }
      if (m === "POST") return await bitir(await onayla(env, request.clone()), request);
    }
    if (ad === "temizle" && m === "POST") return await temizle(env, request);
    if (ad === "yeni-onay") {
      if (m === "GET") return sayfa("Yeni onay e-postası iste", "Adresini yaz; onay bekleyen bir kaydın varsa yeni bir onay e-postası göndeririz. Yeni e-posta eskisini geçersiz kılar.", yeniOnayFormu());
      if (m === "POST") return await bitir(await yeniOnay(env, request.clone()), request);
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
  if (j.error === "cok_istek") return sayfa("Biraz bekle", "Çok fazla deneme yaptın; biraz sonra tekrar dene.");
  if (new URL(request.url).pathname.endsWith("/yeni-onay")) return sayfa("Gönderilemedi", j.error === "eposta_gecersiz" ? "E-posta adresi geçerli görünmüyor. Lütfen kontrol edip tekrar dene." : "Şu an gönderilemedi. Biraz sonra tekrar dene.", yeniOnayFormu());
  if (new URL(request.url).pathname.endsWith("/onayla")) return onayHata(j.error);
  return sayfa(HATA[0], HATA[1]);
}
