// B4 3C-4g · "Benzerini çöz" (ACT.benzerMist → benzerBaslat / benzerYok(...,"mist") / benzerAI / benzerAIGo) güvenli katalog geçişi — gerçek Chromium + SAHTE API testleri (Production/Preview/D1'e dokunmaz; CI'a EKLENMEZ).
// Taban B4 fa40087a127a944280098c952db445bb7ea82ce9. HEDEF SÖZLEŞME (bayrak AKE_KATALOG_STUDYO === true): benzerMist studyoGirisCalistir → KHAVUZ (aynı ders/konu, kaynak yanlışın kimliği HARİÇ, en çok 5 CEVAPSIZ soru) → studyoCfg → zorunlu sunucu oturumu
//   (RUN.gvn="studyo", kind="benzer"). Kaynak yanlışın a/x/anlık görüntüsü KULLANILMAZ; katalog dışı (g:/AI/eski/görselli) yanlış için yalnız ders/konu. Uygun soru yoksa açık mesaj; AI, yerel kota, GENS/BANK/EKQ/S.aiQs YOK.
//   Eylem düzeyi: benzerBaslat / benzerYok(..., "mist") / benzerAI / benzerAIGo doğrudan ya da eski modal üzerinden çağrılsa da bayrak açıkken yerel cevaplı RUN açılmaz, S.aiQs yazılmaz, AI hakkı harcanmaz.
//   "Yenisini başlat" onayı güvenli RUN'ı yerel RUN'a ÇEVİREMEZ. Bayrak KAPALI davranış karakterizasyon testleriyle korunur.
// Varsayımlar (raporda): (1) uçuştaki AI isteğinin İLK çağrısı bayrak açılmadan önce gönderildiyse geri alınamaz (hak harcanmış sayılır); ikinci (doğrulama) çağrısı ve S.aiQs/RUN yazımı yapılmaz; (2) sunucu /cevap sahtesi sabit anahtar döner (doğru seçenek = 1);
//   (3) hata/yarış testlerinde sunucu oturumu isteği ÖN KOŞUL olarak ölçülür; (4) 'ag' kipinde tarayıcı aynı isteği yeniden deneyebilir (≥1 istek, aynı 'istek' anahtarı).
// Cevap anahtarı DEĞERLERİ çıktıya yazılmaz (sentetik; yalnız kimlik/sayı/varlık). Çalıştırma: node tests/studyo-benzer-istemci.mjs · çıkış kodu: kırmızı > 0 ise 1
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
const YOK = { id: "kocm-yok-1", ts: BIRLIK(1) };

