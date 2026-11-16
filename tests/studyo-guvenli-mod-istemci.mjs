// B4 3C-3 · #studyo GÜVENLİ MOD sözleşmesi (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz). Uygulama koduna dokunmaz; CI'a EKLENMEZ.
// Bayrak: window.AKE_KATALOG_STUDYO === true (+ AKE_KATALOG, AKE_KATALOG_HAVUZ). Varsayılan KAPALI.
// Sözleşme (bayrak AÇIKKEN, yalnız #studyo "Teste başla" yolu): set YALNIZ sunucu kataloğundan (sunucu oturumuyla), BANK/EKQ/S.aiQs/GENS sete girmez, az soruda GENS ile doldurulmaz,
//   ekran gerçek (katalog) sayıları gösterir, sunucu hatasında yerel fallback yok, eski işaretsiz RUN ezilmez, güvenli RUN kalıcı işaretli ("studyo") ve benzer/AI eylemlerine kapalı, hesap/çıkış yarışları güvenli.
// Gruplar: [KARAKT] bayrak KAPALI mevcut davranış (yeşil kalmalı) · [GÜVENLİ] bayrak açık sözleşme (şu an KIRMIZI beklenir) · [DIŞ] #studyo DIŞI çağıranlar (topicStart/dersKarisik) bu adımla güvenli SAYILMAZ: yerel kalır (yeşil, belgeleme)
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz; yalnız kimlik/sayı/varlık raporlanır. Çalıştırma: node tests/studyo-guvenli-mod-istemci.mjs   ·   çıkış kodu: kırmızı sayısı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };

const D = { oturum: "tam", istekler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: "tam" | "kismi" (ilk 5) | "bos" | "404" | "banka_yok" | "500" | "402"
const D2 = { kat: "tam", katIstek: 0 };                                // kat: "tam" | "404" | "leak" | "500"
const D3 = { oturumTut: null, cikisTut: null, cikisGeldi: false, gecerli: new Set(["kul1", "kulB"]), kayit: [] };
let BILGI = new Map(); const KATALOG = new Map(), KATID = {};
const js = (r, kod, o) => { r.statusCode = kod; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); r.end(JSON.stringify(o)); };
const govde = q => new Promise(ok => { let s = ""; q.on("data", c => s += c); q.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { ok({}); } }); });
const srv = http.createServer(async (q, r) => {
  const f = new URL(q.url, "http://x").pathname, kul = ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(HTML); }
  if (f === "/api/hesap/ben") { if (!kul || !D3.gecerli.has(kul)) return js(r, 401, { error: "giris" }); return js(r, 200, { kullanici: { id: kul, eposta: kul + "@x.test", ad: "" }, paket: null, ucretsiz: null, ayar: { google: false, eposta: true } }); }
  if (f === "/api/hesap/cikis") { D3.cikisGeldi = true; if (D3.cikisTut) await D3.cikisTut.kapi; D3.gecerli.delete(kul); return js(r, 200, { ok: true }); }
  if (f === "/api/soru/katalog") {
    D2.katIstek++; if (!kul) return js(r, 401, {}); if (D2.kat === "404") return js(r, 404, {}); if (D2.kat === "500") return js(r, 500, {});
    const l = (KATALOG.get(kul) || []).map(x => ({ ...x })); if (D2.kat === "leak" && l.length) l[0].a = 1;
    return js(r, 200, { n: l.length, bayrak: "hazir", beklenen: { toplam: l.length, os: 0, fix: 0 }, sorular: l, sonraki: null });
  }
  if (f === "/api/hesap/veri") return js(r, 200, { alanlar: {} });
  if (f === "/api/hesap/kota") { const b = await govde(q); D.kota++; return js(r, 200, { verildi: b.adet || 1, kalanSoru: 500, kalanDeneme: 5 }); }
  if (f === "/api/ai") { await govde(q); D.ai++; return js(r, 200, { text: "[]" }); }
  if (f === "/api/soru/cevap") { await govde(q); D.cevap++; return js(r, 200, { a: 1, x: "sentetik açıklama" }); }
  if (f === "/api/soru/bitir") { await govde(q); return js(r, 200, { ok: true, sorular: [] }); }
  if (f === "/api/soru/oturum") {
    const b = await govde(q); D.istekler.push({ idSayisi: Array.isArray(b.idler) ? b.idler.length : -1, idler: Array.isArray(b.idler) ? b.idler.slice() : [] });
    D3.kayit.push({ sahip: kul || "", onek: [...new Set((b.idler || []).map(i => String(i).split("-")[1]))] });
    { const T = D3.oturumTut; if (T && !T.tuttu && T.kul === kul) { T.tuttu = true; await T.kapi; } }
    if (D.oturum === "404") return js(r, 404, { error: "yok" });
    if (D.oturum === "banka_yok") return js(r, 503, { error: "banka_yok" });
    if (D.oturum === "500") return js(r, 500, { error: "x" });
    if (D.oturum === "402") return js(r, 402, { error: "kota", kota: { kalan: 0 } });
    const idler = (b.idler || []).filter(i => BILGI.has(i) || KATID[i]), verilen = D.oturum === "bos" ? [] : D.oturum === "kismi" ? idler.slice(0, 5) : idler;
    return js(r, 200, { oturum: "o" + Math.floor(Math.random() * 1e9), kota: { sinirsiz: true }, sorular: verilen.map(i => { const k = BILGI.get(i) || KATID[i]; return { id: k.id, q: k.q, o: k.o, ...(k.p ? { p: k.p } : {}) }; }) });
  }
  if (f.startsWith("/api/")) return js(r, 404, {});
  r.statusCode = 404; r.end("");   // /sorular/* dahil: BANK yalnız index.html'deki gömülü sorulardan oluşur (deterministik)
});
await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"] });

