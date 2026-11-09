// Yönetim API'si sunucu tarafı testleri · çalıştırma: node --test tests/panel/panel-sunucu.test.mjs
// GERÇEK functions/api/yonetim kodu çalışır; veritabanı bellek içi SQLite (node:sqlite), Resend/Shopier ağ çağrıları sahtedir.
// Gerçek ödeme, gerçek kullanıcı verisi veya gerçek ağ kullanılmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { sema, kullaniciBulVeyaAc, oturumAc, aktifPaket, ayarOku, ayarYaz, hmacHex } from "../../lib/ortak.js";
import { onRequest as shopierIstek } from "../../functions/api/shopier.js";
import { onRequest } from "../../functions/api/yonetim/[[yol]].js";

function d1() {
  const db = new DatabaseSync(":memory:");
  const mk = (sql, a) => ({ bind: (...x) => mk(sql, x), first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, _run: () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; } });
  return { raw: db, prepare: sql => mk(sql, []), batch: async l => { db.exec("BEGIN"); try { const o = l.map(s => s._run()); db.exec("COMMIT"); return o; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}
const SEMA = [];
const ag = []; let resend = 200, shopierDavranis = null;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  ag.push({ url, method: opt.method || "GET", body: opt.body });
  if (url.includes("api.resend.com")) return new Response("{}", { status: resend });
  if (url.startsWith("https://api.shopier.com/v1")) { if (!shopierDavranis) throw new Error("beklenmeyen Shopier çağrısı"); return shopierDavranis(url, opt); }
  throw new Error("beklenmeyen ağ çağrısı: " + url);
};
async function ortam(ek = {}) {
  const db = d1(), env = { DB: db, AKE_GIZLI: "a".repeat(64), RESEND_API_KEY: "re_test", AKE_YONETICI: "yonetici@test.dev", ...ek };
  if (!SEMA.length) { const ham = db.prepare; db.prepare = q => { SEMA.push(q); return ham(q); }; await sema(env); db.prepare = ham; } else SEMA.forEach(q => db.raw.exec(q));
  const kisi = async (eposta) => { const kid = await kullaniciBulVeyaAc(env, { eposta, ad: eposta.split("@")[0] }); const cookie = (await oturumAc(env, kid)).split(";")[0]; return { kid, cookie }; };
  env.yonetici = await kisi("yonetici@test.dev"); env.ogrenci = await kisi("ogrenci@test.dev"); env.diger = await kisi("diger@test.dev"); ag.length = 0; resend = 200; shopierDavranis = null; return env;
}
const ORIGIN = "https://akeakademi.com";
// Tarayıcı gibi: durum değiştiren isteklerde varsayılan olarak doğru Origin gönderilir. origin: null → Origin başlığı hiç yok. ek: ek başlıklar. host: istek adresi.
const cagir = (env, yol, { method = "GET", govde, cookie, hamGovde, origin = ORIGIN, ek = {}, host = ORIGIN } = {}) => onRequest({
  request: new Request(host + "/api/yonetim/" + yol, { method, headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json", ...(origin !== null && method !== "GET" ? { origin } : {}), ...ek }, body: method === "GET" ? undefined : (hamGovde ?? JSON.stringify(govde || {})) }),
  env, params: { yol: yol.split("/") }
});
const adm = (env, yol, o = {}) => cagir(env, yol, { ...o, cookie: env.yonetici.cookie });
const sayim = (env, t) => env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
const durumlar = env => JSON.stringify(["kod", "siparis", "ayar"].map(t => env.DB.raw.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()));
const paketVar = async (env, kid) => !!(await aktifPaket(env, kid));
const kodVer = (env, kid, plan = "premium", bitis = "2099-01-01") => env.DB.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih, siparis) VALUES (?, ?, ?, ?, ?, 'x')").bind("K" + Math.random().toString(16).slice(2, 10) + "ABCD", kid, plan, bitis, Date.now()).run();

/* ---- 1) Sözleşme: ön yüzün çağırdığı yöntem + adres, backend'de birebir var mı (kaynak kodundan okunur) ---- */
test("sözleşme: ön yüzdeki her /api/yonetim çağrısı (yöntem + adres) backend'de tanımlı", () => {
  const be = readFileSync(new URL("../../functions/api/yonetim/[[yol]].js", import.meta.url), "utf8"), on = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const rota = new Set([...be.matchAll(/ad === "([\w-]+)" && m === "(GET|POST)"/g)].map(x => x[2] + " " + x[1]));
  const kullan = new Set();
  for (const x of on.matchAll(/yonIstek\("([\w-]+)"/g)) kullan.add("POST " + x[1]);
  for (const x of on.matchAll(/fetch\("\/api\/yonetim\/([\w-]+)"(?:, \{([^}]*)\})?/g)) kullan.add((/method:\s*"POST"/.test(x[2] || "") ? "POST " : "GET ") + x[1]);
  assert.ok(kullan.size >= 12, "ön yüz çağrıları bulunamadı: " + [...kullan]);
  for (const k of kullan) if (k !== "GET veli") assert.ok(rota.has(k), `backend'de yok: ${k}`); // "veli" bu sürümde bilerek yok (panel 404'ü 'Henüz etkin değil' olarak gösterir)
  assert.ok(kullan.has("GET veli") && !rota.has("GET veli"), "veli ucu bu dalda backend'de bulunmamalı (veli kodu ayrı yayınlanır)");
});

/* ---- 2) Yetkilendirme: oturumsuz ve yönetici olmayan kullanıcı HİÇBİR uca erişemez, hiçbir şey değişmez ---- */
const UCLAR = [["GET", "durum"], ["GET", "aboneler"], ["GET", "bildirim"], ["GET", "maliyet"], ["GET", "sorular"], ["GET", "veli"], ["POST", "shopier-kur"], ["POST", "deneme-siparis"], ["POST", "tekrar-gonder"], ["POST", "siparis-tamamla"], ["POST", "abone-iptal"], ["POST", "soru-uret"], ["POST", "soru-karar"], ["GET", "bilinmeyen-uc"], ["POST", "bilinmeyen-uc"]];
for (const [rol, sec] of [["oturumsuz", e => ({})], ["yönetici olmayan öğrenci", e => ({ cookie: e.ogrenci.cookie })], ["geçersiz oturum çerezi", e => ({ cookie: "ake_s=" + "x".repeat(64) })]]) {
  test(`yetki: ${rol} tüm yönetim uçlarında 403 alır ve veri/ağ değişmez`, async () => {
    const env = await ortam(); await kodVer(env, env.diger.kid); const once = durumlar(env), kisiler = sayim(env, "kullanici");
    for (const [m, yol] of UCLAR) {
      const r = await cagir(env, yol, { method: m, govde: { kid: env.diger.kid, id: "1!kod", paket: "premium-yil", eposta: "x@test.dev", karar: "onay" }, ...sec(env) });
      assert.equal(r.status, 403, `${m} ${yol} → ${r.status}`); assert.equal((await r.json()).error, "yetki");
    }
    assert.equal(durumlar(env), once, "veritabanı değişmemeli"); assert.equal(sayim(env, "kullanici"), kisiler);
    assert.equal(ag.length, 0, "hiç dış çağrı (Resend/Shopier) yapılmamalı");
    assert.equal(await paketVar(env, env.diger.kid), true);
  });
}
test("yetki: yönetici e-postası AKE_YONETICI listesinde değilse (başka hesap) erişemez; büyük/küçük harf duyarsız eşleşir", async () => {
  const env = await ortam({ AKE_YONETICI: "Yonetici@Test.dev" });
  assert.equal((await adm(env, "durum")).status, 200);
  assert.equal((await cagir(env, "durum", { cookie: env.diger.cookie })).status, 403);
});

/* ---- 3) Yönetici: yanıt alanları ön yüzün okuduğu alanlarla uyumlu ---- */
test("sözleşme: durum / aboneler / maliyet / bildirim / sorular yanıt alanları ön yüzün beklediğiyle uyumlu", async () => {
  const env = await ortam(); await kodVer(env, env.ogrenci.kid, "orta");
  const d = await (await adm(env, "durum")).json();
  for (const k of ["pat", "eposta", "webhook", "webhookId", "siparisler", "inceleme", "sayilar"]) assert.ok(k in d, "durum." + k);
  assert.ok(Array.isArray(d.siparisler) && typeof d.inceleme === "number" && "kullanici" in d.sayilar && "paket" in d.sayilar);
  assert.equal(d.pat, false); assert.equal(d.eposta, true); assert.equal(d.webhook, false);
  const a = await (await adm(env, "aboneler")).json(); assert.ok(Array.isArray(a.aboneler) && a.aboneler.length === 1);
  for (const k of ["kid", "eposta", "ad", "plan", "bitis"]) assert.ok(k in a.aboneler[0], "aboneler[]." + k);
  const m = await (await adm(env, "maliyet")).json(); for (const k of ["bugunUsd", "ayUsd", "ayCagri", "soruUretBugun", "soruUretLimit"]) assert.ok(k in m, "maliyet." + k);
  const b = await (await adm(env, "bildirim")).json(); for (const k of ["token", "cihaz", "kisi", "origin"]) assert.ok(k in b, "bildirim." + k);
  const s = await (await adm(env, "sorular")).json(); assert.ok(Array.isArray(s.bekleyen) && "sayi" in s);
  assert.equal((await adm(env, "veli")).status, 404, "veli ucu bu sürümde yok → panel 'Henüz etkin değil' gösterir");
  assert.equal((await adm(env, "durum", { method: "POST" })).status, 404, "yanlış yöntem 404");
});

/* ---- 4) Üyelik iptali ---- */
test("üyelik iptali: yalnızca verilen kullanıcının paketi kapanır, hesap silinmez, hatalı girişler reddedilir", async () => {
  const env = await ortam(); await kodVer(env, env.ogrenci.kid, "premium"); await kodVer(env, env.diger.kid, "orta");
  assert.ok(await paketVar(env, env.ogrenci.kid)); const hesaplar = sayim(env, "kullanici");
  for (const g of [{}, { kid: "" }, { kid: "silindi" }]) assert.equal((await adm(env, "abone-iptal", { method: "POST", govde: g })).status, 400);
  assert.equal((await adm(env, "abone-iptal", { method: "POST", hamGovde: "{bozuk" })).status, 400, "bozuk JSON güvenle reddedilir");
  assert.ok(await paketVar(env, env.ogrenci.kid), "hatalı istekler paketi bozmamalı");
  const r = await adm(env, "abone-iptal", { method: "POST", govde: { kid: env.ogrenci.kid } }); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, kapatilan: 1 });
  assert.ok(!(await paketVar(env, env.ogrenci.kid)), "iptal edilenin paketi kapanır"); assert.ok(await paketVar(env, env.diger.kid), "diğer abone etkilenmez");
  assert.equal(sayim(env, "kullanici"), hesaplar, "hesap silinmez");
  const liste = (await (await adm(env, "aboneler")).json()).aboneler; assert.deepEqual(liste.map(x => x.kid), [env.diger.kid]);
  assert.equal((await adm(env, "abone-iptal", { method: "GET" })).status, 404, "GET ile iptal edilemez");
});

/* ---- 5) Erişim kodu gönderme (deneme siparişi): ödeme yok, gerçek kod, alıcı doğru ---- */
test("erişim kodu gönder: ödeme çağrısı yok; seçilen paketle kod üretir; geçersiz e-posta/paket güvenli varsayıla düşer", async () => {
  const env = await ortam();
  let r = await adm(env, "deneme-siparis", { method: "POST", govde: { paket: "premium-yil", eposta: "Arkadas@Test.dev" } }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.durum, "deneme"); assert.match(j.kodlar[0].kod, /^AKE-\w{4}-\w{4}-\w{4}-\w{4}$/); assert.match(j.kodlar[0].adi, /Premium/);
  const mail = ag.filter(x => x.url.includes("resend")).map(x => JSON.parse(x.body)); assert.equal(mail.length, 1); assert.deepEqual(mail[0].to, ["arkadas@test.dev"]); assert.match(mail[0].subject, /Deneme/);
  assert.ok(!ag.some(x => x.url.includes("shopier")), "ödeme/Shopier çağrısı yapılmamalı");
  ag.length = 0; r = await adm(env, "deneme-siparis", { method: "POST", govde: { paket: "yok-paket", eposta: "kotu-adres" } }); const j2 = await r.json();
  assert.equal(r.status, 200); assert.match(j2.kodlar[0].adi, /Atılım/); assert.deepEqual(JSON.parse(ag[0].body).to, ["yonetici@test.dev"], "geçersiz e-posta yöneticiye düşer");
  const sip = env.DB.raw.prepare("SELECT durum FROM siparis WHERE id LIKE 'deneme-%'").all(); assert.ok(sip.every(s => s.durum === "deneme"));
});
test("erişim kodu gönder: Resend hatasında yanıt durum='eposta_hatasi' (ön yüz 'gönderildi' dememeli); anahtar yoksa da çökmez", async () => {
  const env = await ortam(); resend = 500;
  const r = await adm(env, "deneme-siparis", { method: "POST", govde: { paket: "orta-ay" } }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.durum, "eposta_hatasi");
  const env2 = await ortam({ RESEND_API_KEY: "" }); const j2 = await (await adm(env2, "deneme-siparis", { method: "POST", govde: {} })).json(); assert.equal(j2.durum, "eposta_hatasi");
});
test("kod yeniden gönderme: yalnızca kayıtlı siparişin e-postasına gider; bilinmeyen sipariş 404; Resend hatası 502 ve durum değişmez", async () => {
  const env = await ortam(); await adm(env, "deneme-siparis", { method: "POST", govde: { eposta: "alici@test.dev" } }); ag.length = 0;
  const sid = env.DB.raw.prepare("SELECT id FROM siparis WHERE id LIKE 'deneme-%'").get().id;
  assert.equal((await adm(env, "tekrar-gonder", { method: "POST", govde: { id: "yok-boyle-siparis" } })).status, 404);
  assert.equal((await adm(env, "tekrar-gonder", { method: "POST", govde: {} })).status, 404); assert.equal(ag.length, 0);
  resend = 500; assert.equal((await adm(env, "tekrar-gonder", { method: "POST", govde: { id: sid, eposta: "saldirgan@test.dev" } })).status, 502);
  assert.equal(env.DB.raw.prepare("SELECT durum FROM siparis WHERE id = ?").get(sid).durum, "deneme", "hata durumu bozmaz");
  resend = 200; ag.length = 0; const r = await adm(env, "tekrar-gonder", { method: "POST", govde: { id: sid, eposta: "saldirgan@test.dev" } }); assert.equal(r.status, 200);
  const mail = JSON.parse(ag[0].body); assert.deepEqual(mail.to, ["alici@test.dev"], "gövdedeki e-posta yok sayılır; kayıtlı adrese gider"); assert.match(mail.text, /AKE-/);
});
test("eksik kod tamamlama: kimlik biçimi, kayıt yokluğu, süren işlem (409) ve eksik ham veri (422) güvenle reddedilir; hiçbir kayıt değişmez", async () => {
  const env = await ortam(); const ekle = (id, durum, tarih, ham) => env.DB.prepare("INSERT INTO siparis (id, eposta, ad, paket, anahtar, tutar, tarih, durum, ham) VALUES (?, 'a@test.dev', '0/1', '', '', '199', ?, ?, ?)").bind(id, tarih, durum, ham).run();
  await ekle("S1!kod", "kod_bekliyor", Date.now(), "{}"); await ekle("S2!kod", "kod_uretilemedi", Date.now() - 1e6, ""); await ekle("S3!kod", "gonderildi", 1, "{}"); const once = durumlar(env);
  for (const g of [{}, { id: "S1" }, { id: "../x!kod" }, { id: "a b!kod" }]) assert.equal((await adm(env, "siparis-tamamla", { method: "POST", govde: g })).status, 400, JSON.stringify(g));
  assert.equal((await adm(env, "siparis-tamamla", { method: "POST", govde: { id: "YOK!kod" } })).status, 404);
  assert.equal((await adm(env, "siparis-tamamla", { method: "POST", govde: { id: "S3!kod" } })).status, 404, "tamamlanmayı beklemeyen kayıt");
  assert.equal((await adm(env, "siparis-tamamla", { method: "POST", govde: { id: "S1!kod" } })).status, 409, "2 dakikadan yeni işlem sürüyor");
  assert.equal((await adm(env, "siparis-tamamla", { method: "POST", govde: { id: "S2!kod" } })).status, 422, "ham veri yoksa elle gönderilmeli");
  assert.equal(durumlar(env), once); assert.equal(ag.length, 0);
});
test("eksik kod tamamlama: doğrulanmış ham siparişten kod üretir, e-posta gönderir; ikinci çağrı çift kod üretmez", async () => {
  const env = await ortam();
  const ham = { id: "S9", paymentStatus: "paid", currency: "TRY", totals: { total: "199.00" }, billingInfo: { email: "alici@test.dev", firstName: "Ali" }, lineItems: [{ productId: "52547800", quantity: 1 }] };
  await env.DB.prepare("INSERT INTO siparis (id, eposta, ad, paket, anahtar, tutar, tarih, durum, ham) VALUES ('S9!kod', 'alici@test.dev', '0/1 kod hazır', '', '', '199', ?, 'kod_uretilemedi', ?)").bind(Date.now() - 1e6, JSON.stringify(ham)).run();
  const r = await adm(env, "siparis-tamamla", { method: "POST", govde: { id: "S9!kod" } }); assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM kod WHERE siparis = 'S9'").get().n, 1); assert.equal(ag.filter(x => x.url.includes("resend")).length, 1);
  assert.equal(env.DB.raw.prepare("SELECT durum FROM siparis WHERE id = 'S9!kod'").get().durum, "kod_hatasi_cozuldu");
  assert.equal((await adm(env, "siparis-tamamla", { method: "POST", govde: { id: "S9!kod" } })).status, 404, "çözülmüş kayıt tekrar tamamlanamaz");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM kod WHERE siparis = 'S9'").get().n, 1, "çift kod yok");
});

/* ---- 6) Shopier kurulumu (sahte Shopier) ---- */
test("Shopier kurulum: SHOPIER_PAT yoksa 400; geçersiz anahtar 400; başarıda eski webhook silinir, yenisi kurulur, token yalnızca ayarda saklanır", async () => {
  let env = await ortam(); let r = await adm(env, "shopier-kur", { method: "POST" }); assert.equal(r.status, 400); assert.equal((await r.json()).error, "pat_yok"); assert.equal(ag.length, 0);
  env = await ortam({ SHOPIER_PAT: "pat_test" }); shopierDavranis = async () => new Response("{}", { status: 401 });
  r = await adm(env, "shopier-kur", { method: "POST" }); assert.equal(r.status, 400); assert.equal((await r.json()).error, "pat_gecersiz");
  const cagri = []; shopierDavranis = async (url, opt) => { cagri.push((opt.method || "GET") + " " + url.replace("https://api.shopier.com/v1", "")); if ((opt.method || "GET") === "GET") return Response.json([{ id: "eski1", event: "order.created" }, { id: "baska", event: "order.refunded" }]);
    if (opt.method === "DELETE") return new Response("{}", { status: 200 }); return Response.json({ data: { id: "yeni1", token: "gizli-imza-anahtari" } }); };
  r = await adm(env, "shopier-kur", { method: "POST" }); const j = await r.json(); assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.url, "https://akeakademi.com/api/shopier");
  assert.deepEqual(cagri, ["GET /webhooks", "DELETE /webhooks/eski1", "POST /webhooks"], "yalnızca order.created webhook'u yenilenir");
  assert.equal(await ayarOku(env, "shopier_webhook_token"), "gizli-imza-anahtari"); assert.ok(!JSON.stringify(j).includes("gizli-imza"), "imza anahtarı yanıtta dönmez");
  assert.equal((await (await adm(env, "durum")).json()).webhook, true);
  shopierDavranis = async (url, opt) => (opt.method === "POST" ? new Response("{}", { status: 500 }) : Response.json([])); r = await adm(env, "shopier-kur", { method: "POST" }); assert.equal(r.status, 502);
});

