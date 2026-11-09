// Gerçek Cloudflare D1 davranışıyla (workerd + Miniflare) yerel veli raporu entegrasyon testleri.
// Çalıştırma: cd tests/d1 && npm install && npm test
// Yalnızca yerel, geçici bir D1 kullanır; canlı veritabanına, Resend'e veya Cloudflare hesabına dokunmaz (fetch sahtelenir).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { sema, kullaniciBulVeyaAc } from "../../lib/ortak.js";
import * as V from "../../lib/veli.js";

const SIMDI = Date.UTC(2026, 10, 8, 16, 0, 0); // pazar 19:00 (TR)
const gonderilen = []; let resendDurum = 200, resendSirasi = [];
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("api.resend.com")) {
    const durum = resendSirasi.length ? resendSirasi.shift() : resendDurum;
    if (durum === 200) gonderilen.push(JSON.parse(opt.body));
    return new Response("{}", { status: durum });
  }
  throw new Error("beklenmeyen ağ isteği " + url);
};
let mf, DB, env;
before(async () => {
  mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('ok'); } }", d1Databases: { DB: "veli-test" } });
  DB = await mf.getD1Database("DB");
  env = { DB, AKE_GIZLI: "d1-test-gizli", RESEND_API_KEY: "re_test", AKE_YONETICI: "yonetici@test.dev", VELI_RAPORU: "1" };
  await sema(env);
  const sql = readFileSync(new URL("../../migrations/0001_veli_raporu.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
  for (const st of sql.split(";").map(x => x.trim()).filter(Boolean)) await DB.prepare(st).run();
});
after(async () => { await mf.dispose(); });

let n = 0;
async function hazir(plan = "premium", yas = "kucuk") {
  const kid = await kullaniciBulVeyaAc(env, { eposta: `ogr${++n}-${Date.now()}@test.dev`, ad: "Deniz" });
  await DB.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih) VALUES (?, ?, ?, ?, ?)").bind("K" + n + Math.random(), kid, plan, "2099-01-01", Date.now()).run();
  await DB.prepare("INSERT INTO veri (kid, alan, json, u) VALUES (?, 'stats', ?, 1)").bind(kid, JSON.stringify({ daily: { "2026-11-02": { q: 10, c: 7, tp: { "mat|Problemler": 10 } }, "2026-11-04": { q: 20, c: 10, tp: { "mat|Problemler": 20 } } }, topic: { "mat|Problemler": [17, 13, 0] } })).run();
  gonderilen.length = 0; resendDurum = 200; resendSirasi = [];
  const r = await V.adresKaydet(env, kid, { eposta: `veli${n}@test.dev`, yas, ogrenciAd: "Deniz", origin: "https://akeakademi.com" }); assert.ok(r.ok, JSON.stringify(r));
  const tok = (gonderilen.at(-1).text.match(/[?&]t=([0-9a-f]+)/) || [])[1];
  assert.ok((await V.onayVer(env, tok)).ok); assert.ok((await V.etkinDegistir(env, kid, true)).ok);
  gonderilen.length = 0; resendDurum = 200; resendSirasi = [];
  return kid;
}
const log = kid => DB.prepare("SELECT durum, deneme, hata, sonraki FROM veli_log WHERE kid = ?").bind(kid).all().then(r => r.results);
const gon = (o = {}) => V.haftalikGonder(env, { now: SIMDI, aralikMs: 0, ...o });

test("D1 temel davranışları: INSERT OR IGNORE / UPDATE meta.changes ve batch geri alma", async () => {
  await DB.prepare("CREATE TABLE IF NOT EXISTS _t (id TEXT PRIMARY KEY, v TEXT)").run();
  assert.equal((await DB.prepare("INSERT OR IGNORE INTO _t VALUES ('a','1')").run()).meta.changes, 1);
  assert.equal((await DB.prepare("INSERT OR IGNORE INTO _t VALUES ('a','2')").run()).meta.changes, 0);
  assert.equal((await DB.prepare("UPDATE _t SET v='x' WHERE id='a' AND v='yok'").run()).meta.changes, 0);
  assert.equal((await DB.prepare("UPDATE _t SET v='x' WHERE id='a' AND v='1'").run()).meta.changes, 1);
  await assert.rejects(DB.batch([DB.prepare("INSERT INTO _t VALUES ('b','1')"), DB.prepare("INSERT INTO _t VALUES ('a','dup')")]));
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM _t WHERE id='b'").first()).n, 0, "batch tümüyle geri alınmalı");
});

test("haftalık gönderim: onaylı ve etkin öğrenciye tam 1 rapor gider, kayıt 'gonderildi', son gönderim yazılır", async () => {
  const kid = await hazir();
  const o = await gon();
  assert.equal(o.gonderildi, 1); assert.equal(gonderilen.length, 1);
  assert.equal(gonderilen[0].subject, "AKE Akademi | Haftalık Öğrenci Gelişim Raporu");
  const l = await log(kid); assert.equal(l.length, 1); assert.equal(l[0].durum, "gonderildi"); assert.equal(l[0].deneme, 1);
  assert.ok((await DB.prepare("SELECT son_gonderim FROM veli_ayar WHERE kid = ?").bind(kid).first()).son_gonderim);
  const tokenlar = (await DB.prepare("SELECT hash FROM veli_token WHERE kid = ?").bind(kid).all()).results;
  const ham = (gonderilen[0].text.match(/[?&]t=([0-9a-f]+)/) || [])[1];
  assert.ok(ham && tokenlar.every(t => t.hash !== ham), "belirteç düz metin saklanmamalı");
});

