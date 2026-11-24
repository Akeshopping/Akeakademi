// Hesap "stats" belgesinde eşzamanlı yazma · GERÇEK sunucu koduyla (node:sqlite üzerinde, ifadeler iç içe geçecek şekilde).
// Düzeltmeden ÖNCE iki kırmızı kanıt vardı: (A) PUT veri/<alan> "oku → karşılaştır → yaz" ile eşzamanlı iki yazmadan eskisi yenisinin üstüne yazabiliyordu;
// (B) istemci tarafı oku-değiştir-yaz, iki yazar aynı tabandan okuyunca birinin artışını siliyordu ([0,1,0] kaldı, doğru cevap kayboldu).
// Çözüm: (A) tek atomik koşullu upsert; (B) mobil artık stats'ı kendisi YAZMAZ, sunucu kendi kayıtlarından uygular (/api/soru/ilerleme, CAS + tekil olay).
import test from "node:test";
import assert from "node:assert/strict";
import { kur, tohumla } from "./yardim/soru-v2.mjs";

const T = await kur();
const { env, giris, api, yeniIstek, DB } = T;
await T.hazirla();
tohumla(DB, 60, { onek: "m", s: "mat", konular: ["Sayılar"], zorluklar: [1, 2, 3] });
const { onRequest } = await import("../functions/api/hesap/[[yol]].js");
let ipn = 0;
const cagir = (tok, yontem, yol, govde) => onRequest({ request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: yontem, headers: { "content-type": "application/json", authorization: "Bearer " + tok, "cf-connecting-ip": "10.5." + (++ipn >> 8 & 255) + "." + (ipn & 255) }, body: govde ? JSON.stringify(govde) : undefined }), env, params: { yol: yol.split("/") } });
const tokenAl = async e => decodeURIComponent(/^ake_s=([^;]*)/.exec((await giris(e)).cookie)[1]);
const bekle = n => new Promise(r => { let i = 0; const f = () => (i++ >= n ? r() : setImmediate(f)); f(); });

test("A) eşzamanlı iki PUT: daha yeni _u her sıralamada kazanır (sunucu u'su geriye gitmez)", async () => {
  const tok = await tokenAl("yaris-a@ornek.com");
  let bozuk = 0;
  for (let deneme = 0; deneme < 40; deneme++) {
    const taban = 10000 * (deneme + 1);
    const yeni = { _u: taban + 300, topic: { "mat|S": [9, 9, 9] } }, eski = { _u: taban + 200, topic: { "mat|S": [1, 1, 1] } };
    const sira = deneme % 2 ? [[yeni, 0], [eski, 1 + (deneme % 3)]] : [[eski, 0], [yeni, 1 + (deneme % 3)]];
    await Promise.all(sira.map(async ([g, gec]) => { await bekle(gec); return cagir(tok, "PUT", "veri/stats", g); }));
    const son = (await (await cagir(tok, "GET", "veri")).json()).alanlar.stats;
    if (son._u !== taban + 300) bozuk++;
  }
  assert.equal(bozuk, 0, `${bozuk}/40 denemede eski yazma yenisinin üstüne yazdı`);
});


/* ---- /api/soru/ilerleme ---- */
const kullanici = async e => { const g = await giris(e); T.premiumYap(g.kid); /* kota bu testin konusu değil */ return { cookie: g.cookie, kid: g.kid, tok: decodeURIComponent(/^ake_s=([^;]*)/.exec(g.cookie)[1]) }; };
const stats = async tok => (await (await cagir(tok, "GET", "veri")).json()).alanlar.stats;
const toplam = st => (st && st.topic && st.topic["mat|Sayılar"] || [0, 0, 0]).reduce((a, b) => a + b, 0);
async function cevapla(c, n, ek = {}) {
  const o = await api("oturum", { cookie: c.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: n, ders: "mat", ...ek } });
  assert.equal(o.s, 200);
  const sonuc = [];
  return { oturum: o.j.oturum, sorular: o.j.sorular, bitir: () => api("bitir", { cookie: c.cookie, govde: { oturum: o.j.oturum } }), cevapla: async (i, secim = 0) => { const r = await api("cevap", { cookie: c.cookie, govde: { oturum: o.j.oturum, soru: o.j.sorular[i].id, secim } }); assert.equal(r.s, 200); sonuc.push(r.j.dogru); return r.j; }, sonuc };
}
const ilerle = (c, oturum, ek = {}) => api("ilerleme", { cookie: c.cookie, govde: { oturum, ...ek } });

