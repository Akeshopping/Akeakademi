// B2 · dağıtık hız sınırlayıcı (lib/hiz.js) ve ona bağlanan GERÇEK handler'lar için yerel testler.
// Çalıştırma: node --test tests/hiz-b2.test.mjs        (Node >= 22: node:sqlite)
// Gerçek yerel D1 (Miniflare/workerd) ile: MF_DIR=<miniflare kurulu klasör> node --test tests/hiz-b2.test.mjs
// Hiçbir ağ isteği yapılmaz: e-posta sağlayıcısı ve AI sağlayıcısı sahte; üretim/Preview veritabanına dokunulmaz.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const MIGRATION = readFileSync(resolve("migrations/0001_hiz_siniri.sql"), "utf8");
const migrationDeyimleri = MIGRATION.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").split(";").map(x => x.trim()).filter(Boolean);

/* ---------- yerel D1 ---------- */
/* Handler'ların şema önbelleği modül düzeyinde olduğundan TEK veritabanı paylaşılır; testler IP / e-posta / anahtar ile ayrılır. */
let ortak, kapat = async () => { };
after(() => kapat());   /* dosya sonunda (tüm testler bitince) */
async function d1Kur({ hizTablosu = true } = {}) {
  if (!ortak) ortak = (async () => {
    let db, q;
    if (process.env.MF_DIR) {
      const { Miniflare } = await import(pathToFileURL(process.env.MF_DIR + "/node_modules/miniflare/dist/src/index.js").href);
      const mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('x') } }", d1Databases: { DB: "b2-yerel" }, d1Persist: false });
      db = await mf.getD1Database("DB"); kapat = () => mf.dispose();
      q = async (sql, ...p) => (await db.prepare(sql).bind(...p).all()).results;
    } else {
      const { DatabaseSync } = await import("node:sqlite"), sq = new DatabaseSync(":memory:");
      const bekle = () => new Promise(r => setTimeout(r, Math.random() * 3));   /* istekler gerçekten iç içe geçsin */
      const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
        first: async () => { await bekle(); return sq.prepare(sql).get(...a) || null; },
        all: async () => { await bekle(); return { results: sq.prepare(sql).all(...a) }; },
        run: async () => { await bekle(); const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
      db = { prepare: st, batch: async arr => { await bekle(); const out = []; for (const s of arr) out.push(await s.run()); return out; } };
      q = async (sql, ...p) => { const s = sq.prepare(sql); return /^\s*(SELECT|PRAGMA)/i.test(sql) ? s.all(...p) : (s.run(...p), []); };
    }
    return { db, q };
  })();
  const { db, q } = await ortak;
  await db.prepare("DROP TABLE IF EXISTS hiz").run();                                   /* her test temiz başlar */
  if (hizTablosu) for (const d of migrationDeyimleri) await db.prepare(d).run();      /* tablo, gerçek migration dosyasından kurulur */
  return { db, q, temizle: async () => { } };
}

/* ---------- gerçek handler'lar + sahte dış servisler ---------- */
const hesap = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
const sosyal = await import(pathToFileURL(resolve("functions/api/sosyal/[[yol]].js")).href);
const geri = await import(pathToFileURL(resolve("functions/api/geribildirim.js")).href);
const hata = await import(pathToFileURL(resolve("functions/api/hata.js")).href);
const ai = await import(pathToFileURL(resolve("functions/api/ai.js")).href);
const hizModul = await import(pathToFileURL(resolve("lib/hiz.js")).href);
const { hizSinir, ipOf, _yedekSifirla } = hizModul;

const postalar = [], aiCagrilari = [];
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("api.resend.com")) { postalar.push(JSON.parse(opt.body)); return new Response("{}", { status: 200 }); }
  if (String(url).includes("api.anthropic.com")) { aiCagrilari.push(1); return Response.json({ content: [{ type: "text", text: "ok" }] }); }
  throw new Error("beklenmeyen ağ isteği: " + url);
};
const ENV = (db, ek = {}) => ({ DB: db, AKE_GIZLI: "b2-test-gizli", RESEND_API_KEY: "sahte", ANTHROPIC_API_KEY: "sahte", ...ek });
const ipler = (() => { let n = 0; return () => `192.0.2.${++n % 250}`; })();
const mk = (yol, { ip, m = "POST", govde, cookie } = {}) => new Request("https://akeakademi.com/api/" + yol, { method: m,
  headers: { "content-type": "application/json", ...(ip ? { "cf-connecting-ip": ip } : {}), ...(cookie ? { cookie } : {}) }, body: m === "GET" ? undefined : JSON.stringify(govde || {}) });