/* =====================  SANITY  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false });
  const v = await p.evaluate(() => ({ bm: typeof ACT.benzerMist, bb: typeof benzerBaslat, by: typeof benzerYok, ba: typeof benzerAI, go: typeof ACT.benzerAIGo, rr: typeof ACT.runReplace, w: typeof webAI }));
  t("SANITY", "ACT.benzerMist, benzerBaslat, benzerYok, benzerAI, ACT.benzerAIGo, ACT.runReplace, webAI var", Object.values(v).every(x => x === "function"), JSON.stringify(v));
  const say = { a: [...KS].filter(i => i.startsWith("kat-a-koc-a")).length, z: [...KS].filter(i => i.startsWith("kat-a-koc-z")).length };
  t("SANITY", "sahte katalog: S0/KOC-ANA 36, KOC-AZ 3 soru; BANK'ta ≥6 soruluk konu var (yerel benzer üretilebilir)", say.a === 36 && say.z === 3 && BK0.ids.length >= 6, JSON.stringify({ say, bank: BK0.ids.length }));
  await c.close(); }

/* =====================  KARAKTERİZASYON (bayrak KAPALI; mevcut davranış, yeşil kalmalı)  ===================== */
{ sifirla(); D.oturum = "banka_yok"; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await bankMistKur(p, BK0); const r = await bs(p, BK0.ids[0]);
  t("KARAKT", "bayrak KAPALI benzerMist (mevcut; fake sunucu BANK kimliklerini sunmuyor = 'banka_yok'): eski yerel akış → YEREL RUN kind='benzer', gvn yok, cevaplı (a dolu), katalog isteği ve AI yok", r.run && r.kind === "benzer" && r.gvn === null && r.n >= 1 && r.n <= 5 && r.svN === 0 && r.aVar === r.n && D2.katIstek === 0 && D.ai === 0, JSON.stringify({ run: r.run, kind: r.kind, gvn: r.gvn, n: r.n, a: r.aVar, ist: D.istekler.length, kat: D2.katIstek, ai: D.ai }));
  bilgi("KARAKT bayrak KAPALI benzerMist: sunucu oturum isteği ve yerel kota isteği sayısı (mevcut davranış)", JSON.stringify({ oturum: D.istekler.length, kota: D.kota }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await aiKur(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const r0 = await bs(p, kk(1)), n0 = await aiQn(p);
  t("KARAKT", "bayrak KAPALI, hazır benzer yoksa (mevcut): 'AI ile benzer soru üretilsin mi?' modalı açılır; RUN yok; Üret'e basılana dek /api/ai çağrılmaz", r0.modal === AIMODAL && !r0.run && D.ai === 0, JSON.stringify({ modal: r0.modal, run: r0.run, ai: D.ai }));
  await p.evaluate(() => { ACT.benzerAIGo(); }); await bekle(() => D.ai >= 2, 4000); const r = await ozet(p), n1 = await aiQn(p);
  t("KARAKT", "bayrak KAPALI AI akışı (mevcut): 2 AI çağrısı (üret + doğrula), S.aiQs +3, yerel cevaplı RUN kind='benzer' (gvn yok)", D.ai === 2 && n1 - n0 === 3 && r.run && r.kind === "benzer" && r.gvn === null && r.aVar === r.n && r.n === 3, JSON.stringify({ ai: D.ai, dAiQs: n1 - n0, run: r.run, gvn: r.gvn, n: r.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const r = await bs(p, kk(1));
  t("KARAKT", "bayrak KAPALI, AI yokken hazır benzer de yoksa (mevcut): 'Bu konuda başka hazır soru yok.' bildirimi, RUN ve modal yok", !r.run && r.modal === "" && r.toast.some(m => /başka hazır soru yok/.test(m)), JSON.stringify({ run: r.run, modal: r.modal, toast: r.toast.slice(-1) }));
  await c.close(); }

/* =====================  GÜVENLİ: seçim ve RUN (bayrak AÇIK)  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const r = await bs(p, kk(1)), tk = topicOf(r.ids);
  t("GÜVENLİ", "benzerMist: aynı ders+konudan 5 CEVAPSIZ katalog sorusu; RUN gvn='studyo', kind='benzer', mode='study'; 5/5 sunucu oturumlu, 0 yerel; RUN ve ake.run'da cevap/çözüm yok", bT(r, 5) && katIdler(r, KS) && r.tekil && !r.ids.includes(kk(1)) && tk.d[S0] === 5 && tk.k[TA] === 5, JSON.stringify({ run: r.run, gvn: r.gvn, kind: r.kind, n: r.n, sv: r.svN, a: r.aVar, tk }));
  const idler = D.istekler[0] ? [...D.istekler[0].idler].sort() : [];
  t("GÜVENLİ", "tek sunucu oturum isteği (mod 'practice', 5 kimlik = RUN kimlikleri); yerel kota (/api/hesap/kota) ve AI yok; GENS/BANK/EKQ/S.aiQs sorusu yok", D.istekler.length === 1 && D.istekler[0].mod === "practice" && esit(idler, [...r.ids].sort()) && D.kota === 0 && D.ai === 0 && r.genN === 0 && r.bankN === 0 && r.tuzakN === 0, JSON.stringify({ ist: D.istekler.length, mod: D.istekler[0] && D.istekler[0].mod, kota: D.kota, ai: D.ai }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: "kat-a-koc-z01", t: TZ, ts: BIRLIK(1) }]); const r = await bs(p, "kat-a-koc-z01");
  t("GÜVENLİ", "küçük konu (3 soru): kaynak yanlışın kimliği hariç kalan 2 soru açılır (en çok 5 kuralı); kaynak kimlik RUN'da yok", bT(r, 2) && esit([...r.ids].sort(), ["kat-a-koc-z02", "kat-a-koc-z03"]), JSON.stringify({ n: r.n, ids: r.ids }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(7), ts: BIRLIK(1) }]); const tum = []; let hep5 = true, kaynakYok = true, hepKat = true;
  for (let i = 0; i < 8; i++) { const r = await bs(p, kk(7)); hep5 = hep5 && r.n === 5 && r.tekil; kaynakYok = kaynakYok && !r.ids.includes(kk(7)); hepKat = hepKat && katIdler(r, KS); tum.push(r.ids.join(",")); await p.evaluate(() => { ACT.discard(); }); await p.waitForTimeout(100); }
  t("GÜVENLİ", "8 yinelemede: her seferinde 5 tekil katalog sorusu ve kaynak yanlışın kimliği HİÇ gelmez", hep5 && kaynakYok && hepKat && tum.length === 8, JSON.stringify({ hep5, kaynakYok, hepKat }));
  bilgi("GÜVENLİ 8 yinelemede farklı küme sayısı (rastgelelik bilgisi)", String(new Set(tum).size));
  await c.close(); }
for (const [ad, ek] of [["katalog dışı kimlik", YOK], ["g: üretilmiş", { id: "g:x:1", ts: BIRLIK(1), gen: "x" }], ["AI kaynaklı", { id: "ai-eski-1", ts: BIRLIK(1), src: "ai" }], ["görselli (fig)", { id: "kocm-fig-1", ts: BIRLIK(1), fig: true }], ["eski/kaldırılmış", { id: "eski-kaldirilmis-9", ts: BIRLIK(1) }]]) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [ek]); const r = await bs(p, ek.id), esk = await ESKIVAR(p), ak = await mistAnahtar(p);
  t("GÜVENLİ", `katalog karşılığı olmayan geçmiş yanlış (${ad}): YALNIZ ders/konu kullanılır; 5 cevapsız katalog sorusu, eski anlık görüntü/çözüm RUN ve ake.run'a girmez, yanlış kaydı silinmez`, bT(r, 5) && katIdler(r, KS) && !esk && ak.includes(ek.id), JSON.stringify({ run: r.run, n: r.n, esk, kayit: ak.includes(ek.id) }));
  await c.close();
}
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await aiKur(p); const bn = await aiQn(p); await mistKur(p, [{ id: "kocm-bozuk-1", s: "yok-ders", t: "x", ts: BIRLIK(1) }]); const r = await bs(p, "kocm-bozuk-1");
  t("GÜVENLİ", "geçersiz ders: RUN yok, AI modalı yok, açık mesaj; sunucu oturumu/AI/kota yok", !r.run && r.modal === "" && r.toast.some(m => /başka hazır soru yok/.test(m)) && D.istekler.length === 0 && D.ai === 0 && D.kota === 0 && (await aiQn(p)) === bn, JSON.stringify({ run: r.run, modal: r.modal, toast: r.toast.slice(-1) }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await aiKur(p); const bn = await aiQn(p); await mistKur(p, [{ id: "kocm-konu-yok", t: "YOK-KONU", ts: BIRLIK(1) }]); const r = await bs(p, "kocm-konu-yok"), ak = await mistAnahtar(p);
  t("GÜVENLİ", "katalogda o konuda soru yok: AÇIK mesaj ('Bu konuda başka hazır soru yok'); RUN yok, AI modalı yok, /api/ai ve S.aiQs yazımı yok, yerel kota yok, sunucu oturumu yok; yanlış kaydı kalır", !r.run && r.modal === "" && r.toast.some(m => /Bu konuda başka hazır soru yok/.test(m)) && D.ai === 0 && D.kota === 0 && D.istekler.length === 0 && (await aiQn(p)) === bn && ak.includes("kocm-konu-yok"), JSON.stringify({ run: r.run, modal: r.modal, toast: r.toast.slice(-1), ai: D.ai, kota: D.kota, ist: D.istekler.length }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: "kocm-tuzak-1", t: "Tuzak", ts: BIRLIK(1) }]); const r = await bs(p, "kocm-tuzak-1");
  t("GÜVENLİ", "EKQ ve S.aiQs'teki yerel cevaplı sorular aynı ders/konudaysa bile RUN'a girmez (tuzak soruları: ek-tuzak-*, ai-tuzak-*)", yerelYok(r) && r.tuzakN === 0, JSON.stringify({ run: r.run, tuzak: r.tuzakN, gvn: r.gvn }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await bankMistKur(p, BK0); const r = await bs(p, BK0.ids[0]);
  t("GÜVENLİ", "BANK konulu yanlış (yerel BANK'ta 6+ benzer var): yerel BANK/GENS sorusu RUN'a girmez; katalogda o konu yoksa açık mesaj, RUN yok", yerelYok(r) && r.bankN === 0 && r.genN === 0 && D.ai === 0 && D.kota === 0, JSON.stringify({ run: r.run, gvn: r.gvn, n: r.n, a: r.aVar, bank: r.bankN, gen: r.genN }));
  await c.close(); }

/* =====================  EYLEM DÜZEYİ: doğrudan / eski modal / uçuştaki AI  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await bankMistKur(p, BK0); await p.evaluate(id => { benzerBaslat(S.mistakes[id].q); }, BK0.ids[0]); const r = await ozet(p);
  t("EYLEM", "benzerBaslat DOĞRUDAN (BANK konulu yanlış anlık görüntüsüyle): bayrak açıkken yerel cevaplı RUN açılmaz", yerelYok(r), JSON.stringify({ run: r.run, gvn: r.gvn, n: r.n, a: r.aVar }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); await p.evaluate(id => { benzerBaslat(S.mistakes[id].q); }, kk(1)); const r = await ozet(p);
  t("EYLEM", "benzerBaslat DOĞRUDAN (katalog konulu yanlış): güvenli yola yönlenir (gvn='studyo', 5 cevapsız sunucu oturumlu soru)", bT(r, 5) && katIdler(r, KS), JSON.stringify({ run: r.run, gvn: r.gvn, n: r.n, a: r.aVar }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await aiKur(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const bn = await aiQn(p);
  await p.evaluate(id => { benzerYok(S.mistakes[id].q, "mist"); }, kk(1)); await p.waitForTimeout(300); const r = await ozet(p), bq = await p.evaluate(() => UI.benzerQ);
  t("EYLEM", "benzerYok(q,'mist') DOĞRUDAN, AI açıkken: AI modalı AÇILMAZ, UI.benzerQ kurulmaz, açık mesaj; AI çağrısı/S.aiQs/RUN yok", r.modal === "" && !bq && r.toast.some(m => /başka hazır soru yok/.test(m)) && !r.run && D.ai === 0 && (await aiQn(p)) === bn, JSON.stringify({ modal: r.modal, bqYok: !bq, run: r.run, ai: D.ai }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await p.evaluate(() => { const l = EKQ.filter(x => /^ek-tuzak-/.test(x.id)).slice(0, 3); startRun({ kind: "benzer", title: "Benzer sorular · x", mode: "study", qs: l.map(x => snap(x)) }); }); const r = await ozet(p);
  t("EYLEM", "startRun(kind='benzer', güvenli işaretsiz yerel cfg: EKQ tuzak soruları) bayrak açıkken yerel cevaplı RUN AÇMAZ (son savunma)", !r.run || (r.gvn === 'studyo' && r.aVar === 0 && r.yerelN === 0), JSON.stringify({ run: r.run, gvn: r.gvn, a: r.aVar }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await bayrak(p, false); await aiKur(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const bn = await aiQn(p);
  const r0 = await bs(p, kk(1)); await bayrak(p, true); await p.evaluate(() => { ACT.benzerAIGo(); }); await p.waitForTimeout(900); const r = await ozet(p), busy = await p.evaluate(() => !!UI.benzerBusy);
  t("EYLEM", "ESKİ MODAL: bayrak KAPALIyken açılan 'AI ile benzer soru' modalı, bayrak AÇILDIKTAN sonra 'Üret' ile (benzerAIGo): /api/ai çağrılmaz, S.aiQs yazılmaz, RUN açılmaz, meşgul bayrağı kalmaz", r0.modal === AIMODAL && D.ai === 0 && (await aiQn(p)) === bn && !r.run && !busy, JSON.stringify({ onKosul: r0.modal === AIMODAL, ai: D.ai, run: r.run, busy }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); D5.aiTut = G; const { c, p } = await sade(); await onYukle(p); await bayrak(p, false); await aiKur(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const bn = await aiQn(p);
  const r0 = await bs(p, kk(1)); await p.evaluate(() => { ACT.benzerAIGo(); }); await bekle(() => D.ai >= 1, 4000); const pre = D.ai; await bayrak(p, true); G.ac(); await p.waitForTimeout(1500);
  const r = await ozet(p), busy = await p.evaluate(() => !!UI.benzerBusy);
  t("EYLEM", "AI YANITI BEKLENİRKEN bayrak açılırsa: 2. (doğrulama) AI çağrısı yapılmaz, S.aiQs yazılmaz, yerel RUN açılmaz, meşgul bayrağı kalmaz (ilk çağrı zaten uçuştaydı: geri alınamaz, bilgi)", r0.modal === AIMODAL && pre === 1 && D.ai === 1 && (await aiQn(p)) === bn && !r.run && !busy, JSON.stringify({ onKosul: r0.modal === AIMODAL && pre === 1, ai: D.ai, run: r.run, busy }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await bayrak(p, false); await aiKur(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const r0 = await bs(p, kk(1)); await hesapDegis(c, p, "kulB"); await aiKur(p); await bayrak(p, true); const bn = await aiQn(p);
  await p.evaluate(() => { ACT.benzerAIGo(); }); await p.waitForTimeout(900); const r = await ozet(p);
  t("EYLEM", "HESAP DEĞİŞİMİ sonrası eski 'benzer AI' isteği (UI.benzerQ kalıntısı) bayrak açıkken çalışmaz: /api/ai çağrılmaz, S.aiQs ve RUN yok", r0.modal === AIMODAL && D.ai === 0 && (await aiQn(p)) === bn && !r.run, JSON.stringify({ onKosul: r0.modal === AIMODAL, ai: D.ai, run: r.run }));
  await c.close(); }

/* =====================  ESKİ RUN ve "Yenisini başlat"  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); await eskiRunKur(p, null); const o0 = await ozet(p); const r = await bs(p, kk(1)), ak = await p.evaluate(() => ({ ans: RUN.ans.filter(a => a != null).length }));
  t("ESKİ", "eski işaretsiz RUN varken benzerMist: ezilmez/silinmez (aynı RUN ve ake.run, cevaplar duruyor), 'Yarım kalan oturum' modalı AÇILMAZ, açık uyarı, sunucu oturumu yok", r.id === o0.id && r.lsId === o0.id && ak.ans === 2 && r.modal === "" && r.toast.some(m => /eski bir oturum/.test(m)) && D.istekler.length === 0, JSON.stringify({ ayni: r.id === o0.id, ans: ak.ans, modal: r.modal, toast: r.toast.slice(-1), ist: D.istekler.length }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const o0 = await mist(p, "start"); await bankMistKur(p, BK0); await bz(p, BK0.ids[0]); await p.waitForTimeout(400);
  const m1 = await p.evaluate(() => ({ t: UI.modal ? UI.modal.title : "" })); if (m1.t === "Yarım kalan oturum var") await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(600); const r = await ozet(p);
  t("ESKİ", "GÜVENLİ RUN açıkken (BANK konulu yanlıştan) benzerMist + varsa 'Yenisini başlat': güvenli RUN YEREL RUN'a DÖNÜŞMEZ (RUN ya aynı güvenli RUN kalır ya da güvenli benzer olur; yerel cevaplı soru yok)", aT(o0, 3) && r.run && r.gvn === "studyo" && r.yerelN === 0 && r.aVar === 0 && r.genN === 0 && r.bankN === 0, JSON.stringify({ onKosul: aT(o0, 3), modal: m1.t, run: r.run, gvn: r.gvn, yerel: r.yerelN, a: r.aVar }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const o0 = await mist(p, "start"); await bz(p, kk(1)); await p.waitForTimeout(400); const m1 = await p.evaluate(() => (UI.modal ? UI.modal.title : ""));
  await p.evaluate(() => { ACT.runReplace(); }); const r = await ozet(p);
  t("ESKİ", "GÜVENLİ RUN açıkken katalog konulu benzerMist → 'Yarım kalan oturum var' → 'Yenisini başlat': yeni GÜVENLİ benzer RUN (5 soru, sunucu oturumlu, 0 cevap/çözüm), eskisinin kimliği değişir", aT(o0, 3) && m1 === "Yarım kalan oturum var" && bT(r, 5) && r.id !== o0.id, JSON.stringify({ onKosul: aT(o0, 3), modal: m1, run: r.run, gvn: r.gvn, kind: r.kind, n: r.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const o0 = await mist(p, "start"); await bz(p, kk(1)); await p.waitForTimeout(400); const m1 = await p.evaluate(() => (UI.modal ? UI.modal.title : ""));
  D.oturum = "500"; await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(900); const r = await ozet(p);
  t("ESKİ", "değiştirme sırasında sunucu 500: eski güvenli RUN korunur (aynı kimlik, ake.run), yerel yedek RUN YOK", aT(o0, 3) && m1 === "Yarım kalan oturum var" && r.run && r.id === o0.id && r.lsId === o0.id && r.gvn === "studyo" && r.aVar === 0 && r.yerelN === 0, JSON.stringify({ onKosul: m1, run: r.run, ayni: r.id === o0.id, gvn: r.gvn }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const o0 = await mist(p, "start"); await bayrak(p, false); await bankMistKur(p, BK0); await bz(p, BK0.ids[0]); await p.waitForTimeout(400);
  const m1 = await p.evaluate(() => (UI.modal ? UI.modal.title : "")); await bayrak(p, true); await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(600); const r = await ozet(p);
  t("ESKİ", "bayrak KAPALIyken güvenli RUN varsa benzerMist artık 'Yarım kalan oturum var' modalı AÇMAZ (çapraz-bayrak koruması; ön koşul eski varsayım güncellendi); bayrak sonradan AÇILIP runReplace çağrılsa da güvenli RUN SİLİNMEZ/yerel RUN'a dönüşmez (aynı RUN korunur)", aT(o0, 3) && m1 !== "Yarım kalan oturum var" && r.run && r.id === o0.id && r.lsId === o0.id && r.gvn === "studyo" && r.aVar === 0, JSON.stringify({ onKosul: m1, run: r.run, ayni: r.id === o0.id, gvn: r.gvn, a: r.aVar }));
  await c.close(); }

/* =====================  HATA: sunucu oturumu yanıtları  ===================== */
for (const [kip, modal] of [["404", "Sorular şu an açılamadı"], ["500", "Sorular şu an açılamadı"], ["banka_yok", "Sorular şu an açılamadı"], ["bos", "Sorular şu an açılamadı"], ["ag", "Sorular şu an açılamadı"], ["402", "Bugünkü ücretsiz sorun bitti"]]) {
  sifirla(); const { c, p } = await sade(); await onYukle(p); await aiKur(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D.oturum = kip; const bn = await aiQn(p); const r = await bs(p, kk(1));
  t("HATA", `sunucu '${kip}': ön koşul oturum isteği ≥1; modal '${modal}'; RUN ve ake.run YOK; yerel yedek, yerel kota ve AI yok`, D.istekler.length >= 1 && r.modal === modal && !r.run && r.lsId === null && D.kota === 0 && D.ai === 0 && (await aiQn(p)) === bn, JSON.stringify({ ist: D.istekler.length, modal: r.modal, run: r.run, kota: D.kota, ai: D.ai }));
  await c.close();
}
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D.oturum = "429"; const r = await bs(p, kk(1));
  t("HATA", "sunucu '429': ön koşul oturum isteği 1; RUN yok; 'Çok sık' bildirimi; yerel yedek/kota yok", D.istekler.length === 1 && !r.run && r.toast.some(m => /Çok sık/.test(m)) && D.kota === 0, JSON.stringify({ ist: D.istekler.length, run: r.run, toast: r.toast.slice(-1) }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D.oturum = "401"; const r = await bs(p, kk(1));
  t("HATA", "sunucu '401': ön koşul oturum isteği 1; RUN yok; giriş modalı; yerel yedek yok", D.istekler.length === 1 && !r.run && /giriş/i.test(r.modal) && D.kota === 0, JSON.stringify({ ist: D.istekler.length, run: r.run, modal: r.modal }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D.oturum = "ilkEksik"; const r = await bs(p, kk(1));
  t("HATA", "KISMİ yanıt (sunucu ilk soruyu vermedi): yalnız sunulan 4 soru açılır (sunucu oturumlu, cevapsız), yerel soru yok; bildirim", bT(r, 4) && D.istekler.length === 1 && r.toast.some(m => /yalnız sunulan 4/.test(m)), JSON.stringify({ n: r.n, sv: r.svN, ist: D.istekler.length, toast: r.toast.slice(-1) }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D.oturum = "500"; const r1 = await bs(p, kk(1)); D.oturum = "tam"; await p.evaluate(() => { ACT.svTekrar(); }); const r2 = await ozet(p);
  t("HATA", "500 sonrası 'Tekrar dene': aynı istek anahtarıyla (çift kota yok) güvenli benzer RUN açılır", r1.modal === "Sorular şu an açılamadı" && !r1.run && D.istekler.length === 2 && D.istekler[0].istek === D.istekler[1].istek && bT(r2, 5), JSON.stringify({ m1: r1.modal, ist: D.istekler.length, ayni: D.istekler.length === 2 && D.istekler[0].istek === D.istekler[1].istek, run: r2.run }));
  await c.close(); }

/* =====================  KATALOG yüklenmesi / giriş  ===================== */
{ sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D2.tut = G; await bz(p, kk(1)); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p); G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("KATALOG", "katalog YÜKLENİRKEN benzerMist: beklerken RUN yok ('yükleniyor' bildirimi); katalog gelince güvenli benzer RUN (5 soru, gvn='studyo')", !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && bT(r, 5), JSON.stringify({ r1: r1.run, toast: r1.toast.slice(-2), r: r.run, gvn: r.gvn }));
  await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, giris: false }); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const r = await bs(p, kk(1));
  t("KATALOG", "giriş YOKKEN benzerMist: giriş modalı; RUN yok; sunucu oturumu/AI/kota yok", !r.run && /giriş/i.test(r.modal) && D.istekler.length === 0 && D.ai === 0 && D.kota === 0, JSON.stringify({ run: r.run, modal: r.modal }));
  await c.close(); }
{ sifirla(); D2.kat = "500"; const { c, p } = await sade("#yanlislar"); await aiKur(p); await bankMistKur(p, BK0); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(600); await bz(p, BK0.ids[0]); await p.waitForTimeout(600); const r = await ozet(p);
  t("KATALOG", "katalog 500 (yüklenemedi): benzerMist yerel BANK/GENS/AI'ya DÜŞMEZ: RUN yok, AI yok, sunucu oturumu yok, yerel kota yok", D2.katIstek >= 1 && !r.run && D.ai === 0 && D.istekler.length === 0 && D.kota === 0, JSON.stringify({ kat: D2.katIstek, run: r.run, ai: D.ai, toast: r.toast.slice(-1), modal: r.modal }));
  await c.close(); }

/* =====================  YARIŞLAR (oturum yanıtı BEKLETİLİR; ön koşul: istek gerçekten uçuşta)  ===================== */
{ sifirla(); const G = kapiYap(); D4.oturumTut = G; const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]);
  await bz(p, kk(1)); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await hesapDegis(c, p, "kulB"); G.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("YARIŞ", "oturum isteği uçuştayken hesap kul1→kulB: eski yanıt kulB'de RUN AÇAMAZ, kota/AI yok", pre === 1 && !(r.run && r.ids.some(i => KS.has(i))) && D.kota === 0 && D.ai === 0, JSON.stringify({ pre, run: r.run, kota: D.kota }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); D4.oturumTut = G; const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]);
  await bz(p, kk(1)); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await hesapDegis(c, p, "kulB"); await hesapDegis(c, p, "kul1"); G.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("YARIŞ", "A→B→A: uçuştaki eski oturum yanıtı yeni (aynı kimlikli) oturumda RUN AÇAMAZ", pre === 1 && !r.run && D.kota === 0, JSON.stringify({ pre, run: r.run }));
  await c.close(); }
{ sifirla(); const G = kapiYap(), K = kapiYap(); D4.oturumTut = G; D3.cikisTut = K; const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]);
  await bz(p, kk(1)); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G.ac(); K.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("YARIŞ", "oturum isteği uçuştayken ÇIKIŞ: eski yanıt RUN AÇAMAZ; çıkış bitince de açılmaz", pre === 1 && !r.run, JSON.stringify({ pre, run: r.run }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D2.tut = G;
  await bz(p, kk(1)); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p); await hesapDegis(c, p, "kulB"); G.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken hesap kul1→kulB: bekleyen benzer eylemi RUN AÇAMAZ (ön koşul: 'yükleniyor' görüldü, RUN yok)", !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && !(r.run && r.ids.some(i => KS.has(i))), JSON.stringify({ r1: r1.run, r: r.run }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); D3.cikisTut = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D2.tut = G;
  await bz(p, kk(1)); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p); await p.evaluate(() => { ACT.cikis(); }); await bekle(() => D3.cikisGeldi, 3000); G.ac(); D3.cikisTut.ac(); await bekle(() => false, 1500); const r = await ozet(p);
  t("YARIŞ", "katalog beklerken ÇIKIŞ: bekleyen benzer eylemi RUN AÇAMAZ", !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && !r.run, JSON.stringify({ r1: r1.run, r: r.run }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const r = await bs(p, kk(1)); await hesapDegis(c, p, "kulB"); const rB = await ozet(p);
  const sz = await p.evaluate(() => JSON.stringify([S.mistakes, S.exams, localStorage.getItem("ake.run") || "", RUN]).includes("kat-a-koc"));
  t("YARIŞ", "güvenli benzer RUN açıkken hesap kulB'ye geçilince: A'nın RUN'ı ve yanlış kayıtları B'de yok (ön koşul: A'da güvenli RUN açıldı)", bT(r, 5) && !rB.run && !sz, JSON.stringify({ rA: r.run, rB: rB.run, sz }));
  await c.close(); }

/* =====================  BİTİŞ  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); const bn = await aiQn(p); const r = await bs(p, kk(1));
  await p.evaluate(async () => { if (!RUN) return; pickAnswer(1); for (let j = 0; j < 40 && !RUN.rev[0]; j++) await new Promise(x => setTimeout(x, 50)); }); const a = await p.evaluate(() => ({ a: !!RUN && Number.isInteger(RUN.qs[0].a), rev: !!RUN && !!RUN.rev[0] }));
  await bitirTikla(p); await bekle(() => D.bitirler.length >= 1, 3000); await p.waitForTimeout(500); const rb = await ozet(p);
  t("BİTİŞ", "benzer RUN: cevap sunucuya gider (1 /cevap), anahtar yalnız cevaplanan soru için gelir; bitirme 1 kez /bitir, RUN ve ake.run temizlenir; S.aiQs ve yerel kota değişmez", bT(r, 5) && D.cevap === 1 && a.a && a.rev && D.bitirler.length === 1 && !rb.run && rb.lsId === null && (await aiQn(p)) === bn && D.kota === 0 && D.ai === 0, JSON.stringify({ cevap: D.cevap, a, bitir: D.bitirler.length, run: rb.run, kota: D.kota }));
  await c.close(); }

/* =====================  DOM: gerçek düğme (bayrak AÇIK)  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(2), ts: BIRLIK(1) }]); await git(p, "#yanlislar"); const tk = await tikla(p, `[data-a="benzerMist"][data-id="${kk(2)}"]`), r = await ozet(p);
  t("DOM", "Tekrar ekranı 'Benzerini çöz' düğmesi: güvenli benzer RUN (gvn='studyo', 5 sunucu oturumlu cevapsız soru)", tk && bT(r, 5) && !r.ids.includes(kk(2)), JSON.stringify({ tk, run: r.run, gvn: r.gvn, n: r.n }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(2), ts: BIRLIK(1) }]); await git(p, "#yanlislar"); await tikla(p, `[data-a="benzerMist"][data-id="${kk(2)}"]`); const r = await ozet(p);
  t("DOM", "'Benzerini çöz' sonrası sayfa DOM'unda ve ake.run'da çözüm metni/anahtar sızıntısı yok", r.run && !r.domSizinti && !r.lsSizinti && r.aVar === 0 && r.xVar === 0, JSON.stringify({ run: r.run, dom: r.domSizinti, ls: r.lsSizinti }));
  await c.close(); }

/* =====================  ÇAPRAZ BAYRAK: açık güvenli RUN (gvn) varken AKE_KATALOG_STUDYO KAPALI  ===================== */
const korundu = (r, o0) => r.run && r.id === o0.id && r.lsId === o0.id && r.gvn === "studyo" && r.aVar === 0 && r.yerelN === 0 && r.genN === 0 && r.bankN === 0 && r.tuzakN === 0;
const guvenliRunKur = async (p) => { await onYukle(p); await mistKur(p, N10.slice(0, 3)); await bankMistKur(p, BK0); const o0 = await mist(p, "start"); return o0; };
{ sifirla(); const { c, p } = await sade(); const o0 = await guvenliRunKur(p); const base = D.istekler.length; await bayrak(p, false); await aiKur(p); const bn = await aiQn(p);
  await bz(p, BK0.ids[0]); await p.waitForTimeout(500); const m1 = await p.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m1 === "Yarım kalan oturum var") await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(600); const r = await ozet(p);
  t("ÇAPRAZ", "bayrak KAPALI + açık güvenli RUN: yanlış listesinden 'Benzerini çöz' (yerel benzer üretilebilir konu) güvenli RUN'ı SİLMEZ/EZMEZ; yerel cevaplı benzer RUN, AI, S.aiQs ve yerel kota yok (varsa 'Yenisini başlat' de korur)", aT(o0, 3) && korundu(r, o0) && D.ai === 0 && D.kota === 0 && D.istekler.length === base && (await aiQn(p)) === bn, JSON.stringify({ onKosul: aT(o0, 3), modal: m1, run: r.run, ayni: r.id === o0.id, gvn: r.gvn, a: r.aVar, ai: D.ai, kota: D.kota }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); const o0 = await guvenliRunKur(p); const base = D.istekler.length; await bayrak(p, false); await aiKur(p); const bn = await aiQn(p);
  await bz(p, kk(1)); await p.waitForTimeout(400); const m1 = await p.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m1 === AIMODAL) { await p.evaluate(() => { ACT.benzerAIGo(); }); await p.waitForTimeout(1500); }
  const m2 = await p.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m2 === "Yarım kalan oturum var") await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(600); const r = await ozet(p);
  t("ÇAPRAZ", "bayrak KAPALI + açık güvenli RUN, AI yolu (hazır benzer yok): AI modalı/AI çağrısı yok, S.aiQs yazılmaz, güvenli RUN korunur (silinmez), yerel kota yok", aT(o0, 3) && korundu(r, o0) && D.ai === 0 && D.kota === 0 && D.istekler.length === base && (await aiQn(p)) === bn, JSON.stringify({ onKosul: aT(o0, 3), m1, m2, run: r.run, ayni: r.id === o0.id, gvn: r.gvn, ai: D.ai }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); const o0 = await guvenliRunKur(p); await bayrak(p, false); await aiKur(p); const bn = await aiQn(p);
  await p.evaluate(id => { benzerYok(S.mistakes[id].q, "mist"); }, kk(1)); await p.waitForTimeout(300); const r = await ozet(p), bq = await p.evaluate(() => UI.benzerQ);
  t("ÇAPRAZ", "bayrak KAPALI + açık güvenli RUN: benzerYok(q,'mist') DOĞRUDAN → AI modalı açılmaz, UI.benzerQ kurulmaz, AI/S.aiQs yok", aT(o0, 3) && r.modal !== AIMODAL && !bq && D.ai === 0 && (await aiQn(p)) === bn && korundu(r, o0), JSON.stringify({ modal: r.modal, bqYok: !bq, ai: D.ai }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await bayrak(p, false); await aiKur(p); const bn = await aiQn(p);
  const r0 = await bs(p, kk(1)); await bayrak(p, true); const o0 = await mist(p, "start"); const base = D.istekler.length; await bayrak(p, false);
  await p.evaluate(() => { ACT.benzerAIGo(); }); await p.waitForTimeout(1200); const m2 = await p.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m2 === "Yarım kalan oturum var") await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(600); const r = await ozet(p);
  t("ÇAPRAZ", "ESKİ AI MODALI (güvenli RUN yokken açıldı) → sonra güvenli RUN açıldı + bayrak KAPALI → 'Üret' (benzerAIGo): AI çağrılmaz, S.aiQs yazılmaz, güvenli RUN korunur, yerel kota yok", r0.modal === AIMODAL && aT(o0, 3) && korundu(r, o0) && D.ai === 0 && D.kota === 0 && D.istekler.length === base && (await aiQn(p)) === bn, JSON.stringify({ onKosul: r0.modal === AIMODAL && aT(o0, 3), m2, run: r.run, ayni: r.id === o0.id, gvn: r.gvn, ai: D.ai }));
  await c.close(); }
{ sifirla(); const G = kapiYap(); D5.aiTut = G; const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); await bayrak(p, false); await aiKur(p); const bn = await aiQn(p);
  const r0 = await bs(p, kk(1)); await p.evaluate(() => { ACT.benzerAIGo(); }); await bekle(() => D.ai >= 1, 4000); const pre = D.ai; await bayrak(p, true); const o0 = await mist(p, "start"); await bayrak(p, false); G.ac(); await p.waitForTimeout(1500);
  const m2 = await p.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m2 === "Yarım kalan oturum var") await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(500); const r = await ozet(p);
  t("ÇAPRAZ", "AI YANITI BEKLENİRKEN güvenli RUN açılır + bayrak KAPALI: 2. (doğrulama) AI çağrısı yapılmaz (ai=1), S.aiQs yazılmaz, güvenli RUN korunur", r0.modal === AIMODAL && pre === 1 && aT(o0, 3) && D.ai === 1 && (await aiQn(p)) === bn && korundu(r, o0), JSON.stringify({ pre, ai: D.ai, m2, run: r.run, ayni: r.id === o0.id, gvn: r.gvn }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); const o0 = await guvenliRunKur(p); const base = D.istekler.length; await bayrak(p, false);
  await p.evaluate(() => { UI.pendingRun = { kind: "benzer", title: "Benzer sorular · x", mode: "study", qs: BANK.slice(0, 3).map(q => snap(q)) }; openModal("Yarım kalan oturum var", "<p>x</p>", [{ l: "Yenisini başlat", a: "runReplace" }]); UI.modal.runOnay = true; ACT.runReplace(); }); await p.waitForTimeout(700); const r = await ozet(p);
  t("ÇAPRAZ", "bayrak KAPALI + açık güvenli RUN: DOĞRUDAN runReplace (bekleyen yerel kind='benzer' cfg): güvenli RUN silinmez, yerel RUN'a dönüşmez; yeni oturum isteği/yerel kota yok", aT(o0, 3) && korundu(r, o0) && D.kota === 0 && D.istekler.length === base, JSON.stringify({ run: r.run, ayni: r.id === o0.id, gvn: r.gvn, a: r.aVar, kota: D.kota }));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, N10.slice(0, 3)); const o0 = await mist(p, "start"); await p.waitForTimeout(600); await p.close();
  const p2 = await c.newPage(); p2.on("pageerror", () => { }); await p2.goto(URL0 + "#yanlislar", { waitUntil: "load" }); await p2.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }).catch(() => { });
  await p2.evaluate(() => { window.__t = []; const T = toast; window.toast = m => { window.__t.push(String(m)); T(m); }; });
  const f = await p2.evaluate(() => ({ flag: window.AKE_KATALOG_STUDYO === true, gvn: RUN ? RUN.gvn || null : null, id: RUN ? RUN.id : null }));
  await bankMistKur(p2, BK0); await mistKur(p2, [{ id: kk(1), ts: BIRLIK(1) }]); await aiKur(p2); const bn = await aiQn(p2); const base = D.istekler.length;
  await bz(p2, BK0.ids[0]); await p2.waitForTimeout(500); let m1 = await p2.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m1 === "Yarım kalan oturum var") await p2.evaluate(() => { ACT.runReplace(); }); await p2.waitForTimeout(500);
  await bz(p2, kk(1)); await p2.waitForTimeout(500); const m3 = await p2.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m3 === AIMODAL) { await p2.evaluate(() => { ACT.benzerAIGo(); }); await p2.waitForTimeout(1200); } const m4 = await p2.evaluate(() => (UI.modal ? UI.modal.title : "")); if (m4 === "Yarım kalan oturum var") await p2.evaluate(() => { ACT.runReplace(); }); await p2.waitForTimeout(500);
  const r = await ozet(p2);
  t("ÇAPRAZ", "YENİLEME sonrası varsayılan KAPALI bayrak + ake.run'daki güvenli RUN (ön koşul: yenilenen sayfada bayrak kapalı, RUN gvn='studyo', aynı kimlik): 'Benzerini çöz' (yerel benzerli ve AI yollu) güvenli RUN'ı silmez; yerel RUN/AI/S.aiQs/yerel kota yok", aT(o0, 3) && f.flag === false && f.gvn === "studyo" && f.id === o0.id && korundu(r, o0) && D.ai === 0 && D.kota === 0 && D.istekler.length === base && (await aiQn(p2)) === bn, JSON.stringify({ f: { flag: f.flag, gvn: f.gvn, ayni: f.id === o0.id }, m1, m3, m4, run: r.run, ayni: r.id === o0.id, gvn: r.gvn, ai: D.ai, kota: D.kota }));
  await c.close(); }
