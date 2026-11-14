// B4 Aşama 3B-3 · GET /katalog yanıtındaki dinamik `beklenen: { toplam, os, fix }` · gerçek API kodu + yerel izole SQLite (Production/Preview D1'e dokunmaz)
// çalıştırma: node --test tests/soru-katalog-beklenen.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kur, tohumla, sizintiBul, SORU_ANAHTARLARI } from "./yardim/soru-v2.mjs";
import { soruCikti, BAYRAK_HAZIR_ID, GECERLI_GOVDE_SQL, UYGUN } from "../lib/soru-api.js";

const GOC = fs.readFileSync("migrations/0003_soru_meta.sql", "utf8");   // soru_meta şeması YALNIZ bu dosyada (API oluşturmaz)
const YASAK = ["a", "x", "h", "rk", "json", "kopya_of", "kaynak", "govde"];
let e = 0;
const T = await kur(), { DB, api, giris, env } = T; await T.hazirla();   // tek ortam (hesap/hız modülleri süreç başına şema önbelleği tutar); her test ortamı sıfırlar
async function ortam({ sayi = 160 } = {}) {
  DB.db.exec("DELETE FROM soru"); DB.db.exec("DROP TABLE IF EXISTS soru_meta"); env.AKE_SORU_V2 = "1"; DB.sayac.sql.length = 0;
  if (sayi) { tohumla(DB, Math.round(sayi * 0.75), { onek: "m", s: "mat", konular: ["K1", "K2"] }); tohumla(DB, sayi - Math.round(sayi * 0.75), { onek: "f", s: "fizik" }); }
  const k = await giris(`bk${++e}@ornek.com`);
  const kat = (qs = "", kul = k) => api("katalog" + qs, { m: "GET", cookie: kul.cookie });
  const crawl = async (limit = 50, kul = k) => { let sonra = null; const sayfalar = []; for (let i = 0; i < 100; i++) { const r = await kat(`?limit=${limit}` + (sonra ? `&sonra=${encodeURIComponent(sonra)}` : ""), kul); assert.equal(r.s, 200, r.t); sayfalar.push(r.j); if (!r.j.sonraki) return sayfalar; sonra = r.j.sonraki; } throw new Error("sayfa sonsuz"); };
  const meta = () => DB.db.exec(GOC);
  const bayrakYaz = (id, o, f) => DB.db.prepare("INSERT INTO soru_meta (id, os, fix) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET os = excluded.os, fix = excluded.fix").run(id, o, f);
  const sunulan = sayfalar => sayfalar.flatMap(s => s.sorular);
  return { T, DB, api, giris, k, kat, crawl, meta, bayrakYaz, sunulan };
}
const ekle = (DB, id, govde, { durum = "banka", kopya = null, a = 1, x = "COZUM-" + id, s = "mat" } = {}) =>
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, 'K9', 2, NULL, ?, 0, 0, 'gomulu', ?, ?, ?, ?, ?, ?)").run(id, s, durum, Math.floor(Math.random() * 2147483647), "h-" + id, govde, a, x, kopya);
// sözleşme: yalnız İLK ve SON sayfada beklenen nesne; ara sayfalarda null
const kontrolSayfalar = (sayfalar, beklenen) => sayfalar.forEach((s, i) => { const ucta = i === 0 || i === sayfalar.length - 1; if (ucta) assert.deepEqual(s.beklenen, beklenen, `sayfa ${i}`); else assert.equal(s.beklenen, null, `ara sayfa ${i}`); });
const gecerli = id => JSON.stringify({ q: "Soru " + id, o: ["a", "b", "c", "d", "e"] });

