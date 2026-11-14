// B4 3C-1 · #banka için ÖNERİLEN GÜVENLİ MOD sözleşme testi (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz).
// AMAÇ: mevcut kodda güvenli modun HANGİ yollarda başarısız olduğunu göstermek. Uygulama koduna dokunulmaz; bu dosya CI'a EKLENMEZ.
// Güvenli mod bayrağı ÖNERİDİR: window.AKE_KATALOG_BANKA === true (AKE_KATALOG/AKE_KATALOG_HAVUZ adlandırmasıyla uyumlu). Mevcut kod bu bayrağı bilmez → "BEKLENEN" testler kırmızıdır.
// İki grup:
//   [KARAKTERİZASYON] güvenli mod KAPALIYKEN mevcut davranış (yeşil olmalı, düzeltmeden sonra da yeşil kalmalı)
//   [GÜVENLİ MOD]     bayrak AÇIKKEN beklenen sözleşme (şu an kırmızı = düzeltme noktalarının kanıtı)
// Cevap anahtarı değerleri çıktıya YAZILMAZ; yalnız varlık/sayı raporlanır. Mevcut BANK globalinin yokluğu İDDİA EDİLMEZ.
// Çalıştırma: node tests/banka-guvenli-mod-istemci.mjs   (Playwright + chromium gerekir)   ·   çıkış kodu: kırmızı sayısı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 420)); };

const D = { oturum: "tam", istekler: [], kota: 0, sinirli: false };   // oturum: "tam" | "kismi" | "bos" (200 + boş sorular) | "404" | "banka_yok" | "500"; sinirli: true → sunucu kota {sinirsiz:false, kalan:25}
let BILGI = new Map(), KATALOG = new Map(), KATID = {};   // KATALOG: kullanıcı → [{id,s,t,d,q,o}] (BANK id'lerinden farklı, sentetik); BILGI: BANK (yalnız bayrak-kapalı karakterizasyon için)                                   // id → { id, s, t, d, q, o } (cevapsız; sahte sunucu yalnız bunu verir)
const D3 = { oturumTut: null, cikisTut: null, cikisGeldi: false, cikisDurum: 200, gecerli: new Set(["kul1", "kulB"]), kayit: [] };   // gecerli: sunucu tarafında GEÇERLİ oturumlar (sentetik kimlikler); 200 çıkış siler, 500 çıkış TUTAR   // yarış testleri: oturumTut = { kul, durum, tuttu, kapi, ac } (o kullanıcının İLK /oturum yanıtını bekletir, sonra 200 ya da 401 verir); kayit = istek sahibi (çerez) + id sahipleri
const D2 = { kat: "tam", katIstek: 0, tut: {} };   // kat: "tam" | "404" | "leak" | "500"; tut[kullanıcı] = { kapi }: o kullanıcının katalog yanıtını bekletir
const kulOf = q => ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
const js = (r, kod, o) => { r.statusCode = kod; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); r.end(JSON.stringify(o)); };
const govde = q => new Promise(ok => { let s = ""; q.on("data", c => s += c); q.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { ok({}); } }); });
const srv = http.createServer(async (q, r) => {
  const f = new URL(q.url, "http://x").pathname, kul = ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(HTML); }
  if (f === "/api/hesap/ben") { if (!kul || !D3.gecerli.has(kul)) return js(r, 401, { error: "giris" }); return js(r, 200, { kullanici: { id: kul, eposta: kul + "@x.test", ad: "" }, paket: null, ucretsiz: null, ayar: { google: false, eposta: true } }); }
  if (f === "/api/hesap/cikis") { D3.cikisGeldi = true; if (D3.cikisTut) await D3.cikisTut.kapi; if (D3.cikisDurum === "ag") { q.socket.destroy(); return; }   // ağ hatası: bağlantı kopar; sunucu oturumu GEÇERLİ kalır
    if (D3.cikisDurum === 200) { D3.gecerli.delete(kul); return js(r, 200, { ok: true }); } return js(r, D3.cikisDurum, { error: "x" }); }   // 500: sunucu oturumu GEÇERLİ kalır
  if (f === "/api/soru/katalog") {
    D2.katIstek++; if (!kul) return js(r, 401, {}); if (D2.kat === "404") return js(r, 404, {}); if (D2.kat === "500") return js(r, 500, {});
    if (D2.tut[kul]) await D2.tut[kul].kapi;
    const l = (KATALOG.get(kul) || []).map(x => ({ ...x })); if (D2.kat === "leak" && l.length) l[0].a = 1;
    return js(r, 200, { n: l.length, bayrak: "hazir", beklenen: { toplam: l.length, os: 0, fix: 0 }, sorular: l, sonraki: null });
  }
  if (f === "/api/hesap/veri") return js(r, 200, { alanlar: {} });
  if (f === "/api/hesap/kota") { const b = await govde(q); D.kota++; return js(r, 200, { verildi: b.adet || 1, kalanSoru: 500, kalanDeneme: 5 }); }
  if (f === "/api/soru/oturum") {
    const b = await govde(q); D.istekler.push({ yol: f, anahtar: String(b.istek || ""), idSayisi: Array.isArray(b.idler) ? b.idler.length : -1, idler: Array.isArray(b.idler) ? b.idler.slice() : [] });
    D3.kayit.push({ sahip: kul || "", onek: [...new Set((b.idler || []).map(i => String(i).split("-")[1]))] });
    { const T = D3.oturumTut; if (T && !T.tuttu && T.kul === kul) { T.tuttu = true; await T.kapi; if (T.durum === 401) return js(r, 401, { error: "giris" }); } }
    if (D.oturum === "404") return js(r, 404, { error: "yok" });
    if (D.oturum === "banka_yok") return js(r, 503, { error: "banka_yok" });
    if (D.oturum === "500") return js(r, 500, { error: "x" });
    const idler = (b.idler || []).filter(i => BILGI.has(i) || KATID[i]), verilen = D.oturum === "bos" ? [] : D.oturum === "kismi" ? idler.slice(0, 10) : idler;
    return js(r, 200, { oturum: "o" + Math.floor(Math.random() * 1e9), kota: D.sinirli ? { sinirsiz: false, kalan: 25 } : { sinirsiz: true }, sorular: verilen.map(i => { const k = BILGI.get(i) || KATID[i]; return { id: k.id, q: k.q, o: k.o, ...(k.p ? { p: k.p } : {}) }; }) });
  }
  if (f.startsWith("/api/")) return js(r, 404, {});
  r.statusCode = 404; r.end("");   // /sorular/* dahil: BANK yalnız index.html'deki gömülü sorulardan oluşur (deterministik)
});
await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"] });

/* sahte sunucunun vereceği CEVAPSIZ soru bilgisi: yerel sayfadan yalnız id,s,t,d,q,o,p okunur (a/x ALINMAZ) */
{ const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage(); await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(800);
  const l = await p.evaluate(() => BANK.map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, ...(q.p ? { p: q.p } : {}) }))); BILGI = new Map(l.map(x => [x.id, x])); await c.close(); }
