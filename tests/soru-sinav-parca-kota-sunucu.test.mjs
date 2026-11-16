// B4 3C-4c · 121+ soruluk SINAV oturumunun iki parçada (120 + kalan) açılması ve AYLIK ücretsiz deneme kotasına etkisi — YERELDE SQLite (node:sqlite) üzerinde ölçüm.
// Production D1'e/ağa DOKUNMAZ; uygulama koduna dokunmaz; CI'a EKLENMEZ. Mini deneme kapsamından AYRIDIR (mini ≤31 soru; bu durum tam deneme/özel boyut için geçerlidir).
// İstemci davranışı (index.html B4 896d9c7 svBaslat :8795-8838): ust = exam ? 120 : 50; adaylar ust'lük dilimlere bölünür, HER dilim ayrı POST /api/soru/oturum (istek = svIstek + "-" + dilim, idler = dilim kimlikleri).
// Sunucu (lib/soru-api.js): SINIR.exam = 120 (:24); sınav oturumunda hak = 1 (:262 hak = paketli ? 0 : (pratik ? adet : 1)); kota batch şartı sayaç + hak <= limit (:275-281); ücretsiz deneme limiti ayda 1 (lib/kota.js :18).
// S3 YALNIZ önerilen gelecek ürün sözleşmesidir ve test.todo'dur (gelecekteki "bir deneme = bir hak" ürün kararı; sunucu kota tasarımı 3C-4c'de değiştirilmez; beklenti/assertion'lar AYNEN korunur, başarı sayısına katılmaz). Mevcut davranışı S1/S2/S4-S8 karakterize eder.
// Cevap anahtarı/çözüm değerleri çıktıya yazılmaz (sentetik). Çalıştırma: node --test tests/soru-sinav-parca-kota-sunucu.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { kur, tohumla } from "./yardim/soru-v2.mjs";
import { kotaRezervasyonKonumu } from "../lib/kota.js";

const T = await kur();
const { DB, env, api, giris, yeniIstek, premiumYap } = T;
await T.hazirla();
tohumla(DB, 200, { onek: "s", s: "mat", konular: ["K1", "K2"], zorluklar: [1, 2, 3] });
const KIMLIK = n => Array.from({ length: n }, (_, i) => `s-${i}`);
const sayac = async kid => { const k = await kotaRezervasyonKonumu(env, kid, "deneme"); return { kullanilan: k.kullanilan, limit: k.limit }; };
const oturumSayisi = kid => DB.db.prepare("SELECT COUNT(*) AS n FROM soru_oturum WHERE kid = ?").get(kid).n;
/* istemcinin svBaslat dilimlemesi: 120'lik dilimler, istek anahtarı <taban>-<dilim> */
const parcala = (idler, ust = 120) => { const o = []; for (let i = 0; i < idler.length; i += ust) o.push(idler.slice(i, i + ust)); return o; };
const taban = () => yeniIstek();
let e = 0; const eposta = () => `parca${++e}@ornek.com`;

test("S1) ücretsiz kullanıcı, 120 soruluk TEK parça sınav: 200, aylık deneme sayacı 1 (limit 1), oturum 1", async () => {
  const { cookie, kid } = await giris(eposta());
  const r = await api("oturum", { cookie, govde: { istek: taban(), mod: "exam", idler: KIMLIK(120) } });
  assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 120);
  assert.deepEqual(await sayac(kid), { kullanilan: 1, limit: 1 }); assert.equal(oturumSayisi(kid), 1);
});

test("S2) ÖLÇÜM: ücretsiz kullanıcı, 121 soru = istemci dilimlemesiyle 120 + 1 → parça sonuçları ve sayaç (gerçek durumu raporlar)", async () => {
  const { cookie, kid } = await giris(eposta());
  const t0 = taban(), sonuc = [];
  for (const [i, parca] of parcala(KIMLIK(121)).entries()) {
    const r = await api("oturum", { cookie, govde: { istek: t0 + "-" + i, mod: "exam", idler: parca } });
    sonuc.push({ parca: i, idSayisi: parca.length, durum: r.s, hata: r.j && r.j.error ? r.j.error : null, soruSayisi: r.j && r.j.sorular ? r.j.sorular.length : 0 });
  }
  const sayacSon = await sayac(kid), oturum = oturumSayisi(kid);
  console.log("ÖLÇÜM S2 (ücretsiz, 120+1):", JSON.stringify({ sonuc, sayac: sayacSon, oturum }));
  /* karakterizasyon: ilk parça açılır ve aylık hakkı tüketir; ikinci parça aynı ay için 402 alır (kod: kalan < 1 → 402 limit, :258-259) */
  assert.equal(sonuc[0].durum, 200); assert.equal(sonuc[1].durum, 402); assert.equal(sonuc[1].hata, "limit");
  assert.deepEqual(sayacSon, { kullanilan: 1, limit: 1 }); assert.equal(oturum, 1);
});

