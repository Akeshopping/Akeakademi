// Odak turu kaydı (POST /api/soru/odak) · GERÇEK sunucu koduyla (node:sqlite)
//   biten 25 dk'lık tur stats.daily[gün].fm'e eklenir (web odak sayacı ile aynı alan); tur kimliği tek seferlik, günlük sınırlı.
import test from "node:test";
import assert from "node:assert/strict";
import { kur } from "./yardim/soru-v2.mjs";

const T = await kur();
const { giris, api, yeniIstek, DB } = T;
await T.hazirla();
const { onRequest } = await import("../functions/api/hesap/[[yol]].js");
let ipn = 0;
const cagir = (tok, yontem, yol, govde) => onRequest({ request: new Request("https://akeakademi.com/api/hesap/" + yol, { method: yontem, headers: { "content-type": "application/json", authorization: "Bearer " + tok, "cf-connecting-ip": "10.8.8." + (++ipn) }, body: govde ? JSON.stringify(govde) : undefined }), env: T.env, params: { yol: yol.split("/") } });
const kullanici = async e => { const g = await giris(e); return { cookie: g.cookie, kid: g.kid, tok: decodeURIComponent(/^ake_s=([^;]*)/.exec(g.cookie)[1]) }; };
const stats = async tok => (await (await cagir(tok, "GET", "veri")).json()).alanlar.stats;
const bugun = () => new Date(Date.now() + 180 * 60000).toISOString().slice(0, 10);
const odak = (c, tur, ek = {}) => api("odak", { cookie: c.cookie, govde: { tur, tz: 180, ...ek } });

test("1) tur eklenir, tekrar aynı kimlik sayılmaz, yeni kimlik 25 dk daha ekler; web alanları ve soru sayaçları korunur", async () => {
  const c = await kullanici("od1@ornek.com");
  await cagir(c.tok, "PUT", "veri/stats", { _u: 1000, ans: { x: [1] }, badges: { ilk: 1 }, topic: { "mat|Sayılar": [5, 2, 0] }, daily: { [bugun()]: { q: 7, c: 5, fm: 25 } } });
  const a = await odak(c, "tur-" + yeniIstek()); assert.equal(a.s, 200); assert.equal(a.j.fm, 50);
  const id = "tur-" + yeniIstek();
  const b = await odak(c, id); assert.equal(b.j.fm, 75);
  const b2 = await odak(c, id); assert.equal(b2.s, 200); assert.equal(b2.j.fm, 75, "aynı kimlik ikinci kez sayılmaz");
  const [r1, r2] = await Promise.all([odak(c, "es-" + yeniIstek()), odak(c, "es-" + yeniIstek())]);
  assert.equal(r1.s, 200); assert.equal(r2.s, 200);
  const S = await stats(c.tok);
  assert.equal(S.daily[bugun()].fm, 125, "iki eşzamanlı yeni tur de bir kez sayıldı");
  assert.equal(S.daily[bugun()].q, 7); assert.equal(S.daily[bugun()].c, 5);
  assert.deepEqual(S.ans, { x: [1] }); assert.deepEqual(S.badges, { ilk: 1 }); assert.deepEqual(S.topic["mat|Sayılar"], [5, 2, 0]);
});

test("2) hiç stats yokken de çalışır (belge oluşur); doğrulama sıkı", async () => {
  const c = await kullanici("od2@ornek.com");
  const a = await odak(c, "yeni-" + yeniIstek()); assert.equal(a.s, 200); assert.equal(a.j.fm, 25);
  assert.equal((await stats(c.tok)).daily[bugun()].fm, 25);
  for (const govde of [{ tur: "kisa" }, { tur: "x".repeat(101) }, { tur: "boşluk var 1234567890" }, { tur: 5 }, {}, { tur: "gecerli-kimlik-123456", ekstra: 1 }, { tur: "gecerli-kimlik-123456", tz: "180" }, { tur: "gecerli-kimlik-123456", tz: 5000 }]) {
    const r = await api("odak", { cookie: c.cookie, govde }); assert.equal(r.s, 400, JSON.stringify(govde));
  }
  assert.equal((await stats(c.tok)).daily[bugun()].fm, 25, "geçersiz istekler hiçbir şey yazmadı");
});

test("3) günlük sınır: 16 tur; 17. 429; sınırdaki eski kimlik hâlâ 200", async () => {
  const c = await kullanici("od3@ornek.com"); const ids = [];
  for (let i = 0; i < 16; i++) { const id = "sinir-" + i + "-" + yeniIstek(); ids.push(id); assert.equal((await odak(c, id)).s, 200); }
  const fazla = await odak(c, "fazla-" + yeniIstek()); assert.equal(fazla.s, 429); assert.equal(fazla.j.error, "odak_siniri");
  assert.equal((await odak(c, ids[0])).s, 200);
  assert.equal((await stats(c.tok)).daily[bugun()].fm, 16 * 25);
});

test("4) başka hesabın turu karışmaz; oturumsuz 401; hesap silinince olay satırları temizlenir", async () => {
  const a = await kullanici("od4a@ornek.com"), b = await kullanici("od4b@ornek.com"); const id = "ortak-kimlik-" + yeniIstek();
  assert.equal((await odak(a, id)).j.fm, 25); assert.equal((await odak(b, id)).j.fm, 25, "aynı kimlik başka hesapta ayrı sayılır");
  const anon = await api("odak", { govde: { tur: id } }); assert.equal(anon.s, 401);
  const say = kid => DB.db.prepare("SELECT COUNT(*) n FROM ilerleme_olay WHERE kid = ? AND oturum LIKE 'odak:%'").get(kid).n;
  assert.equal(say(a.kid), 1);
  const sil = await cagir(a.tok, "POST", "sil", { onay: "SİL" }); assert.equal(sil.status, 200);
  assert.equal(say(a.kid), 0); assert.equal(say(b.kid), 1);
});
