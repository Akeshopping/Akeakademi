// B4 3C-4e · koç ekranı "Çözümlü örnekler" (kocOrnekler / kocOrnekKart / kocAc / kocYeniOrnek / kocGunluk 'örnek' adımı) güvenli katalog modu — gerçek Chromium + SAHTE API (Production/Preview/D1'e dokunmaz; CI'a EKLENMEZ).
// Taban B4 b6c050a2086c733b3bc8fce5431109e38a5c95e5. Bayrak AKE_KATALOG_STUDYO açıkken kocOrnekler YALNIZ ilgili konunun GENS öğretici örneklerini kullanır (kimlik g:…); BANK/EKQ/S.aiQs/poolOf yoluna GİRMEZ, katalog test sorusu örnek diye gösterilmez.
// Uygun üreteç yoksa başka konuya/yerel havuza DÜŞMEZ: "Bu konu için henüz çözümlü örnek yok"; kocAc günlük 'örnek tamamlandı' bayrağını YAZMAZ, kocGunluk o konu için 'örnek' adımını göstermez. Hesap değişiminde KOC.ex/KOC.key eski hesaptan KALMAZ.
// DÜRÜST KAPSAM: GENS örneklerinde cevap/çözüm BİLEREK görünür (katalog dışı, yerelde üretilen öğretici soru); BANK ve diğer cevaplı kaynaklar sitenin başka yollarında hâlâ mevcut. Bu test koç ekranının tamamını güvenli İLAN ETMEZ.
// Test ilkesi: metin eşitliği yerine KAYNAK ve KİMLİK sınırı (genQ/poolOf casusu, g: kimliği, yaprak 'SENTINEL' işaretleri); yerel depoda yalnız bu eylemin YENİ/DEĞİŞEN anahtarları ölçülür. Cevap/çözüm değerleri çıktıya yazılmaz.
// Çalıştırma: node tests/studyo-koc-ornek-istemci.mjs · çıkış kodu: kırmızı > 0 ise 1
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


/* ---- araçlar ---- */
const aracKur = p => p.evaluate(() => { window.__ar = { pool: 0, genIds: [] }; const po = poolOf; poolOf = function () { window.__ar.pool++; return po.apply(this, arguments); }; const gq = genQ; genQ = function () { const q = gq.apply(this, arguments); if (q) window.__ar.genIds.push(String(q.id)); return q; }; });
const arOku = p => p.evaluate(() => ({ pool: window.__ar.pool, genIds: window.__ar.genIds.slice() }));
const lsAl = p => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
const lsFark = (a, b) => Object.keys(b).filter(k => a[k] !== b[k]).map(k => [k, b[k]]);
const gensKonu = p => p.evaluate(() => { const g = GENS.find(x => x.t && x.subs.some(s => SUBJ[s])); return g ? { s: g.subs.find(s => SUBJ[s]), t: g.t } : null; });
/* kaynak işaretleri: BANK/EKQ/AI/KATALOG'da "örnek olarak seçilebilir" (x dolu, ≥4 şık) sentinel sorular; konu = verilen konu */
const kaynakTohumla = (p, s, tp) => p.evaluate(([s, tp]) => { const mk = (id, q, extra) => Object.assign({ id, s, t: tp, d: 2, q, o: ["a", "b", "c", "d", "e"].map(h => h + " sentinel"), a: 1, x: "SENTINEL-COZUM" }, extra || {});
  BANK.push(mk("bank-sentinel-" + s, "BANK-SENTINEL-SORU")); EKQ.push(mk("ek-sentinel-" + s, "EK-SENTINEL-SORU")); S.aiQs.push(mk("ai-sentinel-" + s, "AI-SENTINEL-SORU", { src: "ai" })); }, [s, tp]);
const SENT = /BANK-SENTINEL|EK-SENTINEL|AI-SENTINEL|KATALOG-SENTINEL|SENTINEL-COZUM/;
const kocHazir2 = async (p, s, tp, v = [2, 8, 0]) => { await onYukle(p); await zayifKur(p, s, tp, v); await kaynakTohumla(p, s, tp); await git(p, "#koc"); await aracKur(p); };
const ornekGoz = p => p.evaluate(() => { const ex = KOC.ex || []; const kart = [...document.querySelectorAll(".card.stack b")].filter(b => /^Çözümlü örnek \d/.test(b.textContent)).length;
  return { n: ex.length, key: KOC.key, kart, sag: document.querySelectorAll(".opt.right").length, bos: [...document.querySelectorAll(".empty")].map(e => e.textContent.trim()), yeniBtn: !!document.querySelector('[data-a="kocYeniOrnek"]'), html: document.body.innerHTML.length > 0 && /SENTINEL/.test(document.body.innerHTML), exSent: /SENTINEL/.test(JSON.stringify(ex)), gunBayrak: Object.keys(localStorage).filter(k => /^ake\.koc\./.test(k)).length }; });
