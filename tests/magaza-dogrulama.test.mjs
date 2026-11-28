// Mağaza satın alma doğrulaması · GERÇEK sunucu koduyla (node:sqlite), mağaza yanıtları SAHTE (MAGAZA_FETCH).
// UYARI: Buradaki "mağaza" test içinde üretilmiş sahte bir sunucudur. Bu testler sunucu mantığını kanıtlar; GERÇEK Google Play / App Store
// sandbox işlemi DEĞİLDİR ve "sandbox satın alma doğrulandı" diye raporlanmamalıdır (docs/magaza-test-listesi.md).
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { kur } from "./yardim/soru-v2.mjs";

const sub = webcrypto.subtle;
const pem = (ad, buf) => `-----BEGIN ${ad}-----\n${Buffer.from(buf).toString("base64").match(/.{1,64}/g).join("\n")}\n-----END ${ad}-----`;
const rsa = await sub.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const ec = await sub.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const GOOGLE_HS = JSON.stringify({ client_email: "test@proje.iam.gserviceaccount.com", private_key: pem("PRIVATE KEY", await sub.exportKey("pkcs8", rsa.privateKey)) });
const APPLE_PEM = pem("PRIVATE KEY", await sub.exportKey("pkcs8", ec.privateKey));
const b64u = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const jws = o => `${b64u({ alg: "ES256" })}.${b64u(o)}.imza`;

const GUN = 86400000;
/* sahte mağaza durumu: testler bunu değiştirir */
const M = { google: {}, apple: {}, cagrilar: [], onay: 0, tokenIstegi: 0 };
function sifirla() { M.google = {}; M.apple = {}; M.cagrilar = []; M.onay = 0; }
async function magazaFetch(url, init = {}) {
  url = String(url); M.cagrilar.push(url);
  const json = (s, o) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://oauth2.googleapis.com/token")) { M.tokenIstegi++; return json(200, { access_token: "gjeton", expires_in: 3600 }); }
  if (url.includes(":acknowledge")) { M.onay++; return json(200, {}); }
  let m = /subscriptionsv2\/tokens\/([^/?]+)/.exec(url);
  if (m) { const t = decodeURIComponent(m[1]); return M.google[t] ? json(200, M.google[t]) : json(404, { error: "yok" }); }
  m = /(api\.storekit(-sandbox)?\.itunes\.apple\.com)\/inApps\/v1\/subscriptions\/(\d+)/.exec(url);
  if (m) { const ortam = m[2] ? "Sandbox" : "Production", id = m[3]; const k = Object.values(M.apple).find(x => x.ortam === ortam && x.ids.includes(id)); return k && k.ortam === ortam ? json(200, k.yanit) : json(404, { errorCode: 4040010 }); }
  return json(500, {});
}
const gGovde = (urun, { durum = "SUBSCRIPTION_STATE_ACTIVE", bitis = Date.now() + 30 * GUN, hesap, test = true, onay = false } = {}) => ({ subscriptionState: durum, testPurchase: test ? {} : undefined, latestOrderId: "GPA.1234", acknowledgementState: onay ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING", externalAccountIdentifiers: hesap ? { obfuscatedExternalAccountId: hesap } : {}, lineItems: [{ productId: urun, expiryTime: new Date(bitis).toISOString(), autoRenewingPlan: { autoRenewEnabled: true } }] });
const BUNDLE = "com.akeakademi.akeAkademi";
function aGovde(urun, { ortam = "Sandbox", durum = 1, bitis = Date.now() + 30 * GUN, hesap, orig = "1000000123456789", islem = "2000000111", iade = false } = {}) {
  const tx = { originalTransactionId: orig, transactionId: islem, productId: urun, bundleId: BUNDLE, expiresDate: bitis, environment: ortam, appAccountToken: hesap, ...(iade ? { revocationDate: Date.now() - 1000 } : {}) };
  return { ortam, ids: [orig, islem], yanit: { bundleId: BUNDLE, environment: ortam, data: [{ lastTransactions: [{ status: durum, originalTransactionId: orig, signedTransactionInfo: jws(tx), signedRenewalInfo: jws({ autoRenewStatus: 1 }) }] }] } };
}

/* tek D1 + tek sunucu modülü (lib/ortak.js şema bayrağı süreç başınadır); her testte ortam değişkenleri ve mağaza tablosu sıfırlanır */
const T = await kur();
await T.hazirla();
const hesap = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
const VARSAYILAN = { AKE_MAGAZA: "sandbox", AKE_MAGAZA_PREMIUM: "acik", GOOGLE_PLAY_HIZMET_HESABI: GOOGLE_HS, APPLE_IAP_ISSUER_ID: "issuer-1", APPLE_IAP_KEY_ID: "KEY123", APPLE_IAP_PRIVATE_KEY: APPLE_PEM, MAGAZA_FETCH: magazaFetch, MAGAZA_BILDIRIM_SIRRI: "bildirim-sirri" };
let ipSayac = 0, eposta = 0;
async function ortam(ekEnv = {}) {
  sifirla();
  for (const k of Object.keys(VARSAYILAN)) delete T.env[k];
  Object.assign(T.env, VARSAYILAN, ekEnv);
  T.DB.db.exec("DROP TABLE IF EXISTS magaza_islem");
  const cagir = async (c, m, yol, govde) => { const r = await hesap.onRequest({ request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: m, headers: { "content-type": "application/json", "cf-connecting-ip": "10.9." + ((++ipSayac >> 8) & 255) + "." + (ipSayac & 255), cookie: c.cookie }, body: govde ? JSON.stringify(govde) : undefined }), env: T.env, params: { yol: yol.split("/") } }); return { s: r.status, j: await r.json() }; };
  const kullanici = async e => { const g = await T.giris(e.replace("@", "-" + (++eposta) + "@")); return { cookie: g.cookie, kid: g.kid }; };
  const kimlik = async c => (await cagir(c, "GET", "magaza")).j.hesapKimligi;
  const ben = async c => (await cagir(c, "GET", "ben")).j.paket;
  return { T, cagir, kullanici, kimlik, ben, DB: T.DB, env: T.env };
}
const satir = (DB, platform, ana) => DB.db.prepare("SELECT * FROM magaza_islem WHERE platform = ? AND ana = ?").get(platform, ana);
const TOKEN = "gp-token-" + "a".repeat(40);

