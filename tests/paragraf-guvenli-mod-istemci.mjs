// B4 3C-2 · #paragraf için ÖNERİLEN GÜVENLİ MOD sözleşme testi (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz).
// AMAÇ: mevcut kodda #paragraf ekranının güvenli modda HANGİ yollarda başarısız olduğunu göstermek. Uygulama koduna dokunulmaz; bu dosya CI'a EKLENMEZ.
// Güvenli mod bayrağı ÖNERİDİR: window.AKE_KATALOG_PARAGRAF === true (AKE_KATALOG / AKE_KATALOG_HAVUZ / AKE_KATALOG_BANKA adlandırmasıyla uyumlu).
// İki grup:
//   [KARAKT]  bayrak KAPALIYKEN mevcut davranış (yeşil olmalı, düzeltmeden sonra da yeşil kalmalı)
//   [GÜVENLİ] bayrak AÇIKKEN beklenen sözleşme (şu an kırmızı = düzeltme noktalarının kanıtı)
// SÖZLEŞME İŞARETLERİ (uygulamanın koyması beklenen; 3C-1'deki data-banka-durum ile aynı mantık):
//   · Liste satırı: mevcut  <button data-a="paraOne" data-id="…">  (yeni işaret gerekmez).
//   · Hazır değilken liste YOK; yerine  <… data-paragraf-durum="yukleniyor|giris|kapali|hata|cikis">  durum kartı.
//   · Eski cevaplı yerel oturum (ake.run) varsa kart  data-paragraf-durum="eski-oturum"  (açık bildirim; sessiz devam/silme yok).
// Cevap anahtarı değerleri çıktıya YAZILMAZ; yalnız varlık/sayı raporlanır. Soru ve kullanıcılar SENTETİKTİR.
// Çalıştırma: node tests/paragraf-guvenli-mod-istemci.mjs   (Playwright + chromium gerekir)   ·   çıkış kodu: kırmızı sayısı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html")), KAYNAK = HTML.toString("utf8");
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 420)); };

const D = { oturum: "tam", istekler: [], kota: 0, sinirli: false };   // oturum: "tam" | "kismi" (ilk 10) | "bos" | "404" | "banka_yok" | "500"
const D2 = { kat: "tam", katIstek: 0, tut: {} };                       // kat: "tam" | "404" | "leak" | "500"; tut[kullanıcı] = { kapi }
const D3 = { oturumTut: null, cikisTut: null, cikisGeldi: false, cikisDurum: 200, gecerli: new Set(["kul1", "kulB"]), kayit: [] };
let BILGI = new Map(); const KATALOG = new Map(), KATID = {};
const js = (r, kod, o) => { r.statusCode = kod; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); r.end(JSON.stringify(o)); };
const govde = q => new Promise(ok => { let s = ""; q.on("data", c => s += c); q.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { ok({}); } }); });
const srv = http.createServer(async (q, r) => {
  const f = new URL(q.url, "http://x").pathname, kul = ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(HTML); }
  if (f === "/api/hesap/ben") { if (!kul || !D3.gecerli.has(kul)) return js(r, 401, { error: "giris" }); return js(r, 200, { kullanici: { id: kul, eposta: kul + "@x.test", ad: "" }, paket: null, ucretsiz: null, ayar: { google: false, eposta: true } }); }
  if (f === "/api/hesap/cikis") { D3.cikisGeldi = true; if (D3.cikisTut) await D3.cikisTut.kapi; if (D3.cikisDurum === 200) { D3.gecerli.delete(kul); return js(r, 200, { ok: true }); } return js(r, D3.cikisDurum, { error: "x" }); }
  if (f === "/api/soru/katalog") {
    D2.katIstek++; if (!kul) return js(r, 401, {}); if (D2.kat === "404") return js(r, 404, {}); if (D2.kat === "500") return js(r, 500, {});
    if (D2.tut[kul]) await D2.tut[kul].kapi;
    const l = (KATALOG.get(kul) || []).map(x => ({ ...x })); if (D2.kat === "leak" && l.length) l[0].a = 1;
    return js(r, 200, { n: l.length, bayrak: "hazir", beklenen: { toplam: l.length, os: 0, fix: 0 }, sorular: l, sonraki: null });
  }
  if (f === "/api/hesap/veri") return js(r, 200, { alanlar: {} });
  if (f === "/api/hesap/kota") { const b = await govde(q); D.kota++; return js(r, 200, { verildi: b.adet || 1, kalanSoru: 500, kalanDeneme: 5 }); }
  if (f === "/api/soru/oturum") {
    const b = await govde(q); D.istekler.push({ idSayisi: Array.isArray(b.idler) ? b.idler.length : -1, idler: Array.isArray(b.idler) ? b.idler.slice() : [] });
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

/* sahte sunucunun BANK için vereceği CEVAPSIZ soru bilgisi (yalnız bayrak-kapalı karakterizasyon için); a/x ALINMAZ */
{ const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage(); await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(800);
  const l = await p.evaluate(() => BANK.map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, ...(q.p ? { p: q.p } : {}) }))); BILGI = new Map(l.map(x => [x.id, x])); await c.close(); }
if (BILGI.size < 100) { console.error("TEST GEÇERSİZ: BANK okunamadı " + BILGI.size); process.exit(2); }
const BID = new Set(BILGI.keys()), BANKP = [...BILGI.values()].filter(x => x.s === "turkce" && x.p).map(x => x.id);
if (BANKP.length < 10) { console.error("TEST GEÇERSİZ: BANK'ta paragraf sorusu az " + BANKP.length); process.exit(2); }

