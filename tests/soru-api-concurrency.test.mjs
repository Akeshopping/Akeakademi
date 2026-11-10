// Soru API (PR 2) · kota + oturum ATOMİKLİĞİ, eşzamanlılık, hata enjeksiyonu, seçim ölçeği · çalıştırma: node --test tests/soru-api-concurrency.test.mjs
// Kabuk: batch = tek işlem (hata → ROLLBACK), her okuma/yazma bir tick bekler → Promise.all istekleri gerçekten iç içe geçer.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, tohumla, d1 } from "./yardim/soru-v2.mjs";
import { soruSec, SEMA_SQL, UYGUN } from "../lib/soru-api.js";
import { soruKanonikSema } from "../lib/soru-kanonik.js";

const T = await kur(), { DB, api, giris, yeniIstek, hesapKota } = T;
await T.hazirla(); tohumla(DB, 600, { onek: "c", s: "mat", konular: ["K1", "K2", "K3"] });
let e = 0; const yeni = async (paket) => { const k = await giris(`kota${++e}@ornek.com`); if (paket) T.premiumYap(k.kid); return k; };
const oturumAc = (k, g) => api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "practice", adet: 20, ders: "mat", ...g } });
const sayac = async (k, tur) => { const r = await T.hesapKota(k.cookie, tur, 1).catch(() => null); return r; };
/* kota sayacı (kimlik tablosu) — kullanıcı hesabından HMAC ile */
import { kotaKimligiEposta } from "../lib/kota.js";
async function kullanim(k, tur) {
  const eposta = DB.db.prepare("SELECT eposta FROM kullanici WHERE id = ?").get(k.kid).eposta, kimlik = await kotaKimligiEposta(T.env, eposta);
  const r = DB.db.prepare("SELECT adet FROM ucretsiz_kimlik WHERE kimlik = ? AND tur = ? ORDER BY donem DESC LIMIT 1").get(kimlik, tur);
  return r ? r.adet : 0;
}
const oturumlar = k => DB.db.prepare("SELECT * FROM soru_oturum WHERE kid = ?").all(k.kid);
const soruSayisi = k => DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum_soru WHERE oturum IN (SELECT id FROM soru_oturum WHERE kid = ?)").get(k.kid).n;
/* DEĞİŞMEZ: sayaç artışı == oturumların kota_verilen toplamı; 'hazirlaniyor' kalıcı olamaz; her açık oturumun soru sayısı == adet */
async function tutarli(k, tur, beklenenSayac, onceden = 0) {   // onceden: eski uçla (oturumsuz) harcanan hak
  const os = oturumlar(k).filter(o => o.kota_tur === tur);
  assert.equal((await kullanim(k, tur)) - onceden, os.reduce((t, o) => t + o.kota_verilen, 0), "sayaç ≠ verilen hak toplamı");
  if (beklenenSayac !== undefined) assert.equal(await kullanim(k, tur), beklenenSayac);
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum WHERE durum NOT IN ('acik','bitti','iptal')").get().n, 0, "yarım (hazirlaniyor) oturum kalmış");
  for (const o of oturumlar(k)) assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum_soru WHERE oturum = ?").get(o.id).n, o.adet, "oturum soru sayısı ≠ adet");
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum_soru WHERE oturum NOT IN (SELECT id FROM soru_oturum)").get().n, 0, "sahipsiz soru satırı");
}

