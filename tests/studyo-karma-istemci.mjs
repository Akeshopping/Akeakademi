// B4 3C-4b · ACT.quick({k:"mix"}) ("Karışık test" / "Karma test çöz") güvenli katalog geçişi — YALNIZ KIRMIZI/KARAKTERİZASYON TESTLERİ (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz).
// Uygulama koduna dokunmaz; CI'a EKLENMEZ. Taban: B4 0ec8ae3d13f90070657579ac3b970fcc6f24f5be.
// Sözleşme (AKE_KATALOG_STUDYO === true iken, 3C-3/3C-4a ile aynı): mix yalnız sunucu kataloğundan (KHAVUZ), en fazla 20 soru (mixParts toplamı), sunucu oturumlu, cevapsız (geçerli cevap değeri ve dolu çözüm metni YOK),
//   kalıcı RUN.gvn="studyo"; BANK/EKQ/S.aiQs/GENS dolgusu ve yerel kota (POST /api/hesap/kota) YOK; hata/boş/kısmi yanıtta yerel fallback yok; katalog yüklü değilse yükleme eylem sırasında başlar ve beklerken yerel RUN açılmaz;
//   işaretsiz eski RUN ezilmez; hesap/çıkış yarışlarında geç yanıt RUN açmaz. Derslerarası son karıştırma SEÇİMDEN SONRA yapılır (ders başına seçilen taze/eski sorular değişmez).
// Gruplar: [KARAKT] bayrak KAPALI mevcut davranış (yeşil kalmalı) · [GÜVENLİ] bayrak açık sözleşme (değişmemiş kodda KIRMIZI beklenir) · [ÖNERİ] önerilen tasarım sözleşmesi (kullanıcı bildirimi) · [DIŞ] bu adımın kapsamı DIŞINDA (mini deneme, koç testi...) bayrak açıkken de yerel kalır (yeşil, belgeleme)
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz; yalnız kimlik/sayı/varlık raporlanır. Çalıştırma: node tests/studyo-karma-istemci.mjs   ·   çıkış kodu: kırmızı sayısı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };

const D = { oturum: "tam", istekler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: "tam" | "kismi" (ilk 5) | "bos" | "404" | "banka_yok" | "500" | "402"
const D2 = { kat: "tam", katIstek: 0, tut: null, kes: null };           // kes: { ders: enFazlaSoru } sunucu kataloğunu ders başına keser
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
    D2.katIstek++; if (D2.tut && D2.tut.kul === kul) await D2.tut.kapi; if (!kul) return js(r, 401, {}); if (D2.kat === "404") return js(r, 404, {}); if (D2.kat === "500") return js(r, 500, {});
    let l = (KATALOG.get(kul) || []).map(x => ({ ...x }));
    if (D2.kes) { const say = {}; l = l.filter(x => { if (!(x.s in D2.kes)) return true; say[x.s] = (say[x.s] || 0) + 1; return say[x.s] <= D2.kes[x.s]; }); }
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

/* mixParts tablosu (B4 0ec8ae3 index.html:12682'den; "sanity" testi sayfadaki mixParts() ile eşitliği denetler) */
const ALAN = {
  SAY: [["turkce", 4], ["mat", 4], ["geo", 2], ["fizik", 2], ["kimya", 2], ["biyoloji", 2], ["amat", 4]],
  EA: [["turkce", 5], ["mat", 4], ["amat", 3], ["edebiyat", 4], ["tarih2", 2], ["cografya2", 2]],
  SOZ: [["turkce", 5], ["edebiyat", 5], ["tarih", 2], ["tarih2", 3], ["cografya2", 2], ["felsefe", 1], ["psikoloji", 1], ["sosyoloji", 1]],
  DIL: [["ingilizce", 14], ["turkce", 4], ["mat", 2]],
  "": [["turkce", 6], ["mat", 6], ["tarih", 2], ["cografya", 2], ["fizik", 2], ["biyoloji", 2]]   // varsayılan (bilinmeyen/boş alan)
};
const ALAN_AD = { SAY: "SAY", EA: "EA", SOZ: "SOZ", DIL: "DIL", "": "varsayılan" };
const MIXDERS = [...new Set(Object.values(ALAN).flat().map(x => x[0]))];
const toplam = l => l.reduce((a, x) => a + x[1], 0);

/* BANK'ten YALNIZ cevapsız alanlar okunur (a/x ALINMAZ): bayrak-kapalı karakterizasyon için sahte sunucunun BANK id'li oturum yanıtı + koç testi için bir ders/konu */
let XKON, SUBJ_AD;
{ const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage(); await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(800);
  const l = await p.evaluate(() => BANK.map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, ...(q.p ? { p: q.p } : {}) }))); BILGI = new Map(l.map(x => [x.id, x]));
  XKON = await p.evaluate(() => { const adet = {}; BANK.forEach(q => { const k = q.s + "\u0001" + q.t; adet[k] = (adet[k] || 0) + 1; }); const e = Object.entries(adet).filter(([, n]) => n >= 10).sort((x, y) => y[1] - x[1])[0]; return e ? { s: e[0].split("\u0001")[0], t: e[0].split("\u0001")[1] } : null; });
  SUBJ_AD = await p.evaluate(() => Object.fromEntries(Object.keys(SUBJ).map(k => [k, SUBJ[k].n])));
  await c.close(); }
