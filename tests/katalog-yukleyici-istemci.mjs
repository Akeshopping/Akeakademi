// B4 Aşama 3B · GERÇEK tarayıcıda katalog yükleyici: bayrak KAPALIYKEN mevcut davranış değişmez; bayrak AÇIKKEN sayfa içinde 1127 sentetik soru yüklenir.
// Sentetik veri, ağ yok (tüm /api çağrıları yerel olarak taklit edilir), Production/Preview'a dokunmaz. Çalıştırma: node tests/katalog-yukleyici-istemci.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YENI = fs.readFileSync(path.join(KOK, "index.html"), "utf8");
let ESKI; try { ESKI = execFileSync("git", ["show", "1d8989f7978972f015a37baf1cc040e44bfb7111:index.html"], { cwd: KOK, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" }); } catch (e) { ESKI = null; }
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 400)); };

const SOR = []; for (let i = 0; i < 1127; i++) { const q = { id: "syn" + String(i).padStart(4, "0"), s: ["mat", "turkce", "fizik"][i % 3], t: "Konu " + (i % 7), d: 1 + (i % 3), q: "Sentetik soru " + i, o: ["A", "B", "C", "D", "E"].map(h => h + i) }; if (i % 21 === 0 && i / 21 < 52) q.os = 1; else if (i % 30 === 1 && Math.floor(i / 30) < 37) q.fix = 1; SOR.push(q); }
function servis(html) { const s = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(html); } r.statusCode = 404; r.end(""); }); return new Promise(ok => s.listen(0, "127.0.0.1", () => ok({ s, url: "http://127.0.0.1:" + s.address().port + "/" }))); }
const b = await pw.chromium.launch();

/* sayfayı aç; tüm istekleri kaydet; /api/soru/katalog taklit edilir (mod: ok | 401 | 429 | 500 | sizinti) */
async function ac(url, { mod = "ok", bekle = 1500, beklenenKat = true } = {}) {
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" }), p = await c.newPage(), istekler = [];
  await p.route("**/*", async r => {
    const u = new URL(r.request().url()); if (u.hostname !== "127.0.0.1") return r.abort();   // dış kaynak yok
    if (u.pathname.startsWith("/api/")) istekler.push(u.pathname + u.search);
    if (u.pathname === "/api/soru/katalog") {
      if (mod === "401") return r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "oturum" }) });
      if (mod === "429") return r.fulfill({ status: 429, contentType: "application/json", headers: { "retry-after": "30" }, body: "{}" });
      if (mod === "500") return r.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      const limit = +u.searchParams.get("limit"), sonra = u.searchParams.get("sonra"), kalanlar = SOR.filter(q => sonra === null || q.id > sonra), devam = kalanlar.length > limit, sayfa = devam ? kalanlar.slice(0, limit) : kalanlar;
      const sorular = mod === "sizinti" ? sayfa.map((q, i) => i === 3 ? { ...q, a: 2, x: "SIRRI-COZUM" } : q) : sayfa;
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ n: sorular.length, bayrak: "hazir", sorular, sonraki: devam ? sayfa[sayfa.length - 1].id : null }) });
    }
    if (u.pathname.startsWith("/api/")) return r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return r.continue();
  });
  const yanit = await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(bekle);
  /* YANLIŞ BAŞARI KORUMASI: sayfa gerçekten açılmadıysa (404, boş sayfa, betik hatası) "istek yok" gibi sonuçlar sahte yeşil verir; bu yüzden test GEÇERSİZ sayılıp durdurulur. */
  const sag = await p.evaluate(() => ({ bank: typeof BANK !== "undefined" && Array.isArray(BANK) ? BANK.length : -1, app: !!document.getElementById("app") && document.getElementById("app").children.length > 0, kat: typeof KAT !== "undefined" })).catch(() => ({ bank: -1, app: false, kat: false }));
  if (!yanit || yanit.status() !== 200 || sag.bank < 728 || !sag.app || (beklenenKat && !sag.kat)) { console.error("TEST GEÇERSİZ: sayfa beklenen biçimde açılmadı " + JSON.stringify({ durum: yanit && yanit.status(), ...sag })); process.exit(2); }
  return { c, p, istekler };
}
const depo = p => p.evaluate(async () => ({ ls: Object.keys(localStorage).sort(), ss: Object.keys(sessionStorage).sort(), idb: ((await (indexedDB.databases ? indexedDB.databases() : [])) || []).map(d => d.name).sort() }));

