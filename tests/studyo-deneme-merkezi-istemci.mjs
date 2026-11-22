// B4 3C-4i · DENEME MERKEZİ (ACT.startExam → startExamFromUI: tam/yarım/çeyrek/özel + çalışma modu) güvenli katalog geçişi testleri
// (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz). Çalıştırma: node tests/studyo-deneme-merkezi-istemci.mjs · çıkış kodu: kırmızı > 0 ise 1 · KAT_HTML ile alternatif index.html.
// Harness tests/studyo-mini-istemci.mjs'ten türetildi (katalog: her ders için 90 soru; katalog kapısı D2.tut, oturum kapısı D2.oturumTut eklendi). Cevap anahtarı DEĞERLERİ çıktıya yazılmaz.
// Bugünkü UI sınırları (kodla doğrulanır, SANITY): sınav türleri TYT/SAY/EA/SOZ/YDT; boyutlar full/half/quarter/custom; custom satır adedi 0..tam (exStep kıskacı); en büyük deneme 120 soru (TYT tam);
//   süre alanı 0..300 dk; sınav modu sunucu "exam", çalışma modu sunucu "practice" oturumu. 121+ soruluk gelecek kota tasarımı KAPSAM DIŞI (bugünkü UI en çok 120 üretir).
// Gruplar: [KAPALI] bayrak KAPALI eski yol aynen · [GERÇEK] deneme merkezi düğmeleriyle başlatma · [MATRİS] tür × boyut × mod · [HATA] eksik/boş katalog, kısmi yanıt, sunucu hataları · [YARIŞ] katalog/oturum beklerken UI, hesap (A→B, A→B→A), çıkış, bayrak, eski RUN · [BİTİŞ] bitirme/yenileme · [MİNİ] mevcut quick mini akışı korunur.
// Her seçim TIKLAMA ANINDA sabitlenir (custom nesnesi kopyalanır); beklerken UI değişse de açılan RUN ilk seçimle eşleşir.
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz; yalnız kimlik/sayı/varlık raporlanır (sahte anahtarlar sayfaya yalnız karşılaştırma için verilir).
// Çalıştırma: node tests/studyo-deneme-merkezi-istemci.mjs  ·  çıkış kodu: kırmızı > 0 ise 1  ·  KAT_HTML=<yol> ile alternatif index.html (negatif kontrol / mutasyon).
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };
const bilgi = (ad, v) => console.log("BİLGİ ", ad, typeof v === "string" ? v : JSON.stringify(v));

const D = { dus: [], oturum: "tam", bitir: "tam", istekler: [], bitirler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: tam|ilkEksik|kismi5|bos|404|banka_yok|500|402|401|429|ag  ·  bitir: tam|500|410|ag
const D2 = { kat: "tam", katIstek: 0, kes: null, tut: null, oturumTut: null };
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
    { const T = D2.oturumTut; if (T) { T.geldi = true; await T.kapi; } }
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
/* sentetik katalog (kullanıcı başına): deneme derslerinin HER biri için 90 cevapsız soru (tam TYT/YDT satırları için yeterli); id = kat-<a|b>-<ders>NN */
for (const [kul, on] of [["kul1", "a"], ["kulB", "b"]]) {
  const l = []; for (const s of SINAV_DERS) for (let i = 1; i <= 90; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-${on}-${s}${no}`, s, t: `Mini ${s}`, d: 1 + (i % 3), q: `MINI-${on.toUpperCase()}-${s}${no} sentetik katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(h => `${h} ${no}`) }); }
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
const sifirla = () => { D.istekler.length = 0; D.bitirler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D.dus = []; D.bitir = "tam"; D2.kes = null; D2.kat = "tam"; D2.katIstek = 0; D2.tut = null; D2.oturumTut = null; D3.bitirTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); };
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
const anlik = p => p.evaluate(() => ({ run: !!RUN, ls: localStorage.getItem("ake.run") != null }));
const esit = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const sirali = o => Object.fromEntries(Object.entries(o).sort((x, y) => (x[0] < y[0] ? -1 : 1)));
const secsParca = (secs, n) => secs && secs.length > 0 && secs[0].from === 0 && secs[secs.length - 1].to === n && secs.every((s, i) => s.to > s.from && (i === 0 || s.from === secs[i - 1].to));
/* mini GERÇEK giriş yolları: ana sayfa "Bugünün programı → Mini deneme" ve "Daha fazla → Son deneme" kartındaki mini düğmesi (S.exams boşken de düğme varsa) */
const GIRIS = {
  "ana sayfa gunluk program 'Mini denemesi'": { kur: p => git(p, ""), sel: '.gtask [data-a="quick"][data-k="mini"]' },
  "ana sayfa 'Son deneme' kartı mini düğmesi": { kur: async p => { await git(p, ""); await p.evaluate(() => { document.querySelectorAll("details.more").forEach(d => { d.open = true; }); }); }, sel: 'details.more [data-a="quick"][data-k="mini"]' }
};
const girisYap = async (p, y, alan) => { await y.kur(p); if (alan !== undefined) { await setAlan(p, alan); await y.kur(p); } return tikla(p, y.sel); };

