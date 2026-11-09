// Shopier webhook güvenlik testleri · çalıştırma: node --test tests/shopier-webhook.test.mjs
// Gerçek veritabanı, gerçek ödeme veya ağ kullanılmaz: D1 ve fetch sahtelenir.
import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/shopier.js";
import { hmacHex, tutarOku, kabulTutarlari, tutarGecerliMi, siparisAlanlari } from "../lib/ortak.js";

const TOKEN = "test-webhook-token";
const GIZLI = "a".repeat(64);
function sahteDB() {
  const t = { siparis: [], kod: [], kullanici: [{ id: "u1", eposta: "ogrenci@ornek.com" }, { id: "adm", eposta: "alikaaneren13@gmail.com" }, { id: "u2", eposta: "baska@ornek.com" }], oturum: [], ayar: { shopier_webhook_token: TOKEN } };
  const KOL = ["id", "eposta", "ad", "paket", "anahtar", "tutar", "tarih", "durum", "ham"];
  const sonuc = (changes, extra) => Object.assign({ meta: { changes } }, extra || {});
  const calis = (sql, a) => {
    sql = sql.replace(/\s+/g, " ").trim();
    if (/^CREATE/i.test(sql)) return { first: null, all: [] };
    if (/SELECT v FROM ayar/i.test(sql)) return { first: t.ayar[a[0]] != null ? { v: t.ayar[a[0]] } : null };
    if (/^SELECT k\.id, k\.eposta, k\.ad, o\.bitis FROM oturum/i.test(sql)) { const o = t.oturum.find(x => x.hash === a[0]); const k = o && t.kullanici.find(u => u.id === o.kid); return { first: k ? { id: k.id, eposta: k.eposta, ad: "", bitis: Date.now() + 1e6 } : null }; }
    if (/^SELECT s\.id, s\.paket, s\.anahtar, s\.durum, k\.bitis FROM siparis s LEFT JOIN kod k/i.test(sql)) {
      const l = t.siparis.filter(r => r.id === a[0] || (r.id.startsWith(a[0] + "#"))).map(r => ({ id: r.id, paket: r.paket || "", anahtar: r.anahtar || "", durum: r.durum, bitis: (t.kod.find(k => k.anahtar === r.anahtar) || {}).bitis || null }));
      return { all: l };
    }
    if (/^SELECT id FROM siparis WHERE id = \?$/i.test(sql)) return { first: t.siparis.find(r => r.id === a[0]) ? { id: a[0] } : null };
    if (/^SELECT id, durum, tarih, ham FROM siparis WHERE id = \?/i.test(sql)) return { first: t.siparis.find(r => r.id === a[0]) || null };
    if (/SELECT id FROM kullanici WHERE eposta/i.test(sql)) return { first: t.kullanici.find(u => u.eposta === a[0]) || null };
    if (/^INSERT INTO kod/i.test(sql)) { if (t.kod.some(k => k.anahtar === a[0])) throw new Error("UNIQUE kod"); t.kod.push({ anahtar: a[0], kid: a[1], plan: a[2], bitis: a[3], siparis: a[5] }); return sonuc(1); }
    if (/^INSERT (OR IGNORE )?INTO siparis/i.test(sql)) {
      const ign = /OR IGNORE/i.test(sql), jet = sql.match(/VALUES \((.*)\)$/i)[1].split(",").map(x => x.trim()); let k = 0; const r = {};
      jet.forEach((tok, i) => { r[KOL[i]] = tok === "?" ? a[k++] : tok.replace(/^'|'$/g, ""); });
      if (t.siparis.some(x => x.id === r.id)) { if (ign) return sonuc(0); throw new Error("UNIQUE siparis"); }
      t.siparis.push(r); return sonuc(1);
    }
    let m;
    if ((m = sql.match(/^UPDATE siparis SET durum = \? WHERE id = \?$/i))) { const r = t.siparis.find(x => x.id === a[1]); if (r) r.durum = a[0]; return sonuc(r ? 1 : 0); }
    if (/^UPDATE siparis SET durum = 'eposta_yok' WHERE id = \? AND durum = \?$/i.test(sql)) { const r = t.siparis.find(x => x.id === a[0] && x.durum === a[1]); if (r) r.durum = "eposta_yok"; return sonuc(r ? 1 : 0); }
    if (/^UPDATE siparis SET durum = 'gonderiliyor' WHERE id = \? AND durum = 'kod_uretildi'$/i.test(sql)) { const r = t.siparis.find(x => x.id === a[0] && x.durum === "kod_uretildi"); if (r) r.durum = "gonderiliyor"; return sonuc(r ? 1 : 0); }
    if (/^UPDATE siparis SET tarih = \?, ad = \? WHERE id = \? AND durum = 'kod_bekliyor'$/i.test(sql)) { const r = t.siparis.find(x => x.id === a[2] && x.durum === "kod_bekliyor"); if (r) { r.tarih = a[0]; r.ad = a[1]; } return sonuc(r ? 1 : 0); }
    if (/^UPDATE siparis SET durum = 'kod_uretilemedi', ad = \? WHERE id = \? AND durum != 'kod_uretilemedi'$/i.test(sql)) { const r = t.siparis.find(x => x.id === a[1] && x.durum !== "kod_uretilemedi"); if (r) { r.durum = "kod_uretilemedi"; r.ad = a[0]; } return sonuc(r ? 1 : 0); }
    if (/^UPDATE siparis SET durum = 'kod_hatasi_cozuldu' WHERE id = \? AND durum = 'kod_uretilemedi'$/i.test(sql)) { const r = t.siparis.find(x => x.id === a[0] && x.durum === "kod_uretilemedi"); if (r) r.durum = "kod_hatasi_cozuldu"; return sonuc(r ? 1 : 0); }
    if (/^DELETE FROM siparis WHERE id = \? AND durum = 'kod_bekliyor'$/i.test(sql)) { const n = t.siparis.length; t.siparis = t.siparis.filter(x => !(x.id === a[0] && x.durum === "kod_bekliyor")); return sonuc(n - t.siparis.length); }
    if (/^SELECT .* FROM siparis/i.test(sql) || /^SELECT COUNT/i.test(sql)) return { first: { n: 0 }, all: [] };
    throw new Error("sahte DB: tanımsız sorgu: " + sql.slice(0, 120));
  };
  const bekle = async () => { const n = db.jitter ? db.jitter() : 0; for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };
  const prep = sql => { let a = []; const o = { bind: (...x) => { a = x; return o; }, first: async () => { await bekle(); return calis(sql, a).first ?? null; }, run: async () => { await bekle(); return calis(sql, a); }, all: async () => { await bekle(); return { results: calis(sql, a).all || [] }; }, _x: () => calis(sql, a) }; return o; };
  const db = { t, prepare: prep, batch: async l => { await bekle(); const kopya = JSON.stringify(t); try { l.forEach(x => x._x()); } catch (e) { const y = JSON.parse(kopya); Object.assign(t, y); throw e; } return []; } };
  return db;
}
const env = () => ({ DB: sahteDB(), AKE_GIZLI: GIZLI, RESEND_API_KEY: "" });
async function gonder(e, govde, { imza, event = "order.created", method = "POST" } = {}) {
  const ham = typeof govde === "string" ? govde : JSON.stringify(govde);
  const h = { "content-type": "application/json", "shopier-event": event };
  const s = imza === undefined ? (await hmacHex(TOKEN, ham)).hex : imza; if (s) h["shopier-signature"] = s;
  const r = await onRequest({ request: new Request("https://x.test/api/shopier", { method, headers: h, body: method === "POST" ? ham : undefined }), env: e });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
const siparis = (x = {}) => ({ id: "S100", paymentStatus: "paid", billingInfo: { email: "ogrenci@ornek.com", firstName: "Ali" }, lineItems: [{ productId: "52547800", title: "AKE Atılım 1 ay", quantity: 1 }], totals: { total: "199.00", currency: "TRY" }, ...x });

test("geçerli imza + paid + doğru ürün/tutar: kod üretilir ve hesaba bağlanır", async () => {
  const e = env(); const r = await gonder(e, siparis());
  assert.equal(r.status, 200); assert.ok(e.DB.t.kod.length === 1); assert.equal(e.DB.t.kod[0].plan, "orta"); assert.equal(e.DB.t.kod[0].kid, "u1");
});
test("premium yıllık liste fiyatıyla (4389 TL) geçerli", async () => {
  const e = env(); const r = await gonder(e, siparis({ id: "S101", lineItems: [{ productId: "52547986", quantity: 1 }], totals: { total: "4.389,00", currency: "TRY" } }));
  assert.equal(r.status, 200); assert.equal(e.DB.t.kod.length, 1); assert.equal(e.DB.t.kod[0].plan, "premium");
});
test("indirim: yalnızca sunucuda tanımlı (AKE_INDIRIMLI) tutar kabul edilir; bildirimdeki indirim alanına güvenilmez", async () => {
  let e = env(); e.AKE_INDIRIMLI = "premium-yil:3511.20"; let r = await gonder(e, siparis({ id: "D1", lineItems: [{ productId: "52547986", quantity: 1 }], totals: { total: "3.511,20", currency: "TRY" } }));
  assert.equal(e.DB.t.kod.length, 1, JSON.stringify(r));
  e = env(); r = await gonder(e, siparis({ id: "D2", discount: { total: "877.80", valid: true }, discountTotal: "877.80", lineItems: [{ productId: "52547986", quantity: 1 }], totals: { total: "3.511,20", currency: "TRY" } }));
  assert.equal(r.j.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 0);
});
test("`data` içinde sarılı geçerli sipariş de işlenir", async () => {
  const e = env(); await gonder(e, { data: siparis({ id: "S102" }) }); assert.equal(e.DB.t.kod.length, 1);
});
test("geçersiz imza: 401, kod yok", async () => {
  const e = env(); const r = await gonder(e, siparis(), { imza: "00ff" }); assert.equal(r.status, 401); assert.equal(e.DB.t.kod.length, 0);
});
test("imza başlığı yok: 401", async () => {
  const e = env(); const r = await gonder(e, siparis(), { imza: "" }); assert.equal(r.status, 401); assert.equal(e.DB.t.kod.length, 0);
});
test("imza başka gövdeye ait (gövde değiştirilmiş): 401", async () => {
  const e = env(); const imza = (await hmacHex(TOKEN, JSON.stringify(siparis({ totals: { total: "399" } })))).hex; const r = await gonder(e, siparis(), { imza }); assert.equal(r.status, 401); assert.equal(e.DB.t.kod.length, 0);
});
test("webhook token kurulu değil: 503, kod yok", async () => {
  const e = env(); delete e.DB.t.ayar.shopier_webhook_token; const r = await gonder(e, siparis()); assert.equal(r.status, 503); assert.equal(e.DB.t.kod.length, 0);
});
test("GET isteği: 405", async () => { const r = await gonder(env(), siparis(), { method: "GET" }); assert.equal(r.status, 405); });
test("başarısız ödeme (paymentStatus=failed/pending): kod yok", async () => {
  for (const st of ["failed", "pending", "refunded", "cancelled", "PAID_NOT"]) { const e = env(); const r = await gonder(e, siparis({ id: "F" + st, paymentStatus: st })); assert.equal(r.j.durum, "odenmedi", st); assert.equal(e.DB.t.kod.length, 0, st); }
});
test("ödeme durumu EKSİK: kod üretilmez, denetim kaydı düşer (PAT yok)", async () => {
  const e = env(); const o = siparis({ id: "M1" }); delete o.paymentStatus; const r = await gonder(e, o);
  assert.equal(r.status, 200); assert.equal(r.j.durum, "odeme_dogrulanamadi"); assert.equal(e.DB.t.kod.length, 0); assert.ok(e.DB.t.siparis.some(s => s.id === "M1!odeme"));
});
test("ödeme durumu boş metin / null: kod yok", async () => {
  for (const v of ["", null, "  "]) { const e = env(); const r = await gonder(e, siparis({ id: "N" + String(v), paymentStatus: v })); assert.equal(r.j.durum, "odeme_dogrulanamadi"); assert.equal(e.DB.t.kod.length, 0); }
});
test("SHOPIER_PAT tanımlı olsa bile Shopier API çağrılmaz (uç nokta doğrulanmadı); durum eksikse kod yok", async () => {
  const e = env(); e.SHOPIER_PAT = "pat"; const eski = globalThis.fetch; let cagri = 0; globalThis.fetch = async () => { cagri++; return new Response("{}"); };
  try { const o = siparis({ id: "M2" }); delete o.paymentStatus; const r = await gonder(e, o); assert.equal(r.j.durum, "odeme_dogrulanamadi"); assert.equal(e.DB.t.kod.length, 0); assert.equal(cagri, 0); } finally { globalThis.fetch = eski; }
});
test("doğrulanamayan sipariş sonradan geçerli (paid) gelirse yine işlenir (mükerrer sayılmaz)", async () => {
  const e = env(); const o = siparis({ id: "L1" }); delete o.paymentStatus; await gonder(e, o);
  const r = await gonder(e, siparis({ id: "L1" })); assert.equal(e.DB.t.kod.length, 1, JSON.stringify(r));
});
test("eksik zorunlu alan: id yok → kod yok; lineItems yok / tanınmayan ürün → kod yok", async () => {
  let e = env(); let o = siparis(); delete o.id; let r = await gonder(e, o); assert.equal(r.j.durum, "kimliksiz"); assert.equal(e.DB.t.kod.length, 0);
  e = env(); r = await gonder(e, siparis({ id: "P1", lineItems: [] })); assert.equal(e.DB.t.kod.length, 0);
  e = env(); r = await gonder(e, siparis({ id: "P2", lineItems: [{ productId: "999", title: "Başka ürün" }] })); assert.equal(e.DB.t.kod.length, 0);
});
test("gövde JSON değil / dizi / aşırı büyük: kod yok", async () => {
  let e = env(); let r = await gonder(e, "bu json degil"); assert.equal(r.status, 400);
  r = await gonder(e, "[1,2]"); assert.equal(r.status, 400);
  r = await gonder(e, JSON.stringify({ id: "B", x: "a".repeat(210000) })); assert.equal(r.status, 413); assert.equal(e.DB.t.kod.length, 0);
});
test("tekrar eden sipariş: ikinci teslimde yeni kod üretilmez", async () => {
  const e = env(); await gonder(e, siparis()); const r = await gonder(e, siparis()); assert.equal(r.j.durum, "zaten"); assert.equal(e.DB.t.kod.length, 1);
});
test("tutar: %50 tolerans YOK; liste fiyatından 1 kuruş bile farklıysa kod yok + denetim kaydı", async () => {
  for (const [id, tutar] of [["T1", "0"], ["T2", "1.00"], ["T3", "99"], ["T4", "198.99"], ["T5", "199.01"], ["T6", "100"], ["T7", "399"]]) { const e = env(); const r = await gonder(e, siparis({ id, totals: { total: tutar, currency: "TRY" } })); assert.equal(r.j.durum, "tutar_uyusmuyor", id); assert.equal(e.DB.t.kod.length, 0, id); assert.ok(e.DB.t.siparis.some(s => s.id === id + "!tutar")); }
});
test("para birimi: USD/EUR/boş/yok → kod yok; TRY ve TL kabul", async () => {
  for (const c of ["USD", "EUR", "", "XYZ"]) { const e = env(); const r = await gonder(e, siparis({ id: "C" + c, totals: { total: "199.00", currency: c } })); assert.equal(r.j.durum, "para_dogrulanamadi", c); assert.equal(e.DB.t.kod.length, 0); }
  let e = env(); const o = siparis({ id: "CYOK" }); delete o.totals.currency; let r = await gonder(e, o); assert.equal(r.j.durum, "para_dogrulanamadi"); assert.equal(e.DB.t.kod.length, 0);
  e = env(); await gonder(e, siparis({ id: "CTL", totals: { total: "199", currency: "tl" } })); assert.equal(e.DB.t.kod.length, 1);
  e = env(); await gonder(e, siparis({ id: "CTRY", currency: "TRY", totals: { total: "199" } })); assert.equal(e.DB.t.kod.length, 1);
});
test("tutar alanı yok/okunamıyor → kod yok (kesin doğrulanamaz)", async () => {
  for (const [id, t] of [["TA", undefined], ["TB", "abc"], ["TC", ""]]) { const e = env(); const o = siparis({ id }); o.totals = { currency: "TRY" }; if (t !== undefined) o.totals.total = t; const r = await gonder(e, o); assert.equal(r.j.durum, "tutar_uyusmuyor", id); assert.equal(e.DB.t.kod.length, 0); }
});
test("farklı olay (refund.updated): kod üretilmez", async () => {
  const e = env(); const r = await gonder(e, siparis({ id: "R1" }), { event: "refund.updated" }); assert.equal(e.DB.t.kod.length, 0); assert.ok(r.j.yok_sayildi);
});
test("çok adetli sipariş: miktar × fiyat kesin eşleşmeli", async () => {
  let e = env(); let r = await gonder(e, siparis({ id: "Q1", lineItems: [{ productId: "52547800", quantity: 3 }], totals: { total: "597", currency: "TRY" } })); assert.equal(e.DB.t.kod.length, 3, JSON.stringify(r));
  e = env(); r = await gonder(e, siparis({ id: "Q2", lineItems: [{ productId: "52547800", quantity: 3 }], totals: { total: "199", currency: "TRY" } })); assert.equal(r.j.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 0);
  e = env(); r = await gonder(e, siparis({ id: "Q3", lineItems: [{ productId: "52547800", quantity: 2 }, { productId: "52547968", quantity: 1 }], totals: { total: "797", currency: "TRY" } })); assert.equal(e.DB.t.kod.length, 3, JSON.stringify(r));
  e = env(); r = await gonder(e, siparis({ id: "Q4", lineItems: [{ productId: "52547800", quantity: 1 }, { productId: "52547968", quantity: 1 }], totals: { total: "199", currency: "TRY" } })); assert.equal(r.j.durum, "tutar_uyusmuyor");
});
test("ürün–paket eşleşmesi: bilinen ürün kimliği doğru plana gider, tutar başka pakete aitse reddedilir", async () => {
  const e = env(); const r = await gonder(e, siparis({ id: "U1", lineItems: [{ productId: "52547968", quantity: 1 }], totals: { total: "199", currency: "TRY" } })); assert.equal(r.j.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 0);
});
test("yardımcılar: tutar ayrıştırma, kabul tutarları, alan eşlemesi", () => {
  assert.equal(tutarOku("199,00"), 199); assert.equal(tutarOku("1.234,50"), 1234.5); assert.equal(tutarOku("2,189"), 2189); assert.ok(Number.isNaN(tutarOku("")));
  assert.deepEqual(kabulTutarlari({}, "orta-ay"), [199]); assert.deepEqual(kabulTutarlari({ AKE_FIYATLAR: "orta-ay:249", AKE_INDIRIMLI: "orta-ay:199.5|150" }, "orta-ay"), [249, 199.5, 150]);
  assert.ok(tutarGecerliMi({}, ["orta-ay", "premium-yil"], 199 + 4389)); assert.ok(!tutarGecerliMi({}, ["orta-ay"], NaN));
  assert.deepEqual(siparisAlanlari({ paymentStatus: " PAID ", totals: { total: "1,5", currency: "try" } }), { durum: "paid", para: "TRY", toplam: 1.5 });
});
test("yönetici deneme siparişi (deneme=true, 0 TL) çalışmaya devam eder", async () => {
  const { siparisIsle } = await import("../lib/ortak.js"); const e = env();
  const r = await siparisIsle(e, { id: "deneme-1", paymentStatus: "paid", billingInfo: { email: "yonetici@ornek.com" }, lineItems: [{ productId: "52547800", quantity: 1 }], totals: { total: "0" } }, true);
  assert.notEqual(r.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 1);
});

// ---- GERÇEK Shopier bildirimi (9 Kasım 2026, 199 TL Atılım 1 ay; kişisel veriler silindi, e-posta yer tutucu) ----
const GERCEK = () => ({"id":"100000001","status":"unfulfilled","paymentStatus":"paid","installments":false,"dateCreated":"2026-11-09T21:24:50+0300","currency":"TRY","paymentMethod":"creditCard","totals":{"subtotal":"199.00","shipping":"0.00","discount":"0.00","total":"199.00"},"discounts":[],"shippingInfo":{"firstName":"","lastName":"Test","nationalId":"","email":"ogrenci@ornek.com","phone":"","company":"","address":"Dijital ürün","district":"","city":"","state":"","postcode":"","country":"Türkiye"},"billingInfo":{},"note":"","lineItems":[{"productId":"52547800","title":"AKE Akademi Atılım Paket – 1 Ay","type":"digital","selection":[],"options":[],"quantity":1,"price":"199.00","total":"199.00"}],"fulfillments":[],"returns":[],"refunds":[]});
test("GERÇEK örnek yük: kod üretilir (billingInfo boş, e-posta shippingInfo'da)", async () => {
  const e = env(); const r = await gonder(e, GERCEK());
  assert.equal(r.status, 200); assert.equal(e.DB.t.kod.length, 1); assert.equal(e.DB.t.kod[0].plan, "orta");
});
test("GERÇEK örnek yük: alan okuma (durum/para/tutar)", () => {
  assert.deepEqual(siparisAlanlari(GERCEK()), { durum: "paid", para: "TRY", toplam: 199 });
});
test("GERÇEK yük, tutar 1 TL'ye oynanmış: kod yok", async () => {
  const e = env(); const o = GERCEK(); o.totals.total = "1.00"; const r = await gonder(e, o); assert.equal(r.j.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 0);
});
test("GERÇEK yük, aynı sipariş ikinci kez: tekrar kod yok", async () => {
  const e = env(); await gonder(e, GERCEK()); await gonder(e, GERCEK()); assert.equal(e.DB.t.kod.length, 1);
});

// ---- Yönetici uyarısı, "inceleme bekliyor" kaydı ve kod üretim hatası ----
function resendIzle() { const eski = globalThis.fetch, cagrilar = []; globalThis.fetch = async (u, i) => { cagrilar.push({ u: String(u), b: JSON.parse(i.body) }); return new Response("{}", { status: 200 }); }; return { cagrilar, bitir: () => { globalThis.fetch = eski; } }; }
const durumYok = (x = {}) => { const o = GERCEK(); delete o.paymentStatus; return Object.assign(o, x); };
test("doğrulanamayan sipariş: kod yok, 'inceleme' kaydı + yöneticiye tek uyarı e-postası (müşteri verisi/ham yük yok)", async () => {
  const e = env(); e.RESEND_API_KEY = "re_test"; const iz = resendIzle();
  try {
    const r = await gonder(e, durumYok()); assert.equal(r.j.durum, "odeme_dogrulanamadi"); assert.equal(e.DB.t.kod.length, 0);
    assert.ok(e.DB.t.siparis.some(x => x.id === "100000001!odeme" && x.durum === "odeme_dogrulanamadi"));
    assert.equal(iz.cagrilar.length, 1); const m = iz.cagrilar[0].b;
    assert.deepEqual(m.to, ["alikaaneren13@gmail.com"]); assert.match(m.subject, /İnceleme bekliyor/); assert.match(m.text, /100000001/);
    assert.ok(!/ogrenci@ornek\.com|AKE-/.test(m.text + m.html), "uyarıda müşteri e-postası veya kod olmamalı");
    await gonder(e, durumYok()); assert.equal(iz.cagrilar.length, 1, "Shopier tekrar denemesinde ikinci uyarı gitmemeli");
  } finally { iz.bitir(); }
});
test("tutar uyuşmuyor / para birimi: kayıt + uyarı, kod yok", async () => {
  const e = env(); e.RESEND_API_KEY = "re_test"; const iz = resendIzle();
  try {
    const o = GERCEK(); o.totals.total = "99.00"; await gonder(e, o);
    const u = GERCEK(); u.id = "100000002"; u.currency = "USD"; await gonder(e, u);
    assert.equal(e.DB.t.kod.length, 0); assert.equal(iz.cagrilar.length, 2);
    assert.ok(e.DB.t.siparis.some(x => x.id === "100000001!tutar") && e.DB.t.siparis.some(x => x.id === "100000002!tutar"));
  } finally { iz.bitir(); }
});
test("e-posta altyapısı (RESEND_API_KEY) yoksa uyarı atlanır, webhook yine 200 ve kod yok (panel yeterli)", async () => {
  const e = env(); const iz = resendIzle();
  try { const r = await gonder(e, durumYok()); assert.equal(r.status, 200); assert.equal(iz.cagrilar.length, 0); assert.equal(e.DB.t.kod.length, 0); assert.ok(e.DB.t.siparis.some(x => x.id === "100000001!odeme")); } finally { iz.bitir(); }
});
test("e-posta servisi çökse bile uyarı webhook'u bozmaz", async () => {
  const e = env(); e.RESEND_API_KEY = "re_test"; const eski = globalThis.fetch; globalThis.fetch = async () => { throw new Error("ağ"); };
  try { const r = await gonder(e, durumYok()); assert.equal(r.status, 200); assert.equal(e.DB.t.kod.length, 0); } finally { globalThis.fetch = eski; }
});
test("ödeme DOĞRULANDI ama kod üretimi başarısız: ayrı 'kod_uretilemedi' kaydı + uyarı, 500 (Shopier tekrar dener); tekrarda çözülür", async () => {
  const e = env(); e.RESEND_API_KEY = "re_test"; const iz = resendIzle(); const gercekBatch = e.DB.batch;
  try {
    e.DB.batch = async () => { throw new Error("d1 hata"); };
    const r = await gonder(e, GERCEK()); assert.equal(r.status, 500); assert.equal(e.DB.t.kod.length, 0);
    assert.ok(e.DB.t.siparis.some(x => x.id === "100000001!kod" && x.durum === "kod_uretilemedi")); assert.equal(iz.cagrilar.length, 1); assert.match(iz.cagrilar[0].b.subject, /kod üretilemedi/);
    await gonder(e, GERCEK()); assert.equal(iz.cagrilar.length, 1, "aynı hata için ikinci uyarı yok");
    e.DB.batch = gercekBatch; iz.cagrilar.length = 0;
    const r2 = await gonder(e, GERCEK()); assert.equal(r2.status, 200); assert.equal(e.DB.t.kod.length, 1);
    assert.equal(e.DB.t.siparis.find(x => x.id === "100000001!kod").durum, "kod_hatasi_cozuldu");
  } finally { iz.bitir(); }
});
test("indirimli sipariş (sunucuda tanımsız) ve iade/yinelenen olay: mevcut güvenli davranış korunur", async () => {
  const e = env(); const o = GERCEK(); o.totals.discount = "19.90"; o.totals.total = "179.10"; o.discounts = [{ code: "X", amount: "19.90" }]; const r = await gonder(e, o);
  assert.equal(r.j.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 0);
  const r2 = await gonder(e, GERCEK(), { event: "refund.updated" }); assert.equal(r2.j.yok_sayildi, "refund.updated"); assert.equal(e.DB.t.kod.length, 0);
});

// ---- Çoklu kalem, kısmi hata, eşzamanlılık, yönetici tamamlama ----
const COKLU = (adet = 3, id = "100000009") => { const o = GERCEK(); o.id = id; o.totals = { subtotal: "", shipping: "0.00", discount: "0.00", total: (199 * adet).toFixed(2) }; o.lineItems[0].quantity = adet; return o; };
const KODRE = /AKE-(\w{4}-){3}\w{4}/g;
const epostalardaKodlar = iz => iz.cagrilar.flatMap(c => (c.b.text.match(KODRE) || []));
const kodTekil = e => new Set(e.DB.t.kod.map(k => k.anahtar)).size === e.DB.t.kod.length;
async function bekle() { await new Promise(r => setTimeout(r, 0)); }

test("çoklu adet (3): her kalem ayrı satır ve ayrı kod; tek e-postada 3 kod", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle();
  try {
    const r = await gonder(e, COKLU(3)); assert.equal(r.status, 200);
    assert.deepEqual(e.DB.t.siparis.filter(s => s.id.startsWith("100000009")).map(s => s.id).sort(), ["100000009#1", "100000009#2", "100000009#3"]);
    assert.ok(e.DB.t.siparis.every(s => s.durum === "gonderildi")); assert.equal(e.DB.t.kod.length, 3); assert.ok(kodTekil(e));
    assert.equal(iz.cagrilar.length, 1); assert.equal(epostalardaKodlar(iz).length, 3);
    assert.ok(!e.DB.t.siparis.some(s => s.id.endsWith("!kod")), "sorunsuz siparişte işaret kalmamalı");
  } finally { iz.bitir(); }
});
test("tamamlanmış siparişin tekrar gelmesi: yeni kod yok, ikinci e-posta yok", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle();
  try { await gonder(e, COKLU(2)); const r = await gonder(e, COKLU(2)); assert.equal(r.j.durum, "zaten"); assert.equal(e.DB.t.kod.length, 2); assert.equal(iz.cagrilar.length, 1); } finally { iz.bitir(); }
});
test("EŞZAMANLI 4 aynı bildirim (tek kalem): tek kod, tek e-posta", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle();
  try { await Promise.all([1, 2, 3, 4].map(() => gonder(e, GERCEK()))); assert.equal(e.DB.t.kod.length, 1); assert.equal(iz.cagrilar.length, 1); assert.equal(epostalardaKodlar(iz).length, 1); } finally { iz.bitir(); }
});
test("EŞZAMANLI 4 aynı bildirim (3 kalem): tam 3 kod, her kod tam bir kez e-postalanır", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle();
  try {
    const rs = await Promise.all([1, 2, 3, 4].map(() => gonder(e, COKLU(3)))); rs.forEach(r => assert.equal(r.status, 200));
    assert.equal(e.DB.t.kod.length, 3); assert.ok(kodTekil(e));
    const g = epostalardaKodlar(iz); assert.equal(g.length, 3); assert.equal(new Set(g).size, 3);
    assert.ok(e.DB.t.siparis.filter(s => /#\d$/.test(s.id)).every(s => s.durum === "gonderildi")); assert.ok(!e.DB.t.siparis.some(s => s.id.endsWith("!kod")));
  } finally { iz.bitir(); }
});
test("KISMİ HATA (3 kalemden 2.'de D1 hatası): hazır kalem korunur, işaret 'kod_uretilemedi' (1/3), yönetici uyarılır, 500", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle(); const gercek = e.DB.batch; let n = 0;
  try {
    e.DB.batch = async l => { n++; if (n >= 2) throw new Error("d1"); return gercek(l); };
    const r = await gonder(e, COKLU(3)); assert.equal(r.status, 500);
    assert.equal(e.DB.t.kod.length, 1); assert.ok(e.DB.t.siparis.some(s => s.id === "100000009#1" && s.durum === "kod_uretildi"));
    const isaret = e.DB.t.siparis.find(s => s.id === "100000009!kod"); assert.equal(isaret.durum, "kod_uretilemedi"); assert.equal(isaret.ad, "1/3 kod hazır");
    assert.equal(iz.cagrilar.length, 1); assert.match(iz.cagrilar[0].b.subject, /kod üretilemedi/); assert.equal(epostalardaKodlar(iz).length, 0, "uyarıda kod yok, müşteriye kod e-postası henüz gitmedi");
  } finally { iz.bitir(); }
});
test("KISMİ HATA sonrası TOPARLANMA: eksikler tamamlanır, 1. kodun anahtarı değişmez, hiçbir kod tekrarlanmaz, e-postada 3 kod bir kez", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle(); const gercek = e.DB.batch; let n = 0;
  try {
    e.DB.batch = async l => { n++; if (n >= 2) throw new Error("d1"); return gercek(l); };
    await gonder(e, COKLU(3)); const ilk = e.DB.t.kod[0].anahtar;
    e.DB.batch = gercek; iz.cagrilar.length = 0;
    const r = await gonder(e, COKLU(3)); assert.equal(r.status, 200);
    assert.equal(e.DB.t.kod.length, 3); assert.ok(kodTekil(e)); assert.equal(e.DB.t.kod[0].anahtar, ilk);
    assert.equal(epostalardaKodlar(iz).length, 3); assert.equal(iz.cagrilar.length, 1);
    assert.equal(e.DB.t.siparis.find(s => s.id === "100000009!kod").durum, "kod_hatasi_cozuldu");
    assert.ok(e.DB.t.siparis.filter(s => /#\d$/.test(s.id)).every(s => s.durum === "gonderildi"));
    iz.cagrilar.length = 0; await gonder(e, COKLU(3)); assert.equal(iz.cagrilar.length, 0); assert.equal(e.DB.t.kod.length, 3);
  } finally { iz.bitir(); }
});
test("KISMİ HATA sonrası EŞZAMANLI tekrar denemeler: 3 kod, tekrar yok, her kod bir kez e-postalanır", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle(); const gercek = e.DB.batch; let n = 0;
  try {
    e.DB.batch = async l => { n++; if (n >= 2) throw new Error("d1"); return gercek(l); }; await gonder(e, COKLU(3));
    e.DB.batch = gercek; iz.cagrilar.length = 0;
    await Promise.all([1, 2, 3].map(() => gonder(e, COKLU(3))));
    assert.equal(e.DB.t.kod.length, 3); assert.ok(kodTekil(e)); const g = epostalardaKodlar(iz); assert.equal(g.length, 3); assert.equal(new Set(g).size, 3);
  } finally { iz.bitir(); }
});
test("geçici D1 hatası (aynı istekte yeniden deneme): kod üretilir, işaret kalmaz, uyarı yok", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const iz = resendIzle(); const gercek = e.DB.batch; let n = 0;
  try { e.DB.batch = async l => { n++; if (n === 1) throw new Error("kod çakışması"); return gercek(l); }; const r = await gonder(e, GERCEK()); assert.equal(r.status, 200); assert.equal(e.DB.t.kod.length, 1); assert.ok(!e.DB.t.siparis.some(s => s.id.endsWith("!kod"))); assert.equal(iz.cagrilar.length, 1); } finally { iz.bitir(); }
});
test("e-posta gönderimi ortasında çökme: satır 'gonderiliyor'da kalır, tekrar bildirim çift e-posta/kod üretmez", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; const eski = globalThis.fetch; globalThis.fetch = () => { throw new Error("süreç çöktü"); };
  try { const r = await gonder(e, GERCEK()); assert.equal(r.status, 500); assert.equal(e.DB.t.siparis.find(s => s.id === "100000001").durum, "gonderiliyor"); } finally { globalThis.fetch = eski; }
  const iz = resendIzle(); try { const r2 = await gonder(e, GERCEK()); assert.equal(r2.j.durum, "zaten"); assert.equal(iz.cagrilar.length, 0); assert.equal(e.DB.t.kod.length, 1); } finally { iz.bitir(); }
});
test("ödeme/tutar doğrulaması kısmi-hata toparlamasında da geçerli: tutarı değiştirilmiş tekrar kod üretmez", async () => {
  const e = env(); const gercek = e.DB.batch; let n = 0;
  e.DB.batch = async l => { n++; if (n >= 2) throw new Error("d1"); return gercek(l); }; await gonder(e, COKLU(3)); e.DB.batch = gercek;
  const o = COKLU(3); o.totals.total = "199.00"; const r = await gonder(e, o); assert.equal(r.j.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 1);
});

