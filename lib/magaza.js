// AKE Akademi · mağaza satın alma doğrulaması (Google Play Billing + Apple App Store)
//
// İLKE: Erişim YALNIZCA sunucunun mağazadan kendi kimlik bilgileriyle doğruladığı işlemden sonra açılır.
// Uygulamanın gönderdiği "satın aldım" bilgisi (işlem kimliği / satın alma belirteci) yalnızca bir ANAHTARDIR; sunucu bununla mağazaya
// (Google Play Developer API / App Store Server API) kendisi sorar ve yanıtın içindeki ürün, süre, durum ve hesap bağlantısını kullanır.
// Uygulamanın söylediği ürün, plan, süre ya da durum hiçbir yerde okunmaz (yalnızca "hangi ürünü sorduğunu" belirtmek için ipucu).
// Web/Shopier ödeme yolu bu dosyada YOKTUR; mevcut erişim kodları (tablo `kod`) aynen çalışır, ikisi birlikte kullanılabilir (aktifPaket en yüksek planı seçer).
//
// Kapalı varsayılan: AKE_MAGAZA tanımlı değilse hiçbir uç çalışmaz. "sandbox" = yalnız mağaza TEST işlemleri (Apple Sandbox, Google lisans test
// kullanıcısı) kabul edilir, gerçek tahsilatlı işlem REDDEDİLİR. "canli" = ikisi de kabul edilir (Production'da ancak mağaza incelemesi sonrası açılır).
//
// Tablo: magaza_islem. Anahtar (platform, ana): Google için satın alma belirteci, Apple için originalTransactionId.
// Bir işlem ilk doğrulayan hesaba BAĞLANIR ve başka hesaba geçmez (409 baska_hesap). Hesap silinince bağ kid='silindi' olarak kalır (yeniden kullanılamaz).
import { hmacHex, bugunIso } from "./ortak.js";

export const URUNLER = {
  atilim_aylik: { plan: "orta", donem: "ay", ad: "Atılım · aylık" },
  atilim_yillik: { plan: "orta", donem: "yil", ad: "Atılım · yıllık" },
  premium_aylik: { plan: "premium", donem: "ay", ad: "Premium · aylık" },
  premium_yillik: { plan: "premium", donem: "yil", ad: "Premium · yıllık" }
};
export const PLATFORMLAR = ["google", "apple"];
/* Erişim açan durumlar. ek_sure: ödeme alınamadı ama mağaza ek süre tanıdı (Play grace / Apple billing grace). iptal: yenilenmeyecek, süre bitene dek geçerli. */
const ERISIM_DURUMLARI = ["aktif", "ek_sure", "iptal"];
export const YENILEME_ESIGI_MS = 6 * 3600 * 1000;

export function magazaModu(env) {
  const m = String(env.AKE_MAGAZA || "").trim().toLowerCase();
  return m === "canli" ? "canli" : m === "sandbox" ? "sandbox" : "kapali";
}
const getFetch = env => env.MAGAZA_FETCH || ((...a) => fetch(...a)); // MAGAZA_FETCH yalnızca testlerde verilir

export async function tablo(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS magaza_islem (platform TEXT NOT NULL, ana TEXT NOT NULL, kid TEXT NOT NULL, urun TEXT NOT NULL, plan TEXT NOT NULL, durum TEXT NOT NULL, bitis INTEGER NOT NULL DEFAULT 0, test INTEGER NOT NULL DEFAULT 0, son_islem TEXT, oto_yenile INTEGER NOT NULL DEFAULT 0, olusturma INTEGER NOT NULL, guncelleme INTEGER NOT NULL, PRIMARY KEY (platform, ana))").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS magaza_islem_kid ON magaza_islem (kid)").run();
}