const cevap = async r => ({ s: r.status, j: await r.json().catch(() => null), ra: r.headers.get("retry-after"), cerez: r.headers.get("set-cookie") });
const hesapIstek = (env, yol, o) => hesap.onRequest({ request: mk("hesap/" + yol, o), env, params: { yol: yol.split("/") } }).then(cevap);
const sosyalIstek = (env, yol, o) => sosyal.onRequest({ request: mk("sosyal/" + yol, o), env, params: { yol: yol.split("/") } }).then(cevap);
const sayi = (r, s) => r.filter(x => x.s === s).length;
let epn = 0; const eposta = () => `b2k${++epn}@ornek.test`;

/* B1 akışıyla gerçek oturum al (sahte e-posta yakalanır) */
async function girisYap(env, e = eposta(), ip = ipler()) {
  const once = postalar.length; assert.equal((await hesapIstek(env, "kod-gonder", { ip, govde: { eposta: e } })).s, 200);
  const kod = String(postalar[postalar.length - 1].text).match(/giriş kodun: (\d+)/)[1], r = await hesapIstek(env, "kod-dogrula", { ip, govde: { eposta: e, kod } });
  assert.equal(r.s, 200); return { e, cookie: String(r.cerez).split(";")[0], kid: r.j.kullanici.id, once };
}

