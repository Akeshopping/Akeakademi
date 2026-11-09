// Cloudflare Pages Function: GET /api/acilis
// Etkin açılış konseptini yalnızca sunucu ortam değişkeni belirler (AKE_ACILIS). İstemciden değiştirilemez.
const GECERLI = ["1-bilgi-cekirdegi", "2-yasayan-bilgi", "3-esik", "4-esik-yasayan-bilgi-final"];
const VARSAYILAN = "4-esik-yasayan-bilgi-final";
export async function onRequestGet({ env }) {
  const k = GECERLI.includes(env.AKE_ACILIS) ? env.AKE_ACILIS : VARSAYILAN;
  return new Response(JSON.stringify({ konsept: k }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