if (BILGI.size < 100) { console.error("TEST GEÇERSİZ: BANK okunamadı " + BILGI.size); process.exit(2); }

{ const dersler = [...new Set([...BILGI.values()].map(x => x.s))].slice(0, 3), N = 90;
  for (const [kul, on] of [["kul1", "a"], ["kulB", "b"]]) {
    const l = []; for (let i = 0; i < N; i++) { const no = String(i).padStart(3, "0"); l.push({ id: `kat-${on}-${no}`, s: dersler[i % 3], t: "Konu " + (i % 2), d: 1 + (i % 3), q: `KAT-${on.toUpperCase()}-${no} sentetik katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} seçeneği ${no}`) }); }
    KATALOG.set(kul, l); l.forEach(x => { KATID[x.id] = x; });
  }
  KATID.dersler = dersler; }
/* oturum: giris=true → çerezli kullanıcı; guvenli=true → önerilen bayrak; svKapat=true → svKullan() false'a zorlanır */
async function sayfa({ giris = true, guvenli = false, svKapat = false, kat = true, havuz = true, kul = "kul1", hash = "#banka", ans = null } = {}) {
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1200, height: 900 } }), p = await c.newPage(), hatalar = []; p.on("pageerror", e => hatalar.push(e.message));
  await p.addInitScript(([g, k, kt, hv]) => { if (g) window.AKE_KATALOG_BANKA = true; if (k) window.SV_KAPAT = true; if (kt) window.AKE_KATALOG = true; if (hv) window.AKE_KATALOG_HAVUZ = true; }, [guvenli, svKapat, kat && guvenli, havuz && guvenli]);
  if (giris) await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]);
  await p.goto(URL0 + hash, { waitUntil: "load" });
  if (giris) await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); else await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 });
  await p.waitForTimeout(300); return { c, p, hatalar };
}
/* #banka'dan "Soru bankası" testini başlat (bankAll = ilk 40 soru, çalışma modu); sonucu ÖZETLE (cevap DEĞERİ yok, yalnız varlık/sayı) */
async function baslat(p) {
  await p.waitForFunction(() => typeof window.AKE_KATALOG_BANKA === "undefined" || !HESAP.user || ["hazir", "durdu"].includes(KHAVUZ.durumu().durum), null, { timeout: 6000 }).catch(() => { });
  await p.waitForTimeout(150);
  return p.evaluate(async () => {
    RUN = null; UI.modal = null; UI.svBusy = false; UI.bank = Object.assign({}, UI.bank, { s: "", t: "", d: 0, st: "", src: "", q: "" });
    ACT.bankAll();
    for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 200));
    const R = RUN, ls = (() => { try { return localStorage.getItem("ake.run") || ""; } catch (e) { return ""; } })();
    return { run: !!R, n: R ? R.qs.length : 0, svN: R ? R.qs.filter(q => q.sv).length : 0, yerelN: R ? R.qs.filter(q => !q.sv).length : 0,
      aVar: R ? R.qs.filter(q => Number.isInteger(q.a)).length : 0, xVar: R ? R.qs.filter(q => typeof q.x === "string" && q.x).length : 0,
      lsN: (() => { try { const o = JSON.parse(ls); return Array.isArray(o.qs) ? o.qs.length : -1; } catch (e) { return -1; } })(), lsAnahtarVar: /"a":\d/.test(ls) || /"x":"/.test(ls), modal: UI.modal ? String(UI.modal.title || "") : "" };
  });
}
const sifirla = () => { D.istekler.length = 0; D.kota = 0; D.sinirli = false; D3.oturumTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.cikisDurum = 200; D3.gecerli = new Set(["kul1", "kulB"]); D3.kayit = []; };

/* =====================  KARAKTERİZASYON (güvenli mod KAPALI): mevcut davranış korunmalı  ===================== */
{ D.oturum = "tam"; sifirla(); const { c, p } = await sayfa(); const r = await baslat(p);
  t("KARAKT", "K1 tam sunucu yanıtı: 40 soru sunucu oturumunda (sv), yerel soru yok; cevap/çözüm alanları sete SIZMAZ", r.run && r.n === 40 && r.svN === 40 && r.yerelN === 0 && r.aVar === 0 && r.xVar === 0 && D.istekler.length === 1 && D.istekler[0].idSayisi === 40, JSON.stringify(r)); await c.close(); }
{ D.oturum = "tam"; sifirla(); const { c, p } = await sayfa({ svKapat: true }); const r = await baslat(p);
  t("KARAKT", "K2 svKullan() false (SV_KAPAT): eski yerel akış AÇILIR: kota sunucudan, set yerel cevaplı sorularla başlar, oturum isteği yok", r.run && r.n === 40 && r.svN === 0 && r.aVar === 40 && D.istekler.length === 0, JSON.stringify(r)); await c.close(); }
{ D.oturum = "404"; sifirla(); const { c, p } = await sayfa(); const r = await baslat(p);
  t("KARAKT", "K3 /oturum 404 (V2 kapalı): eski yerel akışa dönülür (mevcut uyumluluk davranışı)", r.run && r.n === 40 && r.svN === 0 && r.aVar === 40, JSON.stringify(r)); await c.close(); }
{ D.oturum = "banka_yok"; sifirla(); const { c, p } = await sayfa(); const r = await baslat(p);
  t("KARAKT", "K4 503 banka_yok: eski yerel akışa dönülür (mevcut davranış)", r.run && r.n === 40 && r.svN === 0 && r.aVar === 40, JSON.stringify(r)); await c.close(); }
{ D.oturum = "kismi"; sifirla(); const { c, p } = await sayfa(); const r = await baslat(p);
  t("KARAKT", "K5 sunucu kısmi (10/40): kalan yerel sorular sete girer (10 sv + 30 yerel, yerel olanlar cevaplı) — mevcut davranış", r.run && r.n === 40 && r.svN === 10 && r.yerelN === 30 && r.aVar === 30, JSON.stringify(r)); await c.close(); }
{ D.oturum = "500"; sifirla(); const { c, p } = await sayfa(); const r = await baslat(p);
  t("KARAKT", "K6 /oturum 500: yerel akışa DÖNÜLMEZ; 'Sorular şu an açılamadı' modalı (mevcut, doğru davranış)", !r.run && /açılamadı/i.test(r.modal), JSON.stringify(r)); await c.close(); }
{ D.oturum = "tam"; sifirla(); const { c, p } = await sayfa({ giris: false }); const r = await baslat(p);
  t("KARAKT", "K7 giriş yok: svKullan() false; mevcut kod giriş modalı gösterir (yerel set başlamaz) — mevcut davranış", !r.run && r.modal.length > 0 && D.istekler.length === 0, JSON.stringify(r)); await c.close(); }

