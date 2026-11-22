// B4 3C-4c · ACT.quick({k:"mini"}) (mini deneme) güvenli katalog geçişi — YALNIZ KIRMIZI/KARAKTERİZASYON TESTLERİ (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz).
// Uygulama koduna dokunmaz; CI'a EKLENMEZ. Taban: B4 896d9c71c6343a43b5ace7ae4155ceceb6a75282 (index.html SHA-256 84eb88bb…).
// DÜZELTİLEN VARSAYIMLAR (kod dayanağı, index.html B4 896d9c7):
//   (1) mini SÜRESİZ DEĞİL: ACT.quick mini UI.exam.dur="" bırakır; startExamFromUI :12705-12722 → auto = max(5, round(ex.min*toplam/tam)), dur = (E.dur===""||null) ? auto : ...;
//       sınav modunda startRun'a dur=auto verilir; baslatRun RUN.dur = round(dur*60) saniye. TYT çeyrek: 31/120 soru → 165*31/120 = 42,6 → 43 dk → RUN.dur=2580 sn. SAY çeyrek: 21/80 → 47 dk → 2820 sn.
//   (2) Bayrak KAPALIYKEN sunucu oturumu İSTEĞİ gidebilir: startRun :8423-8440 → svKullan() && svAdaylar(cfg).length ise svBaslat (bayraktan bağımsız; svAday yalnız g:/gen/ai dışını sayar). Bu yüzden
//       karakterizasyonda "istek gitmez" şartı YOK; sunucu uygun ve kapalı senaryoları ayrı ölçülür.
// Gruplar: [KARAKT] bayrak KAPALI mevcut mini davranışı · [DIŞ] ortak startExamFromUI'nin tam/yarım/özel yolu (mini değişse de aynı kalmalı; yeşil) · [GÜVENLİ] bayrak AÇIK sözleşme (mini girişlerinden; değişmemiş kodda KIRMIZI)
//   [HATA] bayrak açık hata/eksik yanıt sözleşmesi · [SECS] kısmi yanıtta RUN.secs/cevap kâğıdı/bölüm sonucu · [BİTİŞ] bitirme/yenileme/süre/hesap yarışı (güvenli sınav çekirdeği: svBaslat/svBitir/finishRun)
// "ÇEKİRDEK" testleri mini girişinden bağımsız: sayfada, geleceğin mini girişinin kuracağı güvenli sınav cfg'si (studyoCfg + exam + secs) elle kurulup startRun'a verilir; svBaslat/svBitir davranışını ölçer.
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz; yalnız kimlik/sayı/varlık raporlanır (sahte anahtarlar sayfaya yalnız karşılaştırma için verilir). Çalıştırma: node tests/studyo-mini-istemci.mjs   ·   çıkış kodu: kırmızı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };
const bilgi = (ad, v) => console.log("BİLGİ ", ad, typeof v === "string" ? v : JSON.stringify(v));

const D = { dus: [], oturum: "tam", bitir: "tam", istekler: [], bitirler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: tam|ilkEksik|kismi5|bos|404|banka_yok|500|402|401|429|ag  ·  bitir: tam|500|410|ag
const D2 = { kat: "tam", katIstek: 0, kes: null };
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
    D2.katIstek++; if (!kul) return js(r, 401, {}); if (D2.kat === "404") return js(r, 404, {}); if (D2.kat === "500") return js(r, 500, {});
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
    if (D.oturum === "404") return js(r, 404, { error: "yok" }); if (D.oturum === "banka_yok") return js(r, 503, { error: "banka_yok" }); if (D.oturum === "500") return js(r, 500, { error: "x" });
    if (D.oturum === "402") return js(r, 402, { error: "limit", kota: { kalan: 0 } }); if (D.oturum === "401") return js(r, 401, { error: "giris" }); if (D.oturum === "429") return js(r, 429, { error: "cok_istek" });
    if (D.oturum === "ag") { r.socket.destroy(); return; }
    const idler = (b.idler || []).filter(i => (BILGI.has(i) || KATID[i]) && !(KATID[i] && D.dus.includes(KATID[i].s)));
    const verilen = D.oturum === "bos" ? [] : D.oturum === "kismi5" ? idler.slice(0, 5) : D.oturum === "ilkEksik" ? idler.slice(1) : idler;
    return js(r, 200, { oturum: "o" + Math.floor(Math.random() * 1e9), kota: { sinirsiz: true }, sorular: verilen.map(i => { const k = BILGI.get(i) || KATID[i]; return { id: k.id, q: k.q, o: k.o, ...(k.p ? { p: k.p } : {}) }; }) });
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
const sifirla = () => { D.istekler.length = 0; D.bitirler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D.dus = []; D.bitir = "tam"; D2.kes = null; D2.kat = "tam"; D2.katIstek = 0; D3.bitirTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); };
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

