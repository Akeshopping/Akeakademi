// Soru API (PR 2) test yardımcıları: D1 benzeri SQLite kabuğu, giriş, sentetik soru tohumu, sızıntı yürüyücüsü.
// Kabuk D1 sözleşmesini taklit eder: batch() = TEK İŞLEM (hata olursa tamamı geri alınır), ifadeler sırayla ve eşzamansız-olmayan şekilde çalışır;
// her okuma/yazma bir "tick" bekler, böylece Promise.all ile başlatılan istekler GERÇEKTEN iç içe geçer (yarış testleri anlamlı olur).
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { sha256 } from "../../lib/ortak.js";
import { soruKanonikSema } from "../../lib/soru-kanonik.js";

const tick = () => new Promise(r => setImmediate(r));

export function d1() {
  const db = new DatabaseSync(":memory:");
  const sayac = { prepare: 0, batch: 0, geriAlma: 0, sql: [] };   // sql: hazırlanan tüm SQL metinleri (şema/ALTER çağrısı yokluğu testleri için)
  const hook = { konum: null, hedef: null, hep: false, once: null, araSql: null };   // once: bir sonraki hedef batch'ten ÖNCE (işlem dışı) çalışır; araSql: [i, sql] — işlem İÇİNDE i. ifadeden önce   // konum: bu sıradaki ifadeden ÖNCE hata ver; ifade sayısına eşitse tüm ifadelerden sonra, commit'ten önce
  const mk = (sql, a = []) => ({
    _sql: sql, _a: a, bind: (...x) => mk(sql, x),
    first: async () => { await tick(); return db.prepare(sql).get(...a) || null; },
    all: async () => { await tick(); return { results: db.prepare(sql).all(...a) }; },
    run: async () => { await tick(); const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; }
  });
  const DB = {
    prepare: sql => { sayac.prepare++; sayac.sql.push(sql); return mk(sql); },
    batch: async arr => {
      sayac.batch++; await tick();
      if (hook.once && (!hook.hedef || arr.some(s => hook.hedef.test(s._sql)))) { const f = hook.once; hook.once = null; f(); }
      db.exec("BEGIN");
      try {
        const out = [], hedefMi = hook.konum !== null && (!hook.hedef || arr.some(s => hook.hedef.test(s._sql)));
        for (let i = 0; i < arr.length; i++) {
          if (hook.araSql && hook.araSql[0] === i && (!hook.hedef || arr.some(s => hook.hedef.test(s._sql)))) { const q = hook.araSql[1]; hook.araSql = null; db.exec(q); }
          if (hedefMi && hook.konum === i) { if (!hook.hep) hook.konum = null; throw new Error("enjekte hata @" + i); }
          const st = db.prepare(arr[i]._sql);
          if (/^\s*(SELECT|PRAGMA|EXPLAIN)/i.test(arr[i]._sql)) out.push({ results: st.all(...arr[i]._a) });
          else { const r = st.run(...arr[i]._a); out.push({ meta: { changes: r.changes } }); }
        }
        if (hedefMi && hook.konum === arr.length) { if (!hook.hep) hook.konum = null; throw new Error("enjekte hata @commit"); }
        db.exec("COMMIT"); return out;
      } catch (e) { sayac.geriAlma++; try { db.exec("ROLLBACK"); } catch (_) { } throw e; }
    },
    db, sayac, hook
  };
  return DB;
}

const KOK = "https://akeakademi.com";
export async function kur({ bayrak = "1", ekEnv = {}, kanonik = true } = {}) {
  const DB = d1();
  const env = { DB, AKE_GIZLI: "test-gizli", ...(bayrak == null ? {} : { AKE_SORU_V2: bayrak }), ...ekEnv };
  const hesap = await import(pathToFileURL(resolve("functions/api/hesap/[[yol]].js")).href);
  const soruMod = await import(pathToFileURL(resolve("functions/api/soru/[[yol]].js")).href);
  let ipNo = 0;
  const hesapIstek = (yol, { m = "GET", govde, cookie, ip } = {}) => hesap.onRequest({
    request: new Request(KOK + "/api/hesap/" + yol, { method: m, headers: { "content-type": "application/json", "cf-connecting-ip": ip || "10.0.0.1", ...(cookie ? { cookie } : {}) }, body: govde ? JSON.stringify(govde) : undefined }),
    env, params: { yol: yol.split("/") } });
  let sema = false;
  const hazirla = async () => { if (sema) return; await hesapIstek("ben"); if (kanonik) await soruKanonikSema(DB); sema = true; };
  /* gerçek hesap ucuyla giriş: giriş satırına bilinen kod yazılır, kod-dogrula çağrılır */
  async function giris(eposta) {
    await hazirla();
    const kod = "123456", hash = await sha256(eposta + ":" + kod + ":" + env.AKE_GIZLI);
    DB.db.prepare("INSERT INTO giris (eposta, hash, bitis, deneme, son_gonderim, pencere, sayac) VALUES (?, ?, ?, 0, 0, 0, 0) ON CONFLICT (eposta) DO UPDATE SET hash = excluded.hash, bitis = excluded.bitis, deneme = 0").run(eposta, hash, Date.now() + 600000);
    const n = ++ipNo, r = await hesapIstek("kod-dogrula", { m: "POST", govde: { eposta, kod }, ip: `10.${(n >> 8) & 255}.${n & 255}.7` });   // giriş hız sınırı IP başınadır: her girişe ayrı IP
    assert.equal(r.status, 200); const j = await r.json();
    const cookie = r.headers.get("set-cookie").split(";")[0];
    const kid = DB.db.prepare("SELECT id FROM kullanici WHERE eposta = ?").get(eposta).id;
    return { cookie, kid, j };
  }
  const hesapKota = async (cookie, tur, adet) => { const r = await hesapIstek("kota", { m: "POST", govde: { tur, adet }, cookie }); return { s: r.status, j: await r.json() }; };
  const premiumYap = (kid) => DB.db.prepare("INSERT OR REPLACE INTO kod (anahtar, kid, plan, bitis, tarih) VALUES (?, ?, 'premium', '2999-01-01', 0)").run("P" + kid, kid);
  /* soru API çağrısı. origin: varsayılan aynı-origin; null → Origin başlığı yok */
  async function api(yol, { m = "POST", govde, cookie, origin = KOK, ek = {}, ham } = {}) {
    const basliklar = { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), ...ek };
    const r = await soruMod.onRequest({ request: new Request(KOK + "/api/soru/" + yol, { method: m, headers: basliklar, body: m === "GET" ? undefined : (ham !== undefined ? ham : (govde === undefined ? undefined : JSON.stringify(govde))) }), env, params: { yol: yol.split("?")[0].split("/") } });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
    return { s: r.status, j, t, h: r.headers };
  }
  let istekNo = 0;
  const yeniIstek = () => "istek-" + (++istekNo) + "-" + Math.random().toString(36).slice(2, 12) + "0123456789";
  return { DB, env, giris, hesapKota, premiumYap, api, yeniIstek, hazirla };
}

