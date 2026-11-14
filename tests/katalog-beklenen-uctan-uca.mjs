// B4 Aşama 3B-5 · katalog `beklenen` sözleşmesi UÇTAN UCA: gerçek Chromium + gerçek /api/hesap ve /api/soru işleyicileri + yerel izole SQLite (node:sqlite).
// Production/Preview D1'e dokunmaz; migration'ı YALNIZ yerel test veritabanına uygular. Gerçek cevap anahtarı yazdırılmaz.
// Çalıştırma: node tests/katalog-beklenen-uctan-uca.mjs   (Playwright + chromium gerekir). Mutasyon denemesi için KAT_HTML=<değiştirilmiş index.html>
import { createRequire } from "module"; import http from "node:http"; import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
import { kur, sizintiBul, SORU_ANAHTARLARI } from "./yardim/soru-v2.mjs";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
const hesapMod = await import(pathToFileURL(path.join(KOK, "functions/api/hesap/[[yol]].js")).href);
const soruMod = await import(pathToFileURL(path.join(KOK, "functions/api/soru/[[yol]].js")).href);
const { BAYRAK_HAZIR_ID } = await import(pathToFileURL(path.join(KOK, "lib/soru-api.js")).href);
const GOC = readFileSync(path.join(KOK, "migrations/0003_soru_meta.sql"), "utf8");
const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(HTML); } r.statusCode = 404; r.end(); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch(); let gecen = 0, kalan = 0;
const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 500)); };
const O0 = "https://akeakademi.com", KATYOL = "/api/soru/katalog";

/* yerel BANK'ı bir kez oku; sunucu tablosunu ondan doldur (cevaplar yalnız yerel test veritabanında) */
const okuyucu = await (await b.newContext({ serviceWorkers: "block" })).newPage();
await okuyucu.goto(URL0, { waitUntil: "load" });
const BANKA = await okuyucu.evaluate(() => BANK.filter(q => !q.p).map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, a: q.a, x: q.x })));
await okuyucu.context().close();
const N = BANKA.length;
const T = await kur({ bayrak: "1" }); await T.hazirla(); const DB = T.DB.db;
{ const ins = DB.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, ?, ?, NULL, 'banka', 0, 0, 'statik', ?, ?, ?, ?, ?, NULL)");
  DB.exec("BEGIN"); BANKA.forEach((q, i) => ins.run(q.id, q.s, q.t, q.d, i + 1, "h-" + q.id, JSON.stringify({ q: q.q, o: q.o }), q.a, q.x)); DB.exec("COMMIT"); }
const ekle = (id, govde) => DB.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, 'mat', 'K9', 2, NULL, 'banka', 0, 0, 'statik', 9999, ?, ?, 1, 'COZUM-' || ?, NULL)").run(id, "h-" + id, govde, id);
const gecerliGovde = id => JSON.stringify({ q: "Eklenen soru " + id, o: ["a", "b", "c", "d", "e"] });
const temizEk = () => DB.exec("DELETE FROM soru WHERE id LIKE 'zz-%'");