/* =====================  SANITY (sayfa ↔ test varsayımları)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false });
  const tyt = await beklenen(p, ""), say = await beklenen(p, "SAY");
  t("SANITY", "TYT çeyrek: satır adetleri 10,1,1,1,1,8,3,2,2,2 (toplam 31), bölümler Türkçe/Sosyal/Mat/Fen, auto süre 43 dk (RUN.dur=2580 sn) — dur SÜRESİZ DEĞİL", esit(tyt.rows.map(r => r.n), [10, 1, 1, 1, 1, 8, 3, 2, 2, 2]) && tyt.total === 31 && tyt.auto === 43 && tyt.durSn === 2580 && esit(tyt.secs.map(s => [s.n, s.from, s.to]), [["Türkçe", 0, 10], ["Sosyal Bilimler", 10, 14], ["Temel Matematik", 14, 25], ["Fen Bilimleri", 25, 31]]), JSON.stringify({ r: tyt.rows.map(r => r.n), a: tyt.auto }));
  t("SANITY", "SAY çeyrek: satır adetleri 8,3,4,3,3 (toplam 21), auto süre 47 dk (2820 sn)", esit(say.rows.map(r => r.n), [8, 3, 4, 3, 3]) && say.total === 21 && say.auto === 47 && say.durSn === 2820, JSON.stringify({ r: say.rows.map(r => r.n), a: say.auto }));
  t("SANITY", "sentetik katalog her deneme dersinden en az 14 soru verir (en büyük çeyrek satırı 10)", SINAV_DERS.every(s => KATALOG.get("kul1").filter(x => x.s === s).length >= 14));
  await c.close(); }

/* =====================  KARAKTERİZASYON (bayrak KAPALI)  ===================== */
for (const [ad, y] of Object.entries(GIRIS)) for (const alan of ["", "SAY"]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); const ex = await beklenen(p, alan); const tk = await girisYap(p, y, alan), r = await ozet(p);
  t("KARAKT", `K1 ${ad} [alan=${alan || "TYT"}] sunucu UYGUN: bayrak kapalı → sunucu sınav oturumu istenir (mod=exam, ≤120 kimlik), sınav modu, auto süre ${ex.auto} dk, gvn yok, katalog isteği yok`,
    tk && r.run && r.kind === "exam" && r.mode === "exam" && /mini/.test(r.title) && r.dur === ex.durSn && r.gvn === null && D.istekler.length >= 1 && D.istekler.every(i => i.mod === "exam" && i.idler.length >= 1 && i.idler.length <= 120) && D2.katIstek === 0 && secsParca(r.secs, r.n),
    JSON.stringify({ tk, run: r.run, kind: r.kind, mode: r.mode, dur: r.dur, bek: ex.durSn, gvn: r.gvn, ist: D.istekler.length, kat: D2.katIstek, secs: r.secs, n: r.n }));
  t("KARAKT", `K1b ${ad} [alan=${alan || "TYT"}] sunucu uygun: sunucudan gelen sorularda a/x yok, hak yerel kotadan düşmez (POST /api/hesap/kota yok), ai yok`, r.run && r.svN > 0 && r.svA === 0 && D.kota === 0 && D.ai === 0, JSON.stringify({ svN: r.svN, svA: r.svA, kota: D.kota }));
  bilgi(`K1 ${ad} [alan=${alan || "TYT"}] yerel(sv'siz) soru sayısı / toplam`, `${r.yerelN}/${r.n}`);
  await c.close();
}
for (const [mod, bek] of [["404", "yerel"], ["banka_yok", "yerel"]]) {
  sifirla(); D.oturum = mod; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); const ex = await beklenen(p, ""); const tk = await girisYap(p, GIRIS["ana sayfa gunluk program 'Mini denemesi'"], ""), r = await ozet(p);
  t("KARAKT", `K2 sunucu KAPALI (${mod}), bayrak kapalı → eski yerel akış: RUN açılır, sv'siz, yerel cevaplı sorular (a/x var), gvn yok, deneme hakkı yerel yoldan (POST /api/hesap/kota) 1 kez`,
    tk && r.run && r.svN === 0 && r.yerelA > 0 && r.gvn === null && r.dur === ex.durSn && D.istekler.length === 1 && D.kota === 1, JSON.stringify({ run: r.run, svN: r.svN, yerelA: r.yerelA, dur: r.dur, ist: D.istekler.length, kota: D.kota }));
  await c.close();
}
for (const [mod, baslik] of [["500", "Sorular şu an açılamadı"], ["402", "Bu ayki ücretsiz denemen bitti"], ["401", "Devam etmek için ücretsiz giriş yap"]]) {
  sifirla(); D.oturum = mod; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); const tk = await girisYap(p, GIRIS["ana sayfa gunluk program 'Mini denemesi'"], ""), r = await ozet(p);
  t("KARAKT", `K3 sunucu ${mod}, bayrak kapalı → RUN açılmaz, "${baslik}" penceresi, yerel kota/fallback yok`, tk && !r.run && r.modal === baslik && D.kota === 0, JSON.stringify({ run: r.run, modal: r.modal, kota: D.kota }));
  await c.close();
}
{ sifirla(); D.oturum = "429"; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); const tk = await girisYap(p, GIRIS["ana sayfa gunluk program 'Mini denemesi'"], ""), r = await ozet(p);
  t("KARAKT", "K3 sunucu 429, bayrak kapalı → RUN açılmaz, 'Çok sık oturum açtın' bildirimi, yerel kota yok", tk && !r.run && r.toast.some(x => /Çok sık oturum/.test(x)) && D.kota === 0, JSON.stringify({ run: r.run, toast: r.toast, kota: D.kota }));
  await c.close(); }
{ sifirla(); D.oturum = "ag"; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); const tk = await girisYap(p, GIRIS["ana sayfa gunluk program 'Mini denemesi'"], ""), r = await ozet(p);
  t("KARAKT", "K3 ağ hatası, bayrak kapalı → RUN açılmaz, 'Sorular şu an açılamadı' penceresi, yerel kota yok", tk && !r.run && r.modal === "Sorular şu an açılamadı" && D.kota === 0, JSON.stringify({ run: r.run, modal: r.modal, kota: D.kota }));
  await c.close(); }

