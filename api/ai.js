// AKE Akademi · AI öğretmen sunucusu (Vercel Function)
//
// Vercel > Settings > Environment Variables bölümünde iki ayar gerekir:
//   ANTHROPIC_API_KEY  Anthropic Console'dan alınan gizli anahtar. Bu dosyaya ya da siteye ASLA yazılmaz.
//   AKE_KODLAR         AI kullanabilecek erişim kodları, virgülle ayrılmış "KOD:paket" listesi.
//                      Örnek: AKE-PRM-7K3Q9X:premium, AKE-ORT-4M2T8V:orta
// İsteğe bağlı: AKE_MODEL_HIZLI (varsayılan claude-haiku-5-5), AKE_MODEL_GUCLU (varsayılan claude-sonnet-5-5)
// Ayar değiştirdikten sonra Vercel'de Deployments > son dağıtım > Redeploy yapılmalıdır.

export const config = { maxDuration: 120 };

const MODEL = { hizli: process.env.AKE_MODEL_HIZLI || "claude-haiku-5-5", guclu: process.env.AKE_MODEL_GUCLU || "claude-sonnet-5-5" };
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const hits = new Map(); // aynı sunucu örneğinde kod başına kısa süreli istek sınırı

function kodlar() {
  const m = new Map();
  String(process.env.AKE_KODLAR || "").split(/[,;\n]+/).forEach(x => {
    const [k, p] = x.split(":").map(s => (s || "").trim());
    if (k && k.length >= 6) m.set(k.toUpperCase(), (p || "").toLowerCase() === "premium" ? "premium" : "orta");
  });
  return m;
}
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

  const b = body(req), code = String(b.code || "").trim().toUpperCase(), plan = kodlar().get(code);
  if (!plan) return fail(res, 401, "kod");
  if (b.check) return res.status(200).json({ ok: true, plan });

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

  // Orta paket her zaman hızlı modeli kullanır; Premium'da zor işler (deneme yorumu, plan) güçlü modele gider.
  const complex = b.tier === "complex", strong = complex && plan === "premium";
  const effort = b.tier === "quick" ? "low" : complex ? (strong ? "medium" : "high") : "medium";
  const payload = { model: strong ? MODEL.guclu : MODEL.hizli, max_tokens: b.json ? 10000 : 8000, messages: merged, output_config: { effort }, stream: !b.json };

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
