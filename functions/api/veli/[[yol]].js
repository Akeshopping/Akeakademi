// AKE Akademi · veli raporu uçları (Cloudflare Pages Function) · adres: /api/veli/...
// Özellik VELI_RAPORU="1" ve migrations/0001_veli_raporu.sql uygulanmadan çalışmaz (varsayılan kapalı).
//   GET  durum                 öğrencinin kendi ayarı (oturum gerekir)
//   POST adres {eposta, yas}   veli adresi girer; veliye doğrulama e-postası gider
//   POST etkin {deger}         raporu aç/kapat (yalnızca veli onayladıysa açılır)
//   POST izin-geri-cek         izni geri çeker, gönderimi durdurur
//   GET  onizleme              öğrencinin kendi verisinden rapor önizlemesi
//   GET/POST onay?t=           veli: aydınlatma + açık rıza sayfası (tek kullanımlık bağlantı)
//   GET/POST yonet?t=          veli: gönderimi durdur / izni geri çek (tek kullanımlık bağlantı)
import { json, fail, sema, oturum } from "../../../lib/ortak.js";
import { veliAcik, veliHazirMi, durumGetir, adresKaydet, etkinDegistir, izinGeriCek, onayVer, veliDurdur, tokenOku, raporKur, AYDINLATMA, ONAY_SURUM } from "../../../lib/veli.js";

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SAYFA_BASLIK = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; img-src https://akeakademi.com; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
function sayfa(baslik, govde, durum) {
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(baslik)} · AKE Akademi</title>
<style>body{margin:0;background:#F5F1E8;color:#171715;font:16px/1.55 system-ui,Segoe UI,Arial,sans-serif}main{max-width:560px;margin:0 auto;padding:20px 16px 40px}header{background:#171715;color:#F5F1E8;border-bottom:3px solid #C5A572;border-radius:14px 14px 0 0;padding:16px;display:flex;align-items:center;gap:10px;font-weight:700}header img{width:34px;height:34px;border-radius:9px}.k{background:#fff;border:1px solid #e0d8c8;border-top:0;border-radius:0 0 14px 14px;padding:20px 16px}h1{font-size:20px;margin:0 0 10px}ul{padding-left:20px;font-size:14px;color:#30302b}li{margin:6px 0}button{display:block;width:100%;min-height:48px;margin-top:10px;border-radius:10px;border:1px solid #254236;font:700 16px inherit;cursor:pointer}.e{background:#254236;color:#F5F1E8}.h{background:#fff;color:#254236}.n{font-size:13px;color:#66625a}</style></head><body><main><header><img src="https://akeakademi.com/icons/eposta-logo-v2.png" alt="" width="34" height="34">AKE Akademi</header><div class="k">${govde}</div></main></body></html>`, { status: durum || 200, headers: SAYFA_BASLIK });
}
const gecersiz = () => sayfa("Bağlantı geçersiz", `<h1>Bağlantı geçerli değil</h1><p>Bu bağlantının süresi dolmuş, daha önce kullanılmış ya da iptal edilmiş olabilir. Hiçbir veri paylaşılmadı. Gerekirse öğrencinin yeni bir doğrulama e-postası göndermesini isteyin.</p>`, 400);

