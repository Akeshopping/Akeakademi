// B4 3C-4h · katalog GET BEKLEYEN bütün güvenli girişler (studyoGirisCalistir: topicStart, dersKarisik, karma, mini, koç testi, yanlış tekrarı, benzerini çöz) BAYRAK KAPANMA YARIŞI — gerçek Chromium + SAHTE API (Production/Preview/D1'e dokunmaz; CI'a EKLENMEZ).
// Taban B4 10db8ddc56e3534c4c44bfebe0ff9c8c4d686eb3. SÖZLEŞME: bayrak (AKE_KATALOG_STUDYO) AÇIKKEN başlatılıp katalog GET beklerken kapanırsa bekleyen güvenli eylem İPTAL edilir (açık mesaj); RUN, ake.run, sunucu oturumu, yerel kota ve AI isteği OLUŞMAZ;
//   güvenli cfg sessizce işaretsiz (yerel) cfg'ye DÖNÜŞMEZ. Doğrudan çağrılabilen güvenli çekirdekler (studyoCek/KarmaCek/MiniCek/KocCek/MistCek/BenzerCek, studyoBaslat) bayrak kapalıyken de RUN açmaz. Bayrak hiç açılmadan kullanılan eski yerel yollar AYNEN korunur.
//   Hesap A→B→A ve çıkış sırasında geç yanıt yeni hesaba RUN açamaz. Cevap anahtarı DEĞERLERİ çıktıya yazılmaz (sentetik; yalnız kimlik/sayı/varlık). Çalıştırma: node tests/studyo-bekleyen-yaris-istemci.mjs · çıkış kodu: kırmızı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 460)); };
const bilgi = (ad, v) => console.log("BİLGİ ", ad, typeof v === "string" ? v : JSON.stringify(v));

const D = { dus: [], oturum: "tam", bitir: "tam", istekler: [], bitirler: [], kota: 0, ai: 0, cevap: 0 };   // oturum: tam|ilkEksik|kismi5|bos|404|banka_yok|500|402|401|429|ag  ·  bitir: tam|500|410|ag
const D2 = { kat: "tam", katIstek: 0, kes: null, tut: null };
const D4 = { oturumTut: null, kota: { sinirsiz: true } };
const D5 = { aiTut: null };   // /api/ai yanıtını bekletme kapısı
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
    D2.katIstek++; if (D2.tut) await D2.tut.kapi; if (!kul) return js(r, 401, {}); if (D2.kat === "404") return js(r, 404, {}); if (D2.kat === "500") return js(r, 500, {}); if (D2.kat === "bos") return js(r, 200, { n: 0, bayrak: "hazir", beklenen: { toplam: 0, os: 0, fix: 0 }, sorular: [], sonraki: null });
    let l = (KATALOG.get(kul) || []).map(x => ({ ...x }));
    if (D2.kes) { const say = {}; l = l.filter(x => { if (!(x.s in D2.kes)) return true; say[x.s] = (say[x.s] || 0) + 1; return say[x.s] <= D2.kes[x.s]; }); }
    return js(r, 200, { n: l.length, bayrak: "hazir", beklenen: { toplam: l.length, os: 0, fix: 0 }, sorular: l, sonraki: null });
  }
  if (f === "/api/hesap/veri") return js(r, 200, { alanlar: {} });
  if (f === "/api/hesap/kota") { const b = await govde(q); D.kota++; return js(r, 200, { verildi: b.adet || 1, kalanSoru: 500, kalanDeneme: 5 }); }
  if (f === "/api/ai") {
    const b = await govde(q); D.ai++; { const T = D5.aiTut; if (T && !T.tuttu) { T.tuttu = true; await T.kapi; } }
    const m = JSON.stringify(b.messages || "");
    if (/bağımsız olarak/.test(m)) return js(r, 200, { text: JSON.stringify([1, 1, 1]) });
    return js(r, 200, { text: JSON.stringify([1, 2, 3].map(i => ({ p: "", q: "AI-SENTETIK-SORU-" + i, o: ["a", "b", "c", "d", "e"].map(h => h + i), a: 1, x: "AI-SENTETIK-COZUM-" + i }))) });
  }
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
const sifirla = () => { D.istekler.length = 0; D.bitirler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; D.oturum = "tam"; D.dus = []; D.bitir = "tam"; D2.kes = null; D2.tut = null; D2.kat = "tam"; D2.katIstek = 0; D3.bitirTut = null; D3.cikisTut = null; D3.cikisGeldi = false; D3.gecerli = new Set(["kul1", "kulB"]); D4.oturumTut = null; D4.kota = { sinirsiz: true }; D5.aiTut = null; };
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