{ D.oturum = "kismi"; sifirla(); D.sinirli = true; const { c, p } = await sayfa(); const r = await baslat(p);
  t("KARAKT", "K8 sınırlı kota + kısmi (10/40), bayrak kapalı: 30 yerel soru sete girer ve yerel kota isteği yapılır (mevcut davranış)", r.run && r.n === 40 && r.svN === 10 && r.yerelN === 30 && D.kota === 1, JSON.stringify({ ...r, kotaCagrisi: D.kota })); await c.close(); }
{ D.oturum = "bos"; sifirla(); const { c, p } = await sayfa(); const r = await baslat(p);
  t("KARAKT", "K9 200 + boş sorular, bayrak kapalı: startRunEski ile yerel akış açılır (mevcut davranış)", r.run && r.n === 40 && r.svN === 0 && r.aVar === 40, JSON.stringify(r)); await c.close(); }

/* =====================  GÜVENLİ MOD (bayrak AÇIK): BEKLENEN sözleşme — mevcut kodda kırmızı olması beklenir  ===================== */
{ D.oturum = "tam"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G0 (kontrol) tam yanıt: set yalnız sunucu oturumundan; cevap öncesi verilerde (RUN, ake.run) cevap/çözüm alanı YOK", r.run && r.n === 40 && r.svN === 40 && r.aVar === 0 && r.xVar === 0 && !r.lsAnahtarVar, JSON.stringify(r)); await c.close(); }
{ D.oturum = "tam"; sifirla(); const { c, p } = await sayfa({ guvenli: true, svKapat: true }); const r = await baslat(p);
  t("GÜVENLİ", "G1 svKullan() false iken startRun YEREL çözüm AÇMAZ (set başlamaz, cevaplı yerel soru yok, kota çağrısı yok)", !r.run && r.aVar === 0 && D.kota === 0, JSON.stringify({ ...r, kotaCagrisi: D.kota })); await c.close(); }
{ D.oturum = "tam"; sifirla(); const { c, p } = await sayfa({ guvenli: true, giris: false }); const r = await baslat(p);
  t("GÜVENLİ", "G1b giriş yokken yerel çözüm açılmaz (giriş istenir)", !r.run && r.aVar === 0 && r.modal.length > 0, JSON.stringify(r)); await c.close(); }
{ D.oturum = "404"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G2 /oturum 404: startRunEski'ye DÖNÜLMEZ (yerel cevaplı set yok; açık hata/modal)", !r.run && r.aVar === 0 && D.kota === 0 && r.modal.length > 0, JSON.stringify({ ...r, kotaCagrisi: D.kota })); await c.close(); }
{ D.oturum = "banka_yok"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G3 503 banka_yok: startRunEski'ye DÖNÜLMEZ (yerel cevaplı set yok; açık hata/modal)", !r.run && r.aVar === 0 && D.kota === 0 && r.modal.length > 0, JSON.stringify({ ...r, kotaCagrisi: D.kota })); await c.close(); }
{ D.oturum = "kismi"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G4 sunucu kısmi (10/40): kalan YEREL sorular sete GİRMEZ (set yalnız sunulan 10 soru; yerel/cevaplı soru yok)", r.run && r.n === 10 && r.svN === 10 && r.yerelN === 0 && r.aVar === 0, JSON.stringify(r)); await c.close(); }
{ D.oturum = "kismi"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G4b sunucu kısmi (sınırsız kota): kalan yerel sorular için /api/hesap/kota çağrısı yok", D.kota === 0, JSON.stringify({ kotaCagrisi: D.kota, n: r.n })); await c.close(); }
{ D.oturum = "kismi"; sifirla(); D.sinirli = true; const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G4c sınırlı kota (kalan 25) + kısmi (10/40): kalan 30 için yerel kota isteği YOK; RUN'a yalnız sunucunun verdiği 10 cevapsız soru girer", D.kota === 0 && r.run && r.n === 10 && r.svN === 10 && r.yerelN === 0 && r.aVar === 0 && r.xVar === 0, JSON.stringify({ ...r, kotaCagrisi: D.kota })); await c.close(); }
{ D.oturum = "kismi"; sifirla(); D.sinirli = true; const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G4d aynı senaryoda ake.run'a yalnız sunucu soruları yazılır (en çok 10 soru; a/x alanı yok)", r.run && r.lsN === 10 && !r.lsAnahtarVar, JSON.stringify(r)); await c.close(); }
{ D.oturum = "bos"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G6 200 + boş sorular: startRunEski ve yerel RUN açılmaz; açık hata modalı, kota çağrısı yok", !r.run && r.aVar === 0 && D.kota === 0 && r.modal.length > 0, JSON.stringify({ ...r, kotaCagrisi: D.kota })); await c.close(); }
{ D.oturum = "banka_yok"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); await baslat(p);
  await p.evaluate(() => ACT.svTekrar()); await p.waitForTimeout(600);
  const [a1, a2] = D.istekler.map(x => x.anahtar);
  t("GÜVENLİ", "G7 'Tekrar dene' aynı istek anahtarıyla gider (kimlik korunur) ve yine yerel RUN açmaz", D.istekler.length === 2 && !!a1 && a1 === a2 && (await p.evaluate(() => !RUN)), JSON.stringify({ istek: D.istekler.length, ayni: a1 === a2 })); await c.close(); }
{ D.oturum = "500"; sifirla(); const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p);
  t("GÜVENLİ", "G5 /oturum 500: yerel akışa dönülmez, 'açılamadı' modalı (mevcut davranışla aynı kalmalı)", !r.run && /açılamadı/i.test(r.modal) && r.aVar === 0, JSON.stringify(r)); await c.close(); }

/* =====================  KAYNAK AYRIMI (3C-1b): AKE_KATALOG_BANKA açıkken #banka YALNIZ KHAVUZ (katalog) kullanır  =====================
   Katalog id'leri ("kat-a-###") BANK id'lerinden FARKLIDIR; ekranda ve /api/soru/oturum isteğinde yalnız katalog id'leri görünmelidir.
   Sözleşme işareti: durum kartında data-banka-durum = yukleniyor | giris | kapali | hata (liste yok); hazırken liste satırlarında data-a="bankOne".
   Not: mevcut BANK globalinin yokluğu İDDİA EDİLMEZ; yalnız #banka'nın onu kullanmadığı denetlenir. */
const KID = KATALOG.get("kul1").map(x => x.id), KIDB = KATALOG.get("kulB").map(x => x.id), BID = new Set(BILGI.keys()), DERS = KATID.dersler;
const satirlar = p => p.evaluate(() => [...document.querySelectorAll('#bankList [data-a="bankOne"]')].map(e => e.dataset.id));
const durumKart = p => p.evaluate(() => { const e = document.querySelector("[data-banka-durum]"); return e ? e.dataset.bankaDurum : ""; });
const hazirBekle = (p, ms = 7000) => p.waitForSelector('#bankList [data-a="bankOne"]', { timeout: ms }).then(() => true, () => false);
const durumBekle = (p, d, ms = 6000) => p.waitForSelector(`[data-banka-durum="${d}"]`, { timeout: ms }).then(() => true, () => false);
const sadeceKat = (ids, izinli) => ids.length > 0 && ids.every(i => izinli.includes(i) && !BID.has(i));
const bankaIds = p => p.evaluate(() => (typeof bankListesi === "function" ? bankListesi() : []).map(q => q.id));
const sec = (p, sel, v) => p.selectOption(sel, v, { timeout: 1500 }).catch(() => { });
const dis = (ad, ok, ek) => t("KAYNAK", ad, ok, ek);
D2.kat = "tam"; D2.tut = {};

{ sifirla(); D2.katIstek = 0; const { c, p } = await sayfa({ guvenli: true }); const hz = await hazirBekle(p), ids = await satirlar(p), tum = await bankaIds(p), say = await p.evaluate(() => document.getElementById("bankCount") && document.getElementById("bankCount").textContent);
  dis("S1 liste yalnız katalog id'leri (BANK id'si yok); sayı katalog kadar", hz && sadeceKat(ids, KID) && sadeceKat(tum, KID) && tum.length === KID.length && /^90 soru/.test(say || ""), JSON.stringify({ hz, satir: ids.length, tum: tum.length, say, bankaVar: ids.filter(i => BID.has(i)).length }));
  const sz = await p.evaluate(() => { const r = KHAVUZ.poolOf(KHAVUZ.durumu().ok ? Object.keys(SUBJ)[0] : "x"); const l = (KHAVUZ.bankFiltered({}, {}).sorular || []); return l.length && l.every(q => !("a" in q) && !("x" in q)); });
  dis("S1b katalog sorularında cevap/çözüm alanı yok (cevap öncesi veri)", sz === true);
  await c.close(); }

{ sifirla(); const { c, p } = await sayfa({ guvenli: true, ans: null }); await hazirBekle(p);
  const ayni = await p.evaluate(() => { const a = bankListesi().map(q => q.id).join(), b = KHAVUZ.bankFiltered(Object.assign({}, UI.bank, { src: "" }), { ans: S.ans }).sorular.map(q => q.id).join(); return a === b && a.length > 0; });
  dis("S2 bankListesi() aynı KHAVUZ sonucunu verir (aynı katalog sonucu)", ayni);
  await c.close(); }

/* filtreler: ders/konu/zorluk/arama/S.ans anlamı korunur */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const say = () => p.evaluate(() => +(document.getElementById("bankCount").textContent.match(/\d+/) || [-1])[0]);
  const L = KATALOG.get("kul1");
  await sec(p, 'select[data-k="s"]', DERS[0]); await p.waitForTimeout(150); const a = await say();
  dis("S3a ders filtresi", a === L.filter(q => q.s === DERS[0]).length, a);
  await sec(p, 'select[data-k="t"]', { label: "Konu 0" }); await p.waitForTimeout(150); const b2 = await say();
  dis("S3b konu filtresi", b2 === L.filter(q => q.s === DERS[0] && q.t === "Konu 0").length, b2);
  await sec(p, 'select[data-k="d"]', "2"); await p.waitForTimeout(150); const d = await say();
  dis("S3c zorluk filtresi", d === L.filter(q => q.s === DERS[0] && q.t === "Konu 0" && q.d === 2).length, d);
  await sec(p, 'select[data-k="s"]', ""); await sec(p, 'select[data-k="d"]', "0"); await p.fill('input[data-i="bankQ"]', "KAT-A-007", { timeout: 1500 }).catch(() => { }); await p.waitForTimeout(200); const ar = await say(), idsA = await satirlar(p);
  dis("S3d arama (tek eşleşme, katalog id'si)", ar === 1 && idsA.length === 1 && idsA[0] === "kat-a-007", JSON.stringify([ar, idsA]));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const L = KATALOG.get("kul1");
  await p.evaluate(ids => { ids.slice(0, 10).forEach(i => { S.ans[i] = [0, 0, 0, Date.now(), 1]; }); ids.slice(10, 15).forEach(i => { S.ans[i] = [0, 0, 0, Date.now(), 0]; }); }, L.map(q => q.id));
  const say = async k => { await sec(p, 'select[data-k="st"]', k); await p.waitForTimeout(150); return p.evaluate(() => +(document.getElementById("bankCount").textContent.match(/\d+/) || [-1])[0]); };
  const yeni = await say("new"), yanlis = await say("wrong"), dogru = await say("right");
  dis("S3e S.ans durum filtreleri (çözmediklerim 75 / yanlış 5 / doğru 10)", yeni === 75 && yanlis === 5 && dogru === 10, JSON.stringify([yeni, yanlis, dogru]));
  await c.close(); }
/* S.reports: mevcut bankFiltered() raporlanan soruyu ELEMEZ (rapordaki önceki varsayım yanlıştı); güvenli mod bunu DEĞİŞTİRMEZ */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const r = await p.evaluate(() => { const ilk = bankListesi()[0].id; S.reports[ilk] = { r: "x", ts: 1 }; return { ilk, var: bankListesi().some(q => q.id === ilk) }; });
  dis("S4 güvenli modda raporlanan soru listeden ELENMEZ (mevcut anlam korunur; yeni davranış yok)", r.var === true && KID.includes(r.ilk), JSON.stringify(r)); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({}); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const ilk = bankListesi()[0].id; S.reports[ilk] = { r: "x", ts: 1 }; return bankListesi().some(q => q.id === ilk); });
  dis("S4b (bayrak kapalı) eski bankFiltered() de raporlanan soruyu elemez — doğrulanmış mevcut davranış", r === true); await c.close(); }

/* oturum isteği ve RUN: yalnız katalog id'leri */
{ sifirla(); D.oturum = "tam"; const { c, p } = await sayfa({ guvenli: true }); const r = await baslat(p), ids = D.istekler.flatMap(x => x.idler), runIds = await p.evaluate(() => RUN ? RUN.qs.map(q => q.id) : []);
  dis("S5 bankAll: /oturum isteği ve RUN yalnız katalog id'leri; cevap öncesi a/x yok", r.run && D.istekler.length === 1 && sadeceKat(ids, KID) && sadeceKat(runIds, KID) && r.aVar === 0 && r.xVar === 0 && !r.lsAnahtarVar, JSON.stringify({ ...r, istekBank: ids.filter(i => BID.has(i)).length })); await c.close(); }
{ sifirla(); D.oturum = "tam"; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const hedef = KID[5];
  await p.evaluate(() => { RUN = null; UI.modal = null; }); await p.click(`[data-a="bankOne"][data-id="${hedef}"]`, { timeout: 1500 }).catch(() => { }); await p.waitForFunction(() => RUN, null, { timeout: 5000 }).catch(() => { });
  const ids = D.istekler.flatMap(x => x.idler);
  dis("S6 bankOne: seçilen katalog sorusundan başlar; istekte yalnız katalog id'leri", ids[0] === hedef && sadeceKat(ids, KID) && (await p.evaluate(() => !!RUN)), JSON.stringify({ ilk: ids[0], hedef })); await c.close(); }

/* açık durumlar: eski soru listelenmez/başlatılmaz */
const durumTesti = async (ad, o, beklenen, hazirOncesi) => {
  sifirla(); D.oturum = "tam"; D2.katIstek = 0; const { c, p } = await sayfa(o); const gor = await durumBekle(p, beklenen), satir = (await satirlar(p)).length, r = await baslat(p);
  dis(ad, gor && satir === 0 && !r.run && D.istekler.length === 0 && r.aVar === 0, JSON.stringify({ gor, kart: await durumKart(p), satir, run: r.run, oturumIstek: D.istekler.length, katIstek: D2.katIstek })); await c.close(); };
{ D2.tut = { kul1: (() => { let ac; const k = new Promise(o => { ac = o; }); return { kapi: k, ac }; })() }; sifirla(); const { c, p } = await sayfa({ guvenli: true });
  const y = await durumBekle(p, "yukleniyor", 3000), satir = (await satirlar(p)).length, r = await baslat(p);
  dis("S7 yükleniyor: durum gösterilir; eski liste yok; bankAll başlamaz", y && satir === 0 && !r.run && D.istekler.length === 0, JSON.stringify({ y, satir, run: r.run }));
  D2.tut.kul1.ac(); const hz = await hazirBekle(p); dis("S7b yanıt gelince katalog listelenir", hz && sadeceKat(await satirlar(p), KID)); D2.tut = {}; await c.close(); }
await durumTesti("S8 giriş gerekli: durum + katalog isteği yok; liste/başlatma yok", { guvenli: true, giris: false }, "giris");
{ D2.kat = "404"; await durumTesti("S9a katalog kapalı (404): açık durum; BANK listelenmez", { guvenli: true }, "kapali"); D2.kat = "tam"; }
{ D2.kat = "leak"; await durumTesti("S9b katalog bozuk/sızıntılı: açık hata; BANK listelenmez", { guvenli: true }, "hata"); D2.kat = "tam"; }
{ D2.kat = "500"; await durumTesti("S9c katalog 500: açık hata; BANK listelenmez", { guvenli: true }, "hata"); D2.kat = "tam"; }
await durumTesti("S10a KAT bayrağı kapalı: fail-closed (kapalı durumu, BANK yok)", { guvenli: true, kat: false }, "kapali");
await durumTesti("S10b KHAVUZ bayrağı kapalı: fail-closed", { guvenli: true, havuz: false }, "kapali");
await durumTesti("S10c ikisi de kapalı: fail-closed", { guvenli: true, kat: false, havuz: false }, "kapali");

/* hesap değişimi / çıkış / geç yanıt */
{ D2.tut = { kul1: (() => { let ac; const k = new Promise(o => { ac = o; }); return { kapi: k, ac }; })() }; sifirla(); const { c, p } = await sayfa({ guvenli: true }); await durumBekle(p, "yukleniyor", 3000);
  await p.evaluate(async () => { await ACT.cikis(); }); D2.tut.kul1.ac(); await p.waitForTimeout(700);
  const satir = (await satirlar(p)).length, hz = await p.evaluate(() => KHAVUZ.durumu().ok), r = await baslat(p);
  dis("S11 çıkış sırasında gelen GEÇ yanıt eski listeyi geri getirmez (liste yok, havuz boş, başlatma yok)", satir === 0 && hz === false && !r.run, JSON.stringify({ satir, hz, run: r.run })); D2.tut = {}; await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const once = await satirlar(p);
  await p.evaluate(async () => { await ACT.cikis(); }); await p.waitForTimeout(500);
  const sonra = (await satirlar(p)).length, bos = await p.evaluate(() => !KHAVUZ.durumu().ok && bankListesi().length === 0);
  dis("S12 çıkıştan sonra eski katalog listesi görünmez/başlatılamaz", once.length > 0 && sonra === 0 && bos, JSON.stringify({ once: once.length, sonra, bos })); await c.close(); }
{ let ac; D2.tut = { kulB: { kapi: new Promise(o => { ac = o; }), ac } }; sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  await c.addCookies([{ name: "oturum", value: "kulB", url: URL0 }]);
  await p.evaluate(() => { hesapKimlikGuncelle({ id: "kulB", eposta: "kulB@x.test", ad: "" }); }); await p.waitForTimeout(300);
  const aradaA = (await satirlar(p)).filter(i => i.startsWith("kat-a-")).length, bekle = await p.evaluate(() => bankListesi().length);
  ac(); await hazirBekle(p); const idsB = await satirlar(p);
  dis("S13 hesap değişimi: B yüklenirken A soruları görünmez; sonra yalnız B kataloğu", aradaA === 0 && bekle === 0 && sadeceKat(idsB, KIDB), JSON.stringify({ aradaA, bekle, b: idsB.length, aKalan: idsB.filter(i => i.startsWith("kat-a-")).length })); D2.tut = {}; await c.close(); }

/* bayrak kapalı: eski akış korunur */
{ sifirla(); D2.katIstek = 0; const { c, p } = await sayfa({}); await p.waitForTimeout(300); const ids = await satirlar(p);
  dis("S14 bayrak kapalı: liste eski BANK kaynağından (katalog id'si yok), katalog isteği yok", ids.length > 0 && ids.every(i => BID.has(i)) && D2.katIstek === 0, JSON.stringify({ n: ids.length, katIstek: D2.katIstek })); await c.close(); }
{ sifirla(); D.oturum = "tam"; const { c, p } = await sayfa({}); const r = await baslat(p), ids = D.istekler.flatMap(x => x.idler);
  dis("S15 bayrak kapalı: bankAll eski akış (oturum isteği BANK id'leriyle)", r.run && ids.length === 40 && ids.every(i => BID.has(i)), JSON.stringify({ ...r, ilkIstekBank: ids.every(i => BID.has(i)) })); await c.close(); }

/* =====================  YARIŞ 1 (3C-1c): geç gelen /api/soru/oturum yanıtı hesap geçişinden sonra B'yi etkilememeli  =====================
   A'nın isteği sunucuda BEKLER; B'ye geçilir; A'nın 200 ya da 401 yanıtı SONRA bırakılır. Sahipler sentetik kimliklerle ölçülür:
   istek sahibi = çerez (kul1 = A, kulB = B); soru id'si "kat-a-###" (A) / "kat-b-###" (B). Cevap anahtarı değeri yazılmaz.
   VARSAYIM (belgelenmiş): A→B→A dönüşünde, geçiş öncesi başlatılan eski isteğin yanıtı kullanıcının yeni oturum nesline aittir; yeni RUN AÇMAZ (kullanıcı yeniden başlatır). */
const kapiYap = () => { let ac; const kapi = new Promise(o => { ac = o; }); return { kapi, ac }; };
const bekle = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise(o => setTimeout(o, 50)); } return false; };
const gec = async (c, p, kul) => { await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]); await p.evaluate(k => hesapKimlikGuncelle({ id: k, eposta: k + "@x.test", ad: "" }), kul); };
const sahiplerTutarli = () => D3.kayit.every(k => k.onek.every(o => (k.sahip === "kul1" && o === "a") || (k.sahip === "kulB" && o === "b")));
const sayfaDurumu = p => p.evaluate(() => ({ runOnek: RUN ? [...new Set(RUN.qs.map(q => String(q.id).split("-")[1]))] : [], runVar: !!RUN, lsA: (() => { try { return (localStorage.getItem("ake.run") || "").includes("kat-a-"); } catch (e) { return false; } })(),
  kullanici: (HESAP.user && HESAP.user.id) || "", modal: UI.modal ? String(UI.modal.title || "") : "" }));