test("1) kapalıyken (AKE_MAGAZA yok) hiçbir uç çalışmaz, erişim açılmaz", async () => {
  const o = await ortam({ AKE_MAGAZA: "" });
  const c = await o.kullanici("m1@ornek.com");
  assert.equal((await o.cagir(c, "GET", "magaza")).s, 503);
  assert.equal((await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN })).s, 503);
  assert.equal(await o.ben(c), null);
  assert.equal(M.cagrilar.length, 0, "mağazaya hiç gidilmedi");
});

test("2) Google: erişim yalnız sunucu mağazadan doğruladıktan sonra açılır; onay (acknowledge) erişimden SONRA yapılır", async () => {
  const o = await ortam(); const c = await o.kullanici("m2@ornek.com"); const k = await o.kimlik(c);
  assert.ok(k.google && k.apple);
  // uygulama "satın aldım" diyor ama mağazada böyle bir işlem yok → reddedilir, erişim yok
  let r = await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.equal(r.s, 404); assert.equal(await o.ben(c), null); assert.equal(M.onay, 0);
  // uygulama ürün/plan/süre uydurmaya çalışır: gövdedeki fazladan alanlar hiç okunmaz
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google });
  r = await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN, urun: "premium_yillik", plan: "premium", bitis: "2999-01-01", durum: "aktif" });
  assert.equal(r.s, 200); assert.equal(r.j.paket.plan, "orta", "plan mağaza yanıtından geldi, uygulamanın dediğinden değil");
  assert.equal(r.j.sonuc[0].islem.urun, "atilim_aylik"); assert.equal(r.j.sonuc[0].onay, true); assert.equal(M.onay, 1);
  const s = satir(o.DB, "google", TOKEN); assert.equal(s.plan, "orta"); assert.equal(s.test, 1);
});

test("3) aynı işlem tekrar gelirse (idempotent): tek satır, erişim iki katına çıkmaz", async () => {
  const o = await ortam(); const c = await o.kullanici("m3@ornek.com"); const k = await o.kimlik(c);
  const bitis = Date.now() + 30 * GUN; M.google[TOKEN] = gGovde("premium_aylik", { hesap: k.google, bitis });
  for (let i = 0; i < 3; i++) assert.equal((await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN })).s, 200);
  const [{ n }] = [o.DB.db.prepare("SELECT COUNT(*) n FROM magaza_islem").get()]; assert.equal(n, 1);
  const p = await o.ben(c); assert.equal(p.plan, "premium"); assert.equal(p.bitis, new Date(bitis).toISOString().slice(0, 10));
  // geri yükleme de aynı kaydı bulur, yeni satır açmaz
  assert.equal((await o.cagir(c, "POST", "magaza/geri-yukle", { islemler: [{ platform: "google", kimlik: TOKEN }] })).s, 200);
  assert.equal(o.DB.db.prepare("SELECT COUNT(*) n FROM magaza_islem").get().n, 1);
});