/* sonuç doğrulama (sentetik anahtarla; değerler çıktıya yazılmaz): son S.exams kaydının q.a/x'i bitir yanıtındaki sentetik anahtarla aynı mı, bölüm toplamları n ile uyumlu mu */
const sonucOzet = p => p.evaluate(([anahtar]) => {
  const e = S.exams[S.exams.length - 1]; if (!e) return { var: false };
  const bos = e.qs.filter(q => q.your == null).length, dogru = e.qs.filter(q => q.your != null && q.a === q.your).length;
  return { var: true, n: e.qs.length, bolum: e.sections.map(s => ({ n: s.n, top: s.d + s.y + s.b })), toplam: e.d + e.y + e.b, dogru, d: e.d, anahtarTam: e.qs.every(q => Number.isInteger(q.a) && typeof q.x === "string" && q.x.startsWith("SENTETIK-COZUM-" + q.id)), secs: e.secs, dur: e.dur };
}, [0]);
const bitirTikla = async p => { await p.evaluate(() => { finishRun(false); }); };

/* ---------- deneme merkezi yardımcıları ---------- */
const TURLER = ["TYT", "SAY", "EA", "SOZ", "YDT"], LBL = { full: "", half: " · yarım", quarter: " · mini", custom: " · özel" };
/* UI durumunu kurar ve beklenenleri SAYFADAKİ examRows/EXAMS'tan hesaplar (kod değil sözleşme: satır adedi, bölüm sınırları, auto süre) */
const kur = (p, E) => p.evaluate(e => {
  S.profile.alan = ""; UI.exam.type = e.type; UI.exam.size = e.size; UI.exam.mode = e.mode || "exam"; UI.exam.dur = e.dur == null ? "" : e.dur; UI.exam.unsolved = e.unsolved !== false; UI.exam.custom = Object.assign({}, e.custom || {}); render();
  const rows = examRows(e.type).map(r => ({ sec: r.sec, s: r.s, n: r.n, full: r.full, key: r.key })), ex = EXAMS[e.type], total = rows.reduce((a, r) => a + r.n, 0), full = rows.reduce((a, r) => a + r.full, 0), auto = Math.max(5, Math.round(ex.min * total / full));
  const secs = []; let k = 0; for (const r of rows) { let s = secs[secs.length - 1]; if (!s || s.n !== r.sec) { s = { n: r.sec, from: k, to: k }; secs.push(s); } k += r.n; s.to = k; }
  const ders = {}; rows.forEach(r => { if (r.n) ders[r.s] = (ders[r.s] || 0) + r.n; });
  const durDk = (e.mode || "exam") === "exam" ? ((e.dur == null || e.dur === "") ? auto : Math.max(0, +e.dur || 0)) : ((e.dur == null || e.dur === "") ? 0 : Math.max(0, +e.dur || 0));
  return { type: e.type, ad: ex.n, rows, total, full, auto, secs: secs.filter(x => x.to > x.from), ders, durSn: Math.round(durDk * 60), baslik: ex.n + " denemesi" + ({ full: "", half: " · yarım", quarter: " · mini", custom: " · özel" })[e.size] };
}, E);
const BASLAT = '[data-a="startExam"]';
async function kos(E, { guvenli = true, hazirla = null, tuzak = true } = {}) {
  sifirla(); if (hazirla) hazirla();
  const { c, p } = await sayfa({ guvenli, tuzak }); if (guvenli) await onYukle(p);
  await git(p, "#deneme"); const bek = await kur(p, E), tk = await tikla(p, BASLAT), r = await ozet(p);
  return { c, p, bek, tk, r };
}
const modBek = E => (E.mode || "exam") === "exam" ? "exam" : "practice";
const temiz = r => r.run && r.aVar === 0 && r.xVar === 0 && r.lsA === 0 && !r.domSizinti && !r.lsSizinti;
const katalogMu = r => r.n > 0 && r.ids.every(i => KS.has(i)) && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && r.svN === r.n && r.tekil;

/* =====================  SANITY: bugünkü UI sınırları  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false });
  const o = await p.evaluate(() => { const out = {}; for (const k of Object.keys(EXAMS)) { UI.exam.type = k; UI.exam.size = "full"; const rows = examRows(k); out[k] = { tam: rows.reduce((a, r) => a + r.full, 0), full: rows.reduce((a, r) => a + r.n, 0), half: (UI.exam.size = "half", examRows(k).reduce((a, r) => a + r.n, 0)), q: (UI.exam.size = "quarter", examRows(k).reduce((a, r) => a + r.n, 0)) }; }
    UI.exam.type = "TYT"; UI.exam.size = "custom"; UI.exam.custom = {}; const r0 = examRows("TYT")[0]; ACT.exStep({ k: r0.key, v: "999" }); const ust = UI.exam.custom[r0.key]; ACT.exStep({ k: r0.key, v: "-999" }); const alt = UI.exam.custom[r0.key];
    const dur = document.createElement("div"); return { out, ust, alt, tam0: r0.full, turler: Object.keys(EXAMS), boyutlar: ["full", "half", "quarter", "custom"].length }; });
  t("SANITY", "sınav türleri TYT/SAY/EA/SOZ/YDT", esit(o.turler, ["TYT", "SAY", "EA", "SOZ", "YDT"]), JSON.stringify(o.turler));
  t("SANITY", "en büyük tam deneme 120 soru (TYT); diğerleri 80; 121+ soruluk UI yolu YOK (kapsam dışı)", o.out.TYT.tam === 120 && Object.values(o.out).every(x => x.tam <= 120) && o.out.SAY.tam === 80 && o.out.YDT.tam === 80, JSON.stringify(o.out));
  t("SANITY", "custom satır adedi exStep ile 0..tam kıskaçlı", o.ust === o.tam0 && o.alt === 0, JSON.stringify({ ust: o.ust, alt: o.alt, tam: o.tam0 }));
  t("SANITY", "sentetik katalog her deneme dersinden 90 soru (en büyük satır YDT 80)", SINAV_DERS.every(s => KATALOG.get("kul1").filter(x => x.s === s).length === 90));
  await c.close(); }

/* =====================  [KAPALI] bayrak KAPALI: deneme merkezi eski yol AYNEN  ===================== */
for (const boyut of ["full", "half", "quarter", "custom"]) {
  const { c, bek, tk, r } = await kos({ type: "TYT", size: boyut, mode: "exam", custom: boyut === "custom" ? { "TYT:Türkçe:turkce": 7 } : {} }, { guvenli: false, tuzak: false });
  t("KAPALI", `${boyut}: eski yol aynen (gvn yok, katalog kimliği yok, katalog isteği yok, sınav modu, auto süre, başlık)`, tk && r.run && r.kind === "exam" && r.mode === "exam" && r.gvn === null && r.dur === bek.durSn && r.title === bek.baslik && r.ids.every(i => !KS.has(i)) && D2.katIstek === 0 && D.istekler.every(i => i.mod === "exam"), JSON.stringify({ tk, run: r.run, gvn: r.gvn, dur: r.dur, bek: bek.durSn, baslik: r.title, kat: D2.katIstek }));
  await c.close();
}

