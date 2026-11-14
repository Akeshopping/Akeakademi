// B4 Aşama 3B-3 · oturum geçişlerinde güvenli katalog/havuz temizliği (GERÇEK Chromium + yerel sahte API; Production/Preview/D1'e dokunulmaz).
// Doğrulananlar: ilk giriş / kimlik değişimi / çıkış / başarılı hesap silme / oturum kaybı → KHAVUZ.temizle(); çıkış başlar başlamaz bekleyen yükleme geçersiz (iptal);
// aynı kimlikle hesap bilgisi yenilenince hazır katalog korunur ve YENİ ağ isteği çıkmaz; başarısız hesap silme havuzu bozmaz.
// Çalıştırma: node tests/oturum-katalog-temizlik-istemci.mjs   (Playwright + chromium gerekir). Mutasyon denemesi için KAT_HTML=<değiştirilmiş index.html>
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), YENI = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"), "utf8");
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 400)); };
const N = 10, OS = 2, FIX = 1;
const veri = kul => [...Array(N)].map((_, i) => { const q = { id: "s" + String(i).padStart(3, "0"), s: ["mat", "turkce"][i % 2], t: "Konu " + (i % 3), d: 1 + (i % 3), q: "soru-" + i + "-K" + kul, o: ["A", "B", "C", "D", "E"].map(h => h + i) }; if (i < OS) q.os = 1; else if (i < OS + FIX) q.fix = 1; return q; });
const D = { cikisTut: null, katalogIstek: 0, tut: {}, silDurum: 200, benDurum: 200, benIstek: 0 };
const kulOf = q => ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
const js = (r, kod, o, h = {}) => { r.statusCode = kod; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); for (const k in h) r.setHeader(k, h[k]); r.end(JSON.stringify(o)); };
const srv = http.createServer(async (q, r) => {
  const f = new URL(q.url, "http://x").pathname, kul = kulOf(q);
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(YENI); }
  if (f === "/api/soru/katalog") {
    D.katalogIstek++; if (!kul) return js(r, 401, {});
    if (D.tut[kul]) await D.tut[kul].kapi;   // bekleyen yükleme: test serbest bırakana kadar yanıt gelmez
    { const l = veri(kul); return js(r, 200, { n: N, bayrak: "hazir", beklenen: { toplam: l.length, os: l.filter(q => q.os === 1).length, fix: l.filter(q => q.fix === 1).length }, sorular: l, sonraki: null }); }
  }
  if (f === "/api/hesap/ben") { D.benIstek++; if (!kul || D.benDurum === 401) return js(r, 401, { error: "giris" }); return js(r, 200, { kullanici: { id: kul, eposta: kul + "@x.test", ad: "" }, paket: null, ucretsiz: null, ayar: { google: false, eposta: true } }); }
  if (f === "/api/hesap/veri") return js(r, 200, { alanlar: {} });
  if (f === "/api/hesap/cikis") { if (D.cikisTut) await D.cikisTut.kapi; return js(r, 200, { ok: true }, { "set-cookie": "oturum=; Path=/; Max-Age=0" }); }
  if (f === "/api/hesap/sil") return js(r, D.silDurum, D.silDurum === 200 ? { ok: true } : { error: "x" }, D.silDurum === 200 ? { "set-cookie": "oturum=; Path=/; Max-Age=0" } : {});
  if (f.startsWith("/api/")) return js(r, 404, {});
  r.statusCode = 404; r.end("");
});
await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"] });
const bek = { beklenenToplam: N, beklenenOs: OS, beklenenFix: FIX };
const kapi = () => { let ac; const p = new Promise(o => { ac = o; }); return { kapi: p, ac }; };
async function yeniSayfa(kul) {
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce" }), p = await c.newPage();
  await p.addInitScript(() => { window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; });
  if (kul) await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]);
  const y = await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(900);
  const sag = await p.evaluate(() => ({ kat: typeof KAT !== "undefined", h: typeof KHAVUZ !== "undefined", f: typeof hesapKimlikGuncelle === "function", u: HESAP.user && HESAP.user.id, ac: typeof ACT.cikis === "function" || typeof SUB.cikis === "function" }));
  if (!y || y.status() !== 200 || !sag.kat || !sag.h || !sag.f || !sag.ac) { console.error("TEST GEÇERSİZ: sayfa/işlevler yok " + JSON.stringify(sag)); process.exit(2); }
  return { c, p, ilk: sag.u };
}
const hazirMi = p => p.evaluate(() => { const r = KHAVUZ.poolOf("mat"); return r.ok === true; });
const ornek = p => p.evaluate(() => { const r = KHAVUZ.poolOf("mat"); return r.ok ? r.sorular[0].q : null; });
const yukle = p => p.evaluate(async bek => { const r = await KHAVUZ.yukle(bek); return { ok: r.ok, d: r.durum }; }, bek);
const cikisCagir = p => p.evaluate(async () => { const f = ACT.cikis || SUB.cikis; await f.call(ACT); });

