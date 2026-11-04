// AKE Akademi · sunucu ortak yardımcıları (Cloudflare Pages Functions tarafından içe aktarılır)
// Bu dosyada gizli bilgi yoktur; anahtarlar Cloudflare ayarlarındaki ortam değişkenlerinden okunur.

export const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const EPOCH = Date.UTC(2026, 0, 1);
export const isoOf = n => new Date(EPOCH + n * 86400000).toISOString().slice(0, 10);
export const bugunNo = () => Math.floor((Date.now() + 3 * 3600000 - EPOCH) / 86400000); // Türkiye saati (UTC+3)
export const bugunIso = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
export const ayAnahtar = () => bugunIso().slice(0, 7);
export const kodAnahtar = c => { let s = String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); if (s.startsWith("AKE")) s = s.slice(3); return s.replace(/O/g, "0").replace(/[IL]/g, "1"); };

export function json(status, obj, extra) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra || {}) });
}
export const fail = (status, error, message, extra) => json(status, { error, message: message || "" }, extra);

export async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
export function rastgele(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, "0")).join(""); }

/* ---------- erişim kodları ---------- */
export function kodlarEnv(env) {
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
export async function sureliKod(env, code) {
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
export const iptalEnv = env => new Set(String(env.AKE_IPTAL || "").split(/[,;\n]+/).map(kodAnahtar).filter(Boolean));
/* Kodu çözümle: { anahtar, plan, bitis ("" = süresiz) } ya da { hata, durum } */
export async function kodCoz(env, code) {
  const ham = String(code || "").trim().toUpperCase();
  const eski = kodlarEnv(env).get(ham);
  if (eski) return { anahtar: "L:" + ham, plan: eski, bitis: "" };
  const k = await sureliKod(env, ham);
  if (!k || iptalEnv(env).has(k.key)) return { hata: "kod", durum: 401 };
  if (bugunNo() > k.exp) return { hata: "suresi", durum: 401 };
  return { anahtar: k.key, plan: k.plan, bitis: isoOf(k.exp) };
}
export const maskele = a => String(a || "").startsWith("L:") ? "deneme kodu" : "AKE-" + String(a).slice(0, 4) + "-••••";

/* ---------- veritabanı ---------- */
let semaHazir = false;
export async function sema(env) {
  if (semaHazir) return;
  if (!env.DB) throw new Error("DB yok");
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS kullanici (id TEXT PRIMARY KEY, eposta TEXT UNIQUE, ad TEXT, google TEXT UNIQUE, olusturma INTEGER, son INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS oturum (hash TEXT PRIMARY KEY, kid TEXT NOT NULL, bitis INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS oturum_kid ON oturum (kid)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS giris (eposta TEXT PRIMARY KEY, hash TEXT, bitis INTEGER, deneme INTEGER, son_gonderim INTEGER, pencere INTEGER, sayac INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS veri (kid TEXT NOT NULL, alan TEXT NOT NULL, json TEXT NOT NULL, u INTEGER, PRIMARY KEY (kid, alan))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS kod (anahtar TEXT PRIMARY KEY, kid TEXT, plan TEXT, bitis TEXT, tarih INTEGER, siparis TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS kod_kid ON kod (kid)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS kullanim (kid TEXT NOT NULL, ay TEXT NOT NULL, mesaj INTEGER DEFAULT 0, guclu INTEGER DEFAULT 0, PRIMARY KEY (kid, ay))")
  ]);
  semaHazir = true;
}

/* ---------- oturum ---------- */
export const OTURUM_GUN = 60;
export function cerez(request, ad) {
  const c = request.headers.get("cookie") || "";
  const m = c.split(/;\s*/).find(x => x.startsWith(ad + "="));
  return m ? decodeURIComponent(m.slice(ad.length + 1)) : "";
}
export const cerezYaz = (ad, deger, saniye) => `${ad}=${encodeURIComponent(deger)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${saniye}`;
export async function oturum(request, env) {
  const t = cerez(request, "ake_s"); if (!t || t.length < 40) return null;
  await sema(env);
  const h = await sha256(t);
  const r = await env.DB.prepare("SELECT k.id, k.eposta, k.ad, o.bitis FROM oturum o JOIN kullanici k ON k.id = o.kid WHERE o.hash = ?").bind(h).first();
  if (!r || r.bitis < Date.now()) return null;
  return { id: r.id, eposta: r.eposta, ad: r.ad || "" };
}
export async function oturumAc(env, kid) {
  const t = rastgele(32), h = await sha256(t), bitis = Date.now() + OTURUM_GUN * 86400000;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO oturum (hash, kid, bitis) VALUES (?, ?, ?)").bind(h, kid, bitis),
    env.DB.prepare("UPDATE kullanici SET son = ? WHERE id = ?").bind(Date.now(), kid),
    env.DB.prepare("DELETE FROM oturum WHERE kid = ? AND bitis < ?").bind(kid, Date.now())
  ]);
  return cerezYaz("ake_s", t, OTURUM_GUN * 86400);
}
export async function kullaniciBulVeyaAc(env, { eposta, ad, google }) {
  eposta = String(eposta || "").trim().toLowerCase();
  let u = google ? await env.DB.prepare("SELECT * FROM kullanici WHERE google = ?").bind(google).first() : null;
  if (!u && eposta) u = await env.DB.prepare("SELECT * FROM kullanici WHERE eposta = ?").bind(eposta).first();
  if (u) {
    if ((google && !u.google) || (ad && !u.ad)) await env.DB.prepare("UPDATE kullanici SET google = COALESCE(google, ?), ad = COALESCE(NULLIF(ad, ''), ?) WHERE id = ?").bind(google || null, ad || "", u.id).run();
    return u.id;
  }
  const id = "u" + rastgele(10);
  await env.DB.prepare("INSERT INTO kullanici (id, eposta, ad, google, olusturma, son) VALUES (?, ?, ?, ?, ?, ?)").bind(id, eposta || null, ad || "", google || null, Date.now(), Date.now()).run();
  return id;
}
export const yoneticiMi = (env, u) => !!u && !!u.eposta && String(env.AKE_YONETICI || "alikaaneren13@gmail.com").toLowerCase().split(/[,\s]+/).includes(u.eposta.toLowerCase());

/* ---------- paket ve kota ---------- */
export async function aktifPaket(env, kid) {
  const { results } = await env.DB.prepare("SELECT anahtar, plan, bitis FROM kod WHERE kid = ?").bind(kid).all();
  const bugun = bugunIso();
  const aktif = (results || []).filter(r => !r.bitis || r.bitis >= bugun);
  if (!aktif.length) return null;
  aktif.sort((a, b) => (a.plan === b.plan ? 0 : a.plan === "premium" ? -1 : 1) || String(b.bitis || "9999").localeCompare(String(a.bitis || "9999")));
  const p = aktif[0];
  return { plan: p.plan, bitis: p.bitis || "", kod: maskele(p.anahtar) };
}
/* Kodu hesaba bağla. Aynı kod başka hesaba bağlıysa reddedilir. */
export async function kodBagla(env, kid, code, siparis) {
  const k = await kodCoz(env, code); if (k.hata) return k;
  const var_ = await env.DB.prepare("SELECT kid FROM kod WHERE anahtar = ?").bind(k.anahtar).first();
  if (var_ && var_.kid && var_.kid !== kid) return { hata: "baska_hesap", durum: 409 };
  if (!var_) await env.DB.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih, siparis) VALUES (?, ?, ?, ?, ?, ?)").bind(k.anahtar, kid, k.plan, k.bitis, Date.now(), siparis || null).run();
  else if (!var_.kid) await env.DB.prepare("UPDATE kod SET kid = ? WHERE anahtar = ?").bind(kid, k.anahtar).run();
  return { paket: await aktifPaket(env, kid) };
}
export function limitler(env, plan) {
  const n = (v, d) => { const x = parseInt(String(v || ""), 10); return Number.isFinite(x) && x >= 0 ? x : d; };
  return plan === "premium"
    ? { mesaj: n(env.AKE_LIMIT_PREMIUM, 500), guclu: n(env.AKE_GUCLU_PREMIUM, 60) }
    : { mesaj: n(env.AKE_LIMIT_ORTA, 200), guclu: n(env.AKE_GUCLU_ORTA, 20) };
}
export async function kullanimAl(env, kid) {
  const ay = ayAnahtar();
  const r = await env.DB.prepare("SELECT mesaj, guclu FROM kullanim WHERE kid = ? AND ay = ?").bind(kid, ay).first();
  return { ay, mesaj: (r && r.mesaj) || 0, guclu: (r && r.guclu) || 0 };
}
export async function kullanimArtir(env, kid, guclu) {
  await env.DB.prepare("INSERT INTO kullanim (kid, ay, mesaj, guclu) VALUES (?, ?, 1, ?) ON CONFLICT (kid, ay) DO UPDATE SET mesaj = mesaj + 1, guclu = guclu + excluded.guclu").bind(kid, ayAnahtar(), guclu ? 1 : 0).run();
}

/* ---------- e-posta (Resend) ---------- */
export async function epostaGonder(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) return { ok: false, hata: "yapilandirma" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ from: env.AKE_GONDEREN || "AKE Akademi <giris@akeakademi.com>", to: [to], subject, html, text, reply_to: env.AKE_YANIT || undefined })
  }).catch(() => null);
  if (!r || !r.ok) { const t = r ? await r.text().catch(() => "") : "ağ hatası"; console.error("Resend", r && r.status, t.slice(0, 300)); return { ok: false, hata: "eposta" }; }
  return { ok: true };
}
export const epostaSablon = (baslik, govdeHtml) => `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f6fa;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;padding:28px 18px"><div style="font-weight:800;font-size:18px;margin-bottom:18px">AKE <span style="color:#e0652a">AKADEMİ</span></div>
<div style="background:#fff;border:1px solid #e2e7ef;border-radius:14px;padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${baslik}</h1>${govdeHtml}</div>
<p style="font-size:12px;color:#8590a6;margin-top:16px">Bu e-postayı akeakademi.com'daki bir işlem nedeniyle aldın. Sen istemediysen dikkate alma.</p></div></body></html>`;