const bBasla = p => p.evaluate(async () => { RUN = null; UI.modal = null; ACT.bankAll(); for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
  return { run: !!RUN, onek: RUN ? [...new Set(RUN.qs.map(q => String(q.id).split("-")[1]))] : [], hepsiSv: RUN ? RUN.qs.every(q => !!q.sv) : false, modal: UI.modal ? String(UI.modal.title || "") : "" }; });
const bSatirBekle = (p, on) => p.waitForSelector(`#bankList [data-a="bankOne"][data-id^="kat-${on}-"]`, { timeout: 7000 }).then(() => true, () => false);

for (const durum of [200, 401]) {
  const E = durum === 200 ? "gecikmiş 200" : "gecikmiş 401";
  sifirla(); D.oturum = "tam"; D2.tut = {}; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", durum, tuttu: false }, kapiYap()); D3.oturumTut = T;
  await p.evaluate(() => { RUN = null; UI.modal = null; ACT.bankAll(); }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); const bHazir = await bSatirBekle(p, "b");
  T.ac(); await p.waitForTimeout(900); const st = await sayfaDurumu(p);
  dis(`R1-${durum}a ${E} yanıt B'ye geçişten sonra: A'ya ait RUN/ake.run oluşmaz`, tuttu && bHazir && !st.runOnek.includes("a") && !st.lsA, JSON.stringify({ tuttu, bHazir, runOnek: st.runOnek, lsA: st.lsA }));
  dis(`R1-${durum}b ${E} yanıt B'nin oturumunu KAPATMAZ (kullanıcı kulB kalır, modal/giriş istemi yok)`, st.kullanici === "kulB" && st.modal === "", JSON.stringify({ kullanici: st.kullanici, modal: st.modal }));
  const rb = await bBasla(p), st2 = await sayfaDurumu(p);
  dis(`R1-${durum}c B kendi çalışmasını başlatabilir (yalnız B soruları, sunucu oturumlu); A kalıntısı yok`, rb.run && rb.onek.length === 1 && rb.onek[0] === "b" && rb.hepsiSv && !st2.lsA, JSON.stringify({ ...rb, lsA: st2.lsA }));
  dis(`R1-${durum}d istek sahipleri tutarlı (kul1 isteği yalnız A id'leri, kulB isteği yalnız B id'leri)`, D3.kayit.length >= 1 && sahiplerTutarli(), JSON.stringify(D3.kayit));
  await c.close();
}
{ sifirla(); D.oturum = "tam"; D2.tut = {}; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", durum: 200, tuttu: false }, kapiYap()); D3.oturumTut = T;
  await p.evaluate(() => { RUN = null; UI.modal = null; ACT.bankAll(); }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); const bHazir = await bSatirBekle(p, "b"); await gec(c, p, "kul1"); const aHazir = await bSatirBekle(p, "a");
  T.ac(); await p.waitForTimeout(900); const st = await sayfaDurumu(p);
  dis("R1-ABA-a A→B→A sonrası eski (geçiş öncesi) 200 yanıtı yeni RUN açmaz; B kalıntısı yok", tuttu && bHazir && aHazir && !st.runVar && !st.runOnek.includes("b") && st.kullanici === "kul1" && st.modal === "", JSON.stringify({ tuttu, bHazir, aHazir, runOnek: st.runOnek, kullanici: st.kullanici, modal: st.modal }));
  const ra = await bBasla(p);
  dis("R1-ABA-b A→B→A sonrası A yeniden başlatabilir (meşgul kilidi takılı kalmaz); yalnız A soruları", ra.run && ra.onek.length === 1 && ra.onek[0] === "a" && ra.hepsiSv, JSON.stringify(ra));
  dis("R1-ABA-c istek sahipleri tutarlı", sahiplerTutarli(), JSON.stringify(D3.kayit)); await c.close(); }

