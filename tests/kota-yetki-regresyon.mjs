// Kota yetkisi regresyonu: hesap sunucusu varken ücretsiz/ücretli kararı sunucudan (HESAP) gelir, yerel WEBAI'den değil.
// Sahte (mock) hesap API'siyle gerçek tarayıcıda çalışır; gerçek veriye dokunmaz.
// Çalıştırma: node tests/kota-yetki-regresyon.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(readFileSync(KOK + "/index.html")); } r.statusCode = 404; r.end("yok"); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch(); let gecen = 0, kalan = 0;
const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : ek); };
const J = (o, st = 200) => ({ status: st, contentType: "application/json", body: JSON.stringify(o) });
const SERBEST = { sinirsiz: false, limit: { soru: 20, deneme: 1 }, kalanSoru: 20, kalanDeneme: 1 };
const PAKET = { plan: "premium", bitis: "2099-01-01", kod: "TEST-KOD" };
const KULLANICI = { id: "k1", eposta: "test@ornek.com", ad: "Test" };

/* sen: { ben: 'ucretsiz' | 'ucretli' | 'oturumsuz' | 'asili', ls: {...yerel kayıtlar} } */
async function sayfa(sen) {
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const p = await c.newPage(), kota = [], hatalar = []; let serbest = Object.assign({}, SERBEST); let birak = null;
  p.on("pageerror", e => hatalar.push(e.message));
  await p.addInitScript(ls => { for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, v); }, sen.ls || {});
  await p.route("**/api/**", async r => {
    const u = new URL(r.request().url()), y = u.pathname.replace("/api/hesap/", "");
    if (!u.pathname.startsWith("/api/hesap/")) return r.fulfill(J({}, 404));
    if (y === "ben") {
      if (sen.ben === "asili") await new Promise(res => { birak = res; });
      if (sen.ben === "oturumsuz") return r.fulfill(J({ error: "giris" }, 401));
      const o = { kullanici: KULLANICI, kullanim: { mesaj: 0, guclu: 0 }, limit: { mesaj: 0, guclu: 0 }, ayar: { google: false, eposta: true } };
      if (sen.ben === "ucretli") { o.paket = PAKET; o.ucretsiz = { sinirsiz: true }; } else { o.paket = null; o.ucretsiz = Object.assign({}, serbest); }
      return r.fulfill(J(o));
    }
    if (y === "kota" && r.request().method() === "POST") {
      const g = JSON.parse(r.request().postData() || "{}"); kota.push(g);
      if (sen.ben === "ucretli") return r.fulfill(J({ sinirsiz: true, verildi: g.adet }));
      if (g.tur === "deneme") { if (serbest.kalanDeneme < 1) return r.fulfill(J({ error: "limit", ...serbest }, 402)); serbest.kalanDeneme--; return r.fulfill(J({ ...serbest, verildi: 1 })); }
      const v = Math.min(g.adet, serbest.kalanSoru); if (v < 1) return r.fulfill(J({ error: "limit", ...serbest }, 402));
      serbest.kalanSoru -= v; return r.fulfill(J({ ...serbest, verildi: v }));
    }
    return r.fulfill(J({}, y === "veri" ? 200 : 404));
  });
  await p.goto(URL0 + "#bugun", { waitUntil: "load" });
  if (sen.ben !== "asili") await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 }); await p.waitForTimeout(500);
  return { c, p, kota, hatalar, birak: () => birak && birak() };
}
const baslat = (p, n, mod = "study") => p.evaluate(async ([n, mod]) => {
  RUN = null; UI.modal = null; const qs = BANK.filter(x => !x.p && x.o && x.o.length >= 4).slice(0, n).map((x, i) => Object.assign({}, x, { id: x.id + "-t" + i }));
  startRun({ kind: mod === "exam" ? "exam" : "practice", title: "Test", mode: mod, qs, secs: [{ n: "T", from: 0, to: qs.length }], dur: mod === "exam" ? 5 : 0 });
  await new Promise(r => setTimeout(r, 700)); return { run: RUN ? RUN.qs.length : 0, modal: UI.modal ? UI.modal.title : null };
}, [n, mod]);
const LSP = (bitis) => Object.assign({ "ake.kod": "ESKI-KOD", "ake.plan": "premium" }, bitis === undefined ? {} : { "ake.bitis": bitis });

/* 1) giriş yapmış ücretsiz hesap + yerel Premium → ücretsiz sayılır, kota çağrılır */
{ const s = await sayfa({ ben: "ucretsiz", ls: LSP("2099-01-01") }); const [mi, w] = await s.p.evaluate(() => [ucretsizMi(), WEBAI.plan]);
  t("1a Yerel Premium kaydı gerçekten yüklü (test geçerli)", w === "premium"); t("1b HESAP.user var, paket yok, yerel Premium → ucretsizMi() true", mi === true);
  const r = await baslat(s.p, 1); t("1c 1 soru başlatma /api/hesap/kota POST'una gitti", s.kota.length === 1 && s.kota[0].tur === "soru" && s.kota[0].adet === 1 && r.run === 1, JSON.stringify({ kota: s.kota, r }));
  t("1d Sayfa hatası yok", s.hatalar.length === 0, s.hatalar.join("|")); await s.c.close(); }