/* =====================  [GERÇEK] deneme merkezi düğmeleriyle başlatma (gerçek tıklamalar)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await git(p, "#deneme");
  const ok = [await tikla(p, '[data-a="exType"][data-k="SAY"]'), await tikla(p, '[data-a="exSize"][data-k="custom"]')];
  const rows = await p.evaluate(() => examRows("SAY").map(r => ({ key: r.key, s: r.s, full: r.full })));
    // adımlar yalnız ±1 düğmesiyle: Matematik satırı 2 azalt, Geometri satırı 0'a in (tam kadar −1), Fizik 1 artır
  const adimlar = [[0, -1], [0, -1], ...Array.from({ length: rows[1].full }, () => [1, -1]), [2, 1]];
  for (const [i, adim] of adimlar) ok.push(await tikla(p, `[data-a="exStep"][data-k="${rows[i].key}"][data-v="${adim}"]`));
  ok.push(await tikla(p, '[data-a="exMode"][data-k="exam"]'));
  await p.fill('[data-c="exDur"]', "55"); await p.dispatchEvent('[data-c="exDur"]', "change");
  const bek = await p.evaluate(() => { const rows = examRows("SAY").map(r => ({ sec: r.sec, s: r.s, n: r.n })); const secs = []; let k = 0; for (const r of rows) { let s = secs[secs.length - 1]; if (!s || s.n !== r.sec) { s = { n: r.sec, from: k, to: k }; secs.push(s); } k += r.n; s.to = k; } return { rows, total: rows.reduce((a, r) => a + r.n, 0), secs: secs.filter(x => x.to > x.from), dur: UI.exam.dur, size: UI.exam.size, type: UI.exam.type }; });
  const tk = await tikla(p, BASLAT), r = await ozet(p);
  t("GERÇEK", "gerçek düğmelerle (tür=SAY, uzunluk=özel, ± adımları, sınav modu, süre=55) başlatma: seçilen UI durumu doğrulandı", ok.every(Boolean) && bek.type === "SAY" && bek.size === "custom" && bek.dur === "55", JSON.stringify({ ok, bek: { t: bek.type, s: bek.size, d: bek.dur } }));
  t("GERÇEK", "RUN: yalnız katalog kimlikleri, sunucu oturumlu, tekil; adet = özel dağılım toplamı; sıfırlanan ders (Geometri) RUN'da yok", tk && r.run && katalogMu(r) && r.n === bek.total && !dagilimS(r.ids).geo, JSON.stringify({ tk, run: r.run, n: r.n, bek: bek.total, dag: dagilimS(r.ids) }));
  t("GERÇEK", "RUN.secs = beklenen (boş bölüm düşer), süre 55 dk (3300 sn), sınav modu + başlık '· özel', gvn=studyo (RUN ve ake.run)", esit(r.secs, bek.secs) && r.dur === 3300 && r.mode === "exam" && r.kind === "exam" && r.title === "AYT Sayısal denemesi · özel" && r.gvn === "studyo" && r.lsGvn === "studyo", JSON.stringify({ secs: r.secs, bek: bek.secs, dur: r.dur, mode: r.mode, title: r.title, gvn: r.gvn, ls: r.lsGvn }));
  t("GERÇEK", "yerel kota/AI yok; sunucu SINAV oturumu (mod=exam, {istek,mod,idler}); istenen kimlikler = RUN kimlikleri", D.kota === 0 && D.ai === 0 && D.istekler.length >= 1 && D.istekler.every(i => i.mod === "exam" && esit(i.alanlar, ["idler", "istek", "mod"]) && i.idler.length <= 120) && esit([...new Set(D.istekler.flatMap(i => i.idler))].sort(), r.ids.slice().sort()), JSON.stringify({ kota: D.kota, ai: D.ai, ist: D.istekler.length }));
  await c.close(); }

/* =====================  [MATRİS] türler × boyutlar (sınav modu) + çalışma modu  ===================== */
const OZEL = { TYT: { "TYT:Türkçe:turkce": 3, "TYT:Sosyal Bilimler:tarih": 0, "TYT:Temel Matematik:mat": 12, "TYT:Fen Bilimleri:fizik": 7 }, SAY: { "SAY:Matematik:amat": 5, "SAY:Fizik:afizik": 0, "SAY:Kimya:akimya": 13 }, EA: { "EA:Matematik:amat": 30, "EA:Edebiyat:edebiyat": 1 }, SOZ: { "SOZ:Edebiyat:edebiyat": 0, "SOZ:Tarih:tarih2": 21 }, YDT: { "YDT:İngilizce:ingilizce": 33 } };
for (const type of TURLER) for (const size of ["full", "half", "quarter", "custom"]) {
  const E = { type, size, mode: "exam", custom: size === "custom" ? OZEL[type] : {} };
  const { c, bek, tk, r } = await kos(E, { tuzak: size !== "half" });
  const dag = dagilimS(r.ids);
  t("MATRİS", `${type} ${size} (sınav): ${bek.total} soru yalnız katalog+sunucu oturumlu, ders dağılımı, bölüm sınırları, süre ${bek.durSn} sn, başlık`, tk && r.run && katalogMu(r) && r.n === bek.total && esit(sirali(dag), sirali(bek.ders)) && esit(r.secs, bek.secs) && r.dur === bek.durSn && r.mode === "exam" && r.title === bek.baslik && r.gvn === "studyo" && temiz(r) && secsParca(r.secs, r.n),
    JSON.stringify({ tk, run: r.run, n: r.n, bek: bek.total, kat: katalogMu(r), dag: sirali(dag), bd: sirali(bek.ders), secs: r.secs, bs: bek.secs, dur: r.dur, bdur: bek.durSn, mode: r.mode, title: r.title, gvn: r.gvn, temiz: temiz(r) }));
  t("MATRİS", `${type} ${size} (sınav): sunucu mod=exam, kimlik sayısı ≤120/istek, yerel kota yok`, D.istekler.length >= 1 && D.istekler.every(i => i.mod === "exam" && i.idler.length <= 120) && D.kota === 0 && D.ai === 0, JSON.stringify({ ist: D.istekler.map(i => [i.mod, i.idler.length]), kota: D.kota }));
  await c.close();
}
for (const [type, size, dur, ad] of [["TYT", "full", "", "TYT tam, süre boş→0"], ["SAY", "half", "40", "SAY yarım, 40 dk"], ["EA", "quarter", "0", "EA mini, süresiz (0)"], ["TYT", "custom", "", "TYT özel, süre boş→0"]]) {
  const E = { type, size, mode: "study", dur, custom: size === "custom" ? OZEL[type] : {} };
  const { c, bek, tk, r } = await kos(E);
  t("ÇALIŞMA", `${ad}: çalışma modu: katalog+sunucu oturumlu, sunucu mod=practice (soru kotası), süre ${bek.durSn} sn, bölümler`, tk && r.run && katalogMu(r) && r.n === bek.total && r.mode === "study" && r.kind === "exam" && r.dur === bek.durSn && esit(r.secs, bek.secs) && D.istekler.length >= 1 && D.istekler.every(i => i.mod === "practice" && i.idler.length <= 50) && D.kota === 0 && temiz(r),
    JSON.stringify({ tk, run: r.run, n: r.n, bek: bek.total, mode: r.mode, dur: r.dur, bdur: bek.durSn, secs: r.secs, ist: D.istekler.map(i => [i.mod, i.idler.length]), kota: D.kota }));
  await c.close();
}
{ /* "önce çözmediğim soruları seç": çözülmüşler sona; kapalıyken ise yalnız sıra karışık */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await git(p, "#deneme");
  const cozulen = KATALOG.get("kul1").filter(x => x.s === "turkce").slice(0, 60).map(x => x.id);   // 60 çözülmüş, 30 taze → TYT Türkçe 40 satırı: 30 taze + 10 çözülmüş
  await p.evaluate(ids => { ids.forEach(id => { S.ans[id] = [1, 0, 0, Date.now() - 1000, 1]; }); }, cozulen);
  const bek = await kur(p, { type: "TYT", size: "full", mode: "exam", unsolved: true }); await tikla(p, BASLAT); const r = await ozet(p);
  const turk = r.ids.filter(i => KATID[i] && KATID[i].s === "turkce"), taze = turk.filter(i => !cozulen.includes(i)).length;
  t("MATRİS", "TYT tam, 'önce çözmediklerim' AÇIK: Türkçe satırında 30 taze soru tamamı alınır (60 çözülmüş arasından yalnız 10 tamamlar)", r.run && turk.length === 40 && taze === 30, JSON.stringify({ turk: turk.length, taze }));
  await c.close(); }

