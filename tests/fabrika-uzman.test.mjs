// Fabrika robotu · yayımı branş uzmanının kaydedilmiş kararına bağlama (20 Kas 2026).
// Üç AYRI kayıt: model denetimi (fabrika_soru.model_durum), branş uzmanı kararı (fabrika_uzman), yönetici yayımı (fabrika_soru.yayim_durum).
// Pilot sorusunda geçerli uzman kabulü yoksa yayım veritabanı düzeyinde (SQL geçidi + tetikleyici) başarısız olur.
// Gerçek API çağrısı YOK. PILOT10 = Preview D1'deki gerçek soruların kopyası (fixture); bu testler D1'e yazmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kur, yonetimIstek } from "./yardim/soru-v2.mjs";
import { PILOT10 } from "./yardim/pilot10.mjs";
import { fabrikaSema, uzmanSema, yayimKarari, notEkle, notKapat, uzmanKarari, fabrikaDurum, adaylar } from "../lib/fabrika.js";
import { soruYazKanonik } from "../lib/soru-yaz.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com", AKE_FABRIKA_GUNLUK_CAGRI: "500" } });
const { DB, env } = T; await T.hazirla(); const yon = await T.giris("yonetici@ornek.com");
/* fabrika_uzman değiştirilemez/silinemez; testler arası temizlik için YALNIZ bu test dosyasında tetikleyiciler kaldırılıp lib'in kendi şema fonksiyonuyla yeniden kurulur. */
const sifirla = async () => { await fabrikaSema(env); DB.db.exec("DROP TRIGGER fabrika_uzman_degistirme; DROP TRIGGER fabrika_uzman_silme;");
  for (const t of ["soru", "fabrika_soru", "fabrika_cagri", "fabrika_is", "fabrika_pilot", "fabrika_not", "fabrika_uzman"]) { try { DB.db.exec("DELETE FROM " + t); } catch (e) { } } await uzmanSema(env.DB); };
