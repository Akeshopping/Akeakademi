// AKE Akademi · AI öğretmen sunucusu (Vercel Function)
//
// Vercel > Settings > Environment Variables bölümünde iki ayar gerekir:
//   ANTHROPIC_API_KEY  Anthropic Console'dan alınan gizli anahtar. Bu dosyaya ya da siteye ASLA yazılmaz.
//   AKE_GIZLI          Panelin ürettiği süreli erişim kodlarını doğrulayan gizli anahtar (panelde "Kodlar" bölümünde oluşturulur).
//   AKE_KODLAR         (isteğe bağlı) süresiz deneme kodları, virgülle ayrılmış "KOD:paket" listesi. Örnek: AKE-G2D9-UZKM:premium
//   AKE_IPTAL          (isteğe bağlı) iptal edilen kodlar, virgülle ayrılmış liste.
// İsteğe bağlı: AKE_MODEL_HIZLI (varsayılan claude-haiku-5-5), AKE_MODEL_GUCLU (varsayılan claude-sonnet-5-5),
//   AKE_EFOR_GUCLU (gelişmiş çözümün düşünme düzeyi: low, medium, high · varsayılan medium)
// Soru çözümü (tier "solve"): öğrencinin aylık gelişmiş çözüm hakkı varsa güçlü model, yoksa hızlı model en yüksek düzeyde.
// Ayar değiştirdikten sonra Vercel'de Deployments > son dağıtım > Redeploy yapılmalıdır.

import crypto from "node:crypto";

export const config = { maxDuration: 120 };

const MODEL = { hizli: process.env.AKE_MODEL_HIZLI || "claude-haiku-5-5", guclu: process.env.AKE_MODEL_GUCLU || "claude-sonnet-5-5" };
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const hits = new Map(); // aynı sunucu örneğinde kod başına kısa süreli istek sınırı
const strongHits = new Map(); // aynı sunucu örneğinde kod başına günlük gelişmiş çözüm sınırı (kötüye kullanıma karşı)
const EFOR = ["low", "medium", "high"].includes(process.env.AKE_EFOR_GUCLU) ? process.env.AKE_EFOR_GUCLU : "medium";

function kodlar() {
  const m = new Map();
  String(process.env.AKE_KODLAR || "").split(/[,;\n]+/).forEach(x => {
    const [k, p] = x.split(":").map(s => (s || "").trim());
    if (k && k.length >= 6) m.set(k.toUpperCase(), (p || "").toLowerCase() === "premium" ? "premium" : "orta");
  });
  return m;
}
/* Süreli kod: AKE-XXXX-XXXX-XXXX-XXXX = 10 bayt (sürüm+paket, bitiş günü, rastgele, 5 bayt HMAC) · Crockford base32 */
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", EPOCH = Date.UTC(2026, 0, 1);
const isoOf = n => new Date(EPOCH + n * 86400000).toISOString().slice(0, 10);
function bugun() {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
}
const kodAnahtar = c => { let s = String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); if (s.startsWith("AKE")) s = s.slice(3); return s.replace(/O/g, "0").replace(/[IL]/g, "1"); };
function b32dec(s) {
  let bits = 0, val = 0; const out = [];
  for (const ch of s) { const v = B32.indexOf(ch); if (v < 0) return null; val = ((val << 5) | v) & 0xffff; bits += 5; if (bits >= 8) { bits -= 8; out.push((val >> bits) & 255); } }
  return Buffer.from(out);
}
function sureliKod(code) {
  const sec = String(process.env.AKE_GIZLI || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(sec)) return null;
  const k = kodAnahtar(code); if (k.length !== 16) return null;
  const b = b32dec(k); if (!b || b.length !== 10 || (b[0] >> 4) !== 1) return null;
  const mac = crypto.createHmac("sha256", Buffer.from(sec, "hex")).update(b.subarray(0, 5)).digest().subarray(0, 5);
  if (!crypto.timingSafeEqual(mac, b.subarray(5, 10))) return null;
  return { plan: (b[0] & 15) === 2 ? "premium" : "orta", exp: b.readUInt16BE(1), key: k };
}
const iptal = () => new Set(String(process.env.AKE_IPTAL || "").split(/[,;\n]+/).map(kodAnahtar).filter(Boolean));

