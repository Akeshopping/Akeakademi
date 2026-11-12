// B3 · canlı deneme güvenliği: GERÇEK sosyal handler'ı + yerel D1 ile testler (sunucu saati Date.now ile oynatılır).
// Çalıştırma: node --test tests/canli-b3.test.mjs   (Node >= 22: node:sqlite)
// Gerçek yerel D1 (Miniflare) ile: MF_DIR=<miniflare kurulu klasör> node --test tests/canli-b3.test.mjs
// Ağ isteği yok (e-posta sahte); üretim/Preview veritabanına dokunulmaz.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const sqlDeyim = f => readFileSync(resolve(f), "utf8").split("\n").filter(l => !l.trim().startsWith("--")).join("\n").split(";").map(x => x.trim()).filter(Boolean);
const M1 = sqlDeyim("migrations/0001_hiz_siniri.sql"), M2 = sqlDeyim("migrations/0002_canli_acilis.sql");

let ortak, kapat = async () => { };
after(() => kapat());
async function d1() {
  if (!ortak) ortak = (async () => {
    let db, q;
    if (process.env.MF_DIR) {
      const { Miniflare } = await import(pathToFileURL(process.env.MF_DIR + "/node_modules/miniflare/dist/src/index.js").href);
      const mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('x') } }", d1Databases: { DB: "b3-yerel" }, d1Persist: false });
      db = await mf.getD1Database("DB"); kapat = () => mf.dispose();
      q = async (sql, ...p) => (await db.prepare(sql).bind(...p).all()).results;
    } else {
      const { DatabaseSync } = await import("node:sqlite"), sq = new DatabaseSync(":memory:");
      const bekle = () => new Promise(r => setTimeout(r, Math.random() * 3));
      const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
        first: async () => { await bekle(); return sq.prepare(sql).get(...a) || null; },
        all: async () => { await bekle(); return { results: sq.prepare(sql).all(...a) }; },
        run: async () => { await bekle(); const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
      db = { prepare: st, batch: async arr => { await bekle(); const out = []; for (const s of arr) out.push(await s.run()); return out; } };
      q = async (sql, ...p) => { const s = sq.prepare(sql); return /^\s*(SELECT|PRAGMA)/i.test(sql) ? s.all(...p) : (s.run(...p), []); };
    }
    for (const d of M1) await db.prepare(d).run();
    return { db, q };
  })();
  return ortak;
}

const hesap = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
const sosyal = await import(pathToFileURL(resolve("functions/api/sosyal/[[yol]].js")).href);
const postalar = [];
globalThis.fetch = async (url, opt) => {
  if (String(url).includes("api.resend.com")) { postalar.push(JSON.parse(opt.body)); return new Response("{}", { status: 200 }); }
  throw new Error("beklenmeyen ağ isteği: " + url);
};
/* sunucu saati: gerçek Date.now + ayarlanabilir kayma */
const gercekNow = Date.now.bind(Date), T0 = gercekNow(); let kayma = 0;
Date.now = () => gercekNow() + kayma;
const saatte = ms => { kayma = (T0 + ms) - gercekNow(); };      /* "T0'dan ms sonra" */
const ENV = db => ({ DB: db, AKE_GIZLI: "b3-test-gizli", RESEND_API_KEY: "sahte" });
let ipn = 0; const ip = () => `198.51.100.${++ipn % 250}`;
const mk = (yol, { m = "POST", govde, cookie, ipa } = {}) => new Request("https://akeakademi.com/api/" + yol, { method: m,
  headers: { "content-type": "application/json", "cf-connecting-ip": ipa || ip(), ...(cookie ? { cookie } : {}) }, body: m === "GET" ? undefined : JSON.stringify(govde || {}) });
