// AKE Akademi · "Açıldığında haber ver" (erken erişim) listesi · mantık modülü
//
// AMAÇ: Ücretli paketler henüz satışta değil. Bu liste YALNIZCA "paketler açıldığında bir kez haber ver" iznini tutar.
//   - Ödeme alınmaz, sipariş oluşmaz, paket ya da fiyat garantisi verilmez.
//   - Bu bir kampanya / ticari ileti izni DEĞİLDİR (İYS kapsamı ayrıdır). Toplu e-posta gönderen kod YOKTUR; bu modül yalnızca tek tek
//     işlem e-postası (onay ve silme bağlantısı) gönderir.
// GÜVENLİK:
//   - Çift onay (double opt-in): kayıt "bekliyor" başlar; adrese gönderilen tek kullanımlık bağlantı onaylanınca "onayli" olur.
//     Onay bağlantısı GET ile durum değiştirmez (e-posta tarayıcıları bağlantıyı önceden açar); sayfadaki düğme POST yapar.
//   - Onay belirteci rastgele 128 bit; veritabanında yalnızca SHA-256 özeti (gizli anahtarla) tutulur. 48 saat geçerli.
//   - Tekrar kayıt: e-posta birincil anahtardır, eşzamanlı istekler de çift satır üretemez (ON CONFLICT). Kayıtlı/bekleyen adres için
//     yanıt, yeni kayıtla AYNIDIR (adres var mı yok mu sızmaz); bekleyene en çok 10 dakikada bir yeniden onay e-postası gider.
//   - Hız sınırı: IP başına saatte 10, adres başına saatte 3 kayıt; silme isteği ve onay için ayrı sınırlar (lib/hiz.js, D1).
//   - Silme / izin geri çekme: her e-postadaki bağlantı (HMAC imzalı; adresi tahmin eden silemez) ve "Kaydımı sil" formu. Silme = satırın
//     tamamen kaldırılması; geriye adres ya da izin kaydı kalmaz.
//   - Gizlilik: IP açık metin yazılmaz (gizli anahtarla özet); yalnızca kötüye kullanım incelemesi için.
// Gizli anahtar: env.AKE_GIZLI (yoksa uçlar 503 verir; zayıf varsayılan kullanılmaz).
import { json, fail, sha256, rastgele, epostaGonder, epostaSablon, hmacHex, esitMi } from "./ortak.js";
import { ipHiz, hizSinir, bekleBaslik, ipOf } from "./hiz.js";

export const IZIN_SURUM = "2026-11-21";               /* kullanıcıya gösterilen izin ve aydınlatma metninin sürümü */
export const ONAY_OMRU_MS = 48 * 3600e3;
export const YENIDEN_MS = 10 * 60e3;
export const PAKETLER = ["atilim", "premium", "ikisi"];
const EPOSTA_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/i;
const PAKET_AD = { atilim: "Atılım", premium: "Premium", ikisi: "Atılım ve Premium" };

let semaHazir = false;
export function _semaSifirla() { semaHazir = false; }
export async function listeSema(env) {
  if (semaHazir) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS bekleme (eposta TEXT PRIMARY KEY, durum TEXT NOT NULL, paket TEXT, kayit INTEGER, onay_hash TEXT, onay_son INTEGER, onay_zaman INTEGER, son_gonderim INTEGER, izin_surum TEXT, izin_zaman INTEGER, ip_ozet TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bekleme_onay ON bekleme (onay_hash)")
  ]);
  semaHazir = true;
}