/* ---------- hesap kimliği (mağaza işlemine konan, kişisel veri içermeyen takma ad) ---------- */
function uuidOf(hex) {
  const b = hex.slice(0, 32).split("");
  b[12] = "4"; b[16] = "89ab"[parseInt(b[16], 16) & 3];
  const s = b.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
export async function hesapKimligi(env, kid) {
  const sir = String(env.AKE_GIZLI || "").trim();
  if (!sir) return null;
  const { hex } = await hmacHex(sir, "magaza-hesap:" + kid);
  return { google: hex.slice(0, 40), apple: uuidOf(hex) };
}

/* ---------- JWT yardımcıları ---------- */
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uMetin = s => b64u(new TextEncoder().encode(s));
function pemBytes(pem) {
  const t = String(pem || "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(t), c => c.charCodeAt(0));
}
export function jwsGovde(jws) {
  const p = String(jws || "").split(".");
  if (p.length !== 3) return null;
  try { let s = p[1].replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)))); } catch (e) { return null; }
}

/* ---------- Google Play ---------- */
let gBelirteci = { jeton: "", bitis: 0, hesap: "" };
async function googleErisimBelirteci(env) {
  let hs; try { hs = JSON.parse(String(env.GOOGLE_PLAY_HIZMET_HESABI || "")); } catch (e) { hs = null; }
  if (!hs || !hs.client_email || !hs.private_key) return { hata: "yapilandirma" };
  if (gBelirteci.jeton && gBelirteci.hesap === hs.client_email && gBelirteci.bitis > Date.now() + 60000) return { jeton: gBelirteci.jeton };
  const iat = Math.floor(Date.now() / 1000);
  const basi = b64uMetin(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64uMetin(JSON.stringify({ iss: hs.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3000 }));
  let imza;
  try {
    const key = await crypto.subtle.importKey("pkcs8", pemBytes(hs.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    imza = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(basi)));
  } catch (e) { return { hata: "yapilandirma" }; }
  const r = await getFetch(env)("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: basi + "." + imza }) }).catch(() => null);
  if (!r || !r.ok) return { hata: "magaza_ulasilamadi" };
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) return { hata: "magaza_ulasilamadi" };
  gBelirteci = { jeton: j.access_token, bitis: Date.now() + (Number(j.expires_in) || 3000) * 1000, hesap: hs.client_email };
  return { jeton: j.access_token };
}
const googlePaket = env => String(env.GOOGLE_PLAY_PAKET || "com.akeakademi.ake_akademi").trim();
const GOOGLE_DURUM = { SUBSCRIPTION_STATE_ACTIVE: "aktif", SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "ek_sure", SUBSCRIPTION_STATE_CANCELED: "iptal", SUBSCRIPTION_STATE_ON_HOLD: "askida", SUBSCRIPTION_STATE_PAUSED: "askida", SUBSCRIPTION_STATE_EXPIRED: "bitti", SUBSCRIPTION_STATE_PENDING: "bekliyor", SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "bitti" };

/* Satın alma belirtecini Google'a sorar. Dönüş: { norm } ya da { hata, durum } */
export async function googleDogrula(env, belirtec) {
  if (!/^[A-Za-z0-9._\-]{20,2000}$/.test(String(belirtec || ""))) return { hata: "belirtec", durum: 400 };
  const t = await googleErisimBelirteci(env); if (t.hata) return { hata: t.hata, durum: t.hata === "yapilandirma" ? 503 : 502 };
  const r = await getFetch(env)(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(googlePaket(env))}/purchases/subscriptionsv2/tokens/${encodeURIComponent(belirtec)}`, { headers: { authorization: "Bearer " + t.jeton } }).catch(() => null);
  if (!r) return { hata: "magaza_ulasilamadi", durum: 502 };
  if (r.status === 400 || r.status === 404 || r.status === 410) return { hata: "islem_bulunamadi", durum: 404 };
  if (!r.ok) return { hata: "magaza_ulasilamadi", durum: 502 };
  const j = await r.json().catch(() => null); if (!j) return { hata: "magaza_ulasilamadi", durum: 502 };
  const kalem = (j.lineItems || [])[0]; if (!kalem || !kalem.productId) return { hata: "urun", durum: 422 };
  const durum = GOOGLE_DURUM[j.subscriptionState] || "bitti";
  const bitis = Date.parse(kalem.expiryTime || "") || 0;
  const hesap = j.externalAccountIdentifiers && j.externalAccountIdentifiers.obfuscatedExternalAccountId || "";
  return { norm: { platform: "google", ana: String(belirtec), urun: String(kalem.productId), durum, bitis, test: !!j.testPurchase, sonIslem: String(j.latestOrderId || ""), otoYenile: !!(kalem.autoRenewingPlan && kalem.autoRenewingPlan.autoRenewEnabled), hesap, onayBekliyor: j.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" } };
}
/* Onay (acknowledge): doğrulanıp erişim AÇILDIKTAN sonra yapılır; yapılmazsa Google 3 gün içinde işlemi iade eder. Başarısızlık erişimi geri almaz (yeniden denenir). */
export async function googleOnayla(env, norm) {
  const t = await googleErisimBelirteci(env); if (t.hata) return false;
  const r = await getFetch(env)(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(googlePaket(env))}/purchases/subscriptions/${encodeURIComponent(norm.urun)}/tokens/${encodeURIComponent(norm.ana)}:acknowledge`, { method: "POST", headers: { authorization: "Bearer " + t.jeton, "content-type": "application/json" }, body: "{}" }).catch(() => null);
  return !!(r && (r.ok || r.status === 409)); // 409: zaten onaylı
}