/* =====================  [HATA] eksik / boş katalog, kısmi sunucu yanıtı, sunucu hataları  ===================== */
{ const E = { type: "TYT", size: "quarter", mode: "exam" };
  const { c, p, bek, tk, r } = await kos(E, { hazirla: () => { D2.kes = { turkce: 4, mat: 1 }; } });
  const turkTop = 10, matTop = bek.rows.find(x => x.s === "mat").n; const toplam = bek.total - (turkTop - 4) - (matTop - 1);
  const auto = Math.max(5, Math.round(165 * toplam / bek.full));
  t("EKSİK", "eksik katalog (Türkçe 4/10, Mat 1/8): eksik dersler bildirilir, doldurma YOK (BANK/EKQ/AI/g: yok), yalnız mevcut sorularla RUN, bölümler tutarlı", tk && r.run && katalogMu(r) && r.n === toplam && r.toast.some(x => /Türkçe: 4\/10/.test(x) && /Temel Matematik|Matematik: 1\/8/.test(x)) && secsParca(r.secs, r.n) && temiz(r), JSON.stringify({ n: r.n, bek: toplam, toast: r.toast, secs: r.secs }));
  t("EKSİK", "eksik katalogda süre gerçek soru sayısına göre (mini sözleşmesi): auto = max(5, round(ex.min·adet/tam))", r.run && r.dur === auto * 60, JSON.stringify({ dur: r.dur, auto }));
  await c.close(); }
{ /* katalog HAZIR ama seçilen deneme (SAY) derslerinin hiçbirinden soru yok → toplam 0 */
  const { c, tk, r } = await kos({ type: "SAY", size: "half", mode: "exam" }, { hazirla: () => { D2.kes = Object.fromEntries(["amat", "geo", "afizik", "akimya", "abiyoloji"].map(s => [s, 0])); } });
  t("EKSİK", "katalog hazır ama denemenin derslerinden soru yok (toplam 0): RUN AÇILMAZ, 'bulunamadı' bildirimi, sunucu oturumu/yerel kota/AI yok", tk && !r.run && r.toast.some(x => /bulunamadı/.test(x)) && D.istekler.length === 0 && D.kota === 0 && D.ai === 0, JSON.stringify({ run: r.run, toast: r.toast, ist: D.istekler.length }));
  await c.close(); }
{ const { c, tk, r } = await kos({ type: "SAY", size: "custom", mode: "exam", custom: Object.fromEntries(["SAY:Matematik:amat", "SAY:Matematik:geo", "SAY:Fizik:afizik", "SAY:Kimya:akimya", "SAY:Biyoloji:abiyoloji"].map(k => [k, 0])) });
  t("EKSİK", "özel dağılım toplamı 0: düğme devre dışı; tıklama RUN açmaz, istek yok", !tk && !r.run && D.istekler.length === 0, JSON.stringify({ tk, run: r.run }));
  await c.close(); }