/* ======================= 1) çekirdek: atomiklik ve izolasyon ======================= */
test("migration dosyası: yalnızca hiz tablosu + indeks; tekrar çalıştırılabilir; yıkıcı komut yok", async () => {
  assert.ok(/CREATE TABLE IF NOT EXISTS hiz\b/.test(MIGRATION) && /CREATE INDEX IF NOT EXISTS hiz_bitis/.test(MIGRATION));
  assert.ok(!/\b(DROP|DELETE|UPDATE|INSERT|ALTER)\b/i.test(migrationDeyimleri.join(";")), "migration yalnızca CREATE içermeli");
  const { db, q, temizle } = await d1Kur(); for (const d of migrationDeyimleri) await db.prepare(d).run();   /* ikinci kez */
  assert.deepEqual((await q("SELECT name FROM sqlite_master WHERE name LIKE 'hiz%' ORDER BY name")).map(r => r.name), ["hiz", "hiz_bitis"]); await temizle();
});
test("çekirdek: 200 eşzamanlı istek, limit 10 → TAM 10 izin; tek satır; sayaç limiti aşmaz (3 tekrar)", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db);
  for (let t = 0; t < 3; t++) {
    const kimlik = "k" + t, r = await Promise.all(Array.from({ length: 200 }, () => hizSinir(env, { kova: "t", kimlik, adet: 10, ms: 3600000 })));
    assert.equal(r.filter(x => x.izin).length, 10); assert.ok(r.every(x => !x.yedek), "D1 kullanılmalı (yedek değil)");
    const satir = await q("SELECT adet FROM hiz"); assert.ok(satir.every(x => x.adet <= 10)); assert.equal(satir.length, t + 1);
  } await temizle();
});
test("çekirdek: pencere dolunca sayaç sıfırlanır; reddedilen istek yazma üretmez; Retry-After doğru", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db), ms = 60000, t0 = 1_000_000 * ms + 5000;
  for (let i = 0; i < 3; i++) assert.equal((await hizSinir(env, { kova: "p", kimlik: "x", adet: 3, ms, now: t0 })).izin, true);
  const red = await hizSinir(env, { kova: "p", kimlik: "x", adet: 3, ms, now: t0 + 1000 }); assert.equal(red.izin, false); assert.equal(red.bekle, 54);
  const once = await q("SELECT * FROM hiz"); for (let i = 0; i < 20; i++) await hizSinir(env, { kova: "p", kimlik: "x", adet: 3, ms, now: t0 + 2000 });
  assert.deepEqual(await q("SELECT * FROM hiz"), once, "reddedilenler satırı değiştirmemeli");
  assert.equal((await hizSinir(env, { kova: "p", kimlik: "x", adet: 3, ms, now: t0 + ms })).izin, true, "yeni pencere");
  assert.equal((await q("SELECT adet FROM hiz"))[0].adet, 1); await temizle();
});
test("izolasyon: farklı kimlik / farklı kova birbirini etkilemez; aynı kimlik farklı kovada ayrı sayılır", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db);
  for (let i = 0; i < 5; i++) await hizSinir(env, { kova: "a", kimlik: "u1", adet: 5, ms: 3600000 });
  assert.equal((await hizSinir(env, { kova: "a", kimlik: "u1", adet: 5, ms: 3600000 })).izin, false);
  assert.equal((await hizSinir(env, { kova: "a", kimlik: "u2", adet: 5, ms: 3600000 })).izin, true);
  assert.equal((await hizSinir(env, { kova: "b", kimlik: "u1", adet: 5, ms: 3600000 })).izin, true); await temizle();
});
test("gizlilik: veritabanında IP/kimlik açık metin YOK; anahtarlar 32 hex; IPv6 /64'e indirilir", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db);
  const r = mk("x", { ip: "203.0.113.77" }); await hizModul.ipHiz(env, r, "gizli", 5, 3600000);
  await hizSinir(env, { kova: "gizli", kimlik: "kullanici-kimligi-123", adet: 5, ms: 3600000 });
  const dump = JSON.stringify(await q("SELECT * FROM hiz")); assert.ok(!dump.includes("203.0.113.77") && !dump.includes("kullanici-kimligi") && !dump.includes("gizli"), dump);
  assert.ok((await q("SELECT anahtar FROM hiz")).every(x => /^[0-9a-f]{32}$/.test(x.anahtar)));
  const v6 = a => ipOf(new Request("https://x", { headers: { "cf-connecting-ip": a } }));
  assert.equal(v6("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), v6("2001:DB8:1:2:1::1")); assert.notEqual(v6("2001:db8:1:2::1"), v6("2001:db8:1:3::1"));
  assert.equal(v6("2001:db8::1"), v6("2001:db8:0:0:5::9")); assert.equal(v6("::ffff:198.51.100.4"), "198.51.100.4"); assert.equal(v6("198.51.100.4"), "198.51.100.4");
  assert.equal(ipOf(new Request("https://x")), "?"); await temizle();
});
test("büyüme: süresi dolmuş satırlar temizlenir; tablo sonsuz büyümez", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db), ms = 60000, t0 = 2_000_000 * ms;
  for (let i = 0; i < 400; i++) await db.prepare("INSERT INTO hiz (anahtar, pencere, adet, bitis) VALUES (?, 1, 1, ?)").bind("eski" + i, 1000).run();
  const rnd = Math.random; Math.random = () => 0;   /* temizliği her izinli istekte tetikle */
  try { for (let i = 0; i < 8; i++) await hizSinir(env, { kova: "g", kimlik: "k" + i, adet: 5, ms, now: t0 }); } finally { Math.random = rnd; }
  assert.equal((await q("SELECT COUNT(*) n FROM hiz WHERE anahtar LIKE 'eski%'"))[0].n, 0, "süresi dolanlar silinmeli (8 x 100 ≥ 400)");
  assert.equal((await q("SELECT COUNT(*) n FROM hiz WHERE anahtar NOT LIKE 'eski%'"))[0].n, 8, "geçerli satırlara dokunulmamalı"); await temizle();
});
test("güvenli hata: hiz tablosu YOKSA istek ENGELLENMEZ (bellek içi yedek, yedek:true); D1 hatası da engellemez", async () => {
  _yedekSifirla(); const { db, temizle } = await d1Kur({ hizTablosu: false }), env = ENV(db);
  const r = []; for (let i = 0; i < 6; i++) r.push(await hizSinir(env, { kova: "y", kimlik: "k", adet: 5, ms: 3600000 }));
  assert.equal(r.filter(x => x.izin).length, 5, "yedek de sınırı uygular"); assert.ok(r.every(x => x.yedek === true));
  const bozuk = { DB: { prepare: () => { throw new Error("D1 çöktü"); } } }; const s = await hizSinir(bozuk, { kova: "y2", kimlik: "k", adet: 5, ms: 3600000 });
  assert.equal(s.izin, true); assert.equal(s.yedek, true); await temizle();
});

