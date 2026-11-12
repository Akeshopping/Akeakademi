// Acil kaynak erişim yaması: birim + yapısal testler (gerçek Pages sunumu için bkz. tests/pages-erisim-regresyon.mjs).
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath, pathToFileURL } from "node:url";
import { KORUNAN_KLASORLER, HERKESE_ACIK_KLASORLER, HERKESE_ACIK_DOSYALAR, YAYIN_DISI_DOSYALAR, korunanMi, korumaYaniti } from "../lib/yol-koruma.js";
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const izlenen = execFileSync("git", ["ls-files"], { cwd: KOK, encoding: "utf8" }).split("\n").filter(Boolean);
const mod = async (y) => import(pathToFileURL(path.join(KOK, y)).href);

test("1) korunan klasörler: tüm biçimler (kodlu, çift eğik çizgi, nokta-nokta, büyük harf, ters eğik çizgi, çift kodlama) korunur", () => {
  for (const k of KORUNAN_KLASORLER) for (const y of [`/${k}`, `/${k}/`, `/${k}/a/b.js`, `//${k}/a`, `/${k}//a`, `/./${k}/a`, `/x/../${k}/a`, `/${k.toUpperCase()}/a`, `/${k[0].toUpperCase() + k.slice(1)}/a`, `/${k}%2fa`, `/%${k.charCodeAt(0).toString(16)}${k.slice(1)}/a`, `/${k}%5ca`, `/${k}./a`, `/%25${k.charCodeAt(0).toString(16)}${k.slice(1)}/a`, `/icons/%2e%2e/${k}/a`, `/sss/..%2f${k}/a`])
    assert.equal(korunanMi(y), true, y);
  for (const y of ["/.git/config", "/.gitignore", "/.env", "/a/.dev.vars", "/_headers", "/_redirects", "/_routes.json", "/_worker.js", "/%2egit/config", "/%E0%A4%A"]) assert.equal(korunanMi(y), true, y);
});
test("2) herkese açık yollar ve API'ler korunmaz", () => {
  for (const y of ["/", "/index.html", "/sw.js", "/ayar.js", "/manifest.webmanifest", "/icons/icon-192.png", "/sss/", "/matematik-yks-sorulari/", "/acilis/", "/acilis/vendor/three.module.min.js", "/sorular/liste.json", "/api/hesap/ben", "/api/soru/oturum", "/api/sorular", "/api/sosyal/lig", "/api/yonetim/ozet", "/robots.txt", "/sitemap.xml", "/.well-known/security.txt", "/fabrikasyon", "/docsis/x", "/library/x"]) assert.equal(korunanMi(y), false, y);
});
test("3) kapatma yanıtı: 404 + no-store + nosniff, kaynak içermez", async () => {
  const r = korumaYaniti(); assert.equal(r.status, 404); assert.match(r.headers.get("cache-control"), /no-store/); assert.equal(r.headers.get("x-content-type-options"), "nosniff"); assert.equal(await r.text(), "Not found");
});
test("4) rota dosyaları: her korunan klasör için functions/<k>/[[yol]].js var, her yönteme 404 + no-store döner", async () => {
  for (const k of KORUNAN_KLASORLER) {
    const f = path.join(KOK, "functions", k, "[[yol]].js"); assert.ok(fs.existsSync(f), f);
    const { onRequest } = await mod(`functions/${k}/[[yol]].js`);
    for (const m of ["GET", "HEAD", "POST", "PUT", "DELETE"]) { const r = await onRequest({ request: new Request("https://x.test/" + k + "/a", { method: m }) }); assert.equal(r.status, 404); assert.match(r.headers.get("cache-control"), /no-store/); }
  }
  const dizinler = fs.readdirSync(path.join(KOK, "functions"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).filter(d => d !== "api");
  assert.deepEqual(dizinler.sort(), [...KORUNAN_KLASORLER, "sorular"].sort(), "functions/ altında yalnız api + sorular (B4 kapatma rotası) + korunan klasör rotaları olmalı");
});
test("5) _middleware: korunan yolu keser, diğerini next()'e geçirir", async () => {
  const { onRequest } = await mod("functions/_middleware.js"); let gecti = 0; const next = () => { gecti++; return new Response("tamam"); };
  for (const y of ["//fabrika/yazim/r01-mat.mjs", "/%66abrika/x", "/sss/..%2flib/ortak.js", "/.git/config"]) { const r = await onRequest({ request: new Request("https://x.test" + y), next }); assert.equal(r.status, 404, y); }
  assert.equal(gecti, 0);
  for (const y of ["/", "/api/hesap/ben", "/sorular/liste.json", "/icons/icon-192.png"]) { const r = await onRequest({ request: new Request("https://x.test" + y), next }); assert.equal(await r.text(), "tamam", y); }
  assert.equal(gecti, 4);
});
test("6) yapısal: depodaki her üst düzey öğe 'korunan' ya da 'bilerek herkese açık' olarak sınıflandırılmış (yeni klasör sessizce yayına girmesin)", () => {
  const ust = [...new Set(izlenen.map(f => f.split("/")[0] + (f.includes("/") ? "/" : "")))], bilinen = new Set([...KORUNAN_KLASORLER.map(k => k + "/"), ...HERKESE_ACIK_KLASORLER.map(k => k + "/"), ...HERKESE_ACIK_DOSYALAR, ...YAYIN_DISI_DOSYALAR, "_routes.json"]);
  assert.deepEqual(ust.filter(u => !bilinen.has(u)), [], "sınıflandırılmamış üst düzey öğe: lib/yol-koruma.js içindeki listelere ekleyin");
  for (const f of YAYIN_DISI_DOSYALAR) assert.equal(korunanMi("/" + f), true, f);
});
test("7) _routes.json: tüm istekler Function'a gider; dışlananlar YALNIZ tam dosya yolu (joker yok), hepsi izlenen gerçek dosya; ≤100 kural", () => {
  const r = JSON.parse(fs.readFileSync(path.join(KOK, "_routes.json"), "utf8"));
  assert.equal(r.version, 1); assert.deepEqual(r.include, ["/*"]); assert.ok(r.exclude.length + 1 <= 100);
  for (const e of r.exclude) { assert.ok(!e.includes("*"), "joker dışlama atlatma açığı yaratır (/dizin/..%2ffabrika): " + e); assert.ok(e === "/" || izlenen.includes(e.slice(1)), "izlenmeyen dosya: " + e); assert.equal(korunanMi(e), false, "korunan yol dışlanamaz: " + e); }
  assert.ok(!r.exclude.some(e => /^\/(api|fabrika|docs|tests|lib|migrations|functions)\b/.test(e)));
});
test("8) B4 uyumu: functions/sorular varsa (B4 kapatma rotası) /sorular/ dışlanamaz — yoksa kapatma sessizce çalışmaz", () => {
  if (!fs.existsSync(path.join(KOK, "functions", "sorular"))) return;
  const r = JSON.parse(fs.readFileSync(path.join(KOK, "_routes.json"), "utf8")); assert.deepEqual(r.exclude.filter(e => e.startsWith("/sorular/")), [], "B4 birleşince /sorular/* dışlamaları _routes.json'dan kaldırılmalı");
});
test("9) hassas dosya taraması: izlenen dosyalarda sır/özel anahtar/.env/sqlite/yedek yok; koruma modülü sır içermez", () => {
  const ad = izlenen.filter(f => /(^|\/)\.env|\.dev\.vars$|\.pem$|\.key$|\.sqlite|\.db$|\.bak$|\.log$|\.zip$/i.test(f)); assert.deepEqual(ad, []);
  const sir = /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[bp]-[A-Za-z0-9-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{30,})/;
  for (const f of izlenen.filter(f => /\.(js|mjs|json|md|html|sql|txt|css|webmanifest)$/.test(f) && !f.startsWith("acilis/vendor/"))) assert.ok(!sir.test(fs.readFileSync(path.join(KOK, f), "utf8")), "sır benzeri içerik: " + f);
});
