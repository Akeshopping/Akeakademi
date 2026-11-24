// Mobil istemci oturumu · Authorization: Bearer (web çerez akışı değişmeden)
// Çalıştırma: node --test tests/mobil-oturum.test.mjs   · Hesaplar SENTETİKTİR; Resend sahtelenir.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const db = new DatabaseSync(":memory:");
const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
  first: async () => db.prepare(sql).get(...a) || null,
  all: async () => ({ results: db.prepare(sql).all(...a) }),
  run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; } });
const DB = { prepare: st, batch: async arr => { for (const s of arr) await s.run(); return []; } };
const env = { DB, AKE_GIZLI: "test-gizli", RESEND_API_KEY: "test-anahtar", AKE_SORU_V2: "1" };
const hesap = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
const soru = await import(pathToFileURL(resolve("functions/api/soru/[[yol]].js")).href);

const postalar = [];
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("api.resend.com")) { postalar.push(JSON.parse(opt.body)); return new Response("{}", { status: 200 }); }
  throw new Error("beklenmeyen ağ isteği: " + url);
};
let ipn = 0; const yeniIp = () => { ipn++; return `10.7.${(ipn >> 8) & 255}.${ipn & 255}`; };
const H = (ek, ip) => ({ "content-type": "application/json", "cf-connecting-ip": ip || yeniIp(), ...ek });
const hesapIstek = (yol, { m = "GET", govde, baslik } = {}) => hesap.onRequest({
  request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: m, headers: H(baslik), body: govde ? JSON.stringify(govde) : undefined }), env, params: { yol: yol.split("/") } });
const soruIstek = (yol, { m = "POST", govde = {}, baslik } = {}) => soru.onRequest({
  request: new Request("https://akeakademi.com/api/soru/" + yol, { method: m, headers: H(baslik), body: m === "GET" ? undefined : JSON.stringify(govde) }), env, params: { yol: [yol] } });

let sayac = 0;
async function girisYap(ek) {
  const eposta = `mobil${++sayac}@ornek.com`;
  assert.equal((await hesapIstek("kod-gonder", { m: "POST", govde: { eposta } })).status, 200);
  const kod = /: (\d{8})/.exec(postalar[postalar.length - 1].subject)[1];
  const r = await hesapIstek("kod-dogrula", { m: "POST", govde: Object.assign({ eposta, kod }, ek || {}) });
  return { r, j: await r.json(), cerez: r.headers.get("set-cookie") };
}
const cerezDegeri = c => /^ake_s=([^;]*)/.exec(c)[1];