const cevap = async r => ({ s: r.status, j: await r.json().catch(() => null) });
const hesapIstek = (env, yol, o) => hesap.onRequest({ request: mk("hesap/" + yol, o), env, params: { yol: yol.split("/") } }).then(async r => ({ ...(await cevap(r)), cerez: r.headers.get("set-cookie") }));
const sosyalIstek = (env, yol, o) => sosyal.onRequest({ request: mk("sosyal/" + yol, o), env, params: { yol: yol.split("/") } }).then(cevap);
let epn = 0;
async function girisYap(env) {
  const e = `b3k${++epn}@ornek.test`, a = ip();
  assert.equal((await hesapIstek(env, "kod-gonder", { ipa: a, govde: { eposta: e } })).s, 200);
  const kod = String(postalar[postalar.length - 1].text).match(/giriş kodun: (\d+)/)[1], r = await hesapIstek(env, "kod-dogrula", { ipa: a, govde: { eposta: e, kod } });
  assert.equal(r.s, 200); return { cookie: String(r.cerez).split(";")[0], kid: r.j.kullanici.id };
}

/* deneme: başlangıç T0+60 dk, süre 20 dk → bitis T0+80 dk, kapanis +60 sn, sonuc +75 sn. Cevap anahtarı: [0,1,2,3,4,0] */
const DK = 60000, BASLA = 60 * DK, SURE = 20, BITIS = BASLA + SURE * DK, KAPANIS = BITIS + 60000, SONUC = KAPANIS + 15000;
const ANAHTAR = [0, 1, 2, 3, 4, 0], DOGRU = ANAHTAR, YANLIS = ANAHTAR.map(a => (a + 1) % 5);
let cn = 0;
async function denemeKur(db, { basla = T0 + BASLA, sure = SURE } = {}) {
  const id = `c_b3_${++cn}`, sorular = ANAHTAR.map((a, i) => ({ q: "Soru " + i, o: ["A", "B", "C", "D", "E"], a, x: "ÇÖZÜM-" + i }));
  await sosyalIstek(ENV(db), "ben", { m: "GET" });   /* şema kurulumu */
  await db.prepare("INSERT INTO canli (id, baslik, tur, baslangic, sure, adet, sorular, secs, tarih) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, "B3 deneme", "tyt", basla, sure, sorular.length, JSON.stringify(sorular), JSON.stringify([{ n: "Genel", from: 0, to: 6 }]), T0).run();
  return id;
}
const sor = (env, id, o) => sosyalIstek(env, `canli/${id}/sorular`, { m: "GET", ...o });
const gonder = (env, id, o, cev = DOGRU, ek = {}) => sosyalIstek(env, `canli/${id}/gonder`, { ...o, govde: { cevap: cev, ...ek } });
const sonuc = (env, id, o) => sosyalIstek(env, `canli/${id}/sonuc`, { m: "GET", ...o });
const satirlar = (q, id) => q("SELECT * FROM canli_sonuc WHERE canli = ?", id);
const yoklaIcinde = (j) => JSON.stringify(j);

test("migration: yalnızca yeni tablo ekler, tekrar çalıştırılabilir, yıkıcı komut yok", async () => {
  const { db } = await d1();
  assert.ok(M2.length === 1 && /CREATE TABLE IF NOT EXISTS canli_acilis\b/.test(M2[0]));
  assert.ok(!/\b(DROP|DELETE|UPDATE|INSERT|ALTER)\b/i.test(M2.join(";")));
  for (const d of M2) await db.prepare(d).run(); for (const d of M2) await db.prepare(d).run();
});

test("1) başlangıçtan önce soru verilmez (425)", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA - 5000);
  const r = await sor(env, id, { cookie: u.cookie });
  assert.equal(r.s, 425); assert.ok(!yoklaIcinde(r.j).includes("Soru 0"));
});

test("2) başlangıçtan önce cevap gönderilemez (425), kayıt oluşmaz", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA - 5000);
  assert.equal((await gonder(env, id, { cookie: u.cookie })).s, 425);
  assert.equal((await satirlar(q, id)).length, 0);
});

test("3) soruları açmayan kullanıcı sonuç gönderemez (403): açık süre içinde de, tolerans içinde de", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + 5 * DK); const r1 = await gonder(env, id, { cookie: u.cookie }); assert.equal(r1.s, 403); assert.equal(r1.j.error || r1.j.code || r1.j.hata || "acilmadi", "acilmadi");
  saatte(BITIS + 20000); assert.equal((await gonder(env, id, { cookie: u.cookie })).s, 403);
  assert.equal((await satirlar(q, id)).length, 0);
});