/* karakterizasyon: güvenli RUN YOK (yalnız eski işaretsiz yerel RUN), bayrak KAPALI → mevcut davranış aynen: 'Yarım kalan oturum' → 'Yenisini başlat' yerel benzer RUN açar */
{ sifirla(); D.oturum = "banka_yok"; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await bankMistKur(p, BK0); await eskiRunKur(p, null); const o0 = await ozet(p);
  await bz(p, BK0.ids[0]); await p.waitForTimeout(500); const m1 = await p.evaluate(() => (UI.modal ? UI.modal.title : "")); await p.evaluate(() => { ACT.runReplace(); }); await p.waitForTimeout(800); const r = await ozet(p);
  t("KARAKT", "bayrak KAPALI + güvenli RUN YOK (eski yerel RUN): 'Yarım kalan oturum var' → 'Yenisini başlat' eskiden olduğu gibi yerel benzer RUN açar (davranış korunur)", o0.gvn === null && m1 === "Yarım kalan oturum var" && r.run && r.id !== o0.id && r.kind === "benzer" && r.gvn === null && r.aVar === r.n, JSON.stringify({ m1, run: r.run, degisti: r.id !== o0.id, kind: r.kind, gvn: r.gvn, a: r.aVar, n: r.n }));
  await c.close(); }

