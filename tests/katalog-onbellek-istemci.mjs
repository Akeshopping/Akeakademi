// B4 Aşama 3B-2 · GERÇEK Chromium HTTP önbelleği: yenileme/temizleme/çıkış sonrası tarayıcının bayat yanıtı KULLANILMAZ.
// A aşaması eski sunucu başlığı (max-age=300, geçiş riski), B aşaması yeni "private, no-store". Sunucu gerçek bir yerel HTTP sunucusudur (page.route DEĞİL: route, HTTP önbelleğini devre dışı bırakırdı) ve yanıtı "private, max-age=300" ile verir (gerçek API gibi).
// Sentetik veri; Production/Preview/D1'e dokunulmaz. Çalıştırma: node tests/katalog-onbellek-istemci.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), YENI = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"), "utf8");
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 400)); };
const N = 20, OS = 3, FIX = 2, veri = (surum, kul = "x") => [...Array(N)].map((_, i) => { const q = { id: "s" + String(i).padStart(3, "0"), s: ["mat", "turkce"][i % 2], t: "Konu " + (i % 3), d: 1 + (i % 3), q: "v" + surum + "-soru-" + i + "-" + kul, o: ["A", "B", "C", "D", "E"].map(h => h + i) }; if (i < OS) q.os = 1; else if (i < OS + FIX) q.fix = 1; return q; });
const D = { surum: 1, katalogIstek: 0, basliklar: [], cc: "private, max-age=300" };   // A aşaması: ESKİ sunucu başlığı (geçiş riski); B aşaması: yeni "private, no-store"
const srv = http.createServer((q, r) => { const u = new URL(q.url, "http://x"), f = u.pathname;
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(YENI); }
  if (f === "/api/soru/katalog") { D.katalogIstek++; D.basliklar.push({ cc: q.headers["cache-control"] || "", pragma: q.headers["pragma"] || "" });
    const kul = ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1]; if (!kul) { r.statusCode = 401; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); return r.end("{}"); }
    const l = veri(D.surum, kul); r.setHeader("content-type", "application/json"); r.setHeader("cache-control", D.cc); return r.end(JSON.stringify({ n: l.length, bayrak: "hazir", sorular: l, sonraki: null })); }
  if (f.startsWith("/api/")) { r.statusCode = 404; r.setHeader("content-type", "application/json"); return r.end("{}"); }
  r.statusCode = 404; r.end(""); });
await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
/* page.route/context.route HTTP önbelleğini DEVRE DIŞI bırakır; bu yüzden dış kaynaklar ağ düzeyinde engellenir (yalnız 127.0.0.1 çözülür) */
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"] }), c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce" }), p = await c.newPage();
await p.addInitScript(() => { window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; });
await c.addCookies([{ name: "oturum", value: "1", url: URL0 }]);
const y = await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(800);
const sag = await p.evaluate(() => ({ kat: typeof KAT !== "undefined", h: typeof KHAVUZ !== "undefined" })); if (!y || y.status() !== 200 || !sag.kat || !sag.h) { console.error("TEST GEÇERSİZ: " + JSON.stringify(sag)); process.exit(2); }
const dogrudan = () => p.evaluate(async () => { const r = await fetch("/api/soru/katalog?limit=1000"); const j = r.ok ? await r.json() : null; return { st: r.status, q: j && j.sorular[0].q }; });
const ydeger = () => p.evaluate(() => ["mat", "turkce"].flatMap(s => KHAVUZ.poolOf(s).sorular).map(q => q.q.split("-")[0])[0]);
const bek = { beklenenToplam: N, beklenenOs: OS, beklenenFix: FIX };

/* OLUMLU KONTROL: HTTP önbelleği gerçekten çalışıyor mu? (çalışmıyorsa aşağıdaki testler anlamsız → GEÇERSİZ) */
D.katalogIstek = 0; const a1 = await dogrudan(); const a2 = await dogrudan();
if (!(a1.st === 200 && a2.st === 200 && D.katalogIstek === 1)) { console.error("TEST GEÇERSİZ: tarayıcı HTTP önbelleği bu ortamda çalışmıyor " + JSON.stringify({ a1, a2, istek: D.katalogIstek })); process.exit(2); }
t("0 olumlu kontrol: tarayıcı HTTP önbelleği AKTİF (iki doğrudan istek, sunucuya 1 kez gitti)", true);
D.surum = 2; const a3 = await dogrudan(); t("0a olumsuz kontrol: sunucu v2 olmuşken normal (default) istek BAYAT v1'i döndürür", a3.q.startsWith("v1-"), a3.q);

