// Fabrika robotu · hat testleri: taslak → kör model denetimi → inceleme kuyruğu → yönetici yayım kararı.
// Gerçek Anthropic çağrısı YOK: modeli enjekte edilen sahte işlev temsil eder. Sorular sentetik.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, sentetik } from "./yardim/soru-v2.mjs";
import { fabrikaSema, robotAyarla, pilotBaslat, pilotDurdur, isIsle, fabrikaDurum, adaylar, PILOT_AZAMI } from "../lib/fabrika.js";
import { yayimKarariUzmanli as yayimKarari } from "./yardim/uzman.mjs";
import { soruOnayla } from "../lib/soru-yaz.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com", AKE_FABRIKA_GUNLUK_CAGRI: "500" } });
const { DB, env } = T;
await T.hazirla();
const yon = await T.giris("yonetici@ornek.com");
const sifirla = () => { for (const t of ["soru", "fabrika_soru", "fabrika_cagri", "fabrika_is", "fabrika_pilot"]) { try { DB.db.exec("DELETE FROM " + t); } catch (e) { } } delete env.AKE_FABRIKA_GUNLUK_CAGRI; env.AKE_FABRIKA_GUNLUK_CAGRI = "500"; };
const say = (t, w = "1=1") => DB.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${w}`).get().n;

/* sahte model: uretim → sıradaki sentetik soru; denetim → verilen davranış. İstek metnini kaydeder. */
function sahte({ denetim = "dogru", baslangic = 1, hepsiAyni = false, hata = null } = {}) {
  const f = { cagrilar: [], sayac: baslangic - 1 };
  f.fn = async ({ tur, model, prompt }) => {
    f.cagrilar.push({ tur, model, prompt });
    if (hata && hata(tur, f.cagrilar.length)) return { hata: "ag_hatasi", giris: 0, cikis: 0 };
    if (tur === "uretim") { const i = hepsiAyni ? baslangic : ++f.sayac; const s = sentetik(i); return { metin: JSON.stringify([{ p: s.p, q: s.q, o: s.o, a: s.a, x: s.x }]), giris: 100, cikis: 50 }; }
    const m = /SENTETIK-SORU-(\d+)/.exec(prompt), i = m ? +m[1] : 0, dogru = sentetik(i).a;
    const cevap = denetim === "dogru" ? dogru : denetim === "yanlis" ? (dogru + 1) % 5 : null;
    if (denetim === "bozuk") return { metin: "bu json degil", giris: 80, cikis: 10 };
    return { metin: JSON.stringify({ cevap, tek_dogru: cevap !== null, belirsiz: cevap === null, sorunlar: [] }), giris: 80, cikis: 20 };
  };
  return f;
}
const ileriSaat = () => { let t = Date.now() + 10 * 86400000; return () => (t += 3600000); };   // her çağrıda 1 saat ilerleyen sahte saat: geri çekilme süreleri atlanır
const calistir = async (f, ek = {}) => { let toplam = 0, n; do { n = (await isIsle(env, { claudeFn: f.fn, azami: 50, ...ek })).islenen; toplam += n; } while (n > 0 && toplam < 400); return toplam; };

test("robot varsayılan KAPALI: pilot başlatılamaz, işçi hiçbir model çağrısı yapmaz", async () => {
  sifirla(); await fabrikaSema(env);
  const r = await pilotBaslat(env, {}); assert.equal(r.ok, false); assert.equal(r.neden, "robot_kapali");
  const f = sahte(); await calistir(f); assert.equal(f.cagrilar.length, 0);
  assert.equal((await fabrikaDurum(env)).robot, false);
});

test("pilot: en çok 10 soru; ikinci pilot reddedilir; üretim işleri kuyruğa yazılır", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true);
  const r = await pilotBaslat(env, { hedef: 500 }); assert.equal(r.ok, true); assert.equal(PILOT_AZAMI, 10);
  assert.equal(say("fabrika_is", "tur = 'uret' AND durum = 'bekliyor'"), 10);
  const r2 = await pilotBaslat(env, {}); assert.equal(r2.ok, false); assert.equal(r2.neden, "pilot_zaten_var");
});

test("uçtan uca: 10 soru taslak → kör denetim → inceleme; HİÇBİRİ canlı değil; model-geçti ≠ yayında", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, {});
  const f = sahte(); await calistir(f);
  const d = await fabrikaDurum(env);
  assert.equal(d.sayilar.uretilen, 10); assert.equal(d.sayilar.model_gecti, 10); assert.equal(d.sayilar.yayinda, 0); assert.equal(d.sayilar.yonetici_yayimladi, 0); assert.equal(d.sayilar.uzman_kabul, 0);
  assert.equal(say("soru", "durum IN ('onayli','banka','bekliyor')"), 0); assert.equal(say("soru", "durum = 'taslak'"), 10);
  assert.equal(say("fabrika_soru", "asama = 'inceleme' AND model_durum = 'gecti' AND denetim_tam = 1 AND sayisal = 'yapilmadi'"), 10);
  /* çağrı kaydı: model, token, süre, hata alanı, soru sürümü */
  const c = DB.db.prepare("SELECT * FROM fabrika_cagri").all(); assert.equal(c.length, 20);
  for (const x of c) { assert.ok(x.model && x.model.length > 3); assert.ok(x.giris > 0 && x.cikis > 0); assert.ok(x.sure_ms >= 0); assert.ok("hata" in x); assert.equal(x.surum, 1); assert.ok(["uretim", "denetim"].includes(x.tur)); }
  assert.equal((await adaylar(env)).length, 10);
});

test("KÖR denetim: denetçi isteği cevap anahtarını, çözümü ve üretici notunu İÇERMEZ", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, {}); const f = sahte(); await calistir(f);
  const den = f.cagrilar.filter(c => c.tur === "denetim"); assert.equal(den.length, 10);
  for (const c of den) { assert.ok(/SENTETIK-SORU-\d+/.test(c.prompt) && /SENTETIK-SIK-/.test(c.prompt)); assert.ok(!/SENTETIK-COZUM/.test(c.prompt), "çözüm sızdı"); assert.ok(!/"a"\s*:|cevap anahtar[ıi]:|doğru cevap:/i.test(c.prompt), "anahtar sızdı"); }
});

test("yanlış cevap: denetçi farklı şık seçerse 'revizyon'; yayımlanamaz (409)", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, {}); await calistir(sahte({ denetim: "yanlis" }));
  assert.equal(say("fabrika_soru", "model_durum = 'revizyon'"), 10); assert.equal(say("fabrika_soru", "model_durum = 'gecti'"), 0);
  const id = DB.db.prepare("SELECT soru_id FROM fabrika_soru LIMIT 1").get().soru_id;
  const r = await yayimKarari(env, [id], "yayin", "yonetici@ornek.com"); assert.equal(r.ok, false); assert.match(JSON.stringify(r.hatalar), /model_gecmedi/);
  assert.equal(say("soru", "durum = 'onayli'"), 0);
});

test("belirsiz/bozuk denetim çıktısı: 'belirsiz' ve yayımlanamaz", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, {}); await calistir(sahte({ denetim: "bozuk" }));
  assert.equal(say("fabrika_soru", "model_durum = 'belirsiz'"), 10);
  const id = DB.db.prepare("SELECT soru_id FROM fabrika_soru LIMIT 1").get().soru_id;
  assert.equal((await yayimKarari(env, [id], "yayin", "y")).ok, false); assert.equal(say("soru", "durum = 'onayli'"), 0);
});

test("denetim tamamlanmamış (API hatası, tekrar deneme tükendi): denetim_tam=0, yayımlanamaz; deneme sayısı sınırlı", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 1 });
  const f = sahte({ hata: tur => tur === "denetim" });
  await calistir(f, { simdi: ileriSaat() });   // bekleme sürelerini atla
  const den = f.cagrilar.filter(c => c.tur === "denetim").length; assert.ok(den >= 2 && den <= 3, "denetim deneme sayısı " + den);
  const fs = DB.db.prepare("SELECT * FROM fabrika_soru").get(); assert.equal(fs.denetim_tam, 0); assert.notEqual(fs.asama, "inceleme");
  assert.equal(say("fabrika_is", "tur = 'denetle' AND durum = 'olu'"), 1);
  assert.equal(say("fabrika_cagri", "hata IS NOT NULL"), den);
  assert.equal((await yayimKarari(env, [fs.soru_id], "yayin", "y")).ok, false); assert.equal(say("soru", "durum = 'onayli'"), 0);
});

test("tekrar deneme: geçici hata sonrası aynı iş yeniden denenir ve tamamlanır", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 1 });
  let ilk = true; const f = sahte({ hata: tur => { if (tur === "denetim" && ilk) { ilk = false; return true; } return false; } });
  await calistir(f, { simdi: ileriSaat() });
  assert.equal(say("fabrika_soru", "model_durum = 'gecti' AND denetim_tam = 1"), 1); assert.equal(say("fabrika_cagri", "hata IS NOT NULL"), 1);
});

test("kopya: aynı soru iki kez üretilirse ikincisi 'tekrar' işaretlenir ve yayımlanamaz", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 2, ders: "mat", konu: "Sayılar" }); await calistir(sahte({ hepsiAyni: true }));
  const d = await fabrikaDurum(env); assert.ok(d.sayilar.tekrar >= 1);
  const t = DB.db.prepare("SELECT soru_id FROM fabrika_soru WHERE tekrar = 1").get();
  const r = await yayimKarari(env, [t.soru_id], "yayin", "y"); assert.equal(r.ok, false); assert.match(JSON.stringify(r.hatalar), /tekrar/);
});

test("yönetici yayım kararı: yalnız denetimi geçen soru canlıya geçer; öğrenci artık görür; sayılar ayrı", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 3 }); await calistir(sahte());
  const ids = DB.db.prepare("SELECT soru_id FROM fabrika_soru ORDER BY soru_id").all().map(r => r.soru_id);
  const r = await yayimKarari(env, [ids[0]], "yayin", "yonetici@ornek.com"); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(DB.db.prepare("SELECT durum FROM soru WHERE id = ?").get(ids[0]).durum, "onayli");
  assert.equal(say("soru", "durum = 'onayli'"), 1); assert.equal(say("soru", "durum = 'taslak'"), 2);
  const d = await fabrikaDurum(env); assert.equal(d.sayilar.model_gecti, 3); assert.equal(d.sayilar.yayinda, 1); assert.equal(d.sayilar.yonetici_yayimladi, 1);
  assert.equal(DB.db.prepare("SELECT yayim_durum, yayim_kim FROM fabrika_soru WHERE soru_id = ?").get(ids[0]).yayim_kim, "yonetici@ornek.com");
  const red = await yayimKarari(env, [ids[1]], "red", "yonetici@ornek.com"); assert.equal(red.ok, true); assert.equal(DB.db.prepare("SELECT durum FROM soru WHERE id = ?").get(ids[1]).durum, "red");
});

test("yarış: yayım anında satırın model durumu bozulursa batch SQL'de geri alınır (hiçbir soru canlı olmaz)", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 2 }); await calistir(sahte());
  const ids = DB.db.prepare("SELECT soru_id FROM fabrika_soru").all().map(r => r.soru_id);
  DB.hook.hedef = /UPDATE soru SET durum = 'onayli'/; DB.hook.once = () => DB.db.prepare("UPDATE fabrika_soru SET model_durum = 'revizyon' WHERE soru_id = ?").run(ids[1]);
  const r = await yayimKarari(env, ids, "yayin", "y"); DB.hook.hedef = null; DB.hook.once = null;
  assert.equal(r.ok, false); assert.equal(say("soru", "durum = 'onayli'"), 0); assert.equal(say("fabrika_soru", "yayim_durum = 'onayli'"), 0);
});

test("soruOnayla'ya geçit olmadan taslak satır verilemez: 'bekliyor' dışı satır onaylanmaz", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 1 }); await calistir(sahte());
  const id = DB.db.prepare("SELECT soru_id FROM fabrika_soru").get().soru_id;
  const r = await soruOnayla(env, [id]); assert.equal(r.onaylanan, 0); assert.equal(DB.db.prepare("SELECT durum FROM soru WHERE id = ?").get(id).durum, "taslak");
});

test("durdur: bekleyen işler iptal edilir, model çağrılmaz; durmuş pilot yeniden başlatılabilir", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, {});
  const d = await pilotDurdur(env); assert.equal(d.ok, true);
  const f = sahte(); await calistir(f); assert.equal(f.cagrilar.length, 0); assert.equal(say("fabrika_is", "durum = 'bekliyor'"), 0);
  assert.equal((await pilotBaslat(env, {})).ok, true);
});

test("günlük çağrı kotası: sınıra gelince işçi durur, kalan işler bekler", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, {}); env.AKE_FABRIKA_GUNLUK_CAGRI = "3";
  const f = sahte(); await calistir(f); assert.equal(f.cagrilar.length, 3); assert.ok(say("fabrika_is", "durum = 'bekliyor'") > 0);
});

test("kilit süresi dolmuş 'calisiyor' iş yeniden alınır; süresi dolmamış iş alınmaz", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 1 });
  DB.db.prepare("UPDATE fabrika_is SET durum = 'calisiyor', kilit_bitis = ?").run(Date.now() + 600000);
  let f = sahte(); await calistir(f); assert.equal(f.cagrilar.length, 0);
  DB.db.prepare("UPDATE fabrika_is SET kilit_bitis = ?").run(Date.now() - 1000);
  f = sahte(); await calistir(f); assert.ok(f.cagrilar.length >= 1);
});

test("yönetim uçları: anonim/öğrenci 403; yönetici durum+aday+çağrı görür; maliyet fabrika USD'sini sıfır göstermez", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 2 }); await calistir(sahte());
  const ogr = await T.giris("ogrenci2@ornek.com");
  for (const [yol, m] of [["fabrika-durum", "GET"], ["fabrika-adaylar", "GET"], ["fabrika-cagrilar", "GET"], ["fabrika-pilot-baslat", "POST"], ["fabrika-pilot-durdur", "POST"], ["fabrika-robot", "POST"], ["fabrika-karar", "POST"]]) {
    assert.equal((await yonetimIstek(T, yol, { m })).s, 403, yol + " anonim"); assert.equal((await yonetimIstek(T, yol, { m, cookie: ogr.cookie })).s, 403, yol + " öğrenci");
  }
  const d = await yonetimIstek(T, "fabrika-durum", { m: "GET", cookie: yon.cookie }); assert.equal(d.s, 200); assert.equal(d.j.sayilar.model_gecti, 2); assert.equal(d.j.sayilar.yonetici_yayimladi, 0);
  const a = await yonetimIstek(T, "fabrika-adaylar", { m: "GET", cookie: yon.cookie }); assert.equal(a.s, 200); assert.equal(a.j.adaylar.length, 2); assert.ok(a.j.adaylar[0].q && Array.isArray(a.j.adaylar[0].o) && a.j.adaylar[0].model_durum === "gecti");
  const c = await yonetimIstek(T, "fabrika-cagrilar", { m: "GET", cookie: yon.cookie }); assert.equal(c.j.cagrilar.length, 4);
  const mal = await yonetimIstek(T, "maliyet", { m: "GET", cookie: yon.cookie }); assert.ok(mal.j.kaynak.fabrika > 0, "fabrika USD 0 gösterildi"); assert.ok(mal.j.fabrikaUsd > 0);
  assert.equal((await yonetimIstek(T, "fabrika-uzman", { cookie: yon.cookie, govde: { soru_id: a.j.adaylar[0].id, karar: "kabul", uzman_ad: "Test Uzmanı", brans: "Test branşı", gerekce: "Test için sentetik uzman kabulü kaydı.", tarih: new Date().toISOString().slice(0, 10) } })).s, 200);
  const k = await yonetimIstek(T, "fabrika-karar", { cookie: yon.cookie, govde: { id: [a.j.adaylar[0].id], karar: "yayin" } }); assert.equal(k.s, 200); assert.equal(say("soru", "durum = 'onayli'"), 1);
  const bad = await yonetimIstek(T, "fabrika-karar", { cookie: yon.cookie, govde: { id: ["yok-id"], karar: "yayin" } }); assert.equal(bad.s, 409);
});

test("öğrenci uçları: taslak/inceleme sorusu hiçbir öğrenci yolunda görünmez; yayımlanan görünür", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef: 2 }); await calistir(sahte());
  const sorular = await import("../functions/api/sorular.js");
  const liste = async () => { const r = await sorular.onRequest({ request: new Request("https://akeakademi.com/api/sorular"), env }); const j = await r.json(); return Array.isArray(j) ? j : (j.sorular || []); };
  assert.equal((await liste()).length, 0);
  const u = await T.giris("ogrenci3@ornek.com"); T.premiumYap(u.kid);
  const o = await T.api("oturum", { cookie: u.cookie, govde: { istek: T.yeniIstek(), ders: "mat", mod: "practice", adet: 5 } }); assert.ok(!/SENTETIK-SORU/.test(o.t));
  const id = DB.db.prepare("SELECT soru_id FROM fabrika_soru LIMIT 1").get().soru_id; assert.equal((await yayimKarari(env, [id], "yayin", "y")).ok, true);
  assert.equal((await liste()).length, 1);
});
