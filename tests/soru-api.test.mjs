// Soru API (PR 2) · bayrak, kimlik/CSRF, pratik/sınav akışı, süre, özet, önbellek, seçim · çalıştırma: node --test tests/soru-api.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kur, tohumla, sizintiBul } from "./yardim/soru-v2.mjs";

const T = await kur();
const { DB, api, giris, yeniIstek } = T;
await T.hazirla();
tohumla(DB, 400, { onek: "m", s: "mat", konular: ["Fonksiyonlar", "Limit"], zorluklar: [1, 2, 3] });
tohumla(DB, 60, { onek: "f", s: "fizik", konular: ["Kuvvet"], zorluklar: [2] });
let e = 0; const eposta = () => `soru${++e}@ornek.com`;
const oturumAc = async (ck, ek = {}) => api("oturum", { cookie: ck, govde: { istek: yeniIstek(), mod: "practice", adet: 5, ders: "mat", ...ek } });

/* ---- 1-2 bayrak ---- */
test("1) bayrak kapalı → tüm uçlar 404", async () => {
  for (const bayrak of [null, "", "0", "true", "yes"]) {
    const K = await kur({ bayrak });
    for (const [y, m] of [["oturum", "POST"], ["cevap", "POST"], ["bitir", "POST"], ["ozet", "GET"], ["bilinmeyen", "GET"]]) {
      const r = await K.api(y, { m, govde: m === "POST" ? {} : undefined });
      assert.equal(r.s, 404, `${bayrak}/${y}`); assert.equal(r.h.get("cache-control"), "private, no-store");
    }
  }
});
test("2) bayrak kapalı → env.DB.prepare/batch HİÇ çağrılmaz (şema/ALTER/kota/oturum yok); sorgu-çerez-başlıkla açılamaz", async () => {
  const sahte = { n: 0, prepare() { sahte.n++; throw new Error("dokunuldu"); }, batch() { sahte.n++; throw new Error("dokunuldu"); } };
  const { soruApi } = await import("../lib/soru-api.js");
  for (const env of [{ DB: sahte }, { DB: sahte, AKE_SORU_V2: "0" }]) {
    for (const [yol, m] of [["oturum", "POST"], ["cevap", "POST"], ["bitir", "POST"], ["ozet", "GET"]]) {
      const r = await soruApi(new Request("https://akeakademi.com/api/soru/" + yol + "?AKE_SORU_V2=1&v2=1", { method: m, headers: { cookie: "AKE_SORU_V2=1; ake_s=" + "a".repeat(64), "x-ake-soru-v2": "1", AKE_SORU_V2: "1", origin: "https://akeakademi.com" } }), env, { yol: [yol] });
      assert.equal(r.status, 404);
    }
  }
  assert.equal(sahte.n, 0);
  /* bayrak yalnız env'den: kapalı ortamda gerçek DB'de soru tabloları oluşmamış olmalı */
  const K = await kur({ bayrak: null }); await K.api("ozet", { m: "GET" });
  const var_ = K.DB.db.prepare("SELECT name FROM sqlite_master WHERE name IN ('soru_oturum','soru_oturum_soru','soru_sec_rk')").all();
  assert.equal(var_.length, 0);
});

