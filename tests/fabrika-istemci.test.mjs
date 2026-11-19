// Fabrika robotu · model istemcisi + ayrı Worker. Ağ çağrısı YOK: fetch yer değiştirir, anahtar sahtedir.
import test from "node:test";
import assert from "node:assert/strict";
import { fabrikaClaude } from "../lib/fabrika-claude.js";
import worker, { tur } from "../worker/fabrika-worker.js";
import { kur } from "./yardim/soru-v2.mjs";
import { robotAyarla, pilotBaslat, fabrikaSema } from "../lib/fabrika.js";

const SAHTE_ANAHTAR = "test-anahtar-sahte-fabrika-123";
function fetchStub(yanit) { const o = globalThis.fetch, c = []; globalThis.fetch = async (url, init) => { c.push({ url: String(url), init }); return yanit(url, init); }; return { c, geriAl: () => { globalThis.fetch = o; } }; }

test("istemci: anahtar yoksa ağ çağrısı yapılmaz", async () => {
  const s = fetchStub(() => { throw new Error("çağrılmamalı"); });
  try { const r = await fabrikaClaude({})({ model: "m", prompt: "p", max_tokens: 10 }); assert.equal(r.hata, "anahtar_yok"); assert.equal(s.c.length, 0); } finally { s.geriAl(); }
});
test("istemci: başarılı yanıtta metin + gerçek usage token'ları; anahtar yalnız x-api-key başlığında", async () => {
  const s = fetchStub(() => new Response(JSON.stringify({ content: [{ type: "text", text: "merhaba" }], usage: { input_tokens: 12, output_tokens: 7 } }), { status: 200 }));
  try {
    const r = await fabrikaClaude({ ANTHROPIC_API_KEY: SAHTE_ANAHTAR })({ model: "claude-x", prompt: "SORU", max_tokens: 99 });
    assert.deepEqual([r.metin, r.giris, r.cikis, r.hata], ["merhaba", 12, 7, undefined]);
    const c = s.c[0]; assert.match(c.url, /^https:\/\/api\.anthropic\.com\/v1\/messages$/); assert.equal(c.init.headers["x-api-key"], SAHTE_ANAHTAR);
    assert.ok(!c.init.body.includes(SAHTE_ANAHTAR), "anahtar gövdeye sızdı"); assert.equal(JSON.parse(c.init.body).model, "claude-x");
  } finally { s.geriAl(); }
});
test("istemci: 429 retry-after üst sınırla; hata metninde anahtar yok; istisna/zaman aşımı hata döner", async () => {
  let s = fetchStub(() => new Response("{}", { status: 429, headers: { "retry-after": "99999" } }));
  try { const r = await fabrikaClaude({ ANTHROPIC_API_KEY: SAHTE_ANAHTAR })({ model: "m", prompt: "p", max_tokens: 1 }); assert.equal(r.hata, "http_429"); assert.ok(r.bekle_ms > 0 && r.bekle_ms <= 300000); assert.ok(!JSON.stringify(r).includes(SAHTE_ANAHTAR)); } finally { s.geriAl(); }
  s = fetchStub(() => { throw new Error("ag " + SAHTE_ANAHTAR); });
  try { const r = await fabrikaClaude({ ANTHROPIC_API_KEY: SAHTE_ANAHTAR })({ model: "m", prompt: "p", max_tokens: 1 }); assert.equal(r.hata, "ag_hatasi"); assert.ok(!JSON.stringify(r).includes(SAHTE_ANAHTAR)); } finally { s.geriAl(); }
  s = fetchStub((u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => { const e = new Error("abort"); e.name = "AbortError"; rej(e); })));
  try { const r = await fabrikaClaude({ ANTHROPIC_API_KEY: SAHTE_ANAHTAR }, { zamanAsimiMs: 20 })({ model: "m", prompt: "p", max_tokens: 1 }); assert.equal(r.hata, "zaman_asimi"); } finally { s.geriAl(); }
});

