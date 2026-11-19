// B4 3C-4d · ACT.kocTest (koç testi) güvenli katalog geçişi — gerçek Chromium + SAHTE API testleri (Production/Preview/D1'e dokunmaz; CI'a EKLENMEZ).
// Taban B4 376166f595108d84ce085cc4885283ea4aaf6df5. Bayrak AKE_KATALOG_STUDYO === true iken üç gerçek koç testi düğmesi (konu kartı "Test çöz", konu çalışması "Testi başlat", günlük program "Başla")
//   studyoGirisCalistir → KHAVUZ → studyoCfg → zorunlu sunucu oturumu (gvn="studyo"); BANK/EKQ/AI/GENS dolgusu ve yerel kota/fallback YOK.
// Gruplar: [KARAKT] bayrak KAPALI mevcut davranış (yeşil kalmalı) · [ÇAĞIRAN] üç düğme · [GÜVENLİ] sözleşme · [YANLIŞ] S.mistakes kimlikle katalogdan yeniden çözülür (anlık görüntü kopyalanmaz) · [HAVUZ] seviye/konu/tamamlama/eksik
//   [HATA] 401/402/404/429/500/ağ/boş/kısmi · [ESKİ] eski RUN · [YARIŞ] A→B→A/çıkış · [BİTİŞ] cevap→yanlış kaydı→program ilerlemesi→bitirme · [KAPSAM] kocOrnekler ve mist* DEĞİŞMEZ (cevaplı kaynak; bu adımda güvenli İLAN EDİLMEZ)
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz (sentetik; yalnız kimlik/sayı/varlık). Çalıştırma: node tests/studyo-koc-istemci.mjs · çıkış kodu: kırmızı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };
const bilgi = (ad, v) => console.log("BİLGİ ", ad, typeof v === "string" ? v : JSON.stringify(v));

const D = { dus: [], oturum: "tam", bitir: "tam", istekler: [], bitirler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: tam|ilkEksik|kismi5|bos|404|banka_yok|500|402|401|429|ag  ·  bitir: tam|500|410|ag
const D2 = { kat: "tam", katIstek: 0, kes: null, tut: null };
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
const sifirla = () => { D.istekler.length = 0; D.bitirler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D.dus = []; D.bitir = "tam"; D2.kes = null; D2.tut = null; D2.kat = "tam"; D2.katIstek = 0; D3.bitirTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); };
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

