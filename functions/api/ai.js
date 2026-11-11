// AKE Akademi · AI öğretmen sunucusu (Cloudflare Pages Function) · adres: /api/ai
//
// Cloudflare > Workers & Pages > akeakademi > Settings > Variables and Secrets bölümünde (Production):
//   ANTHROPIC_API_KEY  Anthropic Console'dan alınan gizli anahtar (tür: Secret). Bu dosyaya ya da siteye ASLA yazılmaz.
//   AKE_GIZLI          Panelin ürettiği süreli erişim kodlarını doğrulayan gizli anahtar (tür: Secret; panelde Kodlar > Anahtarı göster).
//   AKE_KODLAR         (isteğe bağlı) süresiz deneme kodları, virgülle ayrılmış "KOD:paket" listesi. Örnek: AKE-G2D9-UZKM:premium
//   AKE_IPTAL          (isteğe bağlı) iptal edilen kodlar, virgülle ayrılmış liste.
//   AKE_MODEL_HIZLI, AKE_MODEL_GUCLU, AKE_EFOR_GUCLU (isteğe bağlı model ayarları)
//   AKE_LIMIT_ORTA / AKE_LIMIT_PREMIUM, AKE_GUCLU_ORTA / AKE_GUCLU_PREMIUM (isteğe bağlı aylık haklar; varsayılan 200/500 ve 20/60)
//   Bindings: D1 veritabanı DB bağlıysa AI yalnızca giriş yapmış ve kodu hesabına bağlı öğrenciye çalışır; kota sunucuda tutulur.
// Ayar değiştirdikten sonra Deployments > son dağıtım > Retry deployment yapılmalıdır.
//
// Yanıt akışı Anthropic'ten olduğu gibi (SSE) tarayıcıya aktarılır; ayrıştırmayı tarayıcı yapar.
// Böylece sunucu neredeyse hiç işlemci kullanmaz (Cloudflare ücretsiz planı için önemli).

import { hizSinir, bekleBaslik, kodDenemeSinir } from "../../lib/hiz.js";
import { json, fail, sema, oturum, aktifPaket, kodBagla, kullanimAl, kullanimArtir, limitler, kodCoz, giderYaz } from "../../lib/ortak.js";

const MAX_IMAGE_BASE64 = 5_000_000;
const MAX_REQUEST_BYTES = 7_000_000;
const IMAGE_FORMATS = new Map([
  ["image/jpeg", bytes => bytes.length > 5 && bytes.startsWith("\xff\xd8\xff") && bytes.endsWith("\xff\xd9")],
  ["image/png", bytes => bytes.length >= 45 && bytes.startsWith("\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR") && bytes.endsWith("\x00\x00\x00\x00IEND\xaeB\x60\x82")],
  ["image/webp", webpMatches],
  ["image/gif", bytes => bytes.length >= 14 && /^(GIF87a|GIF89a)/.test(bytes) && bytes.endsWith("\x3b")],
]);

function webpMatches(bytes) {
  if (bytes.length < 20 || !bytes.startsWith("RIFF") || bytes.slice(8, 12) !== "WEBP") return false;
  const riffSize = (bytes.charCodeAt(4) | bytes.charCodeAt(5) << 8 | bytes.charCodeAt(6) << 16 | bytes.charCodeAt(7) << 24) >>> 0;
  return riffSize === bytes.length - 8 && ["VP8 ", "VP8L", "VP8X"].includes(bytes.slice(12, 16));
}

function imageMatches(image) {
  const matches = IMAGE_FORMATS.get(image.media_type);
  const data = image.data;
  if (!matches || typeof data !== "string" || !data.length || data.length > MAX_IMAGE_BASE64) return false;
  try { return matches(atob(data)); } catch { return false; }
}