if (BILGI.size < 100 || !XKON || !MIXDERS.every(k => SUBJ_AD[k])) { console.error("TEST GEÇERSİZ: BANK okunamadı", BILGI.size, !!XKON); process.exit(2); }
const BID = new Set(BILGI.keys());
/* sentetik katalog (kullanıcı başına): mix'te geçen HER ders için 16 cevapsız soru (zorluk 1,2,3 karışık); id = kat-<a|b>-<ders>NN (sahip = id.split("-")[1]) */
for (const [kul, on] of [["kul1", "a"], ["kulB", "b"]]) {
  const l = []; for (const s of MIXDERS) for (let i = 1; i <= 16; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-${on}-${s}${no}`, s, t: `Mix ${s}`, d: 1 + (i % 3), q: `KRM-${on.toUpperCase()}-${s}${no} sentetik katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }); }
  l.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)); KATALOG.set(kul, l); l.forEach(x => { KATID[x.id] = x; });
}
const KS = new Set(KATALOG.get("kul1").map(x => x.id)), KSB = new Set(KATALOG.get("kulB").map(x => x.id));
const idlerOf = (kul, s) => KATALOG.get(kul).filter(x => x.s === s).map(x => x.id).sort();

/* sayfa: guvenli → AKE_KATALOG_STUDYO (+AKE_KATALOG, AKE_KATALOG_HAVUZ); tuzak → mix'te geçen her derse cevaplı TUZAK EKQ/AI sorusu eklenir (yerel dolgu sızarsa yakalanır) */
async function sayfa({ giris = true, guvenli = false, kul = "kul1", hash = "#studyo", tuzak = true } = {}) {
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1200, height: 900 } }), p = await c.newPage(); p.on("pageerror", () => { });
  await p.addInitScript(g => { if (g) { window.AKE_KATALOG_STUDYO = true; window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; } }, guvenli);
  if (giris) await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]);
  await p.goto(URL0 + hash, { waitUntil: "load" });
  await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 }); if (giris) await p.waitForFunction(() => HESAP.user, null, { timeout: 8000 });
  await p.evaluate(([tuzak, ders]) => {
    window.__t = []; const T = toast; window.toast = m => { window.__t.push(String(m)); T(m); };
    if (tuzak) { const o = ["A", "B", "C", "D", "E"].map(h => h + " tuzak"); for (const s of ders) { S.aiQs.push({ id: "ai-tuzak-" + s, s, t: "Tuzak", d: 1, q: "AI tuzak soru", o, a: 1, x: "tuzak çözüm", src: "ai" }); EKQ.push({ id: "ek-tuzak-" + s, s, t: "Tuzak", d: 1, q: "EK tuzak soru", o, a: 2, x: "tuzak çözüm" }); } }
    render();
  }, [tuzak, MIXDERS]);
  await p.waitForTimeout(300); return { c, p };
}
const sifirla = () => { D.istekler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D2.kat = "tam"; D2.katIstek = 0; D2.tut = null; D2.kes = null; D3.oturumTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); D3.kayit = []; };
const kapiYap = () => { let ac; const kapi = new Promise(o => { ac = o; }); return { kapi, ac }; };
const bekle = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise(o => setTimeout(o, 50)); } return false; };
const hazirBekle = (p, ms = 7000) => p.waitForFunction(() => ["hazir", "durdu"].includes(KHAVUZ.durumu().durum), null, { timeout: ms }).then(() => true, () => false);
const onYukle = async p => { if (!(await hazirBekle(p))) { console.error("TEST GEÇERSİZ: katalog hazır olmadı"); process.exit(2); } };
const git = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(450); };
const gec = async (c, p, kul) => { await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]); await p.evaluate(k => hesapKimlikGuncelle({ id: k, eposta: k + "@x.test", ad: "" }), kul); };
const runSil = p => p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; window.__t = []; try { localStorage.removeItem("ake.run"); } catch (e) { } render(); });
const tikla = (p, sel) => p.click(sel, { timeout: 2500 }).then(() => true, () => false);
const setAlan = (p, a) => p.evaluate(x => { S.profile.alan = x; render(); }, a);
const eskiRunKur = p => p.evaluate(() => { RUN = null; baslatRun({ kind: "practice", title: "Eski yerel oturum", mode: "study", qs: BANK.slice(0, 6) }); RUN.ans[0] = 0; RUN.ans[1] = 1; saveRun(); UI.inRun = false; render(); });
/* RUN özeti: cevap DEĞERİ yok; yalnız kimlik/sayı/varlık. aVar = GEÇERLİ cevap değeri (0..4 tamsayı) sayısı, xVar = DOLU çözüm metni sayısı (yalnız `a` alanının varlığı sayılmaz) */
const ozet = p => p.evaluate(async (bid) => {
  for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 250));
  const B = new Set(bid), R = RUN, ids = R ? R.qs.map(q => String(q.id)) : [];
  const ls = (() => { try { return JSON.parse(localStorage.getItem("ake.run") || "null"); } catch (e) { return null; } })();
  return { run: !!R, id: R ? R.id : null, n: ids.length, ids, ans: R ? R.ans.filter(a => a != null).length : 0, svN: R ? R.qs.filter(q => q.sv).length : 0, yerelN: R ? R.qs.filter(q => !q.sv).length : 0,
    aVar: R ? R.qs.filter(q => Number.isInteger(q.a) && q.a >= 0 && q.a <= 4).length : 0, xVar: R ? R.qs.filter(q => typeof q.x === "string" && q.x.trim().length > 0).length : 0,
    genN: ids.filter(i => /^g:/.test(i)).length, bankN: ids.filter(i => B.has(i)).length, tuzakN: ids.filter(i => /tuzak/.test(i)).length, tekil: new Set(ids).size === ids.length,
    onek: [...new Set(ids.map(i => i.split("-")[1]))], gvn: R ? (R.gvn || null) : null, lsGvn: ls && ls.gvn ? ls.gvn : null, lsId: ls ? ls.id || null : null, lsN: ls && Array.isArray(ls.qs) ? ls.qs.length : -1,
    modal: UI.modal ? String(UI.modal.title || "") : "", toast: (window.__t || []).slice() };
}, [...BID]);
const sadeceKat = (r, izinli) => r.run && r.n > 0 && r.ids.every(i => izinli.has(i)) && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && r.svN === r.n && r.aVar === 0 && r.xVar === 0 && r.tekil;
const dagilim = ids => { const d = Object.fromEntries(MIXDERS.map(s => [s, 0])); ids.forEach(i => { const k = KATID[i]; if (k) d[k.s]++; }); return d; };
const beklenenDagilim = (alan, kes) => { const d = Object.fromEntries(MIXDERS.map(s => [s, 0])); ALAN[alan].forEach(([s, n]) => { d[s] += Math.min(n, kes && s in kes ? kes[s] : 16); }); return d; };
const esit = (x, y) => JSON.stringify(x) === JSON.stringify(y);
/* giriş yolları: GERÇEK tıklama (ana sayfa "Bugünün programı → Karışık test" ve "Sana özel → Karma test çöz") */
const GIRIS = {
  "ana sayfa 'Karışık test'": { kur: p => git(p, ""), sel: '.gtask [data-a="quick"][data-k="mix"]' },
  "koç 'Karma test çöz'": { kur: p => git(p, "#koc"), sel: '[data-a="quick"][data-k="mix"]' }
};
const girisYap = async (p, y, alan) => { await y.kur(p); if (alan !== undefined) { await setAlan(p, alan); await p.waitForTimeout(200); } return tikla(p, y.sel); };

