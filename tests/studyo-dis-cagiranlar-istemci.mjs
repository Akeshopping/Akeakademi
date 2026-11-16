// B4 3C-4a · stüdyo DIŞI çağıranların güvenli geçişi: ACT.topicStart ve OZ_ACT.dersKarisik (+ plan konu görevi, ana sayfa zayıf konu, "Bu dersten 10 soru" kartı)
// (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz). Uygulama koduna dokunmaz; CI'a EKLENMEZ.
// Sözleşme (AKE_KATALOG_STUDYO === true iken): bu çağıranlar da YALNIZ sunucu kataloğundan (KHAVUZ), sunucu oturumlu, cevapsız (a/x yok), kalıcı RUN.gvn="studyo" ile set açar;
//   BANK/EKQ/S.aiQs/GENS sete girmez; hata/boş/kısmi yanıtta yerel fallback ve yerel kota yok; katalog yüklü değilse (#home) yükleme başlar ve beklerken yerel RUN açılmaz;
//   plan/kart girişleri stüdyodaki önceki seçimden (ör. 70) bağımsız 10 soru ister; işaretsiz eski RUN ezilmez; hesap/çıkış yarışlarında geç yanıt RUN açmaz.
// Gruplar: [KARAKT] bayrak KAPALI mevcut davranış (yeşil kalmalı) · [GÜVENLİ] bayrak açık sözleşme (şu an KIRMIZI beklenir) · [DIŞ] bu adımın kapsamı DIŞINDA kalan yollar (quick mix, mini deneme, koç) bayrak açıkken de yerel kalır (yeşil, belgeleme)
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz; yalnız kimlik/sayı/varlık raporlanır. Çalıştırma: node tests/studyo-dis-cagiranlar-istemci.mjs   ·   çıkış kodu: kırmızı sayısı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };

