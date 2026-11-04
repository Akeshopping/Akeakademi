// AKE Akademi · onaylanmış ek sorular (herkese açık, önbellekli) · adres: /api/sorular
import { json, fail, sema, soruSema } from "../../lib/ortak.js";
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return fail(405, "method");
  if (!env.DB) return json(200, { sorular: [], s: 0 });
  await sema(env); await soruSema(env);
  const { results } = await env.DB.prepare("SELECT json, karar FROM soru WHERE durum = 'onayli' ORDER BY karar ASC LIMIT 5000").all();
  const sorular = []; let son = 0;
  (results || []).forEach(r => { try { sorular.push(JSON.parse(r.json)); son = Math.max(son, r.karar || 0); } catch (e) { } });
  return json(200, { sorular, s: son }, { "cache-control": "public, max-age=300" });
}