/* =====================  SANITY  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false });
  const v = await p.evaluate(([s, tp]) => { S.topic[s + "|" + tp] = [2, 8, 0]; const a1 = kocAnaliz().find(x => x.s === s && x.t === tp); S.topic[s + "|" + tp] = [5, 5, 0]; const a2 = kocAnaliz().find(x => x.s === s && x.t === tp); S.topic[s + "|" + tp] = [9, 1, 0]; const a3 = kocAnaliz().find(x => x.s === s && x.t === tp); delete S.topic[s + "|" + tp]; return { l: [a1 && a1.seviye, a2 && a2.seviye, a3 && a3.seviye], koc: typeof ACT.kocTest, guv: typeof studyoGuvenliMi }; }, [S0, TA]);
  t("SANITY", "seviye: [2,8,0]→1, [5,5,0]→2, [9,1,0]→3 (kocAnaliz); ACT.kocTest var", esit(v.l, [1, 2, 3]) && v.koc === "function", JSON.stringify(v));
  t("SANITY", "katalog: KOC-ANA 36 soru (zorluk 1/2/3 × 12), KOC-AZ 3 soru, aynı ders", KATALOG.get("kul1").filter(x => x.t === TA).length === 36 && [1, 2, 3].every(d => KATALOG.get("kul1").filter(x => x.t === TA && x.d === d).length === 12) && KATALOG.get("kul1").filter(x => x.t === TZ).length === 3);
  await c.close(); }

/* =====================  KARAKTERİZASYON (bayrak KAPALI)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, S0, TA, [2, 8, 0]); await yanlisKur(p, [{ id: "kocm-eski-1", n: 5 }]);
  const r = await koc(p);
  t("KARAKT", "bayrak KAPALI koç testi (mevcut davranış): RUN açılır, practice/study, 'Sana özel' başlığı, gvn yok, katalog isteği yok, sunucu kotası/ai yok", r.run && r.kind === "practice" && r.mode === "study" && /^Sana özel/.test(r.title) && r.gvn === null && D2.katIstek === 0 && D.kota >= 0 && D.ai === 0, JSON.stringify({ run: r.run, kind: r.kind, mode: r.mode, title: r.title, gvn: r.gvn, kat: D2.katIstek }));
  t("KARAKT", "bayrak KAPALI: açık yanlışın ANLIK GÖRÜNTÜSÜ eskisi gibi sete girer (kocm-eski-1) — bayrak açıkken bu davranış GÖRÜLMEZ (aşağıdaki [YANLIŞ])", r.ids.includes("kocm-eski-1"), JSON.stringify(r.ids));
  await c.close(); }

/* =====================  GÜVENLİ ÇEKİRDEK  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); const r = await koc(p), sn = await SNAP(p), dk = dersKonu(r.ids);
  t("GÜVENLİ", "bayrak AÇIK koç testi: RUN gvn='studyo' (ake.run'da da), practice/study, 'Sana özel' başlığı", r.run && r.gvn === "studyo" && r.lsGvn === "studyo" && r.kind === "practice" && r.mode === "study" && /^Sana özel/.test(r.title), JSON.stringify({ run: r.run, gvn: r.gvn, ls: r.lsGvn, kind: r.kind, title: r.title }));
  t("GÜVENLİ", "10 soru, hepsi KATALOGDA (kul1), tekil; BANK/GENS/EKQ/AI dolgusu YOK", r.n === 10 && hepsiKatalogda(r.ids, KS) && r.tekil && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0, JSON.stringify({ n: r.n, bank: r.bankN, gen: r.genN, tuzak: r.tuzakN, tekil: r.tekil }));
  t("GÜVENLİ", "hepsi aynı ders+konu (KOC-ANA, havuz yeterli)", esit(dk.d, { [S0]: 10 }) && esit(dk.k, { [TA]: 10 }), JSON.stringify(dk));
  t("GÜVENLİ", "sunucu OTURUM isteği: 1 istek, mod=practice, idler = RUN kimlikleri; 10/10 sunucu oturumlu, 0 yerel; yerel kota (POST /api/hesap/kota) ve ai yok", D.istekler.length === 1 && D.istekler[0].mod === "practice" && esit([...D.istekler[0].idler].sort(), [...r.ids].sort()) && r.svN === 10 && r.yerelN === 0 && D.kota === 0 && D.ai === 0, JSON.stringify({ ist: D.istekler.length, mod: D.istekler[0] && D.istekler[0].mod, svN: r.svN, yerelN: r.yerelN, kota: D.kota, ai: D.ai }));
  t("GÜVENLİ", "bitiş ÖNCESİ RUN ve ake.run'da 0 geçerli cevap (a), 0 dolu çözüm (x); DOM/localStorage'da sentetik çözüm yok", r.aVar === 0 && r.xVar === 0 && r.lsA === 0 && !r.domSizinti && !r.lsSizinti && !sn.snapshot, JSON.stringify({ a: r.aVar, x: r.xVar, lsA: r.lsA, dom: r.domSizinti, ls: r.lsSizinti }));
  await c.close(); }

/* =====================  ÜÇ GERÇEK ÇAĞIRAN (DOM tıklaması)  ===================== */
const CAGIRAN = {
  "konu kartı 'Test çöz'": async p => { await kocHazir(p); return tikla(p, `.card.stack > .row > [data-a="kocTest"][data-t="${TA}"]`); },
  "konu çalışması 'Testi başlat'": async p => { await kocHazir(p); if (!(await tikla(p, `[data-a="kocAc"][data-t="${TA}"]`))) return false; await p.waitForTimeout(400); return tikla(p, '.btn.pri[data-a="kocTest"]'); },
  "günlük program 'Başla'": async p => { await kocHazir(p); return tikla(p, `.li [data-a="kocTest"][data-t="${TA}"]`); }
};
for (const [ad, f] of Object.entries(CAGIRAN)) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); const tk = await f(p), r = await ozet(p);
  t("ÇAĞIRAN", `${ad}: düğme bulunup tıklanır; güvenli RUN (gvn=studyo, 10 katalog sorusu, sunucu oturumlu, 0 yerel, BANK/GEN/EKQ/AI yok), 1 oturum isteği`, tk && r.run && r.gvn === "studyo" && r.n === 10 && hepsiKatalogda(r.ids, KS) && r.svN === 10 && r.yerelN === 0 && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && D.istekler.length === 1 && D.kota === 0, JSON.stringify({ tk, run: r.run, gvn: r.gvn, n: r.n, svN: r.svN, bank: r.bankN, gen: r.genN, tuzak: r.tuzakN, ist: D.istekler.length, kota: D.kota }));
  await c.close();
}

