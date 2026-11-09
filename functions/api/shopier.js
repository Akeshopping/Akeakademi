// AKE Akademi · Shopier sipariş bildirimi (webhook) · adres: /api/shopier
// Shopier, ödeme alınan her siparişte buraya imzalı bir bildirim gönderir. İmza, webhook kurulurken Shopier'in verdiği
// anahtarla (veritabanında saklanır) doğrulanır; geçersiz imzalı istekler işlenmez.
import { json, fail, sema, ayarOku, hmacHex, esitMi, siparisIsle } from "../../lib/ortak.js";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return fail(405, "method");
  if (!env.DB) return fail(500, "yapilandirma");
  await sema(env);
  const ham = await request.text();
  if (ham.length > 200000) return fail(413, "buyuk");
  const token = await ayarOku(env, "shopier_webhook_token");
  if (!token) return fail(503, "kurulmadi");
  const imza = request.headers.get("shopier-signature") || "", h = await hmacHex(token, ham);
  if (!imza || !(esitMi(h.hex, imza) || esitMi(h.b64, imza))) return fail(401, "imza");
  const olay = request.headers.get("shopier-event") || "";
  if (olay && olay !== "order.created") return json(200, { ok: true, yok_sayildi: olay });
  let o; try { o = JSON.parse(ham); } catch (e) { return fail(400, "json"); }
  if (o && o.data && !o.id) o = o.data;
  if (!o || typeof o !== "object" || Array.isArray(o)) return fail(400, "json");
  try { const r = await siparisIsle(env, o); return json(200, { ok: true, durum: r.durum }); }
  catch (e) { console.error("siparis", e); return fail(500, "islem"); /* Shopier tekrar dener */ }
}
