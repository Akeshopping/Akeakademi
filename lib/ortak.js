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
    env.DB.prepare("CREATE TABLE IF NOT EXISTS kullanim (kid TEXT NOT NULL, ay TEXT NOT NULL, mesaj INTEGER DEFAULT 0, guclu INTEGER DEFAULT 0, PRIMARY KEY (kid, ay))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ayar (k TEXT PRIMARY KEY, v TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS siparis (id TEXT PRIMARY KEY, eposta TEXT, ad TEXT, paket TEXT, anahtar TEXT, tutar TEXT, tarih INTEGER, durum TEXT, ham TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS siparis_eposta ON siparis (eposta)")
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
  if (!aktif.length) {
    /* Kartsız 7 günlük deneme: hesap açıldığı günden itibaren */
    const u = await env.DB.prepare("SELECT olusturma FROM kullanici WHERE id = ?").bind(kid).first();
    const gun = parseInt(String(env.AKE_DENEME_GUN || "0"), 10) || 0; /* varsayılan kapalı */
    const son = gun > 0 && u && u.olusturma ? u.olusturma + gun * 86400000 : 0;
    if (son > Date.now()) return { plan: "deneme", bitis: new Date(son).toISOString().slice(0, 10), kod: "7 günlük deneme", deneme: true };
    return null;
  }
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
  if (plan === "deneme") return { mesaj: n(env.AKE_LIMIT_DENEME, 30), guclu: n(env.AKE_GUCLU_DENEME, 3) };
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
export async function epostaGonder(env, { to, subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY) return { ok: false, hata: "yapilandirma" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ from: env.AKE_GONDEREN || "AKE Akademi <giris@akeakademi.com>", to: [to], subject, html, text, reply_to: replyTo || env.AKE_YANIT || undefined })
  }).catch(() => null);
  if (!r || !r.ok) { const t = r ? await r.text().catch(() => "") : "ağ hatası"; console.error("Resend", r && r.status, t.slice(0, 300)); return { ok: false, hata: "eposta" }; }
  return { ok: true };
}
export const epostaSablon = (baslik, govdeHtml) => `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f6fa;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;padding:28px 18px"><div style="margin-bottom:20px"><img src="https://akeakademi.com/icons/icon-192.png" width="30" height="30" alt="" style="vertical-align:middle;border-radius:9px;margin-right:9px"><span style="vertical-align:middle;font-weight:800;font-size:19px;letter-spacing:-.01em;color:#0e1220">AKE <span style="font-weight:500">Akademi</span></span></div>
<div style="background:#fff;border:1px solid #e2e7ef;border-radius:14px;padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${baslik}</h1>${govdeHtml}</div>
<p style="font-size:12px;color:#8590a6;margin-top:16px">Bu e-postayı akeakademi.com'daki bir işlem nedeniyle aldın. Sen istemediysen dikkate alma.</p></div></body></html>`;