/* ---- 3-4 kimlik / CSRF ---- */
test("3) oturumsuz → 401 (4 uç)", async () => {
  for (const [y, m, g] of [["oturum", "POST", {}], ["cevap", "POST", {}], ["bitir", "POST", {}], ["ozet", "GET"]]) assert.equal((await api(y, { m, govde: g })).s, 401, y);
  assert.equal((await api("ozet", { m: "GET", cookie: "ake_s=" + "b".repeat(64) })).s, 401);
});
test("4) cross-origin POST → 403; Origin yok + Sec-Fetch-Site/Referer kuralları; GET ozet origin istemez", async () => {
  const { cookie } = await giris(eposta()), g = { istek: yeniIstek(), mod: "practice", adet: 3 };
  assert.equal((await api("oturum", { cookie, govde: g, origin: "https://kotu.example" })).s, 403);
  assert.equal((await api("oturum", { cookie, govde: g, origin: "https://www.akeakademi.com" })).s, 403);   // joker yok
  assert.equal((await api("oturum", { cookie, govde: g, origin: null })).s, 403);                              // hiçbir kanıt yok
  assert.equal((await api("oturum", { cookie, govde: g, origin: null, ek: { "sec-fetch-site": "cross-site" } })).s, 403);
  assert.equal((await api("oturum", { cookie, govde: g, origin: null, ek: { referer: "https://kotu.example/x" } })).s, 403);
  assert.equal((await api("cevap", { cookie, govde: {}, origin: "https://kotu.example" })).s, 403);
  assert.equal((await api("bitir", { cookie, govde: {}, origin: "https://kotu.example" })).s, 403);
  assert.equal((await api("oturum", { cookie, govde: g, origin: null, ek: { "sec-fetch-site": "same-origin" } })).s, 200);
  assert.equal((await api("oturum", { cookie, govde: { ...g, istek: yeniIstek() }, origin: null, ek: { referer: "https://akeakademi.com/x" } })).s, 200);
  assert.equal((await api("ozet", { m: "GET", cookie, origin: "https://kotu.example" })).s, 200);
});
test("yöntem/yol: yanlış yöntem 405, bilinmeyen yol 404, alt yol 404", async () => {
  const { cookie } = await giris(eposta());
  assert.equal((await api("oturum", { m: "GET", cookie })).s, 405);
  assert.equal((await api("ozet", { m: "POST", cookie, govde: {} })).s, 405);
  assert.equal((await api("yok", { m: "GET", cookie })).s, 404);
  assert.equal((await api("oturum/x", { cookie, govde: {} })).s, 404);
});