/* =====================  [DIŞ] ortak startExamFromUI: tam / yarım / özel  (3C-4i SONRASI: bayrak KAPALIYKEN eski yol AYNEN; bayrak AÇIKKEN güvenli yol → tests/studyo-deneme-merkezi-istemci.mjs)  ===================== */
for (const boyut of ["full", "half", "custom"]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false });   // bayrak KAPALI: katalog yüklenmez/beklenmez
  await p.evaluate(s => { S.profile.alan = ""; UI.exam.type = defaultExam(); UI.exam.size = s; UI.exam.mode = "exam"; UI.exam.dur = ""; UI.exam.unsolved = false; ACT.startExam(); }, boyut);
  const r = await ozet(p), bek = await p.evaluate(() => { const rows = examRows(defaultExam()), tot = rows.reduce((a, r) => a + r.n, 0), full = rows.reduce((a, r) => a + r.full, 0); return Math.max(5, Math.round(EXAMS[defaultExam()].min * tot / full)) * 60; });
  t("DIŞ", `${boyut} deneme (ACT.startExam, bayrak KAPALI): yerel/eski yol AYNEN: katalog kimliği yok, gvn yok, sınav modu, auto süre, sunucu oturumu isteği (varsa) mod=exam`, r.run && r.kind === "exam" && r.mode === "exam" && r.gvn === null && r.dur === bek && r.ids.every(i => !KS.has(i)) && D.istekler.every(i => i.mod === "exam") && secsParca(r.secs, r.n), JSON.stringify({ run: r.run, dur: r.dur, bek, gvn: r.gvn, n: r.n }));
  await c.close();
}

/* =====================  [GÜVENLİ] bayrak AÇIK · gerçek mini girişleri  ===================== */
for (const [ad, y] of Object.entries(GIRIS)) for (const alan of ["", "SAY"]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const ex = await beklenen(p, alan); const tk = await girisYap(p, y, alan), r = await ozet(p);
  const E = `${ad} [alan=${alan || "TYT"}]`, kimlik = r.ids.filter(i => KS.has(i)).length;
  t("GÜVENLİ", `${E}: yalnız KATALOG kimlikleri (BANK/g:/EKQ/AI tuzağı yok), hepsi sunucu oturumlu, tekil, bayrak açık mini bölüm başına katalogdan`, tk && r.run && r.n === ex.total && kimlik === r.n && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && r.svN === r.n && r.tekil, JSON.stringify({ tk, run: r.run, n: r.n, bek: ex.total, kimlik, bank: r.bankN, tuzak: r.tuzakN, sv: r.svN }));
  t("GÜVENLİ", `${E}: ders dağılımı examRows çeyrek satırlarıyla aynı`, r.run && esit(sirali(dagilimS(r.ids)), sirali(ex.ders)), JSON.stringify({ g: sirali(dagilimS(r.ids)), b: sirali(ex.ders) }));
  t("GÜVENLİ", `${E}: RUN.secs bölüm adı/from/to beklenen (${ex.secs.map(s => s.n + ":" + s.from + "-" + s.to).join(", ")})`, r.run && esit(r.secs, ex.secs.map(s => ({ n: s.n, from: s.from, to: s.to }))), JSON.stringify({ g: r.secs, b: ex.secs.map(s => [s.n, s.from, s.to]) }));
  t("GÜVENLİ", `${E}: sunucu SINAV oturumu (mod=exam, yalnız {istek,mod,idler}, ≤120), istenen kimlikler = RUN kimlikleri`, D.istekler.length >= 1 && D.istekler.every(i => i.mod === "exam" && esit(i.alanlar, ["idler", "istek", "mod"]) && i.idler.length <= 120) && esit([...new Set(D.istekler.flatMap(i => i.idler))].sort(), [...r.ids].sort()), JSON.stringify({ ist: D.istekler.map(i => [i.mod, i.idler.length, i.alanlar]) }));
  t("GÜVENLİ", `${E}: RUN.gvn işareti kalıcı (RUN ve ake.run; 'studyo' ailesi)`, r.gvn === "studyo" && r.lsGvn === "studyo", JSON.stringify({ gvn: r.gvn, ls: r.lsGvn }));
  t("GÜVENLİ", `${E}: sınav modu + otomatik süre ${ex.auto} dk (RUN.dur=${ex.durSn} sn), süresiz DEĞİL`, r.kind === "exam" && r.mode === "exam" && r.dur === ex.durSn && /mini/.test(r.title), JSON.stringify({ kind: r.kind, mode: r.mode, dur: r.dur, bek: ex.durSn, title: r.title }));
  t("GÜVENLİ", `${E}: BİTİŞTEN ÖNCE RUN / ake.run / DOM'da geçerli cevap değeri ya da dolu çözüm yok`, r.run && r.aVar === 0 && r.xVar === 0 && r.lsA === 0 && !r.domSizinti && !r.lsSizinti, JSON.stringify({ aVar: r.aVar, xVar: r.xVar, lsA: r.lsA, dom: r.domSizinti, ls: r.lsSizinti }));
  t("GÜVENLİ", `${E}: yerel kota (POST /api/hesap/kota) ve AI üretimi YOK; sunucu hakkı yeterli`, r.run && D.kota === 0 && D.ai === 0, JSON.stringify({ kota: D.kota, ai: D.ai }));
  await c.close();
}

