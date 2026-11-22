// Çevrimdışı inceleme + içeriğe bağlı uzman kararı akışı (22 Kas 2026). Gerçek API çağrısı YOK; D1'e YAZMAZ (yerel SQLite).
// UZMAN kayıtları burada SENTETİK sınama verisidir; gerçek bir uzman onayı değildir ve hiçbir yere aktarılmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { kur } from "./yardim/soru-v2.mjs";
import { PREVIEW10, KAYNAK10, ADAY10_V2 } from "./yardim/cevrimdisi-aday10.mjs";
import { fabrikaSema, yayimKarari, uzmanKarari, notEkle } from "../lib/fabrika.js";
import { cevrimdisiIceAl, cevrimdisiInceleme, cevrimdisiDurum, KAPSAM_ANAHTARLARI } from "../lib/fabrika-cevrimdisi.js";
import { kanonikHash, govdeOf } from "../lib/soru-kanonik.js";

const bayrakli = { AKE_YONETICI: "yonetici@ornek.com", AKE_CEVRIMDISI_YAYIM: "1" };
const BUGUN = new Date().toISOString().slice(0, 10);
const SENTETIK_UZMAN = { uzmanAd: "Sentetik Sınama Uzmanı", brans: "TEST VERİSİ", gerekce: "Bu kayıt yalnız otomatik testtir; gerçek uzman onayı değildir.", tarih: BUGUN, kaydeden: "yonetici@ornek.com" };
const KAPSAM = Object.fromEntries(KAPSAM_ANAHTARLARI.map(k => [k, "yapildi"]));
const INCELEME = { sonuc: "gecti", arac: "denetim/tarama.py + denetim/bagimsiz_v21.py", kapsam: KAPSAM, bulgular: [{ agirlik: "ince_ayar", metin: "Güçlük etiketi kural tabanlı; öğrenci verisiyle ölçülmedi." }], kaydeden: "yonetici@ornek.com" };

async function yeniOrtam(ekEnv = bayrakli) {
  const T = await kur({ ekEnv }); await T.hazirla(); await fabrikaSema(T.env); return T;
}
/* Preview'daki 10 taslağı birebir taklit et: kaynak JSON'dan, canlı olmayan 'taslak' satırları (kurulum verisi; test DB'si) */
async function previewTaklit(T) {
  for (const k of KAYNAK10) {
    const j = JSON.stringify(k);
    T.DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, ?, ?, ?, 'taslak', 1, 1, 'ai', ?, ?, ?, ?, ?, NULL)")
      .run(k.id, k.s, k.t, k.d, j, Math.floor(Math.random() * 1e9), await kanonikHash(k), govdeOf(k), k.a, k.x);
  }
}
const ice = (T, kayit, neden = "Çözüm metni ve güçlük düzeltmesi (v2)") => cevrimdisiIceAl(T.env, { kayit, neden, kaydeden: "yonetici@ornek.com" });
const satir = (T, id) => T.DB.db.prepare("SELECT s.durum, s.h, s.a, s.x, s.d, f.model_durum, f.denetim_tam, f.yayim_durum, f.surum, f.asama FROM soru s JOIN fabrika_soru f ON f.soru_id = s.id WHERE s.id = ?").get(id);
const neden = r => (r.hatalar || []).map(h => h.neden);
const onayli = T => T.DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE durum = 'onayli'").get().n;
const yayim = (T, ids, ek = { cevrimdisiKabul: true }) => yayimKarari(T.env, ids, "yayin", "yonetici@ornek.com", ek);
async function hazirSoru(T, i = 0) { const k = ADAY10_V2[i]; assert.equal((await ice(T, k)).ok, true); assert.equal((await cevrimdisiInceleme(T.env, { soruId: k.id, ...INCELEME })).ok, true); return k.id; }

test("Preview taslakları kaynak JSON ile birebir eşleşir (h, a, d, çözüm/gövde/json uzunluğu)", async () => {
  for (let i = 0; i < 10; i++) { const p = PREVIEW10[i], k = KAYNAK10[i];
    assert.deepEqual({ id: k.id, h: await kanonikHash(k), a: k.a, d: k.d, lx: k.x.length, lg: govdeOf(k).length, lj: JSON.stringify(k).length }, { id: p.id, h: p.h, a: p.a, d: p.d, lx: p.lx, lg: p.lg, lj: p.lj }, p.id); }
});

