// AKE Soru Fabrikası · Anthropic istemcisi. YALNIZ ayrı Worker (worker/fabrika-worker.js) kullanır.
// Anahtar yalnız ortamdan (Worker Secret ANTHROPIC_API_KEY) okunur; ne yanıta, ne hata metnine, ne loga yazılır.
// Öğrenci /api/ai yolundan bağımsızdır; giderYaz/gider tablosuna dokunmaz (kayıt fabrika_cagri'dadır, lib/fabrika.js yazar).
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const RETRY_TAVAN_MS = 300000;   // retry-after ne derse desin bekleme üst sınırı

export function fabrikaClaude(env, { zamanAsimiMs = 60000 } = {}) {
  return async ({ model, prompt, max_tokens }) => {
    if (!env.ANTHROPIC_API_KEY) return { hata: "anahtar_yok" };
    const ac = new AbortController(), zt = setTimeout(() => ac.abort(), zamanAsimiMs);
    try {
      const r = await fetch(ANTHROPIC_URL, {
        method: "POST", signal: ac.signal,
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: max_tokens || 4000, messages: [{ role: "user", content: prompt }] })
      });
      if (!r.ok) {
        await r.text().catch(() => "");   // gövde okunur ama saklanmaz/yazdırılmaz
        const ra = parseFloat(r.headers.get("retry-after"));
        return { hata: "http_" + r.status, bekle_ms: Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, RETRY_TAVAN_MS) : 0 };
      }
      const j = await r.json().catch(() => null);
      if (!j) return { hata: "yanit_cozumlenemedi" };
      const u = j.usage || {};
      return { metin: (j.content || []).filter(c => c.type === "text").map(c => c.text).join(""), giris: u.input_tokens || 0, cikis: u.output_tokens || 0 };
    } catch (e) { return { hata: e && e.name === "AbortError" ? "zaman_asimi" : "ag_hatasi" }; }
    finally { clearTimeout(zt); }
  };
}