/* ======================= 2) hesap API (gerçek handler) ======================= */
test("hesap/kod-gonder: aynı IP'den eşzamanlı 40 istek (farklı e-postalar) → TAM 20 kod; diğer IP etkilenmez; Retry-After var", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), ip = "198.51.100.10", o = postalar.length;
  const r = await Promise.all(Array.from({ length: 40 }, () => hesapIstek(env, "kod-gonder", { ip, govde: { eposta: eposta() } })));
  assert.equal(sayi(r, 200), 20); assert.equal(sayi(r, 429), 20); assert.equal(postalar.length - o, 20, "yalnızca 20 e-posta gönderilmeli");
  assert.ok(r.filter(x => x.s === 429).every(x => x.j.error === "cok_istek" && Number(x.ra) >= 1));
  assert.equal((await hesapIstek(env, "kod-gonder", { ip: "198.51.100.11", govde: { eposta: eposta() } })).s, 200, "başka IP etkilenmemeli"); await temizle();
});
test("hesap/kod-dogrula: tek IP'den eşzamanlı 100 yanlış kod → en çok 60 değerlendirilir (kalan 429); B1 deneme sayacı 5'i aşmaz", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db), e = eposta(), ip = "198.51.100.20", ayri = ipler();
  await hesapIstek(env, "kod-gonder", { ip: ayri, govde: { eposta: e } }); const kod = String(postalar[postalar.length - 1].text).match(/giriş kodun: (\d+)/)[1];
  const yanlis = String((+kod + 1234567) % 100000000).padStart(8, "0");
  const r = await Promise.all(Array.from({ length: 100 }, () => hesapIstek(env, "kod-dogrula", { ip, govde: { eposta: e, kod: yanlis } })));
  assert.equal(sayi(r, 429), 40); assert.equal(sayi(r, 400), 60);
  assert.equal((await q("SELECT deneme FROM giris WHERE eposta = ?", e))[0].deneme, 5, "B1 sınırı korunmalı");
  assert.equal((await hesapIstek(env, "kod-dogrula", { ip: ayri, govde: { eposta: e, kod } })).s, 400, "5 deneme dolduktan sonra doğru kod da reddedilir (B1)"); await temizle();
});
test("hesap/kod-bagla: kullanıcı başına saatte 20; iki kullanıcı birbirini etkilemez", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), A = await girisYap(env), B = await girisYap(env);
  const dene = (K, ip) => hesapIstek(env, "kod-bagla", { ip, cookie: K.cookie, govde: { kod: "AKE-YOK-KOD" } });
  const r = []; for (let i = 0; i < 25; i++) r.push(await dene(A, ipler()));   /* her istek ayrı IP: yalnızca kullanıcı sınırı ölçülür */
  assert.equal(sayi(r, 429), 5, JSON.stringify(r.map(x => x.s)));
  assert.notEqual((await dene(B, ipler())).s, 429, "B, A'nın sınırından etkilenmemeli"); await temizle();
});

/* ======================= 3) geri bildirim ======================= */
const gb = (env, ip, mesaj = "Bu bir deneme mesajıdır") => geri.onRequest({ request: mk("geribildirim", { ip, govde: { tur: "oneri", mesaj } }), env }).then(cevap);
test("geribildirim: IP başına saatte 5; eşzamanlı 12 istek → TAM 5 e-posta; başka IP etkilenmez; geçersiz istek hak yakmaz", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), ip = "198.51.100.30", o = postalar.length;
  for (let i = 0; i < 10; i++) assert.equal((await gb(env, ip, "x")).s, 400);   /* çok kısa → hak yakmaz */
  const r = await Promise.all(Array.from({ length: 12 }, () => gb(env, ip)));
  assert.equal(sayi(r, 200), 5); assert.equal(sayi(r, 429), 7); assert.equal(postalar.length - o, 5);
  assert.equal((await gb(env, "198.51.100.31")).s, 200); await temizle();
});
test("geribildirim: bot tuzağı (web) sessizce yok sayılır, sayaç/e-posta üretmez; tüm site günlük tavanı (300) korunur", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db), o = postalar.length;
  assert.equal((await geri.onRequest({ request: mk("geribildirim", { ip: "198.51.100.40", govde: { web: "bot", mesaj: "spam spam" } }), env }).then(cevap)).s, 200);
  assert.equal(postalar.length, o); assert.equal((await q("SELECT COUNT(*) n FROM hiz"))[0].n, 0);
  for (let i = 0; i < 300; i++) await hizSinir(env, { kova: "gb-genel", kimlik: "tum", adet: 300, ms: 86400000 });
  const r = await gb(env, "198.51.100.41"); assert.equal(r.s, 429); assert.equal(postalar.length, o); await temizle();
});

