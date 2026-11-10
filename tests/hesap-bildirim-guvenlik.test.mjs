import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as hesap } from "../functions/api/hesap/[[yol]].js";
import { onRequest as bildirim } from "../functions/api/bildirim/[[yol]].js";
import { kullaniciBulVeyaAc, oturumAc, sema, sha256 } from "../lib/ortak.js";
import { b64u, pushAdresi, pushGonder } from "../lib/webpush.js";
import { d1 } from "./yardim/soru-v2.mjs";

const env = { DB: d1(), AKE_GIZLI: "yerel-test", GOOGLE_CLIENT_ID: "test-istemci" };
const db = env.DB.db;
await sema(env);

const KOD = "123456";
const ORIGIN = "https://ake.example.test";
const GOOGLE = "https://oauth2.googleapis.com/token";
const PUSH = "https://fcm.googleapis.com/fcm/send/test-aboneligi";
let ip = 0;
function istek(uc, yol, { method = "GET", cookie, body, query = "" } = {}) {
  const fn = uc === "hesap" ? hesap : bildirim;
  const headers = { "content-type": "application/json", "cf-connecting-ip": "192.0.2." + (++ip) };
  if (cookie) headers.cookie = cookie;
  const request = new Request(ORIGIN + "/api/" + uc + "/" + yol + query, { method, headers, body: JSON.stringify(body) });
  return fn({ request, env, params: { yol: [yol] } });
}
async function girisKodu(eposta, bitis = Date.now() + 600000) {
  const hash = await sha256(eposta + ":" + KOD + ":" + env.AKE_GIZLI);
  db.prepare("INSERT INTO giris (eposta, hash, bitis, deneme) VALUES (?, ?, ?, 0)").run(eposta, hash, bitis);
}
function dogrula(eposta, kod = KOD) {
  return istek("hesap", "kod-dogrula", { method: "POST", body: { eposta, kod } });
}
function googleDonus(t, alanlar) {
  const payload = { aud: env.GOOGLE_CLIENT_ID, iss: "https://accounts.google.com", sub: "test-google-kimligi", exp: Math.floor(Date.now() / 1000) + 60, email_verified: true, ...alanlar };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, GOOGLE);
    assert.equal(options.redirect, "error");
    return Response.json({ id_token: "test." + encoded + ".test" });
  });
  return async () => {
    const r = await istek("hesap", "google-donus", { cookie: "ake_g=test-state", query: "?code=test&state=test-state" });
    assert.equal(fetch.mock.callCount(), 1);
    return r;
  };
}

test("Bir giriş kodu aynı anda iki istek gelse de bir oturum açar", async () => {
  const eposta = "kod@example.test";
  await girisKodu(eposta);
  const rs = await Promise.all([dogrula(eposta), dogrula(eposta)]);
  assert.deepEqual(rs.map(r => r.status).sort(), [200, 400]);
  assert.equal(rs.filter(r => r.headers.has("set-cookie")).length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM oturum JOIN kullanici ON kullanici.id = oturum.kid WHERE eposta = ?").get(eposta).n, 1);
});

test("Süresi geçen kod ve beş denemesi dolan kod oturum açmaz", async () => {
  const eski = "eski@example.test", eposta = "deneme@example.test";
  await girisKodu(eski, Date.now() - 1000);
  assert.equal((await (await dogrula(eski)).json()).error, "kod_suresi");
  await girisKodu(eposta);
  for (let i = 0; i < 5; i++) assert.equal((await (await dogrula(eposta, "234567")).json()).error, "kod_yanlis");
  const r = await dogrula(eposta);
  assert.equal(r.status, 429);
  assert.equal(r.headers.has("set-cookie"), false);
});

test("Bozuk oturum çerezi normal giriş kapısına döner", async () => {
  const r = await istek("hesap", "ben", { cookie: "ake_s=%" });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, "giris");
});

test("Google'ın doğruladığı Gmail adresi aynı AKE hesabına bağlanır", async t => {
  const email = "gmail-test@gmail.com", kid = await kullaniciBulVeyaAc(env, { eposta: email });
  const r = await googleDonus(t, { email, sub: "gmail-test" })();
  assert.equal(r.headers.get("location"), ORIGIN + "/#hesap?giris=ok");
  assert.equal(db.prepare("SELECT google FROM kullanici WHERE id = ?").get(kid).google, "g:gmail-test");
});

test("Google Workspace ile oturum açılır", async t => {
  const r = await googleDonus(t, { email: "ogrenci@okul.example.test", hd: "okul.example.test", sub: "okul-test" })();
  assert.equal(r.headers.get("location"), ORIGIN + "/#hesap?giris=ok");
});