for (const [mod, ek] of [["kismi5", "yalnız ilk 5"], ["ilkEksik", "ilk soru eksik"]]) {
  const { c, tk, r, bek } = await kos({ type: "SAY", size: "half", mode: "exam" }, { hazirla: () => { D.oturum = mod; } });
  const bekN = mod === "kismi5" ? 5 : bek.total - 1;
  t("EKSİK", `KISMİ sunucu yanıtı (${ek}): yalnız sunulan sorularla RUN, kalan yerelle DOLDURULMAZ, secs kısmi sete göre kurulu, açık bildirim, yerel kota yok`, tk && r.run && r.n === bekN && r.svN === r.n && r.bankN === 0 && r.genN === 0 && r.tuzakN === 0 && secsParca(r.secs, r.n) && D.kota === 0 && temiz(r) && (r.toast.length > 0 || r.modal !== ""), JSON.stringify({ tk, run: r.run, n: r.n, bek: bekN, svN: r.svN, secs: r.secs, kota: D.kota, toast: r.toast }));
  await c.close();
}
for (const mod of ["bos", "404", "banka_yok", "500", "402", "401", "429", "ag"]) for (const modu of ["exam", "study"]) {
  const { c, tk, r } = await kos({ type: "SAY", size: "quarter", mode: modu }, { hazirla: () => { D.oturum = mod; } });
  const beklenenModal = mod === "402" ? (modu === "exam" ? "Bu ayki ücretsiz denemen bitti" : "Bugünkü ücretsiz sorun bitti") : mod === "401" ? "Devam etmek için ücretsiz giriş yap" : null;
  t("HATA", `sunucu ${mod} (${modu} modu): RUN AÇILMAZ (cevaplı yerel fallback yok), yerel kota/AI yok${beklenenModal ? ", pencere '" + beklenenModal + "'" : ""}`, tk && !r.run && r.yerelA === 0 && D.kota === 0 && D.ai === 0 && (beklenenModal ? r.modal === beklenenModal : (r.modal !== "" || r.toast.length > 0)), JSON.stringify({ tk, run: r.run, modal: r.modal, toast: r.toast, kota: D.kota }));
  await c.close();
}
{ const { c, tk, r } = await kos({ type: "SAY", size: "quarter", mode: "exam" }, { hazirla: () => { D2.kat = "500"; } });
  t("HATA", "katalog yüklenemedi (500): deneme RUN açmaz (yerel BANK/EKQ/AI karması yok), sunucu oturum isteği ve yerel kota yok", !r.run && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ tk, run: r.run, ist: D.istekler.length }));
  await c.close(); }