test("10 aday içe alınır: mevcut taslak yeni SÜRÜM olur (eski/yeni json saklanır), yeniler taslak yazılır; model_durum asla 'gecti' olmaz", async () => {
  const T = await yeniOrtam(); await previewTaklit(T);
  const sonuc = []; for (const k of ADAY10_V2) sonuc.push(await ice(T, k)); assert.ok(sonuc.every(r => r.ok), JSON.stringify(sonuc.filter(r => !r.ok)));
  const sv = T.DB.db.prepare("SELECT soru_id, surum, eski_json, yeni_json FROM fabrika_surum").all();
  assert.deepEqual(sv.map(r => r.soru_id), ["p1v2-mat-06489"]);   // Preview'da olup içeriği DEĞİŞEN tek aday; 04799'un içeriği aynı kaldı
  assert.notEqual(sv[0].eski_json, sv[0].yeni_json); assert.equal(sv[0].surum, 2); assert.equal(JSON.parse(sv[0].eski_json).d, 3); assert.equal(JSON.parse(sv[0].yeni_json).d, 2);
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE id LIKE 'p1v2-%' AND durum = 'taslak'").get().n, 10 + 8);   // 10 Preview taslağı + 8 yeni aday
  for (const k of ADAY10_V2) { const s = satir(T, k.id); assert.equal(s.model_durum, "cevrimdisi_bekliyor"); assert.equal(s.denetim_tam, 0); assert.equal(s.yayim_durum, "yok"); assert.equal(s.durum, "taslak"); }
  assert.equal(onayli(T), 0);
  const tekrar = await ice(T, ADAY10_V2[0]); assert.equal(tekrar.ok, true); assert.equal(tekrar.degisti, false);   // aynı içerik: sürüm artmaz
});

test("çevrimdışı inceleme model denetimi gibi KAYDEDİLMEZ: model_durum 'cevrimdisi_gecti', denetim_tam 0, model_denetimi 'yapilmadi'", async () => {
  const T = await yeniOrtam(); const id = await hazirSoru(T);
  const s = satir(T, id); assert.equal(s.model_durum, "cevrimdisi_gecti"); assert.notEqual(s.model_durum, "gecti"); assert.equal(s.denetim_tam, 0);
  const c = T.DB.db.prepare("SELECT kaynak, model_denetimi, icerik_h, a, x, d FROM fabrika_cevrimdisi WHERE soru_id = ?").get(id);
  assert.equal(c.kaynak, "claude_sohbet_cevrimdisi"); assert.equal(c.model_denetimi, "yapilmadi"); assert.deepEqual([c.icerik_h, c.a, c.x, c.d], [s.h, s.a, s.x, s.d]);
  assert.throws(() => T.DB.db.prepare("UPDATE fabrika_cevrimdisi SET sonuc = 'ret' WHERE soru_id = ?").run(id), /degistirilemez/);
  assert.throws(() => T.DB.db.prepare("DELETE FROM fabrika_cevrimdisi WHERE soru_id = ?").run(id), /degistirilemez/);
  assert.throws(() => T.DB.db.prepare("UPDATE fabrika_cevrimdisi SET model_denetimi = 'yapildi'").run(), /./);
});

test("inceleme doğrulaması: kapsam eksikse ya da engelleyici bulgu varsa 'gecti' kaydedilmez", async () => {
  const T = await yeniOrtam(); const k = ADAY10_V2[0]; await ice(T, k);
  let r = await cevrimdisiInceleme(T.env, { soruId: k.id, ...INCELEME, kapsam: { ...KAPSAM, benzerlik: "yapilmadi" } }); assert.equal(r.ok, false); assert.match(r.neden, /gecti_icin_kapsam_tam_degil:benzerlik/);
  r = await cevrimdisiInceleme(T.env, { soruId: k.id, ...INCELEME, kapsam: { ...KAPSAM, dil: undefined } }); assert.equal(r.ok, false);
  r = await cevrimdisiInceleme(T.env, { soruId: k.id, ...INCELEME, bulgular: [{ agirlik: "engelleyici", metin: "x" }] }); assert.equal(r.ok, false); assert.match(r.neden, /engelleyici/);
  r = await cevrimdisiInceleme(T.env, { soruId: k.id, ...INCELEME, sonuc: "model_gecti" }); assert.equal(r.ok, false);
  r = await cevrimdisiInceleme(T.env, { soruId: k.id, ...INCELEME, kaydeden: "" }); assert.equal(r.ok, false);
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM fabrika_cevrimdisi").get().n, 0);
  r = await cevrimdisiInceleme(T.env, { soruId: k.id, ...INCELEME, sonuc: "revizyon", kapsam: { ...KAPSAM, benzerlik: "yapilmadi" }, bulgular: [{ agirlik: "engelleyici", metin: "Şık nedeni belirsiz" }] }); assert.equal(r.ok, true); assert.equal(satir(T, k.id).model_durum, "cevrimdisi_revizyon");
});