/* BANK/GENS'ten YALNIZ ad ve cevapsız alanlar okunur (a/x ALINMAZ): ders/konu seçimi + sahte sunucunun BANK id'li oturum yanıtı (bayrak-kapalı karakterizasyon için) */
let SEC;
{ const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage(); await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(800);
  const l = await p.evaluate(() => BANK.map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, ...(q.p ? { p: q.p } : {}) }))); BILGI = new Map(l.map(x => [x.id, x]));
  SEC = await p.evaluate(() => {
    const sinav = Object.fromEntries(Object.keys(SUBJ).map(k => [k, SUBJ[k].e])), adet = {};
    BANK.forEach(q => { const k = q.s + "\u0001" + q.t; adet[k] = (adet[k] || 0) + 1; });
    for (const s of Object.keys(SUBJ)) {
      const bt = Object.entries(adet).filter(([k]) => k.split("\u0001")[0] === s && adet[k] >= 5).sort((x, y) => y[1] - x[1]).map(([k]) => k.split("\u0001")[1]);
      const bankKonu = new Set(Object.keys(adet).filter(k => k.split("\u0001")[0] === s).map(k => k.split("\u0001")[1]));
      const gensOnly = [...new Set(GENS.filter(g => (g.subs || []).includes(s) && !bankKonu.has(g.t)).map(g => g.t))];
      if (bt.length >= 2 && gensOnly.length >= 1) return { sinav, ders: s, tb: bt[0], ta: bt[1], gensOnly, diger: Object.keys(SUBJ).find(k => k !== s) };
    }
    return null;
  }); await c.close(); }
if (BILGI.size < 100 || !SEC) { console.error("TEST GEÇERSİZ: BANK/GENS okunamadı ya da uygun ders yok", BILGI.size, !!SEC); process.exit(2); }
const BID = new Set(BILGI.keys()), DERS = SEC.ders, TB = SEC.tb, TA = SEC.ta, DIGER = SEC.diger;
/* sentetik katalog (kullanıcı başına): DERS/TB 12 soru (zorluk 1,2,3 karışık), DERS/TA 4 soru, DIGER ders 6 soru; id = kat-<a|b>-<ders><no> (sahip = id.split("-")[1]); id sırasıyla */
for (const [kul, on] of [["kul1", "a"], ["kulB", "b"]]) {
  const l = [], ekle = (s, tt, n, k) => { for (let i = 1; i <= n; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-${on}-${k}${no}`, s, t: tt, d: 1 + (i % 3), q: `STD-${on.toUpperCase()}-${k}${no} sentetik katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }); } };
  ekle(DERS, TB, 12, "x"); ekle(DERS, TA, 4, "y"); ekle(DIGER, "Diğer Konu", 6, "z");
  l.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)); KATALOG.set(kul, l); l.forEach(x => { KATID[x.id] = x; });
}
const KS = new Set(KATALOG.get("kul1").map(x => x.id)), KSB = new Set(KATALOG.get("kulB").map(x => x.id));
const katDers = KATALOG.get("kul1").filter(x => x.s === DERS), katTB = katDers.filter(x => x.t === TB), katTA = katDers.filter(x => x.t === TA), d1 = ids => ids.filter(x => x.d === 1);

