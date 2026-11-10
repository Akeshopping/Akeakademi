// Sunucu taraflı ücretsiz kota testi · çalıştırma: node --test tests/kota.test.mjs
// Gerçek SQLite (node:sqlite) üzerinde, hesap uçlarının kendisiyle denenir.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { sha256 } from "../lib/ortak.js";
import { kotaKimligiEposta } from "../lib/kota.js";

/* D1 benzeri ince kabuk. Sorgular çalıştırılırken hazırlanır (D1 gibi); şema önbelleği (semaHazir)
   modül düzeyinde olduğundan tüm testler tek veritabanını paylaşır, hesaplar e-postayla ayrılır. */
function d1() {
  const db = new DatabaseSync(":memory:");
  const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
    first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
  return { prepare: st, batch: async arr => { for (const s of arr) await s.run(); return []; }, db };
}
const DB = d1();
const mod = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
const env = () => ({ DB, AKE_GIZLI: "test-gizli" });
const istek = (e, yol, { m = "GET", govde, cookie, ip = "10.0.0.1" } = {}) => mod.onRequest({
  request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: m, headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(cookie ? { cookie } : {}) }, body: govde ? JSON.stringify(govde) : undefined }),
  env: e, params: { yol: yol.split("/") } });
/* e-posta koduyla giriş (gerçek uç): giriş satırına bilinen bir kod yazılır, kod-dogrula çağrılır */
async function girisYap(e, eposta, ip) {
  await istek(e, "ben"); /* şemayı kurar */
  const kod = "123456", hash = await sha256(eposta + ":" + kod + ":" + e.AKE_GIZLI);
  e.DB.db.prepare("INSERT INTO giris (eposta, hash, bitis, deneme, son_gonderim, pencere, sayac) VALUES (?, ?, ?, 0, 0, 0, 0) ON CONFLICT (eposta) DO UPDATE SET hash = excluded.hash, bitis = excluded.bitis, deneme = 0").run(eposta, hash, Date.now() + 600000);
  const r = await istek(e, "kod-dogrula", { m: "POST", govde: { eposta, kod }, ip });
  assert.equal(r.status, 200); const j = await r.json();
  return { cookie: r.headers.get("set-cookie").split(";")[0], j };
}
const al = async (e, cookie, tur, adet, ip) => { const r = await istek(e, "kota", { m: "POST", govde: { tur, adet }, cookie, ip }); return { s: r.status, j: await r.json() }; };