{ sifirla(); D.oturum = "tam"; D2.tut = {}; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", durum: 200, tuttu: false }, kapiYap()); D3.oturumTut = T;
  await p.evaluate(() => { RUN = null; UI.modal = null; ACT.bankAll(); }); await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); await bSatirBekle(p, "b"); const rb = await bBasla(p);   // A'nın isteği HÂLÂ bekliyor
  dis("R1-meşgul-a A'nın isteği beklerken B kendi çalışmasını başlatabilir (A'nın meşgul kilidi B'yi engellemez)", rb.run && rb.onek.length === 1 && rb.onek[0] === "b" && rb.hepsiSv, JSON.stringify(rb));
  T.ac(); await p.waitForTimeout(900); const st = await sayfaDurumu(p);
  dis("R1-meşgul-b A'nın gecikmiş yanıtı B'nin açık çalışmasını DEĞİŞTİRMEZ (RUN yalnız B soruları, A kalıntısı yok)", st.runOnek.length === 1 && st.runOnek[0] === "b" && !st.lsA && st.kullanici === "kulB", JSON.stringify(st)); await c.close(); }

/* =====================  YARIŞ 2 (3C-1c): bekleyen çıkış isteği sırasında yeni katalog GET başlamaz, A listesi geri gelmez  =====================
   Çıkış isteği sunucuda BEKLETİLİR. ACT.cikis() çağrıldığı andan oturum temizlenene (yanıt serbest bırakılıp bitene) kadar: katalog GET sayısı artmaz,
   A listesi (satır) görünmez, KHAVUZ havuzu boş kalır. Ara durumlar 100 ms aralıkla örneklenir. */
{ sifirla(); D2.tut = {}; D2.kat = "tam"; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const once = (await satirlar(p)).length;
  D3.cikisTut = kapiYap(); const taban = D2.katIstek;
  await p.evaluate(() => { window.__cik = ACT.cikis(); }); const geldi = await bekle(() => D3.cikisGeldi, 4000);
  const ara = []; for (let i = 0; i < 8; i++) { await p.waitForTimeout(100); ara.push(await p.evaluate(() => ({ satir: document.querySelectorAll('#bankList [data-a="bankOne"]').length, havuz: KHAVUZ.durumu().ok, kart: (document.querySelector("[data-banka-durum]") || { dataset: {} }).dataset.bankaDurum || "" }))); }
  const araKatIstek = D2.katIstek - taban, araSatir = Math.max(...ara.map(x => x.satir)), araHavuz = ara.some(x => x.havuz), kartlar = [...new Set(ara.map(x => x.kart))];
  dis("R2a çıkış isteği beklerken (ara durum) A listesi görünmez ve havuz dolmaz", once > 0 && geldi && araSatir === 0 && !araHavuz, JSON.stringify({ once, geldi, araSatir, araHavuz, kartlar }));
  dis("R2b çıkış isteği beklerken YENİ GET /api/soru/katalog başlamaz (istek sayısı artmaz)", araKatIstek === 0, JSON.stringify({ araKatIstek, taban }));
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(700);
  const son = await p.evaluate(() => ({ satir: document.querySelectorAll('#bankList [data-a="bankOne"]').length, havuz: KHAVUZ.durumu().ok, kullanici: !!HESAP.user, kart: (document.querySelector("[data-banka-durum]") || { dataset: {} }).dataset.bankaDurum || "" }));
  dis("R2c çıkış tamamlanınca: yeni katalog GET yok, A listesi yok, giriş durumu gösterilir", D2.katIstek - taban === 0 && son.satir === 0 && !son.havuz && !son.kullanici && son.kart === "giris", JSON.stringify({ ...son, katIstek: D2.katIstek - taban })); await c.close(); }