/* sayfa: guvenli → AKE_KATALOG_STUDYO; kat → AKE_KATALOG; havuz → AKE_KATALOG_HAVUZ; tuzak → S.aiQs/EKQ'ya aynı ders/konuda cevaplı TUZAK soru; ai → webAI açık (sahte /api/ai) */
async function sayfa({ giris = true, guvenli = false, svKapat = false, kat = true, havuz = true, kul = "kul1", hash = "#studyo", tuzak = true, ai = false } = {}) {
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1200, height: 900 } }), p = await c.newPage(); p.on("pageerror", () => { });
  await p.addInitScript(([g, k, kt, hv]) => { if (g) window.AKE_KATALOG_STUDYO = true; if (k) window.SV_KAPAT = true; if (kt && g) window.AKE_KATALOG = true; if (hv && g) window.AKE_KATALOG_HAVUZ = true; }, [guvenli, svKapat, kat, havuz]);
  if (giris) await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]);
  await p.goto(URL0 + hash, { waitUntil: "load" });
  await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 }); if (giris) await p.waitForFunction(() => HESAP.user, null, { timeout: 8000 });
  await p.evaluate(([ders, tb, ta, tuzak, ai]) => {
    window.__t = []; const T = toast; window.toast = m => { window.__t.push(String(m)); T(m); };
    if (tuzak) { const o = ["A", "B", "C", "D", "E"].map(h => h + " tuzak");
      S.aiQs.push({ id: "ai-tuzak-1", s: ders, t: tb, d: 1, q: "AI tuzak soru", o, a: 1, x: "tuzak çözüm", src: "ai" }); EKQ.push({ id: "ek-tuzak-1", s: ders, t: ta, d: 1, q: "EK tuzak soru", o, a: 2, x: "tuzak çözüm" }); }
    if (ai) { WEBAI.code = "sentetik-kod"; webAIAc(); }
    render();
  }, [DERS, TB, TA, tuzak, ai]);
  await p.waitForTimeout(300); return { c, p };
}
const sifirla = () => { D.istekler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D2.kat = "tam"; D2.katIstek = 0; D3.oturumTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); D3.kayit = []; };
const kapiYap = () => { let ac; const kapi = new Promise(o => { ac = o; }); return { kapi, ac }; };
const bekle = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise(o => setTimeout(o, 50)); } return false; };
const hazirBekle = (p, ms = 7000) => p.waitForFunction(() => ["hazir", "durdu"].includes(KHAVUZ.durumu().durum), null, { timeout: ms }).then(() => true, () => false);
const gec = async (c, p, kul) => { await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]); await p.evaluate(k => hesapKimlikGuncelle({ id: k, eposta: k + "@x.test", ad: "" }), kul); };
const kartDeger = p => p.evaluate(() => { const e = document.querySelector("[data-studyo-durum]"); return e ? e.dataset.studyoDurum : ""; });
/* RUN özeti: cevap DEĞERİ yok; yalnız kimlik/sayı/varlık */
const ozet = p => p.evaluate(async (bid) => {
  for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 250));
  const B = new Set(bid), R = RUN, ids = R ? R.qs.map(q => String(q.id)) : [];
  const ls = (() => { try { return JSON.parse(localStorage.getItem("ake.run") || "null"); } catch (e) { return null; } })();
  return { run: !!R, id: R ? R.id : null, n: ids.length, ids, ans: R ? R.ans.filter(a => a != null).length : 0, svN: R ? R.qs.filter(q => q.sv).length : 0, yerelN: R ? R.qs.filter(q => !q.sv).length : 0,
    aVar: R ? R.qs.filter(q => Number.isInteger(q.a)).length : 0, xVar: R ? R.qs.filter(q => typeof q.x === "string" && q.x).length : 0, genN: ids.filter(i => /^g:/.test(i)).length, bankN: ids.filter(i => B.has(i)).length, tuzakN: ids.filter(i => /tuzak/.test(i)).length,
    onek: [...new Set(ids.map(i => i.split("-")[1]))], gvn: R ? (R.gvn || null) : null, lsGvn: ls && ls.gvn ? ls.gvn : null, lsId: ls ? ls.id || null : null, lsN: ls && Array.isArray(ls.qs) ? ls.qs.length : -1,
    modal: UI.modal ? String(UI.modal.title || "") : "", toast: (window.__t || []).slice(), benzerDugme: !!document.querySelector('[data-a="benzerEkle"]') };
}, [...BID]);
/* stüdyoda seçim + GERÇEK "Teste başla" tıklaması; d: zorluk (0 karışık), t: konu ("" = tüm konular) */
async function baslat(p, { t = "", n = 10, d = 0, bekleme = true } = {}) {
  await p.evaluate(([s, tt, nn, dd]) => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; window.__t = []; try { localStorage.removeItem("ake.run"); } catch (e) { } const St = UI.studio; St.s = s; St.e = SUBJ[s].e; St.t = tt; St.n = nn; St.d = dd; render(); }, [DERS, t, n, d]);
  await p.waitForTimeout(150); const tikladi = await p.click("#sc3-go", { timeout: 2500 }).then(() => true, () => false);
  return bekleme ? { tikladi, ...(await ozet(p)) } : { tikladi };
}
const sadeceKat = (r, izinli) => r.run && r.n > 0 && r.ids.every(i => izinli.has(i)) && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && r.svN === r.n && r.aVar === 0 && r.xVar === 0;