/* 1) yenile:true → sunucuya gider, taze veri */
D.katalogIstek = 0; D.basliklar = [];
const r1 = await p.evaluate(async bek => { const r = await KHAVUZ.yukle({ ...bek, yenile: true }); return { ok: r.ok, d: r.durum }; }, bek); const v1 = await ydeger();
t("1 yenile:true: tarayıcı önbelleği ATLANDI (sunucuya gitti) ve taze v2 alındı", r1.ok && D.katalogIstek === 1 && v1 === "v2", JSON.stringify([r1, D.katalogIstek, v1]));
t("1a istek 'reload' kipinde gitti (Cache-Control/Pragma: no-cache başlığı)", D.basliklar.length === 1 && /no-cache/.test(D.basliklar[0].cc + D.basliklar[0].pragma), JSON.stringify(D.basliklar));
const a4 = await dogrudan(); t("1b yenileme tarayıcı önbelleğini de GÜNCELLEDİ (sonraki normal istek v2)", a4.q.startsWith("v2-"));
/* 2) temizle() sonrası ilk yükleme */
D.surum = 3; D.katalogIstek = 0; await p.evaluate(() => KHAVUZ.temizle()); const r2 = await p.evaluate(async bek => (await KHAVUZ.yukle(bek)).ok, bek); const v2 = await ydeger();
t("2 KHAVUZ.temizle() + yükleme: tarayıcı önbelleği atlandı, taze v3 (HTTP önbelleğinde v2 varken)", r2 === true && D.katalogIstek === 1 && v2 === "v3", JSON.stringify([r2, D.katalogIstek, v2]));
/* 3) normal ikinci yükleme (bellekten) */
D.katalogIstek = 0; await p.evaluate(async bek => KHAVUZ.yukle(bek), bek); t("3 temizlenmeden tekrar çağrı bellekten döner (sunucuya gidilmez)", D.katalogIstek === 0);
/* 4) çıkış → temizle → giriş yok */
await c.clearCookies(); D.katalogIstek = 0;
const a5 = await dogrudan(); t("4 OLUMSUZ KONTROL: çıkıştan sonra normal (default) istek, sunucuya gitmeden BAYAT 200 alır → oturumsuz kullanıcıya katalog sızardı; temizle()+'reload' gerekçesi GERÇEK", a5.st === 200 && D.katalogIstek === 0, JSON.stringify([a5, D.katalogIstek]));
await p.evaluate(() => KHAVUZ.temizle());
const r4 = await p.evaluate(async bek => { const r = await KHAVUZ.yukle(bek); return { ok: r.ok, d: r.durum, n: KHAVUZ.durumu().toplam }; }, bek);
t("4a çıkış + temizle(): HTTP önbelleğinde 200 yanıt VARKEN bile sunucuya gidilir ve 'giris_gerekli' alınır; havuz BOŞ", r4.ok === false && r4.d === "giris_gerekli" && r4.n === 0 && D.katalogIstek === 1, JSON.stringify([r4, D.katalogIstek]));
/* 5) yeniden giriş */
await c.addCookies([{ name: "oturum", value: "1", url: URL0 }]); D.surum = 5; D.katalogIstek = 0;
const r5 = await p.evaluate(async bek => (await KHAVUZ.yukle(bek)).ok, bek); const v5 = await ydeger(); t("5 yeniden giriş sonrası yükleme taze veri alır (v5)", r5 === true && v5 === "v5" && D.katalogIstek === 1, JSON.stringify([r5, v5, D.katalogIstek]));
/* 6) eski istek geç tamamlanması gerçek tarayıcıda: yavaş sunucu yanıtı + temizle */
await p.evaluate(() => KHAVUZ.temizle()); D.surum = 6;
const gecik = await p.evaluate(async bek => { const p1 = KHAVUZ.yukle({ ...bek, yenile: true }); KHAVUZ.temizle(); const r1 = await p1; return { d: r1.durum, hazir: KHAVUZ.durumu().ok, durum: KHAVUZ.durumu().durum }; }, bek);
t("6 gerçek tarayıcıda: yükleme sürerken temizle() → eski iş 'iptal', havuz boş kalır", gecik.d === "iptal" && gecik.hazir === false && gecik.durum === "bos", JSON.stringify(gecik));