const A = await servis(YENI);
/* 1) bayrak KAPALI (varsayılan) */
{ const { c, p, istekler } = await ac(A.url);
  t("1 bayrak KAPALI: sayfa açılışında /api/soru/katalog isteği YOK", !istekler.some(x => x.startsWith("/api/soru/katalog")), istekler.join(","));
  const r = await p.evaluate(async () => ({ acik: KAT.acik(), s: await KAT.yukle() })); await p.waitForTimeout(300);
  t("2 bayrak KAPALI: KAT.yukle() 'kapali_bayrak' döner ve yine istek atmaz", r.acik === false && r.s.durum === "kapali_bayrak" && r.s.ok === false, JSON.stringify(r));
  const sayim = await p.evaluate(() => ({ bank: BANK.length, ek: typeof EKQ })); t("3 BANK değişmedi (728+; yükleyici dokunmadı)", sayim.bank >= 728, JSON.stringify(sayim));
  await c.close(); }
/* 2) mevcut davranış: açılıştaki istek listesi, yükleyicisiz eski sürümle AYNI */
if (ESKI) { const B = await servis(ESKI); const e = await ac(B.url, { beklenenKat: false }), y = await ac(A.url);
  t("4a olumlu kontrol: iki sürüm de açılışta /api isteği yaptı (boş küme karşılaştırması sahte yeşil verirdi)", e.istekler.length > 0 && y.istekler.length > 0, JSON.stringify([e.istekler, y.istekler]));
  t("4 bayrak KAPALI: açılış istek kümesi, yükleyici eklenmemiş eski sürümle BİREBİR aynı", JSON.stringify([...new Set(e.istekler)].sort()) === JSON.stringify([...new Set(y.istekler)].sort()), JSON.stringify([e.istekler, y.istekler]));
  await e.c.close(); await y.c.close(); B.s.close(); } else t("4 taban sürüm (1d8989f) git geçmişinden okunamadı: test ATLANAMAZ (git fetch ile commit'i getirin)", false);
/* 3) bayrak AÇIK (?katalog=1): açılışta OTOMATİK istek yok; elle çağrılınca 1127 yüklenir */
{ const { c, p, istekler } = await ac(A.url + "?katalog=1"); const once = await depo(p);
  t("5 bayrak AÇIK: sayfa açılışında hâlâ otomatik katalog isteği YOK (yalnız elle çağrılınca)", !istekler.some(x => x.startsWith("/api/soru/katalog")));
  const r = await p.evaluate(async () => { const s = await KAT.yukle({ beklenenToplam: 1127 }); return { ok: s.ok, n: s.sorular.length, sayim: s.sayim, a: s.sorular.some(q => "a" in q || "x" in q), ornek: Object.keys(s.sorular[0]).sort().join(",") }; });
  t("6 1127 soru yüklendi; os=52, fix=37; sayfa=2; cevap alanı yok", r.ok && r.n === 1127 && r.sayim.os === 52 && r.sayim.fix === 37 && r.sayim.sayfa === 2 && !r.a, JSON.stringify(r));
  const kat = istekler.filter(x => x.startsWith("/api/soru/katalog"));
  t("7 yalnız limit/sonra gönderildi (2 istek)", kat.length === 2 && kat.every(x => [...new URL(x, "http://x").searchParams.keys()].every(k => k === "limit" || k === "sonra")), kat.join(" | "));
  t("8 oturum/cevap/bitir/kota/eski API çağrısı YAPILMADI", !istekler.some(x => /\/api\/soru\/(oturum|cevap|bitir|ozet)|\/api\/sorular|kota/.test(x)), istekler.join(","));
  const sonra = await depo(p);
  t("9 kalıcı depolama oluşmadı: localStorage/sessionStorage/IndexedDB anahtarları yüklemeden ÖNCE ile AYNI", JSON.stringify(once) === JSON.stringify(sonra), JSON.stringify([once, sonra]));
  const bnk = await p.evaluate(() => BANK.length); t("10 BANK yüklemeden etkilenmedi", bnk >= 728, bnk);
  await c.close(); }
/* 4) hata modları sayfada */
for (const [mod, beklenen] of [["401", "giris_gerekli"], ["429", "cok_istek"], ["500", "sunucu_hatasi"], ["sizinti", "sizinti"]]) {
  const { c, p } = await ac(A.url + "?katalog=1", { mod, bekle: 600 });
  const r = await p.evaluate(async () => { const s = await KAT.yukle(); return { ok: s.ok, durum: s.durum, n: s.sorular.length, ham: JSON.stringify(s), bank: BANK.length, bekle: s.bekleSn }; });
  t(`11 ${mod}: durum '${beklenen}', soru verilmez, BANK'a düşülmez (BANK ${r.bank} aynı)`, r.ok === false && r.durum === beklenen && r.n === 0 && !/SIRRI/.test(r.ham) && r.bank >= 728 && (mod !== "429" || r.bekle === 30), JSON.stringify(r).slice(0, 300));
  await c.close(); }
A.s.close(); await b.close();
console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