/* =====================  KARAKTERİZASYON (bayrak KAPALI): mevcut davranış korunmalı  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await p.waitForTimeout(300);
  const sinav = await p.evaluate(() => (document.querySelector(".sc3-ex") || { innerText: "" }).innerText.replace(/\s+/g, " "));
  await p.evaluate(([s]) => { UI.studio.s = s; UI.studio.e = SUBJ[s].e; render(); }, [DERS]); await p.waitForTimeout(150);
  const satir = await p.evaluate(() => [...document.querySelectorAll(".sc3-k")].map(e => e.innerText.replace(/\s+/g, " ")));
  t("KARAKT", "K1 bayrak kapalı: konu listesi BANK+GENS sayar ('Sınırsız soru' görünür); sınav sayacı katalogdan değil BANK'tan gelir", satir.some(x => /Sınırsız soru/.test(x)) && /\d+ soru/.test(sinav), JSON.stringify({ sinav, ornek: satir.slice(0, 3) }));
  const r = await baslat(p, { t: TA, n: 10 });
  t("KARAKT", "K2 bayrak kapalı: ikinci konuda set yerel kaynaktan (BANK veya g:) oluşur, 1..10 soru, katalog id'si yok", r.tikladi && r.run && r.n >= 1 && r.n <= 10 && (r.bankN + r.genN) === r.n && r.ids.every(i => !KS.has(i)), JSON.stringify({ ...r, ids: undefined }));
  const r2 = await baslat(p, { t: "", n: 10 });
  t("KARAKT", "K3 bayrak kapalı: ders karışık set oluşur (BANK/GENS id'li), katalog id'si yok", r2.run && r2.n >= 1 && r2.ids.every(i => !KS.has(i)), JSON.stringify({ ...r2, ids: undefined })); await c.close(); }

/* =====================  GÜVENLİ: set kaynağı (yalnız sunucu kataloğu)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r = await baslat(p, { t: "", n: 10 });
  t("GÜVENLİ", "G1 ders karışık: set YALNIZ katalog id'li, sunucu oturumlu, cevap/çözüm yok; BANK/EKQ/S.aiQs/GENS yok; /oturum isteği katalog id'leriyle", r.tikladi && sadeceKat(r, KS) && r.n === 10 && D.istekler.length === 1 && D.istekler[0].idler.every(i => KS.has(i)), JSON.stringify({ ...r, ids: undefined, istek: D.istekler.length })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r = await baslat(p, { t: TB, n: 10 });
  t("GÜVENLİ", "G2 konu seçili: set yalnız o konunun katalog soruları (10 soru), aynı konu adlı BANK/EKQ/AI soruları yok", r.tikladi && sadeceKat(r, new Set(katTB.map(x => x.id))) && r.n === 10, JSON.stringify({ ...r, ids: undefined }));
  const hepsi = await baslat(p, { t: TB, n: 20 });
  t("GÜVENLİ", "G2b n=20 isteği, konuda 12 soru varken tam 12 soruyla başlar (GENS/BANK ile 20'ye tamamlanmaz)", sadeceKat(hepsi, new Set(katTB.map(x => x.id))) && hepsi.n === katTB.length, JSON.stringify({ n: hepsi.n, beklenen: katTB.length, gen: hepsi.genN, bank: hepsi.bankN })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r = await baslat(p, { t: TA, n: 10 });
  const mesaj = r.toast.join(" | ");
  t("GÜVENLİ", `G3 az soru: konuda ${katTA.length} katalog sorusu varken set tam ${katTA.length} soru (GENS/BANK ile doldurulmaz) ve kullanıcıya gerçek sayı söylenir`, sadeceKat(r, new Set(katTA.map(x => x.id))) && r.n === katTA.length && mesaj.includes(String(katTA.length)) && !mesaj.includes("10 soruyla"), JSON.stringify({ n: r.n, gen: r.genN, bank: r.bankN, toast: mesaj }));
  const dz = await baslat(p, { t: TB, n: 10, d: 1 }), beklenen = d1(katTB).length;
  t("GÜVENLİ", "G3b zorluk süzgeci (d=1): yalnız d=1 katalog soruları, sayı = mevcut d=1 sayısı (fazlası doldurulmaz)", sadeceKat(dz, new Set(d1(katTB).map(x => x.id))) && dz.n === Math.min(10, beklenen), JSON.stringify({ n: dz.n, beklenen })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  await p.evaluate(([s]) => { UI.studio.s = s; UI.studio.e = SUBJ[s].e; UI.studio.t = ""; render(); }, [DERS]); await p.waitForTimeout(250);
  const ek = await p.evaluate(() => ({ satir: [...document.querySelectorAll(".sc3-k")].map(e => e.innerText.replace(/\s+/g, " ")), ders: [...document.querySelectorAll(".sc3-d")].map(e => e.id + "|" + e.innerText.replace(/\s+/g, " ")), sinav: [...document.querySelectorAll(".sc3-ex")].map(e => e.innerText.replace(/\s+/g, " ")) }));
  const konular = new Set(katDers.map(x => x.t)), gensOnly = SEC.gensOnly;
  t("GÜVENLİ", "G4a konu listesi = katalogdaki konular (GENS-only ve BANK-only konular görünmez); satırlarda 'Sınırsız soru' yok", ek.satir.length >= 2 && ek.satir.some(x => x.includes(TB)) && ek.satir.some(x => x.includes(TA)) && gensOnly.every(g => !ek.satir.some(x => x.includes(g))) && !ek.satir.some(x => /Sınırsız/.test(x)), JSON.stringify({ satir: ek.satir.length, gensOnlyGorunen: gensOnly.filter(g => ek.satir.some(x => x.includes(g))).length, sinirsiz: ek.satir.filter(x => /Sınırsız/.test(x)).length }));
  t("GÜVENLİ", `G4b gerçek sayılar: '${TB}' satırı ${katTB.length} soru, '${TA}' satırı ${katTA.length} soru yazar`, ek.satir.some(x => x.includes(TB) && x.includes(`${katTB.length} soru`)) && ek.satir.some(x => x.includes(TA) && x.includes(`${katTA.length} soru`)), JSON.stringify({ satirlar: ek.satir.filter(x => x.includes(TB) || x.includes(TA)) }));
  const sinavDers = Object.keys(SEC.sinav).filter(k => SEC.sinav[k] === SEC.sinav[DERS] && KATALOG.get("kul1").some(x => x.s === k)), toplamSoru = KATALOG.get("kul1").filter(x => sinavDers.includes(x.s)).length;
  const dBtn = ek.ders.find(x => x.startsWith("sc3-s-" + DERS + "|")) || "", sBtn = ek.sinav.find(x => x.startsWith(SEC.sinav[DERS])) || "";
  t("GÜVENLİ", `G4c ders düğmesi katalogdaki konu sayısını (${new Set(katDers.map(x => x.t)).size} konu), sınav düğmesi katalogdaki soru sayısını (${toplamSoru} soru) gösterir (BANK/GENS sayısı değil)`, dBtn.includes(`${konular.size} konu`) && sBtn.includes(`${toplamSoru} soru`), JSON.stringify({ dBtn, sBtn, konular: konular.size, toplamSoru })); await c.close(); }

/* =====================  GÜVENLİ: sıra (taze → eski; eski = en uzun süredir görülmeyen önce)  ===================== */
{ const SIRA = ["x07", "x10", "x01", "x05", "x03"], TS = { x03: 5000, x07: 1000, x01: 3000, x10: 2000, x05: 4000 };   // eski: kimlik sırasından FARKLI zaman damgaları
  for (const n of [10, 20]) {
    sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
    await p.evaluate(ts => { for (const [k, v] of Object.entries(ts)) S.ans["kat-a-" + k] = [1, 0, 0, v, 1]; }, TS);
    const beklenenEski = SIRA.map(k => "kat-a-" + k).slice(0, Math.max(0, n - 7)); let tum = true, ek = "";
    for (let tekrar = 0; tekrar < 3; tekrar++) {
      const r = await baslat(p, { t: TB, n }), esk = new Set(SIRA.map(k => "kat-a-" + k)), idx = r.ids.map(i => esk.has(i)), ilkEski = idx.indexOf(true), sonTaze = idx.lastIndexOf(false), eskiSira = r.ids.filter(i => esk.has(i));
      const ok = r.run && sadeceKat(r, KS) && r.n === Math.min(n, katTB.length) && (ilkEski < 0 || sonTaze < ilkEski) && JSON.stringify(eskiSira) === JSON.stringify(beklenenEski);
      if (!ok) { tum = false; ek = JSON.stringify({ n: r.n, ilkEski, sonTaze, eskiSira, beklenenEski }); break; }
    }
    t("GÜVENLİ", `G5-${n} karma taze/eski (7 taze + 5 eski): RUN'da TÜM çözülmemişler çözülmüşlerden ÖNCE, eskiler 'en uzun süredir görülmeyen önce' sırasıyla (3 tekrar; son karıştırma yok)`, tum, ek); await c.close(); }
}

