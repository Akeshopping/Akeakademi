// Fail-closed regresyonu: üretim ana makinesinde (akeakademi.com) hesap sunucusu doğrulanamıyorsa
// (ağ hatası, zaman aşımı, 5xx, çevrimdışı, yükleniyor) cihazdaki eski Premium kaydı yetki VERMEZ.
// Yalnızca localhost/127.0.0.1 (geliştirme önizlemesi) kontrollü yerel yedeğe düşebilir.
// Sahte (mock) hesap API'siyle gerçek tarayıcıda çalışır; gerçek veriye dokunmaz.
// Çalıştırma: node tests/hesap-fail-closed.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(readFileSync(KOK + "/index.html")); } r.statusCode = 404; r.end("yok"); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const PORT = srv.address().port;
const URETIM = `http://akeakademi.com:${PORT}/`, DEV = `http://127.0.0.1:${PORT}/`;
// akeakademi.com'u yerel sunucuya yönlendir: sayfa gerçekten üretim ana makinesinde çalışır
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP akeakademi.com 127.0.0.1"] });
let gecen = 0, kalan = 0;
const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : ek); };
const J = (o, st = 200) => ({ status: st, contentType: "application/json", body: JSON.stringify(o) });
const KULLANICI = { id: "k1", eposta: "test@ornek.com", ad: "Test" };
const PAKET = { plan: "premium", bitis: "2099-01-01", kod: "TEST-KOD" };
const MESAJ = /doğrulanamadı/i;
const LS_PREMIUM = { "ake.kod": "ESKI-KOD", "ake.plan": "premium", "ake.bitis": "2099-01-01" };

/* sen.ben: 'ag-hatasi' | 'asili' | '500' | '404' | '401' | 'ucretsiz' | 'ucretli' ; sen.url: sayfa adresi */
async function sayfa(sen) {
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const p = await c.newPage(), kota = [], hatalar = []; let serbest = { sinirsiz: false, limit: { soru: 20, deneme: 1 }, kalanSoru: 20, kalanDeneme: 1 };
  p.on("pageerror", e => hatalar.push(e.message));
  await p.addInitScript(ls => { try { if (!sessionStorage.getItem("__ls")) { for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, v); sessionStorage.setItem("__ls", "1"); } } catch (e) { } }, sen.ls || {});
  await p.route("**/api/**", async r => {
    const u = new URL(r.request().url()), y = u.pathname.replace("/api/hesap/", "");
    if (!u.pathname.startsWith("/api/hesap/")) return r.fulfill(J({}, 404));
    if (y === "ben") {
      if (sen.ben === "ag-hatasi") return r.abort("connectionrefused");
      if (sen.ben === "asili") return new Promise(() => { });
      if (sen.ben === "500") return r.fulfill(J({ error: "sunucu" }, 500));
      if (sen.ben === "404") return r.fulfill(J({ error: "yok" }, 404));
      if (sen.ben === "401") return r.fulfill(J({ error: "giris" }, 401));
      const o = { kullanici: KULLANICI, kullanim: { mesaj: 0, guclu: 0 }, limit: { mesaj: 0, guclu: 0 }, ayar: { google: false, eposta: true } };
      if (sen.ben === "ucretli") { o.paket = PAKET; o.ucretsiz = { sinirsiz: true }; } else { o.paket = null; o.ucretsiz = Object.assign({}, serbest); }
      return r.fulfill(J(o));
    }
    if (y === "kota" && r.request().method() === "POST") {
      const g = JSON.parse(r.request().postData() || "{}"); kota.push(g);
      if (sen.kotaAg) return r.abort("connectionrefused");
      if (sen.ben === "ucretli") return r.fulfill(J({ sinirsiz: true, verildi: g.adet }));
      const v = Math.min(g.adet, serbest.kalanSoru); if (v < 1) return r.fulfill(J({ error: "limit", ...serbest }, 402));
      serbest.kalanSoru -= v; return r.fulfill(J({ ...serbest, verildi: v }));
    }
    return r.fulfill(J({}, y === "veri" ? 200 : 404));
  });
  await p.goto((sen.url || URETIM) + "#bugun", { waitUntil: "load" });
  await p.waitForTimeout(sen.bekle === undefined ? 1200 : sen.bekle);
  return { c, p, kota, hatalar };
}
const baslat = (p, n, mod = "study") => p.evaluate(async ([n, mod]) => {
  RUN = null; UI.modal = null; const qs = BANK.filter(x => !x.p && x.o && x.o.length >= 4).slice(0, n).map((x, i) => Object.assign({}, x, { id: x.id + "-t" + i }));
  startRun({ kind: mod === "exam" ? "exam" : "practice", title: "Test", mode: mod, qs, secs: [{ n: "T", from: 0, to: qs.length }], dur: mod === "exam" ? 5 : 0 });
  await new Promise(r => setTimeout(r, 500)); return { run: RUN ? RUN.qs.length : 0, modal: UI.modal ? UI.modal.title : null, metin: document.body.innerText };
}, [n, mod]);
const yetkisiz = (s, r) => r.run === 0 && s.kota.length === 0;
const durum = p => p.evaluate(() => ({ mi: ucretsizMi(), yok: HESAP.yok, hazir: HESAP.hazir, plan: WEBAI.plan }));