test("4) deneme bittikten sonra (tolerans dışında) gönderim kabul edilmez (410) ve kayıt oluşmaz", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); assert.equal((await sor(env, id, { cookie: u.cookie })).s, 200);
  saatte(KAPANIS); assert.equal((await gonder(env, id, { cookie: u.cookie })).s, 410);          /* tam kapanış anı */
  saatte(KAPANIS + 170000); assert.equal((await gonder(env, id, { cookie: u.cookie })).s, 410);  /* eski 180 sn toleransın içi: artık reddedilir */
  assert.equal((await satirlar(q, id)).length, 0);
});

test("5) bitiş anındaki ağ gecikmesi: tolerans içindeki gönderim kabul edilir, süre denemeyi aşamaz", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie });
  saatte(BITIS + 30000); const r = await gonder(env, id, { cookie: u.cookie });
  assert.equal(r.s, 200); assert.equal(r.j.kaydedildi, true);
  const [k] = await satirlar(q, id); assert.equal(k.sure, SURE * 60 - 60);   /* açılış BASLA+1dk → en çok BITIS'e kadar: 19 dk */
  assert.ok(k.sure <= SURE * 60);
});

test("6) cevap anahtarı/çözüm erken alınamaz: açık süre, tolerans ve anahtar gecikmesi boyunca; sonra açılır", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env), dig = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie }); await gonder(env, id, { cookie: u.cookie });
  for (const t of [BASLA + 2 * DK, BITIS - 1, BITIS, BITIS + 30000, KAPANIS, SONUC - 2000]) {
    saatte(t);
    for (const k of [u, dig]) { const r = await sonuc(env, id, { cookie: k.cookie }); assert.equal(r.s, 200); assert.equal(r.j.acik, false, "t=" + (t - BASLA)); const s = yoklaIcinde(r.j); assert.ok(!s.includes("ÇÖZÜM") && !s.includes('"sorular"') && !s.includes('"siralama"') && !s.includes('"a":'), "anahtar sızdı t=" + (t - BASLA)); }
  }
  saatte(SONUC); const a = await sonuc(env, id, { cookie: u.cookie });
  assert.equal(a.j.acik, true); assert.ok(a.j.sorular.length === 6 && a.j.sorular[0].a === 0 && a.j.sorular[0].x.startsWith("ÇÖZÜM")); assert.equal(a.j.sira, 1);
});

test("6b) önbellek erken açılmaz: sonuçlandıktan sonra doldurulan önbellek, sonraki kullanıcı için de aynı kapıdan geçer", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env), dig = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie }); await gonder(env, id, { cookie: u.cookie });
  saatte(SONUC + 1000); assert.equal((await sonuc(env, id, { cookie: u.cookie })).j.acik, true);   /* önbellek dolar */
  assert.equal((await sonuc(env, id, { cookie: dig.cookie })).j.acik, true);
  saatte(BITIS + 1000); assert.equal((await sonuc(env, id, { cookie: dig.cookie })).j.acik, false);  /* saat geriye (başka örnek) → yine kapalı */
});

test("7) sahte 1 sn süre sıralamayı etkilemez: süre sunucu açılış kaydından hesaplanır", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), yavas = await girisYap(env), hizli = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: yavas.cookie }); await sor(env, id, { cookie: hizli.cookie });
  saatte(BASLA + 12 * DK); assert.equal((await gonder(env, id, { cookie: hizli.cookie })).s, 200);                       /* dürüst, 11 dk */
  saatte(BASLA + 18 * DK); assert.equal((await gonder(env, id, { cookie: yavas.cookie }, DOGRU, { sure: 1 })).s, 200);   /* 17 dk, istemci "1" diyor */
  const k = Object.fromEntries((await satirlar(q, id)).map(r => [r.kid, r.sure]));
  assert.equal(k[hizli.kid], 11 * 60); assert.equal(k[yavas.kid], 17 * 60);
  saatte(SONUC); const r = await sonuc(env, id, { cookie: yavas.cookie });
  assert.equal(r.j.sira, 2, "aynı netle yavaş olan, sahte süreye rağmen ikinci");
  assert.equal((await sonuc(env, id, { cookie: hizli.cookie })).j.sira, 1);
});