/* sentetik katalog: her kullanıcı için 24 PARAGRAF (turkce + p), 10 p'siz Türkçe, 10 başka ders; id = kat-<a|b>-<tür><no> (sahip = id.split("-")[1]) */
const DIGER = [...BILGI.values()].map(x => x.s).find(s => s !== "turkce");
for (const [kul, on] of [["kul1", "a"], ["kulB", "b"]]) {
  const l = [];
  for (let i = 1; i <= 24; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-${on}-p${no}`, s: "turkce", t: "Paragraf", d: 1 + (i % 3), p: `SENTETİK-PARAGRAF-${on.toUpperCase()}-${no} parça metni`, q: `PAR-${on.toUpperCase()}-${no} sentetik paragraf sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} seçeneği ${no}`) }); }
  for (let i = 1; i <= 10; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-${on}-n${no}`, s: "turkce", t: "Dil bilgisi", d: 1, q: `NP-${on.toUpperCase()}-${no} p'siz Türkçe`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }); }
  for (let i = 1; i <= 10; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-${on}-m${no}`, s: DIGER, t: "Diğer", d: 1, q: `DG-${on.toUpperCase()}-${no} başka ders`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }); }
  l.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));   // sunucu kataloğu id'ye göre sıralıdır (ORDER BY id); istemci 'bozuk_siralama' ile reddeder
  KATALOG.set(kul, l); l.forEach(x => { KATID[x.id] = x; });
}
const PA = KATALOG.get("kul1").filter(x => x.p).map(x => x.id), PB = KATALOG.get("kulB").filter(x => x.p).map(x => x.id), PSET = new Set(PA);

/* oturum açma: giris → çerezli; guvenli → AKE_KATALOG_PARAGRAF; tuzak → yerel kaynaklara (S.aiQs, EKQ) p'li TUZAK sorular konur */
async function sayfa({ giris = true, guvenli = false, svKapat = false, kat = true, havuz = true, kul = "kul1", hash = "#paragraf", tuzak = true } = {}) {
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1200, height: 900 } }), p = await c.newPage(), hatalar = []; p.on("pageerror", e => hatalar.push(e.message));
  await p.addInitScript(([g, k, kt, hv]) => { if (g) window.AKE_KATALOG_PARAGRAF = true; if (k) window.SV_KAPAT = true; if (kt) window.AKE_KATALOG = true; if (hv) window.AKE_KATALOG_HAVUZ = true; }, [guvenli, svKapat, kat && guvenli, havuz && guvenli]);
  if (giris) await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]);
  await p.goto(URL0 + hash, { waitUntil: "load" });
  if (giris) await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); else await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 });
  if (tuzak) await p.evaluate(() => {
    const o = ["A", "B", "C", "D", "E"].map(h => h + " tuzak");
    S.aiQs.push({ id: "ai-tuzak-1", s: "turkce", t: "Tuzak", d: 1, p: "AI TUZAK PARAGRAF", q: "AI tuzak soru", o, a: 1, x: "tuzak çözüm", src: "ai" });
    EKQ.push({ id: "ek-tuzak-1", s: "turkce", t: "Tuzak", d: 1, p: "EK TUZAK PARAGRAF", q: "EK tuzak soru", o, a: 2, x: "tuzak çözüm" });
    render();
  });
  await p.waitForTimeout(300); return { c, p, hatalar };
}
const sifirla = () => { D.istekler.length = 0; D.kota = 0; D.sinirli = false; D.oturum = "tam"; D2.kat = "tam"; D2.katIstek = 0; D2.tut = {}; D3.oturumTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.cikisDurum = 200; D3.gecerli = new Set(["kul1", "kulB"]); D3.kayit = []; };
const kapiYap = () => { let ac; const kapi = new Promise(o => { ac = o; }); return { kapi, ac }; };
const bekle = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise(o => setTimeout(o, 50)); } return false; };
const satirlar = p => p.evaluate(() => [...document.querySelectorAll('[data-a="paraOne"]')].map(e => e.dataset.id));
const kart = p => p.evaluate(() => { const e = document.querySelector("[data-paragraf-durum]"); return e ? e.dataset.paragrafDurum : ""; });
const hazirBekle = (p, ms = 7000) => p.waitForSelector('[data-a="paraOne"]', { timeout: ms }).then(() => true, () => false);
const durumBekle = (p, d, ms = 6000) => p.waitForSelector(`[data-paragraf-durum="${d}"]`, { timeout: ms }).then(() => true, () => false);
const gec = async (c, p, kul) => { await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]); await p.evaluate(k => hesapKimlikGuncelle({ id: k, eposta: k + "@x.test", ad: "" }), kul); };
const sahiplerTutarli = () => D3.kayit.every(k => k.onek.every(o => (k.sahip === "kul1" && o === "a") || (k.sahip === "kulB" && o === "b")));
const bSatirBekle = (p, on) => p.waitForSelector(`[data-a="paraOne"][data-id^="kat-${on}-"]`, { timeout: 7000 }).then(() => true, () => false);

/* RUN özeti: cevap DEĞERİ yok, yalnız varlık/sayı/kimlik */
const ozet = (p) => p.evaluate(async (bid) => {
  for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 250));
  const B = new Set(bid), R = RUN, ids = R ? R.qs.map(q => String(q.id)) : [];
  return { run: !!R, n: ids.length, ids, svN: R ? R.qs.filter(q => q.sv).length : 0, yerelN: R ? R.qs.filter(q => !q.sv).length : 0,
    aVar: R ? R.qs.filter(q => Number.isInteger(q.a)).length : 0, xVar: R ? R.qs.filter(q => typeof q.x === "string" && q.x).length : 0,
    genN: ids.filter(i => /^g:/.test(i)).length, bankN: ids.filter(i => B.has(i)).length, tuzakN: ids.filter(i => /tuzak/.test(i)).length,
    onek: [...new Set(ids.map(i => i.split("-")[1]))], modal: UI.modal ? String(UI.modal.title || "") : "", modalBtn: [...document.querySelectorAll(".modal-bg .modal [data-a]")].map(e => e.dataset.a),
    ls: (() => { try { const s = localStorage.getItem("ake.run") || ""; return { var: !!s, anahtar: /"a":\d/.test(s) || /"x":"/.test(s) }; } catch (e) { return { var: false, anahtar: false }; } })() };
}, [...BID]);
/* eylem: "start" = Paragraf antrenmanını başlat düğmesi; "one" = ilk satırın "Çöz" düğmesi; "oneId" = verilen id */
async function bas(p, eylem, id) {
  await p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; try { localStorage.removeItem("ake.run"); } catch (e) { } });
  const sel = eylem === "start" ? '[data-a="paraStart"]' : id ? `[data-a="paraOne"][data-id="${id}"]` : '[data-a="paraOne"]';
  const tikladi = await p.click(sel, { timeout: 2500 }).then(() => true, () => false);
  return { tikladi, ...(await ozet(p)) };
}
const dogrudan = async (p, kod) => { await p.evaluate(() => { RUN = null; UI.modal = null; UI.svBusy = false; UI.inRun = false; }); await p.evaluate(kod); return ozet(p); };   // düğme yokken doğrudan ACT çağrısı
const sadecePara = (ids, izinli) => ids.length > 0 && ids.every(i => izinli.includes(i) && !BID.has(i) && !/^g:|tuzak/.test(i));

/* =====================  KARAKTERİZASYON (bayrak KAPALI): mevcut davranış korunmalı  ===================== */
{ sifirla(); const { c, p } = await sayfa({ giris: true, tuzak: false }); const sat = await satirlar(p);
  t("KARAKT", "K1 liste: BANK'taki paragraf soruları (hepsi BANK id'li), katalog id'si yok", sat.length === BANKP.length && sat.every(i => BID.has(i)) && !(await kart(p)), JSON.stringify({ satir: sat.length, bankP: BANKP.length })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ giris: true, tuzak: false }); const r = await bas(p, "one");
  t("KARAKT", "K2 paraOne tam sunucu: BANK sorularıyla sunucu oturumu; cevap/çözüm alanı sete sızmaz", r.tikladi && r.run && r.svN === r.n && r.aVar === 0 && r.xVar === 0 && r.bankN === r.n && D.istekler.length === 1, JSON.stringify({ ...r, ids: undefined })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ giris: true, tuzak: false }); const r = await bas(p, "start");
  t("KARAKT", "K3 paraStart: BANK + GENS paragraf üreticileri (g: id'li YEREL cevaplı sorular) sete girer — mevcut davranış", r.tikladi && r.run && r.n > 8 && r.genN >= 1 && r.aVar >= 1, JSON.stringify({ ...r, ids: undefined })); await c.close(); }
{ sifirla(); D.oturum = "404"; const { c, p } = await sayfa({ giris: true, tuzak: false }); const r = await bas(p, "one");
  t("KARAKT", "K4 /oturum 404: eski yerel akışa dönülür (yerel cevaplı set açılır) — mevcut davranış", r.tikladi && r.run && r.svN === 0 && r.aVar === r.n, JSON.stringify({ ...r, ids: undefined })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ giris: true, tuzak: false });
  await p.evaluate(() => { baslatRun({ kind: "practice", title: "ESKI-YEREL", mode: "study", qs: BANK.filter(q => q.s === "turkce").slice(0, 3) }); RUN.ans[0] = 1; RUN.rev[0] = true; saveRun(); UI.inRun = false; render(); });
  const banner = await p.evaluate(() => !!document.querySelector('.banner [data-a="resume"]')); await p.click('[data-a="paraOne"]', { timeout: 2500 }).catch(() => { }); await p.waitForTimeout(300);
  const m = await p.evaluate(() => ({ modal: UI.modal ? String(UI.modal.title || "") : "", rep: !!document.querySelector('[data-a="runReplace"]') }));
  t("KARAKT", "K5 eski RUN varken: 'Devam et' bandı vardır; paraOne 'Yarım kalan oturum var' modalı + 'Yenisini başlat' sunar — mevcut davranış", banner && /Yarım kalan/.test(m.modal) && m.rep, JSON.stringify({ banner, ...m })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ giris: true, tuzak: false }); const r0 = await bas(p, "one");
  const ek = await p.evaluate(async () => { if (!RUN) return { run: false }; RUN.rev[RUN.cur] = true; const once = RUN.qs.length, cur0 = RUN.cur; ACT.benzerEkle(); await new Promise(r => setTimeout(r, 300)); const yeni = RUN.qs.slice(cur0 + 1, cur0 + 1 + (RUN.qs.length - once)); return { run: true, once, sonra: RUN.qs.length, yerelCevapli: yeni.filter(q => Number.isInteger(q.a)).length }; });
  t("KARAKT", "K6 bayrak kapalı: 'Benzerini çöz' yerel cevaplı benzer soru ekler — mevcut davranış", r0.run && ek.run && ek.sonra > ek.once && ek.yerelCevapli >= 1, JSON.stringify({ ek })); await c.close(); }

/* =====================  GÜVENLİ MOD (bayrak AÇIK): BEKLENEN sözleşme  ===================== */
/* ---- KAYNAK: liste, paraStart, paraOne yalnız p'li katalog (KHAVUZ) sorularını kullanır ---- */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); const hz = await hazirBekle(p), sat = await satirlar(p);
  t("GÜVENLİ", "P1 liste yalnız katalogdaki p'li sorular (24): BANK/GENS/EKQ/aiQs ve p'siz katalog soruları görünmez", hz && sat.length === PA.length && sadecePara(sat, PA) && !sat.some(i => /-n\d|-m\d/.test(i)), JSON.stringify({ hz, satir: sat.length, bankaVar: sat.filter(i => BID.has(i)).length, tuzak: sat.filter(i => /tuzak/.test(i)).length })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r = await bas(p, "start"), ist = D.istekler[0] || { idler: [] };
  t("GÜVENLİ", "P2 paraStart: set yalnız katalog p'li soruları; GENS (g:), BANK, EKQ, aiQs yok; hepsi sunucu oturumunda, cevap/çözüm alanı yok", r.tikladi && r.run && sadecePara(r.ids, PA) && r.svN === r.n && r.aVar === 0 && r.xVar === 0 && r.genN === 0 && r.bankN === 0 && r.tuzakN === 0, JSON.stringify({ ...r, ids: undefined }));
  t("GÜVENLİ", "P2b paraStart: sunucuya giden id'ler yalnız katalog p'li sorular; kota çağrısı yok; ake.run'da cevap alanı yok", ist.idler.length > 0 && sadecePara(ist.idler, PA) && D.kota === 0 && !r.ls.anahtar, JSON.stringify({ istek: ist.idler.length, kota: D.kota, ls: r.ls })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const sat = await satirlar(p), hedef = sat[5]; const r = await bas(p, "one", hedef), ist = D.istekler[0] || { idler: [] };
  t("GÜVENLİ", "P3 paraOne: seçilen soruyla başlar (rotasyon korunur); set yalnız katalog p'li sorular; hepsi sunucu oturumunda", r.tikladi && r.run && r.ids[0] === hedef && sadecePara(r.ids, PA) && r.svN === r.n && r.aVar === 0 && r.genN === 0 && r.tuzakN === 0, JSON.stringify({ ...r, ids: undefined, ilk: r.ids[0], hedef }));
  t("GÜVENLİ", "P3b paraOne: sunucuya giden id'ler yalnız katalog p'li sorular", ist.idler.length > 0 && sadecePara(ist.idler, PA) && D.kota === 0, JSON.stringify({ istek: ist.idler.length, kota: D.kota })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const ayni = await p.evaluate(() => { try { const ids = [...document.querySelectorAll('[data-a="paraOne"]')].map(e => e.dataset.id); return ids.length > 0 && ids.every(i => !("a" in (KHAVUZ.poolOf("turkce").sorular.find(q => q.id === i) || {}))); } catch (e) { return false; } });
  t("GÜVENLİ", "P4 listedeki p'li katalog sorularında cevap/çözüm alanı yok (KHAVUZ havuzu cevap öncesi)", ayni === true); await c.close(); }

/* ---- FAIL-CLOSED: sunucu hataları, kısmi yanıt, kota ---- */
for (const eylem of ["start", "one"]) for (const mod of ["404", "banka_yok", "bos", "500"]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); const hz = await hazirBekle(p); D.oturum = mod; const r = await bas(p, eylem);
  const beklenenModal = mod === "500" ? /açılamadı/i.test(r.modal) : r.modal.length > 0;
  t("GÜVENLİ", `P5 ${eylem === "start" ? "paraStart" : "paraOne"} + /oturum ${mod}: startRunEski'ye DÖNÜLMEZ (RUN yok, yerel cevaplı soru yok, kota çağrısı yok, açık hata modalı)`, hz && r.tikladi && !r.run && r.aVar === 0 && D.kota === 0 && beklenenModal, JSON.stringify({ hz, ...r, ids: undefined, kota: D.kota })); await c.close(); }
for (const eylem of ["start", "one"]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); const hz = await hazirBekle(p); D.oturum = "kismi"; const r = await bas(p, eylem), ist = D.istekler[0] || { idSayisi: 0 }, beklenenN = Math.min(10, ist.idSayisi);
  t("GÜVENLİ", `P6 ${eylem === "start" ? "paraStart" : "paraOne"} + sunucu kısmi (ilk 10): eksik kalan YEREL soru eklenmez (set = yalnız sunulan; yerel/cevaplı/GENS yok)`, hz && r.run && r.n === beklenenN && beklenenN > 0 && r.svN === r.n && r.yerelN === 0 && r.aVar === 0 && r.genN === 0, JSON.stringify({ hz, ...r, ids: undefined, beklenenN })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); const hz = await hazirBekle(p); D.oturum = "kismi"; D.sinirli = true; const r = await bas(p, "start");
  t("GÜVENLİ", "P6b sınırlı kota + kısmi yanıt: kalan için yerel kota isteği YOK; ake.run'a yalnız sunucu soruları (cevap alanı yok)", hz && r.run && D.kota === 0 && r.yerelN === 0 && !r.ls.anahtar, JSON.stringify({ hz, kota: D.kota, ...r, ids: undefined })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, svKapat: true }); await hazirBekle(p);
  const r1 = await dogrudan(p, () => ACT.paraStart()), r2 = await dogrudan(p, () => ACT.paraOne({ id: "kat-a-p03" }));
  t("GÜVENLİ", "P7 svKullan() false (SV_KAPAT): paraStart/paraOne YEREL çözüm açmaz (RUN yok, cevaplı yerel soru yok, kota çağrısı yok)", !r1.run && !r2.run && r1.aVar === 0 && r2.aVar === 0 && D.kota === 0, JSON.stringify({ r1: { ...r1, ids: undefined }, r2: { ...r2, ids: undefined }, kota: D.kota })); await c.close(); }