/* ======================= 4) hata kaydı ======================= */
const ht = (env, ip, m) => hata.onRequest({ request: mk("hata", { ip, govde: { m, s: "a.js", l: 1 } }), env }).then(cevap);
test("hata: IP başına saatte 20 kayıt; eşzamanlı 30 istek → TAM 20 yazılır; başka IP etkilenmez; tablo sınırı korunur", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db), ip = "198.51.100.50";
  const r = await Promise.all(Array.from({ length: 30 }, (_, i) => ht(env, ip, "benzersiz hata " + i)));
  assert.equal(sayi(r, 200), 20); assert.equal(sayi(r, 429), 10); assert.equal((await q("SELECT COUNT(*) n FROM hata"))[0].n, 20);
  assert.equal((await ht(env, "198.51.100.51", "başka ip")).s, 200); await temizle();
});
test("hata: tüm site saatlik tavanı (1500) dolunca yeni IP'ler de reddedilir ve veritabanına YAZILMAZ", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db);
  await ht(env, "198.51.100.60", "tablo kur");
  for (let i = 0; i < 1500; i++) await hizSinir(env, { kova: "hata-genel", kimlik: "tum", adet: 1500, ms: 3600000 });
  const once = (await q("SELECT COUNT(*) n FROM hata"))[0].n, r = await ht(env, "198.51.100.61", "tavan sonrası");
  assert.equal(r.s, 429); assert.equal((await q("SELECT COUNT(*) n FROM hata"))[0].n, once); await temizle();
});

/* ======================= 5) AI ======================= */
test("ai: hesap başına 5 dakikada 40 istek; eşzamanlı 60 istek → TAM 40 sağlayıcı çağrısı; başka kullanıcı etkilenmez", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), A = await girisYap(env), B = await girisYap(env);
  for (const K of [A, B]) await db.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih) VALUES (?, ?, 'premium', '2099-01-01', 1)").bind("KOD" + K.kid, K.kid).run();
  const cag = K => ai.onRequest({ request: mk("ai", { cookie: K.cookie, govde: { prompt: "Merhaba" } }), env }).then(cevap), o = aiCagrilari.length;
  const r = await Promise.all(Array.from({ length: 60 }, () => cag(A)));
  assert.equal(sayi(r, 200), 40, JSON.stringify(r.map(x => x.s))); assert.equal(sayi(r, 429), 20); assert.equal(aiCagrilari.length - o, 40, "reddedilenler sağlayıcıya gitmemeli");
  assert.equal((await cag(B)).s, 200, "B etkilenmemeli"); await temizle();
});

/* ======================= 6) sosyal API ======================= */
test("sosyal/oda (girişsiz): IP başına dakikada 6; eşzamanlı 20 istek → 6 geçer; tablo tavanı yeni kimliği reddeder, mevcut kimliği yeniler", async () => {
  const { db, q, temizle } = await d1Kur(), env = ENV(db), ip = "198.51.100.70";
  const oda = (id, i = ip) => sosyalIstek(env, "oda", { ip: i, govde: { id } });
  const r = await Promise.all(Array.from({ length: 20 }, (_, i) => oda("odakimlik" + String(i).padStart(4, "0"))));
  assert.equal(sayi(r, 200), 6); assert.equal(sayi(r, 429), 14);
  await db.prepare("DELETE FROM nabiz").run();
  const t = Date.now(); for (let i = 0; i < 20000; i++) await db.prepare("INSERT INTO nabiz (id, t) VALUES (?, ?)").bind("dolu" + String(i).padStart(6, "0"), t).run();
  assert.equal((await oda("yenikimlikxx", "198.51.100.71")).s, 200);
  assert.equal((await q("SELECT COUNT(*) n FROM nabiz WHERE id = 'yenikimlikxx'"))[0].n, 0, "tavan doluyken yeni kimlik eklenmemeli");
  await oda("dolu000005", "198.51.100.72"); assert.ok((await q("SELECT t FROM nabiz WHERE id = 'dolu000005'"))[0].t >= t, "mevcut kimlik yenilenmeli");
  assert.equal((await q("SELECT COUNT(*) n FROM nabiz"))[0].n, 20000); await temizle();
});
test("sosyal: takma ad değiştirme saatte 10, lig kurma saatte 10, xp dakikada 30 (kullanıcı başına); kullanıcılar birbirini etkilemez", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), A = await girisYap(env), B = await girisYap(env);
  const yap = (K, yol, govde) => sosyalIstek(env, yol, { ip: ipler(), cookie: K.cookie, govde });
  const takma = []; for (let i = 0; i < 14; i++) takma.push(await yap(A, "takma", { takma: "Ad" + i }));
  assert.equal(sayi(takma, 200), 10); assert.equal(sayi(takma, 429), 4);
  const kur = []; for (let i = 0; i < 13; i++) kur.push(await yap(A, "lig/kur", { ad: "Lig " + i }));
  assert.deepEqual([sayi(kur, 200), sayi(kur, 400), sayi(kur, 429)], [3, 7, 3], "3 lig kuruldu (B1 dışı mevcut tavan), sınır 10 denemede kesti: " + JSON.stringify(kur.map(x => x.s)));
  const xp = await Promise.all(Array.from({ length: 50 }, () => yap(B, "xp", { d: 1 })));
  assert.equal(sayi(xp, 200), 30); assert.equal(sayi(xp, 429), 20);
  assert.equal((await yap(B, "takma", { takma: "Bnin adı" })).s, 200, "B, A'nın sınırlarından etkilenmemeli"); await temizle();
});
test("sosyal: davet kodu denemeleri (lig/sınıf katıl) IP başına saatte 20 ortak sınır; geçerli kullanım engellenmez", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), A = await girisYap(env), ip = "198.51.100.80";
  const r = []; for (let i = 0; i < 25; i++) r.push(await sosyalIstek(env, i % 2 ? "lig/katil" : "sinif/katil", { ip, cookie: A.cookie, govde: { kod: "ABCDEF" } }));
  assert.equal(sayi(r, 404), 20); assert.equal(sayi(r, 429), 5); await temizle();
});

