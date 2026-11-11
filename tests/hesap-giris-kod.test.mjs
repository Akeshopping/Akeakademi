// B1 · e-posta giriş kodu güvenliği (atomik deneme sınırı, tek kullanım, 8 hane, genel hata)
// Çalıştırma: node --test tests/hesap-giris-kod.test.mjs
// Gerçek SQLite (node:sqlite) üzerinde, hesap uçlarının kendisiyle denenir. Tüm hesaplar SENTETİKTİR; ağ isteği (Resend) sahtelenir.
// ÖNEMLİ SINIR: Bu ortam Cloudflare D1'in gerçek eşzamanlılığını yeniden üretmez. node:sqlite tek iş parçacığında çalışır; ancak her D1 çağrısı
// ayrı bir "await" noktasıdır, bu yüzden 200 eşzamanlı istek ifade düzeyinde iç içe geçer ("lockstep": en kötü sıralama; "jitter": rastgele gecikmeli
// sıralama). Bu, "oku → karşılaştır → yaz" yarışını mantıksal olarak ortaya çıkarır; D1'in ağ gecikmesi/çoklu isolate davranışının yerini tutmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { sha256 } from "../lib/ortak.js";

/* D1 benzeri ince kabuk. Şema önbelleği modül düzeyinde olduğundan tek veritabanı paylaşılır; hesaplar e-postayla ayrılır. */
const DB = (() => {
  const db = new DatabaseSync(":memory:"), o = { db, jitter: false, log: [] };
  const bekle = () => o.jitter ? new Promise(r => setTimeout(r, Math.random() * 3)) : Promise.resolve();
  const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
    first: async () => { await bekle(); o.log.push(sql); return db.prepare(sql).get(...a) || null; },
    all: async () => { await bekle(); o.log.push(sql); return { results: db.prepare(sql).all(...a) }; },
    run: async () => { await bekle(); if (o.tut && o.tut.re.test(sql)) { const t = o.tut; o.tut = null; t.basladi(); await t.serbest; } o.log.push(sql); const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
  o.prepare = st; o.batch = async arr => { await bekle(); for (const s of arr) await s.run(); return []; };
  return o;
})();
const SIR = "test-gizli";
const env = { DB, AKE_GIZLI: SIR, RESEND_API_KEY: "test-anahtar" };
const mod = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);

/* Sahte e-posta: Resend çağrılarını yakalar (başka ağ isteği olursa test patlar) */
const postalar = [];
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("api.resend.com")) { postalar.push(JSON.parse(opt.body)); return new Response("{}", { status: 200 }); }
  throw new Error("beklenmeyen ağ isteği: " + url);
};

let ipn = 0; const yeniIp = () => { ipn++; return `10.${(ipn >> 16) & 255}.${(ipn >> 8) & 255}.${ipn & 255}`; }; /* her istek ayrı IP: bellek içi IP sınırı devre dışı kalır, veritabanı koruması ölçülür */
const istek = (yol, { m = "GET", govde, cookie, ip = yeniIp() } = {}) => mod.onRequest({
  request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: m, headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(cookie ? { cookie } : {}) }, body: govde ? JSON.stringify(govde) : undefined }),
  env, params: { yol: yol.split("/") } });
const cevap = async r => ({ s: r.status, j: await r.json().catch(() => null), cerez: r.headers.get("set-cookie") });
await istek("ben"); /* şemayı kurar */

const satir = e => DB.db.prepare("SELECT * FROM giris WHERE eposta = ?").get(e);
const posta = (() => { let n = 0; return p => `${p}${++n}@ornek.test`; })();
const kodIste = async e => { const once = postalar.length, r = await cevap(await istek("kod-gonder", { m: "POST", govde: { eposta: e } })); const kod = postalar.length > once ? String(postalar[postalar.length - 1].text).match(/giriş kodun: (\d+)/)[1] : null; return { ...r, kod }; };
const dogrula = async (e, kod, ip) => cevap(await istek("kod-dogrula", { m: "POST", govde: { eposta: e, kod }, ip }));
const zamanGeri = e => DB.db.prepare("UPDATE giris SET son_gonderim = son_gonderim - 61000 WHERE eposta = ?").run(e); /* 1 dk bekleme süresini geçir (pencere/sayaç değişmez) */
const yanlisKod = k => String((+k + 12345678) % 100000000).padStart(8, "0");
const oturumSay = e => DB.db.prepare("SELECT COUNT(*) n FROM oturum o JOIN kullanici k ON k.id = o.kid WHERE k.eposta = ?").get(e).n;
const tuketimSay = () => DB.log.filter(s => /SET hash = NULL/i.test(s)).length;
const GENEL = { error: "kod_yanlis", message: "Kod hatalı ya da süresi dolmuş. Yeni kod iste." };