/* 1) üretim + ağ hatası + eski Premium → ücretli sayılmaz, soru/deneme başlamaz, doğrulama mesajı */
{ const s = await sayfa({ ben: "ag-hatasi", ls: LS_PREMIUM }); const d = await durum(s.p);
  t("1a Yerel Premium kaydı yüklü (test geçerli)", d.plan === "premium");
  t("1b Ağ hatasında ucretsizMi() true (yetki yok)", d.mi === true, JSON.stringify(d));
  t("1c Ağ hatası 'hesap sunucusu yok' (HESAP.yok) sayılmaz", d.yok === false, JSON.stringify(d));
  const r1 = await baslat(s.p, 3), r2 = await baslat(s.p, 3, "exam");
  t("1d Soru başlamadı, kota çağrısı yok", yetkisiz(s, r1), JSON.stringify({ r: r1.run, kota: s.kota }));
  t("1e Deneme başlamadı", yetkisiz(s, r2), JSON.stringify({ r: r2.run, kota: s.kota }));
  t("1f Doğrulama mesajı gösterildi", MESAJ.test(r1.metin), "mesaj yok");
  t("1g 'Paket al/Giriş yap' modalı açılmadı (sorun üyelik değil)", !r1.modal, String(r1.modal));
  t("1h Sayfa hatası yok", s.hatalar.length === 0, s.hatalar.join("|")); await s.c.close(); }
/* 2) üretim + zaman aşımı/asılı + Premium → başlamaz (yüklenirken ve zaman aşımından sonra) */
{ const s = await sayfa({ ben: "asili", ls: LS_PREMIUM, bekle: 800 }); const d = await durum(s.p); const r = await baslat(s.p, 3);
  t("2a Asılı hesap cevabı: hazır değil, soru başlamadı", d.hazir === false && yetkisiz(s, r), JSON.stringify({ d, r: r.run, kota: s.kota }));
  await s.p.waitForTimeout(13000); const d2 = await durum(s.p); const r2 = await baslat(s.p, 3), r3 = await baslat(s.p, 2, "exam");
  t("2b Zaman aşımı sonrası da yetki yok, soru/deneme başlamadı", d2.mi === true && d2.yok === false && yetkisiz(s, r2) && yetkisiz(s, r3), JSON.stringify({ d2, a: r2.run, b: r3.run, kota: s.kota }));
  t("2c Zaman aşımında doğrulama mesajı", MESAJ.test(r2.metin)); await s.c.close(); }
/* 3) üretim + 5xx/404 + Premium → başlamaz */
for (const m of ["500", "404"]) { const s = await sayfa({ ben: m, ls: LS_PREMIUM }); const d = await durum(s.p); const r = await baslat(s.p, 3), r2 = await baslat(s.p, 3, "exam");
  t(`3 API ${m} + yerel Premium → yetki yok, soru/deneme yok`, d.mi === true && d.yok === false && yetkisiz(s, r) && yetkisiz(s, r2), JSON.stringify({ d, a: r.run, b: r2.run, kota: s.kota })); await s.c.close(); }
/* 4) üretim + çevrimdışı + Premium → yeni oturum başlamaz */
{ const sen = { ben: "ucretsiz", ls: LS_PREMIUM }; const s = await sayfa(sen); await s.c.setOffline(true); sen.kotaAg = true;
  const r = await baslat(s.p, 3, "study");
  t("4a Çevrimdışı (kota isteği ağa çıkamıyor) → soru başlamadı", r.run === 0, JSON.stringify({ r: r.run })); await s.c.close(); }
{ const s = await sayfa({ ben: "ag-hatasi", ls: LS_PREMIUM, bekle: 800 }); await s.c.setOffline(true); const r = await baslat(s.p, 3, "exam");
  t("4b Hesap yüklenemedi + çevrimdışı → deneme başlamadı", yetkisiz(s, r), JSON.stringify({ r: r.run, kota: s.kota })); await s.c.close(); }
