// PR 4 · AKE_SORU_MIGRATION_LOCK: varsayılan KAPALI; açıkken yalnız soru-uret/soru-karar POST'ları 503; AKE_SORU_V2'den bağımsız.
import test from "node:test";
import assert from "node:assert/strict";
import { kur, yonetimIstek, aiStub, sentetik } from "./yardim/soru-v2.mjs";

const T = await kur({ bayrak: null, kanonik: false, ekEnv: { AKE_YONETICI: "yonetici@ornek.com", ANTHROPIC_API_KEY: "test-sahte", AKE_SORU_GUNLUK: "1000" } });
const yon = await T.giris("yonetici@ornek.com"), { DB } = T;
const uret = async () => { const st = aiStub([sentetik(1)]); try { return { ...(await yonetimIstek(T, "soru-uret", { cookie: yon.cookie, govde: { s: "mat", t: "K", d: 2, n: 1 } })), ai: st.cagri.n }; } finally { st.geriAl(); } };
const karar = () => yonetimIstek(T, "soru-karar", { cookie: yon.cookie, govde: { id: [], karar: "red" } });
const soruSayisi = () => { try { return DB.db.prepare("SELECT COUNT(*) n FROM soru").get().n; } catch (e) { return 0; } };

test("kilit yokken (varsayılan): soru-uret ve soru-karar normal çalışır (davranış değişmedi)", async () => {
  assert.equal((await karar()).s, 200); const r = await uret(); assert.equal(r.s, 200); assert.equal(r.ai, 1); assert.equal(soruSayisi(), 1);
});
for (const v of ["", "0", "true", "yes"]) test(`AKE_SORU_MIGRATION_LOCK=${JSON.stringify(v)} kilit sayılmaz (yalnız "1")`, async () => { T.env.AKE_SORU_MIGRATION_LOCK = v; assert.equal((await karar()).s, 200); delete T.env.AKE_SORU_MIGRATION_LOCK; });
test("kilit açık: soru-uret/soru-karar POST → 503 bakim, AI çağrılmaz, D1'e yazılmaz; GET yönetim ve hesap çalışır", async () => {
  T.env.AKE_SORU_MIGRATION_LOCK = "1"; const once = soruSayisi(), sql0 = DB.sayac.sql.length;
  const r = await uret(); assert.equal(r.s, 503); assert.equal(r.j.error, "bakim"); assert.equal(r.ai, 0); assert.equal(soruSayisi(), once);
  const k = await karar(); assert.equal(k.s, 503); assert.equal(soruSayisi(), once);
  assert.equal(DB.sayac.sql.slice(sql0).filter(s => /INSERT INTO soru|UPDATE soru/i.test(s)).length, 0);
  assert.equal((await yonetimIstek(T, "durum", { m: "GET", cookie: yon.cookie })).s, 200);
  assert.equal((await yonetimIstek(T, "sorular", { m: "GET", cookie: yon.cookie })).s, 200);
  const ben = await T.giris("ogrenci@ornek.com"); assert.ok(ben.cookie);   // hesap/giriş etkilenmez
  delete T.env.AKE_SORU_MIGRATION_LOCK; assert.equal((await karar()).s, 200);   // kilit kalkınca geri döner
});
test("kilit ile AKE_SORU_V2 bağımsız: biri diğerini değiştirmez; V2 kapalıyken kilit V2'yi açmaz (V2 API 404)", async () => {
  T.env.AKE_SORU_MIGRATION_LOCK = "1"; assert.equal(T.env.AKE_SORU_V2, undefined); assert.equal((await T.api("ozet", { m: "GET", cookie: yon.cookie })).s, 404);
  assert.equal(T.env.AKE_SORU_V2, undefined); delete T.env.AKE_SORU_MIGRATION_LOCK;
  T.env.AKE_SORU_V2 = "1"; assert.equal((await karar()).s, 200); T.env.AKE_SORU_MIGRATION_LOCK = "1"; assert.equal((await karar()).s, 503); assert.equal(T.env.AKE_SORU_V2, "1");   // V2 açık + kilit: yine 503
  delete T.env.AKE_SORU_MIGRATION_LOCK; delete T.env.AKE_SORU_V2;
});
test("yetkisiz istek kilit bilgisi sızdırmaz: yönetici olmayan 403 alır (503 değil)", async () => {
  T.env.AKE_SORU_MIGRATION_LOCK = "1"; const o = await T.giris("baska@ornek.com");
  assert.equal((await yonetimIstek(T, "soru-karar", { cookie: o.cookie, govde: { id: [], karar: "red" } })).s, 403); delete T.env.AKE_SORU_MIGRATION_LOCK;
});