/* ---- DURUMLAR: giriş yok / yükleniyor / kapalı / hata: liste yok, durum kartı var, hiçbir başlatma yerel çözüm açmaz ---- */
const durumTesti = async (ad, o, beklenen) => {
  sifirla(); const { c, p } = await sayfa(o); const gor = await durumBekle(p, beklenen), sat = (await satirlar(p)).length, katIst = D2.katIstek;
  const r1 = await dogrudan(p, () => ACT.paraStart()), r2 = await dogrudan(p, () => ACT.paraOne({ id: "kat-a-p01" }));
  t("GÜVENLİ", ad, gor && sat === 0 && !r1.run && !r2.run && r1.aVar === 0 && r2.aVar === 0 && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ gor, kart: await kart(p), satir: sat, run1: r1.run, run2: r2.run, oturumIstek: D.istekler.length, katIst })); await c.close(); };
await durumTesti("P8 giriş yok: 'giris' durum kartı; BANK listelenmez; paraStart/paraOne yerel çözüm açmaz", { guvenli: true, giris: false }, "giris");
{ sifirla(); D2.kat = "404"; D2.katIstek = 0; const { c, p } = await sayfa({ guvenli: true }); const gor = await durumBekle(p, "kapali"), sat = (await satirlar(p)).length, r1 = await dogrudan(p, () => ACT.paraStart());
  t("GÜVENLİ", "P9a katalog kapalı (404): 'kapali' kartı; liste yok; paraStart yerel çözüm açmaz", gor && sat === 0 && !r1.run && r1.aVar === 0 && D.istekler.length === 0, JSON.stringify({ gor, sat, run: r1.run })); await c.close(); }