/* =====================  BAYRAK KAPANMA YARIŞI: bekleyen güvenli benzer eylemi (katalog GET / oturum isteği uçuştayken AKE_KATALOG_STUDYO=false)  ===================== */
for (const kat of ["tam", "404", "bos"]) {
  sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await aiKur(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D2.kat = kat; D2.tut = G; const bn = await aiQn(p);
  await bz(p, kk(1)); await bekle(() => D2.katIstek >= 1, 3000); await p.waitForTimeout(300); const r1 = await ozet(p); await bayrak(p, false); G.ac(); await p.waitForTimeout(1800); const r = await ozet(p);
  t("KAPANMA", `katalog GET beklerken bayrak KAPANIR (katalog yanıtı '${kat}'): bekleyen güvenli benzer eylemi iptal edilir; işaretsiz/yerel RUN, ake.run, sunucu oturumu, yerel kota, AI ve S.aiQs yazımı YOK; açık mesaj (ön koşul: beklerken 'yükleniyor', RUN yok)`, !r1.run && r1.toast.some(m => /yükleniyor/i.test(m)) && D2.katIstek >= 1 && !r.run && r.lsId === null && D.istekler.length === 0 && D.kota === 0 && D.ai === 0 && (await aiQn(p)) === bn && r.toast.some(m => (kat === "tam" ? /iptal/i : /iptal|yüklenemedi|hazır değil/i).test(m)), JSON.stringify({ pre: !r1.run, kat: D2.katIstek, run: r.run, gvn: r.gvn, kind: r.kind, ist: D.istekler.length, kota: D.kota, ai: D.ai, toast: r.toast.slice(-2) }));
  await c.close();
}
for (const kip of ["404", "bos", "tam"]) {
  sifirla(); const G = kapiYap(); D4.oturumTut = G; const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D.oturum = kip;
  await bz(p, kk(1)); await bekle(() => D.istekler.length >= 1, 3000); const pre = D.istekler.length; await bayrak(p, false); G.ac(); await p.waitForTimeout(1200); const r = await ozet(p);
  t("KAPANMA", `sunucu oturumu isteği uçuştayken bayrak KAPANIR (yanıt '${kip}'): güvenli cfg yerel cfg'ye dönüşmez; ${kip === "tam" ? "açılan RUN güvenlidir (gvn='studyo', cevapsız, sunucu oturumlu)" : "RUN yok, yerel yedek yok"}; yerel kota ve AI yok`, pre === 1 && yerelYok(r) && (kip === "tam" ? (r.run ? r.gvn === "studyo" && r.svN === r.n : true) : !r.run) && D.kota === 0 && D.ai === 0, JSON.stringify({ pre, run: r.run, gvn: r.gvn, sv: r.svN, n: r.n, modal: r.modal, kota: D.kota }));
  await c.close();
}
{ sifirla(); const G = kapiYap(); const { c, p } = await sade("#yanlislar"); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); D2.tut = G;
  await mistCagir(p, "start"); await bekle(() => D2.katIstek >= 1, 3000); await bayrak(p, false); G.ac(); await p.waitForTimeout(1800); const r = await ozet(p);
  bilgi("KAPANMA (yalnız bilgi, 3C-4f mistStart için aynı yarış; kapsam dışı, assert yok)", JSON.stringify({ run: r.run, gvn: r.gvn, kind: r.kind, n: r.n, aVar: r.aVar, sv: r.svN, kota: D.kota, ist: D.istekler.length }));
  await c.close(); }