/* =====================  GÜVENLİ: sunucu hataları ve durum kartları (yerel fallback YOK)  ===================== */
for (const mod of ["404", "banka_yok", "bos", "500", "402"]) for (const konu of ["", TB]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); D.oturum = mod; const r = await baslat(p, { t: konu, n: 10 });
  t("GÜVENLİ", `H-${mod}${konu ? "-konu" : "-ders"} sunucu '${mod}' döner: yerel set açılmaz (RUN yok, BANK/GENS/EKQ/AI yok), kota isteği yok, kullanıcıya açık durum gösterilir`, r.tikladi && !r.run && r.genN === 0 && r.bankN === 0 && D.kota === 0 && (r.modal.length > 0 || r.toast.length > 0), JSON.stringify({ run: r.run, n: r.n, modal: r.modal, kota: D.kota })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); D.oturum = "kismi"; const r = await baslat(p, { t: "", n: 10 });
  t("GÜVENLİ", "H-kismi sunucu yalnız 5 soru verirse set tam 5 soru (eksik GENS/BANK ile tamamlanmaz), hepsi sunucu oturumlu, kota isteği yok", r.run && r.n === 5 && sadeceKat(r, KS) && D.kota === 0, JSON.stringify({ ...r, ids: undefined, kota: D.kota })); await c.close(); }
