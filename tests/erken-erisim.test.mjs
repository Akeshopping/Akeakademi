// "Açıldığında haber ver" listesi testleri · çalıştırma: node --test tests/erken-erisim.test.mjs
// Gerçek SQLite (node:sqlite) kullanılır; Resend (e-posta) fetch sahtesiyle yakalanır. Gerçek e-posta GİTMEZ.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { onRequest } from "../functions/api/liste/[[yol]].js";
import { _semaSifirla, epostaTemizle, cikisBelirteci } from "../lib/liste.js";
import { _yedekSifirla } from "../lib/hiz.js";

const GIZLI = "t".repeat(40), ORIGIN = "https://onizleme.example";
function d1() {
  const db = new DatabaseSync(":memory:"); db.exec(fs.readFileSync(new URL("../migrations/0001_hiz_siniri.sql", import.meta.url), "utf8"));
  const hazir = (sql) => ({
    bind: (...a) => ({ sql, a, run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run().changes) } })
  });
  return { db, prepare: hazir, batch: async (l) => { for (const s of l) await s.run(); return []; } };
}
let DB, MAILLER, EPOSTA_BASARISIZ;
function ortam(ek) { return Object.assign({ DB, AKE_GIZLI: GIZLI, RESEND_API_KEY: "test" }, ek || {}); }
test.beforeEach(() => {
  DB = d1(); MAILLER = []; EPOSTA_BASARISIZ = false; _semaSifirla(); _yedekSifirla();
  globalThis.fetch = async (u, o) => { if (String(u).includes("api.resend.com")) { if (EPOSTA_BASARISIZ) return new Response("x", { status: 500 }); MAILLER.push(JSON.parse(o.body)); return new Response("{}", { status: 200 }); } throw new Error("beklenmeyen ağ: " + u); };
});
let ipSayac = 0;
const istek = (yol, { method = "POST", body, form, ip, origin, ek } = {}) => {
  const h = { "cf-connecting-ip": ip || "198.51.100." + (++ipSayac % 250 + 1) };
  let b; if (form) { h["content-type"] = "application/x-www-form-urlencoded"; b = new URLSearchParams(form).toString(); } else if (body !== undefined) { h["content-type"] = "application/json"; b = JSON.stringify(body); }
  if (origin !== null) h.origin = origin || ORIGIN;
  const p = yol.split("?")[0].split("/").filter(Boolean);
  return onRequest({ request: new Request(ORIGIN + "/api/liste/" + yol, { method, headers: h, body: method === "GET" ? undefined : b }), env: ortam(ek), params: { yol: p } });
};
const satir = e => DB.db.prepare("SELECT * FROM bekleme WHERE eposta = ?").get(e);
const say = () => { try { return DB.db.prepare("SELECT COUNT(*) n FROM bekleme").get().n; } catch (e) { return 0; } };
const tokenAl = (m) => (m.text.match(/onayla\?t=([0-9a-f]{32})/) || [])[1];
const cikisAl = (m) => { const r = m.text.match(/cik\?e=([^&\s]+)&t=([0-9a-f]{64})/); return r ? { e: decodeURIComponent(r[1]), t: r[2] } : null; };
const kayit = (e, ek) => istek("kaydet", { body: Object.assign({ eposta: e, izin: true, paket: "ikisi" }, ek || {}) });