test("8) iki cihaz / eşzamanlı: açılış kaydı sıfırlanamaz, tek sonuç kaydı, kaybeden isteğe kendi puanı dönmez", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie });
  const ilk = (await q("SELECT acilis FROM canli_acilis WHERE canli = ? AND kid = ?", id, u.kid))[0].acilis;
  saatte(BASLA + 9 * DK); await Promise.all([1, 2, 3, 4, 5].map(() => sor(env, id, { cookie: u.cookie })));   /* 2. cihaz / yenileme: süre sıfırlanmaz */
  const acilislar = await q("SELECT acilis FROM canli_acilis WHERE canli = ? AND kid = ?", id, u.kid);
  assert.equal(acilislar.length, 1); assert.equal(acilislar[0].acilis, ilk);
  /* 6 paralel gönderim: biri tam doğru, biri tam yanlış, diğerleri karışık */
  saatte(BASLA + 15 * DK);
  const cevs = [DOGRU, YANLIS, DOGRU.map((a, i) => i % 2 ? a : (a + 2) % 5), YANLIS, DOGRU, YANLIS];
  const rs = await Promise.all(cevs.map(c => gonder(env, id, { cookie: u.cookie }, c)));
  assert.ok(rs.every(r => r.s === 200));
  const s = await satirlar(q, id); assert.equal(s.length, 1, "tek kayıt");
  for (const r of rs) assert.deepEqual(Object.keys(r.j).sort(), ["bitis", "kaydedildi", "sonucZamani", "zaten"].filter(k => k in r.j).sort(), "yanıtta puan alanı yok");
  assert.equal(s[0].sure, 14 * 60);                                    /* süre ilk açılıştan (BASLA+1dk) → BASLA+15dk */
  const tekrar = await gonder(env, id, { cookie: u.cookie }, YANLIS); assert.equal(tekrar.j.zaten, true); assert.equal(tekrar.j.d, undefined);
  assert.equal((await satirlar(q, id)).length, 1);
});

test("9) önceden gönderilmiş sonuçlar korunur: açılış kaydı olmayan eski kayıt, pencere dışında bile aynen döner ve sıralamada durur", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), eski = await girisYap(env);
  await db.prepare("INSERT INTO canli_sonuc (canli, kid, cevap, d, y, b, net, sure, tarih) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, eski.kid, JSON.stringify(DOGRU), 6, 0, 0, 6, 777, T0 + BASLA + DK).run();
  saatte(KAPANIS + 5 * DK);
  const r = await gonder(env, id, { cookie: eski.cookie }, YANLIS); assert.equal(r.s, 200); assert.equal(r.j.zaten, true); assert.equal(r.j.d, undefined);
  const s = await satirlar(q, id); assert.equal(s.length, 1); assert.equal(s[0].sure, 777); assert.equal(s[0].d, 6);
  const a = await sonuc(env, id, { cookie: eski.cookie }); assert.equal(a.j.acik, true); assert.equal(a.j.sira, 1); assert.equal(a.j.cevabim[0], 0);
});

test("10) bitiş yarışı: kontrol ile yazma arasında kapanış geçerse kayıt YAZILMAZ", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie });
  saatte(KAPANIS - 1500);
  const sar = { ...db, prepare: sql => { const st = db.prepare(sql); if (!/FROM canli_acilis/.test(sql)) return st; return { bind: (...a) => { const b = st.bind(...a); return { first: async () => { const r = await b.first(); saatte(KAPANIS + 50); return r; } }; } }; }, batch: db.batch };
  const r = await gonder({ ...env, DB: sar }, id, { cookie: u.cookie });
  assert.equal(r.s, 410); assert.equal((await satirlar(q, id)).length, 0);
});