const say = (t, w = "1=1") => DB.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${w}`).get().n;
const BUGUN = new Date().toISOString().slice(0, 10);
const UZMAN = { uzmanAd: "Ayşe Yılmaz", brans: "Matematik öğretmeni", gerekce: "Çözümü ve şıkları tek tek kontrol ettim; tek doğru cevap D.", tarih: BUGUN, kaydeden: "yonetici@ornek.com" };
/* pilot sorusu: model 'gecti', denetim tam, uyarısız sentetik-benzeri matematik sorusu */
let sayac = 0;
async function pilotSoru({ md = "gecti", pilot = "pilot-x", k = PILOT10[0] } = {}) {
  const id = "ok-uz-" + (++sayac);
  await fabrikaSema(env);
  const y = await soruYazKanonik(env, { s: k.s, t: k.t, d: 2, q: k.q + " (" + sayac + ")", o: k.o, a: k.a, x: k.x }, { idUret: () => id });
  DB.db.prepare("INSERT INTO fabrika_soru (soru_id, pilot_id, surum, asama, model_durum, denetim_tam, tekrar, sayisal, denetim_json, olusturma, guncelleme) VALUES (?, ?, 1, 'inceleme', ?, 1, 0, 'yapilmadi', '{}', 1, 1)").run(y.id, pilot, md);
  return y.id;
}
const yayim = (id, ek) => yayimKarari(env, [id], "yayin", "yonetici@ornek.com", ek);
const neden = r => (r.hatalar || []).map(h => h.neden);
const durumlar = id => ({ soru: DB.db.prepare("SELECT durum FROM soru WHERE id = ?").get(id).durum, yayim: DB.db.prepare("SELECT yayim_durum FROM fabrika_soru WHERE soru_id = ?").get(id).yayim_durum });
const yayimlanmadi = id => assert.deepEqual(durumlar(id), { soru: "taslak", yayim: "yok" });

/* ---------- koşul: uzman kararı ---------- */
test("modelden geçmiş ama uzman kararı OLMAYAN pilot sorusu yayımlanamaz", async () => {
  await sifirla(); const id = await pilotSoru(); const r = await yayim(id);
  assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_karari_yok"), neden(r).join()); yayimlanmadi(id); assert.equal(say("soru", "durum = 'onayli'"), 0);
});
test("uyariKabul:true uzman kabulünün yerine GEÇMEZ", async () => {
  await sifirla(); const id = await pilotSoru(); const r = await yayim(id, { uyariKabul: true });
  assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_karari_yok")); yayimlanmadi(id);
});
test("açık uzman_bekliyor notunu KAPATMAK uzman kabulü sayılmaz; açıkken de uzman kabulü olsa bile yayım olmaz", async () => {
  await sifirla(); const id = await pilotSoru();
  const n = await notEkle(env, { soruId: id, tur: "uzman_bekliyor", mesaj: "E şıkkı savunulabilir mi?", kim: "yonetici@ornek.com" }); assert.equal(n.ok, true);
  assert.equal((await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN })).ok, true);
  let r = await yayim(id, { uyariKabul: true }); assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_bekliyor")); yayimlanmadi(id);   // açık not + kabul kaydı: hâlâ engel
  await sifirla(); const id2 = await pilotSoru(); const n2 = await notEkle(env, { soruId: id2, tur: "uzman_bekliyor", mesaj: "?", kim: "y" });
  assert.equal((await notKapat(env, { notId: n2.id, kim: "yonetici@ornek.com", gerekce: "Kapattım" })).ok, true);   // yalnız notu kapattık
  r = await yayim(id2, { uyariKabul: true }); assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_karari_yok")); assert.ok(!neden(r).includes("uzman_bekliyor")); yayimlanmadi(id2);
});
test("uzman tarafından REDDEDİLMİŞ soru yayımlanamaz; red kesindir (sonradan başka 'kabul' kaydı reddedilir)", async () => {
  await sifirla(); const id = await pilotSoru();
  assert.equal((await uzmanKarari(env, { soruId: id, karar: "red", ...UZMAN, gerekce: "E şıkkı da doğru sayılabiliyor; çoklu doğru." })).ok, true);
  const r = await yayim(id, { uyariKabul: true }); assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_reddetti")); yayimlanmadi(id);
  const k = await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN, uzmanAd: "Başka Uzman" }); assert.equal(k.ok, false); assert.equal(k.neden, "uzman_reddetmis");
  assert.equal(say("fabrika_uzman", "karar = 'kabul'"), 0); yayimlanmadi(id);
});
test("kayıtlı, geçerli uzman kabulü olan + modelden geçmiş + uyarısız soru YAYIMLANIR; üç kayıt ayrı tutulur", async () => {
  await sifirla(); const id = await pilotSoru(); const u = await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN }); assert.equal(u.ok, true);
  const r = await yayim(id); assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(durumlar(id), { soru: "onayli", yayim: "onayli" });
  const f = DB.db.prepare("SELECT model_durum, yayim_kim FROM fabrika_soru WHERE soru_id = ?").get(id), e = DB.db.prepare("SELECT * FROM fabrika_uzman WHERE soru_id = ?").get(id);
  assert.equal(f.model_durum, "gecti"); assert.equal(f.yayim_kim, "yonetici@ornek.com");   // model + yönetici: fabrika_soru
  assert.equal(e.uzman_ad, "Ayşe Yılmaz"); assert.equal(e.brans, "Matematik öğretmeni"); assert.equal(e.kaydeden, "yonetici@ornek.com"); assert.ok(e.gerekce.length > 15 && e.tarih > 0 && e.kayit > 0 && e.icerik_h);   // uzman: ayrı tablo
});
test("uzman kabulü olsa bile modelden GEÇMEMİŞ soru (örn. #6 revizyon) yayımlanamaz", async () => {
  await sifirla(); const id = await pilotSoru({ md: "revizyon" }); await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN });
  const r = await yayim(id, { uyariKabul: true }); assert.equal(r.ok, false); assert.ok(neden(r).some(x => x.startsWith("model_gecmedi"))); yayimlanmadi(id);
});
test("uzman kabulü sert uyarıları (biçim/pasaj hatası) kaldırmaz", async () => {
  await sifirla(); const id = await pilotSoru({ k: PILOT10[9] }); await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN });   // #10: işaretsiz "altı çizili"
  const r = await yayim(id, { uyariKabul: true }); assert.equal(r.ok, false); assert.ok(neden(r).includes("inceleme_uyarisi:isaret_eksik")); yayimlanmadi(id);
});
test("içeriğe bağlı: kabul kaydından sonra soru içeriği (h) değişirse kabul geçersizdir", async () => {
  await sifirla(); const id = await pilotSoru(); await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN });
  DB.db.prepare("UPDATE soru SET h = 'degisti' WHERE id = ?").run(id);
  const r = await yayim(id); assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_karari_yok")); yayimlanmadi(id);
});

/* ---------- veritabanı düzeyi ---------- */
test("DB düzeyi: yönetici kodu atlanıp doğrudan SQL ile 'onayli' yapılsa bile uzman kabulü olmayan pilot sorusu REDDEDİLİR", async () => {
  await sifirla(); const id = await pilotSoru();
  assert.throws(() => DB.db.prepare("UPDATE soru SET durum = 'onayli' WHERE id = ?").run(id), /uzman_kabulu_yok/); yayimlanmadi(id);
  await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN });
  assert.doesNotThrow(() => DB.db.prepare("UPDATE soru SET durum = 'onayli' WHERE id = ?").run(id));   // kayıtlı kabul varsa tetikleyici izin verir
});
test("DB düzeyi: red kaydı varken (kabul de olsa) tetikleyici engeller; pilot dışı satırlar etkilenmez", async () => {
  await sifirla(); const id = await pilotSoru(); await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN });
  DB.db.prepare("INSERT INTO fabrika_uzman (id, soru_id, surum, icerik_h, karar, uzman_ad, brans, gerekce, tarih, kayit, kaydeden) SELECT 'uz-red', soru_id, surum, icerik_h, 'red', 'Ali Veli', 'Matematik', 'Hatalı soru, çoklu doğru var.', ?, ?, 'y' FROM fabrika_uzman WHERE soru_id = ?").run(Date.now(), Date.now(), id);
  assert.throws(() => DB.db.prepare("UPDATE soru SET durum = 'onayli' WHERE id = ?").run(id), /uzman_kabulu_yok/);
  const diger = await pilotSoru({ pilot: null }); assert.doesNotThrow(() => DB.db.prepare("UPDATE soru SET durum = 'onayli' WHERE id = ?").run(diger));   // pilot_id boş (yönetim soru-uret) satırı kapsam dışı
  DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES ('canli-1', 'mat', 'x', 2, '{}', 'bekliyor', 1, 1)").run(); assert.doesNotThrow(() => DB.db.prepare("UPDATE soru SET durum = 'onayli' WHERE id = 'canli-1'").run());   // fabrika dışı canlı banka akışı etkilenmez
});
test("DB düzeyi: kimliksiz/gerekçesiz/tarihsiz kayıt yazılamaz; kayıtlar değiştirilemez ve silinemez", async () => {
  await sifirla(); const id = await pilotSoru(), ekle = (o = {}) => { const v = { karar: "kabul", ad: "Ayşe Y", brans: "Mat", g: "Yeterince uzun gerekçe metni", tarih: Date.now(), ...o }; return DB.db.prepare("INSERT INTO fabrika_uzman (id, soru_id, surum, icerik_h, karar, uzman_ad, brans, gerekce, tarih, kayit, kaydeden) VALUES (?, ?, 1, 'h', ?, ?, ?, ?, ?, 1, 'y')").run("uz-" + Math.random(), id, v.karar, v.ad, v.brans, v.g, v.tarih); };
  for (const o of [{ ad: "" }, { ad: "  " }, { brans: "" }, { g: "" }, { g: "   " }, { tarih: 0 }, { karar: "belki" }]) assert.throws(() => ekle(o), /constraint|CHECK/i, JSON.stringify(o));
  ekle(); assert.equal(say("fabrika_uzman"), 1);
  assert.throws(() => DB.db.exec("UPDATE fabrika_uzman SET gerekce = 'x'"), /degistirilemez/); assert.throws(() => DB.db.exec("DELETE FROM fabrika_uzman"), /degistirilemez/); assert.equal(say("fabrika_uzman"), 1);
});

/* ---------- atomiklik ---------- */
test("atomik: yayım batch'inden hemen önce araya uzman REDDİ girerse hiçbir soru yayımlanmaz", async () => {
  await sifirla(); const a = await pilotSoru(), b = await pilotSoru(); for (const i of [a, b]) await uzmanKarari(env, { soruId: i, karar: "kabul", ...UZMAN });
  DB.hook.hedef = /UPDATE soru SET durum = 'onayli'/;
  let tetik = 0; DB.hook.once = () => { tetik++; DB.db.prepare("INSERT INTO fabrika_uzman (id, soru_id, surum, icerik_h, karar, uzman_ad, brans, gerekce, tarih, kayit, kaydeden) SELECT 'uz-yaris', soru_id, surum, icerik_h, 'red', 'Ali Veli', 'Matematik', 'Son anda çoklu doğru fark edildi.', ?, ?, 'y' FROM fabrika_uzman WHERE soru_id = ? LIMIT 1").run(Date.now(), Date.now(), b); };
  const r = await yayimKarari(env, [a, b], "yayin", "yonetici@ornek.com", { uyariKabul: true }); DB.hook.hedef = null;
  assert.equal(tetik, 1, "ön kontrol geçip batch'e ulaşılmalı (kanca çalışmalı)"); assert.equal(r.ok, false); yayimlanmadi(a); yayimlanmadi(b); assert.equal(say("soru", "durum = 'onayli'"), 0);   // a da yayımlanmadı: işlem bütün
});
test("atomik: batch'ten önce araya AÇIK uzman notu girerse hiçbir soru yayımlanmaz", async () => {
  await sifirla(); const a = await pilotSoru(); await uzmanKarari(env, { soruId: a, karar: "kabul", ...UZMAN });
  DB.hook.hedef = /UPDATE soru SET durum = 'onayli'/;
  let tetik = 0; DB.hook.once = () => { tetik++; DB.db.prepare("INSERT INTO fabrika_not (id, soru_id, tur, mesaj, durum, olusturan, olusturma) VALUES ('not-yaris', ?, 'uzman_bekliyor', 'Son anda şüphe', 'acik', 'y', 1)").run(a); };
  const r = await yayimKarari(env, [a], "yayin", "yonetici@ornek.com"); DB.hook.hedef = null;
  assert.equal(tetik, 1); assert.equal(r.ok, false); yayimlanmadi(a);
});
test("atomik: batch'ten önce model kararı değişirse yayım olmaz (mevcut davranış korunur)", async () => {
  await sifirla(); const a = await pilotSoru(); await uzmanKarari(env, { soruId: a, karar: "kabul", ...UZMAN });
  DB.hook.hedef = /UPDATE soru SET durum = 'onayli'/; let tetik = 0; DB.hook.once = () => { tetik++; DB.db.prepare("UPDATE fabrika_soru SET model_durum = 'revizyon' WHERE soru_id = ?").run(a); };
  const r = await yayimKarari(env, [a], "yayin", "yonetici@ornek.com"); DB.hook.hedef = null; assert.equal(tetik, 1); assert.equal(r.ok, false); yayimlanmadi(a);
});

/* ---------- uzman kararı kaydı ---------- */
test("uzmanKarari doğrulama: eksik kimlik/branş/kısa gerekçe, geçersiz/gelecek tarih, olmayan ve zaten yayımlanmış soru reddedilir; kayıt başka tabloları değiştirmez", async () => {
  await sifirla(); const id = await pilotSoru(), once = JSON.stringify([DB.db.prepare("SELECT * FROM soru").all(), DB.db.prepare("SELECT * FROM fabrika_soru").all()]);
  const dene = async (o, beklenen) => { const r = await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN, ...o }); assert.equal(r.ok, false, JSON.stringify(o)); assert.equal(r.neden, beklenen, JSON.stringify(o)); };
  await dene({ uzmanAd: "  " }, "uzman_ad_eksik"); await dene({ uzmanAd: "A" }, "uzman_ad_eksik"); await dene({ brans: "" }, "brans_eksik"); await dene({ gerekce: "tamam" }, "gerekce_kisa");
  await dene({ tarih: "dün" }, "tarih_gecersiz"); await dene({ tarih: "2099-01-01" }, "tarih_gecersiz"); await dene({ karar: "belki" }, "karar_gecersiz"); await dene({ kaydeden: "" }, "kaydeden_eksik");
  assert.equal((await uzmanKarari(env, { soruId: "yok", karar: "kabul", ...UZMAN })).neden, "kayit_yok");
  assert.equal(say("fabrika_uzman"), 0); assert.equal(JSON.stringify([DB.db.prepare("SELECT * FROM soru").all(), DB.db.prepare("SELECT * FROM fabrika_soru").all()]), once);
  await uzmanKarari(env, { soruId: id, karar: "kabul", ...UZMAN }); assert.equal(JSON.stringify([DB.db.prepare("SELECT * FROM soru").all(), DB.db.prepare("SELECT * FROM fabrika_soru").all()]), once);   // kabul kaydı soru/model/yayım kayıtlarını DEĞİŞTİRMEZ
  await yayim(id); assert.equal((await uzmanKarari(env, { soruId: id, karar: "red", ...UZMAN })).neden, "karar_verilmis");   // yayımlanmış soruya sonradan karar yazılmaz
});

/* ---------- sayaçlar ---------- */
test("sayaçlar ayrı: model geçti / uzman kabul / uzman red / yönetici yayımladı; 'insan_onayli' alanı artık YOK", async () => {
  await sifirla(); const a = await pilotSoru(), b = await pilotSoru(), c = await pilotSoru(), d = await pilotSoru({ md: "revizyon" });
  await uzmanKarari(env, { soruId: a, karar: "kabul", ...UZMAN }); await uzmanKarari(env, { soruId: b, karar: "kabul", ...UZMAN }); await uzmanKarari(env, { soruId: c, karar: "red", ...UZMAN, gerekce: "Çoklu doğru riski var, kabul etmiyorum." });
  let s = (await fabrikaDurum(env)).sayilar; assert.equal(s.model_gecti, 3); assert.equal(s.uzman_kabul, 2); assert.equal(s.uzman_red, 1); assert.equal(s.yonetici_yayimladi, 0); assert.ok(!("insan_onayli" in s));
  assert.equal((await yayim(a, { uyariKabul: true })).ok, true); s = (await fabrikaDurum(env)).sayilar;   // benzer şablonlu sentetik sorular: yumuşak uyarı için yönetici kabulü
  assert.equal(s.yonetici_yayimladi, 1); assert.equal(s.uzman_kabul, 2); assert.equal(s.yayinda, 1); void d;
});
test("eski kayıtlar geriye dönük uzman onaylı SAYILMAZ: uzman kaydı olmadan yayımlanmış satır yalnız 'yönetici yayımladı' sayılır", async () => {
  await sifirla(); const id = await pilotSoru({ pilot: null });   // eski yol: uzman kaydı yok
  DB.db.prepare("UPDATE soru SET durum = 'onayli' WHERE id = ?").run(id); DB.db.prepare("UPDATE fabrika_soru SET yayim_durum = 'onayli', asama = 'yayinda' WHERE soru_id = ?").run(id);
  const s = (await fabrikaDurum(env)).sayilar; assert.equal(s.yonetici_yayimladi, 1); assert.equal(s.uzman_kabul, 0); assert.equal(say("fabrika_uzman"), 0);
});
test("adaylar(): her adayda model, uzman ve yayım ayrı alanlarda; uzman 'yok'/'kabul'/'red'", async () => {
  await sifirla(); const a = await pilotSoru(), b = await pilotSoru(), c = await pilotSoru(); await uzmanKarari(env, { soruId: b, karar: "kabul", ...UZMAN }); await uzmanKarari(env, { soruId: c, karar: "red", ...UZMAN, gerekce: "Kabul etmiyorum: çoklu doğru." });
  const l = await adaylar(env), g = id => l.find(x => x.id === id);
  assert.equal(g(a).uzman.durum, "yok"); assert.equal(g(b).uzman.durum, "kabul"); assert.equal(g(b).uzman.uzman_ad, "Ayşe Yılmaz"); assert.equal(g(c).uzman.durum, "red"); assert.equal(g(a).model_durum, "gecti");
});

/* ---------- uç nokta ve panel ---------- */
test("uç nokta: fabrika-uzman kaydı yönetici oturumuyla yapılır; kaydeden = yönetici e-postası; uyariKabul'lu fabrika-karar uzman kabulü olmadan 409", async () => {
  await sifirla(); const id = await pilotSoru(); const I = (yol, m = "POST", govde) => yonetimIstek(T, yol, { m, cookie: yon.cookie, govde });
  assert.equal((await I("fabrika-karar", "POST", { id: [id], karar: "yayin", uyariKabul: true })).s, 409); yayimlanmadi(id);
  assert.equal((await I("fabrika-uzman", "POST", { soru_id: id, karar: "kabul", uzman_ad: "Ayşe Yılmaz", brans: "Matematik", gerekce: "Çözümü kontrol ettim, doğru.", tarih: BUGUN })).s, 200);
  assert.equal(DB.db.prepare("SELECT kaydeden FROM fabrika_uzman").get().kaydeden, "yonetici@ornek.com");
  assert.equal((await I("fabrika-uzman", "POST", { soru_id: id, karar: "kabul", uzman_ad: "", brans: "Matematik", gerekce: "Çözümü kontrol ettim, doğru.", tarih: BUGUN })).s, 400);
  assert.equal((await I("fabrika-karar", "POST", { id: [id], karar: "yayin" })).s, 200); assert.deepEqual(durumlar(id), { soru: "onayli", yayim: "onayli" });
});
test("panel: 'Modelden geçti', 'Uzman kabul etti', 'Yayımlandı' ayrı ifadeler; uzman kararı formu; insan_onayli kullanılmaz", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"), bas = html.indexOf("const FAB_MODEL"), son = html.indexOf("/* ===== Sosyal"), ui = html.slice(bas, son);
  for (const m of [/Modelden geçti/, /Uzman kabul etti/, /Uzman reddetti/, /Uzman kararı bekleniyor/, /Yayımlandı/, /yönetici yayımladı/i, /fabUzman/, /fabrika-uzman/]) assert.match(ui, m, String(m));
  assert.ok(!/insan_onayli/.test(ui)); assert.ok(!/Model kontrolünden geçti/.test(ui), "eski, yayım onayı gibi okunan etiket kalmamalı");
});
