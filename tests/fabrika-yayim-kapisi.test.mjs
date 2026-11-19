// Fabrika robotu · 1. düzeltme: robotun ürettiği hiçbir soru doğrudan canlı bankaya (onayli/banka) girmez.
// Gerçek Anthropic çağrısı YOK (aiStub). Sentetik sorular.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, aiStub, sentetik } from "./yardim/soru-v2.mjs";
import { soruYazKanonik } from "../lib/soru-yaz.js";

const T = await kur({ ekEnv: { AKE_YONETICI: "yonetici@ornek.com", ANTHROPIC_API_KEY: "test-anahtar-sahte", AKE_SORU_GUNLUK: "1000" } });
const { DB, api, giris } = T;
const yon = await giris("yonetici@ornek.com");
const temizle = () => DB.db.exec("DELETE FROM soru");
const aday = (i, ek = {}) => ({ s: "mat", t: "Sentetik Konu", d: 2, ...sentetik(i), ...ek });
const uret = async sorular => { const st = aiStub(sorular); try { return await yonetimIstek(T, "soru-uret", { cookie: yon.cookie, govde: { s: "mat", t: "Sentetik Konu", d: 2, n: sorular.length } }); } finally { st.geriAl(); } };
const durumlar = () => DB.db.prepare("SELECT durum, COUNT(*) n FROM soru GROUP BY durum").all();

test("soruYazKanonik varsayılanı 'taslak'; canlı durum istenirse reddedilir", async () => {
  temizle();
  const r = await soruYazKanonik(T.env, aday(1)); assert.equal(r.durum, "yazildi");
  assert.equal(DB.db.prepare("SELECT durum FROM soru WHERE id = ?").get(r.id).durum, "taslak");
  for (const d of ["onayli", "banka"]) await assert.rejects(() => soruYazKanonik(T.env, aday(2), { durum: d }), /canli_durum_yasak/);
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n, 1);
});

test("soru-uret (V2 açık): satırlar 'taslak'; onayli/banka/bekliyor satır YOK", async () => {
  temizle(); const r = await uret([sentetik(11), sentetik(12)]);
  assert.equal(r.s, 200); assert.equal(r.j.gecen, 2);
  assert.deepEqual(durumlar().map(r => ({ ...r })), [{ durum: "taslak", n: 2 }]);
});

test("taslak soru öğrenciye görünmez: /api/sorular ve /api/soru/oturum", async () => {
  temizle(); await uret([sentetik(31), sentetik(32), sentetik(33), sentetik(34), sentetik(35)]);
  const mod = await import("../functions/api/sorular.js");
  const r = await mod.onRequest({ request: new Request("https://akeakademi.com/api/sorular"), env: T.env }); const j = await r.json();
  assert.equal((Array.isArray(j) ? j : (j.sorular || [])).length, 0);
  const u = await giris("ogrenci@ornek.com"); T.premiumYap(u.kid);
  const o = await api("oturum", { cookie: u.cookie, govde: { istek: T.yeniIstek(), ders: "mat", mod: "practice", adet: 5 } });
  assert.ok(!/SENTETIK-SORU-3/.test(o.t), "taslak soru oturuma sızdı");
});

test("eski soru-karar 'onay' taslağı yayımlayamaz (satır 'taslak' kalır)", async () => {
  temizle(); await uret([sentetik(41)]); const id = DB.db.prepare("SELECT id FROM soru").get().id;
  const r = await yonetimIstek(T, "soru-karar", { cookie: yon.cookie, govde: { id, karar: "onay" } });
  assert.ok(r.s === 200 || r.s === 409);
  assert.equal(DB.db.prepare("SELECT durum FROM soru WHERE id = ?").get(id).durum, "taslak");
});
