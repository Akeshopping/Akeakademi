// B4 3C-4f · yanlış tekrarı (ACT.mistOne / ACT.mistStart / ACT.mistDue) güvenli katalog geçişi — gerçek Chromium + SAHTE API testleri (Production/Preview/D1'e dokunmaz; CI'a EKLENMEZ).
// Taban B4 4d9e064efca3279b619244e81091b42d6596015f. HEDEF SÖZLEŞME (bayrak AKE_KATALOG_STUDYO === true): üç eylem studyoGirisCalistir → KHAVUZ (kimlikle, katalogdaki CEVAPSIZ nesne; S.mistakes[id].q kopyalanmaz) → studyoCfg → zorunlu sunucu oturumu
//   (RUN.gvn="studyo", kind="mistakes" korunur). Katalog dışı / g: / AI / eski / görselli yanlışlar ELENİR ve sayı bildirilir; yanlış kaydı SİLİNMEZ; uygun soru yoksa RUN açılmaz. Yerel (cevaplı) fallback ve yerel kota isteği YOK.
// BU TUR YALNIZ KIRMIZI TESTLER: uygulama kodu DEĞİŞMEZ; testler değişmemiş B4 kodunda çalıştırılır. Gruplar: [KARAKT] bayrak KAPALI (yeşil kalmalı) · [SEÇİM] mevcut seçim/filtre/sıra/30 sınırı · [GÜVENLİ] · [ELEME] · [HATA] · [KOTA] · [KATALOG] · [ESKİ] · [YARIŞ] · [BİTİŞ] · [DOM] · [KAPSAM]
// Varsayımlar (raporda): (1) 30 sınırı ve seçim ÖNCE uygulanır, eleme SONRA (elenenler yerine 31. yanlış getirilmez); (2) görselli (fig) anlık görüntü, katalogda kimliği olsa bile elenir (3C-4d ile aynı kural);
//   (3) hata/yarış testlerinde sunucu oturumu isteği ÖN KOŞUL olarak ölçülür (değişmemiş kodda hiç istek yok → kırmızı); (4) sunucu /cevap sahtesi sabit anahtar döner, doğru seçenek = 1 (değer çıktıya yazılmaz).
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz (sentetik; yalnız kimlik/sayı/varlık). Çalıştırma: node tests/studyo-mist-istemci.mjs · çıkış kodu: kırmızı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };
const bilgi = (ad, v) => console.log("BİLGİ ", ad, typeof v === "string" ? v : JSON.stringify(v));

const D = { dus: [], oturum: "tam", bitir: "tam", istekler: [], bitirler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: tam|ilkEksik|kismi5|bos|404|banka_yok|500|402|401|429|ag  ·  bitir: tam|500|410|ag
const D2 = { kat: "tam", katIstek: 0, kes: null, tut: null };
const D4 = { oturumTut: null, kota: { sinirsiz: true } };
const D3 = { bitirTut: null, cikisTut: null, cikisGeldi: false, gecerli: new Set(["kul1", "kulB"]) };
const KATALOG = new Map(), KATID = {}; let BILGI = new Map();
/* sentetik cevap anahtarı (yalnız sahte sunucu ve karşılaştırma): değer çıktıya yazılmaz */
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const ANAHTAR = id => hash(id) % 5, COZUM = id => "SENTETIK-COZUM-" + id;
const js = (r, kod, o) => { r.statusCode = kod; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); r.end(JSON.stringify(o)); };
const govde = q => new Promise(ok => { let s = ""; q.on("data", c => s += c); q.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { ok({}); } }); });
const srv = http.createServer(async (q, r) => {
  const f = new URL(q.url, "http://x").pathname, kul = ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(HTML); }
  if (f === "/api/hesap/ben") { if (!kul || !D3.gecerli.has(kul)) return js(r, 401, { error: "giris" }); return js(r, 200, { kullanici: { id: kul, eposta: kul + "@x.test", ad: "" }, paket: null, ucretsiz: null, ayar: { google: false, eposta: true } }); }
  if (f === "/api/hesap/cikis") { D3.cikisGeldi = true; if (D3.cikisTut) await D3.cikisTut.kapi; D3.gecerli.delete(kul); return js(r, 200, { ok: true }); }
  if (f === "/api/soru/katalog") {
    D2.katIstek++; if (D2.tut) await D2.tut.kapi; if (!kul) return js(r, 401, {}); if (D2.kat === "404") return js(r, 404, {}); if (D2.kat === "500") return js(r, 500, {});
    let l = (KATALOG.get(kul) || []).map(x => ({ ...x }));
    if (D2.kes) { const say = {}; l = l.filter(x => { if (!(x.s in D2.kes)) return true; say[x.s] = (say[x.s] || 0) + 1; return say[x.s] <= D2.kes[x.s]; }); }
    return js(r, 200, { n: l.length, bayrak: "hazir", beklenen: { toplam: l.length, os: 0, fix: 0 }, sorular: l, sonraki: null });
  }
  if (f === "/api/hesap/veri") return js(r, 200, { alanlar: {} });
  if (f === "/api/hesap/kota") { const b = await govde(q); D.kota++; return js(r, 200, { verildi: b.adet || 1, kalanSoru: 500, kalanDeneme: 5 }); }
  if (f === "/api/ai") { await govde(q); D.ai++; return js(r, 200, { text: "[]" }); }
  if (f === "/api/soru/cevap") { await govde(q); D.cevap++; return js(r, 200, { a: 1, x: "sentetik" }); }
  if (f === "/api/soru/bitir") {
    const b = await govde(q); D.bitirler.push({ oturum: b.oturum, cevaplar: Array.isArray(b.cevaplar) ? b.cevaplar.map(c => ({ soru: c.soru, secim: c.secim })) : null, alanlar: Object.keys(b).sort() });
    { const T = D3.bitirTut; if (T && !T.tuttu) { T.tuttu = true; await T.kapi; } }
    if (D.bitir === "500") return js(r, 500, { error: "x" }); if (D.bitir === "410") return js(r, 410, { error: "sure_doldu" }); if (D.bitir === "ag") { r.socket.destroy(); return; }
    const cv = Array.isArray(b.cevaplar) ? b.cevaplar : [];
    return js(r, 200, { ok: true, sorular: cv.map(c => ({ id: c.soru, secim: c.secim, a: ANAHTAR(c.soru), x: COZUM(c.soru), dogru: c.secim == null ? null : c.secim === ANAHTAR(c.soru) })) });
  }
  if (f === "/api/soru/oturum") {
    const b = await govde(q); D.istekler.push({ mod: b.mod, istek: b.istek, idler: Array.isArray(b.idler) ? b.idler.slice() : [], alanlar: Object.keys(b).sort() });
    { const T = D4.oturumTut; if (T && !T.tuttu) { T.tuttu = true; await T.kapi; } }
    if (D.oturum === "404") return js(r, 404, { error: "yok" }); if (D.oturum === "banka_yok") return js(r, 503, { error: "banka_yok" }); if (D.oturum === "500") return js(r, 500, { error: "x" });
    if (D.oturum === "402") return js(r, 402, { error: "limit", kota: { kalan: 0 } }); if (D.oturum === "401") return js(r, 401, { error: "giris" }); if (D.oturum === "429") return js(r, 429, { error: "cok_istek" });
    if (D.oturum === "ag") { r.socket.destroy(); return; }
    const idler = (b.idler || []).filter(i => (BILGI.has(i) || KATID[i]) && !(KATID[i] && D.dus.includes(KATID[i].s)));
    const verilen = D.oturum === "bos" ? [] : D.oturum === "kismi5" ? idler.slice(0, 5) : D.oturum === "ilkEksik" ? idler.slice(1) : idler;
    return js(r, 200, { oturum: "o" + Math.floor(Math.random() * 1e9), kota: D4.kota, sorular: verilen.map(i => { const k = BILGI.get(i) || KATID[i]; return { id: k.id, q: k.q, o: k.o, ...(k.p ? { p: k.p } : {}) }; }) });
  }
  if (f.startsWith("/api/")) return js(r, 404, {});
  r.statusCode = 404; r.end("");
});
await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"] });