test("4) hesap değiştirme: işlem başka hesaba ait; başka hesapla gönderilirse reddedilir, erişim açılmaz", async () => {
  const o = await ortam(); const A = await o.kullanici("m4a@ornek.com"), B = await o.kullanici("m4b@ornek.com");
  const kA = await o.kimlik(A);
  M.google[TOKEN] = gGovde("atilim_yillik", { hesap: kA.google });
  // B, A'nın işlem belirtecini kendi hesabına bağlamaya çalışır: mağaza yanıtındaki hesap kimliği A'nınkidir
  const r = await o.cagir(B, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.equal(r.s, 409); assert.equal(r.j.sonuc[0].hata, "hesap_eslesmedi"); assert.equal(await o.ben(B), null);
  assert.equal(satir(o.DB, "google", TOKEN), undefined, "hiçbir satır yazılmadı");
  assert.equal((await o.cagir(A, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN })).s, 200);
  assert.equal((await o.ben(A)).plan, "orta");
  // satır A'ya bağlıyken bağ kontrolü kapalı olsa bile B'ye geçemez (ikinci kilit)
  const { uygula } = await import("../lib/magaza.js");
  const d = { platform: "google", ana: TOKEN, urun: "atilim_yillik", durum: "aktif", bitis: Date.now() + GUN, test: true, hesap: "x" };
  assert.equal((await uygula(o.env, B.kid, d, { hesapDogrula: false })).hata, "baska_hesap");
  assert.equal(await o.ben(B), null); assert.equal(satir(o.DB, "google", TOKEN).kid, A.kid);
});

test("5) yenileme: süre uzar; süre bitimi: erişim kapanır; iade: erişim kapanır", async () => {
  const o = await ortam(); const c = await o.kullanici("m5@ornek.com"); const k = await o.kimlik(c);
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google, bitis: Date.now() + 2 * GUN });
  await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  // yenileme: mağaza yeni süre bildirir; eskimiş kayıt `ben` ile tazelenir
  const yeni = Date.now() + 32 * GUN; M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google, bitis: yeni, onay: true });
  o.DB.db.prepare("UPDATE magaza_islem SET guncelleme = 0").run();
  assert.equal((await o.ben(c)).bitis, new Date(yeni).toISOString().slice(0, 10), "yenilenen süre görünür");
  // süre bitimi: kayıtta bitiş geçmiş → mağazaya sorulmadan bile erişim yok
  o.DB.db.prepare("UPDATE magaza_islem SET bitis = ?, guncelleme = ?").run(Date.now() - 1000, Date.now());
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google, durum: "SUBSCRIPTION_STATE_EXPIRED", bitis: Date.now() - 1000, onay: true });
  assert.equal(await o.ben(c), null, "süresi bitmiş abonelik erişim vermez");
  // bitmiş işlem kendiliğinden tazelenmez (gereksiz mağaza çağrısı yok); yeniden abone olunca uygulama geri yükler/doğrular → erişim döner; sonra iade → kapanır
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google, bitis: Date.now() + 30 * GUN, onay: true });
  assert.equal(await o.ben(c), null);
  assert.equal((await o.cagir(c, "POST", "magaza/geri-yukle", { islemler: [{ platform: "google", kimlik: TOKEN }] })).j.paket.plan, "orta");
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google, durum: "SUBSCRIPTION_STATE_EXPIRED", bitis: Date.now() - 5000, onay: true });
  o.DB.db.prepare("UPDATE magaza_islem SET guncelleme = 0").run();
  assert.equal(await o.ben(c), null, "iade/iptal edilip süresi kesilen abonelik erişimi kapatır");
});