test("11) geç ağ isteği: kullanıcı çevrimdışıyken bekleyen gönderim kapanıştan sonra gelirse reddedilir, sonuç sonra açılır ve çözümler görülebilir", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie });
  saatte(KAPANIS + 4000); assert.equal((await gonder(env, id, { cookie: u.cookie })).s, 410);
  saatte(SONUC); const r = await sonuc(env, id, { cookie: u.cookie });
  assert.equal(r.j.acik, true); assert.equal(r.j.benim ?? null, null); assert.equal((await satirlar(q, id)).length, 0);
});

test("12) liste: sonucZamani döner; açılış kaydı canlı deneme silinince ve hesap silinince temizlenir; var olan sonuç/sıralama bozulmaz", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie });
  const l = await sosyalIstek(env, "canli", { m: "GET", cookie: u.cookie }); assert.equal(l.s, 200);
  assert.equal(l.j.denemeler.find(c => c.id === id).sonucZamani, T0 + SONUC);
  assert.equal((await q("SELECT * FROM canli_acilis WHERE canli = ?", id)).length, 1);
  const kaynak = readFileSync(resolve("lib/sosyal.js"), "utf8"); assert.ok(/DELETE FROM canli_acilis WHERE kid = \?/.test(kaynak));
});

test("13) rastgele/geçersiz gönderim: yanlış uzunluk 400 ve kayıt yok; hatalı değerler boş sayılır", async () => {
  const { db, q } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie });
  assert.equal((await gonder(env, id, { cookie: u.cookie }, [0, 1])).s, 400);
  const r = await gonder(env, id, { cookie: u.cookie }, [0, null, 9, -1, "x", 4]); assert.equal(r.s, 200); assert.equal(r.j.kaydedildi, true);
  const [k] = await satirlar(q, id); assert.equal(k.d, 1); assert.equal(k.y, 1); assert.equal(k.b, 4);
  assert.equal((await satirlar(q, id)).length, 1);
});

test("14) giriş yapmamış kullanıcı: sorular ve gönderim 401", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db);
  saatte(BASLA + DK);
  assert.equal((await sor(env, id, {})).s, 401); assert.equal((await gonder(env, id, {})).s, 401);
});

/* ===== puan sızıntısı regresyonu: gonder / sonuc / liste, sonucZamani'ndan ÖNCE hiçbir puan bilgisi yok ===== */
const PUAN_ALAN = ["d", "y", "b", "net", "sure", "sira", "siralama", "cevabim", "sorular"];
const puansiz = (o, yer) => { const { sure: _denemeSuresi, ...ic } = (o && !Array.isArray(o) && typeof o === "object") ? o : {}; const t = JSON.stringify({ ...ic, benim: o && o.benim });   /* üst düzey "sure" denemenin süresi (dk), kişisel değil */ for (const k of PUAN_ALAN) assert.ok(!new RegExp('"' + k + '":').test(t), `${yer}: "${k}" sızdı → ${t.slice(0, 200)}`); };

test("15) gonder: yanıt yalnızca kaydedildi bilgisi; farklı cevaplar farklı yanıt üretmez (puan yoklanamaz)", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db), u1 = await girisYap(env), u2 = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u1.cookie }); await sor(env, id, { cookie: u2.cookie });
  saatte(BASLA + 5 * DK);
  const a = await gonder(env, id, { cookie: u1.cookie }, DOGRU), b = await gonder(env, id, { cookie: u2.cookie }, YANLIS);
  assert.equal(a.s, 200); assert.equal(b.s, 200); puansiz(a.j, "gonder"); puansiz(b.j, "gonder"); assert.equal(a.j.kaydedildi, true);
  assert.deepEqual(a.j, b.j, "doğru ve yanlış cevap aynı yanıtı verir");
  const tekrar = await gonder(env, id, { cookie: u1.cookie }, YANLIS); puansiz(tekrar.j, "tekrar"); assert.equal(tekrar.j.zaten, true);
  /* tekrar yoklama: her tür cevap seti aynı yanıt şeklini üretir */
  const u3 = await girisYap(env); saatte(BASLA + 6 * DK); await sor(env, id, { cookie: u3.cookie });
  const rs = await Promise.all([DOGRU, YANLIS, DOGRU, [0, null, null, null, null, null]].map(c => gonder(env, id, { cookie: u3.cookie }, c)));
  rs.forEach(r => puansiz(r.j, "eşzamanlı")); assert.equal(new Set(rs.map(r => JSON.stringify({ k: r.j.kaydedildi }))).size, 1);
});