/* ---- 1) giriş + yenileme: ilk giriş temizler (yük yok), aynı kimlikle hesap bilgisi yenilenince hazır katalog KORUNUR ve yeni ağ isteği çıkmaz ---- */
{
  const { p, c, ilk } = await yeniSayfa("A"); t("1 sayfa A oturumuyla açıldı (HESAP.user = A)", ilk === "A", ilk);
  D.katalogIstek = 0; const r1 = await yukle(p); t("1a A kataloğu yüklendi (1 ağ isteği)", r1.ok && D.katalogIstek === 1 && await hazirMi(p), JSON.stringify([r1, D.katalogIstek]));
  const once = D.katalogIstek;
  const ayni = await p.evaluate(async bek => {   // gerçek hesap bilgisi yenilemesi: sunucudan /ben → hesapUygula (aynı kimlik; yeni nesne)
    const eski = HESAP.user; const d = await hesapBenDene(); const yeniNesne = HESAP.user !== eski; const hazir = KHAVUZ.poolOf("mat").ok;
    const r = await KHAVUZ.yukle(bek); return { d, yeniNesne, hazir, ok: r.ok, durum: r.durum };
  }, bek);
  t("1b aynı kimlikle /ben yenilemesi: katalog hâlâ hazır ve YENİ katalog isteği çıkmadı", ayni.d === "ok" && ayni.yeniNesne && ayni.hazir && ayni.ok && D.katalogIstek === once, JSON.stringify([ayni, D.katalogIstek, once]));
  const ayni2 = await p.evaluate(async () => { hesapUygula({ kullanici: { id: "A", eposta: "a@x.test" }, paket: { plan: "x", bitis: "" }, kullanim: { mesaj: 1 } }); return KHAVUZ.poolOf("mat").ok; });
  t("1c aynı kimlikle hesapUygula (paket/kullanım yenileme): havuz korunur", ayni2 === true && D.katalogIstek === once);
  /* 2) kimlik DEĞİŞİMİ: hazır katalog temizlenir, yeni yükleme gerekir */
  const degis = await p.evaluate(() => { hesapUygula({ kullanici: { id: "B", eposta: "b@x.test" } }); return KHAVUZ.poolOf("mat"); });
  t("2 kimlik A→B: A'nın hazır havuzu TEMİZLENDİ (hazir_degil)", degis.ok === false, JSON.stringify(degis).slice(0, 200));
  await c.close();
}

/* ---- 3) çıkış: bekleyen A yüklemesi çıkış başlar başlamaz geçersiz; B girdikten sonra tamamlanınca iptal ve B'nin havuzu değişmez ---- */
{
  const { p, c } = await yeniSayfa("A"); D.katalogIstek = 0; D.tut = { A: kapi() };
  const bekleyenA = p.evaluate(async bek => { const r = await KHAVUZ.yukle(bek); window.__A = r; return { ok: r.ok, d: r.durum }; }, bek);
  await p.waitForTimeout(400); t("3a A yüklemesi sunucuda BEKLİYOR", D.katalogIstek === 1);
  /* çıkış: temizle() çıkışın başında çalışmalı (sunucu yanıtını beklemeden) — çıkış isteğini yavaşlatmadan sıralamayı doğrudan nesil davranışıyla ölç */
  const cik = await p.evaluate(async () => { const f = ACT.cikis || SUB.cikis; const pr = f.call(ACT); const hemen = KHAVUZ.poolOf("mat").ok; await pr; return { hemen, user: HESAP.user }; });
  t("3b çıkış tamam: HESAP.user boş", cik.user === null, JSON.stringify(cik));
  await c.addCookies([{ name: "oturum", value: "B", url: URL0 }]);   // B giriş yaptı (sunucu çerezi)
  const bGiris = await p.evaluate(() => { hesapUygula({ kullanici: { id: "B", eposta: "b@x.test" } }); return HESAP.user && HESAP.user.id; });
  const rB = await yukle(p); const bq = await ornek(p);
  t("3c B girdi ve B kataloğunu yükledi (soru metni KB)", bGiris === "B" && rB.ok && /-KB$/.test(bq || ""), JSON.stringify([bGiris, rB, bq]));
  D.tut.A.ac();   // A'nın geç yanıtı şimdi geliyor
  const sA = await bekleyenA; await p.waitForTimeout(300);
  const bq2 = await ornek(p);
  t("3d geç biten A yüklemesi 'iptal' döndü (sorular boş)", sA.ok === false && sA.d === "iptal", JSON.stringify(sA));
  t("3e B'nin havuzu DEĞİŞMEDİ (A verisi sızmadı)", /-KB$/.test(bq2 || "") && bq2 === bq, bq2);
  D.tut = {}; await c.close();
}