// ---- Yönetici paneli: eksik kodları güvenle tamamlama ----
import { sha256 } from "../lib/ortak.js";
const yonetim = await import("../functions/api/yonetim/[[yol]].js");
async function yon(e, govde, { kid = "adm", yol = "siparis-tamamla" } = {}) {
  const tok = "t".repeat(48) + kid; e.DB.t.oturum.push({ hash: await sha256(tok), kid });
  const r = await yonetim.onRequest({ request: new Request("https://x.test/api/yonetim/" + yol, { method: "POST", headers: { cookie: "ake_s=" + tok, "content-type": "application/json" }, body: JSON.stringify(govde) }), env: e, params: { yol: [yol] } });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
async function yarimSiparis(e, adet = 3) { const gercek = e.DB.batch; let n = 0; e.DB.batch = async l => { n++; if (n >= 2) throw new Error("d1"); return gercek(l); }; await gonder(e, COKLU(adet)); e.DB.batch = gercek; }
test("yönetici 'Eksik kodları tamamla': yetkili yönetici eksik kodları tamamlar, çift kod yok", async () => {
  const e = env(); e.RESEND_API_KEY = "re_t"; await yarimSiparis(e); const iz = resendIzle();
  try { const r = await yon(e, { id: "100000009!kod" }); assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(e.DB.t.kod.length, 3); assert.ok(kodTekil(e)); assert.equal(epostalardaKodlar(iz).length, 3); assert.equal(e.DB.t.siparis.find(s => s.id === "100000009!kod").durum, "kod_hatasi_cozuldu");
    const r2 = await yon(e, { id: "100000009!kod" }); assert.equal(r2.status, 404); assert.equal(e.DB.t.kod.length, 3); } finally { iz.bitir(); }
});
test("yönetici tamamlama: yönetici olmayan 403; geçersiz kimlik 400; kayıt yok 404", async () => {
  const e = env(); await yarimSiparis(e);
  assert.equal((await yon(e, { id: "100000009!kod" }, { kid: "u2" })).status, 403); assert.equal(e.DB.t.kod.length, 1);
  assert.equal((await yon(e, { id: "../x" })).status, 400); assert.equal((await yon(e, { id: "yok!kod" })).status, 404); assert.equal((await yon(e, { id: "100000009#1" })).status, 400);
});
test("yönetici tamamlama: yarım kalmış (kod_bekliyor) kayıt 2 dakikadan yeniyse 409, eskiyse tamamlanır", async () => {
  const e = env(); await yarimSiparis(e); const m = e.DB.t.siparis.find(s => s.id === "100000009!kod"); m.durum = "kod_bekliyor"; m.tarih = Date.now();
  assert.equal((await yon(e, { id: "100000009!kod" })).status, 409); assert.equal(e.DB.t.kod.length, 1);
  m.tarih = Date.now() - 600000; const r = await yon(e, { id: "100000009!kod" }); assert.equal(r.status, 200); assert.equal(e.DB.t.kod.length, 3);
});
test("yönetici tamamlama sipariş doğrulamasını atlatamaz: kayıtlı yük değiştirilmişse (tutar/ödeme) kod üretilmez", async () => {
  const e = env(); await yarimSiparis(e); const m = e.DB.t.siparis.find(s => s.id === "100000009!kod");
  const o = JSON.parse(m.ham); o.totals.total = "1.00"; m.ham = JSON.stringify(o); let r = await yon(e, { id: "100000009!kod" }); assert.equal(r.j.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 1);
  const o2 = JSON.parse(m.ham); o2.totals.total = "597.00"; o2.paymentStatus = "pending"; m.ham = JSON.stringify(o2); r = await yon(e, { id: "100000009!kod" }); assert.equal(r.j.durum, "odenmedi"); assert.equal(e.DB.t.kod.length, 1);
  m.ham = "{bozuk"; r = await yon(e, { id: "100000009!kod" }); assert.equal(r.status, 422); assert.equal(e.DB.t.kod.length, 1);
});

test("EŞZAMANLILIK (rastgele gecikmeli, 60 tur): kod sayısı hep kalem sayısı, kodlar tekil, her kod en çok bir kez e-postalanır", async () => {
  let tohum = 12345; const rnd = () => (tohum = (tohum * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let tur = 0; tur < 60; tur++) {
    const e = env(); e.RESEND_API_KEY = "re_t"; e.DB.jitter = () => Math.floor(rnd() * 3); const iz = resendIzle(); const adet = 1 + (tur % 3);
    try {
      const rs = await Promise.all([1, 2, 3, 4, 5].map(() => gonder(e, COKLU(adet, "J" + tur)))); rs.forEach(r => assert.ok(r.status === 200, "tur " + tur));
      assert.equal(e.DB.t.kod.length, adet, "tur " + tur); assert.ok(kodTekil(e)); const g = epostalardaKodlar(iz); assert.equal(g.length, adet, "tur " + tur); assert.equal(new Set(g).size, adet);
    } finally { iz.bitir(); }
  }
});