/* ---- 5-6 sınır (ayrıntı: güvenlik/eşzamanlılık dosyalarında) ve girdi doğrulama ---- */
test("5-6) practice ≤50, exam ≤120, 10.000 → 400; geçersiz mod/ders/zorluk/istek/idler → 400", async () => {
  const k = await giris(eposta()); T.premiumYap(k.kid);
  const dene = async g => (await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), ...g } })).s;
  assert.equal(await dene({ mod: "practice", adet: 51 }), 400);
  assert.equal(await dene({ mod: "practice", adet: 10000 }), 400);
  assert.equal(await dene({ mod: "exam", adet: 121 }), 400);
  assert.equal(await dene({ mod: "practice", adet: 0 }), 400);
  assert.equal(await dene({ mod: "practice", adet: 1.5 }), 400);
  assert.equal(await dene({ mod: "practice", adet: "5" }), 400);
  assert.equal(await dene({ mod: "deneme", adet: 5 }), 400);
  assert.equal(await dene({ mod: "practice", adet: 5, ders: "yokders" }), 400);
  assert.equal(await dene({ mod: "practice", adet: 5, ders: "mat'; DROP TABLE soru;--" }), 400);
  assert.equal(await dene({ mod: "practice", adet: 5, zorluk: [4] }), 400);
  assert.equal(await dene({ mod: "practice", adet: 5, zorluk: [] }), 400);
  assert.equal(await dene({ mod: "practice", adet: 5, konu: "x".repeat(121) }), 400);
  assert.equal(await dene({ mod: "practice", adet: 5, idler: ["m-1", "m-2"] }), 400);          // arbitrary ID kanalı yok
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { istek: "kisa", mod: "practice", adet: 5 } })).s, 400);
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { mod: "practice", adet: 5 } })).s, 400);                // istek zorunlu
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { istek: "bosluk iceren istek 1234", mod: "practice", adet: 5 } })).s, 400);
  assert.equal((await api("oturum", { cookie: k.cookie, ham: "{bozuk" })).s, 400);
  assert.equal((await api("oturum", { cookie: k.cookie, ham: "[]" })).s, 400);
  assert.equal((await api("oturum", { cookie: k.cookie, ham: JSON.stringify({ istek: yeniIstek(), mod: "practice", adet: 5, konu: "a".repeat(9000) }) })).s, 400);
  assert.equal(await dene({ mod: "practice", adet: 50 }), 200);
  assert.equal(await dene({ mod: "exam", adet: 120 }), 200);
});
test("filtreler doğru: ders, konu, zorluk (tekil/dizi) ve kopya_of/uygunsuz satırlar seçilmez", async () => {
  const K = T;   // ortak.js şema önbelleği modül düzeyinde: tek veritabanı, ders kodlarıyla ayrılır
  tohumla(K.DB, 90, { onek: "a", s: "turkce", konular: ["K1", "K2", "K3"], zorluklar: [1, 2, 3], kopya: 10 });
  tohumla(K.DB, 20, { onek: "o", s: "turkce", konular: ["K1"], durum: "bekliyor" });
  K.DB.db.exec("INSERT INTO soru (id, s, t, d, durum, rk, govde, a, x) VALUES ('eksik-a','turkce','K1',1,'banka',5,'{\"q\":\"q\",\"o\":[\"1\",\"2\",\"3\",\"4\",\"5\"]}',NULL,'x')");
  const k = await K.giris("filtre@ornek.com"); K.premiumYap(k.kid);
  const al = async g => { const r = await K.api("oturum", { cookie: k.cookie, govde: { istek: K.yeniIstek(), mod: "practice", adet: 50, ...g } }); assert.equal(r.s, 200); K.DB.db.prepare("UPDATE soru_oturum SET durum = 'bitti' WHERE id = ?").run(r.j.oturum); return r.j.sorular; };
  const sat = id => K.DB.db.prepare("SELECT * FROM soru WHERE id = ?").get(id);
  const a = await al({ ders: "turkce", konu: "K2" }); assert.ok(a.length > 0 && a.every(q => q.t === "K2" && q.s === "turkce"));
  const b = await al({ ders: "turkce", zorluk: 3 }); assert.ok(b.length > 0 && b.every(q => q.d === 3));
  const c = await al({ ders: "turkce", zorluk: [1, 3], konu: "K1" }); assert.ok(c.length > 0 && c.every(q => (q.d === 1 || q.d === 3) && q.t === "K1"));
  const hepsi = await al({ ders: "turkce" }); assert.equal(hepsi.length, 50);
  assert.equal(new Set(hepsi.map(q => q.id)).size, 50);                                  // tekrar yok
  for (const q of [...a, ...b, ...c, ...hepsi]) { const r = sat(q.id); assert.equal(r.kopya_of, null); assert.equal(r.durum, "banka"); assert.notEqual(q.id, "eksik-a"); }
  const yok = await K.api("oturum", { cookie: k.cookie, govde: { istek: K.yeniIstek(), mod: "practice", adet: 5, ders: "din" } });
  assert.equal(yok.s, 503); assert.equal(yok.j.error, "banka_yok");   // uygun soru yok → güvenli açık hata
});
test("onayli (D1 ok-*) satırları da havuza girer", async () => {
  const K = T;
  tohumla(K.DB, 30, { onek: "ok", s: "tarih", durum: "onayli" }); tohumla(K.DB, 30, { onek: "bk", s: "tarih", durum: "banka" });
  const k = await K.giris("onayli@ornek.com"); K.premiumYap(k.kid);
  const r = await K.api("oturum", { cookie: k.cookie, govde: { istek: K.yeniIstek(), mod: "practice", adet: 50, ders: "tarih" } });
  assert.equal(r.s, 200); assert.ok(r.j.sorular.some(q => q.id.startsWith("ok-")) && r.j.sorular.some(q => q.id.startsWith("bk-")));
  const oz = await K.api("ozet", { m: "GET", cookie: k.cookie });
  assert.equal(oz.j.dersler.tarih.toplam, 60);
});