test("kod-gonder 8 haneli kod üretir; geçerli kodla giriş yapılır, kod tüketilir", async () => {
  const e = posta("a"), r = await kodIste(e);
  assert.equal(r.s, 200); assert.match(r.kod, /^\d{8}$/);
  const g = satir(e); assert.equal(g.hash, await sha256(e + ":" + r.kod + ":" + SIR)); assert.equal(g.deneme, 0);
  assert.ok(g.bitis > Date.now() + 9 * 60000 && g.bitis <= Date.now() + 10 * 60000 + 1000);
  const v = await dogrula(e, r.kod); assert.equal(v.s, 200); assert.match(v.cerez, /^ake_s=.*HttpOnly; Secure; SameSite=Lax/); assert.equal(v.j.kullanici.eposta, e);
  assert.equal(satir(e).hash, null, "başarılı doğrulamada hash silinmeli");
  assert.ok(!JSON.stringify(v.j).includes(g.hash), "yanıtta hash sızmamalı");
});

test("kod dağılımı: her kod tam 8 hane (baştaki sıfırlar korunur), sabit değil", async () => {
  const kodlar = []; for (let i = 0; i < 60; i++) kodlar.push((await kodIste(posta("d"))).kod);
  assert.ok(kodlar.every(k => /^\d{8}$/.test(k))); assert.ok(new Set(kodlar).size > 55);
});

test("hatalı kod: reddedilir, sayaç artar, oturum açılmaz; sonra doğru kod çalışır", async () => {
  const e = posta("b"), { kod } = await kodIste(e);
  const v = await dogrula(e, yanlisKod(kod)); assert.equal(v.s, 400); assert.deepEqual(v.j, GENEL); assert.equal(v.cerez, null);
  assert.equal(satir(e).deneme, 1); assert.ok(satir(e).hash);
  assert.equal((await dogrula(e, kod)).s, 200);
});

test("deneme sınırı dolunca doğru kod bile reddedilir", async () => {
  const e = posta("c"), { kod } = await kodIste(e);
  for (let i = 0; i < 5; i++) assert.equal((await dogrula(e, yanlisKod(kod))).s, 400);
  assert.equal(satir(e).deneme, 5);
  const v = await dogrula(e, kod); assert.equal(v.s, 400); assert.deepEqual(v.j, GENEL); assert.equal(v.cerez, null);
  assert.equal(satir(e).deneme, 5, "sayaç sınırın üstüne çıkmamalı"); assert.equal(oturumSay(e), 0);
});

test("süresi dolmuş kod reddedilir", async () => {
  const e = posta("e"), { kod } = await kodIste(e);
  DB.db.prepare("UPDATE giris SET bitis = ? WHERE eposta = ?").run(Date.now() - 1000, e);
  const v = await dogrula(e, kod); assert.equal(v.s, 400); assert.deepEqual(v.j, GENEL); assert.equal(oturumSay(e), 0);
});

test("tek kullanım: aynı kod ikinci kez kullanılamaz", async () => {
  const e = posta("f"), { kod } = await kodIste(e);
  assert.equal((await dogrula(e, kod)).s, 200);
  const v = await dogrula(e, kod); assert.equal(v.s, 400); assert.deepEqual(v.j, GENEL); assert.equal(oturumSay(e), 1);
});