test("1) web girişi değişmedi: yanıtta oturum anahtarı YOK, yalnız HttpOnly çerez", async () => {
  const g = await girisYap();
  assert.equal(g.r.status, 200); assert.equal(g.j.oturumAnahtari, undefined); assert.match(g.cerez, /HttpOnly/);
});
test("2) istemci:'mobil' ise oturum anahtarı döner; anahtar çerezdeki belirteçle aynı ve Bearer ile /ben çalışır", async () => {
  const g = await girisYap({ istemci: "mobil" });
  assert.equal(typeof g.j.oturumAnahtari, "string"); assert.ok(g.j.oturumAnahtari.length >= 40);
  assert.equal(g.j.oturumAnahtari, decodeURIComponent(cerezDegeri(g.cerez)));
  const ben = await hesapIstek("ben", { baslik: { authorization: "Bearer " + g.j.oturumAnahtari } });
  assert.equal(ben.status, 200); assert.equal((await ben.json()).kullanici.eposta, g.j.kullanici.eposta);
});
test("3) yanlış kodla anahtar verilmez (mobil de olsa)", async () => {
  const eposta = "mobilyanlis@ornek.com"; await hesapIstek("kod-gonder", { m: "POST", govde: { eposta } });
  const r = await hesapIstek("kod-dogrula", { m: "POST", govde: { eposta, kod: "00000000", istemci: "mobil" } });
  assert.equal(r.status, 400); assert.equal((await r.json()).oturumAnahtari, undefined);
});
test("4) Bearer VARSA çerez yedeği yok: geçersiz Bearer + geçerli çerez → 401", async () => {
  const g = await girisYap();
  const r = await hesapIstek("ben", { baslik: { authorization: "Bearer " + "x".repeat(48), cookie: "ake_s=" + cerezDegeri(g.cerez) } });
  assert.equal(r.status, 401);
  assert.equal((await hesapIstek("ben", { baslik: { cookie: "ake_s=" + cerezDegeri(g.cerez) } })).status, 200, "çerez tek başına hâlâ çalışır");
});
test("5) Bearer olmayan başlık (Basic) yok sayılır; çerez geçerliyse çalışır", async () => {
  const g = await girisYap();
  const r = await hesapIstek("ben", { baslik: { authorization: "Basic abc", cookie: "ake_s=" + cerezDegeri(g.cerez) } });
  assert.equal(r.status, 200);
});
test("6) soru API: çerezle Origin'siz POST hâlâ 403 (CSRF korunur); yanlış Origin 403; aynı origin geçer", async () => {
  const g = await girisYap(), cerez = "ake_s=" + cerezDegeri(g.cerez);
  assert.equal((await soruIstek("oturum", { baslik: { cookie: cerez } })).status, 403);
  assert.equal((await soruIstek("oturum", { baslik: { cookie: cerez, origin: "https://kotu.example" } })).status, 403);
  assert.equal((await soruIstek("oturum", { baslik: { cookie: cerez, origin: "https://akeakademi.com" } })).status, 400, "origin geçti, gövde geçersiz");
});
test("7) soru API: Bearer ile Origin'siz POST geçer (doğrulamaya ulaşır); oturumsuz Bearer 401; Bearer'lı ozet çalışır", async () => {
  const g = await girisYap({ istemci: "mobil" }), b = { authorization: "Bearer " + g.j.oturumAnahtari };
  const r = await soruIstek("oturum", { baslik: b }); assert.equal(r.status, 400); assert.equal((await r.json()).error, "istek");
  assert.equal((await soruIstek("oturum", { baslik: { authorization: "Bearer " + "y".repeat(48) } })).status, 401);
  assert.equal((await soruIstek("oturum", { baslik: {} })).status, 403, "kimliksiz ve Origin'siz: CSRF denetimi önce reddeder");
  const oz = await soruIstek("ozet", { m: "GET", baslik: b }); assert.equal(oz.status, 200); assert.equal(typeof (await oz.json()).toplam, "number");
  assert.equal((await soruIstek("ozet", { m: "GET", baslik: {} })).status, 401, "oturumsuz GET");
});
test("8) bayrak kapalıyken Bearer de 404 (karanlık API açılmaz)", async () => {
  const g = await girisYap({ istemci: "mobil" }), eski = env.AKE_SORU_V2; env.AKE_SORU_V2 = "";
  try { assert.equal((await soruIstek("oturum", { baslik: { authorization: "Bearer " + g.j.oturumAnahtari } })).status, 404); } finally { env.AKE_SORU_V2 = eski; }
});
test("9) çıkış Bearer ile oturumu sunucuda siler; anahtar sonra 401", async () => {
  const g = await girisYap({ istemci: "mobil" }), b = { authorization: "Bearer " + g.j.oturumAnahtari };
  assert.equal((await hesapIstek("cikis", { m: "POST", baslik: b })).status, 200);
  assert.equal((await hesapIstek("ben", { baslik: b })).status, 401);
});
test("10) süresi dolmuş oturum anahtarı 401 verir (uygulama 'oturum bitti' ekranına düşer)", async () => {
  const g = await girisYap({ istemci: "mobil" }); db.prepare("UPDATE oturum SET bitis = ?").run(Date.now() - 1000);
  assert.equal((await hesapIstek("ben", { baslik: { authorization: "Bearer " + g.j.oturumAnahtari } })).status, 401);
});
test("11) hesap verisi (ilerleme) Bearer ile okunur/yazılır; eski _u 409 verir", async () => {
  const g = await girisYap({ istemci: "mobil" }), b = { authorization: "Bearer " + g.j.oturumAnahtari };
  const yaz = (o) => hesapIstek("veri/stats", { m: "PUT", govde: o, baslik: b });
  assert.equal((await yaz({ _u: 2000, topic: { "mat|Sayılar": [1, 0, 0] } })).status, 200);
  const oku = await (await hesapIstek("veri", { baslik: b })).json();
  assert.deepEqual(oku.alanlar.stats.topic, { "mat|Sayılar": [1, 0, 0] });
  const eski = await yaz({ _u: 1000, topic: {} }); assert.equal(eski.status, 409); assert.equal((await eski.json()).u, 2000);
});