test("6) iptal (yenilenmeyecek) süre bitene dek erişim verir; ödeme beklemede/askıda erişim vermez", async () => {
  const o = await ortam(); const c = await o.kullanici("m6@ornek.com"); const k = await o.kimlik(c);
  M.google[TOKEN] = gGovde("premium_yillik", { hesap: k.google, durum: "SUBSCRIPTION_STATE_CANCELED" });
  assert.equal((await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN })).j.paket.plan, "premium");
  for (const d of ["SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_PAUSED"]) {
    M.google[TOKEN] = gGovde("premium_yillik", { hesap: k.google, durum: d });
    o.DB.db.prepare("UPDATE magaza_islem SET guncelleme = 0").run();
    assert.equal(await o.ben(c), null, d);
  }
});

test("7) erişim kodu + mağaza birlikte: en yüksek plan kazanır; mağaza bitince kod geçerli kalır", async () => {
  const o = await ortam(); const c = await o.kullanici("m7@ornek.com"); const k = await o.kimlik(c);
  o.DB.db.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih) VALUES (?, ?, 'orta', '2999-01-01', 0)").run("KOD7", c.kid);
  assert.equal((await o.ben(c)).plan, "orta");
  M.google[TOKEN] = gGovde("premium_aylik", { hesap: k.google });
  await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.equal((await o.ben(c)).plan, "premium");
  M.google[TOKEN] = gGovde("premium_aylik", { hesap: k.google, durum: "SUBSCRIPTION_STATE_EXPIRED", bitis: Date.now() - 1000, onay: true });
  o.DB.db.prepare("UPDATE magaza_islem SET guncelleme = 0").run();
  const p = await o.ben(c); assert.equal(p.plan, "orta"); assert.notEqual(p.kod, "Mağaza aboneliği");
});