/* ---- 11-13 pratik ---- */
test("11-13) pratik: ilk cevapta a/x; aynı cevap idempotent; farklı ikinci cevap 409 cevap_kilitli", async () => {
  const { cookie } = await giris(eposta()), r = await oturumAc(cookie);
  assert.equal(r.s, 200); const q = r.j.sorular[0];
  const dogru = DB.db.prepare("SELECT a, x FROM soru WHERE id = ?").get(q.id);
  const c1 = await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: (dogru.a + 1) % 5 } });
  assert.equal(c1.s, 200); assert.deepEqual(c1.j, { dogru: false, a: dogru.a, x: dogru.x });
  const c2 = await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: (dogru.a + 1) % 5 } });
  assert.equal(c2.s, 200); assert.deepEqual(c2.j, c1.j);
  const c3 = await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: dogru.a } });
  assert.equal(c3.s, 409); assert.equal(c3.j.error, "cevap_kilitli"); assert.equal(sizintiBul(c3.j).length, 0); assert.ok(!c3.t.includes("COZUM-"));
  const q2 = r.j.sorular[1], d2 = DB.db.prepare("SELECT a FROM soru WHERE id = ?").get(q2.id);
  assert.equal((await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q2.id, secim: d2.a } })).j.dogru, true);
  for (const secim of [-1, 5, 1.5, "2", null]) assert.equal((await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: r.j.sorular[2].id, secim } })).s, 400);
  const yaz = DB.db.prepare("SELECT secim, dogru FROM soru_oturum_soru WHERE oturum = ? AND soru_id = ?").get(r.j.oturum, q.id);
  assert.equal(yaz.secim, (dogru.a + 1) % 5); assert.equal(yaz.dogru, 0);
});
test("pratik /bitir: yalnız cevaplananların anahtarı; idempotent", async () => {
  const { cookie } = await giris(eposta()), r = await oturumAc(cookie, { adet: 4 });
  const [q1, q2] = r.j.sorular, d1_ = DB.db.prepare("SELECT a FROM soru WHERE id = ?").get(q1.id);
  await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q1.id, secim: d1_.a } });
  const b = await api("bitir", { cookie, govde: { oturum: r.j.oturum } });
  assert.equal(b.s, 200); assert.equal(b.j.dogru, 1); assert.equal(b.j.yanlis, 0); assert.equal(b.j.bos, 3);
  const bos = b.j.sorular.find(s => s.id === q2.id); assert.deepEqual(Object.keys(bos).sort(), ["id", "secim"]);
  assert.ok(b.j.sorular.find(s => s.id === q1.id).x.startsWith("COZUM-"));
  const b2 = await api("bitir", { cookie, govde: { oturum: r.j.oturum } }); assert.deepEqual(b2.j, b.j);
  assert.equal((await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q2.id, secim: 0 } })).s, 409);
});

/* ---- 14-18 sınav ---- */
test("14-18) sınav: cevapta anahtar yok; seçim değişebilir; bitirde sonuç+a/x; bitir idempotent; bittikten sonra değişmez", async () => {
  const { cookie } = await giris(eposta()); T.premiumYap((DB.db.prepare("SELECT id FROM kullanici ORDER BY olusturma DESC LIMIT 1").get()).id);
  const r = await api("oturum", { cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 6, ders: "mat" } });
  assert.equal(r.s, 200); const [q1, q2, q3] = r.j.sorular, A = id => DB.db.prepare("SELECT a FROM soru WHERE id = ?").get(id).a;
  const c1 = await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q1.id, secim: (A(q1.id) + 1) % 5 } });
  assert.equal(c1.s, 200); assert.deepEqual(c1.j, { kaydedildi: true }); assert.ok(!c1.t.includes("COZUM-"));
  assert.equal((await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q1.id, secim: A(q1.id) } })).s, 200);      // değiştirildi
  await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q2.id, secim: (A(q2.id) + 2) % 5 } });
  assert.equal(DB.db.prepare("SELECT secim FROM soru_oturum_soru WHERE oturum = ? AND soru_id = ?").get(r.j.oturum, q1.id).secim, A(q1.id));
  const b = await api("bitir", { cookie, govde: { oturum: r.j.oturum } });
  assert.equal(b.s, 200); assert.equal(b.j.dogru, 1); assert.equal(b.j.yanlis, 1); assert.equal(b.j.bos, 4); assert.equal(b.j.sorular.length, 6);
  assert.ok(b.j.sorular.every(s => typeof s.x === "string" && s.x.startsWith("COZUM-")));
  assert.equal(b.j.sorular.find(s => s.id === q3.id).dogru, null);
  const b2 = await api("bitir", { cookie, govde: { oturum: r.j.oturum } }); assert.deepEqual(b2.j, b.j);
  const once = DB.db.prepare("SELECT durum, bitis FROM soru_oturum WHERE id = ?").get(r.j.oturum);
  await api("bitir", { cookie, govde: { oturum: r.j.oturum } }); assert.deepEqual(DB.db.prepare("SELECT durum, bitis FROM soru_oturum WHERE id = ?").get(r.j.oturum), once);   // durum değişmedi
  const geç = await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q1.id, secim: (A(q1.id) + 3) % 5 } });
  assert.equal(geç.s, 409); assert.equal(geç.j.error, "oturum_bitti"); assert.ok(!geç.t.includes("COZUM-"));
  assert.equal(DB.db.prepare("SELECT secim FROM soru_oturum_soru WHERE oturum = ? AND soru_id = ?").get(r.j.oturum, q1.id).secim, A(q1.id));
});