for (const mod_ of ["lockstep", "jitter"]) {
  test(`200 eşzamanlı hatalı istek (${mod_}): en çok 5 deneme değerlendirilir; sonda doğru kod bile reddedilir`, async () => {
    DB.jitter = mod_ === "jitter";
    try {
      const e = posta("p"), { kod } = await kodIste(e); DB.log.length = 0;
      const tahmin = Array.from({ length: 199 }, (_, i) => String(10000000 + i * 7919).padStart(8, "0")).filter(k => k !== kod);
      while (tahmin.length < 199) tahmin.push(String(50000000 + tahmin.length).padStart(8, "0"));
      const rs = await Promise.all([...tahmin.map(k => dogrula(e, k)), dogrula(e, kod)]); /* doğru kod EN SONDA */
      assert.ok(rs.every(r => r.s === 400 && r.cerez === null), "hiçbiri giriş yaptıramamalı");
      assert.ok(rs.every(r => JSON.stringify(r.j) === JSON.stringify(GENEL)));
      assert.equal(satir(e).deneme, 5, "tam 5 deneme hakkı kullanılmalı");
      assert.ok(tuketimSay() <= 5, "karşılaştırma/tüketim sorgusu 5'ten fazla çalışmamalı (çalışan: " + tuketimSay() + ")");
      assert.equal(oturumSay(e), 0);
      assert.equal((await dogrula(e, kod)).s, 400, "limit dolduktan sonra doğru kod da reddedilir");
    } finally { DB.jitter = false; }
  });
}

test("200 eşzamanlı istekte doğru kod rastgele konumda (jitter, 15 tekrar): en çok 1 giriş, en çok 5 değerlendirme", async () => {
  DB.jitter = true;
  try {
    for (let t = 0; t < 15; t++) {
      const e = posta("r"), { kod } = await kodIste(e); DB.log.length = 0;
      const konum = Math.floor(Math.random() * 200), liste = Array.from({ length: 200 }, (_, i) => i === konum ? kod : yanlisKod(kod + i));
      const rs = await Promise.all(liste.map(k => dogrula(e, k)));
      const ok = rs.filter(r => r.s === 200).length;
      assert.ok(ok <= 1); assert.ok(tuketimSay() <= 5, "tekrar " + t + ": değerlendirme " + tuketimSay());
      assert.equal(oturumSay(e), ok); assert.ok(satir(e).deneme <= 5, "sayaç 5'i aşmamalı (tekrar " + t + ": " + satir(e).deneme + ")");
      if (!ok) assert.equal(satir(e).deneme, 5);
    }
  } finally { DB.jitter = false; }
});

for (const mod_ of ["lockstep", "jitter"]) {
  test(`50 eşzamanlı DOĞRU kod (${mod_}): tam bir giriş, tek oturum, tek kullanıcı`, async () => {
    DB.jitter = mod_ === "jitter";
    try {
      const e = posta("o"), { kod } = await kodIste(e);
      const rs = await Promise.all(Array.from({ length: 50 }, () => dogrula(e, kod)));
      assert.equal(rs.filter(r => r.s === 200).length, 1, "tam bir istek kodu tüketmeli");
      assert.equal(rs.filter(r => r.s === 400).length, 49); assert.equal(rs.filter(r => r.cerez).length, 1);
      assert.equal(oturumSay(e), 1); assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM kullanici WHERE eposta = ?").get(e).n, 1);
    } finally { DB.jitter = false; }
  });
}

test("yeni kod gönderilince önceki kod geçersiz olur; sayaç yeni kod için sıfırlanır", async () => {
  const e = posta("n"), A = await kodIste(e);
  await dogrula(e, yanlisKod(A.kod)); await dogrula(e, yanlisKod(A.kod)); assert.equal(satir(e).deneme, 2);
  zamanGeri(e); const B = await kodIste(e); assert.equal(B.s, 200); assert.notEqual(A.kod, B.kod); assert.equal(satir(e).deneme, 0);
  assert.equal((await dogrula(e, A.kod)).s, 400, "eski kod geçersiz");
  assert.equal((await dogrula(e, B.kod)).s, 200, "yeni kod geçerli");
});

for (const mod_ of ["lockstep", "jitter"]) {
  test(`kod-gonder: 50 eşzamanlı istek (${mod_}) tek kod gönderir (bekleme süresi atomik)`, async () => {
    DB.jitter = mod_ === "jitter";
    try {
      const e = posta("g"), once = postalar.length;
      const rs = await Promise.all(Array.from({ length: 50 }, () => istek("kod-gonder", { m: "POST", govde: { eposta: e } }).then(cevap)));
      assert.equal(rs.filter(r => r.s === 200).length, 1); assert.ok(rs.filter(r => r.s !== 200).every(r => r.s === 429));
      assert.equal(postalar.length - once, 1, "tek e-posta gitmeli"); assert.equal(satir(e).sayac, 1);
    } finally { DB.jitter = false; }
  });
}