/* ======================= 7) mevcut davranış korunuyor ======================= */
test("DB'siz kurulum: AI (DB yok) bellek içi yedekle çalışmaya devam eder; geribildirim DB'siz de sınırlanır", async () => {
  _yedekSifirla(); const env = { ANTHROPIC_API_KEY: "sahte", AKE_KODLAR: "AKE-B2-TEST:premium" };
  const r = []; for (let i = 0; i < 42; i++) r.push(await ai.onRequest({ request: mk("ai", { govde: { code: "AKE-B2-TEST", prompt: "x" } }), env }).then(cevap));
  assert.equal(sayi(r, 200), 40); assert.equal(sayi(r, 429), 2);
  _yedekSifirla(); const g = []; for (let i = 0; i < 7; i++) g.push(await gb({ RESEND_API_KEY: "sahte" }, "198.51.100.90"));
  assert.equal(sayi(g, 200), 5); assert.equal(sayi(g, 429), 2);
});
test("hiz tablosu hiç yokken (migration uygulanmadan dağıtım): tüm uçlar çalışır, kullanıcı engellenmez, B1 doğrulaması çalışır", async () => {
  _yedekSifirla(); const { db, temizle } = await d1Kur({ hizTablosu: false }), env = ENV(db);
  const G = await girisYap(env); assert.ok(G.kid);
  assert.equal((await sosyalIstek(env, "takma", { ip: ipler(), cookie: G.cookie, govde: { takma: "Deneme" } })).s, 200);
  assert.equal((await gb(env, "198.51.100.95")).s, 200); assert.equal((await ht(env, "198.51.100.96", "m")).s, 200); await temizle();
});