/* ===================== Production Hardening V1 ===================== */
const POSTLAR = ["shopier-kur", "deneme-siparis", "tekrar-gonder", "siparis-tamamla", "abone-iptal", "soru-uret", "soru-karar"];
const ham = (env, o = {}) => cagir(env, o.yol || "abone-iptal", { method: o.method || "POST", cookie: env.yonetici.cookie, govde: { kid: env.diger.kid, id: "1!kod", paket: "premium-yil", eposta: "x@test.dev", karar: "onay" }, ...o });

/* A) Origin / CSRF */
test("origin: yönetici + doğru Origin + POST → izin; GET ekranları Origin olmadan da normal çalışır", async () => {
  const env = await ortam(); await kodVer(env, env.diger.kid, "orta");
  assert.equal((await ham(env)).status, 200, "doğru Origin ile iptal çalışır");
  for (const yol of ["durum", "aboneler", "bildirim", "maliyet", "sorular"]) {
    assert.equal((await adm(env, yol)).status, 200, "GET " + yol);
    assert.equal((await cagir(env, yol, { cookie: env.yonetici.cookie, ek: { origin: "https://evil.example" } })).status, 200, "GET Origin'e bakmaz: " + yol);
  }
});
for (const [ad, ek] of [["yabancı site", { origin: "https://evil.example" }], ["sahte benzer alan adı (akeakademi.com.evil.example)", { origin: "https://akeakademi.com.evil.example" }], ["alt alan adı gibi görünen sahte (evil.akeakademi.com)", { origin: "https://evil.akeakademi.com" }], ["www (istek apex'e giderken farklı origin)", { origin: "https://www.akeakademi.com" }], ["http şeması", { origin: "http://akeakademi.com" }], ["farklı port", { origin: "https://akeakademi.com:8443" }], ["'null' origin (sandbox/yönlendirme)", { origin: "null" }], ["boş Origin", { origin: "" }]]) {
  test(`origin: yönetici oturumu olsa bile ${ad} ile gelen durum değiştiren istek 403 'origin' alır; hiçbir şey değişmez`, async () => {
    const env = await ortam({ SHOPIER_PAT: "pat" }); await kodVer(env, env.diger.kid); const once = durumlar(env);
    for (const yol of POSTLAR) { const r = await ham(env, { yol, origin: ek.origin }); assert.equal(r.status, 403, yol); assert.equal((await r.json()).error, "origin", yol); }
    for (const method of ["PUT", "PATCH", "DELETE"]) assert.equal((await ham(env, { method, origin: ek.origin })).status, 403, method);
    assert.equal(durumlar(env), once); assert.equal(ag.length, 0, "dış çağrı yok"); assert.ok(await paketVar(env, env.diger.kid), "üyelik etkilenmedi");
  });
}
test("origin: Origin yoksa Sec-Fetch-Site/Referer aranır; hiçbiri yoksa ya da yabancıysa reddedilir", async () => {
  const env = await ortam(); await kodVer(env, env.diger.kid);
  assert.equal((await ham(env, { origin: null })).status, 403, "hiçbir kanıt yok");
  assert.equal((await ham(env, { origin: null, ek: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await ham(env, { origin: null, ek: { referer: "https://evil.example/sayfa" } })).status, 403);
  assert.equal((await ham(env, { origin: null, ek: { referer: "bozuk adres" } })).status, 403);
  assert.equal((await ham(env, { origin: null, ek: { "sec-fetch-site": "same-origin" } })).status, 200, "aynı kaynak kanıtı");
  await kodVer(env, env.diger.kid); assert.equal((await ham(env, { origin: null, ek: { referer: ORIGIN + "/#yonetim" } })).status, 200, "aynı origin'li Referer");
  await kodVer(env, env.diger.kid); assert.equal((await ham(env, { origin: "https://evil.example", ek: { "sec-fetch-site": "same-origin" } })).status, 403, "Origin varsa o belirleyicidir");
});
test("origin: www alan adından gelen istek (Origin = istek adresinin origin'i) çalışır; apex Origin'i www'ya karşı reddedilir; joker yok", async () => {
  const env = await ortam(); await kodVer(env, env.diger.kid);
  assert.equal((await ham(env, { host: "https://www.akeakademi.com", origin: "https://www.akeakademi.com" })).status, 200);
  await kodVer(env, env.diger.kid); assert.equal((await ham(env, { host: "https://www.akeakademi.com", origin: "https://akeakademi.com" })).status, 403);
});
test("origin: öğrenci + doğru Origin yine 403 'yetki'; oturumsuz 403; yönetici olmayan için de yabancı Origin 403", async () => {
  const env = await ortam(); const once = durumlar(env);
  for (const yol of POSTLAR) {
    let r = await cagir(env, yol, { method: "POST", cookie: env.ogrenci.cookie }); assert.equal(r.status, 403); assert.equal((await r.json()).error, "yetki", yol);
    r = await cagir(env, yol, { method: "POST" }); assert.equal(r.status, 403); assert.equal((await r.json()).error, "yetki");
    assert.equal((await cagir(env, yol, { method: "POST", cookie: env.ogrenci.cookie, origin: "https://evil.example" })).status, 403);
  }
  assert.equal(durumlar(env), once); assert.equal(ag.length, 0);
});
test("çerez yapısı değişmedi: HttpOnly; Secure; SameSite=Lax", async () => {
  const env = await ortam(); const c = await oturumAc(env, env.yonetici.kid); assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /SameSite=Lax/);
});
test("Shopier webhook'una Origin kontrolü uygulanmaz: imzalı bildirim yabancı/yok Origin ile de işlenir; geçersiz imza 401 (403 origin değil)", async () => {
  const env = await ortam(); await ayarYaz(env, "shopier_webhook_token", "wh-token");
  const o = { id: "WH1", paymentStatus: "paid", billingInfo: { email: "alici@test.dev", firstName: "Ali" }, lineItems: [{ productId: "52547800", quantity: 1 }], totals: { total: "199.00", currency: "TRY" } };
  const body = JSON.stringify(o), imza = (await hmacHex("wh-token", body)).hex;
  const gonder = (h, b = body) => shopierIstek({ request: new Request(ORIGIN + "/api/shopier", { method: "POST", headers: { "content-type": "application/json", "shopier-event": "order.created", ...h }, body: b }), env });
  let r = await gonder({ "shopier-signature": imza, origin: "https://evil.example" }); assert.equal(r.status, 200, JSON.stringify(await r.clone().json())); assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM kod WHERE siparis = 'WH1'").get().n, 1);
  r = await gonder({ "shopier-signature": "yanlis", origin: ORIGIN }); assert.equal(r.status, 401); assert.equal((await r.json()).error, "imza");
  r = await gonder({}); assert.equal(r.status, 401, "imzasız");
  assert.ok(!readFileSync(new URL("../../functions/api/shopier.js", import.meta.url), "utf8").toLowerCase().includes("origin"), "webhook kodunda origin mantığı yok");
});

/* B) Üyelik iptali: yeni davranış */
test("abone-iptal: var olan üyelik → 200, yalnızca o kullanıcının kodları kapanır, hesap silinmez, diğer kullanıcı etkilenmez", async () => {
  const env = await ortam(); await kodVer(env, env.ogrenci.kid, "premium"); await kodVer(env, env.ogrenci.kid, "orta"); await kodVer(env, env.diger.kid, "orta");
  const hesaplar = sayim(env, "kullanici"), kodlar = sayim(env, "kod");
  const r = await ham(env, { govde: { kid: env.ogrenci.kid } }); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, kapatilan: 2 });
  assert.equal(await paketVar(env, env.ogrenci.kid), false); assert.equal(await paketVar(env, env.diger.kid), true, "diğer kullanıcı etkilenmedi");
  assert.equal(sayim(env, "kullanici"), hesaplar, "hesap silinmedi"); assert.equal(sayim(env, "kod"), kodlar, "kod kayıtları silinmez, yalnızca bağ kapanır");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM kod WHERE kid = 'silindi'").get().n, 2);
  assert.ok(env.DB.raw.prepare("SELECT id FROM kullanici WHERE id = ?").get(env.ogrenci.kid), "kullanıcı satırı duruyor");
});
test("abone-iptal: olmayan kid → 404 kullanici_yok; boş/geçersiz kid → 400; hiçbir veri değişmez", async () => {
  const env = await ortam(); await kodVer(env, env.diger.kid); const once = durumlar(env);
  let r = await ham(env, { govde: { kid: "yok-boyle-kullanici" } }); assert.equal(r.status, 404); assert.equal((await r.json()).error, "kullanici_yok");
  for (const g of [{}, { kid: "" }, { kid: "silindi" }, { kid: null }]) assert.equal((await ham(env, { govde: g })).status, 400, JSON.stringify(g));
  assert.equal((await ham(env, { hamGovde: "{bozuk" })).status, 400);
  assert.equal(durumlar(env), once);
});
test("abone-iptal: kullanıcı var ama paketi yok → 404 paket_yok; süresi dolmuş paket 'aktif' sayılmaz ve değiştirilmez", async () => {
  const env = await ortam(); await kodVer(env, env.ogrenci.kid, "orta", "2020-01-01"); const once = durumlar(env);
  let r = await ham(env, { govde: { kid: env.ogrenci.kid } }); assert.equal(r.status, 404); assert.equal((await r.json()).error, "paket_yok");
  r = await ham(env, { govde: { kid: env.diger.kid } }); assert.equal(r.status, 404); assert.equal((await r.json()).error, "paket_yok");
  assert.equal(durumlar(env), once, "hiçbir kayıt değişmedi");
});
test("abone-iptal: aynı üyeliği ikinci kez iptal → sessiz 200 yok, açık 404; sonuç tutarlı", async () => {
  const env = await ortam(); await kodVer(env, env.ogrenci.kid, "premium"); await kodVer(env, env.diger.kid, "orta");
  assert.equal((await ham(env, { govde: { kid: env.ogrenci.kid } })).status, 200);
  const r2 = await ham(env, { govde: { kid: env.ogrenci.kid } }); assert.equal(r2.status, 404); const j2 = await r2.json(); assert.equal(j2.error, "paket_yok"); assert.ok(j2.message && !j2.ok);
  assert.equal(await paketVar(env, env.diger.kid), true); assert.equal((await (await adm(env, "aboneler")).json()).aboneler.length, 1);
});
test("abone-iptal: süresiz (bitis boş) paket aktif sayılır ve iptal edilir; yarışta 0 satır değişirse 409", async () => {
  const env = await ortam(); await env.DB.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih, siparis) VALUES ('SURESIZ1234ABCD', ?, 'premium', NULL, 1, 'x')").bind(env.ogrenci.kid).run();
  assert.equal((await ham(env, { govde: { kid: env.ogrenci.kid } })).status, 200);
  await kodVer(env, env.diger.kid); const gercek = env.DB.prepare.bind(env.DB);
  env.DB.prepare = q => { const s = gercek(q); return /^UPDATE kod SET kid = 'silindi'/.test(q) ? { bind: (...a) => ({ run: async () => ({ meta: { changes: 0 } }) }) } : s; };
  const r = await ham(env, { govde: { kid: env.diger.kid } }); assert.equal(r.status, 409); assert.equal((await r.json()).error, "degismedi");
});