test("1) çok sayfa: ilk/son sayfada aynı beklenen, ara sayfalarda null; toplam = tüm sayfalarda servis edilen soru sayısı; soru_meta yok → os/fix null", async () => {
  const { crawl, sunulan } = await ortam();
  const sayfalar = await crawl(50);
  assert.equal(sayfalar.length, 4);   // 160 soru / 50
  kontrolSayfalar(sayfalar, { toplam: 160, os: null, fix: null });
  assert.equal(sunulan(sayfalar).length, 160);
  assert.equal(new Set(sunulan(sayfalar).map(q => q.id)).size, 160);
  const tek = await crawl(1000); assert.equal(tek.length, 1); assert.deepEqual(tek[0].beklenen, { toplam: 160, os: null, fix: null });
});

test("2) bayrak hazır: os/fix = servis edilen kümedeki gerçek işaret sayıları; kopya / uygunsuz / bozuk gövde / yetim işaretler sayılmaz", async () => {
  const { DB, crawl, sunulan, meta, bayrakYaz } = await ortam();
  meta();
  tohumla(DB, 6, { onek: "kp", s: "mat", kopya: 6 });                       // kopya_of dolu: katalogda YOK
  ekle(DB, "z-red", gecerli("z-red"), { durum: "red" });                      // uygunsuz durum: YOK
  ekle(DB, "z-bozuk", "{bozuk json");                                         // UYGUN ama gövde bozuk: servis edilmez
  for (let i = 0; i < 20; i++) bayrakYaz("m-" + i, i % 2, i % 3 === 0 ? 1 : 0);   // m-0..m-19: os = tek sayılar (10), fix = 0,3,6,..,18 (7)
  bayrakYaz("f-0", 1, 1); bayrakYaz("f-1", 0, 1);                            // +os 1, +fix 2
  bayrakYaz("kp-0", 1, 1); bayrakYaz("z-red", 1, 1); bayrakYaz("z-bozuk", 1, 1); bayrakYaz("yetim-1", 1, 1);   // sayılmaz
  bayrakYaz(BAYRAK_HAZIR_ID, 99, 99);                                         // işaret satırı: sayılmaz, değerleri kullanılmaz
  const sayfalar = await crawl(40), qs = sunulan(sayfalar);
  const osGercek = qs.filter(q => q.os === 1).length, fixGercek = qs.filter(q => q.fix === 1).length;
  assert.equal(osGercek, 11); assert.equal(fixGercek, 9);                    // beklenen elle hesap: os 10+1, fix 7+2
  for (const s of sayfalar) assert.equal(s.bayrak, "hazir");
  kontrolSayfalar(sayfalar, { toplam: 160, os: osGercek, fix: fixGercek });
  assert.equal(qs.length, 160);
});

test("3) değişen soru sayısı: sayfalama sırasında soru eklenir/çıkar/işaret değişir → her istek o anki gerçeği bildirir; yeni tarama tutarlı", async () => {
  const { DB, kat, crawl, sunulan, meta, bayrakYaz } = await ortam({ sayi: 120 });
  meta(); for (let i = 0; i < 10; i++) bayrakYaz("m-" + i, 1, 0); bayrakYaz(BAYRAK_HAZIR_ID, 10, 0);
  const p1 = await kat("?limit=70"); assert.deepEqual(p1.j.beklenen, { toplam: 120, os: 10, fix: 0 });   // ilk sayfa sayar
  tohumla(DB, 7, { onek: "yeni", s: "mat" }); bayrakYaz("yeni-1", 1, 1);                       // +7 soru, +1 os, +1 fix
  DB.db.prepare("UPDATE soru SET durum = 'red' WHERE id IN ('m-0', 'm-1', 'f-5')").run();       // -3 soru (m-0, m-1 işaretliydi: -2 os)
  const p2 = await kat("?limit=70&sonra=" + encodeURIComponent(p1.j.sonraki));
  assert.deepEqual(p2.j.beklenen, { toplam: 124, os: 9, fix: 1 });                              // 120 + 7 - 3 ; os 10 + 1 - 2 ; fix 0 + 1
  assert.notDeepEqual(p2.j.beklenen, p1.j.beklenen);
  const yeniden = await crawl(70), qs = sunulan(yeniden);
  assert.equal(qs.length, 124); assert.equal(qs.filter(q => q.os === 1).length, 9); assert.equal(qs.filter(q => q.fix === 1).length, 1);
  kontrolSayfalar(yeniden, { toplam: 124, os: 9, fix: 1 });
  DB.db.prepare("DELETE FROM soru WHERE id LIKE 'yeni-%'").run();                                // soru silinir
  assert.equal((await kat("?limit=5")).j.beklenen.toplam, 117);
  DB.db.exec("DELETE FROM soru");                                                                // katalog boşalır
  const bos = await kat("?limit=5"); assert.equal(bos.s, 200); assert.deepEqual(bos.j.beklenen, { toplam: 0, os: 0, fix: 0 }); assert.equal(bos.j.sonraki, null);
});