test("tekrar gönderim engeli: art arda ve 8 eşzamanlı çalıştırmada aynı hafta/adres için tek e-posta", async () => {
  const kid = await hazir();
  await gon(); assert.equal(gonderilen.length, 1);
  const ikinci = await gon(); assert.equal(gonderilen.length, 1); assert.equal(ikinci.gonderildi, 0);
  const kid2 = await hazir();
  const bas = gonderilen.length;
  await Promise.all(Array.from({ length: 8 }, () => gon()));
  const kid2Mail = gonderilen.slice(bas).filter(m => m.to && m.to.includes(`veli${n}@test.dev`) || JSON.stringify(m.to).includes(`veli${n}@test.dev`));
  assert.equal(kid2Mail.length, 1, "eşzamanlı çalıştırmada tekil olmalı");
  assert.equal((await log(kid2)).length, 1); assert.equal((await log(kid))[0].deneme, 1);
});

test("hata sonrası yeniden deneme: bekleme süresi dolmadan denenmez; süre sonra gönderilir; 3 başarısızlıkta kalıcı hata", async () => {
  const kid = await hazir();
  resendSirasi = [500];
  let o = await gon(); assert.equal(o.hata, 1); assert.equal(gonderilen.length, 0);
  let l = (await log(kid))[0]; assert.equal(l.durum, "hata"); assert.equal(l.deneme, 1);
  o = await gon({ now: SIMDI + 60e3 }); assert.equal(gonderilen.length, 0, "bekleme süresi dolmadan yeniden denenmemeli");
  o = await gon({ now: SIMDI + V.YENIDEN_MS + 1 }); assert.equal(o.gonderildi, 1); assert.equal(gonderilen.length, 1);
  l = (await log(kid))[0]; assert.equal(l.durum, "gonderildi"); assert.equal(l.deneme, 2);
  const kid2 = await hazir(); resendDurum = 500;
  for (let i = 0; i < 5; i++) await gon({ now: SIMDI + i * (V.YENIDEN_MS + 1) });
  l = (await log(kid2))[0]; assert.equal(l.durum, "hata"); assert.equal(l.deneme, V.MAKS_DENEME, "en fazla MAKS_DENEME deneme");
  const ozet = await V.yoneticiOzet(env, SIMDI + 6 * V.YENIDEN_MS); assert.ok(ozet.kalici >= 1);
});

test("izin iptali ve abonelik bitişi: gönderim kesinlikle durur", async () => {
  const a = await hazir(), b = await hazir(), c = await hazir();
  await V.izinGeriCek(env, a, "ogrenci");
  await DB.prepare("UPDATE kod SET bitis = '2020-01-01' WHERE kid = ?").bind(b).run();
  await V.etkinDegistir(env, c, false);
  const o = await gon();
  assert.equal(gonderilen.length, 0); assert.equal(o.gonderildi, 0);
  for (const k of [a, b, c]) assert.equal((await log(k)).filter(x => x.durum === "gonderildi").length, 0);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM veli_token WHERE kid = ? AND kullanildi = 0").bind(a).first()).n, 0, "iptalde açık belirteç kalmamalı");
});

test("parti sınırı: tek çalıştırmada en fazla 'parti' kadar öğrenci işlenir, kalanlar sonraki tetiklemeye kalır", async () => {
  await DB.prepare("UPDATE veli_ayar SET etkin = 0").run(); // önceki testlerin öğrencilerini devre dışı bırak
  const ids = []; for (let i = 0; i < 5; i++) ids.push(await hazir());
  let o = await gon({ parti: 2 }); assert.equal(o.gonderildi, 2); assert.equal(o.kalan, 1);
  o = await gon({ parti: 2 }); assert.equal(o.gonderildi, 2); assert.equal(o.kalan, 1);
  o = await gon({ parti: 2 }); assert.equal(o.gonderildi, 1); assert.equal(o.kalan, 0);
  assert.equal(gonderilen.length, 5);
  o = await gon({ parti: 2 }); assert.equal(o.gonderildi, 0); assert.equal(o.aday, 0, "gönderilmişler aday listesine girmemeli");
  for (const k of ids) assert.equal((await log(k)).length, 1);
});

test("özellik anahtarı kapalıyken (VELI_RAPORU yok) hiçbir gönderim yapılmaz", async () => {
  await hazir();
  const o = await V.haftalikGonder({ ...env, VELI_RAPORU: "" }, { now: SIMDI + 7 * 864e5, aralikMs: 0 });
  assert.equal(o.acik, false); assert.equal(gonderilen.length, 0);
});