for (const [mod, ad] of [["leak", "bozuk/sızıntılı"], ["500", "500"]]) { sifirla(); D2.kat = mod; const { c, p } = await sayfa({ guvenli: true }); const gor = await durumBekle(p, "hata"), sat = (await satirlar(p)).length, r1 = await dogrudan(p, () => ACT.paraStart());
  t("GÜVENLİ", `P9b katalog ${ad}: 'hata' kartı; BANK listelenmez; paraStart yerel çözüm açmaz`, gor && sat === 0 && !r1.run && r1.aVar === 0 && D.istekler.length === 0, JSON.stringify({ gor, sat, run: r1.run })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, kat: false }); const gor = await durumBekle(p, "kapali"), sat = (await satirlar(p)).length, r1 = await dogrudan(p, () => ACT.paraStart());
  t("GÜVENLİ", "P9c AKE_KATALOG bayrağı kapalı: fail-closed ('kapali'), BANK listelenmez, yerel çözüm yok", gor && sat === 0 && !r1.run && r1.aVar === 0, JSON.stringify({ gor, sat, run: r1.run })); await c.close(); }
{ sifirla(); D2.tut = { kul1: kapiYap() }; const { c, p } = await sayfa({ guvenli: true }); const y = await durumBekle(p, "yukleniyor", 3000), sat = (await satirlar(p)).length, r1 = await dogrudan(p, () => ACT.paraStart());
  t("GÜVENLİ", "P9d yükleniyor: durum kartı; eski liste yok; paraStart başlamaz", y && sat === 0 && !r1.run && D.istekler.length === 0, JSON.stringify({ y, sat, run: r1.run })); D2.tut.kul1.ac(); D2.tut = {}; await c.close(); }