export function epostaTemizle(v) {
  const s = String(v == null ? "" : v).normalize("NFC").trim().toLowerCase();
  if (!s || s.length > 254 || /[\u0000-\u001f\u007f\s,;<>()[\]\\"]/.test(s)) return "";
  if ((s.match(/@/g) || []).length !== 1 || !EPOSTA_RE.test(s)) return "";
  if (s.includes("..") || s.startsWith(".") || s.split("@")[0].endsWith(".")) return "";
  return s;
}

const gizli = env => String(env.AKE_GIZLI || "");
const onayOzeti = (env, t) => sha256("liste-onay:" + gizli(env) + ":" + t);
export async function cikisBelirteci(env, eposta) { return (await hmacHex(gizli(env), "liste-cikis:" + eposta)).hex; }
export async function cikisBaglantisi(env, origin, eposta) { return origin + "/api/liste/cik?e=" + encodeURIComponent(eposta) + "&t=" + (await cikisBelirteci(env, eposta)); }

const redHiz = h => fail(429, "cok_istek", "Çok fazla deneme yaptın. Biraz sonra tekrar dene.", bekleBaslik(h));
const ayniOrigin = (request) => { const o = request.headers.get("origin"); return !o || o === new URL(request.url).origin; };
async function govdeOku(request) {
  const ct = String(request.headers.get("content-type") || "");
  let ham = ""; try { ham = await request.text(); } catch (e) { return null; }
  if (ham.length > 4000) return null;
  if (ct.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(ham));
  try { const j = JSON.parse(ham || "{}"); return j && typeof j === "object" && !Array.isArray(j) ? j : null; } catch (e) { return null; }
}

/* ---------- e-posta metinleri (işlem e-postası: tek tek, toplu değil) ---------- */
const NOT = "Ödeme alınmaz, sipariş oluşmaz; paket ya da fiyat garantisi verilmez. Bu bir kampanya ya da reklam izni değildir.";
function onayEposta(onayUrl, cikisUrl, paket) {
  const html = epostaSablon("Açıldığında haber ver isteğini onayla",
    `<p style="margin:0 0 12px;line-height:1.55">AKE Akademi ücretli paketleri (${PAKET_AD[paket] || PAKET_AD.ikisi}) açıldığında sana <b>bir kez</b> haber vermemizi istedin. Kaydın tamamlanması için onaylaman gerekiyor.</p>
<p style="margin:16px 0"><a href="${onayUrl}" style="display:inline-block;background:#B73F36;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">İsteğimi onayla</a></p>
<p style="margin:0 0 10px;font-size:13px;color:#5C5560;line-height:1.5">${NOT} Bağlantı 48 saat geçerlidir; onaylamazsan hiçbir şey olmaz ve kaydın silinir.</p>
<p style="margin:0;font-size:13px;color:#5C5560;line-height:1.5">İstemediysen bu e-postayı yok say, ya da kaydı hemen sil: <a href="${cikisUrl}">kaydımı sil</a>.</p>`);
  const text = `AKE Akademi ücretli paketleri açıldığında sana bir kez haber vermemizi istedin. Onaylamak için: ${onayUrl}\n\n${NOT} Bağlantı 48 saat geçerlidir.\nİstemediysen yok say ya da kaydı sil: ${cikisUrl}`;
  return { subject: "AKE Akademi · Açıldığında haber ver isteğini onayla", html, text };
}
function silmeEposta(cikisUrl) {
  const html = epostaSablon("Kaydını sil", `<p style="margin:0 0 12px;line-height:1.55">“Açıldığında haber ver” listesindeki kaydını ve iznini silmek için aşağıdaki bağlantıyı aç ve düğmeye bas.</p>
<p style="margin:16px 0"><a href="${cikisUrl}" style="display:inline-block;background:#28232C;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Kaydımı sil</a></p>
<p style="margin:0;font-size:13px;color:#5C5560">Sen istemediysen bu e-postayı yok say; kaydın silinmez.</p>`);
  return { subject: "AKE Akademi · Kaydını sil", html, text: `Listedeki kaydını ve iznini silmek için: ${cikisUrl}\nSen istemediysen yok say.` };
}

/* ---------- uçlar ---------- */
export async function kaydet(env, request) {
  if (!ayniOrigin(request)) return fail(403, "origin");
  const b = await govdeOku(request); if (!b) return fail(400, "istek", "İstek okunamadı.");
  if (b.web) return json(200, { ok: true, durum: "onay_gonderildi" });                      /* bal küpü alanı: botlar sessizce "başarılı" görür */
  const eposta = epostaTemizle(b.eposta); if (!eposta) return fail(400, "eposta_gecersiz", "E-posta adresi geçerli görünmüyor.");
  if (b.izin !== true && b.izin !== "true" && b.izin !== "on") return fail(400, "izin_yok", "Haber verilmesi için onay kutusunu işaretlemelisin.");
  const paket = PAKETLER.includes(b.paket) ? b.paket : "ikisi";
  if (!gizli(env)) return fail(503, "yapilandirma");
  { const h = await ipHiz(env, request, "liste", 10, 3600e3); if (!h.izin) return redHiz(h); }
  { const h = await hizSinir(env, { kova: "liste-e", kimlik: eposta, adet: 3, ms: 3600e3 }); if (!h.izin) return redHiz(h); }
  await listeSema(env);
  const now = Date.now(), origin = new URL(request.url).origin;
  const token = rastgele(16), hash = await onayOzeti(env, token), ip = (await sha256("liste-ip:" + gizli(env) + ":" + ipOf(request))).slice(0, 16);
  let gonder = false;
  const ins = await env.DB.prepare("INSERT INTO bekleme (eposta, durum, paket, kayit, onay_hash, onay_son, onay_zaman, son_gonderim, izin_surum, izin_zaman, ip_ozet) VALUES (?, 'bekliyor', ?, ?, ?, ?, NULL, ?, ?, ?, ?) ON CONFLICT (eposta) DO NOTHING")
    .bind(eposta, paket, now, hash, now + ONAY_OMRU_MS, now, IZIN_SURUM, now, ip).run();
  if (ins && ins.meta && ins.meta.changes > 0) gonder = true;
  else {
    /* var olan satır: yalnızca BEKLEYEN ve son gönderimi 10 dk'dan eski ise yeni onay belirteci; onaylı/yakın tarihli için hiçbir şey yapılmaz */
    const g = await env.DB.prepare("UPDATE bekleme SET onay_hash = ?, onay_son = ?, son_gonderim = ?, paket = ? WHERE eposta = ? AND durum = 'bekliyor' AND son_gonderim < ?")
      .bind(hash, now + ONAY_OMRU_MS, now, paket, eposta, now - YENIDEN_MS).run();
    gonder = !!(g && g.meta && g.meta.changes > 0);
  }
  if (gonder) {
    const m = onayEposta(origin + "/api/liste/onayla?t=" + token, await cikisBaglantisi(env, origin, eposta), paket);
    const r = await epostaGonder(env, { to: eposta, subject: m.subject, html: m.html, text: m.text });
    if (!r.ok) {   /* gitmediyse bekleyen satırı geri al: kullanıcı yeniden deneyebilsin, adres boşuna saklanmasın */
      await env.DB.prepare("DELETE FROM bekleme WHERE eposta = ? AND durum = 'bekliyor'").bind(eposta).run();
      return fail(502, "eposta_gitmedi", "Onay e-postası gönderilemedi. Biraz sonra tekrar dene.");
    }
  }
  if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM bekleme WHERE durum = 'bekliyor' AND onay_son < ?").bind(now).run().catch(() => { });
  return json(200, { ok: true, durum: "onay_gonderildi" });
}

export async function onayla(env, request) {
  const b = await govdeOku(request), t = String((b && b.t) || "");
  if (!/^[0-9a-f]{32}$/.test(t)) return fail(400, "gecersiz", "Bağlantı geçersiz.");
  if (!gizli(env)) return fail(503, "yapilandirma");
  { const h = await ipHiz(env, request, "liste-onay", 30, 3600e3); if (!h.izin) return redHiz(h); }
  await listeSema(env);
  const hash = await onayOzeti(env, t), now = Date.now();
  const r = await env.DB.prepare("UPDATE bekleme SET durum = 'onayli', onay_zaman = ? WHERE onay_hash = ? AND durum = 'bekliyor' AND onay_son > ?").bind(now, hash, now).run();
  if (r && r.meta && r.meta.changes > 0) return json(200, { ok: true, durum: "onaylandi" });
  const var_ = await env.DB.prepare("SELECT durum FROM bekleme WHERE onay_hash = ?").bind(hash).first();   /* çift tıklama: zaten onaylıysa hata verme */
  if (var_ && var_.durum === "onayli") return json(200, { ok: true, durum: "zaten_onayli" });
  return fail(400, "gecersiz", "Bağlantı geçersiz ya da süresi dolmuş. Formu yeniden doldurabilirsin.");
}

export async function cik(env, request) {
  const b = await govdeOku(request) || {}, eposta = epostaTemizle(b.e || b.eposta), t = String(b.t || "");
  if (!eposta || !/^[0-9a-f]{64}$/.test(t)) return fail(400, "gecersiz", "Bağlantı geçersiz.");
  if (!gizli(env)) return fail(503, "yapilandirma");
  { const h = await ipHiz(env, request, "liste-cik", 30, 3600e3); if (!h.izin) return redHiz(h); }
  if (!esitMi(await cikisBelirteci(env, eposta), t)) return fail(400, "gecersiz", "Bağlantı geçersiz.");
  await listeSema(env);
  await env.DB.prepare("DELETE FROM bekleme WHERE eposta = ?").bind(eposta).run();
  return json(200, { ok: true, durum: "silindi" });
}

/* "Kaydımı sil" formu: adrese silme bağlantısı gönderir. Adres listede olsun olmasın yanıt aynıdır; başkası bir adresi silemez. */
export async function silIste(env, request) {
  if (!ayniOrigin(request)) return fail(403, "origin");
  const b = await govdeOku(request) || {}, eposta = epostaTemizle(b.eposta);
  if (!eposta) return fail(400, "eposta_gecersiz", "E-posta adresi geçerli görünmüyor.");
  if (!gizli(env)) return fail(503, "yapilandirma");
  { const h = await ipHiz(env, request, "liste-sil", 10, 3600e3); if (!h.izin) return redHiz(h); }
  { const h = await hizSinir(env, { kova: "liste-sil-e", kimlik: eposta, adet: 3, ms: 3600e3 }); if (!h.izin) return redHiz(h); }
  await listeSema(env);
  const satir = await env.DB.prepare("SELECT eposta FROM bekleme WHERE eposta = ?").bind(eposta).first();
  if (satir) {
    const m = silmeEposta(await cikisBaglantisi(env, new URL(request.url).origin, eposta));
    await epostaGonder(env, { to: eposta, subject: m.subject, html: m.html, text: m.text });
  }
  return json(200, { ok: true, durum: "silme_baglantisi_gonderildi" });
}

/* ---------- küçük bağlantı sayfaları (GET durum değiştirmez; düğme POST yapar) ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function sayfa(baslik, metin, form) {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(baslik)} · AKE Akademi</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#28232C;color:#F8F5F0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px}main{max-width:460px;width:100%;background:#322C37;border:1px solid #4a4150;border-radius:16px;padding:26px 22px}h1{font-size:21px;margin:0 0 10px}p{margin:0 0 14px;color:#D2CAD4}small{color:#B3AAB8}button,a.b{display:inline-block;font:inherit;font-weight:700;background:#B73F36;color:#fff;border:0;border-radius:10px;padding:12px 18px;cursor:pointer;text-decoration:none}a{color:#F27D6D}</style></head><body><main><h1>${esc(baslik)}</h1><p>${metin}</p>${form || ""}<p style="margin:16px 0 0"><small>${NOT}</small></p><p style="margin:12px 0 0"><a href="/">AKE Akademi'ye dön</a></p></main></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer", "x-frame-options": "DENY" } });
}
export const onayFormu = t => `<form method="post" action="/api/liste/onayla"><input type="hidden" name="t" value="${esc(t)}"><button>İsteğimi onayla</button></form>`;
export const cikFormu = (e, t) => `<form method="post" action="/api/liste/cik"><input type="hidden" name="e" value="${esc(e)}"><input type="hidden" name="t" value="${esc(t)}"><button>Kaydımı sil</button></form>`;