/* ---- 21-25 kota ---- */
test("21) ücretsiz: günde 20 soru; 25 istenirse 20 verilir; sonrası 402", async () => {
  const k = await yeni(), r = await oturumAc(k, { adet: 25 });
  assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 20); assert.deepEqual(r.j.kota, { tur: "soru", limit: 20, kalan: 0 });
  const r2 = await oturumAc(k, { adet: 5 }); assert.equal(r2.s, 402); assert.equal(r2.j.error, "limit");
  assert.equal(oturumlar(k).length, 1); await tutarli(k, "soru", 20);
  assert.equal((await hesapKota(k.cookie, "soru", 1)).s, 402);   // eski uç aynı sayacı görür
});
test("22) 7 hak kaldıysa oturum yalnız 7 soru içerir", async () => {
  const k = await yeni(); assert.equal((await hesapKota(k.cookie, "soru", 13)).j.verildi, 13);
  const r = await oturumAc(k, { adet: 20 }); assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 7); assert.equal(r.j.adet, 7); assert.equal(r.j.kota.kalan, 0);
  await tutarli(k, "soru", 20, 13); assert.equal(oturumlar(k)[0].kota_verilen, 7);
});
test("23) deneme: ayda 1; 80 soruluk sınav tek deneme harcar, soru sayacına dokunmaz; ikincisi 402 ve oturum oluşmaz", async () => {
  const k = await yeni(), r = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 80, ders: "mat" } });
  assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 80); assert.deepEqual(r.j.kota, { tur: "deneme", limit: 1, kalan: 0 });
  assert.equal(await kullanim(k, "deneme"), 1); assert.equal(await kullanim(k, "soru"), 0);
  const r2 = await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 80, ders: "mat" } });
  assert.equal(r2.s, 402); assert.equal(oturumlar(k).length, 1); await tutarli(k, "deneme", 1);
  assert.equal((await oturumAc(k, { adet: 20 })).s, 200);    // soru hakkı ayrı havuz
});
test("24) ücretli: kota tüketilmez (sayaç satırı hiç artmaz), 50'lik oturumlar arka arkaya açılır", async () => {
  const k = await yeni(true);
  for (let i = 0; i < 6; i++) { const r = await oturumAc(k, { adet: 50 }); assert.equal(r.s, 200); assert.deepEqual(r.j.kota, { sinirsiz: true }); await api("bitir", { cookie: k.cookie, govde: { oturum: r.j.oturum } }); }
  assert.equal(await kullanim(k, "soru"), 0); assert.ok(oturumlar(k).every(o => o.kota_verilen === 0 && o.kota_tur === null));
  assert.equal((await api("oturum", { cookie: k.cookie, govde: { istek: yeniIstek(), mod: "exam", adet: 120, ders: "mat" } })).s, 200); assert.equal(await kullanim(k, "deneme"), 0);
});

/* ---- 26-28 eşzamanlılık ---- */
test("26) paralel 20+20 (ücretsiz): toplam soru ≤ 20, sayaç ≤ 20, grant'lar birebir", async () => {
  for (let tur = 0; tur < 15; tur++) {
    const k = await yeni(), [a, b] = await Promise.all([oturumAc(k, { adet: 20 }), oturumAc(k, { adet: 20 })]);
    const toplam = [a, b].reduce((t, r) => t + (r.s === 200 ? r.j.sorular.length : 0), 0);
    assert.ok(toplam <= 20, `toplam ${toplam}`); assert.equal(toplam, 20); assert.deepEqual([a.s, b.s].sort(), [200, 402]);
    assert.equal(soruSayisi(k), toplam); await tutarli(k, "soru", 20);
  }
});
test("26b) 7 hak kaldı, paralel 10+10: toplam ≤ 7; 5 paralel istek de aşmaz", async () => {
  for (let tur = 0; tur < 10; tur++) {
    const k = await yeni(); await hesapKota(k.cookie, "soru", 13);
    const rs = await Promise.all([oturumAc(k, { adet: 10 }), oturumAc(k, { adet: 10 })]);
    const toplam = rs.reduce((t, r) => t + (r.s === 200 ? r.j.sorular.length : 0), 0);
    assert.ok(toplam <= 7); assert.equal(toplam, 7); assert.equal(soruSayisi(k), 7); await tutarli(k, "soru", 20, 13);
  }
  const k = await yeni(); const rs = await Promise.all([1, 2, 3].map(() => oturumAc(k, { adet: 20 })));   // 3 açık sınırı içinde 3 paralel
  assert.ok(rs.reduce((t, r) => t + (r.s === 200 ? r.j.sorular.length : 0), 0) <= 20); await tutarli(k, "soru");
});
test("27) paralel iki sınav isteği: yalnız biri deneme hakkı alır, diğeri 402 ve aktif sınav oturumu oluşmaz", async () => {
  for (let tur = 0; tur < 10; tur++) {
    const k = await yeni(), g = () => ({ istek: yeniIstek(), mod: "exam", adet: 40, ders: "mat" });
    const rs = await Promise.all([api("oturum", { cookie: k.cookie, govde: g() }), api("oturum", { cookie: k.cookie, govde: g() })]);
    assert.deepEqual(rs.map(r => r.s).sort(), [200, 402]); assert.equal(oturumlar(k).filter(o => o.durum === "acik" && o.mod === "exam").length, 1);
    assert.equal(soruSayisi(k), 40); await tutarli(k, "deneme", 1);
  }
});
test("28) aynı istek kimliği 5 kez paralel: tek oturum, tek kota rezervasyonu, hepsi aynı oturumu görür", async () => {
  for (const mod of ["practice", "exam"]) {
    const k = await yeni(), g = { istek: yeniIstek(), mod, adet: 12, ders: "mat" };
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => api("oturum", { cookie: k.cookie, govde: g })));
    assert.ok(rs.every(r => r.s === 200), rs.map(r => r.s).join()); assert.equal(new Set(rs.map(r => r.j.oturum)).size, 1);
    assert.equal(oturumlar(k).length, 1); assert.equal(soruSayisi(k), 12);
    await tutarli(k, mod === "practice" ? "soru" : "deneme", mod === "practice" ? 12 : 1);
    const ids = rs.map(r => r.j.sorular.map(q => q.id).join()); assert.equal(new Set(ids).size, 1);   // aynı soru listesi
  }
});
test("31) yanıt kaybı: istek tamamlandı ama istemci yanıtı alamadı → aynı istek tekrarı aynı oturumu verir, ikinci kota harcanmaz", async () => {
  const k = await yeni(), g = { istek: yeniIstek(), mod: "practice", adet: 9, ders: "mat" };
  await api("oturum", { cookie: k.cookie, govde: g });                      // yanıt atılır (bağlantı koptu)
  assert.equal(await kullanim(k, "soru"), 9);
  const r = await api("oturum", { cookie: k.cookie, govde: g });
  assert.equal(r.s, 200); assert.equal(r.j.sorular.length, 9); assert.equal(await kullanim(k, "soru"), 9); assert.equal(oturumlar(k).length, 1);
  assert.equal(r.j.oturum, oturumlar(k)[0].id); await tutarli(k, "soru", 9);
});

