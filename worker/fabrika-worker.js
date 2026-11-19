// AKE Soru Fabrikası · ayrı Cloudflare Worker (cron). Uzun işler tek HTTP isteğinde ÇALIŞMAZ: kuyruk D1'dedir (fabrika_is),
// bu Worker her dakika en çok 3 iş alır (kilitli, tekrar denemeli, günlük çağrı kotalı). Robot anahtarı kapalıyken hiçbir model çağrısı yapmaz.
// Gerekli ayarlar: worker/README.md. Anahtar: Worker Secret ANTHROPIC_API_KEY (repoya/tarayıcıya/loga girmez).
import { isIsle, gunlukLimit } from "../lib/fabrika.js";
import { fabrikaClaude } from "../lib/fabrika-claude.js";

export const TUR_AZAMI_IS = 3;
/* Her tik tek bir günlük satırı yazar ("fabrika-worker {json}"): D1 bağlantısı, robot durumu ve günlük limit buradan doğrulanır.
   Satırda sır YOK (anahtar yalnız istemciye gider). D1 bağlı değilse sessiz geçilmez: d1_yok hatası fırlatılır. */
export async function tur(env) {
  if (!env.DB || typeof env.DB.prepare !== "function") throw new Error("d1_yok: DB bağlantısı tanımlı değil");
  const sonuc = await isIsle(env, { claudeFn: fabrikaClaude(env), azami: TUR_AZAMI_IS });
  console.log("fabrika-worker " + JSON.stringify({ d1: "baglandi", robot: sonuc.neden !== "robot_kapali", islenen: sonuc.islenen, neden: sonuc.neden || null, gunlukLimit: gunlukLimit(env), anahtar: env.ANTHROPIC_API_KEY ? "tanimli" : "yok" }));
  return sonuc;
}

export default {
  async scheduled(_olay, env, ctx) { ctx.waitUntil(tur(env).catch(e => console.error("fabrika-worker", String(e && e.message || e).slice(0, 200)))); },
  async fetch() { return new Response("yok", { status: 404 }); }   // HTTP'ye açık hiçbir uç yok
};
