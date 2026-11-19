// Fabrika robotu · PR #33 düzeltmeleri: sıkı geçit, fiyat, çağrı-soru bağı, geçersiz karar, durdurma sırasındaki işler.
// Gerçek API çağrısı YOK; model enjekte edilen sahte işlevdir.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kur, yonetimIstek, sentetik } from "./yardim/soru-v2.mjs";
import { fabrikaSema, robotAyarla, pilotBaslat, pilotDurdur, isIsle, fabrikaDurum, adaylar, yayimKarari, usdHesapla } from "../lib/fabrika.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com", AKE_FABRIKA_GUNLUK_CAGRI: "500" } });
const { DB, env } = T; await T.hazirla(); const yon = await T.giris("yonetici@ornek.com");
const sifirla = () => { for (const t of ["soru", "fabrika_soru", "fabrika_cagri", "fabrika_is", "fabrika_pilot"]) { try { DB.db.exec("DELETE FROM " + t); } catch (e) { } } };
const say = (t, w = "1=1") => DB.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${w}`).get().n;
const basla = async (hedef = 1) => { sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef, ders: "mat", konu: "Sayılar" }); };
const ileri = () => { let t = Date.now() + 10 * 86400000; return () => (t += 3600000); };
const kos = async fn => { let n, top = 0; const simdi = ileri(); do { n = (await isIsle(env, { claudeFn: fn, azami: 20, simdi })).islenen; top += n; } while (n > 0 && top < 100); return top; };
/* denetim çıktısı verilen sahte model */
const model = (denetim, { once } = {}) => async ({ tur, prompt }) => {
  if (once) { const r = await once({ tur }); if (r) return r; }
  if (tur === "uretim") { const s = sentetik(1); return { metin: JSON.stringify([{ p: "", q: s.q, o: s.o, a: s.a, x: s.x }]), giris: 100, cikis: 50 }; }
  const dogru = sentetik(1).a; const d = typeof denetim === "function" ? denetim(dogru) : denetim;
  return { metin: typeof d === "string" ? d : JSON.stringify(d), giris: 80, cikis: 20 };
};

/* ---- 1) sıkı model geçidi ---- */
const TAM = a => ({ cevap: a, tek_dogru: true, belirsiz: false, sorunlar: [] });
const GECERSIZLER = [
  ["belirsiz alanı yok", a => { const d = TAM(a); delete d.belirsiz; return d; }, "belirsiz"],
  ["tek_dogru alanı yok", a => { const d = TAM(a); delete d.tek_dogru; return d; }, "belirsiz"],
  ["tek_dogru metin 'true'", a => ({ ...TAM(a), tek_dogru: "true" }), "belirsiz"],
  ["belirsiz 0 (boolean değil)", a => ({ ...TAM(a), belirsiz: 0 }), "belirsiz"],
  ["sorunlar alanı yok", a => { const d = TAM(a); delete d.sorunlar; return d; }, "belirsiz"],
  ["sorunlar dizi değil", a => ({ ...TAM(a), sorunlar: "yok" }), "belirsiz"],
  ["belirsiz:true", a => ({ ...TAM(a), belirsiz: true }), "belirsiz"],
  ["tek_dogru:false", a => ({ ...TAM(a), tek_dogru: false }), "ret"],
  ["cevap doğru ama kalite sorunu bildirildi", a => ({ ...TAM(a), sorunlar: ["Çeldirici C zayıf"] }), "revizyon"],
  ["cevap farklı", a => TAM((a + 1) % 5), "revizyon"]
];
for (const [ad, uret, beklenen] of GECERSIZLER) {
  test(`geçit: ${ad} → '${beklenen}', 'gecti' DEĞİL; yayımlanamaz`, async () => {
    await basla(); await kos(model(uret));
    const f = DB.db.prepare("SELECT * FROM fabrika_soru").get(); assert.equal(f.model_durum, beklenen); assert.notEqual(f.model_durum, "gecti");
    const r = await yayimKarari(env, [f.soru_id], "yayin", "y"); assert.equal(r.ok, false); assert.equal(say("soru", "durum = 'onayli'"), 0);
    if (beklenen === "revizyon") assert.ok(JSON.parse(f.denetim_json).sorunlar.length >= 0);
  });
}
test("geçit: yalnız açık tek_dogru:true + belirsiz:false + boş sorunlar + anahtarla aynı cevap → 'gecti'", async () => {
  await basla(); await kos(model(TAM)); assert.equal(DB.db.prepare("SELECT model_durum FROM fabrika_soru").get().model_durum, "gecti");
});
test("geçit: bildirilen kalite sorunları denetim kaydında korunur (revizyon gerekçesi)", async () => {
  await basla(); await kos(model(a => ({ ...TAM(a), sorunlar: ["Soru kökü eksik veri içeriyor", "Çeldirici D zayıf"] })));
  const f = DB.db.prepare("SELECT denetim_json FROM fabrika_soru").get(); assert.deepEqual(JSON.parse(f.denetim_json).sorunlar, ["Soru kökü eksik veri içeriyor", "Çeldirici D zayıf"]);
  assert.equal((await adaylar(env))[0].model_durum, "revizyon");
});

/* ---- 2) fiyat ---- */
test("fiyat: claude-sonnet-5-5 = 2 $ giriş / 10 $ çıkış (milyon token); eski tahmin değerleri (3/15) kullanılmaz", () => {
  assert.equal(usdHesapla({}, "claude-sonnet-5-5", 1e6, 0), 2); assert.equal(usdHesapla({}, "claude-sonnet-5-5", 0, 1e6), 10); assert.equal(usdHesapla({}, "claude-sonnet-5-5", 4000, 1600), (4000 * 2 + 1600 * 10) / 1e6);
  assert.equal(usdHesapla({ AKE_FIYAT_GUCLU_GIRIS: "3", AKE_FIYAT_GUCLU_CIKIS: "15" }, "claude-sonnet-5-5", 1e6, 1e6), 12);   // eski env tahmin ayarları fabrika fiyatını değiştirmez
});
test("fiyat: bilinmeyen model için fiyat UYDURULMAZ (null); yalnız operatörün açıkça verdiği fiyat kullanılır", () => {
  for (const m of ["claude-haiku-5-5", "claude-opus-5-5", "claude-fable-5-2", "bilinmeyen-model", "", null, undefined]) assert.equal(usdHesapla({}, m, 1e6, 1e6), null, String(m));
  assert.equal(usdHesapla({ AKE_FABRIKA_FIYATLAR: JSON.stringify({ "claude-haiku-5-5": [1, 5] }) }, "claude-haiku-5-5", 1e6, 1e6), 6);
  assert.equal(usdHesapla({ AKE_FABRIKA_FIYATLAR: "{bozuk" }, "claude-haiku-5-5", 1e6, 1e6), null);
  assert.equal(usdHesapla({ AKE_FABRIKA_FIYATLAR: JSON.stringify({ "claude-haiku-5-5": [-1, "x"] }) }, "claude-haiku-5-5", 1e6, 1e6), null);
});
test("fiyat: bilinmeyen modelin çağrısı toplam USD'ye eklenmez, ayrıca 'fiyatı bilinmeyen' olarak sayılır (durum + maliyet ekranı)", async () => {
  await basla(2); await kos(model(TAM));   // varsayılan model sonnet-5-5
  DB.db.prepare("INSERT INTO fabrika_cagri (id, tur, model, giris, cikis, sure_ms, tarih, gun) VALUES ('x1', 'denetim', 'baska-model-9', 1000000, 1000000, 1, ?, ?)").run(Date.now(), new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10));
  const d = await fabrikaDurum(env), bilinen = (4 * 200 + 0) ;
  assert.ok(d.cagri.usd > 0 && d.cagri.usd < 1, "bilinmeyen model USD'ye karıştı: " + d.cagri.usd);
  assert.equal(d.cagri.fiyatsizCagri, 1); assert.deepEqual(d.cagri.fiyatsizModeller, ["baska-model-9"]);
  const m = await yonetimIstek(T, "maliyet", { m: "GET", cookie: yon.cookie });
  assert.equal(m.j.fabrikaFiyatsizCagri, 1); assert.deepEqual(m.j.fabrikaFiyatsizModeller, ["baska-model-9"]); assert.ok(m.j.fabrikaUsd < 1);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"); assert.match(html, /fiyatı bilinmeyen/i);
});

/* ---- 3) üretim çağrısı soru_id + sürüme bağlı ---- */
test("çağrı kaydı: üretim çağrısı oluşan soru_id ve sürümüne bağlanır; soru oluşmayan üretim çağrısı bağsız kalır", async () => {
  await basla(2);
  let n = 0; const f = async ({ tur, prompt }) => {
    if (tur === "uretim") { n++; if (n === 1) return { metin: "json değil", giris: 10, cikis: 5 }; const s = sentetik(2); return { metin: JSON.stringify([{ p: "", q: s.q, o: s.o, a: s.a, x: s.x }]), giris: 100, cikis: 50 }; }
    return { metin: JSON.stringify(TAM(sentetik(2).a)), giris: 80, cikis: 20 };
  };
  await kos(f);
  const sorular = DB.db.prepare("SELECT soru_id FROM fabrika_soru").all().map(r => r.soru_id); assert.ok(sorular.length >= 1);
  const uretimler = DB.db.prepare("SELECT * FROM fabrika_cagri WHERE tur = 'uretim'").all();
  const bagli = uretimler.filter(c => c.soru_id !== null), bagsiz = uretimler.filter(c => c.soru_id === null);
  assert.equal(bagli.length, sorular.length, "her soru için tam bir üretim çağrısı bağlı olmalı");   // birebir eşleşme (sıra bağımsız)
  assert.deepEqual(bagli.map(c => c.soru_id).sort(), [...sorular].sort());
  for (const c of bagli) assert.equal(c.surum, 1);
  assert.ok(bagsiz.length >= 1); for (const c of bagsiz) assert.equal(c.surum, null);   // çözümlenemeyen üretim çıktısı: soru yok, bağ yok
  const den = DB.db.prepare("SELECT * FROM fabrika_cagri WHERE tur = 'denetim'").all(); assert.ok(den.length >= 1); for (const c of den) { assert.ok(sorular.includes(c.soru_id)); assert.equal(c.surum, 1); }
});

/* ---- 4) geçersiz karar ---- */
test("karar: geçersiz/eksik karar değeri otomatik 'red' sayılmaz; hata döner, hiçbir satır değişmez", async () => {
  await basla(); await kos(model(TAM)); const id = DB.db.prepare("SELECT soru_id FROM fabrika_soru").get().soru_id;
  for (const k of ["kabul", "RED", "", null, undefined, 1, "yayinla"]) {
    const r = await yayimKarari(env, [id], k, "y"); assert.equal(r.ok, false, String(k)); assert.equal(r.hatalar[0].neden, "karar_gecersiz");
    const h = await yonetimIstek(T, "fabrika-karar", { cookie: yon.cookie, govde: { id: [id], karar: k } }); assert.equal(h.s, 400, String(k)); assert.equal(h.j.error, "karar_gecersiz");
  }
  const bos = await yonetimIstek(T, "fabrika-karar", { cookie: yon.cookie, govde: { id: [id] } }); assert.equal(bos.s, 400);
  assert.equal(DB.db.prepare("SELECT durum FROM soru WHERE id = ?").get(id).durum, "taslak"); assert.equal(DB.db.prepare("SELECT yayim_durum FROM fabrika_soru WHERE soru_id = ?").get(id).yayim_durum, "yok");
  assert.equal((await yonetimIstek(T, "fabrika-karar", { cookie: yon.cookie, govde: { id: [id], karar: "red" } })).s, 200);   // geçerli red hâlâ çalışır
});

/* ---- 5) durdurma sırasında alınmış işler ---- */
test("durdurma: model yanıtı beklenen ÜRETİM işi — yanıt kaydedilir (çağrı günlüğü), taslak oluşur ama yeni denetim BAŞLAMAZ, yayımlanamaz", async () => {
  await basla();
  const f = model(TAM, { once: async ({ tur }) => { if (tur === "uretim") await pilotDurdur(env); return null; } });
  await kos(f);
  assert.equal(say("fabrika_cagri", "tur = 'uretim'"), 1); assert.equal(say("fabrika_cagri", "tur = 'denetim'"), 0);   // durdurmadan sonra yeni model çağrısı yok
  const s = DB.db.prepare("SELECT * FROM fabrika_soru").get(); assert.equal(s.asama, "denetim_bekliyor"); assert.equal(s.denetim_tam, 0); assert.equal(s.model_durum, "bekliyor");
  assert.equal(say("fabrika_is", "tur = 'denetle'"), 0); assert.equal(say("fabrika_is", "durum = 'bekliyor' OR durum = 'calisiyor'"), 0);
  assert.equal(say("soru", "durum = 'taslak'"), 1); assert.equal(say("soru", "durum IN ('onayli','banka')"), 0);
  assert.equal((await yayimKarari(env, [s.soru_id], "yayin", "y")).ok, false);
  const a = await adaylar(env); assert.equal(a.length, 1); assert.equal(a[0].asama, "denetim_bekliyor");   // panelde görünür → yönetici reddedebilir
  assert.equal((await yayimKarari(env, [s.soru_id], "red", "y")).ok, true);
  assert.equal((await fabrikaDurum(env)).pilot.durum, "durdu");
});
test("durdurma: yanıt beklenen iş HATA ile dönerse yeniden denenmez (iptal); durmuş pilot yeniden canlanmaz", async () => {
  await basla();
  const f = model(TAM, { once: async ({ tur }) => { if (tur === "uretim") { await pilotDurdur(env); return { hata: "ag_hatasi", giris: 0, cikis: 0 }; } return null; } });
  await kos(f);
  assert.equal(say("fabrika_is", "durum = 'bekliyor'"), 0); assert.equal(say("fabrika_is", "durum = 'iptal'"), 1); assert.equal(say("fabrika_cagri", "hata IS NOT NULL"), 1);
  const g = model(TAM); let cagri = 0; await kos(async x => { cagri++; return g(x); }); assert.equal(cagri, 0);
});
test("durdurma: yanıt beklenen DENETİM işi — sonuç kaydedilir (model_durum), soru yine canlıya geçmez; yeni iş alınmaz", async () => {
  await basla(2);
  let durdu = false; const f = model(TAM, { once: async ({ tur }) => { if (tur === "denetim" && !durdu) { durdu = true; await pilotDurdur(env); } return null; } });
  await kos(f);
  assert.equal(say("fabrika_cagri", "tur = 'denetim'"), 1);
  const bitenler = DB.db.prepare("SELECT * FROM fabrika_soru WHERE asama = 'inceleme'").all(); assert.equal(bitenler.length, 1); assert.equal(bitenler[0].model_durum, "gecti"); assert.equal(bitenler[0].yayim_durum, "yok");
  assert.equal(say("soru", "durum IN ('onayli','banka')"), 0); assert.equal(say("fabrika_is", "durum IN ('bekliyor','calisiyor')"), 0);
});
test("durdurma: kilidi süresi dolmuş (çökmüş) iş durmuş pilotun işiyse yeniden alınmaz, iptal edilir", async () => {
  await basla(); DB.db.prepare("UPDATE fabrika_is SET durum = 'calisiyor', kilit_bitis = ?, kilit_kimlik = 'eski'").run(Date.now() - 1000);
  DB.db.prepare("UPDATE fabrika_pilot SET durum = 'durdu'").run();
  let cagri = 0; await kos(async x => { cagri++; return model(TAM)(x); });
  assert.equal(cagri, 0); assert.equal(say("fabrika_is", "durum = 'iptal'"), 1); assert.equal(say("fabrika_is", "durum = 'calisiyor'"), 0);
});
test("durdurma: pilotDurdur yanıt beklenen iş sayısını döndürür; panel metni bu davranışı anlatır", async () => {
  await basla(3); DB.db.prepare("UPDATE fabrika_is SET durum = 'calisiyor', kilit_bitis = ? WHERE id = (SELECT id FROM fabrika_is LIMIT 1)").run(Date.now() + 60000);
  const r = await pilotDurdur(env); assert.equal(r.ok, true); assert.equal(r.iptalIs, 2); assert.equal(r.calisanIs, 1);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /model yanıtı beklenen/); assert.match(html, /yeni denetim başlatılmaz/); assert.match(html, /Denetim bekliyor/);
});