const kocAcCagir = (p, s, tp) => p.evaluate(([s, tp]) => { ACT.kocAc({ s, t: tp }); }, [s, tp]);
const gunAdim = (p, s, tp) => p.evaluate(([s, tp]) => kocGunluk().filter(x => x.s === s && x.t === tp).map(x => x.k), [s, tp]);

/* =====================  SANITY  ===================== */
let GK = null;
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); GK = await gensKonu(p);
  const v = await p.evaluate(([s, tp]) => { const g = GENS.find(x => x.t === tp && x.subs.includes(s)); const q = g ? genQ(g, s, new Set()) : null; return { gens: GENS.length, uretim: !!(q && !q.stale && String(q.id).startsWith("g:")), kocAc: typeof ACT.kocAc, ornekler: typeof kocOrnekler, guv: typeof studyoGuvenliMi }; }, [GK.s, GK.t]);
  t("SANITY", "GENS'li bir konu bulunur ve genQ g: kimlikli örnek üretir; ACT.kocAc / kocOrnekler / studyoGuvenliMi var", !!GK && v.gens > 0 && v.uretim && v.kocAc === "function" && v.ornekler === "function" && v.guv === "function", JSON.stringify({ gk: GK, ...v }));
  const gunsuz = await p.evaluate(([s, tp]) => GENS.filter(g => g.subs.includes(s) && g.t === tp).length, [S0, TA]);
  t("SANITY", "kontrol konusu (KOC-ANA) için GENS üreteci YOK → 'örnek yok' senaryosu geçerli", gunsuz === 0, String(gunsuz));
  await c.close(); }