function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
}
function fail(res, status, error, message) { res.status(status).json({ error, message: message || "" }); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "method");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fail(res, 500, "yapilandirma", "Sunucuda ANTHROPIC_API_KEY tanımlı değil.");

  const b = body(req), code = String(b.code || "").trim().toUpperCase();
  let plan = kodlar().get(code), bitis = "";
  if (!plan) {
    const k = sureliKod(code);
    if (k && !iptal().has(k.key)) { if (bugun() > k.exp) return fail(res, 401, "suresi"); plan = k.plan; bitis = isoOf(k.exp); }
  }
  if (!plan) return fail(res, 401, "kod");
  if (b.check) return res.status(200).json({ ok: true, plan, bitis });

  const now = Date.now(), list = (hits.get(code) || []).filter(t => now - t < 5 * 60000);
  if (list.length >= 40) return fail(res, 429, "rate_limited");
  list.push(now); hits.set(code, list);

  let msgs = Array.isArray(b.messages) ? b.messages : (typeof b.prompt === "string" ? [{ role: "user", content: b.prompt }] : []);
  msgs = msgs.slice(-20).map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "").slice(0, 16000) })).filter(m => m.content.trim());
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const merged = [];
  for (const m of msgs) { const last = merged[merged.length - 1]; if (last && last.role === m.role) last.content += "\n\n" + m.content; else merged.push({ ...m }); }
  if (!merged.length || merged[merged.length - 1].role !== "user") return fail(res, 400, "bos");
  if (merged.reduce((a, m) => a + m.content.length, 0) > 80000) return fail(res, 413, "prompt_too_large");

  if (b.image && typeof b.image.data === "string") {
    if (!IMG_TYPES.includes(b.image.media_type) || b.image.data.length > 5000000) return fail(res, 400, "image_rejected");
    const last = merged[merged.length - 1];
    last.content = [{ type: "image", source: { type: "base64", media_type: b.image.media_type, data: b.image.data } }, { type: "text", text: last.content }];
  }

  // Model seçimi:
  //  solve   : soru çözümü. Gelişmiş hak varsa güçlü model, yoksa hızlı model en yüksek düşünme düzeyinde.
  //  complex : deneme yorumu, çalışma planı. Premium'da güçlü model.
  //  quick   : kısa işler. default: diğer her şey (hızlı model, yüksek düzey).
  let strong = false, effort = "high";
  if (b.tier === "solve" && b.guclu) {
    const day = new Date().toISOString().slice(0, 10), sk = code + "|" + day, n = strongHits.get(sk) || 0;
    if (n < 40) { strong = true; effort = EFOR; strongHits.set(sk, n + 1); }
    if (strongHits.size > 5000) strongHits.clear();
  } else if (b.tier === "complex") { strong = plan === "premium"; effort = strong ? "medium" : "high"; }
  else if (b.tier === "quick") effort = "low";
  const payload = { model: strong ? MODEL.guclu : MODEL.hizli, max_tokens: strong ? 12000 : b.json ? 10000 : 8000, messages: merged, output_config: { effort }, stream: !b.json };
  res.setHeader("X-AKE-Model", strong ? "guclu" : "hizli");

  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload)
    });
  } catch (e) { return fail(res, 502, "network"); }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("Anthropic", r.status, t.slice(0, 500));
    if (r.status === 429) return fail(res, 429, "rate_limited");
    if (r.status === 529 || r.status >= 500) return fail(res, 503, "overloaded");
    if (r.status === 401 || r.status === 403) return fail(res, 500, "yapilandirma", "Anthropic anahtarı geçersiz ya da bakiye yetersiz.");
    if (r.status === 413) return fail(res, 413, "prompt_too_large");
    return fail(res, 502, "server");
  }

  if (b.json) {
    const j = await r.json().catch(() => ({}));
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    return res.status(200).json({ text, truncated: j.stop_reason === "max_tokens", plan });
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("X-Accel-Buffering", "no");
  const reader = r.body.getReader(), dec = new TextDecoder();
  res.on("close", () => { if (!res.writableEnded) reader.cancel().catch(() => { }); });
  let buf = "", stop = "", bad = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const ev = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = ev.split("\n").find(l => l.startsWith("data:"));
        if (!line) continue;
        let d; try { d = JSON.parse(line.slice(5)); } catch (e) { continue; }
        if (d.type === "content_block_delta" && d.delta && d.delta.type === "text_delta") res.write(d.delta.text);
        else if (d.type === "message_delta" && d.delta && d.delta.stop_reason) stop = d.delta.stop_reason;
        else if (d.type === "error") bad = true;
      }
    }
  } catch (e) { bad = true; }
  if (bad) res.write("\n\n[[AKE_HATA]]");
  else if (stop === "max_tokens") res.write("\n\n[[AKE_KESIK]]");
  res.end();
}