/* ---------- Apple ---------- */
async function appleJwt(env) {
  const iss = String(env.APPLE_IAP_ISSUER_ID || "").trim(), kid = String(env.APPLE_IAP_KEY_ID || "").trim(), pem = String(env.APPLE_IAP_PRIVATE_KEY || "");
  if (!iss || !kid || !pem) return null;
  const iat = Math.floor(Date.now() / 1000);
  const basi = b64uMetin(JSON.stringify({ alg: "ES256", kid, typ: "JWT" })) + "." + b64uMetin(JSON.stringify({ iss, iat, exp: iat + 1200, aud: "appstoreconnect-v1", bid: appleBundle(env) }));
  try {
    const key = await crypto.subtle.importKey("pkcs8", pemBytes(pem), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    return basi + "." + b64u(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(basi)));
  } catch (e) { return null; }
}
const appleBundle = env => String(env.APPLE_BUNDLE_ID || "com.akeakademi.akeAkademi").trim();
const APPLE_DURUM = { 1: "aktif", 2: "bitti", 3: "askida", 4: "ek_sure", 5: "iade" };
const APPLE_ADRES = { Production: "https://api.storekit.itunes.apple.com", Sandbox: "https://api.storekit-sandbox.itunes.apple.com" };

/* İşlem kimliğini Apple'a sorar. "sandbox" modunda ÜRETİM sunucusuna hiç gidilmez. Dönüş: { norm } ya da { hata, durum } */
export async function appleDogrula(env, islemKimligi) {
  if (!/^[0-9]{6,20}$/.test(String(islemKimligi || ""))) return { hata: "belirtec", durum: 400 };
  const jwt = await appleJwt(env); if (!jwt) return { hata: "yapilandirma", durum: 503 };
  const sirali = magazaModu(env) === "sandbox" ? ["Sandbox"] : ["Production", "Sandbox"];
  let j = null;
  for (const ortam of sirali) {
    const r = await getFetch(env)(`${APPLE_ADRES[ortam]}/inApps/v1/subscriptions/${encodeURIComponent(islemKimligi)}`, { headers: { authorization: "Bearer " + jwt } }).catch(() => null);
    if (!r) return { hata: "magaza_ulasilamadi", durum: 502 };
    if (r.status === 404 || r.status === 400) continue; // bu ortamda yok: Apple'ın önerdiği sırayla diğerini dene
    if (!r.ok) return { hata: "magaza_ulasilamadi", durum: 502 };
    j = await r.json().catch(() => null); if (j) break;
  }
  if (!j) return { hata: "islem_bulunamadi", durum: 404 };
  if (j.bundleId && j.bundleId !== appleBundle(env)) return { hata: "uygulama", durum: 422 };
  // İstenen işlemin ait olduğu abonelik zinciri (originalTransactionId) ve en son işlemi
  let son = null;
  for (const g of j.data || []) for (const lt of g.lastTransactions || []) { const tx = jwsGovde(lt.signedTransactionInfo); if (tx) { const adayi = { lt, tx }; if (!son || (Number(tx.expiresDate) || 0) > (Number(son.tx.expiresDate) || 0)) son = adayi; } }
  if (!son) return { hata: "urun", durum: 422 };
  const { lt, tx } = son;
  if (tx.bundleId && tx.bundleId !== appleBundle(env)) return { hata: "uygulama", durum: 422 };
  const iade = !!tx.revocationDate || Number(lt.status) === 5;
  return { norm: { platform: "apple", ana: String(tx.originalTransactionId || ""), urun: String(tx.productId || ""), durum: iade ? "iade" : (APPLE_DURUM[Number(lt.status)] || "bitti"), bitis: iade ? Math.min(Number(tx.revocationDate) || Date.now(), Date.now()) : Number(tx.expiresDate) || 0, test: tx.environment === "Sandbox" || j.environment === "Sandbox", sonIslem: String(tx.transactionId || ""), otoYenile: (jwsGovde(lt.signedRenewalInfo) || {}).autoRenewStatus === 1, hesap: String(tx.appAccountToken || "").toLowerCase() } };
}

