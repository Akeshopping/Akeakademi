// Deneme (exam) sonucunun Gelişim geçmişine kaydı · GERÇEK sunucu koduyla (node:sqlite)
//   stats: her soru doğru/yanlış/boş (web finishRun record() ile aynı), exams: tek özet kaydı "m:<oturum>".
//   Çift sayım koruması: aynı oturum tekrar işlenirse, eşzamanlı işlenirse, kısmi hata sonrası yeniden denenirse hiçbir şey ikinci kez sayılmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, tohumla } from "./yardim/soru-v2.mjs";

const T = await kur();
const { giris, api, yeniIstek, DB } = T;
await T.hazirla();
tohumla(DB, 80, { onek: "m", s: "mat", konular: ["Sayılar"], zorluklar: [1, 2, 3] });
const { onRequest } = await import("../functions/api/hesap/[[yol]].js");
let ipn = 0;
const cagir = (tok, yontem, yol, govde) => onRequest({ request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: yontem, headers: { "content-type": "application/json", authorization: "Bearer " + tok, "cf-connecting-ip": "10.9." + (++ipn >> 8) + "." + (ipn & 255) }, body: govde ? JSON.stringify(govde) : undefined }), env: T.env, params: { yol: yol.split("/") } });
const kullanici = async e => { const g = await giris(e); T.premiumYap(g.kid); return { cookie: g.cookie, kid: g.kid, tok: decodeURIComponent(/^ake_s=([^;]*)/.exec(g.cookie)[1]) }; };
const alanlar = async tok => (await (await cagir(tok, "GET", "veri")).json()).alanlar;
const topSay = st => (st && st.topic && st.topic["mat|Sayılar"]) || [0, 0, 0];

async function deneme(c, n, secimler) {
  const o = await api("oturum", { cookie: c.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: n, ders: "mat" } });
  assert.equal(o.s, 200);
  for (const [i, secim] of secimler.entries()) if (secim !== null) assert.equal((await api("cevap", { cookie: c.cookie, govde: { oturum: o.j.oturum, soru: o.j.sorular[i].id, secim } })).s, 200);
  return o.j.oturum;
}
const bitir = (c, oturum) => api("bitir", { cookie: c.cookie, govde: { oturum } });
const ilerle = (c, oturum) => api("ilerleme", { cookie: c.cookie, govde: { oturum, tz: 180 } });
const olaySay = (kid, oturum) => DB.db.prepare("SELECT COUNT(*) n FROM ilerleme_olay WHERE kid = ? AND oturum = ?").get(kid, oturum).n;

test("1) açık deneme işlenmez (409); bitince stats (doğru/yanlış/boş) + exams özeti yazılır; web alanları korunur", async () => {
  const c = await kullanici("dg1@ornek.com");
  await cagir(c.tok, "PUT", "veri/stats", { _u: 1000, ans: { x: [1] }, badges: { ilk: 1 }, topic: { "mat|Sayılar": [5, 2, 0] } });
  const oturum = await deneme(c, 5, [0, 1, 2, null, null]);   // 3 cevap, 2 boş
  const acik = await ilerle(c, oturum); assert.equal(acik.s, 409); assert.equal(acik.j.error, "oturum_acik");
  assert.deepEqual(topSay((await alanlar(c.tok)).stats), [5, 2, 0], "açık deneme stats'a dokunmadı");
  const b = await bitir(c, oturum); assert.equal(b.s, 200);
  const d = b.j.dogru, y = b.j.yanlis, bos = b.j.bos;
  assert.equal(d + y + bos, 5); assert.equal(bos, 2);
  const r = await ilerle(c, oturum); assert.equal(r.s, 200); assert.deepEqual(r.j, { bekleyen: 0 });
  const A = await alanlar(c.tok);
  assert.deepEqual(topSay(A.stats), [5 + d, 2 + y, bos]);
  assert.deepEqual(A.stats.ans, { x: [1] }); assert.deepEqual(A.stats.badges, { ilk: 1 });
  const gun = Object.values(A.stats.daily)[0]; assert.equal(gun.q, d + y, "boşlar günlük çözülene sayılmaz (web gibi)");
  const e = A.exams.exams; assert.equal(e.length, 1);
  assert.equal(e[0].id, "m:" + oturum); assert.equal(e[0].kind, "exam"); assert.equal(e[0].mode, "exam"); assert.equal(e[0].src, "mobil");
  assert.deepEqual([e[0].d, e[0].y, e[0].b], [d, y, bos]); assert.equal(e[0].net, d - y / 4);
  assert.equal(olaySay(c.kid, oturum), 5, "boşlar dahil tüm sorular için olay satırı");
});

test("2) çift sayım yok: aynı oturum tekrar/eşzamanlı işlenince stats ve exams değişmez", async () => {
  const c = await kullanici("dg2@ornek.com");
  const oturum = await deneme(c, 4, [0, 1, 2, 3]); await bitir(c, oturum);
  await Promise.all([ilerle(c, oturum), ilerle(c, oturum), ilerle(c, oturum)]);
  const a1 = await alanlar(c.tok);
  assert.equal(a1.exams.exams.length, 1); assert.equal(topSay(a1.stats).reduce((x, z) => x + z, 0), 4);
  for (let i = 0; i < 3; i++) assert.equal((await ilerle(c, oturum)).s, 200);
  const a2 = await alanlar(c.tok);
  assert.deepEqual(a2.stats, a1.stats); assert.deepEqual(a2.exams, a1.exams);
  const sweep = await api("ilerleme", { cookie: c.cookie, govde: { tz: 180 } }); assert.deepEqual(sweep.j, { bekleyen: 0 });
  assert.deepEqual((await alanlar(c.tok)).stats, a1.stats, "süpürme de çift saymaz");
});