/* =====================  YANLIŞ TEKRARI (kimlikle katalogdan; anlık görüntü KOPYALANMAZ)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await zayifKur(p, S0, TA, [2, 8, 0]);
  await yanlisKur(p, [{ id: "g:eski:1", n: 9, gen: 1 }, { id: "kocm-katalogda-yok", n: 8 }, { id: "kat-a-koc-a05", n: 7, fig: 1 }, { id: "kat-a-koc-a02", n: 5 }, { id: "kat-a-koc-a03", n: 3 }, { id: "kat-a-koc-a04", n: 2, learned: 1 }]);
  await git(p, "#koc"); const r = await koc(p), sn = await SNAP(p);
  t("YANLIŞ", "açık yanlışlardan en çok n'li İKİ geçerli olan (a02, a03) RUN'a KATALOGDAKİ nesneyle girer; her biri bir kez", r.run && r.ids.filter(i => i === "kat-a-koc-a02").length === 1 && r.ids.filter(i => i === "kat-a-koc-a03").length === 1 && r.tekil, JSON.stringify(r.ids));
  t("YANLIŞ", "g: / katalogda olmayan eski yanlış RUN'a GİRMEZ; anlık görüntü metni/çözümü RUN ve ake.run'da YOK", !r.ids.includes("g:eski:1") && !r.ids.includes("kocm-katalogda-yok") && !sn.snapshot && r.genN === 0, JSON.stringify({ ids: r.ids, snapshot: sn.snapshot }));
  t("YANLIŞ", "elenen yanlışlar bildirilir (g:, katalogda yok, görselli = 3 soru) — kullanıcıya açık toast", r.toast.some(m => /3/.test(m) && /yanlış/i.test(m) && /katalog/i.test(m)), JSON.stringify(r.toast));
  t("YANLIŞ", "RUN'da bitiş öncesi 0 cevap/çözüm, 10 soru, hepsi katalogda ve sunucu oturumlu", r.n === 10 && r.aVar === 0 && r.xVar === 0 && hepsiKatalogda(r.ids, KS) && r.svN === 10, JSON.stringify({ n: r.n, a: r.aVar, x: r.xVar, svN: r.svN }));
  await c.close(); }

/* =====================  HAVUZ: seviye ağırlığı, konu, tamamlama, eksik  ===================== */
for (const [L, v] of [[1, [2, 8, 0]], [2, [5, 5, 0]], [3, [9, 1, 0]]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p, v); const r = await koc(p), dk = dersKonu(r.ids), w = AGIRLIK[L];
  t("HAVUZ", `seviye ${L}: zorluk dağılımı mevcut ağırlıkla (kolay/orta/zor = ${w[1]}/${w[2]}/${w[3]}), tamamı KOC-ANA katalog sorusu`, r.run && r.n === 10 && esit(sirali(dk.z), sirali({ 1: w[1], 2: w[2], 3: w[3] })) && esit(dk.k, { [TA]: 10 }), JSON.stringify({ n: r.n, z: dk.z, k: dk.k }));
  await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p, [2, 8, 0], TZ); const r = await koc(p, TZ), dk = dersKonu(r.ids);
  const z = KATALOG.get("kul1").filter(x => x.t === TZ).map(x => x.id);
  t("HAVUZ", "küçük konu (3 soru): önce konunun hepsi, kalan AYNI DERSTEN katalogla 10'a tamamlanır; BANK/GENS/EKQ/AI yok", r.run && r.n === 10 && z.every(i => r.ids.includes(i)) && esit(dk.d, { [S0]: 10 }) && hepsiKatalogda(r.ids, KS) && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && r.tekil, JSON.stringify({ n: r.n, dk, zVar: z.filter(i => r.ids.includes(i)).length }));
  await c.close(); }
{ sifirla(); D2.kes = { [S0]: 5 }; const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); const r = await koc(p);
  t("HAVUZ", "dersin kataloğu 5 soruya düşerse: 5 soruyla açılır, eksik doldurulmaz (BANK/GENS yok) ve toast eksik sayıyı söyler", r.run && r.n === 5 && hepsiKatalogda(r.ids, KS) && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && r.toast.some(m => /5/.test(m) && /10/.test(m)), JSON.stringify({ n: r.n, toast: r.toast }));
  await c.close(); }
{ sifirla(); D2.kes = { [S0]: 0 }; const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); const r = await koc(p);
  t("HAVUZ", "dersin kataloğunda hiç soru yoksa: RUN AÇILMAZ, sunucu oturumu yok, 'bulunamadı' bildirimi, yerel dolgu yok", !r.run && D.istekler.length === 0 && r.toast.some(m => /bulunamad/i.test(m)), JSON.stringify({ run: r.run, ist: D.istekler.length, toast: r.toast }));
  await c.close(); }