/* ---- 3f) çıkış BAŞLAR BAŞLAMAZ (çıkış isteği daha dönmeden, HESAP.user hâlâ A iken) bekleyen A yüklemesi geçersiz kılınır ---- */
{
  const { p, c } = await yeniSayfa("A"); D.tut = { A: kapi() }; D.cikisTut = kapi();
  await p.evaluate(bek => { window.__yuk = KHAVUZ.yukle(bek).then(r => ({ ok: r.ok, d: r.durum })); }, bek);
  await p.waitForTimeout(300);
  await p.evaluate(() => { const f = ACT.cikis || SUB.cikis; window.__cik = f.call(ACT); });   // çıkış sunucuda TAKILI
  D.tut.A.ac();   // A'nın yanıtı, çıkış isteği daha tamamlanmadan geliyor
  const sA = await p.evaluate(() => window.__yuk); const hala = await p.evaluate(() => HESAP.user && HESAP.user.id);
  t("3f çıkış isteği bitmeden (HESAP.user hâlâ A) bekleyen A yüklemesi 'iptal' oldu", hala === "A" && sA.ok === false && sA.d === "iptal", JSON.stringify([hala, sA]));
  t("3g iptal edilen A yüklemesi havuzu doldurmadı", await hazirMi(p) === false);
  D.cikisTut.ac(); await p.evaluate(() => window.__cik); D.tut = {}; D.cikisTut = null; await c.close();
}

/* ---- 4) başarılı hesap silme: havuz temizlenir; başarısız silmede korunur ---- */
{
  const { p, c } = await yeniSayfa("A"); const r = await yukle(p); D.silDurum = 500;
  await p.evaluate(async () => { await ACT.hesapSilGo.call(ACT); });
  t("4a hesap silme BAŞARISIZ (500): havuz korunur", r.ok && await hazirMi(p));
  D.silDurum = 200; await p.evaluate(async () => { await ACT.hesapSilGo.call(ACT); });
  const son = await p.evaluate(() => ({ h: KHAVUZ.poolOf("mat").ok, u: HESAP.user }));
  t("4b hesap silme BAŞARILI: havuz temizlendi, HESAP.user boş", son.h === false && son.u === null, JSON.stringify(son));
  await c.close();
}

/* ---- 5) mevcut oturum kaybı: /ben 401 → temizlik; AI/kota 401 yolları da ortak güncellemeden geçer ---- */
{
  const { p, c } = await yeniSayfa("A"); const r = await yukle(p); const var1 = await hazirMi(p);
  D.benDurum = 401; const d = await p.evaluate(async () => { const x = await hesapBenDene(); return { x, h: KHAVUZ.poolOf("mat").ok, u: HESAP.user }; }); D.benDurum = 200;
  t("5a oturum kaybı (/ben 401): havuz temizlendi, kullanıcı boş", r.ok && var1 && d.x === "giris" && d.h === false && d.u === null, JSON.stringify(d));
  await c.close();
}
{
  const { p, c } = await yeniSayfa("A"); await yukle(p);
  const d = await p.evaluate(() => { const f = hesapKimlikGuncelle; f(null); return KHAVUZ.poolOf("mat").ok; });
  t("5b ortak güncelleme (null) çağrısı tek başına havuzu temizler (AI/kota/sosyal 401 yolları bunu kullanır)", d === false);
  await c.close();
}

/* ---- 6) HESAP.user doğrudan atanmıyor: tek istisna ortak işlev ---- */
const dogrudan = (YENI.match(/HESAP\.user\s*=\s*(?!=)/g) || []).length;
t("6 'HESAP.user =' yalnız hesapKimlikGuncelle içinde (1 atama)", dogrudan === 1, "atama sayısı " + dogrudan);

await b.close(); srv.close();
console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