/* ======================= 8) D1 arızasında ÜCRETLİ AI sınırsıza açılmaz ======================= */
async function aiHazirla(db, env) {
  const K = await girisYap(env); await db.prepare("INSERT INTO kod (anahtar, kid, plan, bitis, tarih) VALUES (?, ?, 'premium', '2099-01-01', 1)").bind("KODAI" + K.kid, K.kid).run();
  return { K, cag: (e = env, n = 1) => Promise.all(Array.from({ length: n }, () => ai.onRequest({ request: mk("ai", { cookie: K.cookie, govde: { prompt: "Merhaba" } }), env: e }).then(cevap))) };
}
const sarmal = (db, bozukMu) => ({ prepare: sql => { if (bozukMu(sql)) throw new Error("D1 arızası (test)"); return db.prepare(sql); }, batch: a => db.batch(a) });
test("D1 arızası (yalnızca sınırlayıcı): ücretli AI isteği REDDEDİLİR (503), sağlayıcıya GİTMEZ; diğer uçlar (geri bildirim) etkilenmez", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), { K, cag } = await aiHazirla(db, env);
  assert.equal((await cag(env, 1))[0].s, 200, "sağlıklıyken AI çalışmalı");
  const bozuk = ENV(sarmal(db, sql => /\bhiz\b/.test(sql)));   /* yalnızca hiz tablosu işlemleri patlar */
  const o = aiCagrilari.length, r = await cag(bozuk, 80);
  assert.equal(sayi(r, 503), 80, JSON.stringify(r.map(x => x.s))); assert.equal(aiCagrilari.length - o, 0, "arızada sağlayıcıya (ücretli) istek gitmemeli");
  assert.ok(r.every(x => Number(x.ra) >= 1 && x.j.error === "gecici"));
  assert.equal((await gb(bozuk, "198.51.100.120")).s, 200, "ücretsiz/kritik olmayan uçlar engellenmemeli (yedek)"); await temizle();
});
test("D1 tamamen arızalı: AI 200 DÖNMEZ ve sağlayıcıya istek gitmez", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), { cag } = await aiHazirla(db, env);
  const bozuk = ENV(sarmal(db, () => true)), o = aiCagrilari.length;
  const r = await cag(bozuk, 20).catch(e => [{ s: "istisna" }]);
  assert.ok(r.every(x => x.s !== 200), JSON.stringify(r.map(x => x.s))); assert.equal(aiCagrilari.length - o, 0); await temizle();
});
test("hiz tablosu yokken (migration öncesi dağıtım) ücretli AI geçici 503 verir, ücretsiz uçlar çalışır; tablo gelince AI düzelir", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), { cag } = await aiHazirla(db, env);
  await db.prepare("DROP TABLE hiz").run(); const o = aiCagrilari.length;
  assert.equal(sayi(await cag(env, 5), 503), 5); assert.equal(aiCagrilari.length - o, 0); assert.equal((await gb(env, "198.51.100.121")).s, 200);
  for (const d of migrationDeyimleri) await db.prepare(d).run(); assert.equal((await cag(env, 1))[0].s, 200); await temizle();
});

/* ======================= 9) Erişim kodu denemeleri: /api/ai ve /api/hesap/kod-bagla AYNI bütçeyi paylaşır ======================= */
const kodAi = (env, K, ip, govde) => ai.onRequest({ request: mk("ai", { ip, cookie: K.cookie, govde }), env }).then(cevap);
const kodHesap = (env, K, ip, kod) => hesapIstek(env, "kod-bagla", { ip, cookie: K.cookie, govde: { kod } });
const bagliMi = async (q, kid) => (await q("SELECT COUNT(*) n FROM kod WHERE kid = ?", kid))[0].n;
const yanlisKodUret = () => "AKE-X" + Math.random().toString(36).slice(2, 8).toUpperCase();
const hesapAc = async env => { const K = await girisYap(env); return K; };