export async function onRequest({ request, env, params }) {
  const yol = [].concat(params.yol || []), ad = yol[0] || "", m = request.method, url = new URL(request.url);
  if (!env.DB) return fail(500, "yapilandirma");
  if (!veliAcik(env)) return ad === "onay" || ad === "yonet" ? gecersiz() : fail(403, "kapali", "Veli raporu henüz etkin değil.");
  try { await sema(env); } catch (e) { return fail(500, "yapilandirma"); }
  if (!(await veliHazirMi(env))) return fail(503, "hazir_degil", "Veli raporu veritabanı hazırlığı tamamlanmadı.");
  const origin = url.origin;

  /* ----- veli sayfaları: oturum yok, belirteç yetkidir ----- */
  if (ad === "onay" || ad === "yonet") {
    let t = url.searchParams.get("t") || "";
    if (m === "POST") { try { const f = await request.formData(); t = String(f.get("t") || t); if (ad === "onay" && f.get("karar") === "red") { /* reddet: hiçbir şey yapma, belirteci kapat */ const k = await tokenOku(env, t, "onay"); if (k) { await izinGeriCek(env, k.kid, "veli_reddetti"); } return sayfa("Reddedildi", `<h1>Rapor gönderilmeyecek</h1><p>Talebi reddettiniz. Hiçbir kişisel veri paylaşılmadı ve paylaşılmayacak.</p>`); } } catch (e) { } }
    const tur = ad === "onay" ? "onay" : "yonet";
    if (m === "GET") {
      const k = await tokenOku(env, t, tur); if (!k) return gecersiz();
      if (ad === "onay") return sayfa("Veli raporu onayı", `<h1>Aydınlatma metni ve açık rıza</h1><ul>${AYDINLATMA.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="n">Onay sürümü: ${esc(ONAY_SURUM)}. Onay vermeden hiçbir veri paylaşılmaz.</p><form method="post" action="/api/veli/onay"><input type="hidden" name="t" value="${esc(t)}"><button class="e" name="karar" value="onay">Aydınlatma metnini okudum, açık rıza veriyorum</button><button class="h" name="karar" value="red">Onaylamıyorum</button></form>`);
      return sayfa("Rapor tercihleri", `<h1>Rapor gönderimini durdur</h1><p>Haftalık raporu almayı bırakmak ve verdiğiniz izni geri çekmek için aşağıdaki düğmeye basın. İşlem hemen uygulanır.</p><form method="post" action="/api/veli/yonet"><input type="hidden" name="t" value="${esc(t)}"><button class="e">Göndermeyi durdur ve iznimi geri çekiyorum</button></form><p class="n">Daha sonra yeniden rapor almak isterseniz öğrencinin yeni bir doğrulama başlatması gerekir.</p>`);
    }
    if (m === "POST") {
      if (ad === "onay") { const r = await onayVer(env, t); return r.ok ? sayfa("Onaylandı", `<h1>Teşekkürler, onayınız alındı</h1><p>Öğrenci raporu etkinleştirdiğinde haftalık özet bu adrese gönderilecek. Her e-postadaki bağlantıdan izni istediğiniz zaman geri çekebilirsiniz.</p>`) : gecersiz(); }
      const r = await veliDurdur(env, t); return r.ok ? sayfa("Durduruldu", `<h1>Gönderim durduruldu</h1><p>Haftalık rapor gönderimi durduruldu ve izniniz geri çekildi.</p>`) : gecersiz();
    }
    return fail(405, "yontem");
  }

  /* ----- öğrenci uçları: oturum zorunlu, yalnızca kendi verisi ----- */
  const u = await oturum(request, env); if (!u) return fail(401, "giris");
  const govde = async () => { try { return await request.json(); } catch (e) { return {}; } };
  if (ad === "durum" && m === "GET") return json(200, await durumGetir(env, u.id));
  if (ad === "adres" && m === "POST") {
    const b = await govde(), r = await adresKaydet(env, u.id, { eposta: b.eposta, yas: b.yas, ogrenciAd: u.ad || "", origin });
    return r.hata ? fail(r.durum || 400, r.hata) : json(200, { ok: true });
  }
  if (ad === "etkin" && m === "POST") { const b = await govde(), r = await etkinDegistir(env, u.id, !!b.deger); return r.hata ? fail(r.durum || 400, r.hata) : json(200, { ok: true }); }
  if (ad === "izin-geri-cek" && m === "POST") { await izinGeriCek(env, u.id, "ogrenci"); return json(200, { ok: true }); }
  if (ad === "onizleme" && m === "GET") return json(200, { rapor: await raporKur(env, u.id, Date.now()) });
  return fail(404, "yok");
}