/* sentetik soru tohumu (gerçek banka metni YOK). cozum belirteci: "COZUM-<id>" (sızıntı aramaları için) */
export function tohumla(DB, n, { onek = "t", s = "mat", konular = ["K1"], zorluklar = [1, 2, 3], durum = "banka", kopya = 0 } = {}) {
  const ins = DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, ?, ?, NULL, ?, 0, 0, 'gomulu', ?, ?, ?, ?, ?, ?)");
  DB.db.exec("BEGIN");
  for (let i = 0; i < n; i++) {
    const id = `${onek}-${i}`, o = [0, 1, 2, 3, 4].map(k => `secenek-${id}-${k}`);
    ins.run(id, s, konular[i % konular.length], zorluklar[i % zorluklar.length], durum, Math.floor(Math.random() * 2147483647), "h-" + id,
      JSON.stringify({ q: "Soru metni " + id, o }), i % 5, "COZUM-" + id, i < kopya ? "t-ana" : null);
  }
  DB.db.exec("COMMIT");
}

export const YASAKLI_ANAHTAR = ["a", "x", "h", "rk", "json", "kopya_of", "kaynak", "govde"];
/* YAPI tabanlı: her nesneyi gezer; yasaklı anahtar bulursa yolunu verir. Soru nesneleri için ayrıca izinli anahtar kümesi denetlenir. */
export function sizintiBul(v, yasak = YASAKLI_ANAHTAR) {
  const bulunan = [];
  (function yuru(d, yol) {
    if (Array.isArray(d)) d.forEach((e, i) => yuru(e, yol + "[" + i + "]"));
    else if (d && typeof d === "object") for (const [k, e] of Object.entries(d)) { if (yasak.includes(k)) bulunan.push(yol + "." + k); yuru(e, yol + "." + k); }
  })(v, "$");
  return bulunan;
}
export const SORU_ANAHTARLARI = new Set(["id", "s", "t", "d", "p", "q", "o"]);

/* ---- yönetim uçları + sahte Anthropic (PR 3) ---- */
export async function yonetimIstek(T, yol, { m = "POST", govde, cookie } = {}) {
  const mod = await import(pathToFileURL(resolve("functions/api/yonetim/[[yol]].js")).href);
  const r = await mod.onRequest({ request: new Request(KOK + "/api/yonetim/" + yol, { method: m, headers: { "content-type": "application/json", origin: KOK, ...(cookie ? { cookie } : {}) }, body: m === "GET" ? undefined : JSON.stringify(govde || {}) }), env: T.env, params: { yol: [yol] } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { s: r.status, j, t };
}
/* Gerçek Anthropic çağrısı YOK: fetch yer değiştirir; api.anthropic.com'a giden istek verilen sentetik soruları döndürür, başka her ağ çağrısı hata verir. */
export function aiStub(sorular) {
  const orijinal = globalThis.fetch, cagri = { n: 0 };
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.anthropic.com")) { cagri.n++; return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(sorular) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } }); }
    throw new Error("beklenmeyen ağ çağrısı: " + url);
  };
  return { cagri, geriAl: () => { globalThis.fetch = orijinal; } };
}
export const sentetik = (i, ek = {}) => ({ p: "", q: `SENTETIK-SORU-${i}`, o: [0, 1, 2, 3, 4].map(k => `SENTETIK-SIK-${i}-${k}`), a: i % 5, x: `SENTETIK-COZUM-${i}`, ...ek });