/* =====================  [YARIŞ] katalog/oturum beklerken UI, hesap, çıkış, bayrak, eski RUN  ===================== */
const bekleBaslat = async (hazir) => { sifirla(); const G = kapiYap(); D2.tut = G; const { c, p } = await sayfa({ guvenli: true, tuzak: true }); await git(p, "#deneme"); const bek = await kur(p, hazir); await tikla(p, BASLAT); await p.waitForTimeout(400); return { c, p, G, bek }; };
{ const secim = { type: "TYT", size: "half", mode: "exam", dur: "", custom: {} };
  const { c, p, G, bek } = await bekleBaslat(secim);
  const once = await ozet(p), ani = await anlik(p);   // katalog yanıtı HENÜZ bırakılmadı: oturum/yerel kota/AI sayaçları ve RUN/ake.run kaydedilir
  const bekSay = { oturum: D.istekler.length, kota: D.kota, ai: D.ai, katIstek: D2.katIstek };
  // kapı kapalıyken UI'daki seçimleri DEĞİŞTİR: tür/boyut/mod/süre/özel/çözülmemiş
  await p.evaluate(() => { UI.exam.type = "SAY"; UI.exam.size = "custom"; UI.exam.custom = { "SAY:Matematik:amat": 2 }; UI.exam.mode = "study"; UI.exam.dur = "9"; UI.exam.unsolved = false; render(); });
  G.ac(); await onYukle(p); await p.waitForTimeout(900); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken tıklama: RUN hemen açılmaz, 'yükleniyor' bildirimi, yerel RUN/istek yok", !once.run && !ani.run && !ani.ls && once.toast.some(x => /Soru kataloğu yükleniyor/.test(x)) && bekSay.katIstek >= 1 && bekSay.oturum === 0 && bekSay.kota === 0 && bekSay.ai === 0, JSON.stringify({ run: once.run, ake_run: ani.ls, toast: once.toast, ...bekSay }));
  t("YARIŞ", "bekleme sırasında UI'da tür/boyut/mod/süre/özel adet DEĞİŞTİ: açılan RUN TIKLAMA ANINDAKİ seçimle (TYT yarım, sınav, auto süre) açılır", r.run && katalogMu(r) && r.n === bek.total && r.title === bek.baslik && r.mode === "exam" && r.dur === bek.durSn && esit(r.secs, bek.secs) && esit(sirali(dagilimS(r.ids)), sirali(bek.ders)), JSON.stringify({ run: r.run, n: r.n, bek: bek.total, title: r.title, bt: bek.baslik, mode: r.mode, dur: r.dur, bd: bek.durSn }));
  await c.close(); }
{ /* custom seçim kopyası bağımsız: beklerken AYNI nesnedeki bir ders adedi değiştirilir (nesne yerine koyulmaz) */
  sifirla(); const G = kapiYap(); D2.tut = G; const { c, p } = await sayfa({ guvenli: true, tuzak: true }); await git(p, "#deneme");
  const ks = await p.evaluate(() => examRows("SAY").map(r => r.key)), bek = await kur(p, { type: "SAY", size: "custom", mode: "exam", dur: "", custom: { [ks[0]]: 3, [ks[2]]: 2 } });
  await tikla(p, BASLAT); await p.waitForTimeout(400);
  await p.evaluate(k => { UI.exam.custom[k[0]] = 7; UI.exam.custom[k[2]] = 0; render(); }, ks);   // aynı nesne içinde değişiklik
  const uiToplam = await p.evaluate(() => examRows("SAY").reduce((a, r) => a + r.n, 0));   // değişiklik gerçekten UI toplamını değiştirdi mi (test geçerliliği)
  G.ac(); await onYukle(p); await p.waitForTimeout(900); const r = await ozet(p);
  t("YARIŞ", "custom: bekleme sırasında AYNI UI.exam.custom nesnesinde ders adedi değişti: açılan dağılım tıklama anındaki ilk seçimle eşleşir (kopya bağımsız)", r.run && katalogMu(r) && uiToplam !== bek.total && r.n === bek.total && r.title === bek.baslik && esit(r.secs, bek.secs) && esit(sirali(dagilimS(r.ids)), sirali(bek.ders)), JSON.stringify({ run: r.run, n: r.n, bek: bek.total, uiToplam, dag: dagilimS(r.ids), bd: bek.ders }));
  await c.close(); }
{ const { c, p, G } = await bekleBaslat({ type: "SAY", size: "half", mode: "exam" });
  await c.addCookies([{ name: "oturum", value: "kulB", url: URL0 }]); await p.evaluate(() => { hesapKimlikGuncelle({ id: "kulB", eposta: "kulB@x.test", ad: "" }); return hesapEsitle(); }); await p.waitForTimeout(500);
  G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken HESAP DEĞİŞİMİ (kul1→kulB): eski hesabın bekleyen eylemi RUN açamaz; kul1 kimliği/istek yok", !(r.run && r.ids.some(i => KS.has(i))) && D.istekler.every(i => !i.idler.some(x => KS.has(x))), JSON.stringify({ run: r.run, n: r.n, ist: D.istekler.length }));
  await c.close(); }
{ const { c, p, G } = await bekleBaslat({ type: "SAY", size: "half", mode: "exam" });
  await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken ÇIKIŞ: bekleyen deneme RUN açamaz, sunucu oturumu açılmaz", !r.run && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ run: r.run, ist: D.istekler.length, cikis: D3.cikisGeldi }));
  await c.close(); }
{ const { c, p, G } = await bekleBaslat({ type: "SAY", size: "half", mode: "exam" });
  await p.evaluate(() => { window.AKE_KATALOG_STUDYO = false; }); G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken BAYRAK KAPANDI: güvenli eylem iptal, yerel RUN'a DÖNÜŞMEZ ('Güvenli mod kapandı' bildirimi), istek/yerel kota yok", !r.run && r.toast.some(x => /Güvenli mod kapandı/.test(x)) && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ run: r.run, toast: r.toast, ist: D.istekler.length }));
  await c.close(); }
{ /* eski İŞARETSİZ RUN: ezilmez, yeni oturum/katalog yükleme isteği yok */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await eskiRunKur(p, null); const r0 = await ozet(p); await git(p, "#deneme"); await kur(p, { type: "SAY", size: "half", mode: "exam" }); D.istekler.length = 0;
  await tikla(p, BASLAT); await p.waitForTimeout(500); const r = await ozet(p);
  t("YARIŞ", "eski işaretsiz yerel RUN varken deneme başlatma: RUN (id, cevaplar) değişmez, sunucu oturumu/yerel kota yok", r.run && r.id === r0.id && r.ans === r0.ans && r.gvn === null && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ id: r.id, id0: r0.id, ans: r.ans, gvn: r.gvn, ist: D.istekler.length }));
  await c.close(); }
{ /* açık GÜVENLİ RUN: üzerine yazılmadan önce onay penceresi */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await git(p, "#deneme"); await kur(p, { type: "SAY", size: "quarter", mode: "exam" }); await tikla(p, BASLAT); const r0 = await ozet(p);
  D.istekler.length = 0; await p.evaluate(() => { UI.inRun = false; render(); }); await git(p, "#deneme"); await kur(p, { type: "TYT", size: "quarter", mode: "exam" }); await tikla(p, BASLAT); await p.waitForTimeout(500); const r1 = await ozet(p);
  t("YARIŞ", "açık güvenli RUN varken yeni deneme: 'Yarım kalan oturum var' penceresi, RUN ONAY OLMADAN değişmez, yeni oturum isteği yok", r0.run && r1.run && r1.id === r0.id && r1.modal === "Yarım kalan oturum var" && D.istekler.length === 0, JSON.stringify({ id0: r0.id, id1: r1.id, modal: r1.modal, ist: D.istekler.length }));
  await p.evaluate(() => { ACT.runReplace(); }); const r2 = await ozet(p);
  t("YARIŞ", "onaylanınca (runReplace) yeni güvenli deneme açılır: TYT, katalog+sunucu, eski RUN değişir", r2.run && r2.id !== r0.id && /TYT/.test(r2.title) && katalogMu(r2) && r2.gvn === "studyo", JSON.stringify({ run: r2.run, title: r2.title, gvn: r2.gvn }));
  await c.close(); }
{ /* çift tıklama: tek oturum */
  sifirla(); const { c, p } = await sayfa({ guvenli: true, tuzak: false }); await onYukle(p); await git(p, "#deneme"); const bek = await kur(p, { type: "SAY", size: "half", mode: "exam" });
  await p.evaluate(() => { const d = document.querySelector('[data-a="startExam"]'); d.click(); d.click(); }); const r = await ozet(p);
  t("YARIŞ", "çift tıklama: tek RUN, sunucu oturum isteği SAYISI = tek denemenin parça sayısı (1)", r.run && r.n === bek.total && D.istekler.length === 1, JSON.stringify({ n: r.n, ist: D.istekler.length }));
  await c.close(); }