export const dogrula = (env, platform, kimlik) => platform === "google" ? googleDogrula(env, kimlik) : platform === "apple" ? appleDogrula(env, kimlik) : Promise.resolve({ hata: "platform", durum: 400 });

/* ---------- uygulama (erişimi açan tek yer) ---------- */
export const erisimVar = (satir, simdi) => ERISIM_DURUMLARI.includes(satir.durum) && Number(satir.bitis) > (simdi || Date.now());

/* Doğrulanmış (mağazadan gelmiş) işlemi hesaba uygular. Aynı işlem tekrar gelirse aynı sonucu verir (idempotent).
   kid, istek sahibi hesaptır; satır başka hesaba bağlıysa 409. `ipucu` ("iade") yalnızca mağaza erişim vermiyorsa durumu iade olarak işaretler. */
export async function uygula(env, kid, norm, { ipucu = "", hesapDogrula = true } = {}) {
  const mod = magazaModu(env); if (mod === "kapali") return { hata: "kapali", durum: 503 };
  const u = URUNLER[norm.urun]; if (!u) return { hata: "urun", durum: 422 };
  if (mod === "sandbox" && !norm.test) return { hata: "canli_islem_kapali", durum: 403 };
  if (hesapDogrula) {
    const beklenen = await hesapKimligi(env, kid); if (!beklenen) return { hata: "yapilandirma", durum: 503 };
    const gelen = norm.platform === "google" ? norm.hesap : norm.hesap;
    const hedef = norm.platform === "google" ? beklenen.google : beklenen.apple;
    if (!gelen || gelen !== hedef) return { hata: "hesap_eslesmedi", durum: 409 };
  }
  await tablo(env);
  const simdi = Date.now();
  let durum = norm.durum;
  if (ipucu === "iade" && !ERISIM_DURUMLARI.includes(durum)) durum = "iade";
  const r = await env.DB.prepare(
    "INSERT INTO magaza_islem (platform, ana, kid, urun, plan, durum, bitis, test, son_islem, oto_yenile, olusturma, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT (platform, ana) DO UPDATE SET urun = excluded.urun, plan = excluded.plan, durum = excluded.durum, bitis = excluded.bitis, test = excluded.test, son_islem = excluded.son_islem, oto_yenile = excluded.oto_yenile, guncelleme = excluded.guncelleme WHERE magaza_islem.kid = excluded.kid"
  ).bind(norm.platform, norm.ana, kid, norm.urun, u.plan, durum, norm.bitis || 0, norm.test ? 1 : 0, norm.sonIslem || null, norm.otoYenile ? 1 : 0, simdi, simdi).run();
  if (!r.meta || !r.meta.changes) return { hata: "baska_hesap", durum: 409 }; // ON CONFLICT ... WHERE kid eşleşmedi: işlem başka hesaba bağlı
  return { satir: { platform: norm.platform, urun: norm.urun, plan: u.plan, durum, bitis: norm.bitis || 0, test: !!norm.test, otoYenile: !!norm.otoYenile } };
}