/* çıkış BAŞARISIZ (500) olsa da işaret doğru temizlenir ("Çıkış yapılıyor…" durumunda takılı kalmaz); bekleme sırasında yeni katalog GET ve liste yok.
   500 BAŞARILI ÇIKIŞ KANITI SAYILMAZ: sonraki kimlik durumu (giriş/giriş değil) bu testte varsayılmaz, yalnız işaretin takılmadığı denetlenir. */
{ sifirla(); D2.tut = {}; D3.cikisDurum = 500; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); D3.cikisTut = kapiYap(); const taban = D2.katIstek;
  await p.evaluate(() => { window.__cik = ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 4000); await p.waitForTimeout(400);
  const ara = await p.evaluate(() => ({ kart: (document.querySelector("[data-banka-durum]") || { dataset: {} }).dataset.bankaDurum || "", satir: document.querySelectorAll('#bankList [data-a="bankOne"]').length })), araKat = D2.katIstek - taban;
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(600);
  const son = await p.evaluate(() => ({ kart: (document.querySelector("[data-banka-durum]") || { dataset: {} }).dataset.bankaDurum || "", kullanici: !!HESAP.user }));
  dis("R2d çıkış isteği 500 ile bitse de: bekleme sırasında 'cikis' durumu + liste yok + yeni GET yok; bittikten sonra işaret TAKILI KALMAZ ('cikis' değil)", ara.kart === "cikis" && ara.satir === 0 && araKat === 0 && son.kart !== "cikis", JSON.stringify({ ara, araKat, son })); await c.close(); }