test("4) eksik işaret: tablo yok / tablo var işaretsiz / işaretli / tablo sonradan düştü → os/fix null ya da gerçek; toplam her zaman doğru", async () => {
  const { DB, kat, meta, bayrakYaz } = await ortam({ sayi: 80 });
  const varMi = () => DB.db.prepare("SELECT name FROM sqlite_master WHERE name = 'soru_meta'").all().length > 0;
  assert.equal(varMi(), false);
  let r = await kat("?limit=10"); assert.equal(r.j.bayrak, "eksik"); assert.deepEqual(r.j.beklenen, { toplam: 80, os: null, fix: null });
  assert.equal(varMi(), false, "API tablo OLUŞTURMAZ");
  meta(); bayrakYaz("m-3", 1, 1); bayrakYaz("m-4", 1, 0);                                         // tablo + satırlar, işaret satırı YOK (doldurma bitmedi)
  r = await kat("?limit=10"); assert.equal(r.j.bayrak, "eksik"); assert.deepEqual(r.j.beklenen, { toplam: 80, os: null, fix: null });
  bayrakYaz(BAYRAK_HAZIR_ID, 2, 1);
  r = await kat("?limit=10"); assert.equal(r.j.bayrak, "hazir"); assert.deepEqual(r.j.beklenen, { toplam: 80, os: 2, fix: 1 });
  const yedek = DB.db.prepare("SELECT id, os, fix FROM soru_meta").all();
  DB.db.exec("DROP TABLE soru_meta");
  r = await kat("?limit=10"); assert.equal(r.s, 200); assert.equal(r.j.bayrak, "eksik"); assert.deepEqual(r.j.beklenen, { toplam: 80, os: null, fix: null });
  meta(); for (const y of yedek) bayrakYaz(y.id, y.os, y.fix);
  r = await kat("?limit=10"); assert.deepEqual(r.j.beklenen, { toplam: 80, os: 2, fix: 1 });
  DB.db.prepare("DELETE FROM soru_meta WHERE id = ?").run(BAYRAK_HAZIR_ID);                      // işaret satırı kaldırılırsa yine null
  r = await kat("?limit=10"); assert.deepEqual(r.j.beklenen, { toplam: 80, os: null, fix: null });
});

