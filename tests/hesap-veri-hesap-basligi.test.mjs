// B4 · /api/hesap/veri: x-ake-hesap başlığı, SUNUCUNUN doğruladığı oturumla karşılaştırılır (hesaplar arası/çok sekmeli yazma koruması).
// Çalıştırma: node --test tests/hesap-veri-hesap-basligi.test.mjs   (gerçek SQLite node:sqlite + hesap ucunun kendisi; sentetik hesaplar, ağ yok)
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const DB = (() => {
  const db = new DatabaseSync(":memory:"), o = { db };
  const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
    first: async () => db.prepare(sql).get(...a) || null,
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
  o.prepare = st; o.batch = async arr => { for (const s of arr) await s.run(); return []; };
  return o;
})();
const env = { DB, AKE_GIZLI: "test-gizli" };
const mod = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
const ortak = await import(pathToFileURL(resolve("lib/ortak.js")).href);
let ipn = 0;
const istek = (yol, { m = "GET", govde, cookie, baslik } = {}) => mod.onRequest({
  request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: m, headers: { "content-type": "application/json", "cf-connecting-ip": "10.9.0." + (++ipn % 250), ...(cookie ? { cookie } : {}), ...(baslik !== undefined ? { "x-ake-hesap": baslik } : {}) }, body: govde ? JSON.stringify(govde) : undefined }),
  env, params: { yol: yol.split("/") } });
await istek("ben");   // şemayı kurar
const hesap = async eposta => { const kid = await ortak.kullaniciBulVeyaAc(env, { eposta }); const c = await ortak.oturumAc(env, kid); return { kid, cookie: c.split(";")[0] }; };
const A = await hesap("a-baslik@ornek.test"), B = await hesap("b-baslik@ornek.test");
const satir = kid => DB.db.prepare("SELECT alan, json, u FROM veri WHERE kid = ? ORDER BY alan").all(kid);
const puta = (h, alan, o, cookie, baslik) => istek("veri/" + alan, { m: "PUT", govde: o, cookie, baslik });

test("doğru başlık: yazma ve okuma çalışır", async () => {
  const r = await puta(A, "stats", { _u: 100, ans: { "A-1": [1] } }, A.cookie, A.kid); assert.equal(r.status, 200);
  const g = await istek("veri", { cookie: A.cookie, baslik: A.kid }); assert.equal(g.status, 200); assert.ok((await g.json()).alanlar.stats);
});
test("başlıksız eski istemci eskisi gibi çalışır (geriye uyum)", async () => {
  const r = await puta(A, "plan", { _u: 100, plan: { tasks: [] } }, A.cookie, undefined); assert.equal(r.status, 200);
  const g = await istek("veri", { cookie: A.cookie }); assert.equal(g.status, 200);
});
test("başlık, oturumdaki hesaptan FARKLIYSA: PUT 409 hesap_uyumsuz ve HİÇBİR satır değişmez", async () => {
  const onceA = JSON.stringify(satir(A.kid)), onceB = JSON.stringify(satir(B.kid));
  const r = await puta(A, "stats", { _u: 999999, ans: { "SIZINTI": [1] } }, B.cookie, A.kid);   // B'nin oturumu, A'nın başlığı
  assert.equal(r.status, 409); assert.deepEqual(await r.json(), { error: "hesap_uyumsuz" });
  assert.equal(JSON.stringify(satir(A.kid)), onceA); assert.equal(JSON.stringify(satir(B.kid)), onceB); assert.ok(!JSON.stringify(satir(B.kid)).includes("SIZINTI"));
});
test("yetki başlıktan değil oturumdan gelir: B'nin oturumu 'B' başlığıyla yalnız B'ye yazar; A'nın verisine ulaşamaz", async () => {
  const r = await puta(B, "stats", { _u: 200, ans: { "B-1": [1] } }, B.cookie, B.kid); assert.equal(r.status, 200);
  assert.ok(JSON.stringify(satir(B.kid)).includes("B-1")); assert.ok(!JSON.stringify(satir(B.kid)).includes("A-1"));
  const g = await istek("veri", { cookie: B.cookie, baslik: B.kid }); const j = await g.json(); assert.ok(!JSON.stringify(j).includes("A-1"));
});
test("GET'te uyuşmazlık: 409 ve gövdede alan verisi YOK", async () => {
  const g = await istek("veri", { cookie: B.cookie, baslik: A.kid }); assert.equal(g.status, 409);
  const j = await g.json(); assert.deepEqual(j, { error: "hesap_uyumsuz" }); assert.ok(!("alanlar" in j));
});
test("oturumsuz istek başlık ne derse desin 401", async () => {
  assert.equal((await puta(A, "stats", { _u: 1 }, undefined, A.kid)).status, 401);
  assert.equal((await istek("veri", { baslik: A.kid })).status, 401);
});
test("mevcut 409 'eski' davranışı korunur (daha yeni kayıt varken eski _u)", async () => {
  await puta(A, "exams", { _u: 5000, exams: [] }, A.cookie, A.kid);
  const r = await puta(A, "exams", { _u: 10, exams: ["x"] }, A.cookie, A.kid); assert.equal(r.status, 409); const j = await r.json(); assert.equal(j.error, "eski");
  assert.ok(!JSON.stringify(satir(A.kid)).includes('"x"'));
});
test("uyuşmazlıkta 409 yanıtı önbelleğe alınmaz", async () => {
  const r = await puta(A, "stats", { _u: 1 }, B.cookie, A.kid); assert.match(r.headers.get("cache-control") || "", /no-store/);
});