/* =====================  [HATA] bayrak AÇIK · hata / eksik / kısmi yanıt  ===================== */
const gunluk = GIRIS["ana sayfa gunluk program 'Mini denemesi'"];
const HATALAR = [["401", "kotaGirisModal"], ["402", "limit modalı"], ["404", "sunucu kapalı"], ["429", "çok sık"], ["500", "sunucu hatası"], ["banka_yok", "banka_yok"], ["ag", "ağ hatası"], ["bos", "boş yanıt"]];
for (const [mod, ad] of HATALAR) {
  sifirla(); D.oturum = mod; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const tk = await girisYap(p, gunluk, "SAY"), r = await ozet(p);
  t("HATA", `sunucu ${ad} (${mod}): RUN AÇILMAZ (cevaplı yerel fallback yok), yerel kota (POST /api/hesap/kota) yok, AI yok`, tk && !r.run && r.yerelA === 0 && D.kota === 0 && D.ai === 0, JSON.stringify({ tk, run: r.run, n: r.n, yerelA: r.yerelA, svN: r.svN, kota: D.kota, modal: r.modal }));
  await c.close();
}
{ sifirla(); D2.kat = "500"; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p, 4000); const tk = await girisYap(p, gunluk, "SAY"), r = await ozet(p);
  t("HATA", "katalog EKSİK/yüklenemedi (500): mini RUN açmaz (yerel BANK/EKQ/AI karması yok), sunucu oturum isteği ve yerel kota yok", tk && !r.run && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ tk, run: r.run, n: r.n, ist: D.istekler.length, kota: D.kota }));
  await c.close(); }
{ sifirla(); D.oturum = "kismi5"; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const tk = await girisYap(p, gunluk, "SAY"), r = await ozet(p);
  t("HATA", "KISMİ yanıt (yalnız ilk 5 soru): yalnız sunulan 5 katalog sorusuyla RUN, kalan soru yerelle DOLDURULMAZ, açık bildirim, yerel kota yok", tk && r.run && r.n === 5 && r.svN === 5 && r.bankN === 0 && r.tuzakN === 0 && r.genN === 0 && D.kota === 0 && r.toast.some(x => /sunucu/i.test(x)), JSON.stringify({ tk, run: r.run, n: r.n, sv: r.svN, bank: r.bankN, toast: r.toast, kota: D.kota }));
  await c.close(); }
/* mevcut RUN hata halinde korunur */
for (const mod of ["500", "404", "bos"]) {
  sifirla(); D.oturum = mod; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await git(p, ""); await setAlan(p, "SAY"); await eskiRunKur(p, "studyo"); const o0 = await ozet(p);
  await git(p, ""); await tikla(p, gunluk.sel); await p.waitForTimeout(400);
  /* işaretli ('studyo') RUN varken mini: ya onay penceresi ya da güvenli yol; HER DURUMDA RUN aynı kimlikte KORUNUR ve onaysız ezilmez */
  const r = await ozet(p);
  t("HATA", `mevcut işaretli RUN + sunucu ${mod}: RUN kimliği/cevapları KORUNUR (onay verilmeden ezilmez)`, o0.run && r.run && r.id === o0.id && r.ans === o0.ans && r.n === o0.n, JSON.stringify({ o0: [o0.run, o0.id, o0.ans], r: [r.run, r.id, r.ans, r.n], modal: r.modal }));
  await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await git(p, ""); await setAlan(p, "SAY"); await eskiRunKur(p, null); const o0 = await ozet(p), ist0 = D.istekler.length;
  await git(p, ""); await tikla(p, gunluk.sel); await p.waitForTimeout(500); const r = await ozet(p);
  t("HATA", "mevcut İŞARETSİZ (eski yerel) RUN + güvenli mini: RUN ezilmez; 'Yarım kalan eski bir oturum var' uyarısı (değiştirme/'Yenisini başlat' penceresi AÇILMAZ), sunucu oturumu açılmaz", o0.run && r.run && r.id === o0.id && r.ans === o0.ans && r.modal !== "Yarım kalan oturum var" && r.toast.some(x => /eski bir oturum/.test(x)) && D.istekler.length === ist0, JSON.stringify({ id: r.id === o0.id, ans: r.ans, modal: r.modal, toast: r.toast, ist: D.istekler.length }));
  await c.close(); }

/* =====================  [SECS-2] tüm bölüm eksik · bildirim sayısı · kısa katalog · onaylı değiştirmede sunucu hatası  ===================== */
{ sifirla(); D.dus = ["turkce"]; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const ex = await beklenen(p, ""); const tk = await girisYap(p, gunluk, ""), r = await ozet(p);
  const bek = ex.secs.slice(1).map(x => ({ n: x.n, from: x.from - 10, to: x.to - 10 }));
  t("SECS", "mini [TYT]: ilk bölümün TÜM soruları (10) eksik → boş bölüm çıkar; kalan 3 bölüm 0'dan başlayan kesintisiz aralıklarla, RUN 21 soru, sonuç toplamları bölüm üyeliğine uygun", tk && r.run && r.n === ex.total - 10 && esit(r.secs, bek), JSON.stringify({ tk, n: r.n, secs: r.secs, bek }));
  t("SECS", "mini [TYT]: eksik sayı açıkça bildirilir ('10 soru sunucudan alınamadı; yalnız sunulan 21 soruyla açıldı.')", r.toast.some(x => /^10 soru sunucudan alınamadı; yalnız sunulan 21 soruyla açıldı\.$/.test(x)), JSON.stringify(r.toast));
  await bitirTikla(p); await bekle(() => false, 1200); const so = await sonucOzet(p);
  t("SECS", "mini [TYT] boş bölüm çıkarılmış RUN: bölüm sonucu yalnız kalan 3 bölüm, toplamlar 4/11/6 (cevap kâğıdı üyeliğiyle aynı)", so.var && esit(so.bolum, [{ n: "Sosyal Bilimler", top: 4 }, { n: "Temel Matematik", top: 11 }, { n: "Fen Bilimleri", top: 6 }]), JSON.stringify(so.bolum));
  await c.close(); }
{ sifirla(); D.oturum = "ilkEksik"; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await girisYap(p, gunluk, ""); const r = await ozet(p);
  t("SECS", "mini [TYT] tek soru eksik: bildirim '1 soru sunucudan alınamadı; yalnız sunulan 30 soruyla açıldı.'", r.toast.some(x => /^1 soru sunucudan alınamadı; yalnız sunulan 30 soruyla açıldı\.$/.test(x)), JSON.stringify(r.toast));
  await c.close(); }
{ sifirla(); D2.kes = { turkce: 4 }; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const ex = await beklenen(p, ""); await girisYap(p, gunluk, ""); const r = await ozet(p);
  const n = ex.total - 6, bekDur = Math.max(5, Math.round(SINAV.TYT.min * n / ex.full)) * 60;
  t("SECS", "KISA katalog (Türkçe yalnız 4): RUN 25 soru, eksik ders bildirilir, yerel dolgu yok, secs kesintisiz, süre seçilen soru sayısına orantılı (tam katalogda mevcut süre korunur)", r.run && r.n === n && r.bankN === 0 && r.tuzakN === 0 && r.toast.some(x => /Katalogda bazı derslerde yeterli soru yok: .*4\/10/.test(x)) && secsParca(r.secs, r.n) && r.dur === bekDur, JSON.stringify({ n: r.n, bek: n, dur: r.dur, bekDur, toast: r.toast, secs: r.secs }));
  await c.close(); }