/* 2) aynı durumda WEBAI.bitis ne olursa olsun sonuç değişmez */
for (const [ad, bt] of [["gelecekte", "2099-01-01"], ["boş", ""], ["geçmişte", "2020-01-01"], ["yok", undefined]]) {
  const s = await sayfa({ ben: "ucretsiz", ls: LSP(bt) }); const mi = await s.p.evaluate(() => ucretsizMi()); await baslat(s.p, 1);
  t(`2 WEBAI.bitis ${ad} → yine ücretsiz, kota çağrıldı`, mi === true && s.kota.length === 1, JSON.stringify(s.kota)); await s.c.close(); }
/* 3) giriş yapmış + sunucudan geçerli paket → ücretli, kota çağrılmaz */
{ const s = await sayfa({ ben: "ucretli" }); const mi = await s.p.evaluate(() => ucretsizMi()); const r1 = await baslat(s.p, 25), r2 = await baslat(s.p, 5, "exam");
  t("3a Sunucu paketi → ucretsizMi() false", mi === false); t("3b 25 soru ve deneme engelsiz başladı", r1.run === 25 && !r1.modal && r2.run === 5 && !r2.modal, JSON.stringify({ r1, r2 }));
  t("3c Ücretli kullanıcıda kota POST çağrısı yok", s.kota.length === 0, JSON.stringify(s.kota)); await s.c.close(); }
/* 4) oturumsuz + eskiden kalmış yerel Premium → giriş istenir, soru başlamaz, kota çağrılmaz */
{ const s = await sayfa({ ben: "oturumsuz", ls: LSP("2099-01-01") }); const mi = await s.p.evaluate(() => ucretsizMi()); const r = await baslat(s.p, 3);
  t("4a Oturumsuz + yerel Premium → ucretsizMi() true", mi === true); t("4b Soru başlamadı, ücretsiz giriş penceresi açıldı", r.run === 0 && r.modal === "Devam etmek için ücretsiz giriş yap", JSON.stringify(r));
  const r2 = await baslat(s.p, 3, "exam"); t("4c Deneme de aynı şekilde giriş istedi", r2.run === 0 && r2.modal === "Devam etmek için ücretsiz giriş yap", JSON.stringify(r2)); await s.c.close(); }
/* 5) hesap henüz yüklenmediyse yerel Premium geçiş vermez (fail closed) */
{ const s = await sayfa({ ben: "asili", ls: LSP("2099-01-01") }); const [hz, mi] = await s.p.evaluate(() => [HESAP.hazir, ucretsizMi()]); const r = await baslat(s.p, 3);
  t("5a Hesap yüklenmedi (hazir=false) → ucretsizMi() true", hz === false && mi === true, JSON.stringify({ hz, mi })); t("5b Soru başlamadı ve kota çağrısı yok", r.run === 0 && s.kota.length === 0, JSON.stringify({ r, kota: s.kota })); s.birak(); await s.c.close(); }
/* 6) normal ücretsiz davranış: 20 soru / 1 deneme */
{ const s = await sayfa({ ben: "ucretsiz" }); const r1 = await baslat(s.p, 15), r2 = await baslat(s.p, 10), r3 = await baslat(s.p, 1);
  t("6a 15 soru başladı", r1.run === 15, JSON.stringify(r1)); t("6b 10 istendi, kalan 5 kadar verildi", r2.run === 5, JSON.stringify(r2)); t("6c Hak bitince sınır penceresi, soru yok", r3.run === 0 && r3.modal === "Bugünkü ücretsiz sorun bitti", JSON.stringify(r3));
  const d1 = await baslat(s.p, 5, "exam"), d2 = await baslat(s.p, 5, "exam"); t("6d İlk deneme başladı", d1.run === 5, JSON.stringify(d1)); t("6e İkinci deneme engellendi", d2.run === 0 && d2.modal === "Bu ayki ücretsiz denemen bitti", JSON.stringify(d2)); await s.c.close(); }
/* 7) hesap sunucusu gerçekten yoksa (Claude paneli / çevrimdışı) eski yerel davranış korunur */
{ const s = await sayfa({ ben: "oturumsuz", ls: LSP("2099-01-01") }); const o = await s.p.evaluate(() => { HESAP.yok = true; const a = ucretsizMi(); WEBAI.plan = ""; WEBAI.bitis = ""; return [a, ucretsizMi()]; });
  t("7a Sunucu yokken yerel Premium geçerli (ücretsiz değil)", o[0] === false); t("7b Sunucu yokken yerel kayıt yoksa ücretsiz", o[1] === true); await s.c.close(); }
console.log(`\n${gecen} geçti, ${kalan} kaldı`); await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
