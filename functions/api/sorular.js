// AKE Akademi · onaylanmış ek sorular (herkese açık, önbellekli) · adres: /api/sorular
import { json, fail, sema, soruSema } from "../../lib/ortak.js";
import { eskiKapali } from "../../lib/soru-bayrak.js";
/* AŞAMA 3 kapatma anahtarı: AKE_SORU_V2=1 VE AKE_SORU_ESKI_KAPAT=1 birlikte açıksa bu herkese açık uç cevap anahtarlı soru DÖNDÜRMEZ.
   (V2 kapalıyken anahtar tek başına etki etmez: korumalı sistem yokken öğrencilerin ek soruları kaybolmasın.) Eski istemciler boş listeyle sorunsuz çalışır. */
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return fail(405, "method");
  if (eskiKapali(env)) return json(200, { sorular: [], s: 0, kapali: true }, { "cache-control": "no-store" });
  if (!env.DB) return json(200, { sorular: [], s: 0 });
  await sema(env); await soruSema(env);
  const { results } = await env.DB.prepare("SELECT json, karar FROM soru WHERE durum = 'onayli' ORDER BY karar ASC LIMIT 5000").all();
  const sorular = []; let son = 0;
  (results || []).forEach(r => { try { const q = JSON.parse(r.json); const nm = (((q.p || "") + "\n" + q.q).match(/(^|\n)\s*(I{1,3}|IV|V)[.)]\s|\((I{1,3}|IV|V)\)/g) || []).length >= 2; if (nm && (q.o || []).filter(x => /^(yalnız\s+)?(I{1,3}|IV|V)(\s|,|$)/i.test(String(x).trim())).length < 3) return; sorular.push(q); son = Math.max(son, r.karar || 0); } catch (e) { } });
  return json(200, { sorular, s: son }, { "cache-control": "public, max-age=300" });
}