/* senaryo ortamı: her senaryo kendi kullanıcısı (katalog hız sınırı saatte 30 istek/kullanıcı) */
let say = 0;
async function ortam() { const g = await T.giris("uu" + (++say) + "-" + Math.floor(Math.random() * 1e9) + "@ornek.com"); return { g, env: Object.assign({}, T.env, { AKE_SORU_V2: "1" }), istekler: [], katNo: 0, once: null, degistir: null }; }
async function sayfa(O) {
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
  await c.addInitScript(() => { window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; });
  const p = await c.newPage(), hatalar = []; p.on("pageerror", e => hatalar.push(e.message));
  await p.route("**/api/**", async r => {
    const rq = r.request(), u = new URL(rq.url()), yol = u.pathname, soru = yol.startsWith("/api/soru/"), hesap = yol.startsWith("/api/hesap/");
    if (!soru && !hesap) return r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    const m = rq.method(), govde = m === "GET" || m === "HEAD" ? undefined : rq.postData() || undefined;
    const ad = yol.replace(soru ? "/api/soru/" : "/api/hesap/", ""), no = yol === KATYOL ? O.katNo++ : -1;
    if (O.once) await O.once(yol, no);   // test kancası: istek sunucuya GİTMEDEN önce (gerçek API'den önce) çalışır
    const req = new Request(O0 + yol + u.search, { method: m, headers: { "content-type": "application/json", cookie: O.g.cookie, origin: O0, "cf-connecting-ip": "10.9.9." + (1 + (say % 200)) }, body: govde });
    const y = await (soru ? soruMod : hesapMod).onRequest({ request: req, env: O.env, params: { yol: ad.split("/") } });
    let tx = await y.text(); const cc = y.headers.get("cache-control") || "";
    if (O.degistir && no >= 0) tx = O.degistir(tx, no, u) ?? tx;   // yanıtı İSTEMCİYE giderken kurcalar (sunucu/aracı bozulması taklidi)
    O.istekler.push({ yol, m, durum: y.status, tx, cc, no });
    const h = {}; y.headers.forEach((v, k) => { if (k !== "set-cookie" && k !== "content-encoding" && k !== "content-length") h[k] = v; });
    return r.fulfill({ status: y.status, headers: h, body: tx });
  });
  await p.goto(URL0 + "#bugun", { waitUntil: "load" });
  await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); await p.waitForTimeout(250);
  return { c, p, hatalar };
}
const katIstek = O => O.istekler.filter(i => i.yol === KATYOL);
const katYukle = (p, o) => p.evaluate(o => KAT.yukle(o).then(r => ({ ok: r.ok, durum: r.durum, denendi: r.denendi || 0, n: r.sorular.length, bek: r.beklenen || null, hazir: r.bayrakHazir, sayim: r.sayim || null })), o);
const havuzYukle = (p, o) => p.evaluate(o => KHAVUZ.yukle(o || {}).then(r => ({ ok: r.ok, durum: r.durum, toplam: r.toplam, os: r.os, fix: r.fix, hazir: r.bayrakHazir })), o);
const j = i => JSON.parse(i.tx);

/* ===== 1) YENİ YANIT KAT TARAFINDAN REDDEDİLMEZ: 4 sayfa, ilk/son sayfa beklenen nesnesi, ara sayfa null; işaret tablosu yok → os/fix null ===== */
{ const O = await ortam(), { c, p, hatalar } = await sayfa(O);
  const r = await katYukle(p, { limit: 200, yenile: true });
  t("1 gerçek API yanıtı KAT'ta KABUL edilir (reddedilmez): " + N + " soru, 4 sayfa", r.ok === true && r.n === N && r.sayim.sayfa === 4, JSON.stringify(r));
  const ist = katIstek(O); t("1a tam 4 katalog isteği; hepsi 200 ve 'private, no-store'", ist.length === 4 && ist.every(i => i.durum === 200 && /no-store/.test(i.cc) && /private/.test(i.cc)), ist.map(i => i.durum + ":" + i.cc).join(" | "));
  const [a, bb, cc, d] = ist.map(j);
  t("1b sunucu: ilk ve son sayfada beklenen nesnesi (toplam=" + N + ", os/fix null), ara sayfalarda null", JSON.stringify(a.beklenen) === JSON.stringify({ toplam: N, os: null, fix: null }) && JSON.stringify(d.beklenen) === JSON.stringify(a.beklenen) && bb.beklenen === null && cc.beklenen === null, JSON.stringify([a.beklenen, bb.beklenen, cc.beklenen, d.beklenen]));
  t("1c istemci sonucu: beklenen = sunucunun doğruladığı sayılar; bayrak eksik → bayrakHazir=false", r.bek && r.bek.toplam === N && r.bek.os === null && r.bek.fix === null && r.hazir === false, JSON.stringify(r.bek));
  const h = await havuzYukle(p); t("1d KHAVUZ sabit 1127/52/37 OLMADAN kurulur (toplam = sunucu sayısı " + N + ")", h.ok === true && h.toplam === N && h.hazir === false && N !== 1127, JSON.stringify(h));
  t("1e sayfa hatası yok", hatalar.length === 0, hatalar.join("|"));
  /* 2) CEVAP SIZINTISI: gerçek yanıtta cevap/çözüm alanı ya da metni yok */
  const sayfalar = ist.map(j), ham = ist.map(i => i.tx).join("\n");
  t("2 gerçek yanıtlarda yasak alan yok (a,x,h,rk,json,kopya_of,kaynak,govde); soru anahtarları izin listesinde", sayfalar.every(s => sizintiBul(s).length === 0 && s.sorular.every(q => Object.keys(q).every(k => SORU_ANAHTARLARI.has(k)))) && Object.keys(sayfalar[0]).sort().join() === "bayrak,beklenen,n,sonraki,sorular", Object.keys(sayfalar[0]).join());
  t("2a hiçbir sayfada çözüm metni ('COZUM-' ya da BANK x alanı) yok", !/COZUM-/.test(ham) && BANKA.filter(q => typeof q.x === "string" && q.x.length > 25).slice(0, 80).every(q => !ham.includes(q.x)));
  /* 3) ÖNBELLEK: ikinci çağrı ağa gitmez; yenile ağa gider; temizle() sonrası ağa gider */
  const n0 = katIstek(O).length; const r2 = await katYukle(p, { limit: 200 }); t("3 aynı oturumda ikinci yükleme önbellekten: yeni ağ isteği YOK", r2.ok && katIstek(O).length === n0);
  await p.evaluate(() => KHAVUZ.temizle()); const r3 = await katYukle(p, { limit: 200 }); t("3a temizle() sonrası yükleme yeniden sunucuya gider (4 istek) ve kabul edilir", r3.ok && katIstek(O).length === n0 + 4, katIstek(O).length - n0);
  await c.close(); }