/* =====================  KARAKTERİZASYON (bayrak KAPALI)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false });
  const tablo = await p.evaluate(al => { const o = {}; for (const a of al) { S.profile.alan = a; o[a] = mixParts(); } return o; }, Object.keys(ALAN));
  t("KARAKT", "S mixParts() tablosu testteki ALAN tablosuyla aynı (SAY/EA/SOZ/DIL/varsayılan; her biri toplam 20)", Object.keys(ALAN).every(a => esit(tablo[a], ALAN[a]) && toplam(tablo[a]) === 20), JSON.stringify(Object.fromEntries(Object.keys(ALAN).map(a => [a || "varsayılan", esit(tablo[a], ALAN[a])])))); await c.close(); }
for (const [ad, y] of Object.entries(GIRIS)) {
  sifirla(); const { c, p } = await sayfa({ guvenli: false }); const tk = await girisYap(p, y, "SAY"), r = await ozet(p);
  t("KARAKT", `K ${ad}: bayrak kapalı → yerel karma set (BANK/g:/EKQ/AI kimlikleri, katalog kimliği yok), gvn yok, katalog isteği yok`, tk && r.run && r.n >= 1 && r.n <= 20 && r.ids.every(i => !KS.has(i)) && (r.bankN + r.genN + r.tuzakN) === r.n && r.gvn === null && D2.katIstek === 0, JSON.stringify({ tk, ...r, ids: undefined, katIstek: D2.katIstek })); await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: false }); await p.evaluate(() => { ACT.quick({ k: "weak" }); }); const r = await ozet(p);
  t("KARAKT", "K ACT.quick weak (zayıf konu yok → mix'e düşer): bayrak kapalı → yerel karma set, katalog isteği yok", r.run && r.ids.every(i => !KS.has(i)) && r.gvn === null && D2.katIstek === 0, JSON.stringify({ run: r.run, gvn: r.gvn, katIstek: D2.katIstek })); await c.close(); }

/* =====================  GÜVENLİ: katalog yüklüyken her giriş × her alan  ===================== */
for (const [ad, y] of Object.entries(GIRIS)) for (const alan of Object.keys(ALAN)) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const tk = await girisYap(p, y, alan), r = await ozet(p), exp = beklenenDagilim(alan), N = toplam(ALAN[alan]);
  t("GÜVENLİ", `G ${ad} alan=${ALAN_AD[alan]}: ${N} katalog sorusu (en fazla 20), ders dağılımı mixParts'a uygun; gvn='studyo'; yalnız sunucu oturumu (tek /oturum isteği, ${N} kimlik); BANK/EKQ/AI/GENS dolgusu ve kota isteği yok`,
    tk && sadeceKat(r, KS) && r.n === N && r.n <= 20 && esit(dagilim(r.ids), exp) && r.gvn === "studyo" && r.lsGvn === "studyo" && D.istekler.length === 1 && D.istekler[0].idSayisi === N && D.istekler[0].idler.every(i => KS.has(i)) && D.kota === 0 && D.ai === 0,
    JSON.stringify({ tk, ...r, ids: undefined, dagilim: dagilim(r.ids), istek: D.istekler.map(x => x.idSayisi), kota: D.kota })); await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await git(p, ""); await setAlan(p, "SAY"); await p.evaluate(() => { ACT.quick({ k: "weak" }); }); const r = await ozet(p);
  t("GÜVENLİ", "W ACT.quick weak (zayıf konu yok → mix'e düşer): güvenli katalog karması (20 soru, gvn='studyo', yerel dolgu ve kota yok)", sadeceKat(r, KS) && r.n === 20 && r.gvn === "studyo" && D.kota === 0 && D.istekler.length === 1, JSON.stringify({ ...r, ids: undefined, kota: D.kota })); await c.close(); }