/* ---------- erişim kodu üretimi (paneldeki ile aynı biçim) ---------- */
function b32enc(bytes) {
  let bits = 0, val = 0, out = "";
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export async function kodUret(env, plan, gun) {
  const sec = String(env.AKE_GIZLI || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(sec)) throw new Error("AKE_GIZLI yok");
  const exp = bugunNo() + gun, b = new Uint8Array(10), r = new Uint8Array(2); crypto.getRandomValues(r);
  b[0] = 0x10 | (plan === "premium" ? 2 : 1); b[1] = (exp >> 8) & 255; b[2] = exp & 255; b[3] = r[0]; b[4] = r[1];
  const key = await crypto.subtle.importKey("raw", new Uint8Array(sec.match(/../g).map(h => parseInt(h, 16))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, b.slice(0, 5)));
  b.set(mac.slice(0, 5), 5);
  const s = b32enc(b);
  return { kod: "AKE-" + s.match(/.{4}/g).join("-"), anahtar: s, plan, bitis: isoOf(exp) };
}

/* ---------- Shopier ---------- */
export const PAKETLER = { "orta-ay": ["orta", 30, "Atılım · 1 ay"], "orta-yil": ["orta", 365, "Atılım · 1 yıl"], "premium-ay": ["premium", 30, "Premium · 1 ay"], "premium-yil": ["premium", 365, "Premium · 1 yıl"] };
const URUN_VARSAYILAN = { "52547800": "orta-ay", "52547904": "orta-yil", "52547968": "premium-ay", "52547986": "premium-yil" };
/* Ürün kimliğinden (yoksa ürün adından) paketi bul. AKE_URUNLER ile değiştirilebilir: "52547800:orta-ay,52547904:orta-yil,..." */
export function urunPaketi(env, item) {
  const m = Object.assign({}, URUN_VARSAYILAN);
  String(env.AKE_URUNLER || "").split(/[,;\n]+/).forEach(x => { const [k, v] = x.split(":").map(s => (s || "").trim()); if (k && PAKETLER[v]) m[k] = v; });
  const id = String((item && item.productId) || "").trim();
  if (m[id]) return m[id];
  const t = String((item && item.title) || "").toLocaleLowerCase("tr");
  if (!/ake/.test(t)) return null;
  const p = /premium/.test(t) ? "premium" : /orta|at[ıi]l[ıi]m/.test(t) ? "orta" : null, d = /y[ıi]l/.test(t) ? "yil" : /\bay\b|1 ay/.test(t) ? "ay" : null;
  return p && d ? p + "-" + d : null;
}
export async function hmacHex(anahtar, veri) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(anahtar), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(veri)));
  return { hex: [...s].map(x => x.toString(16).padStart(2, "0")).join(""), b64: btoa(String.fromCharCode(...s)) };
}
export const esitMi = (a, b) => { a = String(a || ""); b = String(b || ""); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
export async function ayarOku(env, k) { const r = await env.DB.prepare("SELECT v FROM ayar WHERE k = ?").bind(k).first(); return r ? r.v : null; }
export async function ayarYaz(env, k, v) { await env.DB.prepare("INSERT INTO ayar (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(k, v).run(); }
export async function pushToken(env) { let t = await ayarOku(env, "push_token"); if (!t) { t = rastgele(24); await ayarYaz(env, "push_token", t); } return t; }
/* Sipariş e-postasına bağlı, henüz bir hesaba tanımlanmamış kodları hesaba bağla (giriş sonrası) */
export async function bekleyenKodlariBagla(env, kid, eposta) {
  if (!eposta) return;
  const { results } = await env.DB.prepare("SELECT s.anahtar FROM siparis s JOIN kod k ON k.anahtar = s.anahtar WHERE s.eposta = ? AND k.kid IS NULL").bind(String(eposta).toLowerCase()).all();
  for (const r of results || []) await env.DB.prepare("UPDATE kod SET kid = ? WHERE anahtar = ? AND kid IS NULL").bind(kid, r.anahtar).run();
}

/* Ödenmiş bir Shopier siparişini işle: her paket için kod üret, alıcının hesabı varsa bağla, e-postayla gönder. Aynı sipariş iki kez işlenmez. */
/* ---------- Ödeme doğrulama (Shopier siparişi) ----------
   Erişim kodu YALNIZCA ödemenin başarılı olduğu kesin görülürse üretilir:
   1) bildirimde paymentStatus = "paid" (AKE_ODEME_DURUMLARI ile ek başarı değerleri tanımlanabilir), ya da
   2) durum alanı yoksa ve SHOPIER_PAT tanımlıysa siparişin Shopier API'den sorgulanıp "paid" görülmesi.
   Durum yoksa / okunamıyorsa kod üretilmez; sipariş "odeme_dogrulanamadi" olarak yönetici panelinde görünür (ham veri saklanır). */
const FIYAT_VARSAYILAN = { "orta-ay": 199, "orta-yil": 2189, "premium-ay": 399, "premium-yil": 4389 };
const durumOku = o => String((o && o.paymentStatus != null) ? o.paymentStatus : "").trim().toLowerCase();
const odendiMi = (env, st) => st === "paid" || String(env.AKE_ODEME_DURUMLARI || "").toLowerCase().split(/[,;\s]+/).filter(Boolean).includes(st);
export function tutarOku(v) {
  let t = String(v == null ? "" : v).replace(/[^\d.,-]/g, ""); if (!t) return NaN;
  const nok = t.lastIndexOf("."), vir = t.lastIndexOf(",");
  if (nok >= 0 && vir >= 0) t = nok > vir ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  else if (vir >= 0) t = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  else if (nok >= 0 && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  const n = parseFloat(t); return Number.isFinite(n) ? n : NaN;
}
export function beklenenTutar(env, kalemler) {
  const m = Object.assign({}, FIYAT_VARSAYILAN);
  String(env.AKE_FIYATLAR || "").split(/[,;\n]+/).forEach(x => { const [k, v] = x.split(":").map(q => (q || "").trim()); const n = Number(v); if (PAKETLER[k] && n > 0) m[k] = n; });
  return kalemler.reduce((a, k) => a + (m[k] || 0), 0);
}
async function odemeDogrula(env, o, id, deneme) {
  if (deneme) return { ok: true };
  const st = durumOku(o);
  if (st) return odendiMi(env, st) ? { ok: true } : { ok: false, durum: "odenmedi" };
  if (env.SHOPIER_PAT) {
    try {
      const r = await fetch("https://api.shopier.com/v1/orders/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + env.SHOPIER_PAT, Accept: "application/json" } });
      if (r.ok) { const j = await r.json().catch(() => null), d = j && (j.data || j), s2 = durumOku(d); if (d && String(d.id || "") === id && odendiMi(env, s2)) return { ok: true }; }
    } catch (e) { console.error("shopier siparis sorgusu", e); }
  }
  return { ok: false, durum: "odeme_dogrulanamadi" };
}
async function sipariskaydiYaz(env, id, sonek, durum, eposta, tutar, ham) {
  /* kod üretmeden denetim kaydı. Gerçek siparişin sonradan işlenebilmesi için id'ye ek getirilir (mükerrer saymaz). */
  await env.DB.prepare("INSERT OR IGNORE INTO siparis (id, eposta, ad, paket, anahtar, tutar, tarih, durum, ham) VALUES (?, ?, '', '', '', ?, ?, ?, ?)").bind(id + sonek, eposta, String(tutar || ""), Date.now(), durum, String(ham || "").slice(0, 4000)).run();
}
export async function siparisIsle(env, o, deneme) {
  const id = String((o && o.id) || "").trim(); if (!id) return { durum: "kimliksiz" };
  const dg = await odemeDogrula(env, o, id, deneme);
  if (!dg.ok) {
    if (dg.durum === "odeme_dogrulanamadi") { const bi0 = (o && o.billingInfo) || {}; await sipariskaydiYaz(env, id, "!odeme", dg.durum, String(bi0.email || "").trim().toLowerCase(), o && o.totals && o.totals.total, JSON.stringify(o)); }
    return { durum: dg.durum };
  }
  const varmi = await env.DB.prepare("SELECT id FROM siparis WHERE id = ? OR id LIKE ?").bind(id, id + "#%").first();
  if (varmi) return { durum: "zaten" };
  const bi = o.billingInfo || {}, si = o.shippingInfo || {};
  const eposta = String(bi.email || si.email || "").trim().toLowerCase(), ad = [bi.firstName || si.firstName, bi.lastName || si.lastName].filter(Boolean).join(" ");
  const kalemler = [];
  (o.lineItems || []).forEach(it => { const p = urunPaketi(env, it); if (p) for (let i = 0; i < Math.max(1, Math.min(5, +it.quantity || 1)); i++) kalemler.push(p); });
  if (kalemler.length && !deneme) {
    const top = tutarOku(o.totals && o.totals.total), bek = beklenenTutar(env, kalemler);
    /* ödenen tutar beklenenin yarısından azsa (kupon payı bırakılır) kod üretilmez; yönetici inceler */
    if (Number.isFinite(top) && bek > 0 && top < bek * 0.5) { await sipariskaydiYaz(env, id, "!tutar", "tutar_uyusmuyor", eposta, o.totals.total, JSON.stringify(o)); return { durum: "tutar_uyusmuyor" }; }
  }
  if (!kalemler.length) { await env.DB.prepare("INSERT INTO siparis (id, eposta, ad, paket, anahtar, tutar, tarih, durum, ham) VALUES (?, ?, ?, '', '', ?, ?, 'paket_yok', ?)").bind(id, eposta, ad, String((o.totals && o.totals.total) || ""), Date.now(), JSON.stringify(o).slice(0, 4000)).run(); return { durum: "paket_yok" }; }
  const u = eposta ? await env.DB.prepare("SELECT id FROM kullanici WHERE eposta = ?").bind(eposta).first() : null;
  const kodlar = [];
  for (let i = 0; i < kalemler.length; i++) {
    const [plan, gun, adi] = PAKETLER[kalemler[i]], k = await kodUret(env, plan, gun), sid = kalemler.length > 1 ? id + "#" + (i + 1) : id;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih, siparis) VALUES (?, ?, ?, ?, ?, ?)").bind(k.anahtar, u ? u.id : null, plan, k.bitis, Date.now(), sid),
      env.DB.prepare("INSERT INTO siparis (id, eposta, ad, paket, anahtar, tutar, tarih, durum, ham) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(sid, eposta, ad, kalemler[i], k.anahtar, String((o.totals && o.totals.total) || ""), Date.now(), deneme ? "deneme" : "kod_uretildi", JSON.stringify(o).slice(0, 4000))
    ]);
    kodlar.push({ sid, kod: k.kod, adi, bitis: k.bitis });
  }
  if (!eposta) { for (const k of kodlar) await env.DB.prepare("UPDATE siparis SET durum = 'eposta_yok' WHERE id = ?").bind(k.sid).run(); return { durum: "eposta_yok", kodlar }; }
  const tarih = d => new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const liste = kodlar.map(k => `<div style="margin:10px 0;padding:14px;border-radius:10px;background:#e9eeff"><div style="font-size:13px;color:#475569">${k.adi} · ${tarih(k.bitis)} tarihine kadar</div><div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#1c38b0;margin-top:4px">${k.kod}</div></div>`).join("");
  const nasil = u ? `<p style="margin:12px 0 0"><b>Paketin hesabına tanımlandı.</b> akeakademi.com'a bu e-postayla giriş yapıp AI öğretmeni hemen kullanabilirsin.</p>`
    : `<p style="margin:12px 0 0"><b>Nasıl kullanırım?</b> akeakademi.com'da sağ üstteki <b>Giriş yap</b>'a bas ve <b>bu e-posta adresiyle</b> (${eposta}) giriş yap; paketin otomatik tanımlanır. Başka bir hesapla girersen kodu <b>Hesabım</b> sayfasına yazman yeterli.</p>`;
  const r = await epostaGonder(env, {
    to: eposta, subject: deneme ? "[Deneme] AKE Akademi erişim kodun" : "AKE Akademi erişim kodun hazır",
    text: `Teşekkürler${ad ? " " + ad : ""}! Erişim kodun:\n${kodlar.map(k => `${k.adi}: ${k.kod} (${tarih(k.bitis)} tarihine kadar)`).join("\n")}\n\nakeakademi.com'da bu e-postayla giriş yap; paketin otomatik tanımlanır. Kod kişiseldir, paylaşma.`,
    html: epostaSablon(`Teşekkürler${ad ? " " + ad.split(" ")[0] : ""}, paketin hazır`, `<p style="margin:0">Siparişin için teşekkürler. Erişim kodun:</p>${liste}${nasil}<p style="margin:12px 0 0;color:#475569;font-size:13px">Süre bugünden başlar, otomatik yenileme yoktur. Kod kişiseldir; başkasıyla paylaşma. Sorun olursa bu e-postayı yanıtlayabilirsin.</p>`)
  });
  const durum = r.ok ? (deneme ? "deneme" : "gonderildi") : "eposta_hatasi";
  for (const k of kodlar) await env.DB.prepare("UPDATE siparis SET durum = ? WHERE id = ?").bind(durum, k.sid).run();
  return { durum, kodlar, bagli: !!u };
}


/* ---------- Yapay zekâ gider kaydı (gün · kaynak · model): çağrı ve token sayısı ---------- */
export const gunTR = (t) => new Date((t || Date.now()) + 3 * 3600e3).toISOString().slice(0, 10);
export async function giderYaz(env, kaynak, model, giris, cikis) {
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS gider (gun TEXT NOT NULL, kaynak TEXT NOT NULL, model TEXT NOT NULL, adet INTEGER DEFAULT 0, giris INTEGER DEFAULT 0, cikis INTEGER DEFAULT 0, PRIMARY KEY (gun, kaynak, model))").run();
    await env.DB.prepare("INSERT INTO gider (gun, kaynak, model, adet, giris, cikis) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT (gun, kaynak, model) DO UPDATE SET adet = adet + 1, giris = giris + excluded.giris, cikis = cikis + excluded.cikis").bind(gunTR(), kaynak, model, giris | 0, cikis | 0).run();
  } catch (e) { console.error("gider", e); }
}
export async function giderBugun(env, kaynak) {
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS gider (gun TEXT NOT NULL, kaynak TEXT NOT NULL, model TEXT NOT NULL, adet INTEGER DEFAULT 0, giris INTEGER DEFAULT 0, cikis INTEGER DEFAULT 0, PRIMARY KEY (gun, kaynak, model))").run();
    const r = await env.DB.prepare("SELECT COALESCE(SUM(adet), 0) AS n FROM gider WHERE gun = ? AND kaynak = ?").bind(gunTR(), kaynak).first();
    return (r && r.n) || 0;
  } catch (e) { return 0; }
}

/* ---------- Anthropic (sunucu içi, akışsız) ---------- */
export async function claude(env, { model, prompt, effort, max_tokens }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: max_tokens || 12000, messages: [{ role: "user", content: prompt }], output_config: { effort: effort || "high" } })
  }).catch(() => null);
  if (!r || !r.ok) { const t = r ? await r.text().catch(() => "") : ""; console.error("claude", r && r.status, t.slice(0, 300)); return null; }
  const j = await r.json().catch(() => ({}));
  await giderYaz(env, "uretim", model, j.usage && j.usage.input_tokens, j.usage && j.usage.output_tokens);
  return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
}
export function jsonAyikla(t) {
  t = String(t || "").replace(/```(?:json)?/gi, "").trim();
  const i = t.search(/[[{]/), j = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (i < 0 || j < i) return undefined;
  try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return undefined; }
}
/* Onaylanmış ek sorular tablosu */
export async function soruSema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS soru (id TEXT PRIMARY KEY, s TEXT, t TEXT, d INTEGER, json TEXT, durum TEXT, tarih INTEGER, karar INTEGER)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS soru_durum ON soru (durum, karar)").run();
}