/* ===== 4) İŞARET HAZIR: os/fix sunucu sayıları = istemcinin saydığı gerçek işaret sayıları; KHAVUZ bunları sunucudan alır ===== */
DB.exec(GOC); { const ins = DB.prepare("INSERT OR REPLACE INTO soru_meta (id, os, fix) VALUES (?, ?, ?)"); DB.exec("BEGIN"); BANKA.slice(0, 12).forEach(q => ins.run(q.id, 1, 0)); BANKA.slice(20, 27).forEach(q => ins.run(q.id, 0, 1)); ins.run(BANKA[40].id, 1, 1); ins.run(BAYRAK_HAZIR_ID, 0, 0); ins.run("yetim-1", 1, 1); DB.exec("COMMIT"); }
{ const O = await ortam(), { c, p } = await sayfa(O);
  const r = await katYukle(p, { limit: 200, yenile: true });
  t("4 bayrak hazır: sunucu os=13 fix=8 bildirir, istemci aynısını sayar", r.ok && r.hazir === true && r.bek.os === 13 && r.bek.fix === 8 && r.sayim.os === 13 && r.sayim.fix === 8 && r.bek.toplam === N, JSON.stringify(r));
  const ist = katIstek(O); t("4a ara sayfalarda yine null (os/fix sayımı yalnız ilk/son)", ist.length === 4 && j(ist[1]).beklenen === null && j(ist[2]).beklenen === null && j(ist[0]).beklenen.os === 13 && j(ist[3]).beklenen.fix === 8);
  const h = await havuzYukle(p, { yenile: true }); t("4b KHAVUZ os/fix'i sunucu sayısıyla denetler ve kurar (sabit yok)", h.ok && h.hazir && h.os === 13 && h.fix === 8 && h.toplam === N, JSON.stringify(h));
  /* açık beklenen değerler (test için) sunucununkinin yerine geçer; uyuşmazsa havuz KURULMAZ */
  const hy = await havuzYukle(p, { yenile: true, beklenenOs: 14 }); t("4c açıkça verilen yanlış os → bayrak_sayim_uyusmuyor, havuz kurulmaz", !hy.ok && hy.durum === "bayrak_sayim_uyusmuyor", JSON.stringify(hy));
  await c.close(); }

