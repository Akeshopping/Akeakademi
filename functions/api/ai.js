// AKE Akademi · AI öğretmen sunucusu (Cloudflare Pages Function) · adres: /api/ai
//
// Cloudflare > Workers & Pages > akeakademi > Settings > Variables and Secrets bölümünde (Production):
//   ANTHROPIC_API_KEY  Anthropic Console'dan alınan gizli anahtar (tür: Secret). Bu dosyaya ya da siteye ASLA yazılmaz.
//   AKE_GIZLI          Panelin ürettiği süreli erişim kodlarını doğrulayan gizli anahtar (tür: Secret; panelde Kodlar > Anahtarı göster).
//   AKE_KODLAR         (isteğe bağlı) süresiz deneme kodları, virgülle ayrılmış "KOD:paket" listesi. Örnek: AKE-G2D9-UZKM:premium
//   AKE_IPTAL          (isteğe bağlı) iptal edilen kodlar, virgülle ayrılmış liste.
//   AKE_MODEL_HIZLI, AKE_MODEL_GUCLU, AKE_EFOR_GUCLU (isteğe bağlı model ayarları)
// Ayar değiştirdikten sonra Deployments > son dağıtım > Retry deployment yapılmalıdır.
//
// Yanıt akışı Anthropic'ten olduğu gibi (SSE) tarayıcıya aktarılır; ayrıştırmayı tarayıcı yapar.
// Böylece sunucu neredeyse hiç işlemci kullanmaz (Cloudflare ücretsiz planı için önemli).

const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const hits = new Map(), strongHits = new Map();
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", EPOCH = Date.UTC(2026, 0, 1);
const isoOf = n => new Date(EPOCH + n * 86400000).toISOString().slice(0, 10);
const bugun = () => Math.floor((Date.now() + 3 * 3600000 - EPOCH) / 86400000); // Türkiye saati (UTC+3)
const kodAnahtar = c => { let s = String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); if (s.startsWith("AKE")) s = s.slice(3); return s.replace(/O/g, "0").replace(/[IL]/g, "1"); };

function json(status, obj, extra) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra || {}) });
}
const fail = (status, error, message) => json(status, { error, message: message || "" });

function kodlar(env) {
  const m = new Map();
  String(env.AKE_KODLAR || "").split(/[,;\n]+/).forEach(x => {
    const [k, p] = x.split(":").map(s => (s || "").trim());
    if (k && k.length >= 6) m.set(k.toUpperCase(), (p || "").toLowerCase() === "premium" ? "premium" : "orta");
  });
  return m;
}
function b32dec(s) {
  let bits = 0, val = 0; const out = [];
  for (const ch of s) { const v = B32.indexOf(ch); if (v < 0) return null; val = ((val << 5) | v) & 0xffff; bits += 5; if (bits >= 8) { bits -= 8; out.push((val >> bits) & 255); } }
  return new Uint8Array(out);
}
async function sureliKod(env, code) {
  const sec = String(env.AKE_GIZLI || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(sec)) return null;
  const k = kodAnahtar(code); if (k.length !== 16) return null;
  const b = b32dec(k); if (!b || b.length !== 10 || (b[0] >> 4) !== 1) return null;
  const key = await crypto.subtle.importKey("raw", new Uint8Array(sec.match(/../g).map(h => parseInt(h, 16))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, b.slice(0, 5)));
  let diff = 0; for (let i = 0; i < 5; i++) diff |= mac[i] ^ b[5 + i];
  if (diff) return null;
  return { plan: (b[0] & 15) === 2 ? "premium" : "orta", exp: (b[1] << 8) | b[2], key: k };
}
const iptal = env => new Set(String(env.AKE_IPTAL || "").split(/[,;\n]+/).map(kodAnahtar).filter(Boolean));

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return fail(405, "method");
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "yapilandirma", "Sunucuda ANTHROPIC_API_KEY tanımlı değil.");
  const MODEL = { hizli: env.AKE_MODEL_HIZLI || "claude-haiku-5-5", guclu: env.AKE_MODEL_GUCLU || "claude-sonnet-5-5" };
  const EFOR = ["low", "medium", "high"].includes(env.AKE_EFOR_GUCLU) ? env.AKE_EFOR_GUCLU : "medium";

  let b = {}; try { b = await request.json(); } catch (e) { b = {}; }
  if (!b || typeof b !== "object") b = {};
  const code = String(b.code || "").trim().toUpperCase();
  let plan = kodlar(env).get(code), bitis = "";
  if (!plan) {
    const k = await sureliKod(env, code);
    if (k && !iptal(env).has(k.key)) { if (bugun() > k.exp) return fail(401, "suresi"); plan = k.plan; bitis = isoOf(k.exp); }
  }
  if (!plan) return fail(401, "kod");
  if (b.check) return json(200, { ok: true, plan, bitis });

  const now = Date.now(), list = (hits.get(code) || []).filter(t => now - t < 5 * 60000);
  if (list.length >= 40) return fail(429, "rate_limited");
  list.push(now); hits.set(code, list);
  if (hits.size > 5000) hits.clear();

  let msgs = Array.isArray(b.messages) ? b.messages : (typeof b.prompt === "string" ? [{ role: "user", content: b.prompt }] : []);
  msgs = msgs.slice(-20).map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "").slice(0, 16000) })).filter(m => m.content.trim());
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const merged = [];
  for (const m of msgs) { const last = merged[merged.length - 1]; if (last && last.role === m.role) last.content += "\n\n" + m.content; else merged.push({ ...m }); }
  if (!merged.length || merged[merged.length - 1].role !== "user") return fail(400, "bos");
  if (merged.reduce((a, m) => a + m.content.length, 0) > 80000) return fail(413, "prompt_too_large");

  if (b.image && typeof b.image.data === "string") {
    if (!IMG_TYPES.includes(b.image.media_type) || b.image.data.length > 5000000) return fail(400, "image_rejected");
    const last = merged[merged.length - 1];
    last.content = [{ type: "image", source: { type: "base64", media_type: b.image.media_type, data: b.image.data } }, { type: "text", text: last.content }];
  }

  // Model seçimi:
  //  solve   : soru çözümü. Gelişmiş hak varsa güçlü model, yoksa hızlı model yüksek düzeyde.
  //  complex : deneme yorumu, çalışma planı. Premium'da güçlü model.
  //  quick   : kısa işler. default: diğer her şey (hızlı model, yüksek düzey).
  let strong = false, effort = "high";
  if (b.tier === "solve" && b.guclu) {
    const sk = code + "|" + new Date().toISOString().slice(0, 10), n = strongHits.get(sk) || 0;
    if (n < 40) { strong = true; effort = EFOR; strongHits.set(sk, n + 1); }
    if (strongHits.size > 5000) strongHits.clear();
  } else if (b.tier === "complex") { strong = plan === "premium"; effort = strong ? "medium" : "high"; }
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

  if (b.json) {
    const j = await r.json().catch(() => ({}));
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    return json(200, { text, truncated: j.stop_reason === "max_tokens", plan }, modelHdr);
  }
  return new Response(r.body, { status: 200, headers: Object.assign({ "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" }, modelHdr) });
}
