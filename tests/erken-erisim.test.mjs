// "Açıldığında haber ver" listesi testleri · çalıştırma: node --test tests/erken-erisim.test.mjs
// Gerçek SQLite (node:sqlite) kullanılır; Resend (e-posta) fetch sahtesiyle yakalanır. Gerçek e-posta GİTMEZ.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { onRequest } from "../functions/api/liste/[[yol]].js";
import { _semaSifirla, epostaTemizle, cikisBelirteci, suresiDolanlariTemizle } from "../lib/liste.js";
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
  assert.equal((k.match(/epostaGonder\(/g) || []).length, 3);   /* kayıt, silme bağlantısı, yeni onay: hepsi tek alıcı */ assert.ok(!/for\s*\([^)]*\)\s*\{?[^}]*epostaGonder/.test(k)); assert.ok(!/\.map\([^)]*epostaGonder/.test(k));
});

/* ---- onay güvenilirliği: neden ayrımı, yeni onay e-postası, günlük, temizlik ---- */
const eskiyeAl = (e, dk) => DB.db.prepare("UPDATE bekleme SET son_gonderim = ? WHERE eposta = ?").run(Date.now() - dk * 60e3, e);
const yeniOnayIste = (e, o) => istek("yeni-onay", Object.assign({ body: { eposta: e } }, o || {}));
const sayfaMetni = async r => (await r.text());