/* =====================  KARAKTERİZASYON (bayrak KAPALI; mevcut davranış, yeşil kalmalı)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, GK.s, GK.t, [2, 8, 0]); await kaynakTohumla(p, GK.s, GK.t); await git(p, "#koc"); await aracKur(p);
  const a0 = await lsAl(p); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(400); const g = await ornekGoz(p), ar = await arOku(p), fark = lsFark(a0, await lsAl(p));
  t("KARAKT", "bayrak KAPALI kocAc (mevcut): poolOf (BANK/EKQ/AI) OKUNUR, örnek kartları + cevap (.opt.right) görünür, günlük 'örnek' bayrağı yazılır", ar.pool >= 1 && g.n >= 1 && g.kart === g.n && g.sag >= g.n && fark.some(([k, v]) => /^ake\.koc\./.test(k) && v === "1"), JSON.stringify({ pool: ar.pool, n: g.n, kart: g.kart, sag: g.sag, bayrak: fark.filter(([k]) => /^ake\.koc\./.test(k)).length }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, S0, TA, [2, 8, 0]); await git(p, "#koc"); await kocAcCagir(p, S0, TA); await p.waitForTimeout(300); const g = await ornekGoz(p);
  t("KARAKT", "bayrak KAPALI üreteçsiz konu (mevcut): 'Bu konu için örnek bulunamadı.' metni ve günlük bayrağı yazılması DEĞİŞMEZ", g.n === 0 && g.bos.some(m => /örnek bulunamadı/.test(m)) && g.gunBayrak >= 1, JSON.stringify({ n: g.n, bos: g.bos, bayrak: g.gunBayrak }));
  const ad = await gunAdim(p, S0, TA);
  t("KARAKT", "bayrak KAPALI günlük program: 'örnek' adımı eskisi gibi HER konuda gösterilir", ad.includes("ornek") && ad.includes("test"), JSON.stringify(ad));
  await c.close(); }

/* =====================  GÜVENLİ: GENS'li konu  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t);
  const a0 = await lsAl(p); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(500); const g = await ornekGoz(p), ar = await arOku(p), fark = lsFark(a0, await lsAl(p));
  t("GÜVENLİ", "bayrak AÇIK kocAc: poolOf (BANK/EKQ/S.aiQs yolu) HİÇ çağrılmaz", ar.pool === 0, JSON.stringify(ar));
  t("GÜVENLİ", "örnekler yalnız GENS'ten: 1-3 örnek, her üretim kimliği g: ile başlar, örnek sayısı üretilen sayıyla tutarlı", g.n >= 1 && g.n <= 3 && ar.genIds.length >= g.n && ar.genIds.every(i => /^g:/.test(i)), JSON.stringify({ n: g.n, gen: ar.genIds.length }));
  t("GÜVENLİ", "kaynak sınırı: BANK/EKQ/AI/katalog sentinel soruları ne KOC.ex'te ne DOM'da (aynı konuda seçilebilir halde tohumlanmış olmalarına rağmen)", !g.exSent && !g.html, JSON.stringify({ ex: g.exSent, dom: g.html }));
  t("GÜVENLİ", "DOM: örnek kartları çizilir; GENS öğretici örneklerinde cevap BİLEREK görünür (.opt.right = kart sayısı; katalog dışı, yerel üretim)", g.kart === g.n && g.sag === g.n, JSON.stringify({ kart: g.kart, sag: g.sag }));
  t("GÜVENLİ", "ağ/kota/ai: örnek göstermek sunucu oturumu, kota ya da ai isteği AÇMAZ", D.istekler.length === 0 && D.kota === 0 && D.ai === 0, JSON.stringify({ ist: D.istekler.length, kota: D.kota, ai: D.ai }));
  const kb = fark.filter(([k]) => /^ake\.koc\./.test(k));
  t("GÜVENLİ", "yerel depo (bu eylemin YENİ/DEĞİŞEN anahtarları): yalnız günlük 'örnek' bayrağı (ake.koc.* = '1'); hiçbir yeni değerde sentinel/örnek cevabı yok", kb.length === 1 && kb[0][1] === "1" && !fark.some(([k, v]) => SENT.test(v)), JSON.stringify({ degisen: fark.map(([k]) => k.replace(/\d{4}-\d{2}-\d{2}/, "<gün>")) }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(300); let hep = true, yok = true, say = 0;
  for (let i = 0; i < 10; i++) { await p.evaluate(() => { ACT.kocYeniOrnek(); }); const g = await ornekGoz(p); say += g.n; if (g.exSent || g.html) yok = false; if (!(g.n >= 1 && g.kart === g.n)) hep = false; }
  const ar = await arOku(p);
  t("GÜVENLİ", "kocYeniOrnek ×10: her seferinde örnek var, poolOf 0 çağrı, sentinel yok, tüm genQ kimlikleri g:", hep && yok && ar.pool === 0 && ar.genIds.every(i => /^g:/.test(i)) && D.istekler.length === 0, JSON.stringify({ hep, yok, pool: ar.pool, say, ist: D.istekler.length }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t); const tk = await tikla(p, `[data-a="kocAc"][data-t="${GK.t}"]`); await p.waitForTimeout(500); const g = await ornekGoz(p), ar = await arOku(p);
  t("GÜVENLİ", "gerçek düğme 'Konu çalışması' (DOM tıklaması): aynı güvenli yol (poolOf 0, g: örnekler, sentinel yok)", tk && ar.pool === 0 && g.n >= 1 && !g.exSent && !g.html, JSON.stringify({ tk, pool: ar.pool, n: g.n }));
  await c.close(); }

/* =====================  GÜVENLİ: ÜRETEÇSİZ KONU (boş durum)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, S0, TA); const a0 = await lsAl(p); await kocAcCagir(p, S0, TA); await p.waitForTimeout(500); const g = await ornekGoz(p), ar = await arOku(p), fark = lsFark(a0, await lsAl(p));
  t("GÜVENLİ", "üreteçsiz konu: örnek YOK; başka konuya/yerel havuza (BANK/EKQ/AI) düşülmez (poolOf 0, sentinel yok)", g.n === 0 && ar.pool === 0 && !g.exSent && !g.html && g.kart === 0, JSON.stringify({ n: g.n, pool: ar.pool, kart: g.kart }));
  t("GÜVENLİ", "boş durum mesajı: 'Bu konu için henüz çözümlü örnek yok' (eski 'bulunamadı' kalıbı DEĞİL)", g.bos.some(m => /Bu konu için henüz çözümlü örnek yok/.test(m)) && !g.bos.some(m => /bulunamadı/.test(m)), JSON.stringify(g.bos));
  t("GÜVENLİ", "günlük 'örnek tamamlandı' bayrağı YAZILMAZ (bu eylemin yeni yazmaları arasında ake.koc.* yok)", !fark.some(([k]) => /^ake\.koc\./.test(k)) && g.gunBayrak === 0, JSON.stringify({ degisen: fark.length, bayrak: g.gunBayrak }));
  t("GÜVENLİ", "boşken 'Başka örnekler getir' düğmesi gösterilmez", g.yeniBtn === false, JSON.stringify({ yeniBtn: g.yeniBtn }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, S0, TA); await kocAcCagir(p, S0, TA); await p.waitForTimeout(300); await p.evaluate(() => { ACT.kocYeniOrnek(); }); const g = await ornekGoz(p), ar = await arOku(p);
  t("GÜVENLİ", "boş konuda kocYeniOrnek çağrılsa da (doğrudan) poolOf 0, örnek 0, sentinel yok", g.n === 0 && ar.pool === 0 && !g.exSent && !g.html, JSON.stringify({ n: g.n, pool: ar.pool }));
  await c.close(); }

/* =====================  GÜNLÜK PROGRAM (kocGunluk)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, S0, TA); const ad = await gunAdim(p, S0, TA);
  t("GÜNLÜK", "üreteçsiz konu için 'örnek' adımı GÖSTERİLMEZ; 'test' adımı kalır", !ad.includes("ornek") && ad.includes("test"), JSON.stringify(ad));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t); const ad = await gunAdim(p, GK.s, GK.t);
  t("GÜNLÜK", "üreteçli konu için 'örnek' ve 'test' adımları gösterilir", ad.includes("ornek") && ad.includes("test"), JSON.stringify(ad));
  await c.close(); }

/* =====================  HESAP DEĞİŞİMİ  ===================== */
for (const [ad, guvenli] of [["bayrak AÇIK", true], ["bayrak KAPALI (genel hesap-izolasyonu; bayrak kapalı örnek davranışı aynı kalır)", false]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli, tuzak: false }); if (guvenli) await kocHazir2(p, GK.s, GK.t); else { await zayifKur(p, GK.s, GK.t, [2, 8, 0]); await git(p, "#koc"); }
  await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(400); const on = await ornekGoz(p);
  await hesapDegis(c, p, "kulB"); const so = await p.evaluate(() => ({ key: KOC.key, ex: KOC.ex, kart: [...document.querySelectorAll(".card.stack b")].filter(b => /^Çözümlü örnek \d/.test(b.textContent)).length }));
  t("HESAP", `${ad}: kul1 örnek açıkken kulB'ye geçince KOC.key='' ve KOC.ex=null (eski hesaptan kalmaz), DOM'da eski örnek kartı yok`, on.n >= 1 && so.key === "" && so.ex === null && so.kart === 0, JSON.stringify({ onceN: on.n, key: so.key, ex: so.ex === null ? null : "dolu", kart: so.kart }));
  await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t); await kocAcCagir(p, GK.s, GK.t); await hesapDegis(c, p, "kulB"); await zayifKur(p, GK.s, GK.t, [2, 8, 0]); await git(p, "#koc"); await aracKur(p); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(400); const g = await ornekGoz(p), ar = await arOku(p);
  t("HESAP", "hesap değiştikten sonra kulB için kocAc normal çalışır (güvenli GENS örnekleri, poolOf 0)", g.n >= 1 && ar.pool === 0 && g.kart === g.n, JSON.stringify({ n: g.n, pool: ar.pool }));
  await c.close(); }