/* =====================  GÜVENLİ: eksik / boş ders  ===================== */
{ sifirla(); D2.kes = { fizik: 1, kimya: 0 }; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const tk = await girisYap(p, GIRIS["ana sayfa 'Karışık test'"], "SAY"), r = await ozet(p), exp = beklenenDagilim("SAY", D2.kes);
  t("GÜVENLİ", "M1 katalogda fizik 1, kimya 0 soru: eksik sayıyla (17) açılır; fazlası GENS/BANK/EKQ/AI ile DOLDURULMAZ; /oturum yalnız bu 17 kimliği ister; kota yok", tk && sadeceKat(r, KS) && r.n === 17 && esit(dagilim(r.ids), exp) && D.istekler.length === 1 && D.istekler[0].idSayisi === 17 && D.kota === 0, JSON.stringify({ tk, n: r.n, dagilim: dagilim(r.ids), genN: r.genN, bankN: r.bankN, tuzakN: r.tuzakN, istek: D.istekler.map(x => x.idSayisi), kota: D.kota }));
  t("ÖNERİ", "M1 eksik ders için kullanıcıya bildirim (toast) gösterilir ve eksik dersin adı geçer (startExamFromUI'deki 'yeterli soru yok' uyarısı gibi) — önerilen tasarım sözleşmesi", tk && r.toast.length > 0 && r.toast.some(m => m.includes(SUBJ_AD.fizik) || m.includes(SUBJ_AD.kimya)), JSON.stringify({ toast: r.toast })); await c.close(); }
{ sifirla(); D2.kes = Object.fromEntries(ALAN.SAY.map(([s]) => [s, 0])); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const tk = await girisYap(p, GIRIS["ana sayfa 'Karışık test'"], "SAY"), r = await ozet(p);
  t("GÜVENLİ", "M2 katalogda SAY'ın hiçbir dersinden soru yok: RUN açılmaz, yerel set ve /oturum, kota isteği yok, kullanıcıya açık mesaj (toast) gösterilir", tk && !r.run && r.lsId === null && D.istekler.length === 0 && D.kota === 0 && r.toast.length > 0, JSON.stringify({ tk, run: r.run, istek: D.istekler.length, kota: D.kota, toast: r.toast })); await c.close(); }