/* ===== 5) SAYFALAR ARASI DEĞİŞİM ===== */
{ /* 5a) geçici: ikinci sayfa isteğinden önce bir soru eklenir → ilk sayım N, son sayım N+1 → TEK yeniden deneme → tutarlı N+1 */
  const O = await ortam(), { c, p } = await sayfa(O); let yapildi = false;
  O.once = async (yol, no) => { if (yol === KATYOL && no === 1 && !yapildi) { yapildi = true; ekle("zz-gecici-1", gecerliGovde("zz-gecici-1")); } };
  const r = await katYukle(p, { limit: 200, yenile: true });
  t("5 geçici değişim: tek yeniden denemeyle kurulur, soru sayısı " + (N + 1) + " (8 katalog isteği)", r.ok && r.n === N + 1 && r.bek.toplam === N + 1 && katIstek(O).length === 8, JSON.stringify(r) + " istek=" + katIstek(O).length);
  const ilkTarama = katIstek(O).slice(0, 4).map(j); t("5a ilk taramada sunucu gerçekten çelişkili sayı verdi (ilk " + N + ", son " + (N + 1) + ")", ilkTarama[0].beklenen.toplam === N && ilkTarama[3].beklenen.toplam === N + 1);
  temizEk(); await c.close(); }
{ /* 5b) kalıcı: HER taramada araya soru girer → en fazla BİR yeniden deneme, sonra açık hata; havuz kurulmaz; sabit sayıya düşülmez */
  const O = await ortam(), { c, p } = await sayfa(O); let k = 0;
  let eklendi = false;   // her taramada (sonra'sız sayfa taramayı başlatır) ikinci sayfa isteğinden önce BİR soru girer
  O.once = async (yol, no) => { if (yol !== KATYOL) return; if (no % 4 === 0) eklendi = false; if (no % 4 === 1 && !eklendi) { eklendi = true; k++; ekle("zz-surekli-" + k, gecerliGovde("zz-surekli-" + k)); } };
  const r = await katYukle(p, { limit: 200, yenile: true });
  t("5b kalıcı tutarsızlık: tutarsiz_sayim, denendi=2, soru verilmez, tam 8 istek (sonsuz döngü yok)", !r.ok && r.durum === "tutarsiz_sayim" && r.denendi === 2 && r.n === 0 && katIstek(O).length === 8, JSON.stringify(r) + " istek=" + katIstek(O).length);
  temizEk(); await c.close(); }

/* ===== 6) BOZUK SAYIM / BOZUK GÖVDE ===== */
{ /* sunucu tarafında bozuk gövdeli UYGUN satır: ne sayfada ne toplamda görünür → katalog tutarlı kalır */
  ekle("zz-bozuk-1", "{bozuk json"); ekle("zz-bozuk-2", JSON.stringify({ q: "x", o: ["a", "b"] }));
  const O = await ortam(), { c, p } = await sayfa(O); const r = await katYukle(p, { limit: 200, yenile: true });
  t("6 bozuk gövdeli satırlar sayıma da sayfaya da girmez: katalog tutarlı, " + N + " soru", r.ok && r.n === N && r.bek.toplam === N, JSON.stringify(r)); temizEk(); await c.close(); }
/* KAT limit=200 ile 4 sayfa tarar; KHAVUZ varsayılan limitle TEK sayfa (ilk=son) tarar. Kurcalama sayfanın KONUMUNA bakar (sayaç değil): ILK = 'sonra' yok, SON = sonraki null, ARA = ikisi de değil */
const bozKosu = async (ad, degistir, beklenen, { havuz = true } = {}) => {
  const O = await ortam(), { c, p } = await sayfa(O); O.degistir = degistir; const r = await katYukle(p, { limit: 200, yenile: true }); const k = katIstek(O).length;
  const h = havuz ? await havuzYukle(p, { yenile: true }) : null;
  t(`6${ad}: KAT '${beklenen.durum}'${beklenen.denendi ? " (denendi=2, " + (beklenen.istek || 8) + " istek)" : ""}${havuz ? "; KHAVUZ da aynı açık hatayla durur" : ""}; katalog/havuz kurulmaz`, !r.ok && r.durum === beklenen.durum && r.n === 0 && (!beklenen.denendi || (r.denendi === 2 && k === (beklenen.istek || 8))) && (!havuz || (!h.ok && h.durum === beklenen.durum)), JSON.stringify([r, h]) + " istek=" + k);
  await c.close(); };