test("1) geçerli kayıt: bekliyor, tek onay e-postası, 'ödeme alınmaz' metni, onay ve silme bağlantısı", async () => {
  const r = await kayit("Ogrenci@Ornek.com"); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, durum: "onay_gonderildi" });
  assert.equal(MAILLER.length, 1); const m = MAILLER[0];
  assert.deepEqual(m.to, ["ogrenci@ornek.com"]);
  assert.match(m.text, /Ödeme alınmaz, sipariş oluşmaz; paket ya da fiyat garantisi verilmez/); assert.match(m.html, /kampanya ya da reklam izni değildir/);
  assert.ok(tokenAl(m)); assert.ok(cikisAl(m));
  const s = satir("ogrenci@ornek.com"); assert.equal(s.durum, "bekliyor"); assert.equal(s.paket, "ikisi"); assert.ok(s.izin_zaman && s.izin_surum);
  assert.ok(!/198\.51\.100/.test(JSON.stringify(s)), "açık IP saklanmaz");
  assert.ok(!s.onay_hash.includes(tokenAl(m)), "belirteç açık yazılmaz");
});
test("2) izin yok / geçersiz adres / bal küpü", async () => {
  assert.equal((await istek("kaydet", { body: { eposta: "a@b.com" } })).status, 400);
  assert.equal((await istek("kaydet", { body: { eposta: "a@b.com", izin: false } })).status, 400);
  for (const k of ["", "abc", "a@b", "a b@c.com", "a@@c.com", "a@c..com", "<x>@c.com", "a@c.c", "x".repeat(300) + "@c.com", ".a@c.com", "a.@c.com", "a@-c.com", "a@c.com,b@d.com"]) {
    const r = await kayit(k); assert.equal(r.status, 400, "geçersiz: " + k.slice(0, 20)); assert.equal((await r.json()).error, "eposta_gecersiz");
  }
  const r = await istek("kaydet", { body: { eposta: "bot@ornek.com", izin: true, web: "http://spam" } });
  assert.equal(r.status, 200); assert.equal(MAILLER.length, 0); assert.equal(say(), 0);
  assert.equal(epostaTemizle("  A@B.Co "), "a@b.co");
});
test("3) tekrar kayıt: aynı yanıt, tek satır, 10 dk içinde ikinci e-posta yok; 10 dk sonra yeni belirteç eskisini geçersiz kılar", async () => {
  const a = await (await kayit("tekrar@ornek.com")).json(), b = await (await kayit("tekrar@ornek.com")).json();
  assert.deepEqual(a, b); assert.equal(say(), 1); assert.equal(MAILLER.length, 1);
  const eski = tokenAl(MAILLER[0]);
  DB.db.prepare("UPDATE bekleme SET son_gonderim = ?").run(Date.now() - 11 * 60e3);
  await kayit("tekrar@ornek.com"); assert.equal(MAILLER.length, 2); const yeni = tokenAl(MAILLER[1]); assert.notEqual(eski, yeni);
  assert.equal((await istek("onayla", { form: { t: eski } })).status, 200);   /* form yanıtı HTML sayfa: durum metinle */
  assert.equal(satir("tekrar@ornek.com").durum, "bekliyor", "eski belirteç onaylamaz");
  await istek("onayla", { body: { t: yeni } }); assert.equal(satir("tekrar@ornek.com").durum, "onayli");
});
test("4) eşzamanlı 3 kayıt (adres sınırı saatte 3): tek satır, tek e-posta", async () => {
  const l = await Promise.all([1, 2, 3].map(() => kayit("es@ornek.com")));
  assert.ok(l.every(r => r.status === 200)); assert.equal(say(), 1); assert.equal(MAILLER.length, 1);
});
test("5) onay: GET durum değiştirmez, POST onaylar, çift tık hata vermez, bozuk/süresi dolmuş reddedilir", async () => {
  await kayit("onay@ornek.com"); const t = tokenAl(MAILLER[0]);
  const g = await istek("onayla?t=" + t, { method: "GET" }); assert.equal(g.status, 200); assert.match(await g.text(), /<form method="post"/); assert.equal(satir("onay@ornek.com").durum, "bekliyor");
  const p = await istek("onayla", { body: { t } }); assert.deepEqual(await p.json(), { ok: true, durum: "onaylandi" }); const s = satir("onay@ornek.com"); assert.equal(s.durum, "onayli"); assert.ok(s.onay_zaman);
  assert.deepEqual(await (await istek("onayla", { body: { t } })).json(), { ok: true, durum: "zaten_onayli" });
  assert.equal((await istek("onayla", { body: { t: "0".repeat(32) } })).status, 400); assert.equal((await istek("onayla", { body: { t: "zzz" } })).status, 400);
  await kayit("sure@ornek.com"); const t2 = tokenAl(MAILLER[1]); DB.db.prepare("UPDATE bekleme SET onay_son = ? WHERE eposta = 'sure@ornek.com'").run(Date.now() - 1000);
  assert.equal((await istek("onayla", { body: { t: t2 } })).status, 400); assert.equal(satir("sure@ornek.com").durum, "bekliyor");
});
test("6) onaylı adres tekrar kaydolursa: aynı yanıt, yeni e-posta yok, durum bozulmaz", async () => {
  await kayit("o@ornek.com"); await istek("onayla", { body: { t: tokenAl(MAILLER[0]) } });
  const r = await (await kayit("o@ornek.com")).json(); assert.deepEqual(r, { ok: true, durum: "onay_gonderildi" }); assert.equal(MAILLER.length, 1); assert.equal(satir("o@ornek.com").durum, "onayli");
});
test("7) hız sınırı: IP başına 10/saat, adres başına 3/saat; 429 + Retry-After", async () => {
  for (let i = 0; i < 10; i++) assert.equal((await istek("kaydet", { body: { eposta: `u${i}@ornek.com`, izin: true }, ip: "203.0.113.9" })).status, 200);
  const r = await istek("kaydet", { body: { eposta: "u99@ornek.com", izin: true }, ip: "203.0.113.9" }); assert.equal(r.status, 429); assert.ok(r.headers.get("retry-after"));
  for (let i = 0; i < 3; i++) assert.equal((await kayit("ayni@ornek.com")).status, 200);
  assert.equal((await kayit("ayni@ornek.com")).status, 429);
});
test("8) silme: imzalı bağlantı siler, imzasız/yanlış imza silmez, GET silmez; 'Kaydımı sil' formu yalnız kayıtlıya bağlantı yollar", async () => {
  await kayit("sil@ornek.com"); await kayit("kalan@ornek.com"); const c = cikisAl(MAILLER[0]); assert.equal(c.e, "sil@ornek.com");
  const g = await istek(`cik?e=${encodeURIComponent(c.e)}&t=${c.t}`, { method: "GET" }); assert.match(await g.text(), /Kaydımı sil/); assert.ok(satir("sil@ornek.com"));
  assert.equal((await istek("cik", { body: { e: "sil@ornek.com", t: "0".repeat(64) } })).status, 400); assert.equal((await istek("cik", { body: { e: "kalan@ornek.com", t: c.t } })).status, 400);
  assert.ok(satir("sil@ornek.com") && satir("kalan@ornek.com"));
  assert.deepEqual(await (await istek("cik", { body: c })).json(), { ok: true, durum: "silindi" }); assert.equal(satir("sil@ornek.com"), undefined); assert.ok(satir("kalan@ornek.com"));
  const n = MAILLER.length;
  const k = await (await istek("sil-iste", { body: { eposta: "kalan@ornek.com" } })).json(), y = await (await istek("sil-iste", { body: { eposta: "yok@ornek.com" } })).json();
  assert.deepEqual(k, y); assert.equal(MAILLER.length, n + 1); assert.deepEqual(MAILLER[n].to, ["kalan@ornek.com"]); assert.ok(cikisAl(MAILLER[n]));
  assert.equal(await cikisBelirteci(ortam(), "kalan@ornek.com"), cikisAl(MAILLER[n]).t);
  assert.ok((await (await istek("cik", { form: cikisAl(MAILLER[n]) })).text()).includes("Kaydın silindi")); assert.equal(say(), 0);
});
test("9) e-posta gönderilemezse 502 ve bekleyen satır geri alınır (yeniden denenebilir)", async () => {
  EPOSTA_BASARISIZ = true; const r = await kayit("g@ornek.com"); assert.equal(r.status, 502); assert.equal(say(), 0);
  EPOSTA_BASARISIZ = false; assert.equal((await kayit("g@ornek.com")).status, 200); assert.equal(say(), 1);
});
test("10) AKE_GIZLI yoksa 503 (zayıf varsayılan yok); farklı Origin 403; bilinmeyen uç 404; yanlış yöntem 404", async () => {
  assert.equal((await istek("kaydet", { body: { eposta: "a@b.com", izin: true }, ek: { AKE_GIZLI: "" } })).status, 503);
  assert.equal((await istek("kaydet", { body: { eposta: "a@b.com", izin: true }, origin: "https://kotu.example" })).status, 403);
  assert.equal((await istek("yok", { body: {} })).status, 404); assert.equal((await istek("kaydet", { method: "GET" })).status, 404);
});
test("11) toplu gönderim yok: modülde döngüyle e-posta gönderen kod bulunmaz; her gönderim tek alıcı", () => {
  const k = fs.readFileSync(new URL("../lib/liste.js", import.meta.url), "utf8") + fs.readFileSync(new URL("../functions/api/liste/[[yol]].js", import.meta.url), "utf8");
  assert.equal((k.match(/epostaGonder\(/g) || []).length, 2); assert.ok(!/for\s*\([^)]*\)\s*\{?[^}]*epostaGonder/.test(k)); assert.ok(!/\.map\([^)]*epostaGonder/.test(k));
});