/* =====================  GÜVENLİ: taze önce seçim ve son karıştırma  ===================== */
const isaretle = (p, l) => p.evaluate(x => { x.forEach(([id, ts]) => { S.ans[id] = [1, 0, 0, ts, 1]; }); }, l);
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const taze = {}, isl = [];
  for (const [s, n] of ALAN.SAY) { const ids = idlerOf("kul1", s), k = 16 - n - 1; ids.slice(0, k).forEach((id, i) => isl.push([id, 1000 + i])); taze[s] = new Set(ids.slice(k)); }
  await isaretle(p, isl); const tk = await girisYap(p, GIRIS["ana sayfa 'Karışık test'"], "SAY"), r = await ozet(p);
  const hepsiTaze = ALAN.SAY.every(([s]) => r.ids.filter(i => KATID[i] && KATID[i].s === s).every(i => taze[s].has(i)));
  t("GÜVENLİ", "F1 her derste taze soru sayısı istenenden 1 fazla: seçilen sorular YALNIZ taze (çözülmemiş) olanlardan; ders başına sayılar korunur (son karıştırma seçimi değiştirmez)", tk && sadeceKat(r, KS) && r.n === 20 && hepsiTaze && esit(dagilim(r.ids), beklenenDagilim("SAY")), JSON.stringify({ tk, n: r.n, hepsiTaze, dagilim: dagilim(r.ids) })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const isl = [], bekl = {};
  for (const s of ["turkce", "mat"]) { const ids = idlerOf("kul1", s); ids.slice(0, 14).forEach((id, i) => isl.push([id, 1000 + i])); bekl[s] = new Set([ids[14], ids[15], ids[0], ids[1]]); }   /* taze 2 + en uzun süredir görülmeyen 2 */
  await isaretle(p, isl); const y = GIRIS["ana sayfa 'Karışık test'"], tk = await girisYap(p, y, "SAY"), r1 = await ozet(p);
  await runSil(p); await y.kur(p); const tk2 = await tikla(p, y.sel), r2 = await ozet(p);
  const kume = (r, s) => new Set(r.ids.filter(i => KATID[i] && KATID[i].s === s)), eq = (A, B2) => A.size === B2.size && [...A].every(x => B2.has(x));
  const dogru = r => ["turkce", "mat"].every(s => eq(kume(r, s), bekl[s]));
  t("GÜVENLİ", "F2 turkce/mat'ta taze yalnız 2 (istenen 4): seçim = 2 taze + en uzun süredir görülmeyen 2; İKİ ayrı çalıştırmada AYNI küme (seçim karıştırmadan önce deterministik; son karıştırma kümeyi değiştirmez)", tk && tk2 && r1.run && r2.run && dogru(r1) && dogru(r2) && r1.n === 20 && r2.n === 20, JSON.stringify({ tk, tk2, n1: r1.n, n2: r2.n, d1: dogru(r1), d2: dogru(r2) })); await c.close(); }