/* =====================  HATA / KISMİ YANIT  ===================== */
for (const [mod, bek] of [["401", "giriş"], ["402", "limit"], ["404", "kapalı"], ["500", "hata"], ["banka_yok", "hata"], ["ag", "hata"], ["bos", "hata"], ["429", "toast"]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); D.oturum = mod; const r = await koc(p);
  t("HATA", `sunucu oturumu ${mod}: RUN AÇILMAZ, yerel (cevaplı) set/fallback yok, yerel kota yok; kullanıcıya açık geri bildirim (${bek})`, !r.run && r.yerelN === 0 && D.kota === 0 && D.ai === 0 && (mod === "429" ? r.toast.length > 0 : !!r.modal || r.toast.length > 0), JSON.stringify({ run: r.run, modal: r.modal, toast: r.toast.slice(-2), kota: D.kota }));
  await c.close();
}
for (const [mod, bek] of [["ilkEksik", 9], ["kismi5", 5]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); D.oturum = mod; const r = await koc(p);
  t("HATA", `kısmi yanıt (${mod}): yalnız sunucunun verdiği ${bek} soruyla açılır, 'sunucudan alınamadı' bildirimi, eksikler yerel DOLDURULMAZ, 0 cevap/çözüm`, r.run && r.n === bek && r.svN === bek && r.yerelN === 0 && r.aVar === 0 && r.xVar === 0 && r.toast.some(m => /sunucudan alınamadı/.test(m)) && r.bankN === 0 && r.genN === 0, JSON.stringify({ run: r.run, n: r.n, svN: r.svN, toast: r.toast.slice(-2) }));
  await c.close();
}