test("5) bozuk soru gövdesi: toplam yalnız servis edilebilen soruları sayar (sayfa çıktısıyla birebir); SQL koşulu soruCikti ile eş", async () => {
  const { DB, crawl, sunulan, meta, bayrakYaz } = await ortam({ sayi: 40 });
  const bozuk = {
    "b-json": "{bozuk json", "b-bos": "", "b-null": "null", "b-dizi": "[1,2,3]", "b-sayi": "5", "b-metin": '"yazi"', "b-bool": "true",
    "b-qsayi": JSON.stringify({ q: 5, o: ["a", "b", "c", "d", "e"] }), "b-qyok": JSON.stringify({ o: ["a", "b", "c", "d", "e"] }),
    "b-o4": JSON.stringify({ q: "x", o: ["a", "b", "c", "d"] }), "b-o6": JSON.stringify({ q: "x", o: ["a", "b", "c", "d", "e", "f"] }),
    "b-onesne": JSON.stringify({ q: "x", o: { 0: "a" } }), "b-ometin": JSON.stringify({ q: "x", o: "abcde" }), "b-oyok": JSON.stringify({ q: "x" })
  };
  const gecerliEk = {
    "g-p": JSON.stringify({ q: "x", o: ["a", "b", "c", "d", "e"], p: "paragraf" }),
    "g-pbos": JSON.stringify({ q: "x", o: ["a", "b", "c", "d", "e"], p: "" }),
    "g-osayi": JSON.stringify({ q: "x", o: [1, 2, 3, 4, 5] }),          // soruCikti String(...) ile kabul eder
    "g-qbos": JSON.stringify({ q: "", o: ["a", "b", "c", "d", "e"] }),  // boş q metin: soruCikti kabul eder
    "g-fazla": JSON.stringify({ q: "x", o: ["a", "b", "c", "d", "e"], ekstra: [1], a: 3 })
  };
  for (const [id, g] of Object.entries(bozuk)) ekle(DB, id, g);
  for (const [id, g] of Object.entries(gecerliEk)) ekle(DB, id, g);
  // SQL koşulu ile soruCikti eşdeğerliği: tüm gövdeler için tek tek
  const hepsi = { ...bozuk, ...gecerliEk };
  for (const [id, g] of Object.entries(hepsi)) {
    const sql = DB.db.prepare(`SELECT (${GECERLI_GOVDE_SQL}) AS v FROM soru WHERE id = ?`).get(id).v === 1, js = soruCikti({ id, s: "mat", t: "K9", d: 2, govde: g }) !== null;
    assert.equal(sql, js, `${id}: SQL=${sql} JS=${js} govde=${g}`);
  }
  meta(); bayrakYaz("b-json", 1, 1); bayrakYaz("b-o4", 1, 1); bayrakYaz("g-p", 1, 0); bayrakYaz("m-1", 0, 1); bayrakYaz(BAYRAK_HAZIR_ID, 4, 2);
  const sayfalar = await crawl(7), qs = sunulan(sayfalar);
  assert.equal(qs.length, 40 + Object.keys(gecerliEk).length);
  kontrolSayfalar(sayfalar, { toplam: qs.length, os: 1, fix: 1 });   // bozuk satırların işaretleri sayılmaz
  assert.ok(!qs.some(q => q.id.startsWith("b-")));
  // /ozet UYGUN kümeyi gövdeye bakmadan sayar; katalog beklenen servis edilebilir kümeyi — fark bilinçli ve ölçülebilir
});

test("6) cevap alanı sızıntısı yok: beklenen yalnız {toplam,os,fix} (tamsayı/null); üst anahtarlar sabit; çözüm/anahtar/iç alan metni yok", async () => {
  const { DB, kat, crawl, meta, bayrakYaz } = await ortam({ sayi: 60 });
  for (const durum of ["eksik", "hazir"]) {
    if (durum === "hazir") { meta(); bayrakYaz("m-2", 1, 1); bayrakYaz(BAYRAK_HAZIR_ID, 1, 1); }
    for (const s of await crawl(25)) {
      assert.deepEqual(Object.keys(s).sort(), ["bayrak", "beklenen", "n", "sonraki", "sorular"]);
      if (s.beklenen !== null) {
        assert.deepEqual(Object.keys(s.beklenen).sort(), ["fix", "os", "toplam"]);
        assert.ok(Number.isSafeInteger(s.beklenen.toplam) && s.beklenen.toplam >= 0);
        for (const v of [s.beklenen.os, s.beklenen.fix]) assert.ok(v === null || (Number.isSafeInteger(v) && v >= 0));
      }
      assert.deepEqual(sizintiBul(s, YASAK), []);
      for (const q of s.sorular) assert.ok(Object.keys(q).every(a => SORU_ANAHTARLARI.has(a)), Object.keys(q).join());
    }
    const r = await kat("?limit=1000"); assert.ok(!/COZUM-/.test(r.t), "çözüm metni sızdı"); assert.ok(!r.t.includes(BAYRAK_HAZIR_ID), "işaret satırı kimliği sızdı");
    assert.ok(!/"(a|x|h|rk|json|kopya_of|kaynak|govde)"\s*:/.test(r.t));
  }
  const p = await kat("?limit=1000"); assert.equal(p.h.get("cache-control"), "private, no-store");
});