/* ---- 3C-4g araçları ---- */
const bz = (p, id) => p.evaluate(id => ACT.benzerMist({ id }), id);
const bs = async (p, id) => { await bz(p, id); return ozet(p); };
const aiKur = p => p.evaluate(() => { AI.fn = webAI(); AI.off = false; });
const aiQn = p => p.evaluate(() => S.aiQs.length);
const bayrak = (p, v) => p.evaluate(v => { window.AKE_KATALOG_STUDYO = v; }, v);
const bT = (r, n) => r.run && r.n === n && r.gvn === "studyo" && r.lsGvn === "studyo" && r.kind === "benzer" && r.mode === "study" && r.svN === n && r.yerelN === 0 && r.aVar === 0 && r.xVar === 0 && r.lsA === 0 && !r.domSizinti && !r.lsSizinti && r.genN === 0 && r.bankN === 0 && r.tuzakN === 0;
const yerelYok = r => !r.run || (r.gvn === "studyo" && r.yerelN === 0 && r.aVar === 0 && r.genN === 0 && r.bankN === 0 && r.tuzakN === 0);
const AIMODAL = "AI ile benzer soru üretilsin mi?";

const bankKonu = p => p.evaluate(() => { const c = {}; BANK.forEach(q => { const k = q.s + "\u0001" + q.t; (c[k] = c[k] || []).push(q.id); }); const e = Object.entries(c).filter(([, l]) => l.length >= 6).sort(([a], [b2]) => (a < b2 ? -1 : 1))[0]; return e ? { s: e[0].split("\u0001")[0], t: e[0].split("\u0001")[1], ids: e[1] } : null; });
const bankMistKur = (p, bk) => p.evaluate(bk => { const q = BANK.find(x => x.id === bk.ids[0]); S.mistakes[q.id] = { q: snap(q), n: 1, ts: Date.now(), ok: 0, learned: false, last: 0, dk: dayKey() }; render(); }, bk);
const katIdler = (r, KS_) => r.ids.length > 0 && r.ids.every(i => KS_.has(i));
const topicOf = ids => { const d = {}, k = {}; ids.forEach(i => { const q = KATID[i]; if (q) { d[q.s] = (d[q.s] || 0) + 1; k[q.t] = (k[q.t] || 0) + 1; } }); return { d, k }; };
const gecerliBank = async () => { const { c, p } = await sayfa({ guvenli: false, tuzak: false }); const bk = await bankKonu(p); await c.close(); if (!bk) { console.error("TEST GEÇERSİZ: ≥6 soruluk BANK konusu yok"); process.exit(2); } return bk; };
const BK0 = await gecerliBank();

/* ---- 3C-4h araçları ---- */
const m3 = [1, 2, 3].map(i => ({ id: kk(i), ts: BIRLIK(i) }));
const yerelYok2 = r => !r.run || (r.gvn === "studyo" && r.yerelN === 0 && r.aVar === 0 && r.genN === 0 && r.bankN === 0 && r.tuzakN === 0);
const MESAJ = /iptal/i;
const ENT = [
  ["topicStart", p => p.evaluate(([s, t]) => { ACT.topicStart({ s, t }); }, [S0, TA])],
  ["dersKarisik", p => p.evaluate(s => { OZ_ACT.dersKarisik({ s }); }, S0)],
  ["karma", p => p.evaluate(() => { ACT.quick({ k: "mix" }); })],
  ["mini", p => p.evaluate(() => { ACT.quick({ k: "mini" }); })],
  ["kocTest", p => p.evaluate(([s, t]) => { ACT.kocTest({ s, t }); }, [S0, TA])],
  ["mistOne", p => p.evaluate(id => { ACT.mistOne({ id }); }, kk(2))],
  ["mistStart", p => p.evaluate(() => { ACT.mistStart(); })],
  ["mistDue", p => p.evaluate(() => { ACT.mistDue(); })],
  ["benzerMist", p => p.evaluate(id => { ACT.benzerMist({ id }); }, kk(2))]
];
const KATLAR = ["tam", "404", "bos"];
const cagir = (ad, p) => ENT.find(x => x[0] === ad)[1](p);
const KAPALI = { tam: [MESAJ], "404": [/iptal|yüklenemedi|hazır değil/i], bos: [/iptal|yüklenemedi|hazır değil/i] };