/* =====================  GÜVENLİK 3 (3C-1d): çıkış beklerken gelen eski /oturum yanıtı  =====================
   A isteği başlatır (bekler); ACT.cikis() çağrılır ve sunucudaki çıkış da bekler; bu sırada A'nın 200 (ya da 401) yanıtı bırakılır.
   Çıkış beklerken ve bittikten sonra A'ya ait RUN/ake.run oluşmamalı; gecikmiş 401 çıkış durumunu bozmamalı (giriş modalı açmamalı, durum 'cikis' kalmalı). */
for (const durum of [200, 401]) {
  sifirla(); D.oturum = "tam"; D2.tut = {}; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", durum, tuttu: false }, kapiYap()); D3.oturumTut = T;
  await p.evaluate(() => { RUN = null; UI.modal = null; ACT.bankAll(); }); const tuttu = await bekle(() => T.tuttu, 4000);
  D3.cikisTut = kapiYap(); await p.evaluate(() => { window.__cik = ACT.cikis(); }); const cikisGeldi = await bekle(() => D3.cikisGeldi, 4000);
  T.ac(); await p.waitForTimeout(900);
  const ara = await sayfaDurumu(p), araKart = await durumKart(p);
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(700);
  const son = await sayfaDurumu(p), sonKart = await durumKart(p);
  if (durum === 200) {
    dis("R3a çıkış beklerken gelen A'nın gecikmiş 200 yanıtı RUN/ake.run oluşturmaz (çıkış beklerken)", tuttu && cikisGeldi && !ara.runVar && !ara.lsA, JSON.stringify({ tuttu, cikisGeldi, runOnek: ara.runOnek, lsA: ara.lsA }));
    dis("R3b çıkış bittikten sonra da A'ya ait RUN/ake.run yok", !son.runVar && !son.lsA && son.kullanici === "", JSON.stringify({ runOnek: son.runOnek, lsA: son.lsA, kullanici: son.kullanici }));
  } else {
    dis("R3c çıkış beklerken gelen A'nın gecikmiş 401 yanıtı giriş modalı açmaz ve çıkış durumunu bozmaz (bekleme: 'cikis')", tuttu && cikisGeldi && ara.modal === "" && araKart === "cikis" && !ara.runVar, JSON.stringify({ tuttu, cikisGeldi, modal: ara.modal, araKart, runVar: ara.runVar }));
    dis("R3d çıkış bitince durum 'giris', modal yok, A kalıntısı yok", sonKart === "giris" && son.modal === "" && !son.runVar && !son.lsA, JSON.stringify({ sonKart, modal: son.modal, runVar: son.runVar, lsA: son.lsA }));
  }
  await c.close();
}