const degis = (konum, f) => (tx, n, u) => { const o = JSON.parse(tx), ilk = !u.searchParams.get("sonra"), son = o.sonraki === null, ara = !ilk && !son; if ((konum === "ilk" && ilk) || (konum === "son" && son) || (konum === "uc" && (ilk || son)) || (konum === "ara" && ara) || konum === "her") { f(o); return JSON.stringify(o); } };
await bozKosu("a toplam gerçek sayıdan 1 fazla (son sayfa ve ilk sayfa uyumlu)", degis("uc", o => { o.beklenen.toplam += 1; }), { durum: "tutarsiz_sayim", denendi: true });
await bozKosu("b ilk ≠ son sayım", degis("son", o => { o.beklenen.toplam -= 1; }), { durum: "tutarsiz_sayim", denendi: true });
await bozKosu("c ilk sayfada beklenen null (sessizce sabit sayıya DÖNÜLMEZ)", degis("ilk", o => { o.beklenen = null; }), { durum: "sayim_yok", denendi: true, istek: 2 });   // ilk sayfada hemen durur: tarama başına 1 istek
await bozKosu("d son sayfada beklenen null", degis("son", o => { o.beklenen = null; }), { durum: "sayim_yok", denendi: true });
await bozKosu("e ara sayfada beklenen nesnesi", degis("ara", o => { o.beklenen = { toplam: N, os: null, fix: null }; }), { durum: "bozuk_yanit" }, { havuz: false });   // KHAVUZ tek sayfa tarar: ara sayfa yok
await bozKosu("f beklenen içinde fazladan alan", degis("ilk", o => { o.beklenen.cevap = "SIRRI"; }), { durum: "sizinti" });
await bozKosu("g üst düzeyde bilinmeyen alan", degis("her", o => { o.cevaplar = [1, 2]; }), { durum: "sizinti" });
await bozKosu("h soruda cevap alanı (a)", degis("ilk", o => { o.sorular[3].a = 2; }), { durum: "sizinti" });
await bozKosu("i soruda çözüm alanı (x)", degis("son", o => { o.sorular[0].x = "SIRRI-COZUM"; }), { durum: "sizinti" });
await bozKosu("j beklenen anahtarı yok", degis("ilk", o => { delete o.beklenen; }), { durum: "bozuk_yanit" });
await bozKosu("k beklenen.toplam metin", degis("son", o => { o.beklenen.toplam = String(o.beklenen.toplam); }), { durum: "bozuk_yanit" });
{ /* bayrak eksikken os/fix sayısı yok; hazırken os (sunucu) gerçek işaret sayısına uymalı — ikisi de ilk+son sayfada aynı kalsa bile */
  await bozKosu("l bayrak hazır, os/fix sayısı gerçek işaretlerle uyuşmuyor (ilk=son)", degis("uc", o => { o.beklenen.os = 14; }), { durum: "tutarsiz_sayim", denendi: true }); }