/* =====================  SANITY  ===================== */
for (const [ad] of ENT) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, m3); await cagir(ad, p); const r = await ozet(p);
  t("SANITY", `${ad}: bayrak AÇIK ve katalog hazırken güvenli RUN açılır (gvn='studyo', sunucu oturumlu, cevapsız) — ön koşul`, r.run && r.gvn === "studyo" && r.n >= 1 && r.svN === r.n && r.yerelN === 0 && r.aVar === 0, JSON.stringify({ run: r.run, gvn: r.gvn, kind: r.kind, n: r.n, sv: r.svN, yerel: r.yerelN, modal: r.modal }));
  await c.close();
}

/* =====================  KAPANMA: katalog GET beklerken bayrak kapanır (her giriş × tam / 404 / boş)  ===================== */
for (const [ad] of ENT) for (const kat of KATLAR) {
  sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await aiKur(p); await mistKur(p, m3); D2.kat = kat; D2.tut = G; const bn = await aiQn(p);
  await cagir(ad, p); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p);
  await bayrak(p, false); G.ac(); await p.waitForTimeout(1800); const r = await ozet(p);
  const on = !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && D2.katIstek >= 1;
  t("KAPANMA", `${ad}: katalog GET beklerken bayrak KAPANIR (yanıt '${kat}'): RUN, ake.run, sunucu oturumu, yerel kota, AI ve S.aiQs yazımı YOK (ön koşul: beklerken 'yükleniyor', RUN yok)`,
    on && !r.run && r.lsId === null && D.istekler.length === 0 && D.kota === 0 && D.ai === 0 && (await aiQn(p)) === bn, JSON.stringify({ on, run: r.run, gvn: r.gvn, kind: r.kind, ls: r.lsId, ist: D.istekler.length, kota: D.kota, ai: D.ai }));
  t("KAPANMA", `${ad}: bayrak kapanınca (yanıt '${kat}') kullanıcıya açık mesaj verilir`, r.toast.some(m => KAPALI[kat].some(x => x.test(m))), JSON.stringify({ toast: r.toast.slice(-2) }));
  await c.close();
}

/* =====================  ÇEKİRDEK: doğrudan çağrılabilen güvenli çekirdekler bayrak kapalıyken RUN açmaz  ===================== */
const CEK = [
  ["studyoCek", p => p.evaluate(([s, t]) => { studyoCek(s, t, { n: 5, d: 0 }); }, [S0, TA])],
  ["studyoKarmaCek", p => p.evaluate(() => { studyoKarmaCek(); })],
  ["studyoMiniCek", p => p.evaluate(() => { studyoMiniCek(); })],
  ["studyoKocCek", p => p.evaluate(([s, t]) => { studyoKocCek(s, t); }, [S0, TA])],
  ["studyoBaslat", p => p.evaluate(s => { UI.studio.s = s; studyoBaslat(); }, S0)],
  ["studyoMistCek", p => p.evaluate(() => { studyoMistCek(Object.keys(S.mistakes), "Yanlış tekrarı"); })],
  ["studyoBenzerCek", p => p.evaluate(([id, s, tp]) => { studyoBenzerCek(id, s, tp); }, [kk(2), S0, TA])]
];
for (const [ad, f] of CEK) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, m3); await aiKur(p); await p.evaluate(() => { window.__t.length = 0; }); await bayrak(p, false); await f(p); await p.waitForTimeout(700); const r = await ozet(p);
  t("ÇEKİRDEK", `${ad}: bayrak kapalıyken doğrudan çağrılırsa işaretsiz yerel RUN açılmaz, ake.run/oturum/kota/AI yok, iptal mesajı var`, !r.run && r.lsId === null && D.istekler.length === 0 && D.kota === 0 && D.ai === 0 && r.toast.some(m => MESAJ.test(m)), JSON.stringify({ run: r.run, gvn: r.gvn, kind: r.kind, ist: D.istekler.length, kota: D.kota, toast: r.toast.slice(-2) }));
  await c.close();
}

/* =====================  OTURUM: sunucu oturumu isteği uçuştayken bayrak kapanır  ===================== */
for (const [ad] of ENT) for (const kip of ["404", "bos", "tam"]) {
  sifirla(); const G = kapiYap(); D4.oturumTut = G; const { c, p } = await sade(); await onYukle(p); await mistKur(p, m3); D.oturum = kip;
  await cagir(ad, p); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await bayrak(p, false); G.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("OTURUM", `${ad}: oturum isteği uçuştayken bayrak KAPANIR (yanıt '${kip}'): yerel RUN/yerel kota/AI yok; ${kip === "tam" ? "açılan RUN güvenlidir" : "RUN yok"}`, pre === 1 && yerelYok2(r) && (kip === "tam" ? (r.run ? r.gvn === "studyo" && r.svN === r.n : true) : !r.run) && D.kota === 0 && D.ai === 0, JSON.stringify({ pre, run: r.run, gvn: r.gvn, sv: r.svN, n: r.n, kota: D.kota }));
  await c.close();
}