/* ---- /oturum yanıtı bekletilirken hesap/çıkış/bayrak (katalog hazır; istek GERÇEKTEN sunucuya ulaştıktan sonra) ---- */
const oturumBekle = async () => { sifirla(); const G = kapiYap(); D2.oturumTut = G; const { c, p } = await sayfa({ guvenli: true, tuzak: true }); await onYukle(p); await git(p, "#deneme");
  const bek = await kur(p, { type: "SAY", size: "half", mode: "exam" }); await tikla(p, BASLAT); const geldi = await bekle(() => D.istekler.length >= 1 && G.geldi, 4000); const ani = await anlik(p);
  return { c, p, G, bek, geldi, ani }; };
const yazmadi = (r, ls) => !r.run && !ls && D.kota === 0 && D.ai === 0 && D.cevap === 0;
const hesapDegis = async (c, p, kul) => { await gec(c, p, kul); await p.evaluate(() => hesapEsitle()); await p.waitForTimeout(400); };
{ const { c, p, G, geldi, ani } = await oturumBekle();
  await hesapDegis(c, p, "kulB"); G.ac(); await bekle(() => false, 1500); const r = await ozet(p), a2 = await anlik(p);
  t("OTURUM-YARIŞ", "oturum yanıtı beklerken A→B: istek sunucuya ulaştı, eski yanıt yeni hesaba RUN/ake.run/kota/AI yazmaz", geldi && !ani.run && !ani.ls && yazmadi(r, a2.ls), JSON.stringify({ geldi, bekRun: ani.run, run: r.run, ls: a2.ls, kota: D.kota, ai: D.ai }));
  await c.close(); }
{ const { c, p, G, geldi, ani } = await oturumBekle();
  await hesapDegis(c, p, "kulB"); await hesapDegis(c, p, "kul1"); G.ac(); await bekle(() => false, 1500); const r = await ozet(p), a2 = await anlik(p);
  t("OTURUM-YARIŞ", "oturum yanıtı beklerken A→B→A: aynı hesaba dönülse de eski (ilk) yanıt RUN/ake.run/kota/AI yazmaz", geldi && !ani.run && !ani.ls && yazmadi(r, a2.ls), JSON.stringify({ geldi, bekRun: ani.run, run: r.run, ls: a2.ls, kota: D.kota, ai: D.ai }));
  await c.close(); }
{ const { c, p, G, geldi, ani } = await oturumBekle();
  await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G.ac(); await bekle(() => false, 1500); const r = await ozet(p), a2 = await anlik(p);
  t("OTURUM-YARIŞ", "oturum yanıtı beklerken ÇIKIŞ: eski yanıt RUN/ake.run/kota/AI yazmaz", geldi && !ani.run && !ani.ls && D3.cikisGeldi && yazmadi(r, a2.ls), JSON.stringify({ geldi, cikis: D3.cikisGeldi, run: r.run, ls: a2.ls, kota: D.kota, ai: D.ai }));
  await c.close(); }
{ const { c, p, G, geldi, ani } = await oturumBekle();
  await p.evaluate(() => { window.AKE_KATALOG_STUDYO = false; }); G.ac(); await bekle(() => false, 1500); const r = await ozet(p), a2 = await anlik(p);
  // sözleşme: güvenli oturum TAMAMLANABİLİR (RUN yalnız gvn=studyo, katalog+sunucu, cevapsız) veya İPTAL OLABİLİR; işaretsiz yerel RUN / yerel fallback / yerel kota OLUŞMAZ
  const guvenliBitti = r.run && r.gvn === "studyo" && r.lsGvn === "studyo" && katalogMu(r) && r.aVar === 0 && r.xVar === 0 && r.yerelN === 0, iptal = !r.run && !a2.ls;
  t("OTURUM-YARIŞ", `oturum yanıtı beklerken BAYRAK KAPANDI: ya güvenli RUN tamamlanır ya iptal; işaretsiz yerel RUN/fallback/yerel kota/AI yok (gözlenen: ${guvenliBitti ? "güvenli RUN tamamlandı" : iptal ? "iptal" : "BEKLENMEYEN"})`, geldi && !ani.run && (guvenliBitti || iptal) && r.yerelN === 0 && r.yerelA === 0 && D.kota === 0 && D.ai === 0, JSON.stringify({ geldi, run: r.run, gvn: r.gvn, lsGvn: r.lsGvn, yerelN: r.yerelN, aVar: r.aVar, ls: a2.ls, kota: D.kota, ai: D.ai }));
  await c.close(); }