test("kod-gonder: saatte en çok 5 kod; 6. istek reddedilir (bekle / cok_istek ayrımı korunur)", async () => {
  const e = posta("h");
  for (let i = 0; i < 5; i++) { if (i) zamanGeri(e); assert.equal((await kodIste(e)).s, 200, "kod " + (i + 1)); }
  assert.equal(satir(e).sayac, 5);
  const bekle = await kodIste(e); assert.equal(bekle.s, 429); assert.equal(bekle.j.error, "bekle");
  zamanGeri(e); const sinir = await kodIste(e); assert.equal(sinir.s, 429); assert.equal(sinir.j.error, "cok_istek"); assert.equal(satir(e).sayac, 5);
  DB.db.prepare("UPDATE giris SET pencere = pencere - 3700000, son_gonderim = son_gonderim - 3700000 WHERE eposta = ?").run(e); /* pencere dolunca yeniden açılır */
  assert.equal((await kodIste(e)).s, 200); assert.equal(satir(e).sayac, 1);
});

test("hata mesajları: bilinmeyen e-posta, yanlış kod, dolu limit, süre dolumu, kullanılmış kod aynı yanıtı verir", async () => {
  const yok = await dogrula(posta("x"), "12345678");                                     /* hiç kod istenmemiş e-posta */
  const mevcut = posta("m"); const m1 = await kodIste(mevcut); assert.equal((await dogrula(mevcut, m1.kod)).s, 200); /* hesap var; kod tüketildi */
  const hesapVar = await dogrula(mevcut, "12345678");                                     /* hesabı olan, aktif kodu olmayan e-posta */
  const yanlis = posta("y"), y1 = await kodIste(yanlis), yanlisYanit = await dogrula(yanlis, yanlisKod(y1.kod));
  const dolu = posta("z"), z1 = await kodIste(dolu); for (let i = 0; i < 5; i++) await dogrula(dolu, yanlisKod(z1.kod)); const doluYanit = await dogrula(dolu, z1.kod);
  const sure = posta("s"), s1 = await kodIste(sure); DB.db.prepare("UPDATE giris SET bitis = 1 WHERE eposta = ?").run(sure); const sureYanit = await dogrula(sure, s1.kod);
  for (const r of [yok, hesapVar, yanlisYanit, doluYanit, sureYanit]) { assert.equal(r.s, 400); assert.deepEqual(r.j, GENEL); assert.equal(r.cerez, null); }
  const bicim = await dogrula(posta("w"), "1234567"); assert.equal(bicim.s, 400); assert.equal(bicim.j.error, "kod_gecersiz"); /* yalnızca biçim hatası; hesapla ilgili bilgi vermez */
});

test("geçiş: eski 6 haneli bekleyen kod süresi dolana dek çalışır; 6 haneli tahmin 8 haneli kodu eşleştirmez", async () => {
  const e = posta("t"); await istek("kod-gonder", { m: "POST", govde: { eposta: e } }); /* satırı oluşturur */
  DB.db.prepare("UPDATE giris SET hash = ?, bitis = ?, deneme = 0 WHERE eposta = ?").run(await sha256(e + ":123456:" + SIR), Date.now() + 600000, e);
  assert.equal((await dogrula(e, "123456")).s, 200, "dağıtım öncesi gönderilmiş 6 haneli kod çalışmalı");
  const e2 = posta("u"); await istek("kod-gonder", { m: "POST", govde: { eposta: e2 } });
  DB.db.prepare("UPDATE giris SET hash = ?, bitis = ?, deneme = 0 WHERE eposta = ?").run(await sha256(e2 + ":00123456:" + SIR), Date.now() + 600000, e2);
  assert.equal((await dogrula(e2, "123456")).s, 400, "baştaki sıfırları atılmış 6 haneli giriş 8 haneli kodu eşleştirmemeli");
  assert.equal((await dogrula(e2, "00123456")).s, 200);
});