for (const [ad, ayar, beklenen] of [["giris", { giris: false }, "giris"], ["kapali", { kat: false }, "kapali"], ["kat404", {}, "kapali"], ["kat500", {}, "hata"], ["leak", {}, "hata"]]) {
  sifirla(); if (ad === "kat404") D2.kat = "404"; if (ad === "kat500") D2.kat = "500"; if (ad === "leak") D2.kat = "leak";
  const { c, p } = await sayfa({ guvenli: true, ...ayar }); await p.waitForTimeout(900);
  const durum = await kartDeger(p), satir = await p.evaluate(() => document.querySelectorAll(".sc3-k, .sc3-d").length), sinav = await p.evaluate(() => (document.querySelector(".sc3-ex") || { innerText: "" }).innerText.replace(/\s+/g, " "));
  const r = await baslat(p, { t: TB, n: 10 });
  t("GÜVENLİ", `D-${ad} durum kartı '${beklenen}' gösterilir; BANK/GENS tabanlı ders-konu listesi ve sayaçlar görünmez; 'Teste başla' set açmaz, /oturum isteği yok`, durum === beklenen && satir === 0 && !/\d+ soru/.test(sinav) && !r.run && D.istekler.length === 0, JSON.stringify({ durum, satir, sinav: sinav.slice(0, 60), run: r.run, istek: D.istekler.length })); await c.close(); }