/* ---- YARIŞ 1: hesap değişimi (A'nın gecikmiş yanıtı B'ye sızmaz) ---- */
for (const durum of [200, 401]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", durum, tuttu: false }, kapiYap()); D3.oturumTut = T;
  await p.evaluate(() => { RUN = null; UI.modal = null; ACT.paraStart(); }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); const bHazir = await bSatirBekle(p, "b"); T.ac(); await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ onek: RUN ? [...new Set(RUN.qs.map(q => String(q.id).split("-")[1]))] : [], run: !!RUN, kullanici: (HESAP.user && HESAP.user.id) || "", modal: UI.modal ? String(UI.modal.title || "") : "", lsA: (localStorage.getItem("ake.run") || "").includes("kat-a-") }));
  t("GÜVENLİ", `R1-${durum}a gecikmiş ${durum} yanıtı B'ye geçişten sonra: A'ya ait RUN/ake.run oluşmaz; B oturumu kapanmaz, modal yok`, tuttu && bHazir && !st.onek.includes("a") && !st.lsA && st.kullanici === "kulB" && st.modal === "", JSON.stringify({ tuttu, bHazir, ...st }));
  const rb = await bas(p, "start");
  t("GÜVENLİ", `R1-${durum}c B kendi paragrafını başlatabilir (yalnız B soruları, sunucu oturumlu)`, rb.run && rb.onek.length === 1 && rb.onek[0] === "b" && rb.svN === rb.n && sadecePara(rb.ids, PB), JSON.stringify({ ...rb, ids: undefined }));
  t("GÜVENLİ", `R1-${durum}d istek sahipleri tutarlı (kul1 yalnız A id'leri, kulB yalnız B id'leri)`, D3.kayit.length >= 1 && sahiplerTutarli(), JSON.stringify(D3.kayit)); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p);
  const T = Object.assign({ kul: "kul1", durum: 200, tuttu: false }, kapiYap()); D3.oturumTut = T;
  await p.evaluate(() => { RUN = null; UI.modal = null; ACT.paraStart(); }); const tuttu = await bekle(() => T.tuttu, 4000);
  await gec(c, p, "kulB"); const bHazir = await bSatirBekle(p, "b"); await gec(c, p, "kul1"); const aHazir = await bSatirBekle(p, "a"); T.ac(); await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ run: !!RUN, onek: RUN ? [...new Set(RUN.qs.map(q => String(q.id).split("-")[1]))] : [], modal: UI.modal ? String(UI.modal.title || "") : "", kullanici: (HESAP.user && HESAP.user.id) || "" }));
  t("GÜVENLİ", "R1-ABA A→B→A sonrası eski (geçiş öncesi) yanıt yeni RUN açmaz; B kalıntısı yok; modal yok", tuttu && bHazir && aHazir && !st.run && !st.onek.includes("b") && st.kullanici === "kul1" && st.modal === "", JSON.stringify({ tuttu, bHazir, aHazir, ...st }));
  const ra = await bas(p, "start"); t("GÜVENLİ", "R1-ABA-b A→B→A sonrası A yeniden başlatabilir (meşgul kilidi takılı kalmaz); yalnız A soruları", ra.run && ra.onek.length === 1 && ra.onek[0] === "a" && ra.svN === ra.n, JSON.stringify({ ...ra, ids: undefined })); await c.close(); }