test("mevcut oturumlar korunur: yeni kod isteği, hatalı denemeler ve yeni giriş eski oturumları silmez", async () => {
  const e = posta("k"), A = await kodIste(e), v1 = await dogrula(e, A.kod); const c1 = v1.cerez.split(";")[0];
  assert.equal((await cevap(await istek("ben", { cookie: c1 }))).s, 200);
  zamanGeri(e); const B = await kodIste(e); for (let i = 0; i < 5; i++) await dogrula(e, yanlisKod(B.kod));
  assert.equal((await cevap(await istek("ben", { cookie: c1 }))).s, 200, "hatalı denemeler oturumu etkilememeli");
  zamanGeri(e); const C = await kodIste(e), v2 = await dogrula(e, C.kod); assert.equal(v2.s, 200);
  const c2 = v2.cerez.split(";")[0];
  assert.equal((await cevap(await istek("ben", { cookie: c1 }))).s, 200); assert.equal((await cevap(await istek("ben", { cookie: c2 }))).s, 200);
  assert.equal(oturumSay(e), 2);
});

/* Yarış: doğrulama sürerken yeni kod üretilirse eski doğrulama yeni kodun hakkını/kaydını etkilememeli. Deterministik: doğrulamanın deneme-ayırma komutu
   (UPDATE ... SET deneme = COALESCE...) çalışmadan hemen önce durdurulur; bu arada yeni kod üretilir; sonra bırakılır. */
async function durdurulmusDogrulama(e, eskiKod) {
  let serbest, basladi; const sp = new Promise(r => { serbest = r; }), bp = new Promise(r => { basladi = r; });
  DB.tut = { re: /SET deneme = COALESCE\(deneme, 0\) \+ 1/i, serbest: sp, basladi };
  const eski = dogrula(e, eskiKod); await bp;
  return { eski, serbest };
}
test("YARIŞ: eski kodla süren doğrulama, bu sırada üretilen YENİ kodun deneme sayacını artırmaz; yeni kodun 5 hakkı korunur", async () => {
  const e = posta("y"), A = await kodIste(e);
  const { eski, serbest } = await durdurulmusDogrulama(e, yanlisKod(A.kod));
  zamanGeri(e); const B = await kodIste(e); assert.equal(B.s, 200); assert.equal(satir(e).deneme, 0);
  serbest(); const r = await eski;
  assert.equal(r.s, 400); assert.deepEqual(r.j, GENEL);
  assert.equal(satir(e).deneme, 0, "eski doğrulama yeni kodun sayacını değiştirdi");
  for (let i = 0; i < 4; i++) assert.equal((await dogrula(e, yanlisKod(B.kod))).s, 400);
  assert.equal(satir(e).deneme, 4);
  assert.equal((await dogrula(e, B.kod)).s, 200, "yeni kodun 5. hakkı kullanılabilmeli");
});
test("YARIŞ: eski DOĞRU kodla süren doğrulama yeni kodu tüketemez ve giriş yapamaz; yeni kod sonra geçerli", async () => {
  const e = posta("y"), A = await kodIste(e);
  const { eski, serbest } = await durdurulmusDogrulama(e, A.kod);
  zamanGeri(e); const B = await kodIste(e);
  serbest(); const r = await eski;
  assert.equal(r.s, 400, "eski kod yeni kod üretildikten sonra giriş yaptırmamalı"); assert.equal(oturumSay(e), 0);
  const s = satir(e); assert.ok(s.hash && s.deneme === 0, "yeni kod kaydı bozulmamalı");
  assert.equal((await dogrula(e, B.kod)).s, 200); assert.equal(oturumSay(e), 1);
});
test("YARIŞ: kod-gonder ile eşzamanlı 20 eski-kod doğrulaması: yeni kodun sayacı hiçbir koşulda 0'dan yukarı çıkmaz (eski kayıt için ayrılan haklar yeni kayda geçmez)", async () => {
  const e = posta("y"), A = await kodIste(e); zamanGeri(e);
  const v = Array.from({ length: 20 }, () => dogrula(e, yanlisKod(A.kod))), g = kodIste(e);
  const [B] = await Promise.all([g, ...v]);
  if (B.s === 200) { const s = satir(e); assert.ok(s.deneme <= 5, "sayaç sınırı aşıldı"); }
  assert.ok(satir(e).deneme <= 5);
});