test("YAYIM KAPALI: bayrak yokken, istek bayrağı yokken ve uzman kararı yokken hiçbir soru yayımlanmaz", async () => {
  const kapali = await yeniOrtam({ AKE_YONETICI: "yonetici@ornek.com" }); const id0 = await hazirSoru(kapali);
  await uzmanKarari(kapali.env, { soruId: id0, karar: "kabul", ...SENTETIK_UZMAN });
  let r = await yayim(kapali, [id0]); assert.equal(r.ok, false); assert.ok(neden(r).includes("denetim_tamamlanmadi"), neden(r).join()); assert.equal(onayli(kapali), 0);   // sunucu bayrağı kapalı: yol yok
  const T = await yeniOrtam(); const id = await hazirSoru(T);
  r = await yayim(T, [id]); assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_karari_yok")); assert.ok(neden(r).includes("uzman_kabulu_bu_icerige_bagli_degil")); assert.equal(onayli(T), 0);
  await uzmanKarari(T.env, { soruId: id, karar: "kabul", ...SENTETIK_UZMAN });
  r = await yayim(T, [id], {}); assert.equal(r.ok, false); assert.ok(neden(r).includes("denetim_tamamlanmadi")); assert.equal(onayli(T), 0);   // istek cevrimdisiKabul göndermedi
  r = await yayim(T, [id], { cevrimdisiKabul: "true" }); assert.equal(r.ok, false); assert.equal(onayli(T), 0);   // yalnız boolean true
});

test("tam yol (SENTETİK uzman, test DB'si): çevrimdışı inceleme + içeriğe bağlı uzman kabulü + yönetici kararı → yayım; üç kayıt ayrı", async () => {
  const T = await yeniOrtam(); const id = await hazirSoru(T);
  assert.equal((await uzmanKarari(T.env, { soruId: id, karar: "kabul", ...SENTETIK_UZMAN })).ok, true);
  const r = await yayim(T, [id]); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(onayli(T), 1);
  const s = satir(T, id); assert.equal(s.durum, "onayli"); assert.equal(s.yayim_durum, "onayli"); assert.equal(s.model_durum, "cevrimdisi_gecti"); assert.equal(s.denetim_tam, 0);   // model denetimi yapılmış GÖRÜNMEZ
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM fabrika_uzman").get().n, 1);
});

test("içerik değişirse (sürüm ya da doğrudan oynama) çevrimdışı inceleme ve uzman kabulü GEÇERSİZ kalır", async () => {
  const T = await yeniOrtam(); const id = await hazirSoru(T); await uzmanKarari(T.env, { soruId: id, karar: "kabul", ...SENTETIK_UZMAN });
  /* 1) yalnız çözüm metni değişir: h aynı kalır → eski tetikleyici geçerdi; yeni bağlama geçmez */
  T.DB.db.prepare("UPDATE soru SET x = x || ' (değiştirildi)' WHERE id = ?").run(id);
  let r = await yayim(T, [id]); assert.equal(r.ok, false); assert.ok(neden(r).includes("cevrimdisi_inceleme_eski_icerik")); assert.ok(neden(r).includes("uzman_kabulu_bu_icerige_bagli_degil")); assert.equal(onayli(T), 0);
  /* 2) doğrudan SQL'de araya girip hatayı atlatmak: SQL geçidi de reddeder (ön denetim atlansa bile) */
  const { soruOnayla } = await import("../lib/soru-yaz.js"); const { GECIT_CEVRIMDISI_SQL } = await import("../lib/fabrika-cevrimdisi-cekirdek.js");
  const o = await soruOnayla(T.env, [id], { onceki: "taslak", ek: GECIT_CEVRIMDISI_SQL }); assert.equal(o.ok, false); assert.equal(onayli(T), 0);
  /* 3) yalnız güçlük etiketi değişir */
  T.DB.db.prepare("UPDATE soru SET x = ? WHERE id = ?").run(ADAY10_V2[0].x, id); T.DB.db.prepare("UPDATE soru SET d = 3 WHERE id = ?").run(id);
  r = await yayim(T, [id]); assert.equal(r.ok, false); assert.equal(onayli(T), 0);
  /* 4) yeni sürüm içe alma: içerik değişince eski kayıtlar bağlanmaz, yeniden inceleme + yeni uzman kararı gerekir */
  T.DB.db.prepare("UPDATE soru SET d = ? WHERE id = ?").run(ADAY10_V2[0].d, id);
  const yeni = { ...ADAY10_V2[0], d: ADAY10_V2[0].d === 1 ? 2 : 1 }; assert.equal((await ice(T, yeni, "Güçlük etiketi yeniden belirlendi")).ok, true);
  r = await yayim(T, [id]); assert.equal(r.ok, false); assert.ok(neden(r).includes("denetim_tamamlanmadi"), neden(r).join()); assert.equal(onayli(T), 0);   // model_durum cevrimdisi_bekliyor: çevrimdışı yol hiç açılmaz
  assert.equal(satir(T, id).model_durum, "cevrimdisi_bekliyor");   // inceleme sıfırlandı
});

