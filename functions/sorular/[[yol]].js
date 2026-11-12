// AKE Akademi · /sorular/* statik soru dosyaları (eski "soru fabrikası": liste.json + <tur>.json; dosyalarda cevap anahtarı a/x VARDIR)
// AŞAMA 3 kapatma anahtarı: AKE_SORU_V2=1 VE AKE_SORU_ESKI_KAPAT=1 birlikte açıksa bu yol 404 döner (dosyalar depoda durur, yayınlanmaz).
// Anahtar kapalıyken (bugünkü durum) istek aynen statik varlığa iletilir; davranış değişmez.
import { eskiKapali } from "../../lib/soru-bayrak.js";
export async function onRequest({ request, env }) {
  if (eskiKapali(env)) return new Response(JSON.stringify({ error: "yok" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  return env.ASSETS.fetch(request);
}