/* ---- YARIŞ 2: bekleyen çıkış isteği sırasında liste geri gelmez, yeni katalog GET başlamaz, başlatma yerel çözüme düşmez ---- */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const once = (await satirlar(p)).length; D3.cikisTut = kapiYap(); const taban = D2.katIstek, istTaban = D.istekler.length;
  await p.evaluate(() => { window.__cik = ACT.cikis(); }); const geldi = await bekle(() => D3.cikisGeldi, 4000);
  const ara = []; for (let i = 0; i < 6; i++) { await p.waitForTimeout(100); ara.push(await p.evaluate(() => ({ satir: document.querySelectorAll('[data-a="paraOne"]').length, havuz: KHAVUZ.durumu().ok }))); }
  const r1 = await dogrudan(p, () => ACT.paraStart());
  t("GÜVENLİ", "R2a çıkış isteği beklerken A listesi görünmez, havuz dolmaz, yeni katalog GET yok", once > 0 && geldi && Math.max(...ara.map(x => x.satir)) === 0 && !ara.some(x => x.havuz) && D2.katIstek === taban, JSON.stringify({ once, geldi, ara: ara.length, katIst: D2.katIstek - taban }));
  t("GÜVENLİ", "R2b çıkış isteği beklerken paraStart başlamaz (RUN yok, yerel çözüm yok, yeni /oturum isteği yok)", !r1.run && r1.aVar === 0 && D.istekler.length === istTaban, JSON.stringify({ run: r1.run, yeniIstek: D.istekler.length - istTaban }));
  D3.cikisTut.ac(); await p.evaluate(() => window.__cik).catch(() => { }); await p.waitForTimeout(700);
  const son = await p.evaluate(() => ({ satir: document.querySelectorAll('[data-a="paraOne"]').length, kullanici: !!HESAP.user, kart: (document.querySelector("[data-paragraf-durum]") || { dataset: {} }).dataset.paragrafDurum || "" }));
  t("GÜVENLİ", "R2c çıkış tamamlanınca: liste yok, kullanıcı yok, 'giris' kartı", son.satir === 0 && !son.kullanici && son.kart === "giris", JSON.stringify(son)); await c.close(); }