test("7) mevcut davranış korunur: oturum (401), origin/yöntem, parametre doğrulama (400), sayfalama imleci, private+no-store, hız sınırı (429), kapalı bayrak (404)", async () => {
  const { kat, k, crawl } = await ortam({ sayi: 30 });
  for (const r of [await api("katalog", { m: "GET" }), await api("katalog", { m: "GET", cookie: "ake_s=" + "c".repeat(64) })]) { assert.equal(r.s, 401); assert.ok(!("beklenen" in (r.j || {}))); assert.equal(r.h.get("cache-control"), "private, no-store"); }
  for (const qs of ["?limit=0", "?limit=1001", "?limit=abc", "?limit=-1", "?ekstra=1", "?sonra=", "?sonra=" + "x".repeat(101)]) { const r = await kat(qs); assert.equal(r.s, 400, qs); assert.ok(!("beklenen" in r.j)); }
  assert.equal((await api("katalog", { m: "POST", cookie: k.cookie, govde: {} })).s, 405);
  assert.equal((await api("katalog", { m: "GET", cookie: k.cookie, origin: "https://kotu.example" })).s, 200);   // GET güvenli yöntem: aynı-origin denetimi yalnız durum değiştirenlere
  const s = await crawl(10); assert.equal(s.length, 3); assert.equal(s.at(-1).sonraki, null); assert.equal(s[0].sonraki, s[0].sorular.at(-1).id);
  for (const x of s) { assert.equal(x.n, x.sorular.length); }
  const r = await kat("?limit=10"); assert.equal(r.h.get("cache-control"), "private, no-store");
  // hız sınırı: saatte 30 katalog isteği; aşan istek 429 (beklenen yok); sayım çağrısı ek hız harcamaz
  const yeniKul = await giris(`bk-hiz-${++e}@ornek.com`); let son;
  for (let i = 0; i < 31; i++) son = await api("katalog?limit=5", { m: "GET", cookie: yeniKul.cookie });
  assert.equal(son.s, 429); assert.ok(!("beklenen" in son.j));
  env.AKE_SORU_V2 = "0"; DB.sayac.sql.length = 0; const kk = await kat("?limit=5"); assert.equal(kk.s, 404); env.AKE_SORU_V2 = "1";
  assert.equal(DB.sayac.sql.filter(q => /FROM soru\b/.test(q)).length, 0, "bayrak kapalıyken D1'e dokunulmaz");
});

test("8) sayım hatası katalogu düşürmez: meta sayımı düşerse yalnız toplam; hepsi düşerse beklenen: null; sorular yine verilir", async () => {
  const { DB, kat, meta, bayrakYaz } = await ortam({ sayi: 30 });
  meta(); bayrakYaz("m-1", 1, 0); bayrakYaz(BAYRAK_HAZIR_ID, 1, 0);
  const orijinal = DB.prepare.bind(DB);
  DB.prepare = sql => { if (/FROM soru LEFT JOIN soru_meta/.test(sql)) throw new Error("enjekte: meta sayımı"); return orijinal(sql); };
  let r = await kat("?limit=10"); assert.equal(r.s, 200); assert.deepEqual(r.j.beklenen, { toplam: 30, os: null, fix: null }); assert.equal(r.j.sorular.length, 10);
  DB.prepare = sql => { if (/COUNT\(\*\) AS toplam/.test(sql)) throw new Error("enjekte: tüm sayımlar"); return orijinal(sql); };
  r = await kat("?limit=10"); assert.equal(r.s, 200); assert.equal(r.j.beklenen, null); assert.equal(r.j.sorular.length, 10); assert.ok("beklenen" in r.j);
  DB.prepare = orijinal;
  r = await kat("?limit=10"); assert.deepEqual(r.j.beklenen, { toplam: 30, os: 1, fix: 0 });
});