/* C) Regresyon: Origin kontrolü eklendikten sonra diğer yönetim işlemleri aynı çalışıyor */
test("regresyon: deneme-siparis, tekrar-gonder, siparis-tamamla ve yönetici yetkilendirmesi Origin'li istekle çalışır", async () => {
  const env = await ortam();
  let r = await ham(env, { yol: "deneme-siparis", govde: { paket: "premium-ay", eposta: "alici@test.dev" } }); const j = await r.json(); assert.equal(r.status, 200); assert.equal(j.durum, "deneme"); assert.match(j.kodlar[0].kod, /^AKE-/);
  const sid = env.DB.raw.prepare("SELECT id FROM siparis WHERE id LIKE 'deneme-%'").get().id; ag.length = 0;
  assert.equal((await ham(env, { yol: "tekrar-gonder", govde: { id: sid } })).status, 200); assert.deepEqual(JSON.parse(ag[0].body).to, ["alici@test.dev"]);
  const hamSip = { id: "R1", paymentStatus: "paid", currency: "TRY", totals: { total: "199.00" }, billingInfo: { email: "a@test.dev", firstName: "Ali" }, lineItems: [{ productId: "52547800", quantity: 1 }] };
  await env.DB.prepare("INSERT INTO siparis (id, eposta, ad, paket, anahtar, tutar, tarih, durum, ham) VALUES ('R1!kod', 'a@test.dev', '0/1', '', '', '199', ?, 'kod_uretilemedi', ?)").bind(Date.now() - 1e6, JSON.stringify(hamSip)).run();
  assert.equal((await ham(env, { yol: "siparis-tamamla", govde: { id: "R1!kod" } })).status, 200);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM kod WHERE siparis = 'R1'").get().n, 1);
  assert.equal((await cagir(env, "durum", { cookie: env.ogrenci.cookie })).status, 403); assert.equal((await cagir(env, "durum", { cookie: env.yonetici.cookie })).status, 200);
});