/* =====================  YARIŞ: hesap A→B, A→B→A ve çıkış (katalog GET beklerken)  ===================== */
for (const [ad] of ENT) {
  sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, m3); D2.tut = G;
  await cagir(ad, p); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p); await hesapDegis(c, p, "kulB"); G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", `${ad}: katalog beklerken hesap kul1→kulB: eski eylem kulB'de RUN AÇAMAZ, yerel kota/AI yok (ön koşul: 'yükleniyor', RUN yok)`, !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && !(r.run && r.ids.some(i => KS.has(i))) && D.kota === 0 && D.ai === 0, JSON.stringify({ r1: r1.run, r: r.run, kota: D.kota }));
  await c.close();
  sifirla(); const G2 = kapiYap(); const q = await sade("#yanlislar"); await mistKur(q.p, m3); D2.tut = G2;
  await cagir(ad, q.p); await bekle(() => D2.katIstek >= 1, 3000); await q.p.waitForTimeout(300); const a1 = await ozet(q.p); await hesapDegis(q.c, q.p, "kulB"); await hesapDegis(q.c, q.p, "kul1"); G2.ac(); await bekle(() => false, 1500); const a = await ozet(q.p);
  t("YARIŞ", `${ad}: katalog beklerken hesap A→B→A: eski eylem yeni (aynı kimlikli) oturumda RUN AÇAMAZ, yerel kota/AI yok`, !a1.run && a1.toast.some(m => /yükleniyor/i.test(m)) && !a.run && D.kota === 0 && D.ai === 0, JSON.stringify({ a1: a1.run, a: a.run, kota: D.kota }));
  await q.c.close();
  sifirla(); const G3 = kapiYap(); D3.cikisTut = kapiYap(); const w = await sade("#yanlislar"); await mistKur(w.p, m3); D2.tut = G3;
  await cagir(ad, w.p); await bekle(() => D2.katIstek >= 1, 3000); await w.p.waitForTimeout(300); const o1 = await ozet(w.p); await w.p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G3.ac(); D3.cikisTut.ac(); await bekle(() => false, 1500); const o = await ozet(w.p);
  t("YARIŞ", `${ad}: katalog beklerken ÇIKIŞ: eski eylem RUN AÇAMAZ, yerel kota/AI yok`, !o1.run && o1.toast.some(m => /yükleniyor/i.test(m)) && !o.run && D.kota === 0 && D.ai === 0, JSON.stringify({ o1: o1.run, o: o.run, kota: D.kota }));
  await w.c.close();
}

/* =====================  KARAKT: bayrak HİÇ açılmadan kullanılan eski yerel yollar AYNEN korunur  ===================== */
for (const [ad] of ENT) {
  sifirla(); D.oturum = "banka_yok"; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await mistKur(p, m3);
  if (ad === "benzerMist") await bankMistKur(p, BK0);
  await p.evaluate(() => { window.__t.length = 0; });
  if (ad === "benzerMist") await p.evaluate(id => { ACT.benzerMist({ id }); }, BK0.ids[0]);
  else if (ad === "topicStart") await p.evaluate(([s, tp]) => { ACT.topicStart({ s, t: tp }); }, [BK0.s, BK0.t]);   /* yerel yol BANK konusu ister (KOC-ANA yalnız katalogda) */
  else await cagir(ad, p);
  const r = await ozet(p);
  t("KARAKT", `${ad}: bayrak KAPALI (hiç açılmadı): yerel RUN açılır (gvn yok), iptal mesajı yok (eski davranış korunur)`, r.run && r.gvn === null && r.n >= 1 && !r.toast.some(m => MESAJ.test(m)), JSON.stringify({ run: r.run, kind: r.kind, gvn: r.gvn, n: r.n, aVar: r.aVar, modal: r.modal, toast: r.toast.slice(-1) }));
  await c.close();
}

console.log(`\nTOPLAM: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) { console.log("KIRMIZI:"); kirmizi.forEach(k => console.log("  - " + k)); }
await b.close(); srv.close(); process.exit(kalan > 0 ? 1 : 0);