test("9) ek sorgular yalnız okur ve sabit sayıdadır (ilk sayfa): hazırda 1 sayım, tablo yokken 2 (meta + toplam); yazma/DDL yok", async () => {
  const { DB, kat, meta, bayrakYaz } = await ortam({ sayi: 30 });
  await kat("?limit=5");   // ısınma: şema/hız sınırı ilk çağrı yan etkileri
  const sayim = async () => { const once = DB.sayac.sql.length; await kat("?limit=5"); return DB.sayac.sql.slice(once).filter(q => /COUNT\(\*\) AS toplam/.test(q)); };
  let q = await sayim(); assert.equal(q.length, 2); assert.ok(/soru_meta/.test(q[0]) && !/soru_meta/.test(q[1]));   // tablo yok: meta denemesi + yalnız toplam
  meta(); bayrakYaz(BAYRAK_HAZIR_ID, 0, 0);
  q = await sayim(); assert.equal(q.length, 1);
  for (const s of q) { assert.ok(/^\s*SELECT/i.test(s)); assert.ok(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i.test(s)); }
  assert.ok(q[0].includes(UYGUN), "UYGUN küme koşulu partial indeksle birebir (planlayıcı indeksi kullanabilsin)");
  const sorular = DB.db.prepare("SELECT COUNT(*) AS n FROM soru").get().n; assert.equal(sorular, 30);
});

test("10) sayfa bayrağı 'eksik' (bayrak sorgusu düştü) ama sayım hazır görünüyorsa: os/fix YİNE null (sayfa ve beklenen birbirine ters düşmez)", async () => {
  const { DB, kat, meta, bayrakYaz } = await ortam({ sayi: 30 });
  meta(); bayrakYaz("m-1", 1, 1); bayrakYaz(BAYRAK_HAZIR_ID, 1, 1);
  const orijinal = DB.prepare.bind(DB);
  DB.prepare = sql => { if (/FROM soru_meta WHERE id = \? OR id IN/.test(sql)) throw new Error("enjekte: bayrak sorgusu"); return orijinal(sql); };
  try { const r = await kat("?limit=10"); assert.equal(r.s, 200); assert.equal(r.j.bayrak, "eksik"); assert.deepEqual(r.j.beklenen, { toplam: 30, os: null, fix: null }); }
  finally { DB.prepare = orijinal; }
  const r2 = await kat("?limit=10"); assert.equal(r2.j.bayrak, "hazir"); assert.deepEqual(r2.j.beklenen, { toplam: 30, os: 1, fix: 1 });
});

test("11) sayım yalnız ilk ve son sayfada: 4 sayfalık taramada tam 2 sayım sorgusu; tek sayfada 1; ara sayfa null", async () => {
  const { DB, crawl, kat, meta, bayrakYaz } = await ortam({ sayi: 160 });
  meta(); bayrakYaz(BAYRAK_HAZIR_ID, 0, 0);
  const sayac = async f => { const once = DB.sayac.sql.length; const o = await f(); return [o, DB.sayac.sql.slice(once).filter(q => /COUNT\(\*\) AS toplam/.test(q)).length]; };
  const [sayfalar, n4] = await sayac(() => crawl(50));
  assert.equal(sayfalar.length, 4); assert.equal(n4, 2, "ilk + son"); assert.equal(sayfalar[1].beklenen, null); assert.equal(sayfalar[2].beklenen, null);
  const [tek, n1] = await sayac(() => crawl(1000)); assert.equal(tek.length, 1); assert.equal(n1, 1, "tek sayfa: bir kez"); assert.ok(tek[0].beklenen);
  const [ara, n0] = await sayac(() => kat("?limit=50&sonra=" + encodeURIComponent(sayfalar[0].sonraki))); assert.equal(n0, 0); assert.equal(ara.j.beklenen, null);
});

