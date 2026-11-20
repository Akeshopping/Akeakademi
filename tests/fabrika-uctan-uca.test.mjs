// Fabrika robotu · uçtan uca (YEREL, sahte Anthropic): yönetici uçları → ayrı Worker turları → inceleme kuyruğu → yayım kararı → öğrenci görünürlüğü.
// Gerçek API/Cloudflare çağrısı YOK. Anahtar sahtedir.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, sentetik } from "./yardim/soru-v2.mjs";
import worker from "../worker/fabrika-worker.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com", ANTHROPIC_API_KEY: "test-anahtar-sahte-uctan-uca", AKE_FABRIKA_GUNLUK_CAGRI: "100" } });
await T.hazirla(); const yon = await T.giris("yonetici@ornek.com"), DB = T.DB;
const yon_ = (yol, m = "POST", govde) => yonetimIstek(T, yol, { m, cookie: yon.cookie, govde });
const say = w => DB.db.prepare(`SELECT COUNT(*) n FROM soru WHERE ${w}`).get().n;

test("uçtan uca: robot kapalı → aç → pilot → Worker turları → 10 aday (hepsi taslak) → ilkini yayımla → öğrenci yalnız onu görür", async () => {
  /* varsayılan KAPALI; pilot başlamaz */
  assert.equal((await yon_("fabrika-durum", "GET")).j.robot, false);
  assert.equal((await yon_("fabrika-pilot-baslat")).s, 409);
  assert.equal((await yon_("fabrika-robot", "POST", { acik: true })).j.robot, true);
  assert.equal((await yon_("fabrika-pilot-baslat")).s, 200);

  /* sahte Anthropic: üretim → sıradaki sentetik soru, denetim → soruyu kör çözer (3 soruyu bilerek yanlış çözer). Worker şık konumunu karıştırır: doğru şık metinden bulunur. */
  const orijinal = globalThis.fetch; let uretilen = 0, ag = 0;
  globalThis.fetch = async (url, init) => {
    ag++; assert.match(String(url), /^https:\/\/api\.anthropic\.com\/v1\/messages$/); assert.equal(init.headers["x-api-key"], "test-anahtar-sahte-uctan-uca");
    const g = JSON.parse(init.body).messages[0].content; let metin;
    if (/soru yaz/.test(g)) { const s = sentetik(++uretilen); metin = JSON.stringify([{ p: s.p, q: s.q, o: s.o, a: s.a, x: s.x }]); }
    else { const i = +/SENTETIK-SORU-(\d+)/.exec(g)[1], dogru = g.split("\n").filter(l => /^[A-E]\) /.test(l)).findIndex(l => l.endsWith(`SENTETIK-SIK-${i}-${sentetik(i).a}`)); metin = JSON.stringify({ cevap: i >= 8 ? (dogru + 1) % 5 : dogru, tek_dogru: true, belirsiz: false, sorunlar: [] }); }
    return new Response(JSON.stringify({ content: [{ type: "text", text: metin }], usage: { input_tokens: 200, output_tokens: 80 } }), { status: 200 });
  };
  try { for (let i = 0; i < 12; i++) { const ps = []; await worker.scheduled({}, T.env, { waitUntil: p => ps.push(p) }); await Promise.all(ps); } } finally { globalThis.fetch = orijinal; }   // her cron tikinde en çok 3 iş

  const d = (await yon_("fabrika-durum", "GET")).j;
  assert.equal(d.sayilar.uretilen, 10); assert.equal(d.sayilar.model_gecti, 7); assert.equal(d.sayilar.revizyon, 3);   // kör denetçi 3 soruyu (8,9,10) farklı çözdü
  assert.equal(d.sayilar.yayinda, 0); assert.equal(d.sayilar.yonetici_yayimladi, 0); assert.equal(d.sayilar.uzman_kabul, 0); assert.equal(d.pilot.durum, "bitti"); assert.equal(d.cagri.toplam, 20); assert.equal(ag, 20);
  assert.equal(say("durum IN ('onayli','banka','bekliyor')"), 0); assert.equal(say("durum = 'taslak'"), 10);
  const m = (await yon_("maliyet", "GET")).j; assert.ok(m.fabrikaUsd > 0); assert.equal(m.fabrikaToken.giris, 4000);

  /* yönetici: revizyon gerekli olan yayımlanamaz; geçen yayımlanır */
  const a = (await yon_("fabrika-adaylar", "GET")).j.adaylar, kotu = a.find(x => x.model_durum === "revizyon"), iyi = a.find(x => x.model_durum === "gecti");
  assert.equal((await yon_("fabrika-uzman", "POST", { soru_id: iyi.id, karar: "kabul", uzman_ad: "Test Uzmanı", brans: "Test branşı", gerekce: "Test için sentetik uzman kabulü kaydı.", tarih: new Date().toISOString().slice(0, 10) })).s, 200);   // uzman kabulü AYRI kayıt; yönetici yayımı ondan sonra
  assert.equal((await yon_("fabrika-karar", "POST", { id: [kotu.id], karar: "yayin" })).s, 409);
  assert.equal((await yon_("fabrika-karar", "POST", { id: [iyi.id], karar: "yayin" })).s, 200);
  assert.equal(say("durum = 'onayli'"), 1);

  /* öğrenci tarafı */
  const sorular = await import("../functions/api/sorular.js");
  const j = await (await sorular.onRequest({ request: new Request("https://akeakademi.com/api/sorular"), env: T.env })).json(); const L = Array.isArray(j) ? j : (j.sorular || []);
  assert.deepEqual(L.map(q => q.id), [iyi.id]);
  const d2 = (await yon_("fabrika-durum", "GET")).j; assert.equal(d2.sayilar.model_gecti, 7); assert.equal(d2.sayilar.yonetici_yayimladi, 1);
  console.log("# UÇTAN UCA ÖZET:", JSON.stringify({ uretilen: d2.sayilar.uretilen, model_gecti: d2.sayilar.model_gecti, revizyon: d2.sayilar.revizyon, yayinda: d2.sayilar.yayinda, ogrenciye_gorunen: L.length, model_cagrisi: d2.cagri.toplam, token: [d2.cagri.giris, d2.cagri.cikis], sayisal: d2.sayisalDogrulama }));
});