/* =====================  KATALOG BEKLEME / GİRİŞ / KATALOG HATASI  ===================== */
{ sifirla(); const G = kapiYap(); const { c, p } = await sayfa({ guvenli: true, hash: "#koc" }); await zayifKur(p, S0, TA, [2, 8, 0]); D2.tut = G;
  await kocTestCagir(p); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(400); const r1 = await ozet(p); G.ac(); await hazirBekle(p, 5000); await p.waitForTimeout(900); const r2 = await ozet(p);
  t("KATALOG", "katalog yüklenirken koç testi: beklerken YEREL RUN açılmaz ('yükleniyor' bildirimi); hazır olunca güvenli RUN (gvn=studyo, katalog kimlikleri) açılır", !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && r2.run && r2.gvn === "studyo" && hepsiKatalogda(r2.ids, KS) && r2.bankN === 0, JSON.stringify({ r1: r1.run, toast: r1.toast.slice(-2), r2: r2.run, gvn: r2.gvn, n: r2.n }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); const { c, p } = await sayfa({ guvenli: true, hash: "#koc" }); await zayifKur(p, S0, TA, [2, 8, 0]); D2.tut = G;
  await kocTestCagir(p); await bekle(() => D2.katIstek >= 1, 3000); await hesapDegis(c, p, "kulB"); G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken hesap kul1→kulB: bekleyen koç eylemi RUN AÇAMAZ (eski hesabın kimlikleri yok)", !(r.run && r.ids.some(i => KS.has(i))), JSON.stringify({ run: r.run, a: r.ids.filter(i => KS.has(i)).length }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); D3.cikisTut = kapiYap(); const { c, p } = await sayfa({ guvenli: true, hash: "#koc" }); await zayifKur(p, S0, TA, [2, 8, 0]); D2.tut = G;
  await kocTestCagir(p); await bekle(() => D2.katIstek >= 1, 3000); await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G.ac(); D3.cikisTut.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken ÇIKIŞ: bekleyen koç eylemi RUN AÇAMAZ", !r.run, JSON.stringify({ run: r.run, n: r.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, giris: false, hash: "#koc" }); await zayifKur(p, S0, TA, [2, 8, 0]); await kocTestCagir(p); await p.waitForTimeout(700); const r = await ozet(p);
  t("KATALOG", "giriş yok: koç testi YEREL açılmaz; giriş modalı çıkar; katalog/oturum isteği yok", !r.run && /giriş/i.test(r.modal) && D.istekler.length === 0 && D2.katIstek === 0, JSON.stringify({ run: r.run, modal: r.modal, ist: D.istekler.length, kat: D2.katIstek }));
  await c.close(); }
{ sifirla(); D2.kat = "500"; const { c, p } = await sayfa({ guvenli: true }); await hazirBekle(p, 5000); await zayifKur(p, S0, TA, [2, 8, 0]); await git(p, "#koc"); const r = await koc(p);
  t("KATALOG", "katalog yüklenemedi (500): koç testi YEREL açılmaz; açık bildirim; oturum/kota isteği yok", !r.run && r.toast.length > 0 && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ run: r.run, toast: r.toast.slice(-2), ist: D.istekler.length }));
  await c.close(); }