const T = await kur({ ekEnv: { ANTHROPIC_API_KEY: SAHTE_ANAHTAR } });
await T.hazirla();
test("worker: HTTP'ye açık uç yok (fetch 404); robot kapalıyken scheduled hiçbir ağ çağrısı yapmaz", async () => {
  assert.equal((await worker.fetch(new Request("https://x/"))).status, 404);
  const s = fetchStub(() => { throw new Error("çağrılmamalı"); });
  try { await fabrikaSema(T.env); const r = await tur(T.env); assert.equal(r.neden, "robot_kapali"); assert.equal(s.c.length, 0); } finally { s.geriAl(); }
});
test("worker: robot açık + pilot → scheduled gerçek istemciyle (sahte fetch) üretim ve denetim çağrısı yapar, canlıya yazmaz", async () => {
  await robotAyarla(T.env, true); await pilotBaslat(T.env, { hedef: 1, ders: "mat", konu: "Sayılar" });
  const s = fetchStub((u, init) => { const g = JSON.parse(init.body).messages[0].content, uretim = /soru yaz/.test(g);
    const metin = uretim ? JSON.stringify([{ p: "", q: "WSORU-1", o: ["w1", "w2", "w3", "w4", "w5"], a: 2, x: "WCOZUM" }]) : JSON.stringify({ cevap: 2, tek_dogru: true, belirsiz: false, sorunlar: [] });
    return new Response(JSON.stringify({ content: [{ type: "text", text: metin }], usage: { input_tokens: 5, output_tokens: 5 } }), { status: 200 }); });
  try { for (let i = 0; i < 4; i++) await tur(T.env); } finally { s.geriAl(); }
  assert.equal(s.c.length, 2);
  assert.equal(T.DB.db.prepare("SELECT COUNT(*) n FROM soru WHERE durum = 'onayli'").get().n, 0);
  assert.equal(T.DB.db.prepare("SELECT model_durum FROM fabrika_soru").get().model_durum, "gecti");
});
test("V2 kapalıyken robot açılamaz (kanonik şema yoksa hat çalışmaz)", async () => {
  const eski = T.env.AKE_SORU_V2; delete T.env.AKE_SORU_V2;
  try { const r = await robotAyarla(T.env, true); assert.equal(r.ok, false); assert.equal(r.neden, "v2_kapali"); } finally { T.env.AKE_SORU_V2 = eski; }
  assert.equal((await robotAyarla(T.env, false)).ok, true);   // kapatmak her zaman serbest
});

/* ---- önizleme kurulumu: robot kapalıyken Worker'ın bağlantı/limit doğrulama günlüğü ---- */
test("worker günlüğü: robot kapalıyken D1 bağlantısını, robot durumunu ve günlük limiti (40) tek satırda yazar; sır içermez", async () => {
  await robotAyarla(T.env, false);
  const satirlar = []; const orijinal = console.log; console.log = (...a) => { satirlar.push(a.join(" ")); };
  const s = fetchStub(() => { throw new Error("çağrılmamalı"); });
  try { const ps = []; await worker.scheduled({}, { ...T.env, AKE_FABRIKA_GUNLUK_CAGRI: "40" }, { waitUntil: p => ps.push(p) }); await Promise.all(ps); assert.equal(s.c.length, 0); } finally { console.log = orijinal; s.geriAl(); }
  const l = satirlar.find(x => x.startsWith("fabrika-worker ")); assert.ok(l, "günlük satırı yok");
  const j = JSON.parse(l.slice("fabrika-worker ".length));
  assert.deepEqual([j.neden, j.islenen, j.robot, j.gunlukLimit, j.d1], ["robot_kapali", 0, false, 40, "baglandi"]);
  assert.ok(!l.includes(SAHTE_ANAHTAR));
});
test("worker günlüğü: limit ayarlanmamışsa varsayılan 40; D1 bağlantısı yoksa 'd1_yok' hatası günlüğe düşer (sessiz geçmez)", async () => {
  const satirlar = []; const o1 = console.log, o2 = console.error; console.log = (...a) => satirlar.push(a.join(" ")); console.error = (...a) => satirlar.push("ERR " + a.join(" "));
  try {
    let ps = []; const { AKE_FABRIKA_GUNLUK_CAGRI, ...ayarsiz } = T.env; await worker.scheduled({}, ayarsiz, { waitUntil: p => ps.push(p) }); await Promise.all(ps);
    ps = []; await worker.scheduled({}, { ANTHROPIC_API_KEY: SAHTE_ANAHTAR }, { waitUntil: p => ps.push(p) }); await Promise.all(ps);
  } finally { console.log = o1; console.error = o2; }
  const ok = JSON.parse(satirlar.find(x => x.startsWith("fabrika-worker ")).slice(15)); assert.equal(ok.gunlukLimit, 40);
  assert.ok(satirlar.some(x => x.startsWith("ERR fabrika-worker") && /d1_yok/.test(x)), satirlar.join("|"));
  assert.ok(!satirlar.join("").includes(SAHTE_ANAHTAR));
});