/* ===== B) sunucu artık 'private, no-store' (lib/soru-api.js düzeltmesi) ===== */
D.cc = "private, no-store"; D.surum = 7; D.katalogIstek = 0;
const kullanici = () => p.evaluate(() => ["mat", "turkce"].flatMap(s => KHAVUZ.poolOf(s).sorular).map(q => q.q.split("-").pop())[0]);
const b1 = await dogrudan();
t("B1 GEÇİŞ RİSKİ: eski 'max-age=300' ile saklanmış yanıt, sunucu no-store'a geçse de KENDİLİĞİNDEN silinmez (normal istek sunucuya gitmeden bayat 200 alır)", b1.st === 200 && D.katalogIstek === 0 && b1.q.startsWith("v6-"), JSON.stringify([b1, D.katalogIstek]));
await p.evaluate(() => KHAVUZ.temizle()); const rb2 = await p.evaluate(async bek => (await KHAVUZ.yukle(bek)).ok, bek);
t("B2 geçişte mevcut KAT 'reload' davranışı korundu: temizle()+yükleme eski kaydı atlayıp sunucudan taze v7 aldı", rb2 === true && D.katalogIstek === 1 && (await ydeger()) === "v7", JSON.stringify([rb2, D.katalogIstek]));
const b3 = await dogrudan(); t("B3 no-store yanıtı alındıktan sonra eski max-age kaydı DEĞİŞTİRİLDİ/SİLİNDİ: normal istek artık sunucuya gider", b3.st === 200 && D.katalogIstek === 2 && b3.q.startsWith("v7-"), JSON.stringify([b3, D.katalogIstek]));
D.surum = 8; const b4 = await dogrudan(), b5 = await dogrudan(); t("B4 no-store: art arda normal istekler HER SEFERİNDE sunucuya gider; güncel veri (v8) hemen görünür", b4.q.startsWith("v8-") && b5.q.startsWith("v8-") && D.katalogIstek === 4, JSON.stringify([b4.q, b5.q, D.katalogIstek]));
D.katalogIstek = 0; await c.clearCookies(); const b6 = await dogrudan();
t("B5 ÇIKIŞ: aynı istek sunucuya GİDER ve 401 alır (bayat 200 yok)", b6.st === 401 && D.katalogIstek === 1, JSON.stringify([b6, D.katalogIstek]));
await c.addCookies([{ name: "oturum", value: "alice", url: URL0 }]); const al = await dogrudan(); await c.addCookies([{ name: "oturum", value: "bob", url: URL0 }]); const bo = await dogrudan();
t("B6 HESAP DEĞİŞİMİ: alice'ten bob'a geçince bob'un isteği sunucuya gider ve alice'in yanıtı GERİ GELMEZ", al.q.endsWith("-alice") && bo.q.endsWith("-bob") && !bo.q.includes("alice"), JSON.stringify([al.q, bo.q]));
await c.addCookies([{ name: "oturum", value: "alice", url: URL0 }]); await p.evaluate(() => KHAVUZ.temizle()); await p.evaluate(async bek => KHAVUZ.yukle(bek), bek); const ka = await kullanici();
await c.addCookies([{ name: "oturum", value: "bob", url: URL0 }]); const eskiKalir = await p.evaluate(async bek => { const r = await KHAVUZ.yukle(bek); return r.ok; }, bek); const havuzKul = await kullanici();
await p.evaluate(() => KHAVUZ.temizle()); await p.evaluate(async bek => KHAVUZ.yukle(bek), bek); const kb = await kullanici();
t("B7 KHAVUZ bellek havuzu: temizle() ÇAĞRILMAZSA alice'in havuzu bellekte kalır (AYRI TAKİP MADDESİ: çıkış/hesap değişiminde temizle() şart); çağrılınca bob'un taze verisi gelir", ka === "alice" && havuzKul === "alice" && kb === "bob", JSON.stringify([ka, havuzKul, kb]));
await b.close(); srv.close(); console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