/* ---- BENZER SORU / AI: güvenli paragraf RUN'ına yerel cevaplı soru EKLENEMEZ ---- */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r0 = await bas(p, "one");
  const ek = await p.evaluate(async () => { if (!RUN) return { run: false }; RUN.rev[RUN.cur] = true; const once = RUN.qs.length, cur0 = RUN.cur; ACT.benzerEkle(); await new Promise(r => setTimeout(r, 400)); const yeni = RUN.qs.slice(cur0 + 1, cur0 + 1 + (RUN.qs.length - once));
    return { run: true, once, sonra: RUN.qs.length, yerelCevapli: yeni.filter(q => Number.isInteger(q.a) || !q.sv).length, gen: RUN.qs.filter(q => /^g:/.test(String(q.id))).length, butonVar: false }; });
  t("GÜVENLİ", "B1 'Benzerini çöz' (benzerEkle): güvenli paragraf RUN'ına yerel/BANK/GENS cevaplı soru EKLENMEZ", r0.run && ek.run && ek.yerelCevapli === 0 && ek.gen === 0, JSON.stringify({ ek })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r0 = await bas(p, "one");
  const ek = await p.evaluate(async () => { if (!RUN) return { run: false }; AI.fn = () => { }; AI.off = false; RUN.rev[RUN.cur] = true; UI.inRun = true; render();
    const once = RUN.qs.length; ACT.benzerEkle(); await new Promise(r => setTimeout(r, 400));
    return { run: true, aiAcik: aiOn(), once, sonra: RUN.qs.length, aiBenzerModal: !!document.querySelector('[data-a="benzerAIGo"]'), butonlar: [...document.querySelectorAll('[data-a="benzerAI"],[data-a="benzerAIGo"]')].length }; });
  t("GÜVENLİ", "B2 AI açıkken benzer soru yolu: 'AI ile benzer soru üretilsin mi?' (cevaplı AI sorusu üretimi) sunulmaz; RUN değişmez", r0.run && ek.run && ek.aiAcik === true && !ek.aiBenzerModal && ek.sonra === ek.once, JSON.stringify({ ek })); await c.close(); }
{ /* paraIdea YALNIZ ana fikir değerlendirmesidir: kaynakla doğrula (soru üretimi diye sınıflandırma YOK) */
  const f1 = KAYNAK.slice(KAYNAK.indexOf("function paraIdea("), KAYNAK.indexOf("function pickAnswer(")), a = KAYNAK.indexOf("  paraEval() {"), f2 = KAYNAK.slice(a, KAYNAK.indexOf("  aiResult(d) {", a)), yasak = /(genQ|buildSet|benzer|startRun|baslatRun|aiQs|allQ\(|BANK|GENS|snap\()/;
  t("GÜVENLİ", "B3 kaynak: paraIdea/paraEval yalnız ana fikir değerlendirmesi (aiStream 'pe:'); soru üretmez/RUN'a soru eklemez", f1.length > 50 && f2.length > 50 && !yasak.test(f1) && !yasak.test(f2) && /aiStream\("pe:"/.test(f2), JSON.stringify({ f1: f1.length, f2: f2.length, yasak1: (f1.match(yasak) || [])[0], yasak2: (f2.match(yasak) || [])[0] })); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r0 = await bas(p, "one");
  const pe = await p.evaluate(async () => { if (!RUN) return { run: false }; AI.fn = () => { }; AI.off = false; window.__ai = []; window.aiStream = (k) => { window.__ai.push(String(k)); }; RUN.rev[RUN.cur] = true; UI.inRun = true; render();
    const id = RUN.qs[RUN.cur].id, once = RUN.qs.length, var_ = !!document.querySelector('[data-a="paraEval"]'); UI.paraDraft[id] = "Yazar asıl olarak sentetik bir ana fikri anlatıyor."; ACT.paraEval(); await new Promise(r => setTimeout(r, 200));
    return { run: true, paraEvalVar: var_, anahtar: window.__ai.slice(), once, sonra: RUN.qs.length, id }; });
  t("GÜVENLİ", "B4 güvenli paragraf RUN'ında paraIdea çalışır (paraEval var) ve yalnız 'pe:<id>' değerlendirmesi yapar; RUN'a soru eklemez", r0.run && pe.run && pe.paraEvalVar && pe.anahtar.length === 1 && pe.anahtar[0] === "pe:" + pe.id && pe.sonra === pe.once, JSON.stringify({ pe })); await c.close(); }

/* ---- ESKİ CEVAPLI ake.run: korunur, #paragraf'tan fark edilmeden devam ettirilemez veya sessizce silinemez; açık durum gerekir ---- */
const eskiKur = p => p.evaluate(() => { baslatRun({ kind: "practice", title: "ESKI-YEREL", mode: "study", qs: BANK.filter(q => q.s === "turkce").slice(0, 3) }); RUN.ans[0] = 1; RUN.rev[0] = true; saveRun(); UI.inRun = false; UI.modal = null; render();
  return { ls: (localStorage.getItem("ake.run") || "").includes("ESKI-YEREL"), aVar: RUN.qs.filter(q => Number.isInteger(q.a)).length, cevap: RUN.ans.filter(a => a != null).length }; });
const eskiDurum = p => p.evaluate(() => ({ baslik: RUN ? RUN.title : "", cevap: RUN ? RUN.ans.filter(a => a != null).length : -1, ls: (localStorage.getItem("ake.run") || "").includes("ESKI-YEREL"), inRun: !!UI.inRun,
  kart: (document.querySelector("[data-paragraf-durum]") || { dataset: {} }).dataset.paragrafDurum || "", kartMetin: ((document.querySelector('[data-paragraf-durum="eski-oturum"]') || {}).textContent || ""),
  banner: !!document.querySelector('.banner [data-a="resume"]'), runReplace: !!document.querySelector('[data-a="runReplace"]'), modal: UI.modal ? String(UI.modal.title || "") : "" }));
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const on = await eskiKur(p); await p.waitForTimeout(300); const d = await eskiDurum(p);
  t("GÜVENLİ", "E0 (önkoşul) eski cevaplı yerel RUN kuruldu ve ake.run'a yazıldı", on.ls && on.aVar === 3 && on.cevap === 1, JSON.stringify(on));
  t("GÜVENLİ", "E1 eski cevaplı yerel oturum varken #paragraf AÇIK durum gösterir (data-paragraf-durum='eski-oturum', oturum başlığı görünür)", d.kart === "eski-oturum" && /ESKI-YEREL/.test(d.kartMetin), JSON.stringify({ kart: d.kart, metin: d.kartMetin.slice(0, 80) }));
  t("GÜVENLİ", "E2 #paragraf'ta sessiz 'Devam et' bandı yok (yerel cevaplı RUN fark edilmeden devam ettirilemez)", !d.banner, JSON.stringify({ banner: d.banner })); await c.close(); }
for (const eylem of ["start", "one"]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const on = await eskiKur(p); await p.waitForTimeout(200); const r = await bas0(p, eylem); const d = await eskiDurum(p);
  t("GÜVENLİ", `E3 ${eylem === "start" ? "paraStart" : "paraOne"} eski RUN varken: eski oturum KORUNUR (başlık, cevap sayısı, ake.run), yeni RUN açılmaz, 'Yenisini başlat' (runReplace) sunulmaz`, on.ls && r.tikladi && d.baslik === "ESKI-YEREL" && d.cevap === 1 && d.ls && !d.inRun && !d.runReplace, JSON.stringify({ tikladi: r.tikladi, ...d, kartMetin: undefined }));
  t("GÜVENLİ", `E4 ${eylem === "start" ? "paraStart" : "paraOne"} eski RUN varken kullanıcıya açık durum gösterilir ('eski-oturum' durum kartı; eski 'Yarım kalan oturum var' modalı yeterli sayılmaz) ve sunucu oturumu/kota harcanmaz`, d.kart === "eski-oturum" && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ kart: d.kart, modal: d.modal, oturumIstek: D.istekler.length, kota: D.kota })); await c.close(); }

/* bas() ake.run'ı SİLER; eski-RUN testlerinde silmeden tıklayan sürüm */
async function bas0(p, eylem) {
  const sel = eylem === "start" ? '[data-a="paraStart"]' : '[data-a="paraOne"]'; const tikladi = await p.click(sel, { timeout: 2500 }).then(() => true, () => false); await p.waitForTimeout(500); return { tikladi };
}

/* ---- BAYRAK KAPALI, KATALOG AÇIK: eski davranış korunur (güvenli mod yalnız bayrakla açılır) ---- */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await p.evaluate(() => { window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; render(); }); await p.waitForTimeout(300); const sat = await satirlar(p), k = await kart(p);
  t("KARAKT", "K7 bayrak yokken (AKE_KATALOG açık olsa bile) #paragraf eski listeyi korur: BANK p'li sorular, durum kartı yok", sat.length === BANKP.length && sat.every(i => BID.has(i)) && k === "", JSON.stringify({ sat: sat.length, kart: k })); await c.close(); }