/* karakterizasyon: bayrak KAPALIYKEN başlatılan normal benzer akışı (bayrak hiç açılmadı) aynen korunur */
{ sifirla(); D.oturum = "banka_yok"; const { c, p } = await sayfa({ guvenli: false, tuzak: false }); await bankMistKur(p, BK0); await bz(p, BK0.ids[0]); const r = await ozet(p);
  t("KARAKT", "bayrak KAPALI başlatılan normal benzer akışı (bayrak hiç açılmadı) korunur: yerel cevaplı RUN kind='benzer', gvn yok, iptal bildirimi yok", r.run && r.kind === "benzer" && r.gvn === null && r.aVar === r.n && !r.toast.some(m => /iptal/i.test(m)), JSON.stringify({ run: r.run, kind: r.kind, gvn: r.gvn, toast: r.toast.slice(-1) }));
  await c.close(); }

/* =====================  KAPSAM DIŞI (DEĞİŞMEZ; GÜVENLİ İLAN EDİLMEZ)  ===================== */
{ sifirla(); const { c, p } = await sade(); await onYukle(p); await mistKur(p, [{ id: kk(1), ts: BIRLIK(1) }]); await git(p, "#yanlislar"); await p.waitForTimeout(300);
  const g = await p.evaluate(() => ({ dogru: /Doğru cevap:/.test(document.body.innerHTML), eskiMetin: /ESKI-SNAPSHOT/.test(document.body.innerHTML) }));
  t("KAPSAM", "vMistakes listesi (KAPSAM DIŞI): açık yanlış satırında geçmiş 'Doğru cevap' yerel anlık görüntüden gösterilmeye devam eder", g.dogru && g.eskiMetin, JSON.stringify(g));
  await c.close(); }
{ sifirla(); const { c, p } = await sade(); const n = await p.evaluate(() => BANK.length);
  t("KAPSAM", "sayfa kaynağındaki BANK (KAPSAM DIŞI): cevaplı BANK sayfa kodunda kalmaya devam eder (en az 100 soru)", n >= 100, String(n));
  await c.close(); }

console.log(`\nTOPLAM: ${gecen} geçti, ${kalan} kaldı`); if (kirmizi.length) { console.log("KIRMIZI:"); kirmizi.forEach(k => console.log("  - " + k)); }
await b.close(); srv.close(); process.exit(kalan > 0 ? 1 : 0);