/* =====================  GÜVENLİ: katalog HENÜZ yüklenmemişken tıklama  ===================== */
for (const [ad, y] of Object.entries(GIRIS)) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true, hash: "" }); D2.tut = Object.assign({ kul: "kul1" }, kapiYap());
  await y.kur(p); await setAlan(p, "SAY"); const once = D2.katIstek, kd = await p.evaluate(() => KHAVUZ.durumu().durum);
  if (once !== 0 || ["hazir", "durdu"].includes(kd)) { console.error("TEST GEÇERSİZ: katalog zaten yüklü/istendi", once, kd); process.exit(2); }
  const tk = await tikla(p, y.sel); const basladi = await bekle(() => D2.katIstek >= 1, 3500); await p.waitForTimeout(700);
  const bekleRun = await p.evaluate(() => ({ run: !!RUN, ls: !!localStorage.getItem("ake.run"), n: RUN ? RUN.qs.length : 0 }));
  t("GÜVENLİ", `Y ${ad}: katalog yüklü değilken tıklama → katalog yüklemesi BAŞLAR (GET /api/soru/katalog) ve yanıt beklenirken yerel RUN/ake.run açılmaz`, tk && basladi && !bekleRun.run && !bekleRun.ls, JSON.stringify({ tk, basladi, bekleRun }));
  D2.tut.ac(); await p.waitForTimeout(1500); const son = await ozet(p);
  t("GÜVENLİ", `Y ${ad}: yükleme bitince yerel set YOK (ya hiç RUN yok ya da yalnız katalog kimlikli güvenli RUN, gvn='studyo'); BANK/EKQ/AI/GENS ve kota isteği yok  (3C-4a sözleşmesiyle aynı gevşeklik)`, (!son.run || (sadeceKat(son, KS) && son.gvn === "studyo")) && son.genN === 0 && son.bankN === 0 && son.tuzakN === 0 && D.kota === 0, JSON.stringify({ ...son, ids: undefined, kota: D.kota })); await c.close();
}

/* =====================  GÜVENLİ: sunucu hataları (404, banka_yok, boş, 500, 402) ve kısmi yanıt  ===================== */
for (const mod of ["404", "banka_yok", "bos", "500", "402"]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); D.oturum = mod; const tk = await girisYap(p, GIRIS["ana sayfa 'Karışık test'"], "SAY"), r = await ozet(p);
  t("GÜVENLİ", `H mix sunucu '${mod}': yerel set açılmaz (RUN yok, BANK/GENS/EKQ/AI yok), yerel kota isteği yok, kullanıcıya açık durum gösterilir`, tk && !r.run && r.genN === 0 && r.bankN === 0 && D.kota === 0 && (r.modal.length > 0 || r.toast.length > 0), JSON.stringify({ tk, run: r.run, modal: r.modal, kota: D.kota, toast: r.toast.length })); await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); D.oturum = "kismi"; const tk = await girisYap(p, GIRIS["koç 'Karma test çöz'"], "SAY"), r = await ozet(p);
  t("GÜVENLİ", "H mix kısmi yanıt (sunucu yalnız 5 soru verir): set tam 5 soru, hepsi katalog + sunucu oturumlu, yerel dolgu ve kota isteği yok", tk && sadeceKat(r, KS) && r.n === 5 && D.kota === 0, JSON.stringify({ tk, ...r, ids: undefined, kota: D.kota })); await c.close(); }

/* =====================  GÜVENLİ: eski RUN  ===================== */
for (const [ad, y] of Object.entries(GIRIS)) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await y.kur(p); await setAlan(p, "SAY"); await eskiRunKur(p); const o0 = await ozet(p), r0 = D.istekler.length; await tikla(p, y.sel); await p.waitForTimeout(500); const o1 = await ozet(p);
  t("GÜVENLİ", `E ${ad}: işaretsiz eski RUN (6 soru, 2 cevap) ezilmez; ake.run ve kimlik aynı, yeni /oturum isteği ve 'Yarım kalan oturum' değiştirme penceresi yok`, o0.run && !o0.gvn && o1.id === o0.id && o1.n === 6 && o1.ans === 2 && o1.lsId === o0.id && o1.lsN === 6 && D.istekler.length === r0 && o1.modal === "", JSON.stringify({ id: [o0.id, o1.id], n: o1.n, ans: o1.ans, lsId: o1.lsId, istek: D.istekler.length - r0, modal: o1.modal })); await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const y = GIRIS["ana sayfa 'Karışık test'"]; await y.kur(p); await setAlan(p, "SAY");
  const kq = KATALOG.get("kul1").filter(x => x.s === "turkce").slice(0, 6).map(x => ({ id: x.id, s: x.s, t: x.t, d: x.d, q: x.q, o: x.o, sv: "ohazir" }));
  await p.evaluate(l => { RUN = null; baslatRun({ kind: "practice", title: "Güvenli eski oturum", mode: "study", qs: l, studyoGuvenli: true }); UI.inRun = false; render(); }, kq); const o0 = await ozet(p), r0 = D.istekler.length;
  await tikla(p, y.sel); await p.waitForTimeout(500); const o1 = await ozet(p), ist1 = D.istekler.length;
  t("GÜVENLİ", "E2 güvenli (gvn='studyo') RUN varken mix: sunucu isteği ve RUN değişikliği yalnız ONAYDAN sonra; 'Yarım kalan oturum' penceresi açılır, RUN ve ake.run korunur", o0.gvn === "studyo" && o1.modal === "Yarım kalan oturum var" && o1.id === o0.id && o1.lsId === o0.id && ist1 === r0, JSON.stringify({ gvn: o0.gvn, modal: o1.modal, ayni: o1.id === o0.id, istek: ist1 - r0 }));
  const onay = await tikla(p, '[data-a="runReplace"]'); await p.waitForTimeout(900); const o2 = await ozet(p);
  t("GÜVENLİ", "E2 onaydan sonra: yeni RUN güvenli karma set (20 katalog sorusu, gvn='studyo'), tek /oturum isteği, yerel dolgu ve kota yok", onay && sadeceKat(o2, KS) && o2.n === 20 && o2.id !== o0.id && o2.gvn === "studyo" && D.istekler.length - r0 === 1 && D.kota === 0, JSON.stringify({ onay, n: o2.n, yeni: o2.id !== o0.id, gvn: o2.gvn, istek: D.istekler.length - r0, kota: D.kota })); await c.close(); }