/* 5) üretim + 401 + Premium → giriş modalı */
{ const s = await sayfa({ ben: "401", ls: LS_PREMIUM }); const d = await durum(s.p); const r = await baslat(s.p, 3);
  t("5 API 401 + yerel Premium → giriş penceresi, soru yok", d.mi === true && r.run === 0 && r.modal === "Devam etmek için ücretsiz giriş yap" && s.kota.length === 0, JSON.stringify({ d, r: r.run, modal: r.modal })); await s.c.close(); }
/* 6) üretim + sunucu ücretsiz + yerel Premium → ücretsiz sayılır, kota POST kullanılır */
{ const s = await sayfa({ ben: "ucretsiz", ls: LS_PREMIUM }); const d = await durum(s.p); const r = await baslat(s.p, 1);
  t("6 Sunucu ücretsiz + yerel Premium → ücretsiz, kota POST'u gitti", d.mi === true && r.run === 1 && s.kota.length === 1 && s.kota[0].tur === "soru", JSON.stringify({ d, r: r.run, kota: s.kota })); await s.c.close(); }
/* 7) üretim + sunucu Premium → sınırsız, kota POST 0 */
{ const s = await sayfa({ ben: "ucretli" }); const d = await durum(s.p); const r = await baslat(s.p, 25), r2 = await baslat(s.p, 5, "exam");
  t("7 Sunucu Premium → ücretli, 25 soru + deneme engelsiz, kota POST yok", d.mi === false && r.run === 25 && r2.run === 5 && s.kota.length === 0, JSON.stringify({ d, a: r.run, b: r2.run, kota: s.kota })); await s.c.close(); }
/* 8) üretim + hesap cevabı henüz yükleniyor → fail closed */
{ const s = await sayfa({ ben: "asili", ls: LS_PREMIUM, bekle: 500 }); const d = await durum(s.p); const r = await baslat(s.p, 3);
  t("8 Yükleniyor: hazır değil, Premium geçiş vermez", d.hazir === false && d.mi === true && yetkisiz(s, r), JSON.stringify({ d, r: r.run, kota: s.kota })); await s.c.close(); }
/* 9) localhost/127.0.0.1 geliştirme önizlemesi: kontrollü yerel yedek korunur */
{ const s = await sayfa({ url: DEV, ben: "404", ls: LS_PREMIUM }); const d = await durum(s.p); const r = await baslat(s.p, 25);
  t("9a Dev ortamında hesap sunucusu yok → yerel yedek (HESAP.yok) aktif", d.yok === true, JSON.stringify(d));
  t("9b Dev ortamında yerel Premium geçerli, 25 soru engelsiz", d.mi === false && r.run === 25 && s.kota.length === 0, JSON.stringify({ d, r: r.run })); await s.c.close(); }
{ const s = await sayfa({ url: DEV, ben: "ag-hatasi" }); const d = await durum(s.p); const r = await baslat(s.p, 15), r2 = await baslat(s.p, 10);
  t("9c Dev + yerel Premium yok → yerel 20 soru sayacı çalışır", d.yok === true && d.mi === true && r.run === 15 && r2.run === 5, JSON.stringify({ d, a: r.run, b: r2.run })); await s.c.close(); }
/* 10) üretimde localStorage'ı elle değiştirmek davranışı değiştirmez (ağ hatası + sonradan değiştirilmiş kayıtlar) */
{ const s = await sayfa({ ben: "ag-hatasi", ls: {} });
  await s.p.evaluate(() => { localStorage.setItem("ake.plan", "premium"); localStorage.setItem("ake.bitis", "2099-12-31"); localStorage.setItem("ake.kod", "UYDURMA"); WEBAI.plan = "premium"; WEBAI.bitis = "2099-12-31"; WEBAI.code = "UYDURMA"; });
  const d = await durum(s.p); const r = await baslat(s.p, 3);
  t("10a Elle yazılan Premium kaydı üretimde yetki vermez", d.mi === true && yetkisiz(s, r), JSON.stringify({ d, r: r.run, kota: s.kota }));
  // sayfa yeniden yüklendiğinde de aynı
  await s.p.reload({ waitUntil: "load" }); await s.p.waitForTimeout(1200); const d2 = await durum(s.p); const r2 = await baslat(s.p, 3);
  t("10b Yenilemeden sonra da yetki yok", d2.mi === true && yetkisiz(s, r2), JSON.stringify({ d2, r: r2.run }));
  // window.claude taklidi üretim ana makinesinde yerel moda geçirmez
  await s.c.close(); }
{ const c = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" }); const p = await c.newPage(); const kota = [];
  await p.addInitScript(() => { window.claude = { use() { } }; for (const [k, v] of Object.entries({ "ake.kod": "X", "ake.plan": "premium", "ake.bitis": "2099-01-01" })) localStorage.setItem(k, v); });
  await p.route("**/api/**", r => { if (/\/api\/hesap\/kota/.test(r.request().url())) kota.push(1); return r.abort("connectionrefused"); });
  await p.goto(URETIM + "#bugun", { waitUntil: "load" }); await p.waitForTimeout(1200);
  const d = await durum(p); const r = await baslat(p, 3);
  t("10c Üretimde window.claude taklidi yerel Premium yedeğine geçirmez", d.mi === true && d.yok === false && r.run === 0 && kota.length === 0, JSON.stringify({ d, r: r.run })); await c.close(); }