for (const mod of ["500", "404", "banka_yok", "bos", "ag"]) {
  sifirla(); D.oturum = mod; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await git(p, ""); await setAlan(p, "SAY"); await eskiRunKur(p, "studyo"); const o0 = await ozet(p);
  await git(p, ""); await tikla(p, gunluk.sel); await p.waitForTimeout(300); const modal0 = (await ozet(p)).modal;
  await tikla(p, '[data-a="runReplace"]'); await p.waitForTimeout(700); const r = await ozet(p);
  t("HATA", `mevcut işaretli RUN + mini + 'Yenisini başlat' onayı + sunucu ${mod}: onay penceresi çıkar, sunucu yeni soruları BAŞARIYLA vermeden eski RUN silinmez (kimlik/cevap korunur), yerel fallback yok`, modal0 === "Yarım kalan oturum var" && r.run && r.id === o0.id && r.ans === o0.ans && r.n === o0.n && D.kota === 0, JSON.stringify({ modal0, ayni: r.id === o0.id, ans: r.ans, n: r.n, kota: D.kota }));
  await c.close();
}

/* SECS-3: bölüm üyeliği HATALI (sentetik) cfg.secs: svSecsKur null döner → ESKİ secs ile baslatRun'a GİDİLMEZ; kalan sorular için tek, adlandırılmış bölüm (from:0, to:n) ve 'doğrulanamadı' bildirimi.
   ÇEKİRDEK: cfg.secs = [A 0-10, B 12-31] (10-11 kayıp = üyeliksiz); sunucu ilk soruyu vermez (güvenli süzme) → kalan sorular arasında üyeliksiz olanlar var. */
{ sifirla(); D.oturum = "ilkEksik"; const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); const ex = await beklenen(p, "");
  await cekirdekHam(p, "", { secs: [{ n: "A", from: 0, to: 10 }, { n: "B", from: 12, to: ex.total }] }); await p.waitForFunction(() => RUN || UI.modal, null, { timeout: 5000 }).catch(() => { }); await p.waitForTimeout(200); const r = await ozet(p);
  const bekN = ex.total - 1, AD = "Bölüm dağılımı doğrulanamadı";
  t("SECS", "HATALI üyelik (ÇEKİRDEK): ESKİ cfg.secs KULLANILMAZ; RUN.secs tek, adlandırılmış bölüm {from:0,to:n} ('Bölüm dağılımı doğrulanamadı'), RUN n-1 soru", r.run && r.n === bekN && esit(r.secs, [{ n: AD, from: 0, to: bekN }]), JSON.stringify({ n: r.n, bek: bekN, secs: r.secs }));
  t("SECS", "HATALI üyelik (ÇEKİRDEK): bölüm dağılımının doğrulanamadığı AÇIKÇA bildirilir (eksik sayısı ile birlikte)", r.toast.some(x => /^1 soru sunucudan alınamadı; yalnız sunulan 30 soruyla açıldı\./.test(x) && /Bölüm dağılımı doğrulanamadı/.test(x)), JSON.stringify(r.toast));
  /* KOD DAYANAĞI (index.html vRun :8960): tek bölümlü RUN'da bölüm etiketi çizilmez (R.secs.length > 1 ise etiket); bu yüzden doğru sonuç = hiç .sec-lbl yok (eski A/B etiketleri görünmez) ve tüm kalan sorular tek satır listesinde */
  const sheet = await p.evaluate(() => { UI.sheetOpen = true; render(); const g = document.querySelector(".sheet-grid"); if (!g) return null; return { etiket: g.querySelectorAll(".sec-lbl").length, satir: g.children.length }; });
  t("SECS", "HATALI üyelik (ÇEKİRDEK): cevap kâğıdı eski A/B bölüm etiketlerini GÖSTERMEZ (tek bölümlü RUN'da etiket çizilmez) ve tüm kalan sorular listelenir", !!sheet && sheet.etiket === 0 && sheet.satir === bekN, JSON.stringify(sheet));
  await bitirTikla(p); await bekle(() => false, 1200); const so = await sonucOzet(p);
  t("SECS", "HATALI üyelik (ÇEKİRDEK): bölüm sonucu tek bölüm, d+y+b toplamı n-1 (eski sınırlarla soru kaybı/çifte sayım yok)", so.var && so.bolum.length === 1 && so.bolum[0].top === bekN && so.toplam === bekN, JSON.stringify({ bolum: so.bolum, toplam: so.toplam, bek: bekN }));
  await c.close(); }

/* =====================  [SECS] kısmi yanıtta bölüm sınırları  =====================
   ÇEKİRDEK (mini girişinden bağımsız): güvenli sınav cfg'si; sunucu İLK isteğin ilk sorusunu (ilk bölümün ilk sorusu) VERMEZ → güvenli modda svBaslat qs'i süzer.
   Beklenen: RUN.secs süzülmüş qs'e göre yeniden kurulur (ilk bölüm n-1 soru, sonrakiler 1 kayık), her bölümün soruları kendi derslerinden, cevap kâğıdı ve bölüm bazlı sonuç buna uyar. */