const D = { oturum: "tam", istekler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: "tam" | "kismi" (ilk 5) | "bos" | "404" | "banka_yok" | "500" | "402"
const D2 = { kat: "tam", katIstek: 0, tut: null };                                // kat: "tam" | "404" | "leak" | "500"
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
/* adet testleri için büyük sentetik katalog (yalnız kul1; ders DIGER, konu BT): 85 cevapsız soru (+ DIGER'de 6 'Diğer Konu') → 20, 50 ve çok büyük adet istekleri gerçekten ayrışır; DERS/TB/TA sayıları DEĞİŞMEZ */
const BT = "Büyük Konu";
{ const l = KATALOG.get("kul1"); for (let i = 1; i <= 85; i++) { const no = String(i).padStart(2, "0"); const x = { id: `kat-a-w${no}`, s: DIGER, t: BT, d: 1 + (i % 3), q: `STD-A-w${no} sentetik büyük katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }; l.push(x); KATID[x.id] = x; }
  l.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)); }
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
const sifirla = () => { D.istekler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D2.kat = "tam"; D2.katIstek = 0; D2.tut = null; D3.oturumTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); D3.kayit = []; };
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

/* =====================  yardımcılar (3C-4a)  ===================== */
const onYukle = async p => { if (!(await hazirBekle(p))) { console.error("TEST GEÇERSİZ: katalog hazır olmadı"); process.exit(2); } };
const git = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(450); };
const runSil = p => p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; window.__t = []; try { localStorage.removeItem("ake.run"); } catch (e) { } });
const stN = (p, n) => p.evaluate(nn => { UI.studio.n = nn; UI.studio.d = 0; }, n);
const eylem = (p, ad, d) => p.evaluate(([a, dd]) => { (a === "topicStart" ? ACT : OZ_ACT)[a](dd); }, [ad, d]);
const planKur = p => p.evaluate(([s, tt]) => { LS.set("ake.gp", JSON.stringify({ d: dayKey(), w: [{ s, t: tt }], m0: 0, k0: 0, den: false })); render(); }, [DERS, TB]);
const zayifKur = p => p.evaluate(([s, tt]) => { S.topic[s + "|" + tt] = [1, 2, 0]; render(); }, [DERS, TB]);
const kartKur = async p => { await p.evaluate(s => { window.kisaKartlar = () => [{ n: "Sentetik kart", s, items: ["Ad: açıklama"] }]; }, DERS); await git(p, "#kisa"); };
const tikla = async (p, sel) => p.click(sel, { timeout: 2500 }).then(() => true, () => false);
const eskiRunKur = p => p.evaluate(() => { RUN = null; baslatRun({ kind: "practice", title: "Eski yerel oturum", mode: "study", qs: BANK.slice(0, 6) }); RUN.ans[0] = 0; RUN.ans[1] = 1; saveRun(); UI.inRun = false; render(); });
const katTum = KATALOG.get("kul1").filter(x => x.s === DERS);
/* giriş yolları: ad → [hazırlık, tetikleyici]; hepsi GERÇEK eylem/tıklama (plan, zayıf konu ve kart için DOM tıklaması) */
const YOL = {
  "ACT.topicStart": { kur: async () => { }, git: async (p) => { await eylem(p, "topicStart", { s: DERS, t: TB }); return true; }, konu: TB },
  "OZ_ACT.dersKarisik": { kur: async () => { }, git: async (p) => { await eylem(p, "dersKarisik", { s: DERS }); return true; }, konu: "" },
  "plan konu görevi": { kur: async p => { await git(p, ""); await planKur(p); await p.waitForTimeout(250); }, git: p => tikla(p, '.gtask [data-a="topicStart"]'), konu: TB },
  "ana sayfa zayıf konu": { kur: async p => { await git(p, ""); await zayifKur(p); await p.waitForTimeout(250); }, git: p => tikla(p, '.list [data-a="topicStart"]'), konu: TB },
  "'Bu dersten 10 soru' kartı": { kur: async p => { await kartKur(p); }, git: p => tikla(p, `[data-a="dersKarisik"][data-s="${DERS}"]`), konu: "" }
};
const beklenenKat = konu => new Set((konu ? katTB : katDers).map(x => x.id));
const beklenenN = konu => Math.min(10, (konu ? katTB : katDers).length);

/* =====================  KARAKTERİZASYON (bayrak KAPALI): mevcut davranış korunmalı  ===================== */
for (const [ad, y] of Object.entries(YOL)) {
  sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await y.kur(p); const tk = await y.git(p), r = await ozet(p);
  t("KARAKT", `K ${ad}: bayrak kapalı → yerel set (BANK/g: kimlikleri, katalog kimliği yok), katalog isteği yok`, tk && r.run && r.n >= 1 && (r.bankN + r.genN) === r.n && r.ids.every(i => !KS.has(i)) && D2.katIstek === 0, JSON.stringify({ tk, ...r, ids: undefined, katIstek: D2.katIstek })); await c.close();
}

/* =====================  GÜVENLİ: katalog yüklüyken her giriş yolu güvenli set açar  ===================== */
for (const [ad, y] of Object.entries(YOL)) {
  const sabit10 = ad === "plan konu görevi" || ad === "'Bu dersten 10 soru' kartı";   // yalnız plan ve kart stüdyo seçiminden bağımsız 10 ister; diğer girişlerin adet davranışı DEĞİŞMEZ (aşağıdaki 'A' testleri)
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await y.kur(p); if (sabit10) await stN(p, 70); const tk = await y.git(p), r = await ozet(p), k0 = D.kota;
  t("GÜVENLİ", `G ${ad}${sabit10 ? " (stüdyoda 70 seçiliyken)" : ""}: katalog kimlikli, cevapsız, sunucu oturumlu set; ${beklenenN(y.konu)} soru (10 istenir); gvn='studyo'; BANK/EKQ/AI/GENS yok; kota isteği yok`,
    tk && sadeceKat(r, beklenenKat(y.konu)) && r.n === beklenenN(y.konu) && r.gvn === "studyo" && r.lsGvn === "studyo" && D.istekler.length === 1 && D.istekler[0].idSayisi === beklenenN(y.konu) && D.istekler[0].idler.every(i => KS.has(i)) && k0 === 0,
    JSON.stringify({ tk, ...r, ids: undefined, istek: D.istekler.map(x => x.idSayisi), kota: k0 })); await c.close();
}

/* =====================  GÜVENLİ: diğer girişlerin adet davranışı korunur (stüdyo seçimi geçerli; plan/kart gibi sabit 10 DEĞİL)  ===================== */
for (const [ad, y, mevcut] of [["ACT.topicStart", YOL["ACT.topicStart"], katTB.length], ["OZ_ACT.dersKarisik", YOL["OZ_ACT.dersKarisik"], katDers.length], ["ana sayfa zayıf konu", YOL["ana sayfa zayıf konu"], katTB.length]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await y.kur(p); await stN(p, 20); const tk = await y.git(p), r = await ozet(p), bk = beklenenKat(y.konu), toastlar = r.toast.join(" | ");
  t("GÜVENLİ", `A ${ad} (stüdyoda 20 seçiliyken): stüdyo adedi geçerli → mevcut ${mevcut} soru açılır, gerçek sayı bildirilir; yalnız katalog, GENS/BANK dolgusu yok`, tk && sadeceKat(r, bk) && r.n === Math.min(20, mevcut) && toastlar.includes(String(mevcut)) && D.istekler.length === 1 && D.istekler[0].idSayisi === Math.min(20, mevcut), JSON.stringify({ tk, n: r.n, genN: r.genN, bankN: r.bankN, toast: toastlar })); await c.close();
}

/* =====================  GÜVENLİ: katalog HENÜZ yüklenmemişken (#home) tıklama  ===================== */
for (const ad of ["plan konu görevi", "ana sayfa zayıf konu"]) {
  const y = YOL[ad]; sifirla(); const { c, p } = await sayfa({ guvenli: true, hash: "" }); D2.tut = Object.assign({ kul: "kul1" }, kapiYap());
  await y.kur(p); const once = D2.katIstek, kd = await p.evaluate(() => KHAVUZ.durumu().durum);
  if (once !== 0 || ["hazir", "durdu"].includes(kd)) { console.error("TEST GEÇERSİZ: katalog zaten yüklü/istendi", once, kd); process.exit(2); }
  const tk = await y.git(p); const basladi = await bekle(() => D2.katIstek >= 1, 3500); await p.waitForTimeout(700);
  const bekleRun = await p.evaluate(() => ({ run: !!RUN, ls: !!localStorage.getItem("ake.run"), ids: RUN ? RUN.qs.map(q => String(q.id)) : [] }));
  t("GÜVENLİ", `Y ${ad}: katalog yüklü değilken tıklama → katalog yüklemesi BAŞLAR (GET /api/soru/katalog) ve yanıt beklenirken yerel RUN/ake.run açılmaz`, tk && basladi && !bekleRun.run && !bekleRun.ls, JSON.stringify({ tk, basladi, bekleRun: { run: bekleRun.run, ls: bekleRun.ls, n: bekleRun.ids.length } }));
  D2.tut.ac(); await p.waitForTimeout(1500); const son = await ozet(p);
  t("GÜVENLİ", `Y ${ad}: yükleme bitince yerel set YOK (ya hiç RUN yok ya da yalnız katalog kimlikli güvenli RUN); BANK/EKQ/AI/GENS ve kota isteği yok`, (!son.run || (sadeceKat(son, beklenenKat(y.konu)) && son.gvn === "studyo")) && son.genN === 0 && son.bankN === 0 && son.tuzakN === 0 && D.kota === 0, JSON.stringify({ ...son, ids: undefined, kota: D.kota })); await c.close();
}

/* =====================  GÜVENLİ: sunucu hataları (404, banka_yok, boş, 500, 402, kısmi)  ===================== */
for (const ad of ["ACT.topicStart", "OZ_ACT.dersKarisik"]) for (const mod of ["404", "banka_yok", "bos", "500", "402"]) {
  const y = YOL[ad]; sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); D.oturum = mod; const tk = await y.git(p), r = await ozet(p);
  t("GÜVENLİ", `H ${ad} sunucu '${mod}': yerel set açılmaz (RUN yok, BANK/GENS/EKQ/AI yok), yerel kota isteği yok, kullanıcıya açık durum gösterilir`, tk && !r.run && r.genN === 0 && r.bankN === 0 && D.kota === 0 && (r.modal.length > 0 || r.toast.length > 0), JSON.stringify({ run: r.run, modal: r.modal, kota: D.kota, toast: r.toast.length })); await c.close();
}
for (const ad of ["ACT.topicStart", "OZ_ACT.dersKarisik"]) {
  const y = YOL[ad]; sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); D.oturum = "kismi"; await y.git(p); const r = await ozet(p);
  t("GÜVENLİ", `H ${ad} kısmi yanıt (sunucu yalnız 5 soru verir): set tam 5 soru, hepsi katalog + sunucu oturumlu, yerel dolgu ve kota isteği yok`, r.run && r.n === 5 && sadeceKat(r, beklenenKat(y.konu)) && D.kota === 0, JSON.stringify({ ...r, ids: undefined, kota: D.kota })); await c.close();
}

/* =====================  GÜVENLİ: işaretsiz eski RUN korunur  ===================== */
for (const ad of ["ACT.topicStart", "OZ_ACT.dersKarisik", "plan konu görevi", "'Bu dersten 10 soru' kartı"]) {
  const y = YOL[ad]; sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await y.kur(p); await eskiRunKur(p); const o0 = await ozet(p), r0 = D.istekler.length; await y.git(p); await p.waitForTimeout(500); const o1 = await ozet(p);
  t("GÜVENLİ", `E ${ad}: işaretsiz eski RUN (6 soru, 2 cevap) ezilmez; ake.run ve kimlik aynı, yeni /oturum isteği ve 'Yarım kalan oturum' değiştirme penceresi yok`, o0.run && !o0.gvn && o1.id === o0.id && o1.n === 6 && o1.ans === 2 && o1.lsId === o0.id && o1.lsN === 6 && D.istekler.length === r0 && o1.modal === "", JSON.stringify({ id: [o0.id, o1.id], n: o1.n, ans: o1.ans, lsId: o1.lsId, istek: D.istekler.length - r0, modal: o1.modal })); await c.close();
}

/* =====================  GÜVENLİ: hesap değişimi / çıkış yarışları  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const T = Object.assign({ kul: "kul1", tuttu: false }, kapiYap()); D3.oturumTut = T;
  await eylem(p, "topicStart", { s: DERS, t: TB }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); await p.waitForFunction(d => { const x = KHAVUZ.poolOf(d, {}); return x && x.sorular && x.sorular[0] && String(x.sorular[0].id).startsWith("kat-b-"); }, DERS, { timeout: 7000 }).catch(() => { });
  T.ac(); await p.waitForTimeout(900); const st = await ozet(p);
  t("GÜVENLİ", "Y1 ACT.topicStart: A'nın gecikmiş oturum yanıtı B'ye geçişten sonra RUN/ake.run oluşturmaz, modal yok (mevcut genel yarış koruması; yeşil kalmalı)", tuttu && !st.run && st.lsId === null && st.modal === "", JSON.stringify({ tuttu, run: st.run, lsId: st.lsId, modal: st.modal }));
  t("GÜVENLİ", "Y1a ACT.topicStart: A'nın tutulan /oturum isteği YALNIZ katalog kimlikleri taşır (BANK/GENS/EKQ/AI kimliği yok)", D.istekler.length >= 1 && D.istekler[0].idler.length > 0 && D.istekler[0].idler.every(i => KS.has(i)), JSON.stringify({ istek: D.istekler.map(x => ({ n: x.idSayisi, katalogDisi: x.idler.filter(i => !KS.has(i)).length })) }));
  await runSil(p); await eylem(p, "topicStart", { s: DERS, t: TB }); const rb = await ozet(p);
  t("GÜVENLİ", "Y1b B kendi güvenli setini başlatabilir: yalnız B katalog soruları (kat-b-*), sunucu oturumlu", sadeceKat(rb, KSB) && rb.onek.length === 1 && rb.onek[0] === "b", JSON.stringify({ n: rb.n, onek: rb.onek })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const T = Object.assign({ kul: "kul1", tuttu: false }, kapiYap()); D3.oturumTut = T;
  await eylem(p, "dersKarisik", { s: DERS }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); await p.waitForTimeout(500); await gec(c, p, "kul1"); await p.waitForTimeout(700); T.ac(); await p.waitForTimeout(900); const st = await ozet(p);
  t("GÜVENLİ", "Y2 OZ_ACT.dersKarisik: A→B→A sonrası geçiş öncesi (eski) yanıt yeni RUN açmaz; B kalıntısı yok (mevcut genel yarış koruması; yeşil kalmalı)", tuttu && !st.run && !st.onek.includes("b") && st.modal === "", JSON.stringify({ tuttu, run: st.run, onek: st.onek, modal: st.modal }));
  t("GÜVENLİ", "Y2a OZ_ACT.dersKarisik: A'nın tutulan /oturum isteği YALNIZ katalog kimlikleri taşır (BANK/GENS/EKQ/AI kimliği yok)", D.istekler.length >= 1 && D.istekler[0].idler.length > 0 && D.istekler[0].idler.every(i => KS.has(i)), JSON.stringify({ istek: D.istekler.map(x => ({ n: x.idSayisi, katalogDisi: x.idler.filter(i => !KS.has(i)).length })) })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); D3.cikisTut = kapiYap(); const taban = D.istekler.length;
  await p.evaluate(() => { window.__cik = ACT.cikis(); }); const geldi = await bekle(() => D3.cikisGeldi, 4000); await p.waitForTimeout(300);
  await eylem(p, "topicStart", { s: DERS, t: TB }); await eylem(p, "dersKarisik", { s: DERS }); const r1 = await ozet(p);
  t("GÜVENLİ", "Y3 çıkış isteği beklerken ACT.topicStart/OZ_ACT.dersKarisik: RUN açmaz, yerel set yok, yeni /oturum isteği ve kota isteği yok", geldi && !r1.run && r1.genN === 0 && r1.bankN === 0 && D.istekler.length === taban && D.kota === 0, JSON.stringify({ geldi, run: r1.run, yeniIstek: D.istekler.length - taban, kota: D.kota }));
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(600); await c.close(); }

/* =====================  GÜVENLİ: bekleyen KATALOG GET'i sırasında hesap değişimi / çıkış (3C-4a yarış testleri, #home ve plan girişleri)  ===================== */
/* Senaryo: A hesabı, #home; A'nın katalog GET'i tutulur; plan görevi / ana sayfa zayıf konu tıklanır (bekleyen eylem); sonra A→B ya da A→B→A; tutulan A yanıtı bırakılır.
   Beklenen: bekleyen eski eylem hiçbir senaryoda RUN/ake.run açmaz, hiçbir /api/soru/oturum isteği başlatmaz (B adına dahil); B kendi eylemini başlatınca YALNIZ B katalog kimlikleriyle (kat-b-*) çalışır. */
for (const ad of ["plan konu görevi", "ana sayfa zayıf konu"]) for (const sen of ["A→B", "A→B→A"]) {
  const y = YOL[ad]; sifirla(); const { c, p } = await sayfa({ guvenli: true, hash: "" }); D2.tut = Object.assign({ kul: "kul1" }, kapiYap());
  await y.kur(p); const once = D2.katIstek, kd = await p.evaluate(() => KHAVUZ.durumu().durum);
  if (once !== 0 || ["hazir", "durdu"].includes(kd)) { console.error("TEST GEÇERSİZ: katalog zaten yüklü/istendi", once, kd); process.exit(2); }
  const tk = await y.git(p); const basladi = await bekle(() => D2.katIstek >= 1, 3500);
  await gec(c, p, "kulB"); if (sen === "A→B→A") { await p.waitForTimeout(300); await gec(c, p, "kul1"); }
  await p.waitForTimeout(400); D2.tut.ac(); await p.waitForTimeout(1500);
  const o1 = await ozet(p), oturumIst = D.istekler.length, kota1 = D.kota, kBist = D3.kayit.filter(k => k.sahip === "kulB").length;
  t("GÜVENLİ", `R ${ad} ${sen}: A'nın geç katalog yanıtı bırakılınca eski bekleyen eylem RUN/ake.run AÇMAZ, modal yok, yerel set ve kota isteği yok`, tk && basladi && !o1.run && o1.lsId === null && o1.modal === "" && o1.genN === 0 && o1.bankN === 0 && kota1 === 0, JSON.stringify({ tk, basladi, run: o1.run, lsId: o1.lsId, modal: o1.modal, kota: kota1 }));
  t("GÜVENLİ", `R ${ad} ${sen}: eski bekleyen eylem hiçbir /api/soru/oturum isteği başlatmaz (yeni hesap adına da)`, oturumIst === 0 && D3.kayit.length === 0 && kBist === 0, JSON.stringify({ oturumIst, kayit: D3.kayit.length, kulBistek: kBist }));
  /* eski bekleyen eylem, katalog SONRADAN (kendiliğinden: #studyo ekranı) yüklenip hazır olunca da çalışmamalı (yeni yüklemenin tamamlanması eski kapanışı tetikleyemez) */
  await git(p, "#studyo"); const yuk = await hazirBekle(p); await p.waitForTimeout(700); const o3 = await ozet(p);
  t("GÜVENLİ", `R ${ad} ${sen}: sonradan (#studyo ile) katalog yüklenip hazır olunca da eski bekleyen eylem çalışmaz: RUN/ake.run yok, /oturum isteği yok`, yuk && !o3.run && o3.lsId === null && D.istekler.length === 0 && D3.kayit.length === 0, JSON.stringify({ yuk, run: o3.run, lsId: o3.lsId, oturum: D.istekler.length }));
  await git(p, "");
  if (sen === "A→B") {
    await runSil(p); await y.kur(p); const tb = await y.git(p), rb = await ozet(p);
    t("GÜVENLİ", `R ${ad} A→B: B kendi eylemini başlatınca YALNIZ B katalog kimlikleriyle (kat-b-*) çalışır; /oturum istekleri B adına ve yalnız B kimlikli`, tb && sadeceKat(rb, KSB) && rb.onek.length === 1 && rb.onek[0] === "b" && D3.kayit.length >= 1 && D3.kayit.every(k => k.sahip === "kulB" && k.onek.length === 1 && k.onek[0] === "b") && D.istekler.every(x => x.idler.every(i => KSB.has(i))) && D.kota === 0, JSON.stringify({ tb, n: rb.n, onek: rb.onek, kayit: D3.kayit.map(k => ({ s: k.sahip, o: k.onek })), kota: D.kota }));
  }
  await c.close();
}
/* Çıkış isteği beklerken (sunucu /cikis yanıtı tutulur) katalog yanıtı gelir: RUN yok, ake.run yok, yerel kota isteği yok, yeni /oturum isteği yok; bu sırada yeni tıklama da RUN açmaz */
for (const ad of ["plan konu görevi", "ana sayfa zayıf konu"]) {
  const y = YOL[ad]; sifirla(); const { c, p } = await sayfa({ guvenli: true, hash: "" }); D2.tut = Object.assign({ kul: "kul1" }, kapiYap());
  await y.kur(p); const once = D2.katIstek; if (once !== 0) { console.error("TEST GEÇERSİZ: katalog zaten istendi", once); process.exit(2); }
  const tk = await y.git(p); const basladi = await bekle(() => D2.katIstek >= 1, 3500);
  D3.cikisTut = kapiYap(); await p.evaluate(() => { window.__cik = ACT.cikis(); }); const geldi = await bekle(() => D3.cikisGeldi, 4000); await p.waitForTimeout(300);
  D2.tut.ac(); await p.waitForTimeout(1500); const o1 = await ozet(p), ist1 = D.istekler.length;
  const tk2 = await y.git(p); await p.waitForTimeout(600); const o2 = await ozet(p);
  t("GÜVENLİ", `Q ${ad}: çıkış isteği beklerken katalog yanıtı gelir → RUN ve ake.run yok, yerel set yok, /oturum ve yerel kota isteği yok; yeni tıklama da RUN açmaz`, tk && basladi && geldi && !o1.run && o1.lsId === null && ist1 === 0 && D.kota === 0 && !o2.run && o2.lsId === null && o2.genN === 0 && o2.bankN === 0 && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ tk, basladi, geldi, run1: o1.run, lsId1: o1.lsId, oturum1: ist1, run2: o2.run, lsId2: o2.lsId, oturum2: D.istekler.length, kota: D.kota }));
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(600); await c.close();
}

/* =====================  GÜVENLİ: adet sınırı (doğrudan güvenli eyleme verilen adet)  ===================== */
/* Geçerli stüdyo seçimi n=20. Katalogda DIGER/BT için 85, DIGER dersi için 91 cevapsız sentetik soru var → 20 / 50 / çok büyük istekler gerçekten ayrışır.
   Yalnız plan/kartın AÇIK 10 adedi (10 ya da "10") kabul edilir (beklenen 10). Diğer her büyük/geçersiz değer yok sayılır → mevcut stOpt() sınırı (20).
   Her durumda: tam 1 /oturum isteği, gönderilen kimlik sayısı = beklenen sayı (katalogdaki tüm sorular için oturum AÇILMAZ), yalnız katalog kimlikleri, yerel fallback (BANK/GENS/EKQ/AI) ve kota isteği yok. */
const katBigDers = KATALOG.get("kul1").filter(x => x.s === DIGER), katBT = katBigDers.filter(x => x.t === BT);
const ADET = (p, ad, kod) => p.evaluate(([a, k, s, tt]) => { const adet = new Function("return (" + k + ")")(); (a === "topicStart" ? ACT : OZ_ACT)[a](a === "topicStart" ? { s, t: tt, adet } : { s, adet }); }, [ad, kod, DIGER, BT]);
for (const ad of ["topicStart", "dersKarisik"]) {
  const tum = ad === "topicStart" ? katBT : katBigDers, kapsam = new Set(tum.map(x => x.id));
  if (tum.length < 80) { console.error("TEST GEÇERSİZ: büyük katalog en az 80 soru içermeli", tum.length); process.exit(2); }
  for (const [kod, bek, grup, not] of [["Infinity", 20, "GÜVENLİ", "yok sayılır"], ["'Infinity'", 20, "GÜVENLİ", "yok sayılır"], ["1e9", 20, "GÜVENLİ", "yok sayılır"], ["99999", 20, "GÜVENLİ", "yok sayılır"], ["50", 20, "GÜVENLİ", "yok sayılır"], ["10.5", 20, "GÜVENLİ", "yok sayılır"], ["-3", 20, "KORUMA", "mevcut kodda zaten yok sayılır (yeşil koruma)"], ["10", 10, "GÜVENLİ", "açık 10 kabul edilir"], ["'10'", 10, "GÜVENLİ", "açık \"10\" kabul edilir"]]) {
    sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await stN(p, 20); await ADET(p, ad, kod); const r = await ozet(p);
    t(grup, `N ${ad} adet=${kod} (stüdyoda 20 seçiliyken, katalogda ${tum.length} soru): ${not} → tam ${bek} soru, tek /oturum isteği ve ${bek} kimlik, yalnız katalog kimlikleri, yerel fallback ve kota isteği yok`,
      r.run && sadeceKat(r, kapsam) && r.n === bek && r.gvn === "studyo" && D.istekler.length === 1 && D.istekler[0].idSayisi === bek && D.istekler[0].idler.every(i => kapsam.has(i)) && r.genN === 0 && r.bankN === 0 && r.tuzakN === 0 && D.kota === 0 && D.ai === 0,
      JSON.stringify({ run: r.run, n: r.n, istek: D.istekler.map(x => x.idSayisi), genN: r.genN, bankN: r.bankN, kota: D.kota, toast: r.toast.join(" | ").slice(0, 100) })); await c.close();
  }
}

/* =====================  DIŞ: bu adımın kapsamı DIŞINDA kalan yollar bayrak açıkken de YEREL kalır (güvenli SAYILMAZ; yeşil belgeleme)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await runSil(p); await p.evaluate(() => ACT.quick({ k: "mix" })); const xm = await ozet(p);
  t("GÜVENLİ", "X ACT.quick mix (plan 'Karışık test') artık GÜVENLİ çekirdeğe bağlı (3C-4b): gvn='studyo', yalnız katalog kimlikleri, sunucu oturumlu, BANK/GENS dolgusu yok (ayrıntı: tests/studyo-karma-istemci.mjs)", xm.run && xm.gvn === "studyo" && xm.ids.every(i => KS.has(i)) && xm.bankN === 0 && xm.genN === 0 && xm.svN === xm.n, JSON.stringify({ ...xm, ids: undefined })); await c.close(); }
for (const [ad, js0] of [["ACT.quick mini (haftalık mini deneme)", () => ACT.quick({ k: "mini" })], ["ACT.kocTest (koç)", ([s, tt]) => ACT.kocTest({ s, t: tt })]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await runSil(p);
  await p.evaluate(([f, a]) => { new Function("a", "return (" + f + ")(a)")(a); }, [js0.toString(), [DERS, TB]]); const r = await ozet(p);
  t("DIŞ", `X ${ad}: bayrak açıkken YEREL kalır (güvenli SAYILMAZ): gvn yok, katalog dışı soru var`, r.run && !r.gvn && r.ids.some(i => !KS.has(i)), JSON.stringify({ ...r, ids: undefined })); await c.close();
}

console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı` + (kirmizi.length ? "\nKIRMIZI: " + kirmizi.join(" | ") : ""));
await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
