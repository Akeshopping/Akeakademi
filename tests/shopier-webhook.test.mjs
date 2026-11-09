// Shopier webhook güvenlik testleri · çalıştırma: node --test tests/shopier-webhook.test.mjs
// Gerçek veritabanı, gerçek ödeme veya ağ kullanılmaz: D1 ve fetch sahtelenir.
import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/shopier.js";
import { hmacHex, tutarOku, beklenenTutar } from "../lib/ortak.js";

const TOKEN = "test-webhook-token";
const GIZLI = "a".repeat(64);
function sahteDB() {
  const t = { siparis: [], kod: [], kullanici: [{ id: "u1", eposta: "ogrenci@ornek.com" }], ayar: { shopier_webhook_token: TOKEN } };
  const calis = (sql, a) => {
    if (/^CREATE/i.test(sql)) return { first: null, all: [] };
    if (/SELECT v FROM ayar/i.test(sql)) return { first: t.ayar[a[0]] != null ? { v: t.ayar[a[0]] } : null };
    if (/SELECT id FROM siparis WHERE id = \? OR id LIKE \?/i.test(sql)) return { first: t.siparis.find(r => r.id === a[0] || r.id.startsWith(a[0] + "#")) ? { id: a[0] } : null };
    if (/SELECT id FROM kullanici WHERE eposta/i.test(sql)) return { first: t.kullanici.find(u => u.eposta === a[0]) || null };
    if (/INSERT INTO kod/i.test(sql)) { t.kod.push({ anahtar: a[0], kid: a[1], plan: a[2], bitis: a[3], siparis: a[5] }); return {}; }
    if (/INSERT (OR IGNORE )?INTO siparis/i.test(sql)) { const id = a[0]; if (/OR IGNORE/i.test(sql) && t.siparis.some(r => r.id === id)) return {}; if (t.siparis.some(r => r.id === id)) throw new Error("UNIQUE"); const durum = /'paket_yok'/.test(sql) ? "paket_yok" : /'', '', '', \?, \?, \?, \?\)/.test(sql) ? a[3] : a[6]; t.siparis.push({ id, durum }); return {}; }
    if (/UPDATE siparis SET durum/i.test(sql)) { const r = t.siparis.find(x => x.id === a[1]); if (r) r.durum = a[0]; return {}; }
    return { first: null, all: [] };
  };
  const prep = sql => { let a = []; const o = { bind: (...x) => { a = x; return o; }, first: async () => calis(sql, a).first ?? null, run: async () => calis(sql, a), all: async () => ({ results: calis(sql, a).all || [] }), _x: () => calis(sql, a) }; return o; };
  return { t, prepare: prep, batch: async l => { const kopya = JSON.stringify(t); try { l.forEach(s => s._x()); } catch (e) { const y = JSON.parse(kopya); Object.assign(t, y); throw e; } return []; } };
}
const env = () => ({ DB: sahteDB(), AKE_GIZLI: GIZLI, RESEND_API_KEY: "" });
async function gonder(e, govde, { imza, event = "order.created", method = "POST" } = {}) {
  const ham = typeof govde === "string" ? govde : JSON.stringify(govde);
  const h = { "content-type": "application/json", "shopier-event": event };
  const s = imza === undefined ? (await hmacHex(TOKEN, ham)).hex : imza; if (s) h["shopier-signature"] = s;
  const r = await onRequest({ request: new Request("https://x.test/api/shopier", { method, headers: h, body: method === "POST" ? ham : undefined }), env: e });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
const siparis = (x = {}) => ({ id: "S100", paymentStatus: "paid", billingInfo: { email: "ogrenci@ornek.com", firstName: "Ali" }, lineItems: [{ productId: "52547800", title: "AKE Atılım 1 ay", quantity: 1 }], totals: { total: "199.00" }, ...x });

test("geçerli imza + paid + doğru ürün/tutar: kod üretilir ve hesaba bağlanır", async () => {
  const e = env(); const r = await gonder(e, siparis());
  assert.equal(r.status, 200); assert.ok(e.DB.t.kod.length === 1); assert.equal(e.DB.t.kod[0].plan, "orta"); assert.equal(e.DB.t.kod[0].kid, "u1");
});
test("premium yıllık, kuponlu ödeme (%20 indirim) reddedilmez", async () => {
  const e = env(); const r = await gonder(e, siparis({ id: "S101", lineItems: [{ productId: "52547986", quantity: 1 }], totals: { total: "3.511,20" } }));
  assert.equal(r.status, 200); assert.equal(e.DB.t.kod.length, 1); assert.equal(e.DB.t.kod[0].plan, "premium");
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
test("durum eksik + SHOPIER_PAT: Shopier API 'paid' derse (id eşleşirse) kod üretilir", async () => {
  const e = env(); e.SHOPIER_PAT = "pat"; const eski = globalThis.fetch;
  globalThis.fetch = async (u) => { assert.ok(String(u).startsWith("https://api.shopier.com/v1/orders/M2")); return new Response(JSON.stringify({ data: { id: "M2", paymentStatus: "paid" } }), { status: 200 }); };
  try { const o = siparis({ id: "M2" }); delete o.paymentStatus; const r = await gonder(e, o); assert.equal(e.DB.t.kod.length, 1, JSON.stringify(r)); } finally { globalThis.fetch = eski; }
});
test("durum eksik + API 'pending' / farklı id / hata: kod yok", async () => {
  const eski = globalThis.fetch;
  try {
    for (const yanit of [() => new Response(JSON.stringify({ data: { id: "M3", paymentStatus: "pending" } })), () => new Response(JSON.stringify({ data: { id: "BASKA", paymentStatus: "paid" } })), () => new Response("x", { status: 500 }), () => { throw new Error("ağ"); }]) {
      const e = env(); e.SHOPIER_PAT = "pat"; globalThis.fetch = async () => yanit(); const o = siparis({ id: "M3" }); delete o.paymentStatus; const r = await gonder(e, o);
      assert.equal(r.j.durum, "odeme_dogrulanamadi"); assert.equal(e.DB.t.kod.length, 0);
    }
  } finally { globalThis.fetch = eski; }
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
test("tutar/paket uyuşmazlığı: 0 TL ya da beklenenin yarısından az → kod yok + denetim kaydı", async () => {
  for (const [id, tutar] of [["T1", "0"], ["T2", "1.00"], ["T3", "99"]]) { const e = env(); const r = await gonder(e, siparis({ id, totals: { total: tutar } })); assert.equal(r.j.durum, "tutar_uyusmuyor", id); assert.equal(e.DB.t.kod.length, 0); assert.ok(e.DB.t.siparis.some(s => s.id === id + "!tutar")); }
});
test("tutar okunamıyorsa (alan yok) geçerli imzalı paid sipariş reddedilmez", async () => {
  const e = env(); const o = siparis({ id: "T9" }); delete o.totals; const r = await gonder(e, o); assert.equal(e.DB.t.kod.length, 1, JSON.stringify(r));
});
test("farklı olay (refund.updated): kod üretilmez", async () => {
  const e = env(); const r = await gonder(e, siparis({ id: "R1" }), { event: "refund.updated" }); assert.equal(e.DB.t.kod.length, 0); assert.ok(r.j.yok_sayildi);
});
test("çok adetli sipariş: adet kadar kod (en çok 5), tutar adetle çarpılarak denetlenir", async () => {
  const e = env(); const r = await gonder(e, siparis({ id: "Q1", lineItems: [{ productId: "52547800", quantity: 3 }], totals: { total: "597" } })); assert.equal(e.DB.t.kod.length, 3, JSON.stringify(r));
  const e2 = env(); const r2 = await gonder(e2, siparis({ id: "Q2", lineItems: [{ productId: "52547800", quantity: 3 }], totals: { total: "199" } })); assert.equal(r2.j.durum, "tutar_uyusmuyor"); assert.equal(e2.DB.t.kod.length, 0);
});
test("yardımcılar: tutar ayrıştırma ve beklenen tutar", () => {
  assert.equal(tutarOku("199,00"), 199); assert.equal(tutarOku("1.234,50"), 1234.5); assert.equal(tutarOku("2,189"), 2189); assert.ok(Number.isNaN(tutarOku("")));
  assert.equal(beklenenTutar({}, ["orta-ay", "premium-yil"]), 199 + 4389); assert.equal(beklenenTutar({ AKE_FIYATLAR: "orta-ay:249" }, ["orta-ay"]), 249);
});
test("yönetici deneme siparişi (deneme=true, 0 TL) çalışmaya devam eder", async () => {
  const { siparisIsle } = await import("../lib/ortak.js"); const e = env();
  const r = await siparisIsle(e, { id: "deneme-1", paymentStatus: "paid", billingInfo: { email: "yonetici@ornek.com" }, lineItems: [{ productId: "52547800", quantity: 1 }], totals: { total: "0" } }, true);
  assert.notEqual(r.durum, "tutar_uyusmuyor"); assert.equal(e.DB.t.kod.length, 1);
});