test("son inceleme 'revizyon' ise eski 'gecti' kaydı yetmez; 'uzman_bekliyor' notu ve uzman 'red' kesin engeldir; karışık yol reddedilir", async () => {
  const T = await yeniOrtam(); const id = await hazirSoru(T); await uzmanKarari(T.env, { soruId: id, karar: "kabul", ...SENTETIK_UZMAN });
  await cevrimdisiInceleme(T.env, { soruId: id, ...INCELEME, sonuc: "revizyon", bulgular: [{ agirlik: "engelleyici", metin: "Yeni bulgu" }] });
  let r = await yayim(T, [id]); assert.equal(r.ok, false); assert.equal(onayli(T), 0);   // model_durum artık cevrimdisi_revizyon
  await cevrimdisiInceleme(T.env, { soruId: id, ...INCELEME });   // yeniden 'gecti'
  await notEkle(T.env, { soruId: id, tur: "uzman_bekliyor", mesaj: "E şıkkı?", kim: "y" });
  r = await yayim(T, [id]); assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_bekliyor")); assert.equal(onayli(T), 0);
  const T2 = await yeniOrtam(); const a = await hazirSoru(T2, 1), b = await hazirSoru(T2, 2);
  await uzmanKarari(T2.env, { soruId: a, karar: "kabul", ...SENTETIK_UZMAN }); await uzmanKarari(T2.env, { soruId: b, karar: "red", ...SENTETIK_UZMAN, gerekce: "Sentetik red: test için yeterince uzun gerekçe." });
  r = await yayim(T2, [a, b]); assert.equal(r.ok, false); assert.ok(neden(r).includes("uzman_reddetti")); assert.equal(onayli(T2), 0);   // biri red: hiçbiri yayımlanmaz
  T2.DB.db.prepare("UPDATE fabrika_soru SET model_durum = 'gecti', denetim_tam = 1 WHERE soru_id = ?").run(b);   // karışık: bir soru model yolunda gibi
  r = await yayim(T2, [a, b]); assert.equal(r.ok, false); assert.equal(onayli(T2), 0);
});

test("mevcut korumalar delinmez: doğrudan SQL ile 'onayli' yazmak uzman kabulü olmadan tetikleyicide, sahte 'gecti' yayımda başarısız olur", async () => {
  const T = await yeniOrtam(); const id = await hazirSoru(T);
  assert.throws(() => T.DB.db.prepare("UPDATE soru SET durum = 'onayli' WHERE id = ?").run(id), /uzman_kabulu_yok/); assert.equal(onayli(T), 0);
  const { soruYazKanonik } = await import("../lib/soru-yaz.js");
  await assert.rejects(() => soruYazKanonik(T.env, { s: "mat", t: "Sayılar", d: 2, q: "x", o: ["1", "2", "3", "4", "5"], a: 0, x: "y" }, { durum: "onayli" }), /canli_durum_yasak/);
});
test("çevrimdışı durum raporu: eksik insan kararları listelenir (uzman yok → eksik)", async () => {
  const T = await yeniOrtam(); const id = await hazirSoru(T); const d = (await cevrimdisiDurum(T.env)).find(x => x.id === id);
  assert.deepEqual(d.eksikler, ["uzman_kabulu_bu_icerige_bagli_degil"]); assert.equal(d.model_durum, "cevrimdisi_gecti");
});

test("SQL geçidi tek başına da son kaydı arar: eski 'gecti' kaydı, sonradan 'revizyon' gelmişse (durum alanı elle 'cevrimdisi_gecti' bırakılsa bile) yayımı geçirmez", async () => {
  const T = await yeniOrtam(); const id = await hazirSoru(T); await uzmanKarari(T.env, { soruId: id, karar: "kabul", ...SENTETIK_UZMAN });
  await cevrimdisiInceleme(T.env, { soruId: id, ...INCELEME, sonuc: "revizyon", bulgular: [{ agirlik: "engelleyici", metin: "Sonradan bulundu" }] });
  T.DB.db.prepare("UPDATE fabrika_soru SET model_durum = 'cevrimdisi_gecti' WHERE soru_id = ?").run(id);   // durum alanını bilerek tutarsız bırak
  const { soruOnayla } = await import("../lib/soru-yaz.js"); const { GECIT_CEVRIMDISI_SQL } = await import("../lib/fabrika-cevrimdisi-cekirdek.js");
  const o = await soruOnayla(T.env, [id], { onceki: "taslak", ek: GECIT_CEVRIMDISI_SQL }); assert.equal(o.ok, false); assert.equal(onayli(T), 0);
  const r = await yayim(T, [id]); assert.equal(r.ok, false); assert.ok(neden(r).includes("cevrimdisi_inceleme_revizyon"), neden(r).join()); assert.equal(onayli(T), 0);
});
