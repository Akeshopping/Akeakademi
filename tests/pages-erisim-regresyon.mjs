// Gerçek Cloudflare Pages çalışma zamanında (wrangler pages dev: gerçek statik dosya sunumu + Functions yönlendirmesi) erişim testi.
// Yalnızca yerel; Production/Preview'a dokunmaz, ortam değişkeni/veritabanı kullanmaz.
// Çalıştırma:  WRANGLER_BIN=/yol/wrangler node tests/pages-erisim-regresyon.mjs        (WRANGLER_BIN yoksa `npx wrangler` denenir)
// Not: node --test ile çalışmaz (adı *.test.mjs değil); wrangler depo bağımlılığı değildir.
import { spawn, execFileSync } from "node:child_process"; import path from "node:path"; import { fileURLToPath } from "node:url"; import http from "node:http"; import net from "node:net";
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const izlenen = execFileSync("git", ["ls-files"], { cwd: KOK, encoding: "utf8" }).split("\n").filter(Boolean);
const PORT = 8800 + Math.floor(Math.random() * 150), TABAN = "http://127.0.0.1:" + PORT;
const bin = process.env.WRANGLER_BIN || "npx", args = (process.env.WRANGLER_BIN ? [] : ["--yes", "wrangler"]).concat(["pages", "dev", ".", "--port", String(PORT), "--ip", "127.0.0.1", "--compatibility-date=2024-11-01"]);
const sunucu = spawn(bin, args, { cwd: KOK, env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: "false", CI: "1" }), stdio: ["ignore", "pipe", "pipe"] }); let log = ""; sunucu.stdout.on("data", d => log += d); sunucu.stderr.on("data", d => log += d);
const bitir = k => { try { sunucu.kill("SIGTERM"); } catch (e) { } setTimeout(() => process.exit(k), 300); };
const al = (yol, { yontem = "GET", tamYol = false } = {}) => new Promise((ok, hata) => {   // tamYol: "/x/../y" gibi yolları istemci normalleştirmeden olduğu gibi gönder
  const r = http.request({ host: "127.0.0.1", port: PORT, path: yol, method: yontem, headers: { "user-agent": "erisim-testi" } }, y => { let b = ""; y.setEncoding("utf8"); y.on("data", d => { if (b.length < 4000) b += d; }); y.on("end", () => ok({ s: y.statusCode, h: y.headers, b })); });
  r.on("error", hata); r.setTimeout(8000, () => r.destroy(new Error("zaman aşımı"))); r.end();
});
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; if (!ok || process.env.AYRINTI) console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 260)); };
for (let i = 0; i < 90; i++) { try { await al("/"); break; } catch (e) { await new Promise(r => setTimeout(r, 1000)); if (i === 89) { console.log("ATLANDI/BAŞARISIZ: wrangler pages dev açılamadı\n" + log.slice(-600)); bitir(2); await new Promise(() => { }); } } }

const KORUNAN = ["fabrika", "docs", "tests", "lib", "migrations", "functions"];
const engelli = r => r.s === 404 && /no-store/.test(r.h["cache-control"] || "") && !/<html|import |export |SELECT |CREATE TABLE/i.test(r.b);
/* 1) korunan klasörlerdeki her izlenen dosya + klasör kökleri */
const dosyalar = izlenen.filter(f => KORUNAN.includes(f.split("/")[0]));
let acik = [];
for (const f of dosyalar) { const r = await al("/" + f.split("/").map(encodeURIComponent).join("/")); if (!engelli(r)) acik.push(f + " → " + r.s); }
t(`1 korunan klasörlerdeki ${dosyalar.length} dosyanın hepsi 404 + no-store`, acik.length === 0, acik.slice(0, 5).join(" | "));
for (const k of KORUNAN) for (const y of ["/" + k, "/" + k + "/", "/" + k + "/yok-boyle-bir-dosya.js"]) { const r = await al(y); t("2 klasör kökü/yok dosya engelli " + y, engelli(r), r.s + " " + (r.h["cache-control"] || "")); }
/* 3) atlatma denemeleri */
const varyant = [["yüzde kodlu harf", "/fabrika/%79azim/r01-mat.mjs"], ["yüzde kodlu eğik çizgi dizini", "/%66abrika/yazim/r01-mat.mjs"], ["çift eğik çizgi", "//fabrika/yazim/r01-mat.mjs"], ["çift eğik çizgi (iç)", "/fabrika//yazim/r01-mat.mjs"],
  ["nokta-nokta", "/icons/../fabrika/yazim/r01-mat.mjs"], ["nokta", "/./fabrika/yazim/r01-mat.mjs"], ["sorgu dizesi", "/fabrika/yazim/r01-mat.mjs?x=1"], ["parça", "/lib/ortak.js#a"], ["functions kaynak", "/functions/api/ai.js"], ["functions hesap", "/functions/api/hesap/[[yol]].js"], ["lib sunucu kaynağı", "/lib/soru-api.js"],
  ["dışlanan yol + kodlu nokta-nokta", "/icons/%2e%2e/fabrika/yazim/r01-mat.mjs"], ["dışlanan yol + kodlu eğik çizgi", "/sss/..%2ffabrika/yazim/r01-mat.mjs"], ["dışlanan yol + kodlu eğik çizgi 2", "/sss/%2e%2e%2ffabrika/yazim/r01-mat.mjs"], ["çift kodlama", "/%2566abrika/yazim/r01-mat.mjs"], ["kodlu eğik çizgi", "/fabrika%2fyazim%2fr01-mat.mjs"],
  ["ters eğik çizgi", "/fabrika%5Cyazim%5Cr01-mat.mjs"], ["sondaki nokta", "/fabrika./yazim/r01-mat.mjs"], ["büyük harf", "/Fabrika/yazim/r01-mat.mjs"], ["büyük harf lib", "/LIB/ortak.js"], ["docs kodlu", "/%64ocs/b2-hiz-siniri-dagitim.md"],
  ["tests kodlu nokta", "/./tests/soru-api.test.mjs"], ["migrations çift eğik", "//migrations/0001_hiz_siniri.sql"], ["_routes.json", "/_routes.json"], ["_headers", "/_headers"], [".git", "/.git/config"], ["functions çift eğik", "//functions/api/ai.js"]];