/* =====================  GÜVENLİ: eski RUN  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  await p.evaluate(() => { RUN = null; baslatRun({ kind: "practice", title: "Eski yerel oturum", mode: "study", qs: BANK.slice(0, 6) }); RUN.ans[0] = 0; RUN.ans[1] = 1; saveRun(); UI.inRun = false; render(); }); await p.waitForTimeout(300);
  const o0 = await ozet(p), r0 = D.istekler.length, kart = await kartDeger(p);
  t("GÜVENLİ", "E1 işaretsiz eski yerel RUN varken stüdyoda açık 'eski-oturum' kartı görünür; sessiz 'Devam et' bandı yok", o0.run && !o0.gvn && o0.n === 6 && o0.ans === 2 && kart === "eski-oturum" && !(await p.evaluate(() => /Devam et/.test((document.querySelector(".banner") || { innerText: "" }).innerText))), JSON.stringify({ kart, run: o0.run, gvn: o0.gvn }));
  await p.click("#sc3-go", { timeout: 2000 }).catch(() => { }); await p.waitForTimeout(500); const o1 = await ozet(p);
  const gec1 = await p.evaluate(([s, tb]) => { const qs = KHAVUZ.poolOf(s).sorular.filter(q => q.t === tb).slice(0, 3); startRun({ kind: "practice", title: "Güvenli stüdyo", mode: "study", qs, studyoGuvenli: true, force: true }); return { n: qs.length, aVar: qs.filter(q => "a" in q || "x" in q).length }; }, [DERS, TB]); await p.waitForTimeout(400);
  const e2a = await ozet(p);
  await p.evaluate(([s, tb]) => { const qs = KHAVUZ.poolOf(s).sorular.filter(q => q.t === tb).slice(0, 3); UI.pendingRun = { kind: "practice", title: "Güvenli stüdyo", mode: "study", qs, studyoGuvenli: true }; UI.modal = { title: "x", runOnay: true }; ACT.runReplace(); }, [DERS, TB]); await p.waitForTimeout(400);
  await p.evaluate(() => { UI.pendingRun = null; ACT.runReplace(); }); await p.waitForTimeout(300); const o2 = await ozet(p);
  t("GÜVENLİ", "E2 'Teste başla', GEÇERLİ cevapsız katalog soruları + force:true, onaylı runReplace ve doğrudan runReplace eski RUN'ı ve ake.run'ı (kimlik, 6 soru, 2 cevap) EZMEZ; yeni /oturum isteği ve modal yok", gec1.n === 3 && gec1.aVar === 0 && o1.id === o0.id && e2a.id === o0.id && e2a.lsId === o0.id && o2.id === o0.id && o2.n === 6 && o2.ans === 2 && o2.lsId === o0.id && o2.lsN === 6 && D.istekler.length === r0 && o1.modal === "", JSON.stringify({ id: [o0.id, o1.id, o2.id], n: o2.n, ans: o2.ans, lsId: o2.lsId, istek: D.istekler.length - r0, modal: o1.modal })); await c.close(); }

/* =====================  GÜVENLİ: RUN işareti, benzer soru, yenileme  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, ai: true }); await hazirBekle(p); const r = await baslat(p, { t: TB, n: 10 });
  await p.waitForSelector('[data-a="pick"]', { timeout: 4000 }).catch(() => { }); await p.click('[data-a="pick"][data-o="0"]').catch(() => { });
  await p.waitForFunction(() => RUN && RUN.ans.some(a => a != null) && !UI.svBusy, null, { timeout: 4000 }).catch(() => { }); await p.waitForTimeout(250); const o0 = await ozet(p);
  t("GÜVENLİ", "B1 güvenli stüdyo RUN'ı kalıcı işaretli (RUN.gvn='studyo', ake.run'da da), 'Benzerini çöz' düğmesi görünmez", r.run && o0.gvn === "studyo" && o0.lsGvn === "studyo" && o0.benzerDugme === false, JSON.stringify({ gvn: o0.gvn, lsGvn: o0.lsGvn, dugme: o0.benzerDugme }));
  const a0 = D.ai, k0 = D.kota, r0 = D.istekler.length;
  await p.evaluate(() => ACT.benzerEkle()); await p.waitForTimeout(400);
  await p.evaluate(() => { const q = RUN.qs[RUN.cur]; benzerYok(q, "run"); }); await p.waitForTimeout(300);
  await p.evaluate(() => { const q = RUN.qs[RUN.cur]; UI.benzerQ = { q: snap(q), yer: "run" }; ACT.benzerAIGo(); }); await p.waitForTimeout(1000); const o1 = await ozet(p);
  t("GÜVENLİ", "B2 benzerEkle/benzerYok/benzerAIGo doğrudan çağrılsa da RUN, ake.run ve S.aiQs'a yerel soru girmez; AI isteği, kota ve yeni /oturum isteği yok", o1.n === o0.n && o1.yerelN === 0 && o1.lsN === o0.lsN && D.ai === a0 && D.kota === k0 && D.istekler.length === r0 && (await p.evaluate(() => S.aiQs.length)) === 1, JSON.stringify({ n0: o0.n, n1: o1.n, yerelN: o1.yerelN, ai: D.ai - a0, kota: D.kota - k0 }));
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); await p.waitForTimeout(500); const o2 = await ozet(p);
  t("GÜVENLİ", "B3 yenilemeden sonra güvenli RUN geri yüklenir: işaret 'studyo', aynı kimlik, tümü sunucu oturumlu, cevap alanı yalnız cevaplanan sorularda", o2.run && o2.gvn === "studyo" && o2.id === o0.id && o2.svN === o2.n && o2.aVar <= o2.ans, JSON.stringify({ gvn: o2.gvn, id: o2.id === o0.id, svN: o2.svN, n: o2.n })); await c.close(); }

/* =====================  GÜVENLİ: hesap / çıkış yarışları  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", tuttu: false }, kapiYap()); D3.oturumTut = T;
  await baslat(p, { t: TB, n: 10, bekleme: false }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); await p.waitForFunction(() => { const x = KHAVUZ.poolOf(UI.studio.s, {}); return x && x.sorular && x.sorular[0] && String(x.sorular[0].id).startsWith("kat-b-"); }, null, { timeout: 7000 }).catch(() => { });
  T.ac(); await p.waitForTimeout(900); const st = await ozet(p);
  t("GÜVENLİ", "Y1 A'nın gecikmiş oturum yanıtı B'ye geçişten sonra: A'ya ait RUN/ake.run oluşmaz, modal yok", tuttu && !st.onek.includes("a") && st.lsId === null && st.modal === "", JSON.stringify({ tuttu, onek: st.onek, lsId: st.lsId, modal: st.modal }));
  const rb = await baslat(p, { t: TB, n: 10 });
  t("GÜVENLİ", "Y2 B kendi stüdyosunu başlatabilir: yalnız B katalog soruları (kat-b-*), sunucu oturumlu; istek sahipleri tutarlı", sadeceKat(rb, KSB) && rb.onek.length === 1 && rb.onek[0] === "b" && D3.kayit.every(k => k.onek.every(o => (k.sahip === "kul1" && o === "a") || (k.sahip === "kulB" && o === "b"))), JSON.stringify({ onek: rb.onek, n: rb.n, kayit: D3.kayit })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", tuttu: false }, kapiYap()); D3.oturumTut = T;
  await baslat(p, { t: TB, n: 10, bekleme: false }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); await p.waitForTimeout(500); await gec(c, p, "kul1"); await p.waitForTimeout(700); T.ac(); await p.waitForTimeout(900); const st = await ozet(p);
  t("GÜVENLİ", "Y3 A→B→A sonrası geçiş öncesi (eski) yanıt yeni RUN açmaz; B kalıntısı yok; A yeniden başlatabilir", tuttu && !st.run && !st.onek.includes("b") && st.modal === "", JSON.stringify({ tuttu, run: st.run, onek: st.onek, modal: st.modal }));
  const ra = await baslat(p, { t: TB, n: 10 }); t("GÜVENLİ", "Y3b A→B→A sonrası A yeniden başlatır (meşgul kilidi takılı kalmaz); yalnız A katalog soruları", sadeceKat(ra, KS) && ra.onek[0] === "a", JSON.stringify({ n: ra.n, onek: ra.onek })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const once = await p.evaluate(() => document.querySelectorAll(".sc3-k, .sc3-d").length || 1); D3.cikisTut = kapiYap(); const istTaban = D.istekler.length;
  await p.evaluate(() => { window.__cik = ACT.cikis(); }); const geldi = await bekle(() => D3.cikisGeldi, 4000); await p.waitForTimeout(300);
  const ara = await p.evaluate(() => ({ satir: document.querySelectorAll(".sc3-k").length })); const r1 = await baslat(p, { t: TB, n: 10 });
  t("GÜVENLİ", "Y4 çıkış isteği beklerken: konu listesi görünmez; 'Teste başla' set açmaz (RUN yok, yerel set yok, yeni /oturum isteği yok)", geldi && ara.satir === 0 && !r1.run && r1.genN === 0 && r1.bankN === 0 && D.istekler.length === istTaban, JSON.stringify({ geldi, satir: ara.satir, run: r1.run, yeniIstek: D.istekler.length - istTaban }));
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(700); const son = await p.evaluate(() => ({ kullanici: !!HESAP.user, satir: document.querySelectorAll(".sc3-k").length }));
  t("GÜVENLİ", "Y4b çıkış tamamlanınca: kullanıcı yok, liste yok, 'giris' kartı", !son.kullanici && son.satir === 0 && (await kartDeger(p)) === "giris", JSON.stringify({ ...son, kart: await kartDeger(p) })); await c.close(); }

/* =====================  3C-4a: ACT.topicStart / OZ_ACT.dersKarisik artık GÜVENLİ çekirdeğe bağlı (ayrıntılı sözleşme: tests/studyo-dis-cagiranlar-istemci.mjs); kapsam DIŞI yollar yerel kalır  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await hazirBekle(p);
  await p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; const St = UI.studio; St.n = 10; St.d = 0; });
  await p.evaluate(([s, tt]) => ACT.topicStart({ s, t: tt }), [DERS, TA]); const r = await ozet(p);
  t("GÜVENLİ", `X1 bayrak açıkken ACT.topicStart (plan/zayıf konu çağıranı) GÜVENLİ çekirdeğe bağlı: konuda ${katTA.length} katalog sorusu → tam ${katTA.length} soru, yalnız katalog, sunucu oturumlu, cevapsız, gvn='studyo' (BANK/GENS dolgusu yok)`, sadeceKat(r, new Set(katTA.map(x => x.id))) && r.n === katTA.length && r.gvn === "studyo", JSON.stringify({ ...r, ids: undefined }));
  await p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; }); await p.evaluate(([s]) => OZ_ACT.dersKarisik({ s }), [DERS]); const r2 = await ozet(p);
  t("GÜVENLİ", "X2 bayrak açıkken OZ_ACT.dersKarisik (kart 'Bu dersten 10 soru') GÜVENLİ çekirdeğe bağlı: 10 soru, yalnız katalog, sunucu oturumlu, cevapsız, gvn='studyo'", sadeceKat(r2, KS) && r2.n === 10 && r2.gvn === "studyo", JSON.stringify({ ...r2, ids: undefined }));
  await p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; }); await p.evaluate(() => ACT.quick({ k: "mix" })); const xm = await ozet(p);
  t("GÜVENLİ", "X3 bayrak açıkken ACT.quick mix (plan 'Karışık test') GÜVENLİ çekirdeğe bağlı (3C-4b): gvn='studyo', yalnız katalog kimlikleri, sunucu oturumlu, BANK/GENS dolgusu yok (ayrıntı: tests/studyo-karma-istemci.mjs)", xm.run && xm.gvn === "studyo" && xm.ids.every(i => KS.has(i)) && xm.bankN === 0 && xm.genN === 0 && xm.svN === xm.n, JSON.stringify({ ...xm, ids: undefined }));
  await p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; }); await p.evaluate(() => ACT.quick({ k: "mini" })); const xmi = await ozet(p);
  t("GÜVENLİ", "X ACT.quick mini artık GÜVENLİ çekirdeğe bağlı (3C-4c): yerel dolgu yok: RUN açılırsa gvn='studyo', yalnız katalog kimlikleri, sunucu oturumlu, BANK/GENS yok; katalogda deneme dersi yoksa RUN açılmaz (ayrıntı: tests/studyo-mini-istemci.mjs)", !xmi.run || (xmi.gvn === "studyo" && xmi.ids.every(i => KS.has(i)) && xmi.bankN === 0 && xmi.genN === 0 && xmi.svN === xmi.n), JSON.stringify({ ...xmi, ids: undefined }));
  for (const [ad, f] of [["ACT.kocTest (koç)", () => ACT.kocTest({ s: "SB", t: "TT" })]]) {
    await p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; });
    await p.evaluate(([fs, s, tt]) => { new Function("return (" + fs.replace('"SB"', JSON.stringify(s)).replace('"TT"', JSON.stringify(tt)) + ")()")(); }, [f.toString(), DERS, TB]); const x = await ozet(p);
    t("DIŞ", `X ${ad}: 3C-4a/3C-4b kapsamı DIŞINDA; bayrak açıkken YEREL kalır (güvenli SAYILMAZ): gvn yok, katalog dışı soru var`, x.run && !x.gvn && x.ids.some(i => !KS.has(i)), JSON.stringify({ ...x, ids: undefined }));
  }
  await c.close(); }

console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı` + (kirmizi.length ? "\nKIRMIZI: " + kirmizi.join(" | ") : ""));
await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
