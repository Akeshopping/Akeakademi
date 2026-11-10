// Hesap silip yeniden açınca ücretsiz kota sıfırlanmamalı · çalıştırma: node --test tests/kota-yeniden-acma.test.mjs
// Gerçek SQLite (node:sqlite) üzerinde, hesap uçlarının kendisiyle denenir. Bu dosya yalnızca HTTP uçlarını ve tabloları kullanır;
// bu yüzden açığı eski kodda da yeniden üretir (senaryo 1-3 eski kodda FAIL olmalıdır).
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { sha256, kullaniciBulVeyaAc, oturumAc, bugunIso, ayAnahtar } from "../lib/ortak.js";

function d1() {
  const db = new DatabaseSync(":memory:");
  const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
    first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
  return { prepare: st, batch: async arr => { for (const s of arr) await s.run(); return []; }, db };
}
const SIR = "test-gizli-anahtar-123"; /* sahte test sırrı */
const DB = d1();
const mod = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
const env = () => ({ DB, AKE_GIZLI: SIR });
let ipSay = 0; const yeniIp = () => "10.1." + Math.floor(++ipSay / 250) + "." + (ipSay % 250 + 1);
const istek = (e, yol, { m = "GET", govde, cookie, ip } = {}) => mod.onRequest({
  request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: m, headers: { "content-type": "application/json", "cf-connecting-ip": ip || yeniIp(), ...(cookie ? { cookie } : {}) }, body: govde ? JSON.stringify(govde) : undefined }),
  env: e, params: { yol: yol.split("/") } });
async function girisYap(e, eposta) {
  await istek(e, "ben");
  const kod = "123456", hash = await sha256(eposta.trim().toLowerCase() + ":" + kod + ":" + e.AKE_GIZLI);
  e.DB.db.prepare("INSERT INTO giris (eposta, hash, bitis, deneme, son_gonderim, pencere, sayac) VALUES (?, ?, ?, 0, 0, 0, 0) ON CONFLICT (eposta) DO UPDATE SET hash = excluded.hash, bitis = excluded.bitis, deneme = 0").run(eposta.trim().toLowerCase(), hash, Date.now() + 600000);
  const r = await istek(e, "kod-dogrula", { m: "POST", govde: { eposta, kod } });
  assert.equal(r.status, 200); const j = await r.json();
  return { cookie: r.headers.get("set-cookie").split(";")[0], j };
}
const al = async (e, cookie, tur, adet) => { const r = await istek(e, "kota", { m: "POST", govde: { tur, adet }, cookie }); return { s: r.status, j: await r.json() }; };
const kota = async (e, cookie) => (await istek(e, "kota", { cookie })).json();
const sil = async (e, cookie) => { const r = await istek(e, "sil", { m: "POST", cookie }); assert.equal(r.status, 200); };
const kidOf = (e, eposta) => { const r = e.DB.db.prepare("SELECT id FROM kullanici WHERE eposta = ?").get(eposta.trim().toLowerCase()); return r && r.id; };