test("B1) cevaplanan sorular hesaba işlenir; cevaplanmayan sayılmaz; web alanları korunur; tekrar çağrı çift saymaz", async () => {
  const c = await kullanici("esam-b1@ornek.com");
  const webStats = { _u: 1000, ans: { "mat-1": [1, 0, 0, 1, 1] }, badges: { ilk: 1 }, para: { c: 2, w: 1, times: [3] }, topic: { "mat|Sayılar": [5, 2, 0] } };
  assert.equal((await cagir(c.tok, "PUT", "veri/stats", webStats)).status, 200);
  const s = await cevapla(c, 3);
  await s.cevapla(0); await s.cevapla(1);                         // 3. soru cevapsız
  const r1 = await ilerle(c, s.oturum); assert.equal(r1.s, 200); assert.deepEqual(r1.j, { bekleyen: 0 });
  const a = await stats(c.tok);
  assert.equal(toplam(a), 7 + 2, "5+2 önceki + 2 yeni");
  assert.deepEqual(a.ans, webStats.ans); assert.deepEqual(a.badges, webStats.badges); assert.deepEqual(a.para, webStats.para);
  const gun = Object.values(a.daily)[0]; assert.equal(gun.q, 2); assert.equal(gun.c, s.sonuc.filter(Boolean).length);
  const r2 = await ilerle(c, s.oturum), r3 = await ilerle(c, s.oturum);   // yanıtı kaybolmuş tekrar denemeler
  assert.equal(r2.s, 200); assert.equal(r3.s, 200);
  assert.deepEqual(await stats(c.tok), a, "tekrarlar belgeyi DEĞİŞTİRMEDİ (çift sayım yok)");
  await s.cevapla(2);
  assert.equal((await ilerle(c, s.oturum)).s, 200);
  assert.equal(toplam(await stats(c.tok)), 7 + 3, "yalnız yeni cevap eklendi");
});
test("B2) AYNI oturumun eşzamanlı çağrıları: her cevap tam bir kez sayılır (30 deneme, farklı iç içe geçmeler)", async () => {
  const c = await kullanici("esam-b2@ornek.com"); let beklenen = 0;
  for (let d = 0; d < 30; d++) {
    const s = await cevapla(c, 4); for (let i = 0; i < 4; i++) await s.cevapla(i); beklenen += 4;
    await Promise.all(Array.from({ length: 2 + (d % 4) }, async (_, k) => { await bekle((d + k) % 4); return ilerle(c, s.oturum); }));
    assert.equal(toplam(await stats(c.tok)), beklenen, `deneme ${d}`);
    await s.bitir();   // açık oturum sınırı (3) dolmasın
  }
});
test("B3) FARKLI oturumların eşzamanlı işlenmesi (iki cihaz): kayıp güncelleme yok", async () => {
  const c = await kullanici("esam-b3@ornek.com"); let beklenen = 0;
  for (let d = 0; d < 25; d++) {
    const x = await cevapla(c, 3), y = await cevapla(c, 2);
    for (let i = 0; i < 3; i++) await x.cevapla(i); for (let i = 0; i < 2; i++) await y.cevapla(i); beklenen += 5;
    const [r1, r2] = await Promise.all([bekle(d % 3).then(() => ilerle(c, x.oturum)), bekle((d + 1) % 3).then(() => ilerle(c, y.oturum))]);
    assert.equal(r1.s, 200); assert.equal(r2.s, 200);
    assert.equal(toplam(await stats(c.tok)), beklenen, `deneme ${d}: ${JSON.stringify([r1.j, r2.j])}`);
    await x.bitir(); await y.bitir();
  }
});
test("B4) web PUT'u ile mobil işleme yarışı: sunucu u'su geriye gitmez; daha yeni web yazması korunur, eski olan 409 alır", async () => {
  const c = await kullanici("esam-b4@ornek.com");
  const s = await cevapla(c, 2); await s.cevapla(0); await s.cevapla(1);
  assert.equal((await ilerle(c, s.oturum)).s, 200);
  const sunucuU = (await stats(c.tok))._u;
  const eski = await cagir(c.tok, "PUT", "veri/stats", { _u: sunucuU - 1, topic: {} });
  assert.equal(eski.status, 409); assert.equal((await eski.json()).u, sunucuU);
  assert.equal(toplam(await stats(c.tok)), 2, "eski web yazması mobil sayacı silemedi");
  assert.equal((await cagir(c.tok, "PUT", "veri/stats", { _u: sunucuU + 5, topic: { "mat|Sayılar": [9, 0, 0] } })).status, 200);
  const s2 = await cevapla(c, 1); await s2.cevapla(0);
  assert.equal((await ilerle(c, s2.oturum)).s, 200);
  assert.equal(toplam(await stats(c.tok)), 10, "web'in daha yeni yazması üzerine mobil artışı eklendi");
  assert.ok((await stats(c.tok))._u > sunucuU + 5);
});
test("B5) başkasının oturumu 404 ve başkasının belgesine yazılmaz; sınav oturumu işlenmez; geçersiz girdiler", async () => {
  const a = await kullanici("esam-b5a@ornek.com"), b = await kullanici("esam-b5b@ornek.com");
  const s = await cevapla(a, 2); await s.cevapla(0);
  assert.equal((await ilerle(b, s.oturum)).s, 404);
  assert.equal(await stats(b.tok), undefined, "B'nin belgesi oluşmadı");
  assert.equal(await stats(a.tok), undefined, "A'nın belgesi henüz işlenmedi");
  const ex = await api("oturum", { cookie: a.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 3, ders: "mat" } });
  assert.equal((await ilerle(a, ex.j.oturum)).s, 200); assert.equal(await stats(a.tok), undefined, "sınav cevapları bu uçtan işlenmez");
  assert.equal((await ilerle(a, "x")).s, 404);
  assert.equal((await ilerle(a, s.oturum, { tz: "3" })).s, 400); assert.equal((await ilerle(a, s.oturum, { tz: 9999 })).s, 400);
  assert.equal((await ilerle(a, s.oturum, { sayac: 5 })).s, 400, "istemci sayaç gönderemez");
  assert.equal((await ilerle(a, s.oturum)).s, 200); assert.equal(toplam(await stats(a.tok)), 1);
});
test("B6) gün anahtarı istemcinin saat dilimine göre (UTC 22:30 + 180 dk → ertesi gün)", async () => {
  const c = await kullanici("esam-b6@ornek.com");
  const s = await cevapla(c, 1); await s.cevapla(0);
  DB.db.prepare("UPDATE soru_oturum_soru SET cevap_zamani = ? WHERE oturum = ?").run(Date.UTC(2026, 10, 24, 22, 30), s.oturum);
  assert.equal((await ilerle(c, s.oturum, { tz: 180 })).s, 200);
  assert.deepEqual(Object.keys((await stats(c.tok)).daily), ["2026-11-25"]);
});
test("B7) bayrak kapalıyken /ilerleme 404 (karanlık API açılmaz)", async () => {
  const K = await kur({ bayrak: null }); assert.equal((await K.api("ilerleme", { govde: { oturum: "a".repeat(48) } })).s, 404);
});
test("B8) süpürme (oturum verilmez): yalnız çağıranın bekleyen cevapları işlenir; başkasının belgesi etkilenmez; tekrar çift saymaz", async () => {
  const a = await kullanici("esam-b8a@ornek.com"), b = await kullanici("esam-b8b@ornek.com");
  const x = await cevapla(a, 2), y = await cevapla(a, 2), z = await cevapla(b, 2);
  for (const o of [x, y]) { await o.cevapla(0); await o.cevapla(1); } await z.cevapla(0);
  const r = await api("ilerleme", { cookie: a.cookie, govde: {} }); assert.equal(r.s, 200); assert.deepEqual(r.j, { bekleyen: 0 });
  assert.equal(toplam(await stats(a.tok)), 4); assert.equal(await stats(b.tok), undefined, "B'nin cevabı A'nın çağrısıyla işlenmedi");
  assert.equal((await api("ilerleme", { cookie: a.cookie, govde: {} })).s, 200); assert.equal(toplam(await stats(a.tok)), 4);
  assert.equal((await api("ilerleme", { cookie: b.cookie, govde: {} })).s, 200); assert.equal(toplam(await stats(b.tok)), 1);
});
test("B9) süpürme çok oturumda 'bekleyen' sayısını döner; tekrar çağrıyla biter", async () => {
  const c = await kullanici("esam-b9@ornek.com");
  for (let i = 0; i < 7; i++) { const s = await cevapla(c, 1); await s.cevapla(0); await s.bitir(); }
  const r1 = await api("ilerleme", { cookie: c.cookie, govde: {} }); assert.equal(r1.j.bekleyen, 2);
  const r2 = await api("ilerleme", { cookie: c.cookie, govde: {} }); assert.equal(r2.j.bekleyen, 0);
  assert.equal(toplam(await stats(c.tok)), 7);
});