/* =====================  [BİTİŞ] bitirme, yenilemeden sürdürme  ===================== */
{ sifirla(); const { c, p, bek, r } = await kos({ type: "SAY", size: "half", mode: "exam" }, { tuzak: false });
  await p.evaluate(() => { RUN.ans[0] = 1; RUN.ans[1] = 2; saveRun(); });
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); await p.waitForTimeout(500);
  const y = await ozet(p);
  t("BİTİŞ", "yenileme: RUN ake.run'dan döner; gvn=studyo, secs, süre, cevaplar korunur; anahtar/çözüm sızıntısı yok", y.run && y.id === r.id && y.gvn === "studyo" && esit(y.secs, bek.secs) && y.dur > 0 && y.dur <= bek.durSn && y.ans === 2 && y.aVar === 0 && y.xVar === 0 && !y.domSizinti && !y.lsSizinti, JSON.stringify({ run: y.run, id: y.id, id0: r.id, gvn: y.gvn, secs: y.secs, dur: y.dur, ans: y.ans, aVar: y.aVar }));
  await bitirTikla(p); await bekle(() => D.bitirler.length >= 1, 4000); await p.waitForTimeout(600); const so = await sonucOzet(p), y2 = await ozet(p);
  t("BİTİŞ", "bitirme: sunucudan anahtar gelir; sonuç yazılır; bölüm toplamları secs ile uyumlu; sorular katalog kimlikli; RUN kapanır, ake.run temizlenir", so.var && so.n === bek.total && so.toplam === bek.total && esit(so.bolum.map(s => s.n), bek.secs.map(s => s.n)) && so.bolum.every((s, i) => s.top === bek.secs[i].to - bek.secs[i].from) && so.anahtarTam && !y2.run && y2.lsId === null, JSON.stringify({ so: { var: so.var, n: so.n, top: so.toplam, bolum: so.bolum, ak: so.anahtarTam }, bek: bek.secs, run: y2.run, ls: y2.lsId }));
  t("BİTİŞ", "bitir isteği yalnız cevap/oturum alanlarını gönderir (sorular katalog kimlikli); yerel puanlama yok", D.bitirler.length >= 1 && D.bitirler.every(b => Array.isArray(b.cevaplar)), JSON.stringify({ b: D.bitirler.length }));
  await c.close(); }
{ /* çalışma modu: svCevap (sunucu /cevap), bitir */
  sifirla(); const { c, p, bek, r } = await kos({ type: "EA", size: "quarter", mode: "study" }, { tuzak: false });
  await p.evaluate(() => { UI.inRun = true; render(); }); await p.evaluate(() => { ACT.pick({ o: 1 }); }); await bekle(() => D.cevap >= 1, 3000); await p.waitForTimeout(400);
  const y = await ozet(p);
  t("BİTİŞ", "çalışma modu: cevap sunucuya (/api/soru/cevap) gider; çözüm yalnız cevaplanan soru için gelir (diğerlerinde a/x yok)", r.run && D.cevap >= 1 && y.run && y.xVar <= 1 && y.aVar <= 1 && D.kota === 0, JSON.stringify({ cevap: D.cevap, aVar: y.aVar, xVar: y.xVar, kota: D.kota }));
  await c.close(); }

/* =====================  [MİNİ] mevcut quick mini akışı korunur  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await onYukle(p); await git(p, ""); await setAlan(p, "SAY"); await git(p, "");
  const tk = await tikla(p, '.gtask [data-a="quick"][data-k="mini"]'), r = await ozet(p);
  t("MİNİ", "ana sayfa 'Mini deneme' (bayrak açık): katalog+sunucu oturumlu çeyrek deneme, başlık '· mini', gvn=studyo", tk && r.run && katalogMu(r) && /mini/.test(r.title) && r.gvn === "studyo" && r.mode === "exam", JSON.stringify({ tk, run: r.run, title: r.title, gvn: r.gvn }));
  await c.close(); }
{ /* mini seçimi de tıklama anında sabitlenir */
  sifirla(); const G = kapiYap(); D2.tut = G; const { c, p } = await sayfa({ guvenli: true }); await git(p, ""); await setAlan(p, "SAY"); await git(p, "");
  const bek = await beklenen(p, "SAY"); await tikla(p, '.gtask [data-a="quick"][data-k="mini"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { UI.exam.size = "full"; UI.exam.type = "TYT"; UI.exam.mode = "study"; render(); }); G.ac(); await onYukle(p); await p.waitForTimeout(900); const r = await ozet(p);
  t("MİNİ", "mini: katalog beklerken UI'da tür/boyut/mod değişse de açılan RUN SAY çeyrek sınav (tıklama anı)", r.run && r.n === bek.total && /AYT Sayısal/.test(r.title) && r.mode === "exam", JSON.stringify({ run: r.run, n: r.n, bek: bek.total, title: r.title, mode: r.mode }));
  await c.close(); }

console.log(`\nTOPLAM: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) { console.log("KIRMIZI:"); kirmizi.forEach(k => console.log("  - " + k)); }
await b.close(); srv.close(); process.exit(kalan > 0 ? 1 : 0);
