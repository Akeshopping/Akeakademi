// Fabrika robotu · pilot inceleme düzeltmeleri (20 Kas 2026): pasaj (p) alanı, işaretsiz "altı çizili", benzerlik uyarısı,
// yapılandırılmış denetim geçidi, uzman bekleyen notlar, şık konumu. Gerçek API çağrısı YOK; model sahte işlevdir.
// PILOT10 = Preview D1'deki gerçek 10 pilot sorusunun kopyası (regresyon fixture'ı); bu testler D1'e yazmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kur } from "./yardim/soru-v2.mjs";
import { PILOT10 } from "./yardim/pilot10.mjs";
import {
  fabrikaSema, robotAyarla, pilotBaslat, isIsle, adaylar, yayimKarari, uretimIstemi, denetimIstemi,
  pasajDegerlendir, bicimSorunlari, benzerlikUyarilari, siklariKaristir, notEkle, notKapat, taslagiKuyrugaAl, fabrikaDurum
} from "../lib/fabrika.js";
import { soruYazKanonik } from "../lib/soru-yaz.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com", AKE_FABRIKA_GUNLUK_CAGRI: "500" } });
const { DB, env } = T; await T.hazirla();
const sifirla = () => { for (const t of ["soru", "fabrika_soru", "fabrika_cagri", "fabrika_is", "fabrika_pilot", "fabrika_not"]) { try { DB.db.exec("DELETE FROM " + t); } catch (e) { } } };
const say = (t, w = "1=1") => DB.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${w}`).get().n;
const basla = async (ders, konu, hedef = 1) => { sifirla(); await fabrikaSema(env); await robotAyarla(env, true); await pilotBaslat(env, { hedef, ders, konu }); };
const ileri = () => { let t = Date.now() + 10 * 86400000; return () => (t += 3600000); };
const kos = async (fn, ek = {}) => { let n, top = 0; const simdi = ileri(); do { n = (await isIsle(env, { claudeFn: fn, azami: 20, simdi, ...ek })).islenen; top += n; } while (n > 0 && top < 100); return top; };
const TAM = a => ({ cevap: a, tek_dogru: true, belirsiz: false, sorunlar: [] });
/* üretim: verilen soru nesnesi; denetim: verilen işlev (anahtar, prompt) → nesne. cagrilar: gelen istemler */
const model = (uretim, denetim = a => TAM(a)) => { const f = { cagrilar: [] }; f.fn = async ({ tur, prompt }) => { f.cagrilar.push({ tur, prompt });
  if (tur === "uretim") return { metin: JSON.stringify([uretim]), giris: 100, cikis: 50 };
 return { metin: JSON.stringify(denetim(f.anahtar ?? uretim.a, prompt)), giris: 80, cikis: 20 }; }; return f; };
const s1 = { q: "Bir sayının 3 katının 4 fazlası 19 ise bu sayı kaçtır?", o: ["3", "4", "5", "6", "7"], a: 2, x: "3n + 4 = 19 olduğundan n = 5 olur." };
const KOK = new URL("../", import.meta.url);

/* ---------- 1) p (pasaj) alanı ---------- */
test("pasajDegerlendir: konu etiketi / kısa metin pasaj DEĞİLDİR → boş; gerçek paragraf korunur", () => {
  for (const p of ["Matematik - Problemler", "Sözcükte anlam", "Pasaj yok", "Türkçe", " "]) assert.equal(pasajDegerlendir({ p, q: "Soru?", ders: "mat", konu: "Problemler" }).p, "", p);
  const gercek = "Kitap okumak, insanın kendi dünyasının sınırlarını aşmasını sağlar. Okuyan kişi, başkalarının deneyimlerinden ders çıkarır ve bakış açısını genişletir.";
  assert.equal(pasajDegerlendir({ p: gercek, q: "Parçaya göre yazar neyi savunmaktadır?", ders: "turkce", konu: "Paragraf" }).p, gercek);
  assert.equal(pasajDegerlendir({ p: undefined, q: "Soru?", ders: "mat", konu: "Sayılar" }).p, "");
});
test("pasajDegerlendir: kök pasaja atıf yapıyor ama gerçek pasaj yoksa HATA (eksik veri)", () => {
  const r = pasajDegerlendir({ p: "Türkçe - Paragraf", q: "Parçaya göre aşağıdakilerden hangisi söylenemez?", ders: "turkce", konu: "Paragraf" });
  assert.equal(r.hata, "pasaj_eksik");
  assert.equal(pasajDegerlendir({ q: "Yukarıdaki tabloya göre kaç öğrenci vardır?", ders: "mat", konu: "Veri" }).hata, "pasaj_eksik");
  assert.equal(pasajDegerlendir({ q: "Aşağıdaki cümlelerin hangisinde ağır sözcüğü gerçek anlamdadır?", ders: "turkce", konu: "Sözcükte anlam" }).hata, undefined);   // "aşağıdaki cümlelerin" pasaj atfı değil
});
test("hat: modelin yazdığı 'Matematik - Problemler' etiketi öğrenciye PASAJ olarak gitmez (soru.json ve govde'de p yok)", async () => {
  await basla("mat", "Problemler"); await kos(model({ p: "Matematik - Problemler", ...s1 }).fn);
  const r = DB.db.prepare("SELECT json, govde FROM soru").get(); assert.equal(say("soru"), 1);
  assert.equal(JSON.parse(r.json).p, undefined); assert.equal(JSON.parse(r.govde).p, undefined);
  assert.equal((await adaylar(env))[0].p, "");
});
test("hat: pasajsız soruda p boş gelirse de boş kalır; gerçek pasaj + atıf yapan kök korunur", async () => {
  await basla("mat", "Sayılar"); await kos(model({ p: "", ...s1 }).fn); assert.equal(JSON.parse(DB.db.prepare("SELECT json FROM soru").get().json).p, undefined);
  const gercek = "Şehirlerde yaşayan insanların çoğu gün boyunca ekran karşısında zaman geçirir. Bu durum hareketsizliği artırır ve uzmanlar düzenli yürüyüş yapılmasını önerir.";
  await basla("turkce", "Paragraf"); await kos(model({ p: gercek, q: "Parçaya göre uzmanlar ne önermektedir?", o: ["Yürüyüş", "Ekran", "Uyku", "Diyet", "Spor salonu"], a: 0, x: "Parçada düzenli yürüyüş önerildiği söylenir." }).fn);
  assert.equal(JSON.parse(DB.db.prepare("SELECT json FROM soru").get().json).p, gercek);
});
test("hat: kök pasaja atıf yapıp pasaj vermeyen soru YAZILMAZ (gecersiz)", async () => {
  await basla("turkce", "Paragraf"); await kos(model({ p: "Türkçe - Paragraf", q: "Parçaya göre yazar neyi eleştirmektedir?", o: ["a1", "b2", "c3", "d4", "e5"], a: 1, x: "Parçadan çıkar." }).fn);
  assert.equal(say("soru"), 0); assert.match(DB.db.prepare("SELECT hata FROM fabrika_is WHERE tur = 'uret'").get().hata, /pasaj_eksik/);
});
test("öğrenci ekranı kodu: dolu p, .passage kutusunda gösterilir (etiketin sızması gerçek bir görünüm hatasıdır)", () => {
  const html = readFileSync(new URL("index.html", KOK), "utf8");
  assert.ok(html.includes('${q.p ? `<div class="passage">${fq(q.p)}</div>` : ""}'));
});

/* ---------- 2) işaretsiz "altı çizili" ---------- */
test("bicimSorunlari: 'altı çizili' der ama işaret yok → isaret_eksik; «» ile işaretliyse yok", () => {
  const k10 = PILOT10[9], k4 = PILOT10[3];
  assert.ok(bicimSorunlari(k10).some(x => x.kod === "isaret_eksik"));
  assert.deepEqual(bicimSorunlari(k4), []);
  const q = { q: "Aşağıdaki cümlelerin hangisinde altı çizili sözcük ad tamlamasıdır?", o: ["Ali <u>kitabı</u> aldı.", "b", "c", "d", "e"] };
  assert.deepEqual(bicimSorunlari(q), []);
  assert.ok(bicimSorunlari({ q: "«» işaretleri arasındaki deyim hangisinde yanlış kullanılmıştır?", o: ["a", "b", "c", "d", "e"] }).some(x => x.kod === "isaret_eksik"));
  assert.ok(bicimSorunlari({ q: "Cümlede koyu yazılmış sözcük hangisidir?", o: ["a", "b", "c", "d", "e"] }).some(x => x.kod === "isaret_eksik"));
  assert.deepEqual(bicimSorunlari({ q: "Hangisi doğrudur?", o: ["a", "b", "c", "d", "e"] }), []);
});
test("hat: 'altı çizili deyim' diyen ama işaretsiz üretilen soru YAZILMAZ; «» ile gelen yazılır", async () => {
  const k10 = PILOT10[9];
  await basla("turkce", "Deyimler"); await kos(model({ p: "", q: k10.q, o: k10.o, a: k10.a, x: k10.x }).fn);
  assert.equal(say("soru"), 0); assert.match(DB.db.prepare("SELECT hata FROM fabrika_is WHERE tur = 'uret'").get().hata, /isaret_eksik/);
  const o2 = k10.o.map((x, i) => i === 3 ? "Elindeki imkânları iyi değerlendiren ekip, «baltayı taşa vurarak» projeyi zamanında bitirdi." : x);
  await basla("turkce", "Deyimler"); await kos(model({ p: "", q: k10.q.replace("altı çizili deyim", "«» işaretleri arasındaki deyim"), o: o2, a: 3, x: k10.x }).fn);
  assert.equal(say("soru"), 1);
});
test("istem: üretim istemi pasaj/işaret/şık harfi kurallarını söyler; denetim istemi yapılandırılmış sorun ister", () => {
  const u = uretimIstemi("turkce", "Deyimler");
  assert.match(u, /"p"[^.]*boş/i); assert.match(u, /etiket/i); assert.match(u, /«/); assert.match(u, /seçenek harfi/i); assert.match(u, /deyim/i);
  const d = denetimIstemi({ q: "Soru?", o: ["1", "2", "3", "4", "5"] });
  assert.match(d, /"tur"/); assert.match(d, /"agirlik"/); assert.match(d, /engelleyici/); assert.match(d, /ince_ayar/); assert.match(d, /sorun yoksa.*boş dizi/i);
});

/* ---------- 3) benzerlik uyarısı ---------- */
const pid = n => PILOT10[n - 1].id;
const cift = (u, a, b) => (u[pid(a)] || []).some(x => x.ilgili === pid(b));
test("mevcut tekrar kontrolü yalnız BİREBİR aynı kanonik içeriği yakalar: #2/#8 ve #4/#10 tekrar=0 kalır", async () => {
  sifirla(); await fabrikaSema(env); const tekrar = {};
  for (const k of PILOT10) { const y = await soruYazKanonik(env, { s: k.s, t: k.t, d: 2, q: k.q, o: k.o, a: k.a, x: k.x, ...(k.p ? { p: k.p } : {}) }); assert.equal(y.durum, "yazildi"); tekrar[k.n] = (await taslagiKuyrugaAl(env, { id: y.id, pilotId: null, ders: k.s, konu: k.t })).tekrar; }
  assert.deepEqual(Object.values(tekrar), Array(10).fill(false));   // 10 sorunun hiçbiri tekrar sayılmadı (özellikle #2/#8 ve #4/#10)
  const k = PILOT10[1], ayni = await soruYazKanonik(env, { s: k.s, t: k.t, d: 2, q: k.q, o: k.o, a: k.a, x: k.x });
  assert.equal((await taslagiKuyrugaAl(env, { id: ayni.id, pilotId: null, ders: k.s, konu: k.t })).tekrar, true);   // birebir aynısı yakalanır
});
test("benzerlikUyarilari: #2/#8 (kalan–EKOK şablonu) ve #4/#10 (aynı deyim) işaretlenir; ilgisiz çiftler işaretlenmez", () => {
  const u = benzerlikUyarilari(PILOT10);
  assert.ok(cift(u, 2, 8) && cift(u, 8, 2), "#2/#8");
  assert.ok(cift(u, 4, 10) && cift(u, 10, 4), "#4/#10");
  for (const [a, b] of [[6, 7], [5, 6], [3, 6], [7, 8], [5, 7], [1, 5]]) assert.ok(!cift(u, a, b), `${a}/${b} yanlış alarm`);
  const w = u[pid(4)].find(x => x.ilgili === pid(10)); assert.ok(w.skor > 0 && w.mesaj.length > 20);
  assert.ok(!/özgünlük doğrulandı|özgündür|orijinaldir/i.test(JSON.stringify(u)), "kanıtsız özgünlük iddiası yok");
});
test("benzerlikUyarilari: farklı ders/konu çiftleri karşılaştırılmaz; boş/tek liste güvenli", () => {
  assert.deepEqual(benzerlikUyarilari([]), {}); assert.deepEqual(benzerlikUyarilari([PILOT10[0]]), {});
  const u = benzerlikUyarilari([PILOT10[0], { ...PILOT10[7], id: "x", s: "turkce", t: "Deyimler" }]); assert.deepEqual(Object.values(u).flat(), []);
});
test("adaylar(): uyarılar eklenir, soru kaydı/model kararı/tekrar DEĞİŞMEZ; uyarı sildirmez", async () => {
  sifirla(); await fabrikaSema(env);
  for (const k of PILOT10) {
    const y = await soruYazKanonik(env, { s: k.s, t: k.t, d: 2, q: k.q, o: k.o, a: k.a, x: k.x, ...(k.p ? { p: k.p } : {}) }, { idUret: () => k.id });
    DB.db.prepare("INSERT INTO fabrika_soru (soru_id, pilot_id, surum, asama, model_durum, denetim_tam, tekrar, sayisal, denetim_json, olusturma, guncelleme) VALUES (?, 'p', 1, 'inceleme', ?, 1, 0, 'yapilmadi', ?, 1, 1)").run(y.id, k.md, JSON.stringify({ cevap: k.a, tek_dogru: true, belirsiz: false, sorunlar: k.ds }));
  }
  const once = DB.db.prepare("SELECT soru_id, model_durum, tekrar FROM fabrika_soru ORDER BY soru_id").all();
  const a = await adaylar(env), g = id => a.find(x => x.id === id);
  assert.ok(g(pid(10)).uyarilar.some(x => x.tur === "isaret_eksik")); assert.ok(g(pid(5)).uyarilar.some(x => x.tur === "p_pasaj_degil")); assert.ok(g(pid(9)).uyarilar.some(x => x.tur === "p_pasaj_degil"));
  assert.ok(g(pid(2)).uyarilar.some(x => x.tur === "benzerlik" && x.ilgili === pid(8))); assert.ok(g(pid(4)).uyarilar.some(x => x.tur === "benzerlik" && x.ilgili === pid(10)));
  assert.ok(g(pid(4)).uyarilar.some(x => x.tur === "kaynak_dogrulama"), "deyim sorusu: sözlük doğrulaması bekliyor"); assert.ok(g(pid(6)).uyarilar.some(x => x.tur === "kaynak_dogrulama"));
  assert.equal(a.length, 10);
  assert.deepEqual(DB.db.prepare("SELECT soru_id, model_durum, tekrar FROM fabrika_soru ORDER BY soru_id").all(), once);   // hiçbir kayıt değişmedi
});

/* ---------- 4) denetim geçidi ---------- */
const hat = async (denetim, uretim = { p: "", ...s1 }, konu = ["mat", "Sayılar"]) => { await basla(...konu); await kos(model(uretim, denetim).fn); return DB.db.prepare("SELECT * FROM fabrika_soru").get(); };
const S = (tur, agirlik, metin = "Not") => ({ tur, agirlik, metin });
test("geçit: yalnız ince_ayar çeldirici/düzey notu + doğru cevap → 'gecti'; notlar kaydedilir ve görünür kalır (#1 tipi)", async () => {
  const f = await hat(a => ({ ...TAM(a), sorunlar: [S("celdirici", "ince_ayar", "17 ve 23 zayıf"), S("duzey", "ince_ayar", "biraz kolay")] }));
  assert.equal(f.model_durum, "gecti"); const d = JSON.parse(f.denetim_json);
  assert.equal(d.sorun_turleri.length, 2); assert.deepEqual(d.sorunlar, ["17 ve 23 zayıf", "biraz kolay"]); assert.equal(d.sorun_turleri[0].agirlik, "ince_ayar");
});
test("geçit: engelleyici sorun ya da çeldirici/düzey dışı tür → 'revizyon' (ince_ayar olsa bile)", async () => {
  for (const s of [S("celdirici", "engelleyici"), S("bicim", "ince_ayar"), S("cozum", "ince_ayar"), S("belirsizlik", "ince_ayar"), S("yanlis_cevap", "ince_ayar"), S("diger", "ince_ayar"), S("celdirici", "ilginc")]) {
    const f = await hat(a => ({ ...TAM(a), sorunlar: [S("celdirici", "ince_ayar"), s] })); assert.equal(f.model_durum, "revizyon", JSON.stringify(s));
  }
});
test("geçit: eski biçim (düz metin sorun) HÂLÂ 'revizyon' — eksik/yanlış tipli alan asla 'gecti' vermez", async () => {
  const f = await hat(a => ({ ...TAM(a), sorunlar: ["Çeldirici C zayıf"] })); assert.equal(f.model_durum, "revizyon");
  assert.equal(JSON.parse(f.denetim_json).sorun_turleri[0].agirlik, "belirtilmemis");
  const g = await hat(a => ({ ...TAM(a), sorunlar: [S("celdirici", "ince_ayar", "")] })); assert.equal(g.model_durum, "revizyon");   // boş metin = anlamsız kayıt → güvenli taraf
});
test("geçit: kural tabanlı biçim denetimi — denetçi temiz dese bile işaretsiz 'altı çizili' soru 'gecti' OLAMAZ", async () => {
  sifirla(); await fabrikaSema(env); await robotAyarla(env, true);
  const k = PILOT10[9], y = await soruYazKanonik(env, { s: k.s, t: k.t, d: 2, q: k.q, o: k.o, a: k.a, x: k.x });   // üretim süzgecini aşan eski kayıt
  await taslagiKuyrugaAl(env, { id: y.id, pilotId: null, ders: k.s, konu: k.t });
  await kos(async () => ({ metin: JSON.stringify(TAM(k.a)), giris: 1, cikis: 1 }));
  const f = DB.db.prepare("SELECT * FROM fabrika_soru").get(); assert.equal(f.model_durum, "revizyon");
  const d = JSON.parse(f.denetim_json); assert.ok(d.sorun_turleri.some(x => x.tur === "bicim" && x.kaynak === "kural"));
});

/* ---------- 5) yayım kapısı: uyarılar ve uzman notu ---------- */
async function gectiKaydi(k, md = "gecti") {
  const y = await soruYazKanonik(env, { s: k.s, t: k.t, d: 2, q: k.q, o: k.o, a: k.a, x: k.x, ...(k.p ? { p: k.p } : {}) }, { idUret: () => k.id });
  DB.db.prepare("INSERT INTO fabrika_soru (soru_id, pilot_id, surum, asama, model_durum, denetim_tam, tekrar, sayisal, denetim_json, olusturma, guncelleme) VALUES (?, 'p', 1, 'inceleme', ?, 1, 0, 'yapilmadi', '{}', 1, 1)").run(y.id, md);
  return y.id;
}
test("yayım kapısı: benzerlik uyarılı 'gecti' soru, açık kabul olmadan YAYIMLANMAZ; kabul = insan uzman onayı değildir", async () => {
  sifirla(); await fabrikaSema(env); const a = await gectiKaydi(PILOT10[1]), b = await gectiKaydi(PILOT10[7]);
  let r = await yayimKarari(env, [a], "yayin", "yonetici"); assert.equal(r.ok, false); assert.ok(r.hatalar.some(h => h.neden === "inceleme_uyarisi:benzerlik")); assert.equal(say("soru", "durum = 'onayli'"), 0);
  r = await yayimKarari(env, [a], "yayin", "yonetici", { uyariKabul: true }); assert.equal(r.ok, true);   // yönetici bilerek kabul eder
  assert.equal(say("fabrika_soru", "yayim_durum = 'onayli'"), 1);   // sayaç yönetici kararıdır; insan UZMAN onayı sayacı ayrıdır ve artmaz
  assert.equal((await fabrikaDurum(env)).sayilar.insan_onayli, 1); void b;
});
test("yayım kapısı: biçim hatası ve p etiketi uyarıyı kabul etsen bile ENGELLER (sert)", async () => {
  sifirla(); await fabrikaSema(env); const a = await gectiKaydi(PILOT10[9], "gecti"), b = await gectiKaydi(PILOT10[4], "gecti");
  const r = await yayimKarari(env, [a, b], "yayin", "yonetici", { uyariKabul: true }); assert.equal(r.ok, false);
  assert.ok(r.hatalar.some(h => h.id === a && h.neden === "inceleme_uyarisi:isaret_eksik")); assert.ok(r.hatalar.some(h => h.id === b && h.neden === "inceleme_uyarisi:p_pasaj_degil")); assert.equal(say("soru", "durum = 'onayli'"), 0);
});
test("uzman notu: açık 'uzman_bekliyor' notu varken yayım HİÇBİR bayrakla açılmaz; not kapanınca (kim+gerekçe) açılır", async () => {
  sifirla(); await fabrikaSema(env); const id = await gectiKaydi({ ...PILOT10[1], id: "ok-uzman-1" });
  DB.db.prepare("UPDATE fabrika_soru SET model_durum = 'gecti' WHERE soru_id = ?").run(id);
  const n = await notEkle(env, { soruId: id, tur: "uzman_bekliyor", mesaj: "E şıkkı kaside için de savunulabilir mi?", kim: "yonetici" }); assert.equal(n.ok, true);
  assert.equal((await adaylar(env))[0].notlar.filter(x => x.durum === "acik").length, 1);
  let r = await yayimKarari(env, [id], "yayin", "yonetici", { uyariKabul: true }); assert.equal(r.ok, false); assert.ok(r.hatalar.some(h => h.neden === "uzman_bekliyor"));
  assert.equal((await notKapat(env, { notId: n.id, kim: "yonetici", gerekce: "" })).ok, false);   // gerekçesiz kapatılamaz
  assert.equal((await notKapat(env, { notId: n.id, kim: "yonetici", gerekce: "Uzman: kaynakla doğrulandı" })).ok, true);
  r = await yayimKarari(env, [id], "yayin", "yonetici", { uyariKabul: true }); assert.equal(r.ok, true);
});
test("not: geçersiz tür / olmayan soru reddedilir; not eklemek soru kaydını değiştirmez", async () => {
  sifirla(); await fabrikaSema(env); const id = await gectiKaydi(PILOT10[5], "revizyon"), once = JSON.stringify(DB.db.prepare("SELECT * FROM fabrika_soru").all()), soruOnce = JSON.stringify(DB.db.prepare("SELECT * FROM soru").all());
  assert.equal((await notEkle(env, { soruId: id, tur: "baska", mesaj: "x", kim: "y" })).ok, false); assert.equal((await notEkle(env, { soruId: "yok", tur: "uzman_bekliyor", mesaj: "x", kim: "y" })).ok, false);
  assert.equal((await notEkle(env, { soruId: id, tur: "uzman_bekliyor", mesaj: "  ", kim: "y" })).ok, false);
  assert.equal((await notEkle(env, { soruId: id, tur: "uzman_bekliyor", mesaj: "Çoklu doğru riski", kim: "y" })).ok, true);
  assert.equal(JSON.stringify(DB.db.prepare("SELECT * FROM fabrika_soru").all()), once); assert.equal(JSON.stringify(DB.db.prepare("SELECT * FROM soru").all()), soruOnce);
});

/* ---------- 6) şık konumu ---------- */
const rnd = dizi => { let i = 0; return () => dizi[i++ % dizi.length]; };
const harfAtfi = x => /\b[A-E]\s*(şık|seçenek)|\b(doğru cevap|cevap)\s*[A-E]\b|\b[A-E]\)|\b[A-E]['’](?:nin|nın|de|da|dir|dır|yi|yı)\b/i.test(x);
test("siklariKaristir: doğru cevap, çözüm ve şık kümesi birlikte tutarlı; harf atıflı/sıralı/'hiçbiri' soruları KARIŞTIRILMAZ", () => {
  let karisan = 0, atlanan = 0;
  for (const k of PILOT10) for (const seed of [[0.01, 0.2, 0.4, 0.6], [0.9, 0.7, 0.5, 0.3], [0.33, 0.66, 0.1, 0.99]]) {
    const r = siklariKaristir({ q: k.q, o: k.o, a: k.a, x: k.x }, rnd(seed)), dogruMetin = k.o[k.a];
    assert.deepEqual([...r.o].sort(), [...k.o].sort(), "şık kümesi değişmedi"); assert.equal(r.o[r.a], dogruMetin, `#${k.n}: yeni a doğru şıkkı göstermeli`); assert.equal(r.x, k.x, "çözüm metni değişmedi");
    if (r.karisti) { karisan++; assert.ok(!harfAtfi(k.x), `#${k.n}: çözümde harf atfı varken karıştırıldı`); assert.ok(r.o.every(s => !/hiçbiri|hepsi|yukarıdakilerin/i.test(s))); } else { atlanan++; assert.deepEqual(r.o, k.o); assert.equal(r.a, k.a); }
  }
  assert.ok(karisan > 0 && atlanan > 0, `karisan=${karisan} atlanan=${atlanan}`);
  for (const n of [3, 6, 9]) assert.equal(siklariKaristir({ q: PILOT10[n - 1].q, o: PILOT10[n - 1].o, a: PILOT10[n - 1].a, x: PILOT10[n - 1].x }, rnd([0.1, 0.5])).karisti, false, `#${n} çözümü şık harfine atıf yapıyor → atlanmalı`);
  assert.equal(siklariKaristir({ q: "Q?", o: ["10", "20", "30", "40", "50"], a: 4, x: "50'dir." }, rnd([0.1, 0.9])).karisti, false, "artan sayısal şıklar ÖSYM düzenidir; karıştırılmaz");
  assert.equal(siklariKaristir({ q: "Q?", o: ["ali", "veli", "hiçbiri", "can", "ece"], a: 0, x: "Ali." }, rnd([0.1, 0.9])).karisti, false);
  assert.equal(siklariKaristir({ q: "Q?", o: ["I ve II", "yalnız I", "I, II ve III", "yalnız III", "II ve III"], a: 0, x: "I ve II." }, rnd([0.1, 0.9])).karisti, false, "şıklar numaralı ifadelere atıf yapıyor");
});
test("siklariKaristir: aynı girdi + aynı rastgelelik → aynı sonuç; farklı rastgelelik → farklı konum üretebilir; girdiyi değiştirmez", () => {
  const g = { q: "Q?", o: ["elma", "armut", "kiraz", "vişne", "erik"], a: 0, x: "Elma doğrudur." }, kopya = JSON.stringify(g);
  const konumlar = new Set(); for (let i = 0; i < 40; i++) konumlar.add(siklariKaristir(g, rnd([i / 40, (i * 7 % 40) / 40, (i * 3 % 40) / 40, (i * 11 % 40) / 40])).a);
  assert.ok(konumlar.size >= 4, [...konumlar].join()); assert.equal(JSON.stringify(g), kopya);
  assert.deepEqual(siklariKaristir(g, rnd([0.2, 0.4, 0.6, 0.8])), siklariKaristir(g, rnd([0.2, 0.4, 0.6, 0.8])));
});
test("hat: karıştırılan soruda saklanan a, şıklar ve kör denetçinin gördüğü sıra TUTARLI; denetçi doğru metni seçince 'gecti'", async () => {
  const uretim = { p: "", q: "Hangisi bir meyvedir?", o: ["elma", "masa", "taş", "bulut", "kalem"], a: 0, x: "Elma bir meyvedir; diğerleri nesne ya da doğa olayıdır." };
  await basla("turkce", "Sözcükte anlam");
  const f = model(uretim, (anahtar, prompt) => { const m = /\n([A-E])\) elma/.exec(prompt); return TAM("ABCDE".indexOf(m[1])); });
  await kos(f.fn, { karistir: rnd([0.0, 0.0, 0.0, 0.0]) });
  const r = DB.db.prepare("SELECT s.a, s.govde, f.model_durum FROM soru s JOIN fabrika_soru f ON f.soru_id = s.id").get(), o = JSON.parse(r.govde).o;
  assert.equal(o[r.a], "elma"); assert.notEqual(r.a, 0, "gerçekten karıştı"); assert.equal(r.model_durum, "gecti");
  assert.equal(JSON.parse(DB.db.prepare("SELECT json FROM soru").get().json).a, r.a);   // legacy json da aynı
});
test("hat: karıştırma kapalı/uygunsuz soruda sıra aynen korunur (artan sayısal şıklar)", async () => {
  await basla("mat", "Sayılar"); await kos(model({ p: "", ...s1 }).fn, { karistir: rnd([0.0, 0.0, 0.0, 0.0]) });
  assert.equal(DB.db.prepare("SELECT a FROM soru").get().a, 2); assert.deepEqual(JSON.parse(DB.db.prepare("SELECT govde FROM soru").get().govde).o, s1.o);
});

/* ---------- 7) panel ---------- */
test("panel: inceleme uyarıları ve uzman notları kartta görünür; 'özgünlük doğrulandı' ifadesi yok", () => {
  const html = readFileSync(new URL("index.html", KOK), "utf8"), bas = html.indexOf("function fabAdayKart"), son = html.indexOf("function fabrikaBolumu"), kart = html.slice(bas, son);
  assert.match(kart, /uyarilar/); assert.match(kart, /notlar/); assert.match(kart, /İnceleme uyarısı/); assert.match(kart, /uzman/i);
  assert.ok(!/özgünlük doğrulandı/i.test(html.slice(bas, html.indexOf("fabEylem(ad, yol"))));
});