test("12) başarısız onay: neden ayrı (süresi dolmuş / eski-bilinmeyen / bozuk); satır bozulmaz; sayfada yeni e-posta formu", async () => {
  await kayit("a12@ornek.com"); const t = tokenAl(MAILLER[0]);
  let r = await istek("onayla", { body: { t: "0".repeat(32) } }); assert.equal(r.status, 400); assert.equal((await r.json()).error, "eski_baglanti");
  r = await istek("onayla", { body: { t: "zzz" } }); assert.equal(r.status, 400); assert.equal((await r.json()).error, "gecersiz");
  DB.db.prepare("UPDATE bekleme SET onay_son = ? WHERE eposta = 'a12@ornek.com'").run(Date.now() - 1000);
  r = await istek("onayla", { body: { t } }); assert.equal(r.status, 400); assert.equal((await r.json()).error, "suresi_doldu"); assert.equal(satir("a12@ornek.com").durum, "bekliyor");
  /* insan sayfaları (form POST) */
  let h = await sayfaMetni(await istek("onayla", { form: { t: "0".repeat(32) } })); assert.match(h, /Bu bağlantı artık geçerli değil/); assert.match(h, /action="\/api\/liste\/yeni-onay"/);
  h = await sayfaMetni(await istek("onayla", { form: { t } })); assert.match(h, /süresi dolmuş/); assert.ok(!/yeni-onay/.test(h), "süresi dolanda e-posta formu yok; formu yeniden doldur"); assert.match(h, /href="\/#premium"/);
  h = await sayfaMetni(await istek("onayla?t=zz", { method: "GET" })); assert.match(h, /Bağlantı geçersiz/); assert.match(h, /yeni-onay/);
  assert.ok(!h.includes("a12@ornek.com"));
});
test("13) yeni onay e-postası: eski bağlantı çalışmaz, yeni çalışır; 10 dk içinde ikinci e-posta yok; yanıt hep aynı", async () => {
  await kayit("a13@ornek.com"); const eski = tokenAl(MAILLER[0]); assert.equal(MAILLER.length, 1);
  const yakin = await yeniOnayIste("a13@ornek.com"); assert.equal(yakin.status, 200); const govdeYakin = await yakin.json(); assert.equal(MAILLER.length, 1, "10 dk içinde yeni e-posta yok");
  eskiyeAl("a13@ornek.com", 11);
  const gitti = await yeniOnayIste("a13@ornek.com"); assert.equal(gitti.status, 200); assert.deepEqual(await gitti.json(), govdeYakin); assert.equal(MAILLER.length, 2);
  assert.deepEqual(MAILLER[1].to, ["a13@ornek.com"]); const yeni = tokenAl(MAILLER[1]); assert.ok(yeni && yeni !== eski);
  assert.equal(satir("a13@ornek.com").durum, "bekliyor");
  let r = await istek("onayla", { body: { t: eski } }); assert.equal((await r.json()).error, "eski_baglanti", "eski bağlantı geçersiz");
  r = await istek("onayla", { body: { t: yeni } }); assert.deepEqual(await r.json(), { ok: true, durum: "onaylandi" }); assert.equal(satir("a13@ornek.com").durum, "onayli");
  /* tekrar deneme: yeni bağlantıya tekrar basmak hata vermez; onaylı adrese yeni e-posta gitmez */
  assert.deepEqual(await (await istek("onayla", { body: { t: yeni } })).json(), { ok: true, durum: "zaten_onayli" });
  await kayit("b13@ornek.com"); await istek("onayla", { body: { t: tokenAl(MAILLER[MAILLER.length - 1]) } }); assert.equal(satir("b13@ornek.com").durum, "onayli");
  eskiyeAl("b13@ornek.com", 30); const n = MAILLER.length; const o = await yeniOnayIste("b13@ornek.com"); assert.deepEqual(await o.json(), govdeYakin); assert.equal(MAILLER.length, n); assert.equal(satir("b13@ornek.com").durum, "onayli");
  /* kaydı olmayan adres: aynı yanıt, e-posta yok, satır oluşmaz */
  const hic = await yeniOnayIste("yok@ornek.com"); assert.deepEqual(await hic.json(), govdeYakin); assert.equal(MAILLER.length, n); assert.equal(satir("yok@ornek.com"), undefined);
  /* geçersiz adres 400; form (insan) sayfası adres göstermez */
  assert.equal((await yeniOnayIste("bozuk")).status, 400);
  const sayfa1 = await sayfaMetni(await istek("yeni-onay", { form: { eposta: "c13@ornek.com" } })); assert.match(sayfa1, /Kontrol et/); assert.ok(!sayfa1.includes("c13@ornek.com"));
  assert.match(await sayfaMetni(await istek("yeni-onay", { method: "GET" })), /action="\/api\/liste\/yeni-onay"/);
});
test("14) yeni onay mevcut hız sınırlarını AŞMAZ: kayıtla aynı adres kovası (3/sa) ve IP kovası (10/sa)", async () => {
  await kayit("a14@ornek.com");                                           // adres kovası: 1
  eskiyeAl("a14@ornek.com", 11); assert.equal((await yeniOnayIste("a14@ornek.com")).status, 200);   // 2
  eskiyeAl("a14@ornek.com", 11); assert.equal((await yeniOnayIste("a14@ornek.com")).status, 200);   // 3
  const r = await yeniOnayIste("a14@ornek.com"); assert.equal(r.status, 429); assert.ok(r.headers.get("retry-after")); assert.equal(MAILLER.length, 3);
  const ip = "203.0.113.9";
  for (let i = 0; i < 10; i++) assert.equal((await yeniOnayIste("ip" + i + "@ornek.com", { ip })).status, 200);
  assert.equal((await yeniOnayIste("ip10@ornek.com", { ip })).status, 429);
});
test("15) yeni onay e-postası gönderilemezse 502 ve ESKİ bağlantı çalışmaya devam eder (belirteç geri alınır)", async () => {
  await kayit("a15@ornek.com"); const eski = tokenAl(MAILLER[0]); eskiyeAl("a15@ornek.com", 11);
  const once = satir("a15@ornek.com"); EPOSTA_BASARISIZ = true;
  const r = await yeniOnayIste("a15@ornek.com"); assert.equal(r.status, 502); assert.equal((await r.json()).error, "eposta_gitmedi");
  const sonra = satir("a15@ornek.com"); assert.equal(sonra.onay_hash, once.onay_hash); assert.equal(sonra.onay_son, once.onay_son); assert.equal(sonra.son_gonderim, once.son_gonderim);
  EPOSTA_BASARISIZ = false; assert.deepEqual(await (await istek("onayla", { body: { t: eski } })).json(), { ok: true, durum: "onaylandi" });
});
test("16) günlük: yalnızca genel neden kodu; adres, belirteç, özet, IP yok", async () => {
  const satirlar = [], eski = console.warn; console.warn = (...a) => satirlar.push(a.join(" "));
  try {
    await kayit("gizli16@ornek.com"); const t = tokenAl(MAILLER[0]);
    await istek("onayla", { body: { t: "0".repeat(32) } }); await istek("onayla", { body: { t: "zzz" } });
    eskiyeAl("gizli16@ornek.com", 11); await yeniOnayIste("gizli16@ornek.com"); await yeniOnayIste("gizli16@ornek.com"); await yeniOnayIste("yok16@ornek.com"); await yeniOnayIste("bozuk");
    await istek("onayla", { body: { t } }); await istek("onayla", { body: { t: tokenAl(MAILLER[1]) } });
    EPOSTA_BASARISIZ = true; await kayit("b16@ornek.com"); eskiyeAl("b16@ornek.com", 11);
  } finally { console.warn = eski; }
  assert.ok(satirlar.length >= 6, "günlük yazılıyor");
  const tum = satirlar.join("\n");
  for (const l of satirlar) assert.match(l, /^liste (onayla|yeni-onay) neden=[a-z_]+$/, l);
  assert.ok(!/@|ornek\.com|gizli16/.test(tum), "adres yok"); assert.ok(!/[0-9a-f]{32}/.test(tum), "belirteç/özet yok"); assert.ok(!/198\.51|203\.0/.test(tum), "IP yok");
  for (const n of ["eski_baglanti", "bicim", "gonderildi", "kayit_yok", "adres_gecersiz", "onaylandi"]) assert.ok(tum.includes("neden=" + n), n);
});
test("17) süresi dolan BEKLEYEN kayıtlar silinir; onaylı ve süresi açık olanlara dokunulmaz; kayıt isteği de temizler", async () => {
  const ekle = (e, durum, onaySon) => DB.db.prepare("INSERT INTO bekleme (eposta, durum, paket, kayit, onay_hash, onay_son, son_gonderim, izin_surum, izin_zaman) VALUES (?, ?, 'ikisi', 1, ?, ?, 1, 'x', 1)").run(e, durum, "h" + e, onaySon);
  await kayit("ilk17@ornek.com");                                          // tabloyu kurar
  const simdi = Date.now();
  ekle("dolmus1@ornek.com", "bekliyor", simdi - 1000); ekle("dolmus2@ornek.com", "bekliyor", simdi - 5 * 86400e3);
  ekle("acik@ornek.com", "bekliyor", simdi + 3600e3); ekle("onayli-eski@ornek.com", "onayli", simdi - 9 * 86400e3);
  assert.equal(await suresiDolanlariTemizle({ DB }, simdi), 2);
  assert.ok(!satir("dolmus1@ornek.com") && !satir("dolmus2@ornek.com")); assert.ok(satir("acik@ornek.com")); assert.ok(satir("onayli-eski@ornek.com")); assert.ok(satir("ilk17@ornek.com"));
  assert.equal(await suresiDolanlariTemizle({ DB }, simdi), 0, "tekrar çalıştırmak zarar vermez");
  for (let i = 0; i < 130; i++) ekle("t" + i + "@ornek.com", "bekliyor", simdi - 1000);
  assert.equal(await suresiDolanlariTemizle({ DB }, simdi), 100, "bir seferde en çok 100"); assert.equal(await suresiDolanlariTemizle({ DB }, simdi), 30);
  ekle("dolmus3@ornek.com", "bekliyor", Date.now() - 1000);
  await kayit("tetik17@ornek.com"); assert.ok(!satir("dolmus3@ornek.com"), "kayıt isteği süresi dolanları temizler"); assert.ok(satir("tetik17@ornek.com"));
  ekle("dolmus4@ornek.com", "bekliyor", Date.now() - 1000);
  await yeniOnayIste("hic17@ornek.com"); assert.ok(!satir("dolmus4@ornek.com"), "yeni-onay isteği de temizler");
});