/* sayfadaki EXAMS/BANK'ten yalnız cevapsız alanlar + ders listesi okunur (a/x ALINMAZ) */
let SINAV, DERSLER;
{ const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage(); await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(800);
  const l = await p.evaluate(() => BANK.map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, ...(q.p ? { p: q.p } : {}) }))); BILGI = new Map(l.map(x => [x.id, x]));
  SINAV = await p.evaluate(() => Object.fromEntries(Object.entries(EXAMS).map(([k, e]) => [k, { n: e.n, min: e.min, sec: e.sec.map(s => ({ n: s.n, p: s.p })) }])));
  DERSLER = await p.evaluate(() => Object.keys(SUBJ));
  await c.close(); }
const SINAV_DERS = [...new Set(Object.values(SINAV).flatMap(e => e.sec.flatMap(s => s.p.map(x => x[0]))))];
if (BILGI.size < 100 || !SINAV.TYT || !SINAV_DERS.every(s => DERSLER.includes(s))) { console.error("TEST GEÇERSİZ: BANK/EXAMS okunamadı", BILGI.size); process.exit(2); }
const BID = new Set(BILGI.keys());
/* sentetik katalog (kullanıcı başına): deneme derslerinin HER biri için 14 cevapsız soru; id = kat-<a|b>-<ders>NN */
for (const [kul, on] of [["kul1", "a"], ["kulB", "b"]]) {
  const l = []; for (const s of SINAV_DERS) for (let i = 1; i <= 14; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-${on}-${s}${no}`, s, t: `Mini ${s}`, d: 1 + (i % 3), q: `MINI-${on.toUpperCase()}-${s}${no} sentetik katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }); }
  l.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)); KATALOG.set(kul, l); l.forEach(x => { KATID[x.id] = x; });
}
/* koç testi için ek sentetik katalog: aynı ders (S0) altında büyük konu KOC-ANA (36 soru: zorluk 1/2/3 × 12) ve küçük konu KOC-AZ (3 soru) */
const S0 = SINAV_DERS.includes("mat") ? "mat" : SINAV_DERS[0], TA = "KOC-ANA", TZ = "KOC-AZ";
for (const [kul, on] of [["kul1", "a"], ["kulB", "b"]]) { const l = KATALOG.get(kul);
  for (const [tp, adet] of [[TA, 36], [TZ, 3]]) for (let i = 1; i <= adet; i++) { const no = String(i).padStart(2, "0"); const x = { id: `kat-${on}-koc-${tp === TA ? "a" : "z"}${no}`, s: S0, t: tp, d: 1 + ((i - 1) % 3), q: `KOC-${on.toUpperCase()}-${tp}-${no} sentetik katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }; l.push(x); KATID[x.id] = x; }
  l.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)); }
const KS = new Set(KATALOG.get("kul1").map(x => x.id)), KSB = new Set(KATALOG.get("kulB").map(x => x.id));

async function sayfa({ giris = true, guvenli = false, kul = "kul1", hash = null, tuzak = true } = {}) {
  if (hash === null) hash = guvenli ? "#studyo" : "";   // güvenli modda katalog yüklemesi #studyo açılışıyla başlar (3C-3 sözleşmesi)
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1200, height: 900 } }), p = await c.newPage(); p.on("pageerror", () => { });
  await p.addInitScript(g => { if (g) { window.AKE_KATALOG_STUDYO = true; window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; } }, guvenli);
  if (giris) await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]);
  await p.goto(URL0 + hash, { waitUntil: "load" });
  await p.waitForFunction(() => HESAP.hazir, null, { timeout: 8000 }); if (giris) await p.waitForFunction(() => HESAP.user, null, { timeout: 8000 });
  await p.evaluate(([tuzak, ders]) => {
    window.__t = []; const T = toast; window.toast = m => { window.__t.push(String(m)); T(m); };
    if (tuzak) { const o = ["A", "B", "C", "D", "E"].map(h => h + " tuzak"); for (const s of ders) { S.aiQs.push({ id: "ai-tuzak-" + s, s, t: "Tuzak", d: 1, q: "AI tuzak soru", o, a: 1, x: "tuzak çözüm", src: "ai" }); EKQ.push({ id: "ek-tuzak-" + s, s, t: "Tuzak", d: 1, q: "EK tuzak soru", o, a: 2, x: "tuzak çözüm" }); } }
    render();
  }, [tuzak, SINAV_DERS]);
  await p.waitForTimeout(300); return { c, p };
}
const sifirla = () => { D.istekler.length = 0; D.bitirler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D.dus = []; D.bitir = "tam"; D2.kes = null; D2.tut = null; D2.kat = "tam"; D2.katIstek = 0; D3.bitirTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); D4.oturumTut = null; D4.kota = { sinirsiz: true }; };
const kapiYap = () => { let ac; const kapi = new Promise(o => { ac = o; }); return { kapi, ac, tuttu: false }; };
const bekle = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise(o => setTimeout(o, 50)); } return false; };
const hazirBekle = (p, ms = 7000) => p.waitForFunction(() => ["hazir", "durdu"].includes(KHAVUZ.durumu().durum), null, { timeout: ms }).then(() => true, () => false);
const onYukle = async p => { if (!(await hazirBekle(p))) { console.error("TEST GEÇERSİZ: katalog hazır olmadı"); process.exit(2); } };
const git = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(450); };
const gec = async (c, p, kul) => { await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]); await p.evaluate(k => hesapKimlikGuncelle({ id: k, eposta: k + "@x.test", ad: "" }), kul); };
const tikla = (p, sel) => p.click(sel, { timeout: 2500 }).then(() => true, () => false);
const setAlan = (p, a) => p.evaluate(x => { S.profile.alan = x; render(); }, a);
const eskiRunKur = (p, gvn) => p.evaluate(g => { RUN = null; baslatRun({ kind: "practice", title: "Eski yerel oturum", mode: "study", qs: BANK.slice(0, 6) }); RUN.ans[0] = 0; RUN.ans[1] = 1; if (g) RUN.gvn = g; saveRun(); UI.inRun = false; render(); }, gvn || null);
/* beklenen çeyrek deneme (sayfadaki examRows + EXAMS'tan; UI durumu değiştirilir) */
const beklenen = (p, alan) => p.evaluate(a => {
  S.profile.alan = a; const type = defaultExam(); UI.exam.type = type; UI.exam.size = "quarter"; UI.exam.mode = "exam"; UI.exam.dur = "";
  const rows = examRows(type).map(r => ({ sec: r.sec, s: r.s, n: r.n, full: r.full })), ex = EXAMS[type], total = rows.reduce((x, r) => x + r.n, 0), full = rows.reduce((x, r) => x + r.full, 0), auto = Math.max(5, Math.round(ex.min * total / full));
  const secs = []; let k = 0; for (const r of rows) { let s = secs[secs.length - 1]; if (!s || s.n !== r.sec) { s = { n: r.sec, from: k, to: k, dersler: [] }; secs.push(s); } k += r.n; s.to = k; if (!s.dersler.includes(r.s)) s.dersler.push(r.s); }
  const ders = {}; rows.forEach(r => { ders[r.s] = (ders[r.s] || 0) + r.n; });
  return { type, ad: ex.n, rows, total, full, auto, durSn: auto * 60, secs, ders };
}, alan);
/* RUN özeti: cevap DEĞERİ yok; yalnız kimlik/sayı/varlık */
const ozet = p => p.evaluate(async (bid) => {
  for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 250));
  const B = new Set(bid), R = RUN, ids = R ? R.qs.map(q => String(q.id)) : [];
  const ls = (() => { try { return JSON.parse(localStorage.getItem("ake.run") || "null"); } catch (e) { return null; } })();
  const aV = q => Number.isInteger(q.a) && q.a >= 0 && q.a <= 4, xV = q => typeof q.x === "string" && q.x.trim().length > 0;
  return { run: !!R, id: R ? R.id : null, kind: R ? R.kind : null, mode: R ? R.mode : null, title: R ? R.title : "", dur: R ? R.dur : -1, secs: R ? R.secs.map(s => ({ n: s.n, from: s.from, to: s.to })) : null,
    n: ids.length, ids, ans: R ? R.ans.filter(a => a != null).length : 0, svN: R ? R.qs.filter(q => q.sv).length : 0, yerelN: R ? R.qs.filter(q => !q.sv).length : 0,
    aVar: R ? R.qs.filter(aV).length : 0, xVar: R ? R.qs.filter(xV).length : 0, svA: R ? R.qs.filter(q => q.sv && (aV(q) || xV(q))).length : 0, yerelA: R ? R.qs.filter(q => !q.sv && aV(q)).length : 0,
    genN: ids.filter(i => /^g:/.test(i)).length, bankN: ids.filter(i => B.has(i)).length, tuzakN: ids.filter(i => /tuzak/.test(i)).length, tekil: new Set(ids).size === ids.length,
    gvn: R ? (R.gvn || null) : null, lsGvn: ls && ls.gvn ? ls.gvn : null, lsId: ls ? ls.id || null : null, lsN: ls && Array.isArray(ls.qs) ? ls.qs.length : -1,
    lsA: ls && Array.isArray(ls.qs) ? ls.qs.filter(q => aV(q) || xV(q)).length : 0,
    domSizinti: document.body.innerHTML.includes("SENTETIK-COZUM"), lsSizinti: (localStorage.getItem("ake.run") || "").includes("SENTETIK-COZUM"),
    modal: UI.modal ? String(UI.modal.title || "") : "", toast: (window.__t || []).slice(), sinav: S.exams.length, resultId: UI.resultId || null };
}, [...BID]);
const dagilimS = ids => { const d = {}; ids.forEach(i => { const k = KATID[i]; if (k) d[k.s] = (d[k.s] || 0) + 1; }); return d; };
const esit = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const sirali = o => Object.fromEntries(Object.entries(o).sort((x, y) => (x[0] < y[0] ? -1 : 1)));
const secsParca = (secs, n) => secs && secs.length > 0 && secs[0].from === 0 && secs[secs.length - 1].to === n && secs.every((s, i) => s.to > s.from && (i === 0 || s.from === secs[i - 1].to));
/* mini GERÇEK giriş yolları: ana sayfa "Bugünün programı → Mini deneme" ve "Daha fazla → Son deneme" kartındaki mini düğmesi (S.exams boşken de düğme varsa) */
const GIRIS = {
  "ana sayfa gunluk program 'Mini denemesi'": { kur: p => git(p, ""), sel: '.gtask [data-a="quick"][data-k="mini"]' },
  "ana sayfa 'Son deneme' kartı mini düğmesi": { kur: async p => { await git(p, ""); await p.evaluate(() => { document.querySelectorAll("details.more").forEach(d => { d.open = true; }); }); }, sel: 'details.more [data-a="quick"][data-k="mini"]' }
};
const girisYap = async (p, y, alan) => { await y.kur(p); if (alan !== undefined) { await setAlan(p, alan); await y.kur(p); } return tikla(p, y.sel); };
/* ÇEKİRDEK: geleceğin mini girişinin kuracağı güvenli sınav cfg'si (KHAVUZ'dan, bölüm başına) — mini girişinden bağımsız svBaslat/svBitir ölçümü */
const cekirdekHam = (p, alan, ek) => p.evaluate(([a, ek]) => {
  S.profile.alan = a; const type = defaultExam(); UI.exam.type = type; UI.exam.size = "quarter"; UI.exam.mode = "exam"; UI.exam.dur = "";
  const rows = examRows(type), qs = [], secs = []; let tam = 0;
  for (const r of rows) { const h = stHavuzG(r.s, {}); const al = h.taze.concat(h.eski).slice(0, r.n); let s = secs[secs.length - 1]; if (!s || s.n !== r.sec) { s = { n: r.sec, from: qs.length, to: qs.length }; secs.push(s); } for (const q of al) qs.push(q); s.to = qs.length; tam += r.full; }
  const total = rows.reduce((x, r) => x + r.n, 0), auto = Math.max(5, Math.round(EXAMS[type].min * total / tam));
  startRun(studyoCfg(Object.assign({ kind: "exam", type, title: EXAMS[type].n + " denemesi · mini", mode: "exam", qs, secs: secs.filter(x => x.to > x.from), dur: auto }, ek || {})));
}, [alan, ek]);
const cekirdek = async (p, alan, ek) => { await cekirdekHam(p, alan, ek); await p.waitForFunction(() => RUN || UI.modal, null, { timeout: 5000 }).catch(() => { }); await p.waitForTimeout(150); };
/* sonuç doğrulama (sentetik anahtarla; değerler çıktıya yazılmaz): son S.exams kaydının q.a/x'i bitir yanıtındaki sentetik anahtarla aynı mı, bölüm toplamları n ile uyumlu mu */
const sonucOzet = p => p.evaluate(([anahtar]) => {
  const e = S.exams[S.exams.length - 1]; if (!e) return { var: false };
  const bos = e.qs.filter(q => q.your == null).length, dogru = e.qs.filter(q => q.your != null && q.a === q.your).length;
  return { var: true, n: e.qs.length, bolum: e.sections.map(s => ({ n: s.n, top: s.d + s.y + s.b })), toplam: e.d + e.y + e.b, dogru, d: e.d, anahtarTam: e.qs.every(q => Number.isInteger(q.a) && typeof q.x === "string" && q.x.startsWith("SENTETIK-COZUM-" + q.id)), secs: e.secs, dur: e.dur };
}, [0]);
const bitirTikla = async p => { await p.evaluate(() => { finishRun(false); }); };


const hesapDegis = async (c, p, kul) => { await gec(c, p, kul); await p.evaluate(() => hesapEsitle()); await p.waitForTimeout(600); };
/* koç durumu: konu istatistiği (seviye) + açık yanlışlar. Anlık görüntü METİNLERİ ayırt edilebilir (ESKI-SNAPSHOT-…), çözümleri ESKI-COZUM-… */
const zayifKur = (p, s, tp, v) => p.evaluate(([s, tp, v]) => { S.topic[s + "|" + tp] = v; render(); }, [s, tp, v]);
const yanlisKur = (p, l) => p.evaluate(([l, S0, TA]) => { l.forEach(m => { S.mistakes[m.id] = { q: Object.assign({ id: m.id, s: m.s || S0, t: m.t || TA, d: 2, q: "ESKI-SNAPSHOT-" + m.id, o: ["a", "b", "c", "d", "e"].map(h => h + " eski"), a: 1, x: "ESKI-COZUM-" + m.id }, m.fig ? { fig: { k: 1 } } : {}, m.gen ? { gen: "x" } : {}), n: m.n, ts: Date.now(), ok: 0, learned: !!m.learned, last: 0, dk: 0 }; }); render(); }, [l, S0, TA]);
const kocHazir = async (p, v = [2, 8, 0], tp = TA) => { await onYukle(p); await zayifKur(p, S0, tp, v); await git(p, "#koc"); };
const kocTestCagir = (p, tp = TA) => p.evaluate(([s, tp]) => { ACT.kocTest({ s, t: tp }); }, [S0, tp]);
const koc = async (p, tp = TA) => { await kocTestCagir(p, tp); return ozet(p); };
const SNAP = p => p.evaluate(() => { const r = JSON.stringify([RUN, localStorage.getItem("ake.run") || ""]); return { snapshot: /ESKI-SNAPSHOT|ESKI-COZUM/.test(r) }; });
const dersKonu = ids => { const d = {}, k = {}, z = {}; ids.forEach(i => { const q = KATID[i]; if (!q) return; d[q.s] = (d[q.s] || 0) + 1; k[q.t] = (k[q.t] || 0) + 1; z[q.d] = (z[q.d] || 0) + 1; }); return { d, k, z }; };
const hepsiKatalogda = (ids, KS_) => ids.length > 0 && ids.every(i => KS_.has(i));
const AGIRLIK = { 1: { 1: 6, 2: 3, 3: 1 }, 2: { 1: 2, 2: 5, 3: 3 }, 3: { 1: 1, 2: 3, 3: 6 } };


/* ---- 3C-4f araçları ---- */
const S1 = SINAV_DERS.find(s => s !== S0);
const NN = n => String(n).padStart(2, "0");
const kk = n => `kat-a-koc-a${NN(n)}`;   // S0 / KOC-ANA (kul1 kataloğunda 36 adet)
const km = n => `kat-a-${S1}${NN(n)}`;   // S1 / "Mini <S1>" (14 adet)
const T0 = 1700000000000;
const BIRLIK = ts => T0 + ts * 1000;
/* açık yanlış kaydı kur. Anlık görüntü METNİ ayırt edilebilir (ESKI-SNAPSHOT-…), çözümü ESKI-COZUM-…; due:false → tekrar zamanı gelmemiş */
const mistKur = (p, l) => p.evaluate(([l, S0, TA]) => {
  l.forEach(m => {
    S.mistakes[m.id] = { q: Object.assign({ id: m.id, s: m.s || S0, t: m.t || TA, d: 2, q: "ESKI-SNAPSHOT-" + m.id, o: ["a", "b", "c", "d", "e"].map(h => h + " eski"), a: 1, x: "ESKI-COZUM-" + m.id }, m.fig ? { fig: { k: 1 } } : {}, m.gen ? { gen: "x" } : {}, m.src ? { src: m.src } : {}),
      n: m.n || 1, ts: m.ts, ok: m.ok || 0, learned: !!m.learned, last: 0, dk: m.due === false ? gunSonra(3) : dayKey() };
  });
  render();
}, [l, S0, TA]);
const mistCagir = (p, kind, id) => p.evaluate(([k, id]) => { if (k === "one") ACT.mistOne({ id }); else if (k === "start") ACT.mistStart(); else ACT.mistDue(); }, [kind, id]);
const mist = async (p, kind, id) => { await mistCagir(p, kind, id); return ozet(p); };
const KINDS = [["one", "mistOne"], ["start", "mistStart"], ["due", "mistDue"]];
const mistDurum = p => p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(S.mistakes).map(([k, m]) => [k, { n: m.n, ok: m.ok, learned: m.learned, dk: m.dk, ts: m.ts, q: m.q.q, a: m.q.a }]))));
const mistAnahtar = p => p.evaluate(() => Object.keys(S.mistakes).sort());
const ESKIVAR = p => p.evaluate(() => { const r = JSON.stringify([RUN, localStorage.getItem("ake.run") || ""]); return /ESKI-SNAPSHOT|ESKI-COZUM/.test(r); });
const katMetin = (p) => p.evaluate((KT) => { const R = RUN; if (!R) return null; return R.qs.every(q => KT[q.id] === q.q); }, Object.fromEntries([...KATALOG.get("kul1")].map(x => [x.id, x.q])));
const aT = (r, n) => r.run && r.n === n && r.gvn === "studyo" && r.lsGvn === "studyo" && r.kind === "mistakes" && r.mode === "study" && r.svN === n && r.yerelN === 0 && r.aVar === 0 && r.xVar === 0 && r.lsA === 0 && !r.domSizinti && !r.lsSizinti;
const sade = hash => sayfa({ guvenli: true, hash });   // (düzeltme: önceki sürümde imza (p, hash) idi; sade("#yanlislar") hash'i yutuyordu → katalog #studyo varsayılanıyla baştan yükleniyordu)
const modalGovde = p => p.evaluate(() => (UI.modal ? String(UI.modal.body || "").replace(/<[^>]+>/g, "") : ""));
const uyar = (r, say) => r.toast.some(m => new RegExp(String(say)).test(m) && /yanlış/i.test(m) && /katalog/i.test(m));
const N10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({ id: kk(i), ts: BIRLIK(i) }));

/* =====================  SANITY  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false });
  const v = await p.evaluate(() => ({ one: typeof ACT.mistOne, start: typeof ACT.mistStart, due: typeof ACT.mistDue, tv: typeof tekrarVakti, ui: !!UI.mist }));
  t("SANITY", "ACT.mistOne/mistStart/mistDue, tekrarVakti ve UI.mist var", v.one === "function" && v.start === "function" && v.due === "function" && v.tv === "function" && v.ui, JSON.stringify(v));
  t("SANITY", "sahte katalog (kul1): test kimlikleri kat-a-koc-a01..36 ve S1 'Mini' 14 soru mevcut; kulB'de ayrı kimlik (kat-b-…)", KS.has(kk(1)) && KS.has(kk(36)) && KS.has(km(14)) && !KS.has("kat-a-koc-a99") && KSB.has("kat-b-koc-a01") && !KSB.has(kk(1)) && !!S1);
  await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }, { id: kk(2), ts: BIRLIK(2), due: false }]); const d = await p.evaluate(() => ({ b: tekrarBekleyen().map(([k]) => k), a: openMistakes().length }));
  t("SANITY", "tekrar zamanı: due=true kayıt tekrarBekleyen'de, due=false (3 gün sonra) değil; ikisi de açık", esit(d.b, [kk(1)]) && d.a === 2, JSON.stringify(d));
  await c.close(); }

/* =====================  KARAKTERİZASYON (bayrak KAPALI; mevcut davranış, yeşil kalmalı)  ===================== */
for (const [kind, ad] of KINDS) {
  sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await mistKur(p, N10.slice(0, 4).map(m => ({ ...m, due: true }))); const r = await mist(p, kind, kk(2));
  const bek = kind === "one" ? 1 : 4;
  t("KARAKT", `bayrak KAPALI ${ad} (mevcut): YEREL RUN (gvn yok), kind='mistakes', ${bek} soru, sunucu oturumu/katalog isteği/ai YOK, anlık görüntü CEVAPLI (a dolu); yerel kota yolu (POST /api/hesap/kota) mevcut davranıştır ve bilgi olarak raporlanır`, r.run && r.kind === "mistakes" && r.gvn === null && r.n === bek && r.svN === 0 && r.yerelN === bek && r.aVar === bek && D.istekler.length === 0 && D2.katIstek === 0 && D.ai === 0, JSON.stringify({ run: r.run, kind: r.kind, gvn: r.gvn, n: r.n, sv: r.svN, a: r.aVar, ist: D.istekler.length, kat: D2.katIstek }));
  bilgi(`KARAKT bayrak KAPALI ${ad}: yerel kota isteği sayısı (mevcut davranış)`, String(D.kota));
  await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1), ok: 1 }, { id: kk(2), ts: BIRLIK(2), ok: 2 }, { id: kk(3), ts: BIRLIK(3), due: false }]);
  await mist(p, "start"); await p.evaluate(async () => { for (let i = 0; i < 3; i++) { moveTo(i); pickAnswer(1); } }); await p.waitForTimeout(300);
  const s = await p.evaluate(() => ({ a: S.mistakes["kat-a-koc-a01"], b: S.mistakes["kat-a-koc-a02"], c: S.mistakes["kat-a-koc-a03"], hedef: TEKRAR_HEDEF }));
  t("KARAKT", "bayrak KAPALI yerel tekrar ilerlemesi (mevcut): zamanı gelen doğru → ok+1; 3. doğru → learned; zamanı gelmemiş doğru → ilerlemez", s.a.ok === 2 && !s.a.learned && s.b.learned === true && s.c.ok === 0 && !s.c.learned, JSON.stringify({ aOk: s.a.ok, bL: s.b.learned, cOk: s.c.ok }));
  await c.close(); }

/* =====================  SEÇİM: mevcut seçim, ders filtresi, zaman sırası, 30 sınırı (kimlik düzeyi; değişmemiş kodda da yeşil olmalı)  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, Array.from({ length: 35 }, (_, i) => ({ id: kk(i + 1), ts: BIRLIK(i + 1) }))); const r = await mist(p, "start");
  const beklenen = Array.from({ length: 30 }, (_, i) => kk(35 - i));
  t("SEÇİM", "mistStart: 35 açık yanlıştan en yeni 30'u, zaman (ts) sırası azalan; fazlası alınmaz", r.run && esit(r.ids, beklenen), JSON.stringify({ n: r.n, ilk: r.ids.slice(0, 3), son: r.ids.slice(-2) }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }, { id: km(1), s: S1, t: "Mini " + S1, ts: BIRLIK(2) }, { id: kk(2), ts: BIRLIK(3) }, { id: km(2), s: S1, t: "Mini " + S1, ts: BIRLIK(4) }]);
  await p.evaluate(s => { UI.mist.s = s; }, S1); const r = await mist(p, "start");
  t("SEÇİM", "ders filtresi (UI.mist.s): yalnız seçili dersin yanlışları, yeni→eski", r.run && esit(r.ids, [km(2), km(1)]), JSON.stringify(r.ids));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }, { id: kk(2), ts: BIRLIK(2), due: false }, { id: kk(3), ts: BIRLIK(3), learned: true }, { id: kk(4), ts: BIRLIK(4) }]); const r = await mist(p, "due");
  t("SEÇİM", "mistDue: yalnız ZAMANI GELMİŞ açık yanlışlar (zamanı gelmemiş ve öğrenilmiş dışarıda), yeni→eski", r.run && esit(r.ids, [kk(4), kk(1)]), JSON.stringify(r.ids));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1), learned: true }, { id: kk(2), ts: BIRLIK(2) }, { id: kk(3), ts: BIRLIK(3), due: false }]); const r = await mist(p, "start");
  t("SEÇİM", "mistStart: öğrenilmiş (learned) kayıtlar alınmaz; zamanı gelmemiş açık yanlış alınır", r.run && esit(r.ids, [kk(3), kk(2)]), JSON.stringify(r.ids));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }, { id: kk(2), ts: BIRLIK(2) }]); const r = await mist(p, "one", kk(1));
  t("SEÇİM", "mistOne: yalnız istenen kimlik (1 soru)", r.run && esit(r.ids, [kk(1)]), JSON.stringify(r.ids));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p);
  const l = Array.from({ length: 32 }, (_, i) => ({ id: kk(i + 1), ts: BIRLIK(i + 1) })); l[31] = { id: "kocm-katalogda-yok-a", ts: BIRLIK(32) }; l[30] = { id: "kocm-katalogda-yok-b", ts: BIRLIK(31) };
  await mistKur(p, l); const r = await mist(p, "start");
  t("SEÇİM", "VARSAYIM (1): seçim ÖNCE 30'a sınırlanır, eleme SONRA — en yeni 30'un 2'si katalog dışıysa 28 soru açılır, 31./32. yanlış yerine ALINMAZ", r.run && r.n === 28 && esit(r.ids, Array.from({ length: 28 }, (_, i) => kk(30 - i))), JSON.stringify({ n: r.n, ilk: r.ids.slice(0, 2) }));
  await c.close(); }

/* =====================  GÜVENLİ ÇEKİRDEK (bayrak AÇIK)  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const r = await mist(p, "one", kk(1)), eski = await ESKIVAR(p), ktm = await katMetin(p);
  t("GÜVENLİ", "mistOne (katalogda olan kimlik): güvenli RUN — gvn='studyo' (ake.run'da da), kind='mistakes', study, 1 soru, sunucu oturumlu, 0 yerel; bitiş öncesi 0 cevap/çözüm", aT(r, 1) && r.ids[0] === kk(1), JSON.stringify({ run: r.run, gvn: r.gvn, ls: r.lsGvn, kind: r.kind, n: r.n, sv: r.svN, yerel: r.yerelN, a: r.aVar, x: r.xVar }));
  t("GÜVENLİ", "mistOne: soru metni KATALOĞUN (sunucu) metni; S.mistakes anlık görüntüsü (ESKI-SNAPSHOT/ESKI-COZUM) RUN ve ake.run'a KOPYALANMAZ", ktm === true && !eski, JSON.stringify({ katMetni: ktm, anlikGoruntu: eski }));
  t("GÜVENLİ", "mistOne: 1 oturum isteği (mod=practice, idler=[kimlik]); yerel kota (POST /api/hesap/kota), ai ve ikinci istek yok", D.istekler.length === 1 && D.istekler[0].mod === "practice" && esit(D.istekler[0].idler, [kk(1)]) && D.kota === 0 && D.ai === 0, JSON.stringify({ ist: D.istekler.length, mod: D.istekler[0] && D.istekler[0].mod, kota: D.kota }));
  await c.close(); }
for (const [kind, ad] of [["start", "mistStart"], ["due", "mistDue"]]) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }, { id: kk(2), ts: BIRLIK(2) }, { id: km(1), s: S1, t: "Mini " + S1, ts: BIRLIK(3) }, { id: kk(3), ts: BIRLIK(4) }, { id: kk(4), ts: BIRLIK(5) }]);
  const r = await mist(p, kind), eski = await ESKIVAR(p), ktm = await katMetin(p);
  t("GÜVENLİ", `${ad}: 5 katalog kimliği → güvenli RUN (gvn=studyo, kind='mistakes', 5 soru, hepsi sunucu oturumlu, 0 yerel, 0 cevap/çözüm), kimlikler zaman sırasıyla`, aT(r, 5) && esit(r.ids, [kk(4), kk(3), km(1), kk(2), kk(1)]), JSON.stringify({ run: r.run, gvn: r.gvn, n: r.n, sv: r.svN, a: r.aVar, x: r.xVar, ids: r.ids.length }));
  t("GÜVENLİ", `${ad}: RUN soruları KATALOĞUN metniyle; anlık görüntü KOPYALANMAZ; BANK/GENS/EKQ/AI dolgusu yok; tek oturum isteği (mod=practice, idler=RUN kimlikleri)`, ktm === true && !eski && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && D.istekler.length === 1 && D.istekler[0].mod === "practice" && esit([...D.istekler[0].idler].sort(), [...r.ids].sort()) && D.kota === 0, JSON.stringify({ ktm, eski, bank: r.bankN, ist: D.istekler.length }));
  await c.close();
}

/* =====================  ELEME  ===================== */
const ELENEN = [["katalogda olmayan kimlik", { id: "kocm-katalogda-yok" }], ["g: üretilmiş", { id: "g:eski:1", gen: 1 }], ["AI kaynaklı", { id: "ai-eski-1", src: "ai" }], ["eski (numaralı) kimlik", { id: "q12345" }], ["görselli", { id: kk(7), fig: 1 }]];
{ sifirla(); const { c, p } = await sade(); await onYukle(p);
  await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }, { id: kk(2), ts: BIRLIK(2) }, ...ELENEN.map(([, m], i) => ({ ...m, ts: BIRLIK(10 + i) }))]);
  const once = await mistDurum(p), r = await mist(p, "start"), sonra = await mistDurum(p), eski = await ESKIVAR(p);
  t("ELEME", "mistStart karışık 7 yanlış: yalnız katalogdaki 2'si (a01, a02) RUN'a girer; katalog dışı / g: / AI / eski / görselli 5'i elenir", r.run && r.n === 2 && esit(r.ids, [kk(2), kk(1)]) && aT(r, 2), JSON.stringify({ run: r.run, n: r.n, ids: r.ids }));
  t("ELEME", "elenen sayı kullanıcıya bildirilir (5 yanlış katalogda bulunamadı/uygun değil)", uyar(r, 5), JSON.stringify(r.toast));
  t("ELEME", "yanlış kayıtları SİLİNMEZ ve DEĞİŞMEZ (7 kayıt, aynı içerik); anlık görüntü RUN/ake.run'a kopyalanmaz", once === sonra && JSON.parse(sonra) && Object.keys(JSON.parse(sonra)).length === 7 && !eski, JSON.stringify({ ayni: once === sonra, eski }));
  await c.close(); }
for (const [ad, m] of ELENEN) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ ...m, ts: BIRLIK(5) }]); const once = await mistDurum(p), r = await mist(p, "one", m.id), sonra = await mistDurum(p);
  t("ELEME", `mistOne ${ad}: RUN AÇILMAZ, sunucu oturumu isteği yok, yerel (cevaplı) set yok; 1 yanlışın uygun olmadığı bildirilir; kayıt silinmez`, !r.run && D.istekler.length === 0 && D.kota === 0 && uyar(r, 1) && once === sonra && sonra.includes(JSON.stringify(m.id)), JSON.stringify({ run: r.run, ist: D.istekler.length, toast: r.toast.slice(-2), ayni: once === sonra }));
  await c.close();
}
for (const [kind, ad] of [["start", "mistStart"], ["due", "mistDue"]]) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, ELENEN.map(([, m], i) => ({ ...m, ts: BIRLIK(5 + i) }))); const once = await mistDurum(p), r = await mist(p, kind), sonra = await mistDurum(p);
  t("ELEME", `${ad}: hiçbiri uygun değilse (5 elenen) RUN AÇILMAZ, oturum isteği yok, yerel set yok, sayı bildirilir, kayıtlar korunur`, !r.run && D.istekler.length === 0 && D.kota === 0 && uyar(r, 5) && once === sonra, JSON.stringify({ run: r.run, ist: D.istekler.length, toast: r.toast.slice(-2) }));
  await c.close();
}
{ sifirla(); D2.kes = { [S1]: 0 }; const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: km(1), s: S1, t: "Mini " + S1, ts: BIRLIK(1) }, { id: kk(1), ts: BIRLIK(2) }]); const r = await mist(p, "start");
  t("ELEME", "o dersin katalogu boşsa (D2.kes) o dersin yanlışı elenir: yalnız diğer dersin 1 sorusu açılır; yerel dolgu yok", r.run && esit(r.ids, [kk(1)]) && aT(r, 1) && uyar(r, 1), JSON.stringify({ ids: r.ids, toast: r.toast.slice(-2) }));
  await c.close(); }

/* =====================  HATA / KISMİ YANIT  ===================== */
for (const [mod, bek] of [["401", /giriş/i], ["402", /ücretsiz sorun bitti/i], ["404", /kapalı|hizmet/i], ["500", /yanıt vermiyor|sunucu/i], ["banka_yok", /hazır değil/i], ["ag", /bağlantı/i], ["bos", /sunamadı/i], ["429", /sık/i]]) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 5)); D.oturum = mod; const r = await mist(p, "start"), sonra = await mistAnahtar(p), govde = await modalGovde(p);
  const ileti = (r.modal + " " + govde + " " + r.toast.join(" ")), ayniAnahtar = new Set(D.istekler.map(x => x.istek)).size === 1, say = mod === "ag" ? D.istekler.length >= 1 : D.istekler.length === 1;
  t("HATA", `sunucu oturumu ${mod}: RUN AÇILMAZ, yerel (cevaplı) set/fallback yok, yerel kota yok, ai yok; beklenen geri bildirim (modal başlığı+gövdesi/toast) görünür; ikinci hak düşümü yok (tek oturum isteği${mod === "ag" ? "; ağ hatasında tarayıcı katmanı yeniden deneyebilir → ≥1 istek, HEPSİ AYNI istek anahtarıyla" : ""}); yanlış kayıtları korunur`, !r.run && r.yerelN === 0 && D.kota === 0 && D.ai === 0 && say && ayniAnahtar && bek.test(ileti) && sonra.length === 5, JSON.stringify({ run: r.run, modal: r.modal, govde: govde.slice(0, 60), toast: r.toast.slice(-2), ist: D.istekler.length, aynı: ayniAnahtar, kota: D.kota }));
  await c.close();
}
for (const [mod, bek] of [["ilkEksik", 9], ["kismi5", 5]]) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10); D.oturum = mod; const r = await mist(p, "start"), sonra = await mistAnahtar(p);
  t("HATA", `kısmi yanıt (${mod}): yalnız sunucunun verdiği ${bek} soruyla açılır, 'sunucudan alınamadı' bildirimi, eksikler yerel DOLDURULMAZ, 0 cevap/çözüm; yanlış kayıtları (10) silinmez`, aT(r, bek) && r.toast.some(m => /sunucudan alınamadı/.test(m)) && r.bankN === 0 && r.genN === 0 && sonra.length === 10, JSON.stringify({ run: r.run, n: r.n, sv: r.svN, toast: r.toast.slice(-2), kayit: sonra.length }));
  await c.close();
}

/* =====================  KOTA (ücretsiz kullanıcı: sunucunun pratik soru kotası)  ===================== */
{ sifirla(); D4.kota = { kalan: 7 }; const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const r = await mist(p, "start"); const kalan = await p.evaluate(() => (HESAP.ucr || {}).kalanSoru);
  t("KOTA", "sunucu pratik kotası uygulanır: oturum yanıtındaki kalan=7 istemci kotasına (kalanSoru) işlenir; yerel kota isteği (POST /api/hesap/kota) YOK", r.run && r.gvn === "studyo" && kalan === 7 && D.kota === 0, JSON.stringify({ run: r.run, gvn: r.gvn, kalan, kota: D.kota }));
  await c.close(); }
{ sifirla(); D.oturum = "402"; const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const r = await mist(p, "start"); const bir = D.istekler.length; await mistCagir(p, "start"); await p.waitForTimeout(800);
  t("KOTA", "402: limit penceresi ('Bugünkü ücretsiz sorun bitti'); RUN yok; yerel fallback yok; yerel kota isteği yok; ilk denemede tek oturum isteği", !r.run && /ücretsiz sorun bitti/i.test(r.modal) && bir === 1 && D.kota === 0 && r.yerelN === 0, JSON.stringify({ run: r.run, modal: r.modal, ist: bir, kota: D.kota }));
  await c.close(); }

/* =====================  KATALOG BEKLEME / GİRİŞ / KATALOG HATASI  ===================== */
for (const [kind, ad] of KINDS) {
  sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, N10.slice(0, 3)); D2.tut = G;
  await mistCagir(p, kind, kk(2)); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(400); const r1 = await ozet(p); G.ac(); await hazirBekle(p, 5000); await p.waitForTimeout(900); const r2 = await ozet(p);
  t("KATALOG", `${ad}: katalog yüklenirken YEREL RUN AÇILMAZ ('yükleniyor' bildirimi); hazır olunca güvenli RUN (gvn=studyo, katalog kimlikleri, sunucu oturumlu)`, !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && r2.run && r2.gvn === "studyo" && hepsiKatalogda(r2.ids, KS) && r2.svN === r2.n && r2.yerelN === 0, JSON.stringify({ r1: r1.run, toast: r1.toast.slice(-2), r2: r2.run, gvn: r2.gvn, n: r2.n }));
  await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, giris: false, hash: "#yanlislar" }); await mistKur(p, N10.slice(0, 3)); const r = await mist(p, "start");
  t("KATALOG", "giriş yok: yanlış tekrarı YEREL açılmaz; giriş modalı çıkar; katalog/oturum isteği yok", !r.run && /giriş/i.test(r.modal) && D.istekler.length === 0 && D2.katIstek === 0, JSON.stringify({ run: r.run, modal: r.modal, ist: D.istekler.length, kat: D2.katIstek }));
  await c.close(); }
{ sifirla(); D2.kat = "500"; const { c, p } = await sade(); await hazirBekle(p, 5000); await mistKur(p, N10.slice(0, 3)); await git(p, "#yanlislar"); const r = await mist(p, "start");
  t("KATALOG", "katalog yüklenemedi (500): yanlış tekrarı YEREL açılmaz; açık bildirim; oturum/kota isteği yok", !r.run && r.toast.length > 0 && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ run: r.run, toast: r.toast.slice(-2), ist: D.istekler.length }));
  await c.close(); }

/* =====================  ESKİ RUN  ===================== */
for (const [kind, ad] of KINDS) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await eskiRunKur(p, null); const o0 = await ozet(p); await mistCagir(p, kind, kk(2)); await p.waitForTimeout(700); const r = await ozet(p);
  t("ESKİ", `${ad}: mevcut İŞARETSİZ (eski yerel) RUN ezilmez (aynı kimlik, cevaplar korunur), 'Yarım kalan eski oturum' uyarısı, değiştirme penceresi AÇILMAZ, sunucu oturumu açılmaz`, o0.run && r.run && r.id === o0.id && r.ans === o0.ans && !r.modal && D.istekler.length === 0 && r.toast.some(m => /Yarım kalan eski/.test(m)), JSON.stringify({ ayniId: r.id === o0.id, ans: [o0.ans, r.ans], modal: r.modal, ist: D.istekler.length, toast: r.toast.slice(-2) }));
  await c.close();
}
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await eskiRunKur(p, "studyo"); const o0 = await ozet(p); await mistCagir(p, "start"); await p.waitForTimeout(600); const r = await ozet(p);
  t("ESKİ", "mevcut İŞARETLİ (güvenli) RUN: 'Yarım kalan oturum var' penceresi; onaylanmadan RUN/cevaplar korunur, sunucu oturumu açılmaz", r.run && r.id === o0.id && r.ans === o0.ans && /Yarım kalan oturum/.test(r.modal) && D.istekler.length === 0, JSON.stringify({ modal: r.modal, ist: D.istekler.length }));
  await tikla(p, '[data-a="runReplace"]'); await p.waitForTimeout(900); const r2 = await ozet(p);
  t("ESKİ", "'Yenisini başlat' onayından sonra güvenli yanlış tekrarı RUN'ı açılır (3 soru, sunucu oturumlu, gvn=studyo, kind='mistakes', 0 cevap/çözüm)", aT(r2, 3) && r2.id !== o0.id, JSON.stringify({ run: r2.run, n: r2.n, gvn: r2.gvn, kind: r2.kind }));
  await c.close(); }

/* =====================  YARIŞLAR (oturum yanıtı BEKLETİLİR; ön koşul: istek gerçekten uçuşta)  ===================== */
for (const [kind, ad] of KINDS) {
  sifirla(); const G = kapiYap(); D4.oturumTut = G; const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3));
  await mistCagir(p, kind, kk(2)); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await hesapDegis(c, p, "kulB"); G.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("YARIŞ", `${ad}: oturum isteği uçuştayken hesap kul1→kulB: eski yanıt kulB'de RUN AÇAMAZ (kul1 kimliği yok), kota/ai yok`, pre === 1 && !(r.run && r.ids.some(i => KS.has(i))) && D.kota === 0, JSON.stringify({ pre, run: r.run, a: r.ids.filter(i => KS.has(i)).length, kota: D.kota }));
  await c.close();
}
{ sifirla(); const G = kapiYap(); D4.oturumTut = G; const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3));
  await mistCagir(p, "start"); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await hesapDegis(c, p, "kulB"); await hesapDegis(c, p, "kul1"); G.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("YARIŞ", "A→B→A: uçuştaki eski oturum yanıtı yeni (aynı kimlikli) oturumda RUN AÇAMAZ (işlem nesli iki kez değişti)", pre === 1 && !r.run && D.kota === 0, JSON.stringify({ pre, run: r.run, n: r.n }));
  await c.close(); }
{ sifirla(); const G = kapiYap(), K = kapiYap(); D4.oturumTut = G; D3.cikisTut = K; const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3));
  await mistCagir(p, "start"); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G.ac(); K.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("YARIŞ", "oturum isteği uçuştayken ÇIKIŞ: eski yanıt RUN AÇAMAZ; çıkış bitince de açılmaz", pre === 1 && !r.run, JSON.stringify({ pre, run: r.run, n: r.n }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, N10.slice(0, 3)); D2.tut = G;
  await mistCagir(p, "start"); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p); await hesapDegis(c, p, "kulB"); G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken hesap kul1→kulB: bekleyen yanlış tekrarı eylemi RUN AÇAMAZ (ön koşul: beklerken 'yükleniyor' görüldü, RUN yok)", !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && !(r.run && r.ids.some(i => KS.has(i))), JSON.stringify({ r1: r1.run, toast: r1.toast.slice(-2), r: r.run }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); D3.cikisTut = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, N10.slice(0, 3)); D2.tut = G;
  await mistCagir(p, "start"); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p); await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G.ac(); D3.cikisTut.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken ÇIKIŞ: bekleyen yanlış tekrarı eylemi RUN AÇAMAZ (ön koşul: beklerken 'yükleniyor', RUN yok)", !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && !r.run, JSON.stringify({ r1: r1.run, toast: r1.toast.slice(-2), r: r.run }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const r = await mist(p, "start"); await hesapDegis(c, p, "kulB"); const rB = await ozet(p);
  const sz = await p.evaluate(() => JSON.stringify([S.mistakes, S.exams, localStorage.getItem("ake.run") || "", RUN]).includes("kat-a-koc"));
  t("YARIŞ", "güvenli RUN açıkken hesap kulB'ye geçilince: A'nın RUN'ı ve yanlış kayıtları B'de yok (ön koşul: A'da güvenli RUN açıldı)", aT(r, 3) && !rB.run && !sz, JSON.stringify({ rA: r.run, gvn: r.gvn, rB: rB.run, sz }));
  await c.close(); }