/* =====================  BAYRAK GEÇİŞİ (aynı sayfa oturumunda kapalı → açık)  ===================== */
const bayrakAc = p => p.evaluate(() => { window.AKE_KATALOG_STUDYO = true; render(); });
const kartGoz = p => p.evaluate(() => ({ ex: JSON.stringify(KOC.ex || []), n: (KOC.ex || []).length, ids: (KOC.ex || []).map(e => String(e.id || "")), dom: document.body.innerHTML, kart: [...document.querySelectorAll(".card.stack b")].filter(b => /^Çözümlü örnek \d/.test(b.textContent)).length }));
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, GK.s, GK.t, [2, 8, 0]);
  /* bayrak KAPALI: BANK kaynaklı örnek aç (sentinel BANK sorusu kocOrnekler'in seçebileceği biçimde) — sentinel'i öne almak için havuzu yalnız sentinel'e indirge */
  await p.evaluate(([s, tp]) => { BANK.length = 0; EKQ.length = 0; S.aiQs.length = 0; BANK.push({ id: "bank-sentinel-1", s, t: tp, d: 2, q: "BANK-SENTINEL-SORU", o: ["a", "b", "c", "d", "e"].map(h => h + " sentinel"), a: 1, x: "SENTINEL-COZUM" }); }, [GK.s, GK.t]);
  await git(p, "#koc"); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(300); const once = await kartGoz(p);
  const onceBank = /BANK-SENTINEL/.test(once.ex) && /BANK-SENTINEL/.test(once.dom);
  await bayrakAc(p); await p.waitForTimeout(300); const sonra = await kartGoz(p);
  t("GEÇİŞ", "bayrak KAPALI iken BANK kaynaklı örnek açılır (ön koşul), sonra aynı sayfada bayrak AÇILIP yeniden çizilince eski BANK örneği KOC.ex'te de DOM'da da KALMAZ", onceBank && !/SENTINEL/.test(sonra.ex) && !/SENTINEL/.test(sonra.dom), JSON.stringify({ onceBank, exKaldi: /SENTINEL/.test(sonra.ex), domKaldi: /SENTINEL/.test(sonra.dom) }));
  t("GEÇİŞ", "bayrak geçişinden sonra KOC.ex'te yalnız g: kimlikli (güvenli) örnek var; kart sayısı = örnek sayısı", sonra.ids.every(i => /^g:/.test(i)) && sonra.kart === sonra.n, JSON.stringify({ n: sonra.n, kart: sonra.kart, ids: sonra.ids.map(i => i.slice(0, 2)) }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, S0, TA, [2, 8, 0]);
  await p.evaluate(([s, tp]) => { BANK.push({ id: "bank-sentinel-2", s, t: tp, d: 2, q: "BANK-SENTINEL-SORU", o: ["a", "b", "c", "d", "e"].map(h => h + " sentinel"), a: 1, x: "SENTINEL-COZUM" }); }, [S0, TA]);
  await git(p, "#koc"); await kocAcCagir(p, S0, TA); await p.waitForTimeout(300); const once = await kartGoz(p);
  await bayrakAc(p); await p.waitForTimeout(300); const sonra = await kartGoz(p);
  t("GEÇİŞ", "üreteçsiz konuda geçiş: eski örnek temizlenir, boş mesaj gösterilir, sentinel kalmaz", /SENTINEL/.test(once.ex) && !/SENTINEL/.test(sonra.ex) && !/SENTINEL/.test(sonra.dom) && sonra.n === 0 && /henüz çözümlü örnek yok/.test(sonra.dom), JSON.stringify({ onceN: once.n, sonraN: sonra.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(300);
  const a = await p.evaluate(() => { const ex0 = KOC.ex; const ids0 = ex0.map(e => e.id); render(); render(); return { ayni: KOC.ex === ex0, ids0, ids1: KOC.ex.map(e => e.id) }; }); const ar = await arOku(p);
  t("GEÇİŞ", "güvenli modda normal GENS örnekleri her render'da silinip yeniden üretilmez (aynı KOC.ex nesnesi, aynı kimlikler, ek genQ çağrısı yok)", a.ayni && JSON.stringify(a.ids0) === JSON.stringify(a.ids1) && a.ids0.length >= 1 && ar.genIds.length === a.ids0.length, JSON.stringify({ ayni: a.ayni, n: a.ids0.length, genQ: ar.genIds.length }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, GK.s, GK.t, [2, 8, 0]); await kaynakTohumla(p, GK.s, GK.t); await git(p, "#koc"); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(300);
  const a = await p.evaluate(() => { const ex0 = KOC.ex; render(); render(); return { ayni: KOC.ex === ex0, n: KOC.ex.length }; });
  t("GEÇİŞ", "bayrak KAPALI davranış korunur: render'lar KOC.ex'i değiştirmez (BANK/GENS karışık örnekler aynen kalır)", a.ayni && a.n >= 1, JSON.stringify(a));
  await c.close(); }

{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, GK.s, GK.t, [2, 8, 0]);
  await p.evaluate(() => { BANK.length = 0; EKQ.length = 0; S.aiQs.length = 0; }); await git(p, "#koc"); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(300);
  const a = await p.evaluate(() => { const ex0 = KOC.ex, ids0 = ex0.map(e => e.id); window.AKE_KATALOG_STUDYO = true; render(); return { ayni: KOC.ex === ex0, ids0, ids1: KOC.ex.map(e => e.id) }; });
  t("GEÇİŞ", "bayrak KAPALI iken (güvenli dal dışında) üretilmiş saf GENS örnekleri bayrak açılınca güvenli kaynakla YENİDEN üretilir (kaynak id'den değil bellek işaretinden bilinir): yine g: kimlikli GENS, ≥1 örnek", a.ids0.length >= 1 && !a.ayni && a.ids1.length >= 1 && a.ids1.every(i => /^g:/.test(String(i))), JSON.stringify({ n0: a.ids0.length, n1: a.ids1.length, ayni: a.ayni }));
  await c.close(); }

{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await zayifKur(p, GK.s, GK.t, [2, 8, 0]);
  /* kaynak TAKLİDİ: EKQ'daki cevaplı soru id'sini g: ile başlatır, gen alanı yok → id biçimi güvenli kaynak kanıtı sayılmamalı */
  await p.evaluate(([s, tp]) => { BANK.length = 0; S.aiQs.length = 0; EKQ.length = 0; EKQ.push({ id: "g:sahte:ekq1", s, t: tp, d: 2, q: "EK-SENTINEL-SORU", o: ["a", "b", "c", "d", "e"].map(h => h + " sentinel"), a: 1, x: "SENTINEL-COZUM" }); }, [GK.s, GK.t]);
  await git(p, "#koc"); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(300); const once = await kartGoz(p);
  const taklitVar = /EK-SENTINEL/.test(once.ex) && /EK-SENTINEL/.test(once.dom) && once.ids.includes("g:sahte:ekq1");
  await aracKur(p); await bayrakAc(p); await p.waitForTimeout(300); const sonra = await kartGoz(p);
  t("GEÇİŞ", "kaynak taklidi: bayrak kapalıyken EKQ'dan KOC.ex'e alınan g: önekli (gen alanı yok) cevaplı örnek, bayrak açılıp render edilince KOC.ex'te de DOM'da da KALMAZ", taklitVar && !/SENTINEL/.test(sonra.ex) && !/SENTINEL/.test(sonra.dom) && !sonra.ids.includes("g:sahte:ekq1"), JSON.stringify({ taklitVar, exKaldi: /SENTINEL/.test(sonra.ex), domKaldi: /SENTINEL/.test(sonra.dom) }));
  const ar = await arOku(p);
  t("GEÇİŞ", "kaynak taklidi sonrası yeniden üretim güvenli kaynaktan: poolOf çağrılmadı, üretilen örnekler gerçek GENS (genQ) çıktısı", ar.pool === 0 && sonra.n >= 1 && sonra.kart === sonra.n, JSON.stringify({ pool: ar.pool, n: sonra.n }));
  await c.close(); }


/* =====================  GÜNLÜK BAYRAK HESAP İZOLASYONU (ake.koc.<gün>.<ders|konu>)  ===================== */
const ornekDone = (p, s, tp) => p.evaluate(([s, tp]) => { const x = kocGunluk().find(y => y.k === "ornek" && y.s === s && y.t === tp); return x ? x.done : null; }, [s, tp]);
const kocBayrakKeys = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^ake\.koc\./.test(k)));
for (const [ad, guvenli] of [["bayrak AÇIK", true], ["bayrak KAPALI", false]]) {
  sifirla(); const { c, p } = await sayfa({ guvenli, tuzak: false }); if (guvenli) await kocHazir2(p, GK.s, GK.t); else { await zayifKur(p, GK.s, GK.t, [2, 8, 0]); await kaynakTohumla(p, GK.s, GK.t); await git(p, "#koc"); }
  const a0 = await ornekDone(p, GK.s, GK.t); await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(300); const a1 = await ornekDone(p, GK.s, GK.t);
  await hesapDegis(c, p, "kulB"); await zayifKur(p, GK.s, GK.t, [2, 8, 0]); await git(p, "#koc"); const b0 = await ornekDone(p, GK.s, GK.t);
  await hesapDegis(c, p, "kul1"); const a2 = await ornekDone(p, GK.s, GK.t); const keys = await kocBayrakKeys(p);
  t("BAYRAK-HESAP", `${ad}: A örneği tamamlayınca 'örnek' adımı A'da done; B aynı günde aynı konuyu TAMAMLANMAMIŞ görür; A'ya dönünce A'nın durumu korunur`, a0 === false && a1 === true && b0 === false && a2 === true, JSON.stringify({ a0, a1, b0, a2 }));
  t("BAYRAK-HESAP", `${ad}: bayrak anahtarı hesap kimliği taşır (ake.koc.<sahip>.…), kimliksiz eski biçim YAZILMAZ`, keys.length >= 1 && keys.every(k => /^ake\.koc\.[^.]+\.\d{4}-\d{2}-\d{2}\./.test(k)), JSON.stringify({ n: keys.length, biçim: keys.map(k => k.replace(/\d{4}-\d{2}-\d{2}/, "<gün>").split(".").slice(0, 4).map((x, i) => i === 2 ? "<sahip>" : x).join(".")) }));
  await c.close();
}
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t);
  const eski = await p.evaluate(([s, tp]) => { const k = "ake.koc." + dayKey() + "." + s + "|" + tp; localStorage.setItem(k, "1"); render(); return k; }, [GK.s, GK.t]); const d = await ornekDone(p, GK.s, GK.t); const hala = await p.evaluate(k => localStorage.getItem(k), eski);
  t("BAYRAK-HESAP", "eski sahipsiz (hesap kimliksiz) anahtar OTOMATİK aktarılmaz/sayılmaz: adım tamamlanmamış görünür; eski anahtar silinmez, yeni anahtara kopyalanmaz", d === false && hala === "1" && !(await kocBayrakKeys(p)).some(k => k !== eski), JSON.stringify({ done: d, eskiDuruyor: hala === "1" }));
  await c.close(); }