test("8) Apple: sandbox modu Production'a hiç gitmez; işlem doğrulanır; Production işlemi ve yanlış bundle reddedilir", async () => {
  const o = await ortam(); const c = await o.kullanici("m8@ornek.com"); const k = await o.kimlik(c);
  M.apple["1000000123456789"] = aGovde("premium_yillik", { hesap: k.apple });
  const r = await o.cagir(c, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000111" });
  assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.paket.plan, "premium"); assert.equal(r.j.sonuc[0].islem.test, true);
  assert.ok(M.cagrilar.every(u => !u.includes("api.storekit.itunes.apple.com")), "sandbox modunda üretim sunucusuna sorulmadı");
  assert.equal(satir(o.DB, "apple", "1000000123456789").plan, "premium");
  // gerçek tahsilatlı (Production) işlem: sandbox modunda Production'a hiç sorulmadığı için bulunamaz → reddedilir
  const c2 = await o.kullanici("m8b@ornek.com"), k2 = await o.kimlik(c2);
  M.apple["1000000999"] = aGovde("atilim_aylik", { ortam: "Production", hesap: k2.apple, orig: "1000000999", islem: "2000000999" });
  assert.equal((await o.cagir(c2, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000999" })).s, 404);
  assert.equal(await o.ben(c2), null);
  // yanlış uygulama (bundle) kimliği
  const c3 = await o.kullanici("m8c@ornek.com"), k3 = await o.kimlik(c3), g = aGovde("atilim_aylik", { hesap: k3.apple, orig: "1000000777", islem: "2000000777" });
  g.yanit.bundleId = "com.baska.uygulama"; M.apple["1000000777"] = g;
  assert.notEqual((await o.cagir(c3, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000777" })).s, 200); assert.equal(await o.ben(c3), null);
});

test("8b) Apple işleminde appAccountToken YOKSA reddedilir (ilk gelen sahiplenemez); yanlış belirteç de reddedilir; doğru belirteç kabul", async () => {
  const o = await ortam(); const A = await o.kullanici("m8d@ornek.com"), B = await o.kullanici("m8e@ornek.com"), C = await o.kullanici("m8f@ornek.com");
  M.apple["1000000123456789"] = aGovde("atilim_aylik", { hesap: undefined });
  for (const h of [A, B]) {
    const r = await o.cagir(h, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000111" });
    assert.equal(r.s, 409); assert.equal(r.j.sonuc[0].hata, "hesap_eslesmedi"); assert.equal(await o.ben(h), null);
  }
  assert.equal(satir(o.DB, "apple", "1000000123456789"), undefined, "belirteçsiz işlem hiçbir hesaba bağlanmadı");
  M.apple["1000000555"] = aGovde("premium_aylik", { hesap: (await o.kimlik(A)).apple, orig: "1000000555", islem: "2000000555" });
  assert.equal((await o.cagir(C, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000555" })).s, 409, "belirteç başka hesabın");
  assert.equal(await o.ben(C), null);
  assert.equal((await o.cagir(A, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000555" })).s, 200);
  assert.equal((await o.ben(A)).plan, "premium");
});

test("9) Apple iade (revocationDate) erişimi kapatır; Google'da gerçek (test olmayan) işlem sandbox modunda reddedilir", async () => {
  const o = await ortam(); const c = await o.kullanici("m9@ornek.com"); const k = await o.kimlik(c);
  M.apple["1000000123456789"] = aGovde("atilim_aylik", { hesap: k.apple });
  await o.cagir(c, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000111" });
  assert.equal((await o.ben(c)).plan, "orta");
  M.apple["1000000123456789"] = aGovde("atilim_aylik", { hesap: k.apple, iade: true });
  o.DB.db.prepare("UPDATE magaza_islem SET guncelleme = 0").run();
  assert.equal(await o.ben(c), null); assert.equal(satir(o.DB, "apple", "1000000123456789").durum, "iade");
  const c2 = await o.kullanici("m9b@ornek.com"), k2 = await o.kimlik(c2);
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k2.google, test: false });
  const r = await o.cagir(c2, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.equal(r.s, 403); assert.equal(r.j.sonuc[0].hata, "canli_islem_kapali"); assert.equal(await o.ben(c2), null);
});

test("10) bilinmeyen ürün, bozuk kimlik ve yapılandırma eksikliği güvenli reddedilir", async () => {
  const o = await ortam(); const c = await o.kullanici("m10@ornek.com"); const k = await o.kimlik(c);
  M.google[TOKEN] = gGovde("baska_urun", { hesap: k.google });
  assert.equal((await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN })).s, 409);
  assert.equal(await o.ben(c), null);
  assert.equal((await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: "kisa" })).s, 400);
  assert.equal((await o.cagir(c, "POST", "magaza/dogrula", { platform: "web", kimlik: TOKEN })).s, 400);
  assert.equal((await o.cagir(c, "POST", "magaza/dogrula", { platform: "apple", kimlik: "abc" })).s, 400);
  const eksik = await ortam({ GOOGLE_PLAY_HIZMET_HESABI: "", APPLE_IAP_PRIVATE_KEY: "" });
  const ce = await eksik.kullanici("m10b@ornek.com");
  assert.equal((await eksik.cagir(ce, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN })).s, 503);
  assert.equal((await eksik.cagir(ce, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000111" })).s, 503);
  assert.equal(await eksik.ben(ce), null);
});

test("11) hesap silinince işlem 'silindi' olur: kimse yeniden bağlayamaz, erişim yok", async () => {
  const o = await ortam(); const c = await o.kullanici("m11@ornek.com"); const k = await o.kimlik(c);
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google });
  await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.equal((await o.cagir(c, "POST", "sil")).s, 200);
  assert.equal(satir(o.DB, "google", TOKEN).kid, "silindi");
  const B = await o.kullanici("m11b@ornek.com");
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: (await o.kimlik(B)).google });
  assert.equal((await o.cagir(B, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN })).s, 409);
  assert.equal(await o.ben(B), null);
});

test("12) bildirimler yalnız tetikleyici: yanlış gizli anahtar 403; kayıtsız/sahte bildirim erişim açmaz; kayıtlı işlem için mağazaya yeniden sorulur", async () => {
  const o = await ortam(); const c = await o.kullanici("m12@ornek.com"); const k = await o.kimlik(c);
  const web = await import(pathToFileURL(resolve("functions/api/magaza/[[yol]].js")).href);
  const bil = async (yol, sorgu, govde) => (await web.onRequest({ request: new Request("https://akeakademi.com/api/magaza/" + yol + sorgu, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(govde) }), env: o.env, params: { yol: [yol] } })).status;
  const gb = (token, tip = 2) => ({ message: { data: Buffer.from(JSON.stringify({ subscriptionNotification: { purchaseToken: token, notificationType: tip } })).toString("base64") } });
  assert.equal(await bil("google", "?s=yanlis", gb(TOKEN)), 403);
  assert.equal(await bil("google", "", gb(TOKEN)), 403);
  // kayıtsız işlem için bildirim: mağaza ne derse desin erişim açılmaz (yalnız kullanıcı doğrulamasıyla açılır)
  M.google[TOKEN] = gGovde("premium_aylik", { hesap: k.google });
  assert.equal(await bil("google", "?s=bildirim-sirri", gb(TOKEN)), 200);
  assert.equal(await o.ben(c), null, "bildirim tek başına erişim açmaz");
  assert.equal(satir(o.DB, "google", TOKEN), undefined);
  // kayıtlı işlem: bildirim mağazaya yeniden sordurur; iade bildirimi sonrası erişim kapanır
  await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.equal((await o.ben(c)).plan, "premium");
  M.google[TOKEN] = gGovde("premium_aylik", { hesap: k.google, durum: "SUBSCRIPTION_STATE_EXPIRED", bitis: Date.now() - 1000, onay: true });
  const once = M.cagrilar.length;
  assert.equal(await bil("google", "?s=bildirim-sirri", gb(TOKEN, 12)), 200);
  assert.ok(M.cagrilar.length > once, "mağazaya yeniden soruldu");
  assert.equal(await o.ben(c), null);
  // Apple bildirimi: imzalı yük içeriğine güvenilmez; kayıtlı işlem için mağazaya sorulur
  const ak = await o.kimlik(c); M.apple["1000000123456789"] = aGovde("atilim_aylik", { hesap: ak.apple });
  await o.cagir(c, "POST", "magaza/dogrula", { platform: "apple", kimlik: "2000000111" });
  M.apple["1000000123456789"] = aGovde("atilim_aylik", { hesap: ak.apple, iade: true });
  const yuk = { signedPayload: jws({ notificationType: "REFUND", data: { signedTransactionInfo: jws({ originalTransactionId: "1000000123456789", transactionId: "2000000111" }) } }) };
  assert.equal(await bil("apple", "", yuk), 200);
  assert.equal(satir(o.DB, "apple", "1000000123456789").durum, "iade");
  assert.equal(await o.ben(c), null);
});

test("15) Paketler vaatleri sunucunun GERÇEK ayarıdır: varsayılanlar ve ortam değişkeniyle değişen değerler", async () => {
  let o = await ortam(); let c = await o.kullanici("m15@ornek.com");
  let h = (await o.cagir(c, "GET", "magaza")).j.haklar;
  assert.deepEqual([h.orta.mesaj, h.premium.mesaj, h.ucretsiz.soru, h.ucretsiz.deneme], [200, 500, 20, 1]);
  o = await ortam({ AKE_LIMIT_ORTA: "150", AKE_LIMIT_PREMIUM: "400", AKE_UCRETSIZ_SORU: "10" }); c = await o.kullanici("m15b@ornek.com");
  h = (await o.cagir(c, "GET", "magaza")).j.haklar;
  assert.deepEqual([h.orta.mesaj, h.premium.mesaj, h.ucretsiz.soru], [150, 400, 10], "ekran rakamı ortam ayarını izler");
  for (const k of ["AKE_LIMIT_ORTA", "AKE_LIMIT_PREMIUM", "AKE_UCRETSIZ_SORU"]) delete T.env[k];
});

test("16) Premium varsayılan KAPALI: listelenmez, kullanıcı doğrulaması reddedilir; Atılım çalışır; ayar açılınca Premium da gelir", async () => {
  const o = await ortam({ AKE_MAGAZA_PREMIUM: "" }); const c = await o.kullanici("m16@ornek.com"); const k = await o.kimlik(c);
  let r = await o.cagir(c, "GET", "magaza");
  assert.deepEqual(r.j.urunler.map(u => u.id), ["atilim_aylik", "atilim_yillik"]);
  M.google[TOKEN] = gGovde("premium_aylik", { hesap: k.google });
  r = await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.notEqual(r.s, 200); assert.equal(r.j.sonuc[0].hata, "urun_kapali"); assert.equal(r.j.paket, null);
  assert.equal(await o.ben(c), null, "Premium erişimi açılmadı");
  M.google[TOKEN] = gGovde("atilim_aylik", { hesap: k.google });
  r = await o.cagir(c, "POST", "magaza/dogrula", { platform: "google", kimlik: TOKEN });
  assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal((await o.ben(c)).plan, "orta");
  const a = await ortam({ AKE_MAGAZA_PREMIUM: "acik" }); const ca = await a.kullanici("m16b@ornek.com");
  assert.equal((await a.cagir(ca, "GET", "magaza")).j.urunler.length, 4);
});