/* =====================  BİTİŞ: cevap → tekrar ilerlemesi → bitirme  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p);
  await mistKur(p, [{ id: kk(1), ts: BIRLIK(1), ok: 0 }, { id: kk(2), ts: BIRLIK(2), ok: 2 }, { id: kk(3), ts: BIRLIK(3), due: false }, { id: kk(4), ts: BIRLIK(4), n: 2 }]);
  const once = await p.evaluate(() => ({ topN: (S.topic["mat|KOC-ANA"] || [0, 0, 0]).slice(), gun: (S.daily[dayKey()] || { q: 0 }).q, n4: S.mistakes["kat-a-koc-a04"].n }));
  const r = await mist(p, "start"); const sira = r.ids.slice();
  const cevap = await p.evaluate(async (ids) => { const gec = async i => { for (let j = 0; j < 40 && !RUN.rev[i]; j++) await new Promise(r => setTimeout(r, 50)); };
    const dogru = { "kat-a-koc-a01": 1, "kat-a-koc-a02": 1, "kat-a-koc-a03": 1, "kat-a-koc-a04": 0 };
    for (const id of ids) { const i = RUN.qs.findIndex(q => q.id === id); moveTo(i); pickAnswer(dogru[id]); await gec(i); }
    return { rev: RUN.rev.filter(Boolean).length, aN: RUN.qs.filter(q => Number.isInteger(q.a)).length }; }, [kk(1), kk(2), kk(3), kk(4)]);
  const s = await p.evaluate(() => ({ m1: S.mistakes["kat-a-koc-a01"], m2: S.mistakes["kat-a-koc-a02"], m3: S.mistakes["kat-a-koc-a03"], m4: S.mistakes["kat-a-koc-a04"], gun: (S.daily[dayKey()] || { q: 0 }).q, ts: dayKey(), d1: gunSonra(3) }));
  t("BİTİŞ", "tekrar ilerlemesi (kimlik üzerinden): zamanı gelen doğru → ok 0→1 + sonraki tekrar günü 3 gün sonra; ok 2 + doğru → learned; zamanı gelmemiş doğru → ilerlemez; yanlış → n+1, ok=0, açık kalır", s.m1.ok === 1 && s.m1.dk === s.d1 && !s.m1.learned && s.m2.learned === true && s.m3.ok === 0 && s.m3.learned === false && s.m4.n === once.n4 + 1 && s.m4.ok === 0 && s.m4.learned === false, JSON.stringify({ m1: [s.m1.ok, s.m1.dk === s.d1], m2: s.m2.learned, m3: [s.m3.ok, s.m3.learned], m4: [s.m4.n, once.n4 + 1, s.m4.ok] }));
  t("BİTİŞ", "her cevapta sunucu /api/soru/cevap çağrılır (4 çağrı) ve anahtar YALNIZ cevaplanan sorular için gelir; günlük soru sayacı +4", sira.length === 4 && D.cevap === 4 && cevap.rev === 4 && cevap.aN === 4 && s.gun - once.gun === 4, JSON.stringify({ n: sira.length, cevap: D.cevap, rev: cevap.rev, aN: cevap.aN, dgun: s.gun - once.gun }));
  await bitirTikla(p); await bekle(() => D.bitirler.length >= 1, 3000); await p.waitForTimeout(500); const rb = await ozet(p), s2 = await mistDurum(p);
  t("BİTİŞ", "bitirme: /api/soru/bitir 1 kez (yanlış tekrarı oturumu), RUN temizlenir (ake.run yok); ilerleme kayıtları korunur (yanlış kayıtları aynı)", D.bitirler.length === 1 && !rb.run && rb.lsId === null && JSON.parse(s2)[kk(2)].learned === true && JSON.parse(s2)[kk(1)].ok === 1, JSON.stringify({ bitir: D.bitirler.length, run: rb.run, ls: rb.lsId }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1), n: 3 }]); await mist(p, "one", kk(1));
  await p.evaluate(async () => { pickAnswer(1); for (let j = 0; j < 40 && !RUN.rev[0]; j++) await new Promise(r => setTimeout(r, 50)); }); const s = await p.evaluate(() => ({ ok: S.mistakes["kat-a-koc-a01"].ok, dk: S.mistakes["kat-a-koc-a01"].dk, bugun: dayKey() }));
  t("BİTİŞ", "mistOne doğru cevap: sunucu /cevap 1 kez; tekrar ilerler (ok=1, ertesi tekrar günü bugünden sonra)", D.cevap === 1 && s.ok === 1 && s.dk > s.bugun, JSON.stringify({ cevap: D.cevap, ok: s.ok }));
  await c.close(); }

/* =====================  DOM: gerçek düğmeler (bayrak AÇIK)  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await git(p, "#yanlislar"); const tk = await tikla(p, `[data-a="mistOne"][data-id="${kk(2)}"]`), r = await ozet(p);
  t("DOM", "Tekrar ekranı 'Çöz' (mistOne) düğmesi: güvenli RUN (gvn=studyo, 1 sunucu oturumlu soru, 0 cevap/çözüm)", tk && aT(r, 1) && r.ids[0] === kk(2), JSON.stringify({ tk, run: r.run, gvn: r.gvn, n: r.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await git(p, "#yanlislar"); const tk = await tikla(p, '[data-a="mistStart"]'), r = await ozet(p);
  t("DOM", "Tekrar ekranı 'Hepsini çöz' (mistStart) düğmesi: güvenli RUN (gvn=studyo, 3 sunucu oturumlu soru, 0 cevap/çözüm)", tk && aT(r, 3), JSON.stringify({ tk, run: r.run, gvn: r.gvn, n: r.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await git(p, "#yanlislar"); const tk = await tikla(p, '[data-a="mistDue"]'), r = await ozet(p);
  t("DOM", "Tekrar ekranı 'Bugün tekrar zamanı gelen … soruyu çöz' (mistDue) düğmesi: güvenli RUN (gvn=studyo, 3 soru)", tk && aT(r, 3), JSON.stringify({ tk, run: r.run, gvn: r.gvn, n: r.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await git(p, ""); const tk = await tikla(p, '.gtask [data-a="mistDue"]'), r = await ozet(p);
  t("DOM", "Ana sayfa günlük program 'Yanlış tekrarı → Başla' (mistDue) düğmesi: güvenli RUN (gvn=studyo, 3 soru)", tk && aT(r, 3), JSON.stringify({ tk, run: r.run, gvn: r.gvn, n: r.n }));
  await c.close(); }

/* =====================  KAPSAM DIŞI (DEĞİŞMEZ; GÜVENLİ İLAN EDİLMEZ)  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); await git(p, "#yanlislar"); await p.waitForTimeout(300);
  const g = await p.evaluate(() => ({ dogru: /Doğru cevap:/.test(document.body.innerHTML), eskiMetin: /ESKI-SNAPSHOT/.test(document.body.innerHTML) }));
  t("KAPSAM", "vMistakes listesi (KAPSAM DIŞI, güvenli ilan edilmez): açık yanlış satırında 'Doğru cevap' yerel anlık görüntüden gösterilmeye devam eder", g.dogru && g.eskiMetin, JSON.stringify(g));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); await p.evaluate(([s, tp]) => { S.topic[s + "|" + tp] = [2, 8, 0]; render(); }, [S0, TA]); await git(p, "#koc");
  await p.evaluate(([s, tp]) => { ACT.kocAc({ s, t: tp }); }, [S0, TA]); await p.waitForTimeout(400); const g = await p.evaluate(() => /Senin yanlışların/.test(document.body.innerHTML) && /ESKI-SNAPSHOT/.test(document.body.innerHTML));
  t("KAPSAM", "koçun 'Senin yanlışların' bölümü (KAPSAM DIŞI): yerel anlık görüntüyü göstermeye devam eder; 3C-4f bunu değiştirmez", g === true, String(g));
  await c.close(); }

console.log(`\nTOPLAM: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) { console.log("KIRMIZI:"); kirmizi.forEach(k => console.log("  - " + k)); }
await b.close(); srv.close(); process.exit(kalan > 0 ? 1 : 0);