/* =====================  GÜVENLİ: hesap değişimi / çıkış yarışları (bekleyen KATALOG GET'i)  ===================== */
for (const [ad, y, senlar] of [["ana sayfa 'Karışık test'", GIRIS["ana sayfa 'Karışık test'"], ["A→B", "A→B→A"]], ["koç 'Karma test çöz'", GIRIS["koç 'Karma test çöz'"], ["A→B"]]]) for (const sen of senlar) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true, hash: "" }); D2.tut = Object.assign({ kul: "kul1" }, kapiYap());
  await y.kur(p); await setAlan(p, "SAY"); const once = D2.katIstek, kd = await p.evaluate(() => KHAVUZ.durumu().durum);
  if (once !== 0 || ["hazir", "durdu"].includes(kd)) { console.error("TEST GEÇERSİZ: katalog zaten yüklü/istendi", once, kd); process.exit(2); }
  const tk = await tikla(p, y.sel); const basladi = await bekle(() => D2.katIstek >= 1, 3500);
  await gec(c, p, "kulB"); if (sen === "A→B→A") { await p.waitForTimeout(300); await gec(c, p, "kul1"); }
  await p.waitForTimeout(400); D2.tut.ac(); await p.waitForTimeout(1500);
  const o1 = await ozet(p), oturumIst = D.istekler.length, kota1 = D.kota, kBist = D3.kayit.filter(k => k.sahip === "kulB").length;
  t("GÜVENLİ", `R ${ad} ${sen}: A'nın geç katalog yanıtı bırakılınca eski bekleyen eylem RUN/ake.run AÇMAZ, modal yok, yerel set ve kota isteği yok`, tk && basladi && !o1.run && o1.lsId === null && o1.modal === "" && o1.genN === 0 && o1.bankN === 0 && kota1 === 0, JSON.stringify({ tk, basladi, run: o1.run, lsId: o1.lsId, modal: o1.modal, kota: kota1 }));
  t("GÜVENLİ", `R ${ad} ${sen}: eski bekleyen eylem hiçbir /api/soru/oturum isteği başlatmaz (yeni hesap adına da)`, oturumIst === 0 && D3.kayit.length === 0 && kBist === 0, JSON.stringify({ oturumIst, kayit: D3.kayit.length, kulBistek: kBist }));
  await git(p, "#studyo"); const yuk = await hazirBekle(p); await p.waitForTimeout(700); const o3 = await ozet(p);
  t("GÜVENLİ", `R ${ad} ${sen}: sonradan (#studyo ile) katalog yüklenip hazır olunca da eski bekleyen eylem çalışmaz: RUN/ake.run yok, /oturum isteği yok`, yuk && !o3.run && o3.lsId === null && D.istekler.length === 0 && D3.kayit.length === 0, JSON.stringify({ yuk, run: o3.run, lsId: o3.lsId, oturum: D.istekler.length }));
  if (sen === "A→B") {
    await runSil(p); await y.kur(p); await setAlan(p, "SAY"); const tb = await tikla(p, y.sel), rb = await ozet(p);
    t("GÜVENLİ", `R ${ad} A→B: B kendi eylemini başlatınca YALNIZ B katalog kimlikleriyle (kat-b-*), 20 soru; /oturum istekleri B adına ve yalnız B kimlikli; kota yok`, tb && sadeceKat(rb, KSB) && rb.n === 20 && rb.onek.length === 1 && rb.onek[0] === "b" && D3.kayit.length >= 1 && D3.kayit.every(k => k.sahip === "kulB" && k.onek.length === 1 && k.onek[0] === "b") && D.kota === 0, JSON.stringify({ tb, n: rb.n, onek: rb.onek, kayit: D3.kayit.map(k => ({ s: k.sahip, o: k.onek })), kota: D.kota }));
  }
  await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, hash: "" }); D2.tut = Object.assign({ kul: "kul1" }, kapiYap()); const y = GIRIS["ana sayfa 'Karışık test'"];
  await y.kur(p); await setAlan(p, "SAY"); if (D2.katIstek !== 0) { console.error("TEST GEÇERSİZ: katalog zaten istendi", D2.katIstek); process.exit(2); }
  const tk = await tikla(p, y.sel); const basladi = await bekle(() => D2.katIstek >= 1, 3500);
  D3.cikisTut = kapiYap(); await p.evaluate(() => { window.__cik = ACT.cikis(); }); const geldi = await bekle(() => D3.cikisGeldi, 4000); await p.waitForTimeout(300);
  D2.tut.ac(); await p.waitForTimeout(1500); const o1 = await ozet(p), ist1 = D.istekler.length;
  const tk2 = await tikla(p, y.sel); await p.waitForTimeout(600); const o2 = await ozet(p);
  t("GÜVENLİ", "Q ana sayfa 'Karışık test': çıkış isteği beklerken katalog yanıtı gelir → RUN ve ake.run yok, yerel set yok, /oturum ve yerel kota isteği yok; yeni tıklama da RUN açmaz", tk && basladi && geldi && !o1.run && o1.lsId === null && ist1 === 0 && D.kota === 0 && !o2.run && o2.lsId === null && o2.genN === 0 && o2.bankN === 0 && D.istekler.length === 0, JSON.stringify({ tk, basladi, geldi, run1: o1.run, lsId1: o1.lsId, oturum1: ist1, tk2, run2: o2.run, lsId2: o2.lsId, oturum2: D.istekler.length, kota: D.kota }));
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(600); await c.close(); }

