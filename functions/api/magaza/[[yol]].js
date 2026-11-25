// AKE Akademi · mağaza bildirimleri · adres: /api/magaza/google ve /api/magaza/apple
//
// Google Play (Pub/Sub push, RTDN) ve App Store Server Notifications V2 buraya gelir. Bildirim YALNIZCA TETİKLEYİCİDİR:
// içeriğine güvenilmez, hiçbir erişim bildirimden açılmaz. Sunucu kayıtlı işlem için mağazaya yeniden sorar (lib/magaza.js bildirimIsle).
// Google adresi gizli bir anahtar ister: /api/magaza/google?s=<MAGAZA_BILDIRIM_SIRRI> (Pub/Sub abonelik adresine eklenir).
import { json, fail, sema, esitMi } from "../../../lib/ortak.js";
import { googleBildirimi, appleBildirimi, bildirimIsle, magazaModu } from "../../../lib/magaza.js";

export async function onRequest({ request, env, params }) {
  if (request.method !== "POST") return fail(405, "yontem");
  if (magazaModu(env) === "kapali") return fail(503, "kapali");
  const ad = [].concat(params.yol || []).join("/");
  let g; try { g = await request.json(); } catch (e) { g = {}; }
  try { await sema(env); } catch (e) { return fail(500, "db"); }
  if (ad === "google") {
    const sir = String(env.MAGAZA_BILDIRIM_SIRRI || "");
    if (!sir || !esitMi(new URL(request.url).searchParams.get("s"), sir)) return fail(403, "yetkisiz");
    const r = await bildirimIsle(env, googleBildirimi(g)).catch(e => { console.error("google bildirim", e); return null; });
    return json(r ? 200 : 500, { ok: !!r }); // 500: Pub/Sub yeniden dener
  }
  if (ad === "apple") {
    const r = await bildirimIsle(env, appleBildirimi(g)).catch(e => { console.error("apple bildirim", e); return null; });
    return json(r ? 200 : 500, { ok: !!r });
  }
  return fail(404, "yok");
}