/* ---- 19-20 süre ---- */
test("19-20) süresi dolmuş oturum: cevap/bitir kabul edilmez, anahtar sızmaz; yeni oturum açılabilir", async () => {
  const { cookie, kid } = await giris(eposta()); T.premiumYap(kid);
  for (const mod of ["practice", "exam"]) {
    const r = await api("oturum", { cookie, govde: { istek: yeniIstek(), mod, adet: 3, ders: "mat" } }), q = r.j.sorular[0];
    DB.db.prepare("UPDATE soru_oturum SET sona_erme = ? WHERE id = ?").run(Date.now() - 1000, r.j.oturum);
    const c = await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: 0 } });
    assert.equal(c.s, 410, mod); assert.ok(!c.t.includes("COZUM-")); assert.equal(sizintiBul(c.j).length, 0);
    const b = await api("bitir", { cookie, govde: { oturum: r.j.oturum } });
    assert.equal(b.s, 410, mod); assert.ok(!b.t.includes("COZUM-"));
    assert.equal(DB.db.prepare("SELECT durum FROM soru_oturum WHERE id = ?").get(r.j.oturum).durum, "iptal");
    assert.equal(DB.db.prepare("SELECT secim FROM soru_oturum_soru WHERE oturum = ? AND soru_id = ?").get(r.j.oturum, q.id).secim, null);
  }
  const ust = await api("oturum", { cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } });
  assert.equal(ust.s, 200);
});
test("süre ayarı: practice 24 sa, exam 6 sa", async () => {
  const { cookie, kid } = await giris(eposta()); T.premiumYap(kid);
  const p = await api("oturum", { cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } }), x = await api("oturum", { cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 2 } });
  const ol = id => DB.db.prepare("SELECT olusturma, sona_erme FROM soru_oturum WHERE id = ?").get(id);
  assert.equal(ol(p.j.oturum).sona_erme - ol(p.j.oturum).olusturma, 24 * 3600e3); assert.equal(ol(x.j.oturum).sona_erme - ol(x.j.oturum).olusturma, 6 * 3600e3);
  assert.equal(p.j.sonaErme, ol(p.j.oturum).sona_erme);
});

