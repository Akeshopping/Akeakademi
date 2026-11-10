// Takma adlı kota kimliği: üretim, geçiş (MAX), saklama süresi, sırsız yedek · çalıştırma: node --test tests/kota-kimlik.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHmac, createHash } from "node:crypto";
import { sema, kullaniciBulVeyaAc, bugunIso, ayAnahtar } from "../lib/ortak.js";
import { kotaKimligiEposta, kotaDurum, kotaAl, kotaTemizle, kotaKorumaYaz } from "../lib/kota.js";

function d1() {
  const db = new DatabaseSync(":memory:");
  const st = (sql, a = []) => ({ bind: (...x) => st(sql, x),
    first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } });
  return { prepare: st, batch: async arr => { for (const s of arr) await s.run(); return []; }, db };
}
const SIR = "kimlik-test-sirri-xyz", DB = d1(), env = (sir = SIR) => ({ DB, AKE_GIZLI: sir });
const hesap = async (e, eposta) => { await sema(e); return kullaniciBulVeyaAc(e, { eposta }); };
const sha = s => createHash("sha256").update(s).digest("hex");

test("kimlik: 64 hane, belirli, normalize (büyük/küçük harf, boşluk) aynı; farklı e-posta farklı", async () => {
  const e = env(), a = await kotaKimligiEposta(e, "Test@Ornek.com"), b = await kotaKimligiEposta(e, "  test@ornek.com\n");
  assert.match(a, /^[0-9a-f]{64}$/); assert.equal(a, b);
  assert.notEqual(a, await kotaKimligiEposta(e, "baska@ornek.com"));
});
test("kimlik: bağımsız HMAC-SHA-256 hesabıyla birebir aynı, çıplak SHA-256 değil, sırla değişir", async () => {
  const e = env(), kimlik = await kotaKimligiEposta(e, "Ali@Ornek.com");
  assert.equal(kimlik, createHmac("sha256", SIR).update("ucretsiz-kota:ali@ornek.com").digest("hex"));
  for (const d of ["ali@ornek.com", "ucretsiz-kota:ali@ornek.com"]) assert.notEqual(kimlik, sha(d), "çıplak özet olmamalı");
  assert.notEqual(kimlik, await kotaKimligiEposta(env("baska-sir"), "ali@ornek.com"));
  assert.equal(await kotaKimligiEposta(env(""), "ali@ornek.com"), null, "sır yoksa kimlik üretilmez");
  assert.equal(await kotaKimligiEposta(e, ""), null);
});
test("geçiş: iki tarafta değer varsa toplanmaz (MAX); tekrar çalışması sayacı değiştirmez; hak azaltılmaz", async () => {
  const e = env(), kid = await hesap(e, "gecis@ornek.com"), kimlik = await kotaKimligiEposta(e, "gecis@ornek.com"), g = bugunIso();
  const yeni = () => DB.db.prepare("SELECT adet FROM ucretsiz_kimlik WHERE kimlik = ? AND donem = ? AND tur = 'soru'").get(kimlik, g);
  DB.db.prepare("INSERT INTO ucretsiz (kid, donem, tur, adet) VALUES (?, ?, 'soru', 7)").run(kid, g);
  assert.equal((await kotaDurum(e, kid)).kalanSoru, 13); assert.equal(yeni().adet, 7);
  for (let i = 0; i < 3; i++) await kotaDurum(e, kid); assert.equal(yeni().adet, 7, "tekrar okuma toplamamalı");
  await kotaKorumaYaz(e, kid); await kotaKorumaYaz(e, kid); assert.equal(yeni().adet, 7, "koruma yazımı iki kez toplamamalı");
  DB.db.prepare("UPDATE ucretsiz SET adet = 5 WHERE kid = ?").run(kid); /* eski taraf daha küçük: hak azaltılmaz/artırılmaz */
  assert.equal((await kotaDurum(e, kid)).kalanSoru, 13);
  DB.db.prepare("UPDATE ucretsiz SET adet = 11 WHERE kid = ?").run(kid); /* eski taraf daha büyük: daha çok kullanım korunur (sıfırlanamaz) */
  assert.equal((await kotaDurum(e, kid)).kalanSoru, 9); assert.equal(yeni().adet, 11);
  assert.equal((await kotaAl(e, kid, "soru", 3)).kalanSoru, 6);
});
test("saklama: eski gün (soru) ve eski ay (deneme) kayıtları tembel temizlikle silinir, güncel dönem kalır", async () => {
  const e = env(), kid = await hesap(e, "saklama@ornek.com"), kimlik = await kotaKimligiEposta(e, "saklama@ornek.com"), gercek = Date.now;
  const kayit = () => DB.db.prepare("SELECT donem, tur FROM ucretsiz_kimlik WHERE kimlik = ? ORDER BY tur").all(kimlik).map(r => r.tur + ":" + r.donem);
  try {
    const t0 = Date.UTC(2026, 10, 10, 9, 0, 0); Date.now = () => t0;
    await kotaAl(e, kid, "soru", 4); await kotaAl(e, kid, "deneme", 1);
    assert.deepEqual(kayit(), ["deneme:2026-11", "soru:2026-11-10"]);
    Date.now = () => t0 + 86400000; await kotaTemizle(e, true);                 /* ertesi gün */
    assert.deepEqual(kayit(), ["deneme:2026-11"], "dünün soru kaydı silinmeli, ayın deneme kaydı kalmalı");
    Date.now = () => Date.UTC(2026, 11, 3, 9, 0, 0); await kotaTemizle(e, true); /* gelecek ay */
    assert.deepEqual(kayit(), [], "geçen ayın deneme kaydı silinmeli");
  } finally { Date.now = gercek; }
});
test("sır tanımlı değilse eski kid tabanlı sayaca düşer (kesinti yok), takma adlı kayıt yazılmaz", async () => {
  const e = env(""), kid = await hesap(e, "sirsiz@ornek.com");
  const once = DB.db.prepare("SELECT COUNT(*) n FROM ucretsiz_kimlik").get().n;
  assert.equal((await kotaAl(e, kid, "soru", 5)).kalanSoru, 15); assert.equal((await kotaDurum(e, kid)).kalanSoru, 15);
  assert.equal(DB.db.prepare("SELECT adet FROM ucretsiz WHERE kid = ? AND tur = 'soru'").get(kid).adet, 5);
  assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM ucretsiz_kimlik").get().n, once);
  await kotaKorumaYaz(e, kid); /* sırsız ortamda hata vermez */
});
test("e-postası olmayan hesap da sırla türetilmiş kimlikle sayılır (düz kid yazılmaz)", async () => {
  const e = env(); await sema(e); const kid = await kullaniciBulVeyaAc(e, { eposta: "", google: "g:noemail" });
  await kotaAl(e, kid, "soru", 2);
  const k = DB.db.prepare("SELECT kimlik FROM ucretsiz_kimlik WHERE kimlik = ?").get(createHmac("sha256", SIR).update("ucretsiz-kota-kid:" + kid).digest("hex"));
  assert.ok(k, "kid'den sırla türetilmiş kimlik kullanılmalı"); assert.ok(!JSON.stringify(DB.db.prepare("SELECT * FROM ucretsiz_kimlik").all()).includes(kid));
});
