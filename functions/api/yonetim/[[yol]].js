// AKE Akademi · yönetim uçları (yalnızca yönetici hesabı) · adres: /api/yonetim/...
//   GET  durum            Shopier kurulum durumu ve son siparişler
//   POST shopier-kur      Shopier'de sipariş bildirimini (webhook) kurar; SHOPIER_PAT gerekir
//   POST deneme-siparis   Ödeme yapmadan sahte bir siparişle sistemi dener (kod e-postası yöneticiye gider)
//   POST tekrar-gonder {id}  Bir siparişin kod e-postasını yeniden gönderir
import { json, fail, sema, oturum, yoneticiMi, ayarOku, ayarYaz, siparisIsle, epostaGonder, epostaSablon, PAKETLER } from "../../../lib/ortak.js";

const API = "https://api.shopier.com/v1";
async function shopier(env, path, opt) {
  const r = await fetch(API + path, Object.assign({ headers: { Authorization: "Bearer " + env.SHOPIER_PAT, "content-type": "application/json", accept: "application/json" } }, opt || {})).catch(() => null);
  if (!r) return { ok: false, status: 0, j: null };
  let j = null; try { j = await r.json(); } catch (e) { }
  return { ok: r.ok, status: r.status, j };
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) return fail(500, "yapilandirma");
  await sema(env);
  const u = await oturum(request, env);
  if (!u || !yoneticiMi(env, u)) return fail(403, "yetki");
  const ad = [].concat(params.yol || [])[0] || "", m = request.method, origin = new URL(request.url).origin;

  if (ad === "durum" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT id, eposta, ad, paket, tutar, tarih, durum FROM siparis ORDER BY tarih DESC LIMIT 50").all();
    const tok = await ayarOku(env, "shopier_webhook_token"), wid = await ayarOku(env, "shopier_webhook_id");
    const say = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM kullanici) AS kullanici, (SELECT COUNT(*) FROM kod WHERE kid IS NOT NULL AND kid != 'silindi') AS paket").first();
    return json(200, { pat: !!env.SHOPIER_PAT, eposta: !!env.RESEND_API_KEY, webhook: !!tok, webhookId: wid || "", siparisler: results || [], sayilar: say || {} });
  }
  if (ad === "shopier-kur" && m === "POST") {
    if (!env.SHOPIER_PAT) return fail(400, "pat_yok", "Cloudflare'e SHOPIER_PAT eklenmemiş.");
    const url = origin.replace("://www.", "://") + "/api/shopier";
    const l = await shopier(env, "/webhooks");
    if (l.status === 401 || l.status === 403) return fail(400, "pat_gecersiz", "Shopier anahtarı geçersiz ya da webhook yetkisi yok.");
    /* Shopier her olay için tek adrese izin verir; eski kaydı silip yeniden kur (imza anahtarı yalnızca kurulumda verilir) */
    for (const w of (Array.isArray(l.j) ? l.j : (l.j && l.j.data) || [])) if (w && w.event === "order.created" && w.id) await shopier(env, "/webhooks/" + encodeURIComponent(w.id), { method: "DELETE" });
    const c = await shopier(env, "/webhooks", { method: "POST", body: JSON.stringify({ event: "order.created", url }) });
    const w = c.j && (c.j.data || c.j);
    if (!c.ok || !w || !w.token) { console.error("webhook", c.status, JSON.stringify(c.j).slice(0, 300)); return fail(502, "shopier", "Shopier webhook kurulamadı (" + c.status + ")."); }
    await ayarYaz(env, "shopier_webhook_token", w.token); await ayarYaz(env, "shopier_webhook_id", String(w.id || ""));
    return json(200, { ok: true, url });
  }
  if (ad === "deneme-siparis" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { }
    const paket = PAKETLER[b.paket] ? b.paket : "orta-ay";
    const urun = { "orta-ay": "52547800", "orta-yil": "52547904", "premium-ay": "52547968", "premium-yil": "52547986" }[paket];
    const o = { id: "deneme-" + Date.now(), paymentStatus: "paid", billingInfo: { email: u.eposta, firstName: "Deneme" }, lineItems: [{ productId: urun, title: "AKE Akademi deneme", quantity: 1 }], totals: { total: "0" } };
    const r = await siparisIsle(env, o, true);
    return json(200, r);
  }
  if (ad === "tekrar-gonder" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { }
    const s = await env.DB.prepare("SELECT * FROM siparis WHERE id = ?").bind(String(b.id || "")).first();
    if (!s || !s.anahtar || !s.eposta) return fail(404, "yok");
    const kod = "AKE-" + s.anahtar.match(/.{4}/g).join("-"), adi = (PAKETLER[s.paket] || [, , s.paket])[2];
    const r = await epostaGonder(env, { to: s.eposta, subject: "AKE Akademi erişim kodun", text: `Erişim kodun (${adi}): ${kod}\nakeakademi.com'da bu e-postayla giriş yap.`, html: epostaSablon("Erişim kodun", `<p style="margin:0">${adi}</p><div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#1c38b0;margin-top:8px">${kod}</div><p style="margin:12px 0 0">akeakademi.com'da bu e-postayla giriş yap; paketin otomatik tanımlanır.</p>`) });
    if (r.ok) await env.DB.prepare("UPDATE siparis SET durum = 'gonderildi' WHERE id = ?").bind(s.id).run();
    return r.ok ? json(200, { ok: true }) : fail(502, "eposta");
  }
  return fail(404, "yok");
}