/* =====================  DIŞ: 3C-4d sonrası: kocTest de güvenli çekirdeğe bağlı (kocOrnekler ve mist* KAPSAM DIŞI; tests/studyo-koc-istemci.mjs)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await runSil(p); await p.evaluate(() => { ACT.quick({ k: "mini" }); }); const xmi = await ozet(p);
  t("GÜVENLİ", "X ACT.quick mini artık GÜVENLİ çekirdeğe bağlı (3C-4c): yerel dolgu yok: RUN açılırsa gvn='studyo', yalnız katalog kimlikleri, sunucu oturumlu, BANK/GENS yok; katalogda deneme dersi yoksa RUN açılmaz (ayrıntı: tests/studyo-mini-istemci.mjs)", !xmi.run || (xmi.gvn === "studyo" && xmi.ids.every(i => KS.has(i)) && xmi.bankN === 0 && xmi.genN === 0 && xmi.svN === xmi.n), JSON.stringify({ ...xmi, ids: undefined })); await c.close(); }
for (const [ad, kod] of [["ACT.kocTest (koç testi)", "ACT.kocTest({ s: X.s, t: X.t })"]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await runSil(p);
  await p.evaluate(([k, x]) => { new Function("X", k)(x); }, [kod, XKON]); const r = await ozet(p);
  t("GÜVENLİ", `X ${ad} (3C-4d): bayrak açıkken GÜVENLİ çekirdeğe bağlı: RUN açılırsa gvn='studyo', yalnız katalog kimlikleri, sunucu oturumlu, BANK/GENS dolgusu yok (ayrıntı: tests/studyo-koc-istemci.mjs; kocOrnekler ve mist* KAPSAM DIŞI, güvenli sayılmaz)`, r.run && r.gvn === "studyo" && r.ids.every(i => KS.has(i)) && r.bankN === 0 && r.genN === 0 && r.svN === r.n, JSON.stringify({ ...r, ids: undefined })); await c.close();
}

console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı` + (kirmizi.length ? "\nKIRMIZI: " + kirmizi.join(" | ") : ""));
await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