for (const [ad, y] of varyant) { const r = await al(y); const govde = r.b || ""; const kaynakSizdi = /(^|\n)\s*(import |export |\/\/ [A-Za-z]|# yerel göç|Cache-Control|\{\s*"version")/.test(govde) && !/<html/i.test(govde); t("3 atlatma: " + ad + " (" + y + ")", !kaynakSizdi && (r.s === 404 || r.s === 308 || r.s === 301 || (r.s === 200 && /<html/i.test(govde))), r.s + " " + govde.slice(0, 60)); }
for (const y of ["HEAD", "POST", "PUT", "DELETE", "OPTIONS"]) { const r = await al("/fabrika/yazim/r01-mat.mjs", { yontem: y }); t("4 yöntem " + y + " engelli (404, no-store)", r.s === 404 && /no-store/.test(r.h["cache-control"] || ""), r.s); }
/* 5) yayın dışı kök dosyaları: içerik asla dönmemeli (404 ya da SPA yedeği olarak HTML olabilir, ama dosya içeriği olmaz) */
for (const [y, imza] of [["/.gitignore", /sqlite|soru-cikti/], ["/_headers", /Content-Security-Policy|Strict-Transport/]]) { const r = await al(y); t("5 yayın dışı dosya içeriği sızmıyor " + y, !imza.test(r.b), r.s + " " + r.b.slice(0, 60)); }
/* 6) çalışması GEREKENLER: ana sayfa ve statik varlıklar */
const acikDosyalar = [["/", /<html/i, "text/html"],  ["/sw.js", /CACHE|self\.addEventListener|ake-s/, "javascript"], ["/ayar.js", /./, "javascript"], ["/manifest.webmanifest", /"name"/, ""], ["/robots.txt", /./, "text/plain"], ["/sitemap.xml", /<urlset/, "xml"],
  ["/sss/", /<html/i, "text/html"], ["/matematik-yks-sorulari/", /<html/i, "text/html"], ["/acilis/", /<html/i, "text/html"], ["/sorular/liste.json", /\[/, "json"], ["/favicon.ico", null, ""], ["/og.png", null, ""]];
for (const [y, re, ct] of acikDosyalar) { const r = await al(y); t("6 açık kalmalı: " + y, r.s === 200 && (!re || re.test(r.b)) && (!ct || (r.h["content-type"] || "").includes(ct)) && !/Not found$/.test(r.b.trim()), r.s + " " + (r.h["content-type"] || "")); }
const ih = await al("/index.html"); t("6 açık kalmalı: /index.html (200 ya da / adresine yönlendirme)", ih.s === 200 || ((ih.s === 308 || ih.s === 301) && /^\/?$|\/$/.test(String(ih.h.location || ""))), ih.s + " " + ih.h.location);
const ic = izlenen.filter(f => f.startsWith("icons/")).slice(0, 3); for (const f of ic) { const r = await al("/" + f); t("6 açık kalmalı: /" + f, r.s === 200, r.s); }
/* 7) API'ler Function olarak çalışmaya devam ediyor (veritabanı bağlı değil: hata biçimli JSON gelir, 'Not found' koruması DEĞİL) */
for (const [y, yon] of [["/api/sorular", "GET"], ["/api/soru/ozet", "GET"], ["/api/hesap/ben", "GET"], ["/api/hesap/giris", "POST"], ["/api/sosyal/lig", "GET"], ["/api/yonetim/ozet", "GET"], ["/api/hata", "POST"], ["/api/shopier", "POST"], ["/api/ai", "POST"], ["/api/acilis", "GET"], ["/api/geribildirim", "POST"], ["/api/bildirim/abone", "POST"]]) {
  const r = await al(y, { yontem: yon }); t("7 API rotası hâlâ çalışıyor " + yon + " " + y, (r.h["content-type"] || "").includes("json") && r.b.trim() !== "Not found" && !/no-store/.test("") , r.s + " " + (r.h["content-type"] || "") + " " + r.b.slice(0, 50)); }
console.log(`\n${gecen} geçti, ${kalan} kaldı`); bitir(kalan ? 1 : 0);
