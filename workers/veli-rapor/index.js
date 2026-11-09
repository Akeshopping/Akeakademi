// AKE Akademi · haftalık veli raporu zamanlayıcısı (Cloudflare Worker, cron tetikli)
// Cloudflare Pages Functions cron desteklemez; bu yüzden ayrı küçük bir Worker kullanılır.
import { haftalikGonder } from "../../lib/veli.js";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(haftalikGonder(env, { now: event.scheduledTime || Date.now() }).then(o => console.log("veli-rapor", JSON.stringify(o))));
  },
  async fetch() { return new Response("Not found", { status: 404 }); }
};