test("Google dışındaki e-posta için mevcut Google bağı yoksa e-posta girişine dönülür", async t => {
  const email = "harici@example.test", kid = await kullaniciBulVeyaAc(env, { eposta: email });
  const r = await googleDonus(t, { email })();
  assert.equal(r.headers.get("location"), ORIGIN + "/#hesap?hata=google");
  assert.equal(db.prepare("SELECT google FROM kullanici WHERE id = ?").get(kid).google, null);
  assert.ok(r.headers.getSetCookie().every(c => !c.startsWith("ake_s=")));
});

test("Daha önce bağlanan Google kimliği aynı hesaba girebilir", async t => {
  const email = "bagli@example.test";
  const kid = await kullaniciBulVeyaAc(env, { eposta: email, google: "g:bagli-test" });
  const r = await googleDonus(t, { email, sub: "bagli-test" })();
  const cookie = r.headers.getSetCookie().find(c => c.startsWith("ake_s="))?.split(";")[0];
  assert.ok(cookie);
  assert.equal((await (await istek("hesap", "ben", { cookie })).json()).kullanici.id, kid);
});

test("Farklı Google kimliği daha önce bağlanmış hesabın e-posta adresiyle oturum açmaz", async t => {
  const email = "eslesme@gmail.com", kid = await kullaniciBulVeyaAc(env, { eposta: email, google: "g:eski" });
  const r = await googleDonus(t, { email, sub: "yeni" })();
  assert.equal(r.headers.get("location"), ORIGIN + "/#hesap?hata=google");
  assert.equal(db.prepare("SELECT google FROM kullanici WHERE id = ?").get(kid).google, "g:eski");
});

test("Google oturumunda geçerli olmayan yayıncı kabul edilmez", async t => {
  const r = await googleDonus(t, { email: "ornek@gmail.com", iss: "https://accounts.example.test" })();
  assert.equal(r.headers.get("location"), ORIGIN + "/#hesap?hata=google");
  assert.ok(r.headers.getSetCookie().every(c => !c.startsWith("ake_s=")));
});

test("Bildirim adresleri desteklenen sağlayıcılarla sınırlı", () => {
  for (const adres of [
    PUSH,
    "https://updates.push.services.mozilla.com/wpush/v2/test-aboneligi",
    "https://web.push.apple.com/test-aboneligi",
    "https://web.notify.windows.com/w/?token=test",
    "https://web.wns.windows.com/w/?token=test"
  ]) assert.ok(pushAdresi(adres), adres);
  for (const adres of [null, "geçersiz", "https://example.invalid/notifications", "http://fcm.googleapis.com/fcm/send/test"]) {
    assert.equal(pushAdresi(adres), null);
  }
});

test("Bildirim kaydı ve gönderimi aynı adres kuralını uygular", async t => {
  const kid = await kullaniciBulVeyaAc(env, { eposta: "bildirim@example.test" });
  const cookie = (await oturumAc(env, kid)).split(";")[0];
  const cift = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const keys = { p256dh: b64u(await crypto.subtle.exportKey("raw", cift.publicKey)), auth: b64u(new Uint8Array(16)) };
  const istekAbone = endpoint => istek("bildirim", "abone", { method: "POST", cookie, body: { sub: { endpoint, keys }, slots: ["sabah"] } });
  const bilinmeyen = "https://example.invalid/notifications";
  assert.equal((await istekAbone(bilinmeyen)).status, 400);
  assert.equal((await istekAbone(PUSH)).status, 200);
  const gonder = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, PUSH);
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.match(options.headers.authorization, /^vapid /);
    return new Response(null, { status: 201 });
  });
  assert.equal((await pushGonder({ endpoint: bilinmeyen, ...keys }, {}, {})).ok, false);
  assert.equal(gonder.mock.callCount(), 0);
  const r = await istek("bildirim", "test", { method: "POST", cookie });
  assert.equal((await r.json()).gonderilen, 1);
  assert.equal(gonder.mock.callCount(), 1);
});

test("Hesap silme yalnızca o hesaba ait bildirim aboneliğini kaldırır", async () => {
  const kid = await kullaniciBulVeyaAc(env, { eposta: "silinen@example.test" });
  const diger = await kullaniciBulVeyaAc(env, { eposta: "diger@example.test" });
  const kaydet = db.prepare("INSERT INTO push (endpoint, kid) VALUES (?, ?)");
  kaydet.run("https://web.push.apple.com/silinecek", kid);
  kaydet.run("https://web.push.apple.com/kalacak", diger);
  const cookie = (await oturumAc(env, kid)).split(";")[0];
  assert.equal((await istek("hesap", "sil", { method: "POST", cookie })).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM push WHERE kid = ?").get(kid).n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM push WHERE kid = ?").get(diger).n, 1);
});