/* ---- 32-33 önbellek ---- */
test("32) tüm yanıtlar Cache-Control: private, no-store (başarı, hata, 401, 403, 404, 405)", async () => {
  const { cookie } = await giris(eposta()), r = await oturumAc(cookie);
  const liste = [r, await api("oturum", { govde: {} }), await api("oturum", { cookie, govde: {}, origin: "https://kotu.example" }), await api("ozet", { m: "GET", cookie }),
    await api("cevap", { cookie, govde: { oturum: r.j.oturum, soru: r.j.sorular[0].id, secim: 1 } }), await api("bitir", { cookie, govde: { oturum: r.j.oturum } }),
    await api("yok", { m: "GET", cookie }), await api("oturum", { m: "GET", cookie }), await api("oturum", { cookie, govde: { mod: "x" } })];
  for (const x of liste) assert.equal(x.h.get("cache-control"), "private, no-store", String(x.s));
});
test("33) service worker /api/* isteklerini ağdan geçirir; soru payload'ı Cache Storage'a girmez", () => {
  const sw = readFileSync("sw.js", "utf8");
  assert.match(sw, /\/api\//); assert.match(sw, /ake-s2/);
  assert.ok(/url\.pathname\.startsWith\(["']\/api\/["']\)|pathname\.startsWith\(["']\/api\/["']\)|\/api\/\*|"\/api\/"/.test(sw), "sw.js /api/ bypass'ı bulunamadı");
  const hd = readFileSync("_headers", "utf8"); assert.ok(!/\/api\/soru/.test(hd), "_headers /api/soru için herkese açık önbellek vermemeli");
});

/* ---- 34 seçim yöntemi ---- */
test("34) ORDER BY RANDOM kodda yok; SELECT json / SELECT * yok; selecte a,x girmiyor", () => {
  const k = readFileSync("lib/soru-api.js", "utf8").split("\n").filter(s => !s.trim().startsWith("//")).join("\n");
  assert.ok(!/ORDER BY RANDOM|RANDOM\(\)/i.test(k)); assert.ok(!/SELECT\s+json\b/i.test(k)); assert.ok(!/SELECT\s+\*/i.test(k));
  assert.ok(/SELECT id, s, t, d, govde FROM soru/.test(k));
});

/* ---- 38 özet ---- */
test("38) özet: yalnız sayılar (soru metni/şık/a/x yok), auth ister", async () => {
  const { cookie } = await giris(eposta()), r = await api("ozet", { m: "GET", cookie });
  const say = ders => DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE s = ? AND durum IN ('banka','onayli') AND kopya_of IS NULL AND govde IS NOT NULL AND a IS NOT NULL AND x IS NOT NULL").get(ders).n;
  assert.equal(r.s, 200); assert.equal(r.j.toplam, say("mat") + say("fizik") + say("turkce") + say("tarih"));
  assert.equal(r.j.dersler.mat.toplam, 400); assert.equal(r.j.dersler.fizik.konular.Kuvvet.zorluk[2], 60);
  assert.equal(r.j.dersler.mat.konular.Fonksiyonlar.toplam + r.j.dersler.mat.konular.Limit.toplam, 400);
  assert.ok(!r.t.includes("COZUM-") && !r.t.includes("Soru metni") && !r.t.includes("secenek-"));
  assert.equal(sizintiBul(r.j, ["a", "x", "h", "rk", "json", "q", "o", "p", "govde"]).length, 0);
});

test("kapsam: soru-api yalnız functions/api/soru/[[yol]].js tarafından içe aktarılır; legacy uçlar, index.html ve sw.js yeni API'ye bağlanmaz", async () => {
  const { readdirSync, readFileSync: oku } = await import("node:fs"), { join } = await import("node:path");
  const tara = d => readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? tara(join(d, x.name)) : [join(d, x.name)]);
  for (const f of tara("functions")) { const var_ = /soru-api|soru-kanonik/.test(oku(f, "utf8")); assert.equal(var_, f.endsWith(join("soru", "[[yol]].js")), f); }
  for (const f of ["index.html", "sw.js", "functions/api/sorular.js"]) assert.ok(!/api\/soru\/|soru-api/.test(oku(f, "utf8")), f + " yeni API'ye bağlanmış");
});

test("doküman: güncel göç toplamı 1.216 ve yönetim write-path cutover blocker notu mevcut; kota yardımcısı 'yalnız okur' diye anlatılmıyor", async () => {
  const { readFileSync: oku } = await import("node:fs"), d = oku("docs/soru-bankasi-api.md", "utf8"), k = oku("lib/kota.js", "utf8");
  assert.ok(/1\.216/.test(d) && !/1\.016|\b1016\b/.test(d));
  assert.ok(/CUTOVER BLOCKER/.test(d) && /soru-uret/.test(d) && /ZORUNDADIR/.test(d));
  assert.ok(!/yalnız okur|yalnız okuma/.test(d + k) && /saf okuma/.test(d) && /hazirla\(\)/.test(k));
});