test("1) 20/20 soru kullan → hesabı sil → aynı e-postayla yeniden aç → soru hakkı hâlâ 0", async () => {
  const e = env(), a = await girisYap(e, "s1@ornek.com");
  assert.equal((await al(e, a.cookie, "soru", 20)).j.kalanSoru, 0);
  await sil(e, a.cookie);
  const b = await girisYap(e, "s1@ornek.com");
  assert.equal(b.j.ucretsiz.kalanSoru, 0, "yeniden açılan hesapta soru hakkı geri gelmemeli");
  assert.equal((await al(e, b.cookie, "soru", 1)).s, 402);
});
test("2) 7 soru kullan → sil → yeniden aç → 13 soru kalır", async () => {
  const e = env(), a = await girisYap(e, "s2@ornek.com");
  await al(e, a.cookie, "soru", 7); await sil(e, a.cookie);
  const b = await girisYap(e, "s2@ornek.com");
  assert.equal(b.j.ucretsiz.kalanSoru, 13); assert.equal((await kota(e, b.cookie)).kalanSoru, 13);
  assert.equal((await al(e, b.cookie, "soru", 20)).j.verildi, 13);
});
test("3) aylık deneme kullanıldı → sil → yeniden aç → ikinci deneme 402 limit", async () => {
  const e = env(), a = await girisYap(e, "s3@ornek.com");
  assert.equal((await al(e, a.cookie, "deneme", 1)).s, 200); await sil(e, a.cookie);
  const b = await girisYap(e, "s3@ornek.com");
  assert.equal(b.j.ucretsiz.kalanDeneme, 0);
  const r = await al(e, b.cookie, "deneme", 1); assert.equal(r.s, 402); assert.equal(r.j.error, "limit");
});
test("4) farklı e-posta yeni hesap kendi 20/1 hakkını alır", async () => {
  const e = env(), a = await girisYap(e, "s4a@ornek.com"); await al(e, a.cookie, "soru", 20); await al(e, a.cookie, "deneme", 1); await sil(e, a.cookie);
  const b = await girisYap(e, "s4b@ornek.com");
  assert.equal(b.j.ucretsiz.kalanSoru, 20); assert.equal(b.j.ucretsiz.kalanDeneme, 1);
});
test("5) aynı e-posta farklı büyük/küçük harfle → aynı kota", async () => {
  const e = env(), a = await girisYap(e, "Test5@Ornek.com"); await al(e, a.cookie, "soru", 9); await sil(e, a.cookie);
  const b = await girisYap(e, "TEST5@ORNEK.COM"); assert.equal(b.j.ucretsiz.kalanSoru, 11);
  await sil(e, b.cookie); const c = await girisYap(e, "  test5@ornek.com "); assert.equal(c.j.ucretsiz.kalanSoru, 11);
});
test("6) e-posta girişiyle açılan hesap silinir, aynı e-postalı Google hesabı açılır → aynı kota", async () => {
  const e = env(), a = await girisYap(e, "s6@ornek.com"); await al(e, a.cookie, "soru", 15); await al(e, a.cookie, "deneme", 1); await sil(e, a.cookie);
  const kid = await kullaniciBulVeyaAc(e, { eposta: "S6@Ornek.com", ad: "Test", google: "g:abc123" }); /* google-donus ile aynı çağrı */
  const cerez = (await oturumAc(e, kid)).split(";")[0];
  const d = await kota(e, cerez); assert.equal(d.kalanSoru, 5); assert.equal(d.kalanDeneme, 0);
});
test("7) ücretli paketli kullanıcı sınırsız, kota engeli yok", async () => {
  const e = env(), a = await girisYap(e, "s7@ornek.com");
  e.DB.db.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih) VALUES (?, ?, 'premium', '2999-01-01', 0)").run("PAK-7", kidOf(e, "s7@ornek.com"));
  const r = await al(e, a.cookie, "soru", 100); assert.equal(r.s, 200); assert.equal(r.j.sinirsiz, true);
  assert.equal((await al(e, a.cookie, "deneme", 1)).j.sinirsiz, true); assert.equal((await kota(e, a.cookie)).sinirsiz, true);
});
test("8) eşzamanlı istekler limiti aşamaz (silip yeniden açılmış hesapta da)", async () => {
  const e = env(), a = await girisYap(e, "s8@ornek.com"); await al(e, a.cookie, "soru", 4); await sil(e, a.cookie);
  const b = await girisYap(e, "s8@ornek.com");
  const sonuc = await Promise.all(Array.from({ length: 14 }, () => al(e, b.cookie, "soru", 5)));
  const toplam = sonuc.reduce((t, r) => t + (r.s === 200 ? r.j.verildi : 0), 0);
  assert.equal(toplam, 16, "4 kullanılmıştı, en çok 16 verilebilir; verilen " + toplam);
});
test("9) mevcut production kullanıcısının eski sayaç kullanımı geçişte sıfırlanmaz", async () => {
  const e = env(), a = await girisYap(e, "s9@ornek.com"), kid = kidOf(e, "s9@ornek.com");
  e.DB.db.prepare("INSERT INTO ucretsiz (kid, donem, tur, adet) VALUES (?, ?, 'soru', 7)").run(kid, bugunIso());
  e.DB.db.prepare("INSERT INTO ucretsiz (kid, donem, tur, adet) VALUES (?, ?, 'deneme', 1)").run(kid, ayAnahtar());
  const d = await kota(e, a.cookie); assert.equal(d.kalanSoru, 13); assert.equal(d.kalanDeneme, 0);
  assert.equal((await al(e, a.cookie, "deneme", 1)).s, 402);
  await sil(e, a.cookie); const b = await girisYap(e, "s9@ornek.com"); assert.equal(b.j.ucretsiz.kalanSoru, 13); assert.equal(b.j.ucretsiz.kalanDeneme, 0);
});
test("10) geçiş (migration) tekrar tekrar çalışınca sayaç iki katına çıkmaz", async () => {
  const e = env(), a = await girisYap(e, "s10@ornek.com"), kid = kidOf(e, "s10@ornek.com");
  e.DB.db.prepare("INSERT INTO ucretsiz (kid, donem, tur, adet) VALUES (?, ?, 'soru', 7)").run(kid, bugunIso());
  for (let i = 0; i < 4; i++) assert.equal((await kota(e, a.cookie)).kalanSoru, 13, "okuma #" + i);
  assert.equal((await al(e, a.cookie, "soru", 3)).j.kalanSoru, 10);
  for (let i = 0; i < 3; i++) assert.equal((await kota(e, a.cookie)).kalanSoru, 10, "okuma sonrası #" + i);
  assert.equal((await al(e, a.cookie, "soru", 2)).j.kalanSoru, 8);
  await sil(e, a.cookie); await sil(e, (await girisYap(e, "s10@ornek.com")).cookie);
  assert.equal((await girisYap(e, "s10@ornek.com")).j.ucretsiz.kalanSoru, 8);
});
test("11) silme sonrası kişisel veri gider; yalnız takma adlı aktif dönem kota kaydı kalır", async () => {
  const e = env(), a = await girisYap(e, "s11@ornek.com"), kid = kidOf(e, "s11@ornek.com");
  await al(e, a.cookie, "soru", 6); await al(e, a.cookie, "deneme", 1);
  assert.equal((await istek(e, "veri/ilerleme", { m: "PUT", cookie: a.cookie, govde: { u: 1, d: { x: 1 } } })).status < 500, true);
  await sil(e, a.cookie);
  const say = (t, c) => e.DB.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${c} = ?`).get(c === "eposta" ? "s11@ornek.com" : kid).n;
  for (const [t, c] of [["kullanici", "id"], ["veri", "kid"], ["oturum", "kid"], ["kullanim", "kid"], ["ucretsiz", "kid"], ["giris", "eposta"]]) assert.equal(say(t, c), 0, t + " silinmeli");
  const kalan = e.DB.db.prepare("SELECT * FROM ucretsiz_kimlik").all().filter(r => true);
  const bu = kalan.filter(r => (r.tur === "soru" && r.donem === bugunIso()) || (r.tur === "deneme" && r.donem === ayAnahtar()));
  assert.ok(bu.length >= 2, "aktif dönem kota kaydı kalmalı");
  const dok = JSON.stringify(e.DB.db.prepare("SELECT * FROM ucretsiz_kimlik").all());
  assert.ok(!dok.includes("s11@ornek.com") && !dok.includes(kid) && !dok.includes("ornek"), "kalıcı kayıtta e-posta/eski kid olmamalı");
  assert.deepEqual(Object.keys(e.DB.db.prepare("SELECT * FROM ucretsiz_kimlik").get()).sort(), ["adet", "donem", "kimlik", "tur"]);
  for (const r of kalan) assert.match(r.kimlik, /^[0-9a-f]{64}$/);
});
test("12) sır ve e-posta loglara ve API cevaplarına çıkmaz", async () => {
  const e = env(), loglar = [], orj = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(orj)) console[k] = (...a) => loglar.push(a.map(String).join(" "));
  const cevaplar = [];
  try {
    const em = "gizlilik12@ornek.com", a = await girisYap(e, em); cevaplar.push(JSON.stringify(a.j.ucretsiz));
    for (const [t, n] of [["soru", 5], ["deneme", 1], ["soru", 99]]) cevaplar.push(JSON.stringify((await al(e, a.cookie, t, n)).j));
    cevaplar.push(JSON.stringify(await kota(e, a.cookie)));
    const r = await istek(e, "sil", { m: "POST", cookie: a.cookie }); cevaplar.push(await r.text(), r.headers.get("set-cookie") || "");
    const b = await girisYap(e, em); cevaplar.push(JSON.stringify(b.j.ucretsiz), JSON.stringify(await al(e, b.cookie, "soru", 1)));
  } finally { Object.assign(console, orj); }
  const hepsi = [...loglar, ...cevaplar].join("\n");
  assert.ok(!hepsi.includes(SIR), "sır sızdı"); assert.ok(!hepsi.includes("gizlilik12@ornek.com") && !hepsi.includes("gizlilik12"), "e-posta sızdı");
  assert.ok(!/ucretsiz-kota/.test(hepsi), "kota kimliği türetme dizgesi sızdı"); assert.ok(!/[0-9a-f]{64}/.test(hepsi), "kota kimliği (HMAC) sızdı");
});