test("kod bütçesi ORTAK: bir kullanıcı AI (kod ve check) + kod-bagla uçlarından toplam 20 deneme yapabilir; 21. her iki uçta 429; AI'dan yakılan hak kod-bagla'dan düşer", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), A = await hesapAc(env), B = await hesapAc(env), r = [];
  for (let i = 0; i < 12; i++) r.push(await kodAi(env, A, ipler(), { code: yanlisKodUret(), check: i % 2 === 0 }));      /* 6 check + 6 normal */
  for (let i = 0; i < 8; i++) r.push(await kodHesap(env, A, ipler(), yanlisKodUret()));
  assert.equal(sayi(r, 429), 0, "ilk 20 deneme değerlendirilmeli: " + JSON.stringify(r.map(x => x.s)));
  assert.equal((await kodAi(env, A, ipler(), { code: yanlisKodUret() })).s, 429, "21. deneme AI'da 429");
  assert.equal((await kodAi(env, A, ipler(), { code: yanlisKodUret(), check: true })).s, 429, "b.check ile de 429 (bypass yok)");
  assert.equal((await kodHesap(env, A, ipler(), yanlisKodUret())).s, 429, "aynı bütçe kod-bagla'da da tükenmiş");
  assert.notEqual((await kodAi(env, B, ipler(), { code: yanlisKodUret() })).s, 429, "B etkilenmemeli"); await temizle();
});
test("kod bütçesi ORTAK (IP): aynı IP'den 4 hesap, iki uçtan toplam 60 deneme; 61. herhangi bir hesapta / uçta 429", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db), ip = "198.51.100.130", U = [];
  for (let i = 0; i < 5; i++) U.push(await hesapAc(env));
  const r = []; for (let i = 0; i < 60; i++) { const K = U[i % 4]; r.push(i % 2 ? await kodAi(env, K, ip, { code: yanlisKodUret() }) : await kodHesap(env, K, ip, yanlisKodUret())); }
  assert.equal(sayi(r, 429), 0, JSON.stringify(r.map(x => x.s)));
  assert.equal((await kodAi(env, U[4], ip, { code: yanlisKodUret() })).s, 429, "yeni hesap da aynı IP bütçesine takılmalı (AI)");
  assert.equal((await kodHesap(env, U[4], ip, yanlisKodUret())).s, 429, "… ve kod-bagla'da");
  assert.notEqual((await kodAi(env, U[4], "198.51.100.131", { code: yanlisKodUret() })).s, 429, "başka IP etkilenmemeli"); await temizle();
});
test("kod bütçesi EŞZAMANLI: tek kullanıcı, iki uca karışık 120 eşzamanlı deneme → TAM 20 değerlendirilir (kalanı 429); sınır aşılamaz (3 tekrar)", async () => {
  const { db, temizle } = await d1Kur(), env = ENV(db);
  for (let t = 0; t < 3; t++) {
    const A = await hesapAc(env), r = await Promise.all(Array.from({ length: 120 }, (_, i) => i % 3 === 0 ? kodHesap(env, A, ipler(), yanlisKodUret()) : kodAi(env, A, ipler(), { code: yanlisKodUret(), check: i % 3 === 1 })));
    assert.equal(r.length - sayi(r, 429), 20, JSON.stringify(r.reduce((a, x) => (a[x.s] = (a[x.s] || 0) + 1, a), {}))); assert.equal(sayi(r, 429), 100);
  } await temizle();
});
test("D1 sınırlayıcı arızalıyken erişim kodu tahmini YOK: GEÇERLİ kod bile bağlanmaz (503), AI ve kod-bagla; sağlıklıyken bağlanır; check bypass'ı yok", async () => {
  const { db, q, temizle } = await d1Kur(), KOD = "AKE-B2-GECERLI1", env = ENV(db, { AKE_KODLAR: KOD + ":premium" });
  const bozuk = ENV(sarmal(db, sql => /\bhiz\b/.test(sql)), { AKE_KODLAR: KOD + ":premium" }), A = await hesapAc(env), B = await hesapAc(env);
  const r = [await kodAi(bozuk, A, ipler(), { code: KOD }), await kodAi(bozuk, A, ipler(), { code: KOD, check: true }), await kodHesap(bozuk, A, ipler(), KOD)];
  assert.deepEqual(r.map(x => x.s), [503, 503, 503]); assert.ok(r.every(x => x.j.error === "gecici" && Number(x.ra) >= 1));
  assert.equal(await bagliMi(q, A.kid), 0, "arızada geçerli kod bile değerlendirilmemeli/bağlanmamalı");
  const o = aiCagrilari.length; assert.equal((await kodAi(bozuk, A, ipler(), { code: KOD, prompt: "x" })).s, 503); assert.equal(aiCagrilari.length, o, "sağlayıcıya istek gitmemeli");
  assert.equal((await kodAi(env, A, ipler(), { code: KOD, check: true })).s, 200, "sağlıklıyken geçerli kod bağlanır"); assert.equal(await bagliMi(q, A.kid), 1);
  const tablosuz = ENV(sarmal(db, sql => /\bhiz\b/.test(sql)), { AKE_KODLAR: "AKE-B2-BASKA2:premium" });
  assert.equal((await kodHesap(tablosuz, B, ipler(), "AKE-B2-BASKA2")).s, 503); assert.equal(await bagliMi(q, B.kid), 0); await temizle();
});
test("meşru kullanım engellenmez: geçerli kod ilk denemede bağlanır; paketi olan kullanıcının AI/check istekleri kod bütçesini YAKMAZ; tükenen kullanıcı diğerini etkilemez", async () => {
  const { db, q, temizle } = await d1Kur(), KOD = "AKE-B2-GECERLI3", env = ENV(db, { AKE_KODLAR: KOD + ":premium" }), A = await hesapAc(env), B = await hesapAc(env);
  for (let i = 0; i < 25; i++) await kodHesap(env, A, ipler(), yanlisKodUret());   /* A bütçesini tüketir */
  assert.equal((await kodAi(env, B, ipler(), { code: KOD, check: true })).s, 200); assert.equal(await bagliMi(q, B.kid), 1);
  for (let i = 0; i < 30; i++) assert.equal((await kodAi(env, B, ipler(), { check: true })).s, 200, "paketli kullanıcının check istekleri sınırlanmamalı");
  for (let i = 0; i < 30; i++) assert.notEqual((await kodAi(env, B, ipler(), { code: yanlisKodUret(), check: true })).s, 429, "paketi varken kod alanı değerlendirilmez, bütçe yanmaz"); await temizle();
});
