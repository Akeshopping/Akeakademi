// Fabrika robotu · 1. düzeltme, AKE_SORU_V2 KAPALI: legacy yol da soruyu 'onayli' yazmaz, 'taslak' yazar; kanonik şema kurulmaz.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, aiStub, sentetik } from "./yardim/soru-v2.mjs";
import { soruSema } from "../lib/ortak.js";

const T = await kur({ bayrak: null, kanonik: false, ekEnv: { AKE_YONETICI: "yonetici@ornek.com", ANTHROPIC_API_KEY: "test-anahtar-sahte", AKE_SORU_GUNLUK: "1000" } });
await T.hazirla(); await soruSema(T.env);
const yon = await T.giris("yonetici@ornek.com");

test("soru-uret (V2 kapalı, legacy yol): satırlar 'taslak', 'onayli' değil; kanonik kolon eklenmez", async () => {
  const st = aiStub([sentetik(21), sentetik(22)]);
  try { const r = await yonetimIstek(T, "soru-uret", { cookie: yon.cookie, govde: { s: "mat", t: "Sentetik Konu", d: 2, n: 2 } }); assert.equal(r.s, 200); assert.equal(r.j.gecen, 2); } finally { st.geriAl(); }
  assert.deepEqual(T.DB.db.prepare("SELECT durum, COUNT(*) n FROM soru GROUP BY durum").all().map(r => ({ ...r })), [{ durum: "taslak", n: 2 }]);
  assert.ok(!T.DB.db.prepare("PRAGMA table_info(soru)").all().some(c => c.name === "kaynak"));
});