/* =====================  DEĞİŞMEYENLER (kapsam dışı; cevaplı yerel yollar)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, GK.s, GK.t);
  await yanlisKur(p, [{ id: "kat-a-koc-a02", s: GK.s, t: GK.t, n: 5 }]); await p.evaluate(() => { S.mistakes["kat-a-koc-a02"].q.q = "MISTAKE-SENTINEL-SORU"; render(); });
  await kocAcCagir(p, GK.s, GK.t); await p.waitForTimeout(400); const my = await p.evaluate(() => ({ goster: /MISTAKE-SENTINEL-SORU/.test(document.body.innerHTML), baslik: /Senin yanlışların/.test(document.body.innerHTML) }));
  t("KAPSAM", "kullanıcının KENDİ geçmiş yanlışları koç ekranında eskisi gibi görünür ('Senin yanlışların' bölümü DEĞİŞMEZ; cevaplı yerel kaynak)", my.goster && my.baslik, JSON.stringify(my));
  await p.evaluate(() => { RUN = null; saveRun(); }); await p.evaluate(() => { ACT.mistOne({ id: "kat-a-koc-a02" }); }); const rm = await ozet(p);
  t("KAPSAM", "mist* (yanlış tekrarı) DEĞİŞMEZ: kind='mistakes', yerel (gvn yok), sunucu oturumu yok", rm.run && rm.kind === "mistakes" && rm.gvn === null && D.istekler.length === 0, JSON.stringify({ run: rm.run, kind: rm.kind, gvn: rm.gvn, ist: D.istekler.length }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await kocHazir2(p, S0, TA); await kocAcCagir(p, S0, TA); await p.waitForTimeout(300); const r = await koc(p);
  t("KAPSAM", "3C-4d korunur: kocAc'tan sonra kocTest hâlâ güvenli (gvn='studyo', katalog kimlikleri, sunucu oturumlu, BANK/GENS dolgusu yok)", r.run && r.gvn === "studyo" && hepsiKatalogda(r.ids, KS) && r.svN === r.n && r.bankN === 0 && r.genN === 0, JSON.stringify({ run: r.run, gvn: r.gvn, n: r.n, svN: r.svN }));
  await c.close(); }

console.log(`\nTOPLAM: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) { console.log("KIRMIZI:"); kirmizi.forEach(k => console.log("  - " + k)); }
await b.close(); srv.close(); process.exit(kalan > 0 ? 1 : 0);