test("12) ilk/son sayfada sayım hatası da null bildirilir (sorular yine verilir); ara sayfa etkilenmez", async () => {
  const { DB, kat, crawl } = await ortam({ sayi: 120 });
  const orijinal = DB.prepare.bind(DB);
  DB.prepare = sql => { if (/COUNT\(\*\) AS toplam/.test(sql)) throw new Error("enjekte: sayım"); return orijinal(sql); };
  try {
    const sayfalar = await crawl(50);
    assert.equal(sayfalar.length, 3); for (const s of sayfalar) { assert.equal(s.beklenen, null); assert.ok("beklenen" in s); }
    assert.equal(sayfalar.flatMap(s => s.sorular).length, 120);
  } finally { DB.prepare = orijinal; }
});

test("13) yinelenen JSON anahtarları: SQL (ilk değer) ve JS JSON.parse (son değer) ayrışabilir → sayım ile GERÇEKTEN gönderilen küme aynı kurala bağlı (iki yön + yinelenen o)", async () => {
  const { DB, crawl, sunulan, meta, bayrakYaz } = await ortam({ sayi: 40 });
  const beş = '[1,2,3,4,5]';
  const dup = {
    "d-q-ilk-gecerli": `{"q":"x","q":7,"o":${beş}}`,           // SQL ilk q'yu (metin) görür=true; JS son q'yu (7) görür=false
    "d-q-son-gecerli": `{"q":7,"q":"x","o":${beş}}`,           // SQL ilk q'yu (7) görür=false; JS son q'yu ("x") görür=true
    "d-o-ilk-gecerli": `{"q":"x","o":${beş},"o":[1]}`,         // yinelenen o: SQL ilk (5 şık) ; JS son (1 şık)
    "d-o-son-gecerli": `{"q":"x","o":[1],"o":${beş}}`,         // yinelenen o: SQL ilk (1 şık) ; JS son (5 şık)
    "d-q-ayni": `{"q":"x","q":"y","o":${beş}}`,                // iki q da metin: ikisi de "geçerli" ama belirsiz → kapalı kalmalı
  };
  for (const [id, g] of Object.entries(dup)) ekle(DB, id, g);
  const ayrisma = id => { const g = dup[id]; const sql = DB.db.prepare(`SELECT (${GECERLI_GOVDE_SQL}) AS v FROM soru WHERE id = ?`).get(id).v === 1, js = soruCikti({ id, s: "mat", t: "K9", d: 2, govde: g }) !== null; return { sql, js }; };
  const a = ayrisma("d-q-ilk-gecerli"), b = ayrisma("d-q-son-gecerli");
  // GECERLI_GOVDE_SQL tek başına doğru kuralı taşır: yinelenen q/o anahtarı olan gövde geçersizdir (SQL = false), hangi sıra olursa olsun
  for (const id of Object.keys(dup)) assert.equal(ayrisma(id).sql, false, `${id}: yinelenen anahtar SQL'de geçersiz olmalı`);
  meta(); bayrakYaz(BAYRAK_HAZIR_ID, 0, 0);
  const sayfalar = await crawl(7), qs = sunulan(sayfalar), ids = new Set(qs.map(q => q.id));
  for (const id of Object.keys(dup)) assert.ok(!ids.has(id), `${id} gönderilmemeli (sayımda yok)`);
  assert.equal(qs.length, 40, "yalnız 40 temiz soru gönderilir");
  kontrolSayfalar(sayfalar, { toplam: qs.length, os: 0, fix: 0 });
  // sayım = gönderilen: SQL'in geçerli saydığı küme, API'nin gönderdiği kümeyle BİREBİR
  const sqlKume = new Set(DB.db.prepare(`SELECT id FROM soru WHERE ${UYGUN} AND ${GECERLI_GOVDE_SQL}`).all().map(r => r.id));
  assert.deepEqual([...ids].sort(), [...sqlKume].sort());
  assert.equal(a.js, false); assert.equal(b.js, true, "JS tek başına ikinci örneği KABUL ederdi: sayfa sorgusunun SQL kuralı olmasa sayımda olmayan soru gönderilirdi");
});