/* =====================  EK (uygulama sonrası, 3C-2 uygulama doğrulaması): güvenli RUN'ın kalıcı işareti ve normal devamı; benzer yolunun düğme/eylem düzeyi  ===================== */
const ex = (ad, ok, ek2) => t("EK", ad, ok, ek2);
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); const r = await bas(p, "start");
  const kalici = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("ake.run") || "{}").gvn === "paragraf" && RUN.gvn === "paragraf"; } catch (e) { return false; } });
  ex("X1 güvenli paragraf RUN'ı kalıcı işaretli (RUN.gvn ve ake.run içinde 'paragraf')", r.run && kalici, JSON.stringify({ run: r.run, kalici }));
  await p.evaluate(() => { UI.inRun = false; UI.modal = null; location.hash = "#paragraf"; render(); }); await p.waitForTimeout(300);
  const g = await p.evaluate(() => ({ resume: !!document.querySelector('.banner [data-a="resume"]'), eski: !!document.querySelector('[data-paragraf-durum="eski-oturum"]') }));
  await p.click('.banner [data-a="resume"]', { timeout: 2500 }).catch(() => { }); await p.waitForTimeout(300);
  const dev = await p.evaluate(() => ({ inRun: !!UI.inRun, run: !!RUN && RUN.gvn === "paragraf" }));
  ex("X2 güvenli paragraf RUN'ının normal devamı korunur: 'Devam et' bandı var, eski-oturum kartı yok, devam eder", g.resume && !g.eski && dev.inRun && dev.run, JSON.stringify({ g, dev }));
  await p.evaluate(() => { UI.inRun = false; location.hash = "#paragraf"; render(); }); await p.waitForTimeout(200);
  await p.click('[data-a="paraStart"]', { timeout: 2500 }).catch(() => { }); await p.waitForTimeout(300);
  const md = await p.evaluate(() => ({ modal: UI.modal ? String(UI.modal.title || "") : "", rep: !!document.querySelector('[data-a="runReplace"]') }));
  await p.click('[data-a="runReplace"]', { timeout: 2500 }).catch(() => { }); const yeni = await ozet(p);
  ex("X3 güvenli RUN varken yeni güvenli başlatma: normal 'Yarım kalan oturum var' modalı; 'Yenisini başlat' yeni GÜVENLİ RUN açar (yalnız katalog p'li sunucu soruları)", /Yarım kalan/.test(md.modal) && md.rep && yeni.run && sadecePara(yeni.ids, PA) && yeni.svN === yeni.n, JSON.stringify({ md, yeni: { ...yeni, ids: undefined } })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); await bas(p, "one");
  await p.evaluate(() => { UI.inRun = false; render(); });
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }).catch(() => { }); await p.waitForTimeout(500);
  const o = await p.evaluate(() => ({ run: !!RUN, gvn: RUN ? RUN.gvn || "" : "", ls: (() => { try { return JSON.parse(localStorage.getItem("ake.run") || "{}").gvn || ""; } catch (e) { return ""; } })() }));
  ex("X4 sayfa yenilenince işaret korunur (ake.run'daki gvn); RUN geri yüklenirse güvenli kalır", o.ls === "paragraf" && (!o.run || o.gvn === "paragraf"), JSON.stringify(o)); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); await eskiKur(p); await p.waitForTimeout(200);
  const o = await p.evaluate(() => { const once = RUN.title; ACT.resume(); const a = { inRun: !!UI.inRun, ayni: RUN.title === once };
    UI.pendingRun = { kind: "para", title: "Paragraf antrenmanı", mode: "study", qs: [{ id: "kat-a-p01", s: "turkce", t: "Paragraf", d: 1, q: "x", o: ["a", "b", "c", "d", "e"], p: "x" }], paragrafGuvenli: true }; ACT.runReplace();
    return { ...a, silinmedi: !!RUN && RUN.title === "ESKI-YEREL", ls: (localStorage.getItem("ake.run") || "").includes("ESKI-YEREL"), pendingTemiz: !UI.pendingRun }; });
  ex("X5 eylem düzeyi: eski RUN varken #paragraf'ta ACT.resume() eski oturumu açmaz; paragrafGuvenli cfg'li runReplace eski RUN'ı EZMEZ", !o.inRun && o.ayni && o.silinmedi && o.ls && o.pendingTemiz, JSON.stringify(o)); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p); await bas(p, "one");
  const o = await p.evaluate(async () => { RUN.rev[RUN.cur] = true; UI.inRun = true; render(); const dugme = !!document.querySelector('[data-a="benzerEkle"]'); const once = RUN.qs.length; let aiCagri = 0;
    AI.fn = { json: async () => { aiCagri++; return []; } }; AI.off = false; UI.benzerQ = { q: snap(RUN.qs[RUN.cur]), yer: "run" }; ACT.benzerAIGo(); await new Promise(r => setTimeout(r, 400));
    return { dugme, ayni: RUN.qs.length === once, aiCagri, aiQsDeg: S.aiQs.filter(q => q.id !== "ai-tuzak-1").length }; });
  ex("X6 güvenli RUN'da 'Benzerini çöz' DÜĞMESİ yok; benzerAIGo eylemi AI çağırmaz, RUN'a/S.aiQs'ye soru eklemez", !o.dugme && o.ayni && o.aiCagri === 0 && o.aiQsDeg === 0, JSON.stringify(o)); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await bas(p, "one");
  const o = await p.evaluate(() => { RUN.rev[RUN.cur] = true; UI.inRun = true; render(); return { run: !!RUN, gvn: RUN && RUN.gvn, dugme: !!document.querySelector('[data-a="benzerEkle"]') }; });
  ex("X7 bayrak kapalı: RUN'da gvn işareti yok ve 'Benzerini çöz' düğmesi eskisi gibi var", o.run && !o.gvn && o.dugme, JSON.stringify(o)); await c.close(); }

await b.close(); srv.close();
console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) console.log("KIRMIZI:\n  " + kirmizi.join("\n  ")); process.exit(kalan ? 1 : 0);