// null signals an oversized body. Count streamed bytes even when Content-Length is absent.
async function readAiJson(request) {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return {};
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode());
    return value && typeof value === "object" ? value : {};
  } catch { return {}; }
  finally { reader.releaseLock(); }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return fail(405, "method");
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "yapilandirma", "Sunucuda ANTHROPIC_API_KEY tanımlı değil.");
  const MODEL = { hizli: env.AKE_MODEL_HIZLI || "claude-haiku-5-5", guclu: env.AKE_MODEL_GUCLU || "claude-sonnet-5-5" };
  const EFOR = ["low", "medium", "high"].includes(env.AKE_EFOR_GUCLU) ? env.AKE_EFOR_GUCLU : "medium";

  const b = await readAiJson(request);
  if (b === null) return fail(413, "prompt_too_large");

  /* Hesap ve paket: AI, hesaba bağlı ve süresi geçmemiş bir erişim koduyla çalışır.
     Veritabanı bağlı değilse (eski kurulum) yalnızca koda bakılır. */
  let kid = null, plan = null, bitis = "", sayac = null, lim = null;
  if (env.DB) {
    try { await sema(env); } catch (e) { return fail(500, "yapilandirma", "Veritabanı hazırlanamadı."); }
    const u = await oturum(request, env);
    if (!u) return fail(401, "giris");
    kid = u.id;
    let pk = await aktifPaket(env, kid);
    if (!pk && b.code) {
      /* Erişim kodu denemesi hesap/kod-bagla ile AYNI D1 bütçesini paylaşır; kodBagla'dan ÖNCE denetlenir (b.check dahil bu yolu atlayamaz).
         Sınırlayıcı çalışmıyorsa 503: arızada kod tahminine izin verilmez. */
      const red = await kodDenemeSinir(env, request, kid); if (red) return red;
      const r = await kodBagla(env, kid, b.code); if (r.hata) return fail(r.durum || 400, r.hata); pk = r.paket; }
    if (!pk) return fail(402, "paket");
    plan = pk.plan; bitis = pk.bitis;
    if (b.check) return json(200, { ok: true, plan, bitis });
    lim = limitler(env, plan); sayac = await kullanimAl(env, kid);
    if (sayac.mesaj >= lim.mesaj) return fail(429, "kota", "", { "x-ake-mesaj": String(sayac.mesaj), "x-ake-guclu": String(sayac.guclu) });
  } else {
    const k = await kodCoz(env, b.code);
    if (k.hata) return fail(k.durum, k.hata);
    plan = k.plan; bitis = k.bitis;
    if (b.check) return json(200, { ok: true, plan, bitis });
  }
  const code = kid || String(b.code || "").trim().toUpperCase();

  /* AI istek sınırı (D1, atomik): hesap (veya DB yoksa kod) başına 5 dakikada 40 istek; tüm Worker örneklerinde ortak. */
  /* DB varken sınırlayıcı çalışmazsa (tablo yok / D1 hatası) ücretli istek REDDEDİLİR: bellek içi yedek örnek başınadır, AI maliyetini sınırsıza açardı. */
  const ah = await hizSinir(env, { kova: "ai", kimlik: code, adet: 40, ms: 5 * 60000, yedekIzin: !env.DB });
  if (ah.hata) return fail(503, "gecici", "Servis geçici olarak kullanılamıyor. Biraz sonra tekrar dene.", bekleBaslik(ah));
  if (!ah.izin) return fail(429, "rate_limited", "", bekleBaslik(ah));

  let msgs = Array.isArray(b.messages) ? b.messages : (typeof b.prompt === "string" ? [{ role: "user", content: b.prompt }] : []);
  msgs = msgs.slice(-20).map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "").slice(0, 16000) })).filter(m => m.content.trim());
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const merged = [];
  for (const m of msgs) { const last = merged[merged.length - 1]; if (last && last.role === m.role) last.content += "\n\n" + m.content; else merged.push({ ...m }); }
  if (!merged.length || merged[merged.length - 1].role !== "user") return fail(400, "bos");
  if (merged.reduce((a, m) => a + m.content.length, 0) > 80000) return fail(413, "prompt_too_large");

  if (b.image != null) {
    if (!imageMatches(b.image)) return fail(400, "image_rejected");
    const last = merged[merged.length - 1];
    last.content = [{ type: "image", source: { type: "base64", media_type: b.image.media_type, data: b.image.data } }, { type: "text", text: last.content }];
  }

  // Model seçimi:
  //  solve   : soru çözümü. Gelişmiş hak varsa güçlü model, yoksa hızlı model yüksek düzeyde.
  //  complex : deneme yorumu, çalışma planı. Premium'da güçlü model.
  //  quick   : kısa işler. default: diğer her şey (hızlı model, yüksek düzey).
  let strong = false, effort = "high";
  if (b.tier === "solve" && (sayac ? sayac.guclu < lim.guclu : b.guclu)) { strong = true; effort = EFOR; }
  else if (b.tier === "complex") { strong = plan === "premium"; effort = strong ? "medium" : "high"; }
  else if (b.tier === "quick") effort = "low";
  const payload = { model: strong ? MODEL.guclu : MODEL.hizli, max_tokens: strong ? 12000 : b.json ? 10000 : 8000, messages: merged, output_config: { effort }, stream: !b.json };
  const modelHdr = { "x-ake-model": strong ? "guclu" : "hizli" };

  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload)
    });
  } catch (e) { return fail(502, "network"); }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("Anthropic", r.status, t.slice(0, 500));
    if (r.status === 429) return fail(429, "rate_limited");
    if (r.status === 529 || r.status >= 500) return fail(503, "overloaded");
    if (r.status === 401 || r.status === 403) return fail(500, "yapilandirma", "Anthropic anahtarı geçersiz ya da bakiye yetersiz.");
    if (r.status === 413) return fail(413, "prompt_too_large");
    return fail(502, "server");
  }

  if (kid) {
    try { await kullanimArtir(env, kid, strong && b.tier === "solve"); } catch (e) { console.error("kullanim", e); }
    modelHdr["x-ake-mesaj"] = String(sayac.mesaj + 1); modelHdr["x-ake-guclu"] = String(sayac.guclu + (strong && b.tier === "solve" ? 1 : 0));
  }
  if (b.json) {
    const j = await r.json().catch(() => ({}));
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    await giderYaz(env, "ai", strong ? "guclu" : "hizli", j.usage && j.usage.input_tokens, j.usage && j.usage.output_tokens);
    return json(200, { text, truncated: j.stop_reason === "max_tokens", plan }, modelHdr);
  }
  /* akış biterken token kullanımını kaydet (içeriğe dokunmadan) */
  let gi = 0, co = 0, tail = "";
  const dec = new TextDecoder(), mod = strong ? "guclu" : "hizli";
  const izle = new TransformStream({
    transform(chunk, ctl) {
      ctl.enqueue(chunk);
      try {
        tail += dec.decode(chunk, { stream: true });
        for (const m of tail.matchAll(/"input_tokens":\s*(\d+)/g)) gi = Math.max(gi, +m[1]);
        for (const m of tail.matchAll(/"output_tokens":\s*(\d+)/g)) co = Math.max(co, +m[1]);
        tail = tail.slice(-200);
      } catch (e) { }
    },
    async flush() { await giderYaz(env, "ai", mod, gi, co); }
  });
  return new Response(r.body.pipeThrough(izle), { status: 200, headers: Object.assign({ "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" }, modelHdr) });
}