test.todo("S3) [ÖNERİLEN GELECEK ÜRÜN SÖZLEŞMESİ — mevcut desteklenen mini/tam/yarım/özel akışın testi DEĞİL; bugün UI'dan 121+ soru üretilemez; sunucu kota tasarımı bu adımda DEĞİŞMEZ → kırmızı kalması beklenir] bir deneme = bir aylık hak: 121 soruluk ücretsiz sınavın İKİNCİ parçası da açılmalı (402 OLMAMALI), sayaç 1'de kalmalı", async () => {
  const { cookie, kid } = await giris(eposta());
  const t0 = taban(), durumlar = [];
  for (const [i, parca] of parcala(KIMLIK(121)).entries()) durumlar.push((await api("oturum", { cookie, govde: { istek: t0 + "-" + i, mod: "exam", idler: parca } })).s);
  assert.deepEqual(durumlar, [200, 200], "ikinci parça 402 alırsa istemci güvenli modda yalnız ilk 120 soruyla sınavı başlatır (kalan sorular sete eklenmez)");
  assert.equal((await sayac(kid)).kullanilan, 1, "iki parça tek deneme hakkıdır");
});

test("S4) ÖLÇÜM: hak=1 sınav oturumu başına: aynı kullanıcı ikinci ayrı 120'lik sınavı aynı ay açamaz (402), sayaç artmaz", async () => {
  const { cookie, kid } = await giris(eposta());
  const a = await api("oturum", { cookie, govde: { istek: taban(), mod: "exam", idler: KIMLIK(120) } });
  const b = await api("oturum", { cookie, govde: { istek: taban(), mod: "exam", idler: KIMLIK(10) } });
  assert.equal(a.s, 200); assert.equal(b.s, 402); assert.deepEqual(await sayac(kid), { kullanilan: 1, limit: 1 });
});

test("S5) yeniden deneme (aynı istek anahtarı) idempotent: aynı oturum, sayaç artmaz; 402 alan parça yeniden denenince yine 402 (sayaç artmaz)", async () => {
  const { cookie, kid } = await giris(eposta()); const t0 = taban(), pr = parcala(KIMLIK(121));
  const a1 = await api("oturum", { cookie, govde: { istek: t0 + "-0", mod: "exam", idler: pr[0] } });
  const a2 = await api("oturum", { cookie, govde: { istek: t0 + "-0", mod: "exam", idler: pr[0] } });
  const b1 = await api("oturum", { cookie, govde: { istek: t0 + "-1", mod: "exam", idler: pr[1] } });
  const b2 = await api("oturum", { cookie, govde: { istek: t0 + "-1", mod: "exam", idler: pr[1] } });
  assert.equal(a1.s, 200); assert.equal(a2.s, 200); assert.equal(a2.j.oturum, a1.j.oturum);
  assert.equal(b1.s, 402); assert.equal(b2.s, 402);
  assert.deepEqual(await sayac(kid), { kullanilan: 1, limit: 1 }); assert.equal(oturumSayisi(kid), 1);
});

test("S6) ücretli (premium) kullanıcı: 121 soru iki parça → ikisi 200, kota sayacı hiç artmaz (hak 0)", async () => {
  const { cookie, kid } = await giris(eposta()); premiumYap(kid);
  const t0 = taban(), durum = [];
  for (const [i, parca] of parcala(KIMLIK(121)).entries()) durum.push((await api("oturum", { cookie, govde: { istek: t0 + "-" + i, mod: "exam", idler: parca } })).s);
  assert.deepEqual(durum, [200, 200]); assert.equal((await sayac(kid)).kullanilan, 0); assert.equal(oturumSayisi(kid), 2);
});

test("S7) sunucu tek istekte 121 soruluk sınavı REDDEDER (400): bölme istemcide zorunlu", async () => {
  const { cookie } = await giris(eposta());
  const r = await api("oturum", { cookie, govde: { istek: taban(), mod: "exam", idler: KIMLIK(121) } });
  assert.equal(r.s, 400);
});

test("S8) ölçüm: 2 parça = 2 açık sınav oturumu; iki oturumun /bitir'i ayrı (parça başına) yapılır, her biri yalnız kendi sorularının anahtarını verir", async () => {
  const { cookie, kid } = await giris(eposta()); premiumYap(kid);
  const t0 = taban(), pr = parcala(KIMLIK(121)), ot = [];
  for (const [i, parca] of pr.entries()) ot.push((await api("oturum", { cookie, govde: { istek: t0 + "-" + i, mod: "exam", idler: parca } })).j.oturum);
  const bit = [];
  for (const [i, o] of ot.entries()) { const r = await api("bitir", { cookie, govde: { oturum: o, cevaplar: pr[i].map(id => ({ soru: id, secim: null })) } }); bit.push({ durum: r.s, n: r.j && r.j.sorular ? r.j.sorular.length : 0, hepsiAnahtarli: !!(r.j && r.j.sorular && r.j.sorular.every(s => Number.isInteger(s.a) && typeof s.x === "string" && s.x.length > 0)) }); }
  console.log("ÖLÇÜM S8:", JSON.stringify(bit));
  assert.deepEqual(bit.map(x => x.durum), [200, 200]); assert.deepEqual(bit.map(x => x.n), [120, 1]); assert.ok(bit.every(x => x.hepsiAnahtarli));
});