/* =====================  ESKİ RUN  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); await eskiRunKur(p, null); const o0 = await ozet(p); await kocTestCagir(p); await p.waitForTimeout(700); const r = await ozet(p);
  t("ESKİ", "mevcut İŞARETSİZ (eski yerel) RUN: ezilmez (aynı kimlik, cevaplar korunur), 'Yarım kalan eski oturum' uyarısı, değiştirme penceresi AÇILMAZ, sunucu oturumu açılmaz", o0.run && r.run && r.id === o0.id && r.ans === o0.ans && !r.modal && D.istekler.length === 0 && r.toast.some(m => /Yarım kalan eski/.test(m)), JSON.stringify({ id: r.id === o0.id, ans: [o0.ans, r.ans], modal: r.modal, ist: D.istekler.length, toast: r.toast.slice(-2) }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); await eskiRunKur(p, "studyo"); const o0 = await ozet(p); await kocTestCagir(p); await p.waitForTimeout(600); const r = await ozet(p);
  t("ESKİ", "mevcut İŞARETLİ (güvenli) RUN: 'Yarım kalan oturum var' penceresi çıkar; onaylanmadan RUN/cevaplar korunur, sunucu oturumu açılmaz", r.run && r.id === o0.id && r.ans === o0.ans && /Yarım kalan oturum/.test(r.modal) && D.istekler.length === 0, JSON.stringify({ modal: r.modal, ist: D.istekler.length }));
  await tikla(p, '[data-a="runReplace"]'); await p.waitForTimeout(800); const r2 = await ozet(p);
  t("ESKİ", "'Yenisini başlat' onayından sonra güvenli koç RUN'ı açılır (sunucu oturumlu, gvn=studyo, 0 cevap/çözüm)", r2.run && r2.id !== o0.id && r2.gvn === "studyo" && r2.n === 10 && r2.svN === 10 && r2.aVar === 0 && r2.xVar === 0, JSON.stringify({ run: r2.run, n: r2.n, gvn: r2.gvn }));
  await c.close(); }

/* =====================  YARIŞLAR  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p);
  const bekleyen = p.evaluate(([s, tp]) => { ACT.kocTest({ s, t: tp }); }, [S0, TA]); await gec(c, p, "kulB"); await p.evaluate(() => hesapEsitle()); await bekleyen; await p.waitForTimeout(900); const rB = await ozet(p);
  t("YARIŞ", "koç testi başlatılırken hesap kul1→kulB: eski hesabın RUN'ı yeni hesapta AÇILMAZ (kul1 kimliği yok)", !(rB.run && rB.ids.some(i => KS.has(i))), JSON.stringify({ run: rB.run, a: rB.ids.filter(i => KS.has(i)).length }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p);
  const bekleyen = p.evaluate(([s, tp]) => { ACT.kocTest({ s, t: tp }); }, [S0, TA]); await gec(c, p, "kulB"); await p.evaluate(() => hesapEsitle()); await gec(c, p, "kul1"); await p.evaluate(() => hesapEsitle()); await bekleyen; await p.waitForTimeout(1000); const r = await ozet(p);
  t("YARIŞ", "A→B→A: eski işlemin yanıtı yeni (aynı kimlikli) oturumda RUN AÇAMAZ (işlem nesli iki kez değişti)", !r.run, JSON.stringify({ run: r.run, n: r.n }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); D3.cikisTut = G; const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p);
  await p.evaluate(([s, tp]) => { ACT.kocTest({ s, t: tp }); ACT.cikis(); }, [S0, TA]); await bekle(() => D3.cikisGeldi, 3000); await p.waitForTimeout(600); const r1 = await ozet(p); G.ac(); await p.waitForTimeout(900); const r2 = await ozet(p);
  t("YARIŞ", "çıkış sürerken (çıkış isteği bekletiliyor) koç testi: RUN AÇILMAZ; çıkış bitince de açılmaz", !r1.run && !r2.run, JSON.stringify({ r1: r1.run, r2: r2.run }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); const r = await koc(p); await hesapDegis(c, p, "kulB"); const rB = await ozet(p);
  const sz = await p.evaluate(() => JSON.stringify([S.mistakes, S.exams, localStorage.getItem("ake.run") || "", RUN]).includes("kat-a-koc"));
  t("YARIŞ", "RUN açıkken hesap kulB'ye geçilince: A'nın koç RUN'ı/kimlikleri B'de yok", r.run && !rB.run && !sz, JSON.stringify({ rA: r.run, rB: rB.run, sz }));
  await c.close(); }

/* =====================  BİTİŞ: cevap → yanlış kaydı → program ilerlemesi → bitirme  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); const r = await koc(p);
  const on = await p.evaluate(async ([s, tp]) => { const k = s + "|" + tp, n0 = (S.topic[k] || [0, 0, 0]).slice(), tp0 = ((S.daily[dayKey()] || {}).tp || {})[k] || 0, ms0 = Object.keys(S.mistakes).length;
    for (let i = 0; i < 8; i++) { moveTo(i); pickAnswer(0); for (let j = 0; j < 40 && !RUN.rev[i]; j++) await new Promise(r => setTimeout(r, 50)); }
    return { rev: RUN.rev.filter(Boolean).length, n0, tp0 }; }, [S0, TA]);
  const son = await p.evaluate(([s, tp, ids]) => { const k = s + "|" + tp, a = RUN.qs.filter(q => Number.isInteger(q.a) && q.sv).length, ms = ids.filter(i => S.mistakes[i]); return { tp: ((S.daily[dayKey()] || {}).tp || {})[k] || 0, a, mistN: ms.length, mistA: ms.filter(i => Number.isInteger(S.mistakes[i].q.a) && typeof S.mistakes[i].q.x === "string").length, adim: kocGunluk().filter(x => x.k === "test" && x.t === tp).map(x => x.done) }; }, [S0, TA, r.ids]);
  t("BİTİŞ", "8 cevap: her cevapta /cevap ile anahtar+çözüm YALNIZ o soru için gelir (8 soru anahtarlı, 2'si değil), 8 sunucu çağrısı", on.rev === 8 && son.a === 8 && D.cevap === 8, JSON.stringify({ rev: on.rev, a: son.a, cevap: D.cevap }));
  t("BİTİŞ", "yanlış cevaplar S.mistakes'e anlık görüntü olarak (sunucudan gelen a/x ile) kaydedilir; konu doğruluk sayacı ve günlük program ilerlemesi (tp ≥ 8) güncellenir; 'test' adımı tamam", son.mistN === 8 && son.mistA === 8 && son.tp - on.tp0 === 8 && son.adim.every(x => x === true), JSON.stringify({ mist: son.mistN, mistA: son.mistA, dtp: son.tp - on.tp0, adim: son.adim }));
  await bitirTikla(p); await bekle(() => D.bitirler.length >= 1, 3000); await p.waitForTimeout(500); const rb = await ozet(p);
  t("BİTİŞ", "bitirme: /api/soru/bitir 1 kez (koç oturumu), RUN temizlenir (ake.run yok)", D.bitirler.length === 1 && !rb.run && rb.lsId === null, JSON.stringify({ bitir: D.bitirler.length, run: rb.run, ls: rb.lsId }));
  await c.close(); }

/* =====================  KAPSAM DIŞI (DEĞİŞMEZ): kocOrnekler ve mist*  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir(p); await yanlisKur(p, [{ id: "kat-a-koc-a02", n: 5 }]);
  await p.evaluate(([s, tp]) => { ACT.kocAc({ s, t: tp }); }, [S0, TA]); await p.waitForTimeout(500);
  const ex = await p.evaluate(() => (KOC.ex || []).map(e => ({ a: Number.isInteger(e.a), x: typeof e.x === "string" && e.x.length > 0 })));
  t("KAPSAM", "kocOrnekler (kapsam dışı, GÜVENLİ İLAN EDİLMEZ): 'Konu çalışması' bayrak açıkken sunucu oturumu/kota İSTEMEZ; örnekler yerel kaynaktan CEVAPLI (a/x dolu) gösterilir", D.istekler.length === 0 && D.kota === 0 && ex.every(e => e.a && e.x), JSON.stringify({ ist: D.istekler.length, kota: D.kota, ornek: ex.length }));
  bilgi("KAPSAM kocOrnekler örnek sayısı (cevaplı, yerel BANK/EKQ/GENS)", String(ex.length));
  sifirla(); await p.evaluate(() => { RUN = null; saveRun(); }); await p.evaluate(() => { ACT.mistOne({ id: "kat-a-koc-a02" }); }); const rm = await ozet(p);
  t("KAPSAM", "mist* (3C-4f ile GÜNCELLENDİ — önceki sözleşme 'yerel, gvn yok' idi): bayrak açıkken 'Yanlış tekrarı' artık güvenli: kind='mistakes', gvn='studyo', sunucu oturumlu, cevap/çözüm yok (ayrıntı: tests/studyo-mist-istemci.mjs)", rm.run && rm.kind === "mistakes" && rm.gvn === "studyo" && D.istekler.length === 1 && rm.aVar === 0 && rm.xVar === 0, JSON.stringify({ run: rm.run, kind: rm.kind, gvn: rm.gvn, ist: D.istekler.length, aVar: rm.aVar }));
  await c.close(); }

console.log(`\nTOPLAM: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) { console.log("KIRMIZI:"); kirmizi.forEach(k => console.log("  - " + k)); }
await b.close(); srv.close(); process.exit(kalan > 0 ? 1 : 0);