/* ---------- okuma ---------- */
export async function hesapIslemleri(env, kid) {
  await tablo(env);
  const { results } = await env.DB.prepare("SELECT platform, ana, urun, plan, durum, bitis, test, oto_yenile, guncelleme FROM magaza_islem WHERE kid = ? ORDER BY bitis DESC").bind(kid).all();
  return results || [];
}
export const islemJson = s => ({ platform: s.platform, urun: s.urun, plan: s.plan, durum: s.durum, bitis: s.bitis ? new Date(Number(s.bitis)).toISOString().slice(0, 10) : "", erisim: erisimVar(s), test: !!s.test, otoYenile: !!s.oto_yenile });

/* Hesabın süresi yaklaşan/eskimiş işlemlerini mağazadan tazeler (yenileme, iade, iptal). Hata erişimi kapatmaz: süre dolmuşsa zaten erişim yoktur. */
export async function yenile(env, kid, { zorla = false } = {}) {
  if (magazaModu(env) === "kapali") return { yenilenen: 0 };
  const satirlar = await hesapIslemleri(env, kid), simdi = Date.now();
  let n = 0;
  for (const s of satirlar) {
    const eski = simdi - Number(s.guncelleme) > YENILEME_ESIGI_MS;
    const sonaErmis = Number(s.bitis) <= simdi && ERISIM_DURUMLARI.includes(s.durum); // süresi dolmuş görünen ama yenilenmiş olabilir
    if (!zorla && !eski && !sonaErmis) continue;
    if (!["aktif", "ek_sure", "iptal", "askida", "bekliyor"].includes(s.durum) && !zorla) continue;
    const d = await dogrula(env, s.platform, s.platform === "google" ? s.ana : s.son_islem || s.ana);
    if (d.norm && d.norm.ana === s.ana) { const u = await uygula(env, kid, d.norm, { hesapDogrula: false }); if (u.satir) n++; }
  }
  return { yenilenen: n };
}

/* ---------- mağaza bildirimleri (Google RTDN / Apple ASSN v2): yalnızca TETİKLEYİCİ ---------- */
export function googleBildirimi(govde) {
  try {
    const m = govde && govde.message && govde.message.data ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(govde.message.data), c => c.charCodeAt(0)))) : null;
    const s = m && m.subscriptionNotification; if (!s || !s.purchaseToken) return null;
    return { platform: "google", kimlik: String(s.purchaseToken), ipucu: Number(s.notificationType) === 12 ? "iade" : "" };
  } catch (e) { return null; }
}
export function appleBildirimi(govde) {
  const p = jwsGovde(govde && govde.signedPayload); if (!p || !p.data) return null;
  const tx = jwsGovde(p.data.signedTransactionInfo); if (!tx || !tx.originalTransactionId) return null;
  return { platform: "apple", kimlik: String(tx.transactionId || tx.originalTransactionId), ana: String(tx.originalTransactionId), ipucu: ["REFUND", "REVOKE"].includes(p.notificationType) ? "iade" : "" };
}
/* Bildirim sahte olsa bile zarar vermez: içeriğine güvenilmez, yalnızca KAYITLI bir işlem için mağazaya yeniden sorulur ve satır o hesap için güncellenir. */
export async function bildirimIsle(env, bil) {
  if (!bil || magazaModu(env) === "kapali") return { islendi: false };
  await tablo(env);
  const ana = bil.platform === "google" ? bil.kimlik : bil.ana;
  const satir = await env.DB.prepare("SELECT kid FROM magaza_islem WHERE platform = ? AND ana = ?").bind(bil.platform, ana).first();
  if (!satir || !satir.kid || satir.kid === "silindi") return { islendi: false };
  const d = await dogrula(env, bil.platform, bil.kimlik); if (!d.norm || d.norm.ana !== ana) return { islendi: false };
  const u = await uygula(env, satir.kid, d.norm, { ipucu: bil.ipucu, hesapDogrula: false });
  return { islendi: !!u.satir };
}

export { bugunIso };