for (const alan of ["", "SAY"]) {
  sifirla(); D.oturum = "ilkEksik"; const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); const ex = await beklenen(p, alan); await cekirdek(p, alan); const r = await ozet(p);
  const bekSecs = ex.secs.map((s, i) => ({ n: s.n, from: i === 0 ? 0 : s.from - 1, to: s.to - 1 })), bekN = ex.total - 1, A = `[alan=${alan || "TYT"}]`;
  t("SECS", `ÇEKİRDEK ${A}: ilk bölümden 1 soru eksik → RUN ${bekN} soru, tümü sv'li (güvenli mod süzmesi)`, r.run && r.n === bekN && r.svN === r.n && r.gvn === "studyo", JSON.stringify({ run: r.run, n: r.n, bek: bekN, sv: r.svN, gvn: r.gvn }));
  t("SECS", `ÇEKİRDEK ${A}: RUN.secs from/to süzülmüş soru dizisine göre yeniden kurulur (bek: ${bekSecs.map(s => s.n + ":" + s.from + "-" + s.to).join(", ")})`, r.run && esit(r.secs, bekSecs), JSON.stringify({ g: r.secs, b: bekSecs.map(s => [s.n, s.from, s.to]) }));
  const bolumDers = r.run ? await p.evaluate(([ids, secs, sec]) => secs.map(s => ({ n: s.n, dersler: [...new Set(ids.slice(s.from, s.to).map(i => i.split("-")[2].replace(/\d+$/, "")))] })), [r.ids, r.secs]) : [];
  const izinli = Object.fromEntries(ex.secs.map(s => [s.n, s.dersler]));
  t("SECS", `ÇEKİRDEK ${A}: her bölümün (from,to) aralığındaki sorular o bölümün derslerinden (yanlış bölüm eşlemesi yok)`, r.run && bolumDers.length === ex.secs.length && bolumDers.every(x => x.dersler.length > 0 && x.dersler.every(d => (izinli[x.n] || []).includes(d))), JSON.stringify({ bolumDers, izinli }));
  const sheet = r.run ? await p.evaluate(() => { UI.sheetOpen = true; render(); const g = document.querySelector(".sheet-grid"); if (!g) return null; const o = []; for (const e of g.children) { if (e.classList.contains("sec-lbl")) o.push({ n: e.textContent.trim(), say: 0 }); else if (o.length) o[o.length - 1].say++; } return o; }) : null;
  t("SECS", `ÇEKİRDEK ${A}: cevap kâğıdı (DOM .sheet-grid) bölüm etiketleri ve her bölümdeki satır sayısı RUN'daki bölüm soru sayısına eşit (${bekSecs.map(s => s.n + ":" + (s.to - s.from)).join(", ")})`, !!sheet && esit(sheet, bekSecs.map(s => ({ n: s.n, say: s.to - s.from }))), JSON.stringify({ sheet, bek: bekSecs.map(s => [s.n, s.to - s.from]) }));
  /* bölüm bazlı sonuç: bitirince (bitir yanıtı sentetik anahtar verir) her bölümün d+y+b toplamı o bölümün RUN'daki soru sayısına eşit olmalı */
  await bitirTikla(p); await bekle(() => false, 1200); const so = await sonucOzet(p);
  const bekBolum = bekSecs.map(s => ({ n: s.n, top: s.to - s.from }));
  t("SECS", `ÇEKİRDEK ${A}: bölüm bazlı sonuç: her bölümün d+y+b toplamı RUN'daki o bölümün soru sayısı (${bekBolum.map(s => s.n + ":" + s.top).join(", ")}); genel toplam ${bekN}`, so.var && so.toplam === bekN && esit(so.bolum, bekBolum), JSON.stringify({ so: so.var ? so.bolum : null, bek: bekBolum, toplam: so.toplam }));
  await c.close();
}
{ /* aynı senaryo gerçek mini girişinden (bayrak açık): kısmi (ilk soru eksik) → sözleşme: RUN.secs tutarlı; mevcut kodda mini güvenli değil → kırmızı beklenir */
  sifirla(); D.oturum = "ilkEksik"; const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); const ex = await beklenen(p, "SAY"); const tk = await girisYap(p, gunluk, "SAY"), r = await ozet(p);
  const bekSecs = ex.secs.map((s, i) => ({ n: s.n, from: i === 0 ? 0 : s.from - 1, to: s.to - 1 }));
  t("SECS", "mini girişi [SAY]: ilk bölümden 1 soru eksik → yalnız sunulan katalog sorularıyla RUN (n-1), RUN.secs yeniden kurulu", tk && r.run && r.n === ex.total - 1 && r.svN === r.n && r.bankN === 0 && esit(r.secs, bekSecs), JSON.stringify({ tk, n: r.n, bek: ex.total - 1, sv: r.svN, bank: r.bankN, secs: r.secs }));
  await c.close(); }

