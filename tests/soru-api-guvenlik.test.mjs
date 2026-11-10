// Soru API (PR 2) · cevap anahtarı sızıntısı ve sahiplik saldırıları · çalıştırma: node --test tests/soru-api-guvenlik.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { kur, tohumla, sizintiBul, SORU_ANAHTARLARI, YASAKLI_ANAHTAR } from "./yardim/soru-v2.mjs";

const T = await kur(), { DB, api, giris, yeniIstek } = T;
await T.hazirla(); tohumla(DB, 300, { onek: "g", s: "mat", konular: ["K1", "K2"] }); tohumla(DB, 100, { onek: "h", s: "fizik" });
let e = 0; const yeni = async (paket) => { const k = await giris(`guv${++e}@ornek.com`); if (paket) T.premiumYap(k.kid); return k; };
const sahip = (r) => r.t.includes("COZUM-");
const kapat = ids => ids.forEach(id => DB.db.prepare("UPDATE soru_oturum SET durum = 'bitti' WHERE id = ?").run(id));

test("7-8, 18.1-2) /oturum yanıtı: a, x, h, rk, json, kopya_of, kaynak YOK (yapı bazlı, özyinelemeli) ve soru nesneleri yalnız izinli anahtarlar", async () => {
  const k = await yeni();
  for (const mod of ["practice", "exam"]) {
    const g = { istek: yeniIstek(), mod, adet: 10, ders: "mat" }, r = await api("oturum", { cookie: k.cookie, govde: g });
    assert.equal(r.s, 200, mod); assert.deepEqual(sizintiBul(r.j), []);
    assert.equal(r.j.sorular.length, mod === "practice" ? 10 : 10);
    for (const q of r.j.sorular) { assert.ok(Object.keys(q).every(a => SORU_ANAHTARLARI.has(a)), Object.keys(q).join()); assert.equal(q.o.length, 5); assert.ok(q.o.every(x => typeof x === "string")); }
    assert.ok(!sahip(r)); assert.ok(!/"(a|x|h|rk|json|kopya_of|kaynak)"\s*:/.test(r.t));
    const tekrar = await api("oturum", { cookie: k.cookie, govde: g });   // idempotent tekrar yanıtı da aynı kuralla
    assert.equal(tekrar.s, 200); assert.deepEqual(sizintiBul(tekrar.j), []); assert.ok(!sahip(tekrar));
    kapat([r.j.oturum]);
  }
});
test("yapı yürüyücüsü gerçekten çalışıyor (yanlış negatif değil): yasaklı anahtarı iç içe bulur", () => {
  assert.deepEqual(sizintiBul({ sorular: [{ id: 1, o: ["a", "b"], ic: { x: 1 } }] }), ["$.sorular[0].ic.x"]);
  assert.deepEqual(sizintiBul({ sorular: [{ a: 2 }] }), ["$.sorular[0].a"]);
  assert.deepEqual(sizintiBul({ o: ["a", "x"], a_b: 1, ax: 2 }), []);   // yalnız anahtar adı eşleşir; değer/benzer ad yanlış pozitif vermez
  assert.ok(YASAKLI_ANAHTAR.includes("govde"));
});
test("18.3-4) sınav sürerken /bitir dışında hiçbir yoldan anahtar alınamaz", async () => {
  const k = await yeni(true), r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 8, ders: "mat" } }), [q] = r.j.sorular;
  const yanitlar = [
    await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: 0 } }),
    await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: 3 } }),
    await api("oturum", { cookie: k.cookie, govde: { istek: r.j.oturum.slice(0, 20) + "yy", mod: "exam", adet: 2 } }),
    await api("ozet", { m: "GET", cookie: k.cookie }), await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: 9 } }),
    await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: "yok-soru", secim: 1 } }),
    await api("bitir", { cookie: k.cookie, govde: { oturum: "0".repeat(48) } })
  ];
  for (const y of yanitlar) { assert.ok(!sahip(y)); assert.deepEqual(sizintiBul(y.j), []); }
  assert.equal(yanitlar[0].s, 200); assert.equal(yanitlar[1].s, 200); assert.deepEqual(yanitlar[0].j, { kaydedildi: true });
  kapat([r.j.oturum, ...yanitlar.slice(2, 3).map(x => x.j && x.j.oturum).filter(Boolean)]);
});
test("18.5-6) başka oturumun / rastgele soru kimliğiyle cevap anahtarı çekilemez", async () => {
  const k = await yeni(true), a = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 5, ders: "mat" } });
  const b = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 5, ders: "fizik" } });
  const bununDisinda = b.j.sorular[0].id;                       // b oturumunun sorusu, a oturumunda sorulamaz
  const cevap = (oturum, soru) => api("cevap", { cookie: k.cookie, govde: { oturum, soru, secim: 0 } });
  for (const [o, s] of [[a.j.oturum, bununDisinda], [a.j.oturum, "g-299"], [a.j.oturum, "h-99"], [a.j.oturum, "olmayan-id"], [a.j.oturum, "' OR 1=1 --"], [a.j.oturum, "x".repeat(500)]]) {
    const r = await cevap(o, s); assert.ok([404].includes(r.s), `${s}: ${r.s}`); assert.ok(!sahip(r)); assert.deepEqual(sizintiBul(r.j), []);
  }
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum_soru WHERE oturum = ? AND secim IS NOT NULL").get(a.j.oturum).n, 0);   // hiçbir şey yazılmadı
  for (const s of ["a", "x", 1, null, {}, []]) assert.ok([400, 404].includes((await api("cevap", { cookie: k.cookie, govde: { oturum: a.j.oturum, soru: s, secim: 0 } })).s));
  kapat([a.j.oturum, b.j.oturum]);
});
test("18.7) başka kullanıcının oturumu kullanılamaz (cevap/bitir/oturum tekrarı); kid istemciden alınmaz", async () => {
  const k1 = await yeni(true), k2 = await yeni(true), g = { istek: yeniIstek(), mod: "practice", adet: 4, ders: "mat" };
  const r = await api("oturum", { cookie: k1.cookie, govde: g }), q = r.j.sorular[0];
  const c = await api("cevap", { cookie: k2.cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: 1 } });
  assert.equal(c.s, 404); assert.ok(!sahip(c));
  const b = await api("bitir", { cookie: k2.cookie, govde: { oturum: r.j.oturum } }); assert.equal(b.s, 404); assert.ok(!sahip(b));
  assert.equal(DB.db.prepare("SELECT durum FROM soru_oturum WHERE id = ?").get(r.j.oturum).durum, "acik");
  assert.equal((await api("cevap", { cookie: k1.cookie, govde: { oturum: r.j.oturum, soru: q.id, secim: 1, kid: k2.kid } })).s, 400);   // kid alanı reddedilir
  assert.equal((await api("oturum", { cookie: k1.cookie, govde: { ...g, istek: yeniIstek(), kid: k2.kid } })).s, 400);
  /* aynı istek kimliği başka kullanıcıda ayrı oturum üretir; ilk kullanıcınınkini döndürmez */
  const r2 = await api("oturum", { cookie: k2.cookie, govde: g }); assert.equal(r2.s, 200); assert.notEqual(r2.j.oturum, r.j.oturum);
  assert.equal(DB.db.prepare("SELECT kid FROM soru_oturum WHERE id = ?").get(r2.j.oturum).kid, k2.kid);
  /* başkasının çerezini taklit: sahte çerez 401 */
  assert.equal((await api("cevap", { cookie: "ake_s=" + "c".repeat(64), govde: { oturum: r.j.oturum, soru: q.id, secim: 1 } })).s, 401);
  kapat([r.j.oturum, r2.j.oturum]);
});
test("18.8) bitmiş oturuma cevap gönderilemez (pratik ve sınav); bitir sonrası kayıt değişmez", async () => {
  const k = await yeni(true);
  for (const mod of ["practice", "exam"]) {
    const r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod, adet: 3, ders: "mat" } });
    await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum } });
    const c = await api("cevap", { cookie: k.cookie, govde: { oturum: r.j.oturum, soru: r.j.sorular[0].id, secim: 2 } });
    assert.equal(c.s, 409); assert.equal(c.j.error, "oturum_bitti"); assert.ok(!sahip(c));
    assert.equal(DB.db.prepare("SELECT secim FROM soru_oturum_soru WHERE oturum = ? AND soru_id = ?").get(r.j.oturum, r.j.sorular[0].id).secim, null);
  }
});
test("SQL enjeksiyonu: konu/ders/istek yalnız bind ile; tablolar sağlam", async () => {
  const k = await yeni(true);
  for (const konu of ["' OR 1=1 --", "K1'; DROP TABLE soru; --", "%", "K1\u0000"]) {
    const r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 5, konu } });
    assert.ok([200, 503].includes(r.s)); if (r.s === 200) assert.ok(r.j.sorular.every(q => q.t === konu)); assert.deepEqual(sizintiBul(r.j), []);
    if (r.s === 200) kapat([r.j.oturum]);
  }
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n, 400);
});
test("25) ücretli kullanıcı da tek istekte 50/120'yi aşamaz (adet=100000 → 400); sınırda 50/120 verilir", async () => {
  const k = await yeni(true);
  for (const [mod, ust] of [["practice", 50], ["exam", 120]]) {
    for (const adet of [ust + 1, 500, 100000, Number.MAX_SAFE_INTEGER, -1]) assert.equal((await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod, adet } })).s, 400, `${mod}/${adet}`);
    const r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod, adet: ust } });
    assert.equal(r.s, 200); assert.equal(r.j.sorular.length, ust); assert.equal(new Set(r.j.sorular.map(q => q.id)).size, ust); kapat([r.j.oturum]);
  }
});
test("abuse: kullanıcı başına en çok 3 açık oturum → 4.'sü 429; bitirince tekrar açılır; limit kullanıcıya özel", async () => {
  const k = await yeni(true), diger = await yeni(true), ids = [];
  for (let i = 0; i < 3; i++) { const r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } }); assert.equal(r.s, 200); ids.push(r.j.oturum); }
  const dort = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } });
  assert.equal(dort.s, 429); assert.equal(dort.j.error, "cok_acik_oturum");
  assert.equal((await api("oturum", { cookie: diger.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } })).s, 200);
  await api("bitir", { cookie: k.cookie, govde: { oturum: ids[0] } });
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } })).s, 200);
  DB.db.prepare("UPDATE soru_oturum SET sona_erme = ? WHERE id = ?").run(Date.now() - 5, ids[1]);   // süresi dolan açık sayılmaz
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } })).s, 200);
});
test("oturum kimliği ≥128 bit rastgele; istemci kendi kimliğini seçemez", async () => {
  const k = await yeni(true), r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2 } });
  assert.match(r.j.oturum, /^[0-9a-f]{48}$/);
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2, oturum: "a".repeat(48), id: "x" } })).s, 400);
});
test("istek kimliği çakışması: aynı istek + farklı parametre → 409 istek_cakisma (kota harcanmaz)", async () => {
  const k = await yeni(), g = { istek: yeniIstek(), mod: "practice", adet: 5, ders: "mat" };
  assert.equal((await api("oturum", { cookie: k.cookie, govde: g })).s, 200);
  const r = await api("oturum", { cookie: k.cookie, govde: { ...g, adet: 6 } }); assert.equal(r.s, 409); assert.equal(r.j.error, "istek_cakisma");
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { ...g, mod: "exam" } })).s, 409);
});
test.todo("PLAN (ayrı PR): kalıcı saatlik oturum-oluşturma hız sınırı (D1 tabanlı, 429) — bu PR'da yalnız 3 açık oturum sınırı var");