/* 11) geçici hata sonrası toparlanma: "Tekrar dene" ile sunucu doğrulanır, ücretsiz kota normal çalışır */
{ const sen = { ben: "ag-hatasi", ls: LS_PREMIUM }; const s = await sayfa(sen); const r0 = await baslat(s.p, 2); sen.ben = "ucretsiz";
  await s.p.evaluate(async () => { await OZ_ACT.hesapTekrarDene(); }); const d = await durum(s.p); const r1 = await baslat(s.p, 2);
  t("11 Hata sonrası 'Tekrar dene' → hesap doğrulandı, ücretsiz kota POST'uyla soru başladı", r0.run === 0 && d.mi === true && r1.run === 2 && s.kota.length === 1, JSON.stringify({ r0: r0.run, d, r1: r1.run, kota: s.kota })); await s.c.close(); }
/* 12) stale-Premium: sayfa açıkken sunucu Premium'u doğruladı, SONRA hesap API'si bozuldu → bellekteki eski paket yetki vermez */
const yenile = p => p.evaluate(async () => { await hesapBenDene(); return { hata: HESAP.hata, paket: !!HESAP.paket, mi: ucretsizMi() }; });
for (const [ad, mod, off] of [["ağ hatası", "ag-hatasi", false], ["500", "500", false], ["zaman aşımı", "asili", false], ["çevrimdışı", "ag-hatasi", true]]) {
  const sen = { ben: "ucretli" }; const s = await sayfa(sen);
  const once = await durum(s.p), r0 = await baslat(s.p, 5);
  sen.ben = mod; if (off) await s.c.setOffline(true);
  const h = await yenile(s.p); sen.kotaAg = true;
  const r1 = await baslat(s.p, 5), r2 = await baslat(s.p, 3, "exam");
  t(`12 Premium doğrulandı → ${ad} → önce normal (sınırsız), sonra hata`, once.mi === false && r0.run === 5 && h.hata === true, JSON.stringify({ once, r0: r0.run, h }));
  t(`12 Premium doğrulandı → ${ad} → eski paket yetki vermez (ucretsizMi true), practice/exam başlamaz, mesaj var`, h.mi === true && r1.run === 0 && r2.run === 0 && MESAJ.test(r1.metin + r2.metin), JSON.stringify({ h, a: r1.run, b: r2.run }));
  t(`12 Premium doğrulandı → ${ad} → üyelik arayüzü bozulmadı (paket belleğte, hata yok)`, h.paket === true && s.hatalar.length === 0, s.hatalar.join("|") + JSON.stringify(h)); await s.c.close(); }
/* 12e) hata geçince "Tekrar dene" ile sunucu Premium'u yeniden doğrular → normal sınırsız davranış geri gelir */
{ const sen = { ben: "ucretli" }; const s = await sayfa(sen); sen.ben = "500"; const h = await yenile(s.p); const rEngel = await baslat(s.p, 5);
  sen.ben = "ucretli"; sen.kotaAg = false; await s.p.evaluate(async () => { await OZ_ACT.hesapTekrarDene(); }); const d = await durum(s.p); const rOk = await baslat(s.p, 25), rEx = await baslat(s.p, 5, "exam");
  t("12e Hata → Tekrar dene → sunucu Premium yeniden doğrulandı → 25 soru + deneme engelsiz, kota POST yok", h.hata === true && rEngel.run === 0 && d.mi === false && rOk.run === 25 && rEx.run === 5 && s.kota.length === 0, JSON.stringify({ h, e: rEngel.run, d, a: rOk.run, b: rEx.run, kota: s.kota })); await s.c.close(); }
console.log(`\n${gecen} geçti, ${kalan} kaldı`); await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