test("oturum yoksa kota 401 verir", async () => {
  const e = env(); await istek(e, "ben");
  assert.equal((await istek(e, "kota")).status, 401);
  assert.equal((await istek(e, "kota", { m: "POST", govde: { tur: "soru", adet: 1 } })).status, 401);
});
test("yeni hesap: günde 20 soru, ayda 1 deneme (mevcut hak miktarı korunur)", async () => {
  const e = env(), { cookie, j } = await girisYap(e, "a@ornek.com");
  assert.equal(j.ucretsiz.kalanSoru, 20); assert.equal(j.ucretsiz.kalanDeneme, 1);
  const d = await (await istek(e, "kota", { cookie })).json(); assert.equal(d.kalanSoru, 20);
});
test("soru hakkı sunucuda düşer, 20'den fazlası verilmez, bitince 402", async () => {
  const e = env(), { cookie } = await girisYap(e, "b@ornek.com");
  let r = await al(e, cookie, "soru", 15); assert.equal(r.s, 200); assert.equal(r.j.verildi, 15); assert.equal(r.j.kalanSoru, 5);
  r = await al(e, cookie, "soru", 10); assert.equal(r.s, 200); assert.equal(r.j.verildi, 5); assert.equal(r.j.kalanSoru, 0);
  r = await al(e, cookie, "soru", 1); assert.equal(r.s, 402); assert.equal(r.j.error, "limit"); assert.equal(r.j.kalanSoru, 0);
});
test("deneme: ayda 1; ikincisi 402; soru hakkını etkilemez", async () => {
  const e = env(), { cookie } = await girisYap(e, "c@ornek.com");
  let r = await al(e, cookie, "deneme", 1); assert.equal(r.s, 200); assert.equal(r.j.kalanDeneme, 0); assert.equal(r.j.kalanSoru, 20);
  r = await al(e, cookie, "deneme", 1); assert.equal(r.s, 402);
});
test("aynı hesapla yeni oturum (gizli sekme / başka cihaz): kalan hak aynı, sıfırlanmaz", async () => {
  const e = env(), ilk = await girisYap(e, "d@ornek.com");
  await al(e, ilk.cookie, "soru", 12); await al(e, ilk.cookie, "deneme", 1);
  const gizli = await girisYap(e, "d@ornek.com"); /* tamamen yeni oturum, çerezsiz tarayıcı */
  assert.notEqual(gizli.cookie, ilk.cookie);
  assert.equal(gizli.j.ucretsiz.kalanSoru, 8); assert.equal(gizli.j.ucretsiz.kalanDeneme, 0);
  const ben = await (await istek(e, "ben", { cookie: gizli.cookie })).json(); assert.equal(ben.ucretsiz.kalanSoru, 8);
  const r = await al(e, gizli.cookie, "soru", 20); assert.equal(r.j.verildi, 8); assert.equal((await al(e, ilk.cookie, "soru", 1)).s, 402);
});
test("ortak ağ (aynı IP): farklı hesaplar kendi haklarını ayrı kullanır", async () => {
  const e = env(), ip = "192.168.1.50";
  const a = await girisYap(e, "e1@ornek.com", ip), b = await girisYap(e, "e2@ornek.com", ip);
  assert.equal((await al(e, a.cookie, "soru", 20, ip)).j.kalanSoru, 0);
  assert.equal((await al(e, a.cookie, "soru", 1, ip)).s, 402);
  const rb = await al(e, b.cookie, "soru", 20, ip); assert.equal(rb.s, 200); assert.equal(rb.j.verildi, 20);
});
test("eşzamanlı istekler sınırı aşamaz", async () => {
  const e = env(), { cookie } = await girisYap(e, "f@ornek.com");
  const sonuc = await Promise.all(Array.from({ length: 12 }, () => al(e, cookie, "soru", 5)));
  const toplam = sonuc.reduce((t, r) => t + (r.s === 200 ? r.j.verildi : 0), 0);
  assert.ok(toplam <= 20, "verilen " + toplam); assert.equal(toplam, 20);
  /* sayaç artık e-postadan türetilen takma adlı kimlikte tutulur (ucretsiz_kimlik) */
  assert.equal(e.DB.db.prepare("SELECT adet FROM ucretsiz_kimlik WHERE kimlik = ? AND tur='soru'").get(await kotaKimligiEposta(e, "f@ornek.com")).adet, 20);
});
test("ücretli paketi olan sınırsız, sayaç tutulmaz", async () => {
  const e = env(), { cookie } = await girisYap(e, "g@ornek.com");
  const kid = e.DB.db.prepare("SELECT id FROM kullanici WHERE eposta='g@ornek.com'").get().id;
  e.DB.db.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih) VALUES ('X1', ?, 'orta', '2999-01-01', 0)").run(kid);
  const r = await al(e, cookie, "soru", 100); assert.equal(r.s, 200); assert.equal(r.j.sinirsiz, true);
  assert.equal(e.DB.db.prepare("SELECT COUNT(*) n FROM ucretsiz WHERE kid = ?").get(kid).n, 0);
  assert.equal(e.DB.db.prepare("SELECT COUNT(*) n FROM ucretsiz_kimlik WHERE kimlik = ?").get(await kotaKimligiEposta(e, "g@ornek.com")).n, 0);
});
test("yeni gün: soru hakkı yenilenir; deneme ay içinde yenilenmez", async () => {
  const e = env(), { cookie } = await girisYap(e, "h@ornek.com"), gercek = Date.now;
  try {
    const t0 = Date.UTC(2026, 10, 10, 9, 0, 0); Date.now = () => t0;
    await al(e, cookie, "soru", 20); await al(e, cookie, "deneme", 1);
    assert.equal((await al(e, cookie, "soru", 1)).s, 402);
    Date.now = () => t0 + 86400000; /* ertesi gün (TR) */
    assert.equal((await al(e, cookie, "soru", 20)).j.verildi, 20);
    assert.equal((await al(e, cookie, "deneme", 1)).s, 402);
    Date.now = () => Date.UTC(2026, 11, 2, 9, 0, 0); /* gelecek ay */
    assert.equal((await al(e, cookie, "deneme", 1)).s, 200);
  } finally { Date.now = gercek; }
});
test("geçersiz istekler reddedilir", async () => {
  const e = env(), { cookie } = await girisYap(e, "i@ornek.com");
  for (const g of [{ tur: "x", adet: 1 }, { tur: "soru", adet: 0 }, { tur: "soru", adet: -3 }, { tur: "soru", adet: "a" }, { tur: "soru", adet: 9999 }, {}])
    assert.equal((await al(e, cookie, g.tur, g.adet)).s, 400, JSON.stringify(g));
});
test("hesap silinince eski kid'li kota satırları silinir; takma adlı kayıt kalır (ayrıntılar: kota-yeniden-acma.test.mjs)", async () => {
  const e = env(), { cookie } = await girisYap(e, "j@ornek.com"); await al(e, cookie, "soru", 3);
  const kid = e.DB.db.prepare("SELECT id FROM kullanici WHERE eposta='j@ornek.com'").get().id, kimlik = await kotaKimligiEposta(e, "j@ornek.com");
  assert.equal(e.DB.db.prepare("SELECT adet FROM ucretsiz_kimlik WHERE kimlik = ? AND tur='soru'").get(kimlik).adet, 3);
  assert.equal((await istek(e, "sil", { m: "POST", cookie })).status, 200);
  assert.equal(e.DB.db.prepare("SELECT COUNT(*) n FROM ucretsiz WHERE kid = ?").get(kid).n, 0);
  assert.equal(e.DB.db.prepare("SELECT adet FROM ucretsiz_kimlik WHERE kimlik = ? AND tur='soru'").get(kimlik).adet, 3);
});