test("3) yanıtı kaybolan bitir + uygulama yeniden açıldı: oturumsuz süpürme bitmiş denemeyi toparlar (bir kez)", async () => {
  const c = await kullanici("dg3@ornek.com");
  const oturum = await deneme(c, 3, [0, 0, 0]); await bitir(c, oturum);
  const sweep = await api("ilerleme", { cookie: c.cookie, govde: { tz: 180 } }); assert.deepEqual(sweep.j, { bekleyen: 0 });
  const A = await alanlar(c.tok); assert.equal(A.exams.exams.length, 1); assert.equal(topSay(A.stats).reduce((x, z) => x + z, 0), 3);
});

test("4) kısmi hata: özet yazıldı ama stats yazılamadı → yeniden denemede özet ikinci kez eklenmez, stats bir kez işlenir", async () => {
  const c = await kullanici("dg4@ornek.com");
  const oturum = await deneme(c, 4, [0, 1, 2, 3]); await bitir(c, oturum);
  /* ilk çağrıyı stats yazımında bozan sahte: exams INSERT/UPDATE geçer, stats UPDATE'inde hata fırlat */
  const orijinal = T.env.DB.batch.bind(T.env.DB); let bozuldu = false;
  T.env.DB.batch = async (st) => { if (!bozuldu) { bozuldu = true; await orijinal(st.slice(0, 1)); throw new Error("sahte kesinti"); } return orijinal(st); };
  await assert.rejects(() => ilerle(c, oturum).then(r => { if (r.s >= 500) throw new Error("http " + r.s); return r; }));
  T.env.DB.batch = orijinal;
  assert.equal((await alanlar(c.tok)).exams.exams.length, 1, "özet yazıldı");
  assert.equal(olaySay(c.kid, oturum), 0, "stats henüz işlenmedi");
  assert.equal((await ilerle(c, oturum)).s, 200);
  const A = await alanlar(c.tok);
  assert.equal(A.exams.exams.length, 1, "özet çiftlenmedi"); assert.equal(topSay(A.stats).reduce((x, z) => x + z, 0), 4, "stats tam bir kez");
  assert.equal(olaySay(c.kid, oturum), 4);
});

test("5) başka hesabın denemesi işlenemez (404); pratik oturum davranışı değişmedi", async () => {
  const a = await kullanici("dg5a@ornek.com"), b = await kullanici("dg5b@ornek.com");
  const oturum = await deneme(a, 3, [0, 1, 2]); await bitir(a, oturum);
  assert.equal((await ilerle(b, oturum)).s, 404);
  assert.equal(((await alanlar(b.tok)).exams || { exams: [] }).exams.length, 0);
  const p = await api("oturum", { cookie: a.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 2, ders: "mat" } });
  await api("cevap", { cookie: a.cookie, govde: { oturum: p.j.oturum, soru: p.j.sorular[0].id, secim: 0 } });
  const sayi = async () => ((await alanlar(a.tok)).exams || { exams: [] }).exams.length, before = await sayi();
  assert.equal((await ilerle(a, p.j.oturum)).s, 200);
  assert.equal(await sayi(), before, "pratik exams özeti üretmez");
});

test("6) mevcut web exams belgesi korunur; 60 kayıt sınırı; özet eski kayıtların sonuna eklenir", async () => {
  const c = await kullanici("dg6@ornek.com");
  const eski = Array.from({ length: 60 }, (_, i) => ({ id: "w" + i, kind: "exam", date: i, net: i, d: 1, y: 0, b: 0 }));
  await cagir(c.tok, "PUT", "veri/exams", { _u: 1000, exams: eski, ozel: "korunur" });
  const oturum = await deneme(c, 3, [0, 1, 2]); await bitir(c, oturum); await ilerle(c, oturum);
  const A = await alanlar(c.tok);
  assert.equal(A.exams.exams.length, 60); assert.equal(A.exams.exams[59].id, "m:" + oturum); assert.equal(A.exams.exams[0].id, "w1");
  assert.equal(A.exams.ozel, "korunur");
});

test("7) hesap silinince soru oturumları, oturum soruları ve ilerleme olayları da silinir; başka kullanıcınınki kalır", async () => {
  const a = await kullanici("sil-a@ornek.com"), b = await kullanici("sil-b@ornek.com");
  const oa = await deneme(a, 3, [0, 1, null]), ob = await deneme(b, 3, [0, 1, null]);
  for (const [c, o] of [[a, oa], [b, ob]]) { assert.equal((await bitir(c, o)).s, 200); assert.equal((await ilerle(c, o)).s, 200); }
  const say = (kid, oturum) => ({
    so: DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum WHERE kid = ?").get(kid).n,
    sos: DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum_soru WHERE oturum = ?").get(oturum).n,
    io: DB.db.prepare("SELECT COUNT(*) n FROM ilerleme_olay WHERE kid = ?").get(kid).n
  });
  assert.ok(say(a.kid, oa).so > 0 && say(a.kid, oa).sos > 0 && say(a.kid, oa).io > 0, "silmeden önce veri var");
  assert.equal((await cagir(a.tok, "POST", "sil", {})).status, 200);
  assert.deepEqual(say(a.kid, oa), { so: 0, sos: 0, io: 0 }, "silinen hesabın soru verisi kalmadı");
  const kalan = say(b.kid, ob);
  assert.ok(kalan.so > 0 && kalan.sos > 0 && kalan.io > 0, "başka kullanıcının verisine dokunulmadı");
  assert.equal((await cagir(a.tok, "GET", "ben")).status, 401, "silinen hesabın anahtarı çalışmaz");
});