/* ---- 29-30 hata enjeksiyonu ---- */
test("29-30) batch'in HER noktasında hata: hiçbir iz kalmaz (kota dahil), aynı istek tekrarında tek grant tamamlanır", async () => {
  for (const [mod, adet, ifade, tur] of [["practice", 11, 5, "soru"], ["exam", 30, 5, "deneme"]]) {
    for (let konum = 0; konum <= ifade; konum++) {
      const k = await yeni(), g = { istek: yeniIstek(), mod, adet, ders: "mat" };
      DB.hook.hedef = /INSERT INTO soru_oturum \(/; DB.hook.konum = konum;
      const r = await api("oturum", { cookie: k.cookie, govde: g });
      assert.equal(r.s, 503, `${mod}@${konum}`); assert.equal(r.j.error, "gecici"); assert.ok(!r.t.includes("enjekte"));   // iç hata sızmaz
      assert.equal(oturumlar(k).length, 0, `${mod}@${konum}: oturum kalmış`); assert.equal(soruSayisi(k), 0); assert.equal(await kullanim(k, tur), 0, `${mod}@${konum}: hak kaybolmuş/artmış`);
      DB.hook.hedef = null;
      const t = await api("oturum", { cookie: k.cookie, govde: g });                      // retry: aynı istek
      assert.equal(t.s, 200, `${mod}@${konum} retry`); assert.equal(oturumlar(k).length, 1); await tutarli(k, tur, tur === "soru" ? adet : 1);
    }
  }
  /* ücretli yol (S1/S4 yok): 3 ifade */
  for (let konum = 0; konum <= 3; konum++) {
    const k = await yeni(true), g = { istek: yeniIstek(), mod: "practice", adet: 8 };
    DB.hook.hedef = /INSERT INTO soru_oturum \(/; DB.hook.konum = konum; assert.equal((await api("oturum", { cookie: k.cookie, govde: g })).s, 503);
    DB.hook.hedef = null; assert.equal(oturumlar(k).length, 0); assert.equal((await api("oturum", { cookie: k.cookie, govde: g })).s, 200); assert.equal(oturumlar(k).length, 1);
  }
});
test("B) oturum hazır, kota yarışı kaybedildi: işlem İÇİNDE sayaç başkasına gidince S5 doğrulaması TÜM batch'i geri alır; kotasız aktif oturum olmaz", async () => {
  const k = await yeni(), g = { istek: yeniIstek(), mod: "practice", adet: 10, ders: "mat" };
  const eposta = DB.db.prepare("SELECT eposta FROM kullanici WHERE id = ?").get(k.kid).eposta, kimlik = await kotaKimligiEposta(T.env, eposta);
  /* batch ifadeleri: 0 sayaç satırı, 1 oturum, 2 sorular, 3 sayaç artır, 4 doğrula. 3'ten önce (işlem içinde) sayacı 20'ye çıkar → S4 no-op, changes()=0 → NOT NULL → ROLLBACK */
  DB.hook.hedef = /INSERT INTO soru_oturum \(/;
  DB.hook.araSql = [3, `UPDATE ucretsiz_kimlik SET adet = 20 WHERE kimlik = '${kimlik}'`];
  const gerial0 = DB.sayac.geriAlma;
  const r = await api("oturum", { cookie: k.cookie, govde: g }); DB.hook.hedef = null;
  assert.equal(DB.sayac.geriAlma - gerial0, 1, "S5 doğrulaması batch'i geri almadı (yol çalışmadı)");
  /* geri alma enjekte UPDATE'i de geri aldı; ilk deneme iz bırakmadı, yeniden deneme (yeni batch) temiz geçer: tek oturum, tek grant */
  assert.equal(r.s, 200); assert.equal(oturumlar(k).length, 1); await tutarli(k, "soru", 10);
});
test("B2) okuma ile batch arasında kota başkasına tükenirse (işlem dışı): oturum açılmaz, 402, sayaç 20'yi aşmaz", async () => {
  const k = await yeni(), g = { istek: yeniIstek(), mod: "practice", adet: 10, ders: "mat" };
  const eposta = DB.db.prepare("SELECT eposta FROM kullanici WHERE id = ?").get(k.kid).eposta, kimlik = await kotaKimligiEposta(T.env, eposta);
  DB.hook.hedef = /INSERT INTO soru_oturum \(/;
  DB.hook.once = () => { DB.db.prepare("INSERT OR IGNORE INTO ucretsiz_kimlik (kimlik, donem, tur, adet) SELECT ?, MAX(donem), 'soru', 0 FROM ucretsiz_kimlik WHERE tur = 'soru' UNION ALL SELECT ?, date('now','+3 hours'), 'soru', 0 LIMIT 1").run(kimlik, kimlik); DB.db.prepare("UPDATE ucretsiz_kimlik SET adet = 20 WHERE kimlik = ? AND tur = 'soru'").run(kimlik); };
  const r = await api("oturum", { cookie: k.cookie, govde: g }); DB.hook.hedef = null;
  assert.equal(r.s, 402); assert.equal(oturumlar(k).length, 0); assert.equal(soruSayisi(k), 0); assert.equal(await kullanim(k, "soru"), 20);
});
test("C) uygun soru kalmadıysa: oturum açılmaz, hak harcanmaz", async () => {
  const k = await yeni(), g = { istek: yeniIstek(), mod: "practice", adet: 10, ders: "mat" };
  DB.db.prepare("UPDATE soru SET kopya_of = 'gecici' WHERE s = 'mat' AND kopya_of IS NULL").run();
  const r = await api("oturum", { cookie: k.cookie, govde: g });
  DB.db.prepare("UPDATE soru SET kopya_of = NULL WHERE kopya_of = 'gecici'").run();
  assert.equal(r.s, 503); assert.equal(r.j.error, "banka_yok"); assert.equal(oturumlar(k).length, 0); assert.equal(await kullanim(k, "soru"), 0);
});
test("C2) soru ekleme ortasında sorular uygunsuz kalırsa (işlem İÇİNDE): S5 sayı doğrulaması batch'i geri alır, yarım aktif oturum olmaz; yeniden denemede temiz oturum", async () => {
  const k = await yeni(), g = { istek: yeniIstek(), mod: "practice", adet: 10, ders: "mat" };
  DB.hook.hedef = /INSERT INTO soru_oturum \(/;
  DB.hook.araSql = [2, "UPDATE soru SET kopya_of = 'gecici2' WHERE id IN (SELECT id FROM soru WHERE s = 'mat' AND kopya_of IS NULL )"];   // S3'ten hemen önce: seçilenlerin hepsi uygunsuz kalır (deterministik)
  const gerial0 = DB.sayac.geriAlma;
  const r = await api("oturum", { cookie: k.cookie, govde: g }); DB.hook.hedef = null; DB.hook.araSql = null;
  assert.equal(DB.sayac.geriAlma - gerial0, 1, "S5 doğrulaması batch'i geri almadı (yol çalışmadı)");
  DB.db.prepare("UPDATE soru SET kopya_of = NULL WHERE kopya_of = 'gecici2'").run();
  /* ilk batch NOT NULL ile geri alındı (enjekte UPDATE dahil); yeniden deneme temiz tamamlandı */
  assert.equal(r.s, 200); assert.equal(oturumlar(k).length, 1); assert.equal(soruSayisi(k), 10); await tutarli(k, "soru", 10);
});

/* ---- 35-37 seçim ölçeği + EXPLAIN ---- */
test("35) 200k soruluk fixture: seçim sınırlı (LIMIT), indeksli, TEMP B-TREE yok, tüm banka JS'ye çekilmez", async () => {
  const B = d1(); await soruKanonikSema(B); await B.batch(SEMA_SQL.map(s => B.prepare(s)));
  const DERS = ["mat", "fizik", "kimya", "turkce", "tarih"], N = 200000;
  const ins = B.db.prepare("INSERT INTO soru (id, s, t, d, durum, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, ?, ?, ?, 'gomulu', ?, ?, ?, ?, ?, ?)");
  B.db.exec("BEGIN");
  for (let i = 0; i < N; i++) ins.run("n-" + i, DERS[i % 5], "T" + (i % 40), 1 + (i % 3), i % 7 === 0 ? "onayli" : "banka", Math.floor(Math.random() * 2147483647), "h" + i, '{"q":"q","o":["1","2","3","4","5"]}', i % 5, "x", i % 50 === 0 ? "n-1" : null);
  B.db.exec("COMMIT"); B.db.exec("ANALYZE");
  const kayit = [], cekilen = [];
  const sarma = { prepare: sql => { const st = B.prepare(sql); return { bind: (...a) => { const b = st.bind(...a); return { all: async () => { const r = await b.all(); kayit.push([sql, a]); cekilen.push(r.results.length); return r; } }; } }; } };
  for (const f of [{}, { ders: "mat" }, { ders: "mat", konu: "T5" }, { ders: "kimya", zorluk: [1, 3] }, { ders: "mat", konu: "T5", zorluk: [2] }, { zorluk: [2] }]) {
    kayit.length = 0; cekilen.length = 0;
    const t0 = Date.now(), rows = await soruSec({ DB: sarma }, f, 50); const ms = Date.now() - t0;
    assert.equal(rows.length, 50, JSON.stringify(f)); assert.equal(new Set(rows.map(r => r.id)).size, 50);
    assert.ok(cekilen.every(n => n <= 50), `JS'ye en çok 50 satır: ${cekilen}`); assert.ok(ms < 500, `${ms} ms`);
    for (const r of rows) assert.ok(!("a" in r) && !("x" in r) && !("rk" in r));
    for (const [sql, a] of kayit) {
      assert.ok(!/RANDOM/i.test(sql));
      const plan = B.db.prepare("EXPLAIN QUERY PLAN " + sql).all(...a).map(p => p.detail).join(" | ");
      console.log("  PLAN", JSON.stringify(f), "→", plan);
      assert.ok(/USING (COVERING )?INDEX soru_sec_/.test(plan), plan); assert.ok(!/TEMP B-TREE/i.test(plan), plan); assert.ok(!/SCAN soru(?! USING)/.test(plan), plan);
    }
  }
  /* sarma-çevrim sorgusu (rk < ?) da aynı indeksleri kullanır */
  for (const [f, ek, a] of [["", "", [1e9, 10]], [" AND s = ?", "s", [1e9, "mat", 10]], [" AND s = ? AND t = ?", "st", [1e9, "mat", "T5", 10]]]) {
    const plan = B.db.prepare(`EXPLAIN QUERY PLAN SELECT id, s, t, d, govde FROM soru WHERE ${UYGUN} AND rk < ?${f} ORDER BY rk LIMIT ?`).all(...a).map(p => p.detail).join(" | ");
    console.log("  PLAN rk< " + ek, "→", plan); assert.ok(/USING (COVERING )?INDEX soru_sec_/.test(plan) && !/TEMP B-TREE/i.test(plan), plan);
  }
  /* sarma-çevrim: başlangıç noktası sondan önceyse eksik kalanı rk < r ile tamamlar; sınırda (r çok büyük) yine tam n verir */
  const B2 = d1(); await soruKanonikSema(B2); await B2.batch(SEMA_SQL.map(s => B2.prepare(s)));
  tohumla(B2, 30, { onek: "w", s: "mat" });
  for (let i = 0; i < 20; i++) assert.equal((await soruSec({ DB: B2 }, { ders: "mat" }, 30)).length, 30);
  assert.equal((await soruSec({ DB: B2 }, { ders: "mat" }, 100)).length, 30);   // havuzdan fazlası istenirse eldeki kadar
  /* dağılım: ardışık seçimler farklı başlangıç noktalarından başlar (sabit başlangıç değil) */
  const ilkler = new Set(); for (let i = 0; i < 25; i++) ilkler.add((await soruSec({ DB: B2 }, { ders: "mat" }, 1))[0].id); assert.ok(ilkler.size > 5, `yalnız ${ilkler.size} farklı ilk soru`);
});
test("37) uygunluk koşulu indeks koşuluyla birebir (planlayıcının partial indeksi kullanabilmesi için)", () => {
  for (const s of SEMA_SQL.filter(x => /soru_sec_/.test(x))) assert.ok(s.endsWith("WHERE " + UYGUN));
});