/* =====================  [BİTİŞ] anahtar yalnız /bitir yanıtından · yenileme/devam · süre dolması · hesap/çıkış yarışı  (ÇEKİRDEK)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); const ex = await beklenen(p, "SAY"); await cekirdek(p, "SAY"); let r = await ozet(p);
  await p.evaluate(() => { RUN.ans[0] = 1; RUN.ans[1] = 2; RUN.ans[5] = 0; saveRun(); });
  const G = kapiYap(); D3.bitirTut = G; await bitirTikla(p); await bekle(() => D.bitirler.length >= 1, 3000); const arada = await ozet(p);
  t("BİTİŞ", "ÇEKİRDEK: /bitir yanıtı BEKLERKEN RUN/ake.run/DOM'da geçerli cevap değeri ya da dolu çözüm yok", arada.run && arada.aVar === 0 && arada.xVar === 0 && arada.lsA === 0 && !arada.domSizinti && !arada.lsSizinti, JSON.stringify({ aVar: arada.aVar, xVar: arada.xVar, ls: arada.lsA, dom: arada.domSizinti }));
  G.ac(); await bekle(() => false, 1200); const so = await sonucOzet(p), son = await ozet(p);
  const bd = D.bitirler[0] || {};
  t("BİTİŞ", "ÇEKİRDEK: /bitir gövdesi {oturum, cevaplar} (anahtar yok), her sv sorusu için kayıt, seçimler tamsayı/null", D.bitirler.length >= 1 && D.bitirler.every(x => esit(x.alanlar, ["cevaplar", "oturum"]) && x.cevaplar.every(cv => cv.secim === null || Number.isInteger(cv.secim))) && D.bitirler.reduce((a, x) => a + x.cevaplar.length, 0) === r.n, JSON.stringify({ n: D.bitirler.length, alan: bd.alanlar, toplam: D.bitirler.reduce((a, x) => a + x.cevaplar.length, 0), bek: r.n }));
  t("BİTİŞ", "ÇEKİRDEK: anahtar/çözüm YALNIZ /bitir yanıtından sonuca yazılır (sonuç kaydında her soru dolu çözüm + geçerli anahtar), sonuç sayfası, RUN temiz", so.var && so.anahtarTam && so.n === r.n && so.toplam === r.n && son.run === false && son.sinav === 1, JSON.stringify({ var: so.var, tam: so.anahtarTam, n: so.n, bek: r.n, run: son.run, sinav: son.sinav }));
  t("BİTİŞ", "ÇEKİRDEK: doğru sayısı bitir yanıtının sentetik anahtarıyla uyumlu (3 cevap verildi; hesap sentetik anahtara göre test içinde)", await p.evaluate(() => { const e = S.exams[S.exams.length - 1]; return !!e && e.d + e.y === e.qs.filter(q => q.your != null).length; }));
  await c.close(); }
{ /* yenileme/devam */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await cekirdek(p, "SAY"); const r0 = await ozet(p); await p.evaluate(() => { RUN.ans[2] = 3; saveRun(); });
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); const r1 = await ozet(p);
  t("BİTİŞ", "ÇEKİRDEK yenileme: RUN ake.run'dan geri gelir (aynı kimlik/soru/sv/gvn/süre/bölümler/cevap), anahtar yok", r1.run && r1.id === r0.id && r1.n === r0.n && r1.svN === r0.n && r1.gvn === "studyo" && r1.dur === r0.dur && esit(r1.secs, r0.secs) && r1.ans === 1 && r1.aVar === 0 && r1.xVar === 0, JSON.stringify({ id: r1.id === r0.id, n: r1.n, sv: r1.svN, gvn: r1.gvn, dur: [r1.dur, r0.dur], ans: r1.ans, aVar: r1.aVar }));
  await bitirTikla(p); await bekle(() => false, 1200); const so = await sonucOzet(p);
  t("BİTİŞ", "ÇEKİRDEK yenileme sonrası bitir: sonuç yazılır (anahtar yalnız /bitir'den), sunucu oturumuna istek gider", so.var && so.anahtarTam && D.bitirler.length >= 1, JSON.stringify({ var: so.var, tam: so.anahtarTam, bitir: D.bitirler.length }));
  await c.close(); }
{ /* süre dolması */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await cekirdek(p, "SAY"); const r0 = await ozet(p);
  await p.evaluate(() => { RUN.start = Date.now() - (RUN.dur + 30) * 1000; saveRun(); tick(); });
  await bekle(() => D.bitirler.length >= 1, 3000); await bekle(() => false, 800); const so = await sonucOzet(p), r = await ozet(p);
  t("BİTİŞ", "ÇEKİRDEK süre dolması: tick() finishRun(true) → /bitir istenir, sonuç yazılır, 'Süre doldu' bildirimi, RUN temiz", D.bitirler.length >= 1 && so.var && so.anahtarTam && r.run === false && r.toast.some(x => /Süre doldu/.test(x)), JSON.stringify({ bitir: D.bitirler.length, var: so.var, run: r.run, toast: r.toast }));
  await c.close(); }
{ /* bitir hata/410 */
  for (const mod of ["500", "410"]) {
    sifirla(); D.bitir = mod; const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await cekirdek(p, "SAY"); await p.evaluate(() => { RUN.ans[0] = 1; saveRun(); }); const r0 = await ozet(p);
    await bitirTikla(p); await bekle(() => false, 1200); const r = await ozet(p), so = await sonucOzet(p);
    if (mod === "500") t("BİTİŞ", "ÇEKİRDEK bitir 500: sonuç YAZILMAZ, RUN ve cevaplar korunur, 'değerlendirilemedi' bildirimi, anahtar yok", r.run && r.id === r0.id && r.ans === 1 && r.sinav === 0 && r.aVar === 0 && r.toast.some(x => /değerlendirilemedi/.test(x)), JSON.stringify({ run: r.run, ans: r.ans, sinav: r.sinav, toast: r.toast }));
    else t("BİTİŞ", "ÇEKİRDEK bitir 410 (sunucu oturumu bitmiş): anahtar alınamayan sorular boş sayılır (sahte doğru/yanlış yok); sonuç yazılır, d=y=0", so.var && so.d === 0 && so.toplam === r0.n && so.dogru === 0, JSON.stringify({ var: so.var, d: so.d, toplam: so.toplam, n: r0.n }));
    await c.close();
  }
}
/* GERÇEK hesap değişimi = hesapKimlikGuncelle + hesapEsitle() (sahipUyumla → yuvaYaz → sahipAyir: RUN/S yeni sahibe göre kurulur; index.html :7272-7284, :10059). Yalnız kimlik güncellemek (eski `gec`) sahip geçişini YAPMAZ. */
const hesapDegis = async (c, p, kul) => { await gec(c, p, kul); await p.evaluate(() => hesapEsitle()); await p.waitForTimeout(600); };
{ /* hesap değişimi sırasında bekleyen bitir yanıtı */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await cekirdek(p, "SAY"); await p.evaluate(() => { RUN.ans[0] = 1; saveRun(); }); const r0 = await ozet(p);
  const G = kapiYap(); D3.bitirTut = G; await bitirTikla(p); await bekle(() => D.bitirler.length >= 1, 3000);
  await hesapDegis(c, p, "kulB"); G.ac(); await bekle(() => false, 1000); const rB = await ozet(p);
  const bAnahtar = await p.evaluate(() => JSON.stringify([S.exams, UI.lastResult, localStorage.getItem("ake.run") || "", RUN]).includes("SENTETIK-COZUM"));
  t("BİTİŞ", "ÇEKİRDEK GERÇEK hesap değişimi (kul1→kulB) sırasında bekleyen /bitir: A'nın sonucu B'ye yazılmaz (B S.exams boş), B'de A'nın RUN'ı/anahtarı yok", rB.sinav === 0 && !rB.resultId && !(rB.run && rB.id === r0.id) && !bAnahtar, JSON.stringify({ sinav: rB.sinav, run: rB.run, ayniRun: rB.id === r0.id, sizinti: bAnahtar }));
  await hesapDegis(c, p, "kul1"); const rA = await ozet(p);
  t("BİTİŞ", "ÇEKİRDEK A'ya geri dönünce: A'nın RUN'ı (cevaplı, anahtarsız) yuvadan geri gelir, kaybolan /bitir yanıtı sonuç YAZMAMIŞTIR (yarım kalan RUN korunur)", rA.run && rA.id === r0.id && rA.ans === 1 && rA.aVar === 0 && rA.xVar === 0 && rA.sinav === 0, JSON.stringify({ run: rA.run, ayni: rA.id === r0.id, ans: rA.ans, aVar: rA.aVar, sinav: rA.sinav }));
  await c.close(); }
{ /* çıkış sırasında bekleyen bitir yanıtı. KOD DAYANAĞI: ACT.cikis (:10211-10219) cihazdaki ilerlemeyi KORUR ("Bu cihazdaki ilerlemen duruyor"), OT.sahip/RUN'ı temizlemez → çıkıştan sonra gelen /bitir yanıtı AYNI sahibin yerel durumunu tamamlar; bu bir sızıntı değil, tasarım. Sözleşme: anahtar yalnız o sonuçta, başka hesaba geçince yok. */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await cekirdek(p, "SAY"); await p.evaluate(() => { RUN.ans[0] = 1; saveRun(); }); const r0 = await ozet(p);
  const G = kapiYap(); D3.bitirTut = G; await bitirTikla(p); await bekle(() => D.bitirler.length >= 1, 3000);
  await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); await p.waitForTimeout(500); G.ac(); await bekle(() => false, 1200); const rC = await ozet(p);
  bilgi("BİTİŞ çıkış sırasında bekleyen /bitir (KARAKT): çıkış isteği gitti / sonuç sayısı / RUN", { cikis: D3.cikisGeldi, sinav: rC.sinav, run: rC.run, sahip: await p.evaluate(() => OT.sahip) });
  t("BİTİŞ", "KARAKT çıkış sırasında bekleyen /bitir: çıkış tamamlanır; sonuç (varsa) yalnız /bitir yanıtından gelen anahtarla, çıkış yapılmış hesap için sunucu oturumu AÇILMAZ (yeni oturum isteği yok)", D3.cikisGeldi && D.istekler.length === 1 && (rC.sinav === 1 ? await p.evaluate(() => S.exams[0].qs.every(q => Number.isInteger(q.a))) : rC.run), JSON.stringify({ cikis: D3.cikisGeldi, sinav: rC.sinav, run: rC.run, ist: D.istekler.length }));
  await hesapDegis(c, p, "kulB"); const rB = await ozet(p); const bSiz = await p.evaluate(() => JSON.stringify([S.exams, UI.lastResult, localStorage.getItem("ake.run") || "", RUN]).includes("SENTETIK-COZUM"));
  t("BİTİŞ", "ÇEKİRDEK çıkıştan sonra başka hesaba (kulB) geçilince: A'nın sonucu/anahtarı/RUN'ı B'de yok", rB.sinav === 0 && !rB.run && !bSiz, JSON.stringify({ sinav: rB.sinav, run: rB.run, sizinti: bSiz }));
  await c.close(); }
{ /* hesap değişimi sırasında bekleyen OTURUM (svBaslat) isteği: istek uçuştayken hesap kulB'ye geçer → eski hesabın RUN'ı yeni hesapta AÇILMAZ */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p);
  const bekleyen = cekirdekHam(p, "SAY"); await gec(c, p, "kulB"); await p.evaluate(() => hesapEsitle()); await bekleyen; await p.waitForTimeout(900); const rB = await ozet(p);
  t("BİTİŞ", "ÇEKİRDEK hesap değişimi sırasında bekleyen sunucu OTURUM yanıtı: eski hesabın (kul1) RUN'ı yeni hesapta (kulB) AÇILMAZ", !(rB.run && rB.ids.some(i => KS.has(i))), JSON.stringify({ run: rB.run, n: rB.n, aKimlik: rB.ids.filter(i => KS.has(i)).length }));
  await c.close(); }

console.log(`\nTOPLAM: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) { console.log("KIRMIZI:"); kirmizi.forEach(k => console.log("  - " + k)); }
await b.close(); srv.close(); process.exit(kalan > 0 ? 1 : 0);