/* ===== 7) ÇIKIŞ SIRASINDA BEKLEYEN YÜKLEME ===== */
{ const O = await ortam(), { c, p } = await sayfa(O); let kapi, ac = new Promise(r => { kapi = r; }), vardi;
  const geldi = new Promise(r => { vardi = r; });
  O.once = async (yol, no) => { if (yol === KATYOL && no === 0) { vardi(); await ac; } };   // ilk katalog isteği sunucuya gitmeden BEKLETİLİR
  await p.evaluate(() => { window.__bek = KHAVUZ.yukle({ yenile: true }); });
  await geldi;
  await p.evaluate(async () => { await ACT.cikis.call(ACT); });   // çıkış: KHAVUZ.temizle() ilk iş, sonra gerçek /api/hesap/cikis
  const kapaliHalde = await p.evaluate(() => ({ s: KHAVUZ.durumu(), pool: KHAVUZ.poolOf("mat").ok }));
  kapi();
  const sonuc = await p.evaluate(() => window.__bek.then(r => ({ ok: r.ok, durum: r.durum, n: (r.sorular || []).length })));
  await p.waitForTimeout(300);
  const son = await p.evaluate(() => ({ s: KHAVUZ.durumu(), pool: KHAVUZ.poolOf("mat").ok }));
  t("7 çıkış anında havuz boş; bekleyen yükleme sonradan bitse bile 'iptal' döner", kapaliHalde.s.ok === false && kapaliHalde.s.toplam === 0 && !kapaliHalde.pool && sonuc.ok === false && sonuc.durum === "iptal" && sonuc.n === 0, JSON.stringify([kapaliHalde.s, sonuc]));
  t("7a geç biten iş havuzu/önbelleği GERİ DOLDURAMAZ", son.s.ok === false && son.s.toplam === 0 && !son.pool, JSON.stringify(son.s));
  const sonra = await katYukle(p, { limit: 200 }); t("7b çıkıştan sonra katalog istenirse önbellek yok: sunucuya gider ve 401 (giris_gerekli) alır", !sonra.ok && sonra.durum === "giris_gerekli" && sonra.n === 0, JSON.stringify(sonra));
  const son401 = katIstek(O).filter(i => i.durum === 401).length; t("7c sunucu çıkış sonrası 401 verdi (bayat yanıt yok)", son401 >= 1, son401);
  await c.close(); }

/* ===== 7d) ÇIKIŞ SIRASINDA BEKLEYEN DOĞRUDAN KAT YÜKLEMESİ (KHAVUZ'dan bağımsız): geç biten iş KAT önbelleğini DOLDURAMAZ ===== */
{ const O = await ortam(), { c, p } = await sayfa(O); let kapi, ac = new Promise(r => { kapi = r; }), vardi; const geldi = new Promise(r => { vardi = r; });
  O.once = async (yol, no) => { if (yol === KATYOL && no === 0) { vardi(); await ac; } };
  await p.evaluate(() => { window.__bekKat = KAT.yukle({ limit: 200, yenile: true }).then(r => ({ ok: r.ok, durum: r.durum, n: (r.sorular || []).length })); });
  await geldi; await p.evaluate(async () => { await ACT.cikis.call(ACT); }); kapi();
  const sonuc = await p.evaluate(() => window.__bekKat); await p.waitForTimeout(300);
  const n0 = katIstek(O).length; const sonra = await katYukle(p, { limit: 200 });
  t("7d KAT: çıkışta bekleyen yükleme 'iptal'; sonradan bitse de önbelleğe yazamaz (sonraki yükleme ağa gider, 401 alır)", sonuc.ok === false && sonuc.durum === "iptal" && sonuc.n === 0 && !sonra.ok && sonra.durum === "giris_gerekli" && katIstek(O).length > n0, JSON.stringify([sonuc, sonra, katIstek(O).length - n0]));
  await c.close(); }

/* ===== 8) 5000 SINIRI: sunucu ilk sayfada toplam > 5000 bildirirse istemci İLK İSTEKTE durur (tam-havuz yüklemesi için ayrı tasarım gerekir) ===== */
{ const ins = DB.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, 'mat', 'K9', 2, NULL, 'banka', 0, 0, 'statik', 9999, ?, ?, 1, 'COZUM-b', NULL)");
  DB.exec("BEGIN"); for (let i = 0; i < 4400; i++) { const id = "zz-b" + String(i).padStart(5, "0"); ins.run(id, "h-" + id, gecerliGovde(id)); } DB.exec("COMMIT");
  const O = await ortam(), { c, p } = await sayfa(O); const r = await katYukle(p, { limit: 200, yenile: true });
  t("8 toplam " + (N + 4400) + " > 5000: cok_soru, YALNIZ 1 istek (yeniden deneme yok), soru verilmez", !r.ok && r.durum === "cok_soru" && r.n === 0 && katIstek(O).length === 1 && j(katIstek(O)[0]).beklenen.toplam === N + 4400, JSON.stringify(r) + " istek=" + katIstek(O).length);
  temizEk(); await c.close(); }

await b.close(); srv.close();
console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