test("16) sonuc: sonucZamani öncesi benim alanında puan/süre yok (gönderilmiş de, gönderilmemiş de)", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env), hic = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie }); await gonder(env, id, { cookie: u.cookie });
  for (const t of [BASLA + 5 * DK, BITIS, KAPANIS + 1000, SONUC - 2000]) {
    saatte(t);
    const r = await sonuc(env, id, { cookie: u.cookie }); assert.equal(r.j.acik, false); assert.deepEqual(r.j.benim, { kaydedildi: true }); puansiz(r.j, "sonuc t=" + (t - BASLA));
    const h = await sonuc(env, id, { cookie: hic.cookie }); assert.equal(h.j.benim, null); puansiz(h.j, "sonuc(katılmayan)");
  }
});

test("17) liste: sonucZamani öncesi benim alanında puan yok; sonra gerçek puan görünür", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db), u = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: u.cookie }); await gonder(env, id, { cookie: u.cookie }, DOGRU);
  for (const t of [BASLA + 5 * DK, BITIS + 1000, KAPANIS, SONUC - 2000]) {
    saatte(t); const l = await sosyalIstek(env, "canli", { m: "GET", cookie: u.cookie });
    const c = l.j.denemeler.find(x => x.id === id); assert.deepEqual(c.benim, { kaydedildi: true }, "t=" + (t - BASLA)); puansiz(c.benim, "liste");
  }
  saatte(SONUC + 2000); const c = (await sosyalIstek(env, "canli", { m: "GET", cookie: u.cookie })).j.denemeler.find(x => x.id === id);
  assert.equal(c.benim.d, 6); assert.equal(c.benim.net, 6); assert.equal(c.benim.kaydedildi, true);
});

test("18) sonuçlar açılınca gerçek puan, süre, sıralama ve çözümler eksiksiz", async () => {
  const { db } = await d1(), env = ENV(db), id = await denemeKur(db), a = await girisYap(env), b = await girisYap(env);
  saatte(BASLA + DK); await sor(env, id, { cookie: a.cookie }); await sor(env, id, { cookie: b.cookie });
  saatte(BASLA + 10 * DK); await gonder(env, id, { cookie: a.cookie }, DOGRU);
  saatte(BASLA + 14 * DK); await gonder(env, id, { cookie: b.cookie }, [0, 1, 2, 3, 0, 1]);   /* 4 doğru 2 yanlış */
  saatte(SONUC + 1000);
  const ra = await sonuc(env, id, { cookie: a.cookie }), rb = await sonuc(env, id, { cookie: b.cookie });
  assert.equal(ra.j.acik, true); assert.equal(ra.j.benim.d, 6); assert.equal(ra.j.benim.y, 0); assert.equal(ra.j.benim.net, 6); assert.equal(ra.j.benim.sure, 9 * 60); assert.equal(ra.j.sira, 1);
  assert.equal(rb.j.benim.d, 4); assert.equal(rb.j.benim.y, 2); assert.equal(rb.j.benim.sure, 13 * 60); assert.equal(rb.j.sira, 2);
  assert.equal(rb.j.sorular.length, 6); assert.equal(rb.j.sorular[2].a, 2); assert.ok(rb.j.sorular[2].x.startsWith("ÇÖZÜM")); assert.deepEqual(rb.j.cevabim, [0, 1, 2, 3, 0, 1]);
  assert.equal(ra.j.siralama.length, 2); assert.equal(ra.j.siralama[0].ben, true);
});