{ /* çıkıştan ÖNCE başlamış soru isteği: çıkış API'si sonradan 500 dönse bile yeniden geçerli SAYILMAZ */
  sifirla(); D.oturum = "tam"; D2.tut = {}; D3.cikisDurum = 500; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", durum: 200, tuttu: false }, kapiYap()); D3.oturumTut = T;
  await p.evaluate(() => { RUN = null; UI.modal = null; ACT.bankAll(); }); await bekle(() => T.tuttu, 4000);
  D3.cikisTut = kapiYap(); await p.evaluate(() => { window.__cik = ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 4000);
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(500);   // çıkış 500 ile BİTTİ (oturum sunucuda geçerli)
  T.ac(); await p.waitForTimeout(900); const st = await sayfaDurumu(p);
  dis("R3e çıkış sonradan 500 dönse bile çıkıştan önce başlamış 200 yanıtı yeniden geçerli sayılmaz (RUN/ake.run yok)", !st.runVar && !st.lsA, JSON.stringify({ runOnek: st.runOnek, lsA: st.lsA })); await c.close(); }
{ /* çıkış sürerken "Tekrar dene" yeni güvenli banka oturumu BAŞLATMAZ */
  sifirla(); D.oturum = "banka_yok"; D2.tut = {}; const { c, p } = await sayfa({ guvenli: true }); await baslat(p);   // hata modalı + bekleyen "Tekrar dene"
  const once = D.istekler.length; D3.cikisTut = kapiYap(); await p.evaluate(() => { window.__cik = ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 4000);
  await p.evaluate(() => { ACT.svTekrar(); }); await p.waitForTimeout(500); const arada = D.istekler.length;
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { });
  dis("R3f çıkış sürerken 'Tekrar dene' yeni /api/soru/oturum isteği başlatmaz", once === 1 && arada === 1, JSON.stringify({ once, arada })); await c.close(); }

/* =====================  GÜVENLİK 4 (3C-1d): çıkış API'si 500 iken uygulama BAŞARILI çıkış bildirmemeli  =====================
   Sahte sunucu 500'de oturumu GEÇERLİ tutar (D3.gecerli). Başarılı çıkış bildirimi ile sunucuda hâlâ geçerli oturumun aynı anda bulunması GÜVENLİK HATASIDIR.
   Çerez/oturum değerleri yazdırılmaz; yalnız durum kodu ve bayraklar ölçülür. 500 başarılı çıkış kanıtı sayılmaz. */
{ sifirla(); D2.tut = {}; D3.cikisDurum = 500; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const oncekiKullanici = await p.evaluate(() => !!HESAP.user);
  await p.evaluate(async () => { await ACT.cikis(); }); await p.waitForTimeout(200);
  const ui = await p.evaluate(() => ({ basari: /Çıkış yapıldı/.test(String(UI.toast || "")), kullanici: !!HESAP.user }));
  const benDurum = await p.evaluate(async () => (await fetch("/api/hesap/ben", { credentials: "same-origin" })).status);
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 }).catch(() => { }); const yenilemeSonrasi = await p.evaluate(() => !!HESAP.user);
  dis("R4a çıkış 500 + sunucu oturumu geçerli: uygulama BAŞARILI çıkış bildirmez (bildirim ile geçerli sunucu oturumu aynı anda olmamalı)", !(ui.basari && benDurum === 200), JSON.stringify({ oncekiKullanici, basariBildirimi: ui.basari, benDurum, uiKullanici: ui.kullanici }));
  dis("R4b sunucu oturumu geçerli kaldıysa sayfa yenilemesi arayüzün gösterdiği kimlik durumunu DEĞİŞTİRMEZ (sessiz yeniden giriş yok)", benDurum !== 200 || ui.kullanici === yenilemeSonrasi, JSON.stringify({ benDurum, yenilemeOncesiKullanici: ui.kullanici, yenilemeSonrasiKullanici: yenilemeSonrasi }));
  await c.close(); }

for (const mod of [500, "ag"]) {
  sifirla(); D2.tut = {}; D3.cikisDurum = mod; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  await p.evaluate(async () => { await ACT.cikis(); }); await p.waitForTimeout(300);
  const ui = await p.evaluate(() => ({ basari: /Çıkış yapıldı/.test(String(UI.toast || "")), kullanici: !!HESAP.user, modal: UI.modal ? String(UI.modal.title || "") : "", bayrak: typeof BK !== "undefined" ? BK.cikis : null, durum: bankaDurum() }));
  const benDurum = await p.evaluate(async () => (await fetch("/api/hesap/ben", { credentials: "same-origin" })).status);
  dis(`R4c çıkış ${mod === "ag" ? "ağ hatası" : "500"}: açık 'Çıkış tamamlanamadı' durumu gösterilir, BK.cikis temizlenir, başarı bildirimi yok`, /Çıkış tamamlanamadı/.test(ui.modal) && ui.bayrak === false && ui.durum !== "cikis" && !ui.basari, JSON.stringify(ui));
  dis(`R4d çıkış ${mod === "ag" ? "ağ hatası" : "500"}: /api/hesap/ben (sunucu), arayüz kullanıcısı ve sayfa yenilemesi TUTARLI`, benDurum === 200 && ui.kullanici === true, JSON.stringify({ benDurum, uiKullanici: ui.kullanici }));
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 }).catch(() => { }); const yn = await p.evaluate(() => !!HESAP.user);
  dis(`R4e çıkış ${mod === "ag" ? "ağ hatası" : "500"}: yenileme sonrası kimlik durumu arayüzdekiyle aynı`, yn === ui.kullanici, JSON.stringify({ oncesi: ui.kullanici, sonrasi: yn }));
  await c.close();
}
for (const mod of [500, "ag"]) { /* "Tekrar dene" başarılı olursa çıkış tamamlanır VE eski hata modalı kapanır; başarısız yolda hata penceresi görünmeye devam eder */
  sifirla(); D2.tut = {}; D3.cikisDurum = mod; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const gor = () => p.evaluate(() => ({ uiModal: UI.modal ? String(UI.modal.title || "") : "", ekran: [...document.querySelectorAll(".modal-bg .modal")].map(e => e.textContent || "").join(" "), kullanici: !!HESAP.user, basari: /Çıkış yapıldı/.test(String(UI.toast || "")), bayrak: BK.cikis }));
  await p.evaluate(async () => { await ACT.cikis(); }); await p.waitForTimeout(300); const hata = await gor();
  dis(`R4f-0 çıkış ${mod === "ag" ? "ağ hatası" : "500"}: hata penceresi hem UI.modal'da hem EKRANDA görünür (başarısız yolda kalır)`, /Çıkış tamamlanamadı/.test(hata.uiModal) && /Çıkış tamamlanamadı/.test(hata.ekran) && hata.kullanici && !hata.basari, JSON.stringify({ uiModal: hata.uiModal, ekranda: /Çıkış tamamlanamadı/.test(hata.ekran), kullanici: hata.kullanici, basari: hata.basari }));
  D3.cikisDurum = 200; await p.evaluate(async () => { await ACT.cikis(); }); await p.waitForTimeout(500);
  const son = await gor(), ben = await p.evaluate(async () => (await fetch("/api/hesap/ben", { credentials: "same-origin" })).status);
  dis(`R4f ('${mod === "ag" ? "ağ hatası" : "500"}' sonrası tekrar): 200 ile tamamlanır: kullanıcı yok, başarı bildirimi, ben 401, işaret temiz`, !son.kullanici && son.basari && son.bayrak === false && ben === 401, JSON.stringify({ kullanici: son.kullanici, basari: son.basari, bayrak: son.bayrak, ben }));
  dis(`R4g ('${mod === "ag" ? "ağ hatası" : "500"}' sonrası tekrar): başarılı çıkıştan sonra eski 'Çıkış tamamlanamadı' modalı kapanır (UI.modal boş, ekranda pencere yok)`, son.uiModal === "" && !/Çıkış tamamlanamadı/.test(son.ekran) && son.ekran.trim() === "", JSON.stringify({ uiModal: son.uiModal, ekranUzunluk: son.ekran.length, eskiMetinVar: /Çıkış tamamlanamadı/.test(son.ekran) }));
  await c.close(); }

await b.close(); srv.close();
console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) console.log("KIRMIZI:\n  " + kirmizi.join("\n  ")); process.exit(kalan ? 1 : 0);
