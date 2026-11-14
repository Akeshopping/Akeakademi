// B4 · #banka ⇄ #paragraf RUN GEÇİŞ testi (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz). Uygulama koduna dokunulmaz; CI'a EKLENMEZ.
// Senaryo 1: güvenli #banka RUN'ı açıkken #paragraf'ta yeni çalışma başlat → banka RUN'ı onaysız silinmemeli/değişmemeli; "Devam et" doğru çalışmayı açmalı.
// Senaryo 2: işaretsiz ESKİ YEREL RUN (cevaplı) açıkken güvenli #banka başlat → sessizce ezilmemeli; cevaplı sorular güvenli RUN'a taşınmamalı.
// Cevap DEĞERLERİ çıktıya yazılmaz; yalnız kimlik, sayı ve cevap alanının VARLIĞI raporlanır. Çalıştırma: node tests/banka-paragraf-run-gecis-istemci.mjs
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 700)); };

const D = { istekler: [], kota: 0, ai: 0, cevap: 0 };
const KAT = new Map(), KATID = {};   // KAT: kullanıcı → [{id,s,t,d,q,o}] (BANK id'lerinden farklı, sentetik); KATID: id → soru
let BILGI = new Map(), SEC = { s: "", t: "" };   // BILGI: BANK (yalnız sahte sunucunun BANK id'li oturum isteğine yanıtı + karakterizasyon için)
const KAPALI_ANAHTAR = 1;   // sahte sunucunun cevap sonrası döndüğü sentetik doğru şık (değer çıktıya yazılmaz)
const js = (r, kod, o) => { r.statusCode = kod; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); r.end(JSON.stringify(o)); };
const govde = q => new Promise(ok => { let s = ""; q.on("data", c => s += c); q.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { ok({}); } }); });
const srv = http.createServer(async (q, r) => {
  const f = new URL(q.url, "http://x").pathname, kul = ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(HTML); }
  if (f === "/api/hesap/ben") { if (!kul) return js(r, 401, { error: "giris" }); return js(r, 200, { kullanici: { id: kul, eposta: kul + "@x.test", ad: "" }, paket: null, ucretsiz: null, ayar: { google: false, eposta: true } }); }
  if (f === "/api/hesap/veri") return js(r, 200, { alanlar: {} });
  if (f === "/api/hesap/kota") { const b = await govde(q); D.kota++; return js(r, 200, { verildi: b.adet || 1, kalanSoru: 500, kalanDeneme: 5 }); }
  if (f === "/api/soru/katalog") {
    if (!kul) return js(r, 401, {}); const l = (KAT.get(kul) || []).map(x => ({ ...x }));
    return js(r, 200, { n: l.length, bayrak: "hazir", beklenen: { toplam: l.length, os: 0, fix: 0 }, sorular: l, sonraki: null });
  }
  if (f === "/api/soru/oturum") {
    const b = await govde(q); D.istekler.push({ idSayisi: Array.isArray(b.idler) ? b.idler.length : -1 });
    const idler = (b.idler || []).filter(i => BILGI.has(i) || KATID[i]);
    return js(r, 200, { oturum: "o" + Math.floor(Math.random() * 1e9), kota: { sinirsiz: true }, sorular: idler.map(i => { const k = BILGI.get(i) || KATID[i]; return { id: k.id, q: k.q, o: k.o, ...(k.p ? { p: k.p } : {}) }; }) });
  }
  if (f === "/api/soru/cevap") { await govde(q); D.cevap++; return js(r, 200, { a: KAPALI_ANAHTAR, x: "sentetik açıklama" }); }
  if (f === "/api/soru/bitir") { await govde(q); return js(r, 200, { ok: true, sorular: [] }); }
  if (f === "/api/ai") {   // sahte AI: 1. çağrı 3 geçerli (sentetik) soru üretir, 2. çağrı doğrulama dizisi döndürür; yalnız SAYILIR
    const b = await govde(q); D.ai++;
    const soru = i => ({ p: "", q: `AI-SENTETIK ${i} soru kökü`, o: ["a1", "b2", "c3", "d4", "e5"].map(x => x + "-" + i), a: 2, x: "sentetik açıklama" });
    const txt = (b.messages && b.messages[0] && /bağımsız olarak/.test(b.messages[0].content)) ? "[2,2,2]" : JSON.stringify([soru(1), soru(2), soru(3)]);
    return js(r, 200, { text: txt });
  }
  if (f.startsWith("/api/")) return js(r, 404, {});
  r.statusCode = 404; r.end("");   // /sorular/* dahil: BANK yalnız index.html'deki gömülü sorulardan oluşur (deterministik)
});
await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"] });

/* BANK'tan YALNIZ cevapsız alanlar okunur (a/x ALINMAZ). SEC = BANK'ta en çok sorusu olan ders+konu (yerel "benzer" havuzu GERÇEKÇİ olsun) */
{ const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage(); await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(800);
  const l = await p.evaluate(() => BANK.map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, ...(q.p ? { p: q.p } : {}) })));
  BILGI = new Map(l.map(x => [x.id, x])); const say = {}; l.forEach(x => { const k = x.s + "\u0001" + x.t; say[k] = (say[k] || 0) + 1; });
  const en = Object.entries(say).sort((x, y) => y[1] - x[1])[0]; if (en) { const [s, tt] = en[0].split("\u0001"); SEC = { s, t: tt, n: en[1] }; }
  await c.close(); }
if (BILGI.size < 100 || !SEC.s || SEC.n < 8) { console.error("TEST GEÇERSİZ: BANK okunamadı / yeterli konu yok " + BILGI.size + " " + SEC.n); process.exit(2); }

const DIGER = [...BILGI.values()].map(x => x.s).find(s => s !== "turkce");
{ const l = []; for (let i = 0; i < 30; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-a-b${no}`, s: DIGER, t: "Konu X", d: 1 + (i % 3), q: `BNK-${no} sentetik banka sorusu`, o: ["A", "B", "C", "D", "E"].map(x => x + no) }); }
  for (let i = 1; i <= 24; i++) { const no = String(i).padStart(2, "0"); l.push({ id: `kat-a-p${no}`, s: "turkce", t: "Paragraf", d: 1 + (i % 3), p: `SENTETİK-PARAGRAF-${no} parça`, q: `PAR-${no} sentetik paragraf sorusu`, o: ["A", "B", "C", "D", "E"].map(x => x + no) }); }
  l.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)); KAT.set("kul1", l); l.forEach(x => { KATID[x.id] = x; }); }
async function sayfa({ hash = "#banka" } = {}) {
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1200, height: 900 } }), p = await c.newPage(); p.on("pageerror", () => { });
  await p.addInitScript(() => { window.AKE_KATALOG_BANKA = true; window.AKE_KATALOG_PARAGRAF = true; window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; });
  await c.addCookies([{ name: "oturum", value: "kul1", url: URL0 }]);
  await p.goto(URL0 + hash, { waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 });
  await p.waitForFunction(() => ["hazir", "durdu"].includes(KHAVUZ.durumu().durum), null, { timeout: 7000 }).catch(() => { }); await p.waitForTimeout(300); return { c, p };
}
/* RUN ve ake.run kimliği: id, başlık, soru sayısı, cevaplanan sayısı, cevap ALANI olan soru sayısı (DEĞER yok), işaret */
const ozet = p => p.evaluate(() => {
  let o = {}; try { o = JSON.parse(localStorage.getItem("ake.run") || "{}"); } catch (e) { }
  const R = RUN, say = r => r && Array.isArray(r.qs) ? { id: r.id || null, title: r.title || null, n: r.qs.length, ans: (r.ans || []).filter(a => a != null).length, aAlan: r.qs.filter(q => Number.isInteger(q.a)).length, svN: r.qs.filter(q => q.sv).length, gvn: r.gvn || null } : null;
  return { run: say(R), ls: say(o), modal: UI.modal ? String(UI.modal.title || "") : "", inRun: !!UI.inRun, pending: !!UI.pendingRun };
});
const ayni = (a, c) => !!a && !!c && a.id === c.id && a.title === c.title && a.n === c.n && a.ans === c.ans && a.aAlan === c.aAlan && a.svN === c.svN && a.gvn === c.gvn;
const sifirla = () => { D.istekler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; };
const sec = (p, a) => p.evaluate(a => { const e = document.querySelector(`[data-a="${a}"]`); if (e) { e.click(); return true; } return false; }, a);

/* =====================  SENARYO 1: güvenli #banka RUN'ı açıkken #paragraf'ta yeni çalışma  ===================== */
{ sifirla(); const { c, p } = await sayfa({ hash: "#banka" });
  await p.evaluate(async () => { RUN = null; UI.modal = null; ACT.bankAll(); for (let i = 0; i < 40 && !RUN; i++) await new Promise(r => setTimeout(r, 100)); });
  await p.waitForSelector('[data-a="pick"]', { timeout: 4000 }).catch(() => { }); await p.click('[data-a="pick"][data-o="0"]').catch(() => { });
  await p.waitForFunction(() => RUN && RUN.ans.some(a => a != null) && !UI.svBusy, null, { timeout: 4000 }).catch(() => { }); await p.waitForTimeout(200);
  const o0 = await ozet(p), r0 = D.istekler.length;
  t("S1", "1a ön koşul: güvenli #banka RUN'ı var (gvn işaretli, sunucu oturumlu, ≥1 cevap; cevap alanı yalnız sunucunun açtığı cevaplanmış sorularda) ve ake.run ile aynı kimlikte", !!o0.run && o0.run.gvn === "banka" && o0.run.n === 40 && o0.run.svN === 40 && o0.run.ans >= 1 && o0.run.aAlan === o0.run.ans && ayni(o0.run, o0.ls), JSON.stringify(o0));
  await p.evaluate(() => { UI.inRun = false; location.hash = "#paragraf"; render(); });
  const par = await p.waitForSelector('[data-a="paraStart"]', { timeout: 6000 }).then(() => true, () => false); await p.waitForTimeout(300);
  const bant = await p.evaluate(() => { const e = document.querySelector(".banner"); return e ? e.innerText : ""; }), o1 = await ozet(p);
  t("S1", "1b #paragraf ekranı hazır; banka RUN'ı kimliğiyle (başlık, cevap sayısı) 'Yarım kalan oturum' olarak gösterilir ve eski oturum kartı DEĞİL", par && bant.includes(o0.run.title) && bant.includes(o0.run.ans + "/" + o0.run.n) && !(await p.evaluate(() => !!document.querySelector('[data-paragraf-durum="eski-oturum"]'))), JSON.stringify({ par, bant: bant.slice(0, 160) }));
  await sec(p, "paraStart"); await p.waitForTimeout(500); const o2 = await ozet(p);
  t("S1", "1c 'Paragraf antrenmanını başlat' tıklanınca banka RUN'ı ve ake.run DEĞİŞMEZ (onay penceresi açılır, yeni /oturum isteği yok)", ayni(o0.run, o2.run) && ayni(o0.ls, o2.ls) && /yarım kalan/i.test(o2.modal) && D.istekler.length === r0, JSON.stringify({ once: o0.run, sonra: o2.run, modal: o2.modal, yeniIstek: D.istekler.length - r0 }));
  const metin = await p.evaluate(() => { const m = document.querySelector(".modal, [role=dialog], #modal"); return m ? m.innerText : ""; });
  t("S1", "1d onay penceresi hangi çalışmanın silineceğini doğru adlandırır (banka RUN başlığı) ve devam seçeneği sunar", metin.includes(o0.run.title) && /eskisine devam/i.test(metin) && /yenisini başlat/i.test(metin), JSON.stringify({ metin: metin.slice(0, 200) }));
  await sec(p, "modalClose"); await p.waitForTimeout(300); const o3 = await ozet(p);
  t("S1", "1e 'Vazgeç' sonrası hiçbir şey değişmez", ayni(o0.run, o3.run) && ayni(o0.ls, o3.ls) && o3.modal === "", JSON.stringify({ o3run: o3.run, modal: o3.modal }));
  await sec(p, "paraStart"); await p.waitForTimeout(400); await sec(p, "resume"); await p.waitForTimeout(500); const o4 = await ozet(p);
  const gorunen = await p.evaluate(() => { const q = RUN && RUN.qs[RUN.cur]; return { var: !!document.querySelector('[data-a="pick"]'), metinVar: q ? document.body.innerText.includes(String(q.q).slice(0, 14)) : false }; });
  t("S1", "1f 'Eskisine devam et' banka RUN'ını (aynı kimlik, aynı cevaplar) açar; ekranda onun sorusu görünür; ake.run değişmez", ayni(o0.run, o4.run) && ayni(o0.ls, o4.ls) && o4.inRun && gorunen.var && gorunen.metinVar, JSON.stringify({ o4run: o4.run, inRun: o4.inRun, gorunen }));
  t("S1", "1g [HİJYEN] devam sonrası bekleyen paragraf başlangıcı (UI.pendingRun) kalmaz (sonradan yanlış 'Yenisini başlat'a bağlanamaz)", !o4.pending, JSON.stringify({ pending: o4.pending }));
  await p.evaluate(() => { UI.inRun = false; location.hash = "#paragraf"; render(); }); await p.waitForSelector('[data-a="paraStart"]', { timeout: 6000 }).catch(() => { });
  await sec(p, "paraStart"); await p.waitForTimeout(400); await sec(p, "runReplace"); await p.waitForTimeout(1500); const o5 = await ozet(p);
  t("S1", "1h yalnız AÇIK 'Yenisini başlat' sonrası değişir: yeni RUN işaretli 'paragraf', tümü sunucu oturumlu, cevap alanı yok, eski banka sorusu yok; ake.run yeni RUN ile aynı", !!o5.run && o5.run.id !== o0.run.id && o5.run.gvn === "paragraf" && o5.run.svN === o5.run.n && o5.run.aAlan === 0 && ayni(o5.run, o5.ls), JSON.stringify({ o5run: o5.run, o5ls: o5.ls })); await c.close(); }

/* =====================  SENARYO 2: işaretsiz ESKİ YEREL RUN açıkken güvenli #banka başlat  ===================== */
{ sifirla(); const { c, p } = await sayfa({ hash: "#banka" });
  await p.evaluate(() => { RUN = null; baslatRun({ kind: "practice", title: "Eski yerel oturum", mode: "study", qs: BANK.slice(0, 6) }); RUN.ans[0] = 0; RUN.ans[1] = 1; saveRun(); UI.inRun = false; location.hash = "#banka"; render(); });
  await p.waitForTimeout(400); const o0 = await ozet(p), r0 = D.istekler.length;
  t("S2", "2a ön koşul: işaretsiz eski yerel RUN var (gvn yok, 6 soru, 2 cevap, cevap alanlı sorular var) ve ake.run ile aynı", !!o0.run && !o0.run.gvn && o0.run.n === 6 && o0.run.ans === 2 && o0.run.aAlan === 6 && ayni(o0.run, o0.ls), JSON.stringify(o0));
  await p.evaluate(() => { ACT.bankAll(); }); await p.waitForTimeout(700); const o1 = await ozet(p);
  t("S2", "2b güvenli #banka başlatma eski RUN'ı ve ake.run'ı SESSİZCE değiştirmez ve sunucu oturumu açmaz (onay/uyarı gelir)", ayni(o0.run, o1.run) && ayni(o0.ls, o1.ls) && D.istekler.length === r0, JSON.stringify({ once: o0.run, sonra: o1.run, modal: o1.modal, yeniIstek: D.istekler.length - r0 }));
  const sec1 = await p.evaluate(() => !!document.querySelector('[data-a="runReplace"]'));
  t("S2", "2c paragraf gibi: eski işaretsiz RUN güvenli #banka tarafından EZİLEMEZ: 'Yenisini başlat' seçeneği sunulmaz, onay penceresi açılmaz, açık uyarı verilir", !sec1 && o1.modal === "", JSON.stringify({ yenisiniBaslatSunuldu: sec1, modal: o1.modal }));
  const kart = await p.evaluate(() => { const e = document.querySelector('[data-banka-durum="eski-oturum"]'); return e ? e.innerText : ""; });
  t("S2", "2d #banka ekranında anlaşılır 'eski oturum' kartı: eski RUN başlığı ve cevap sayısı (2/6) görünür; liste ve 'Çöz' düğmeleri normal durur", kart.includes(o0.run.title) && kart.includes("2/6") && /açmaz|silmez/i.test(kart), JSON.stringify({ kart: kart.slice(0, 160) }));
  /* force, doğrudan runReplace (bekleyen yok / bekleyen güvenli cfg), doğrudan resume: hiçbiri eski RUN'ı silmez/ezmez/açmaz */
  await p.evaluate(() => { startRun(bankaCfg({ kind: "practice", title: "Soru bankası", mode: "study", qs: bankListesi().slice(0, 5), force: true })); }); await p.waitForTimeout(500); const f1 = await ozet(p);
  t("S2", "2e force:true ile güvenli başlatma eski RUN'ı ve ake.run'ı ezmez, sunucu oturumu açmaz", ayni(o0.run, f1.run) && ayni(o0.ls, f1.ls) && D.istekler.length === r0, JSON.stringify({ f1run: f1.run, yeniIstek: D.istekler.length - r0 }));
  await p.evaluate(() => { UI.pendingRun = null; ACT.runReplace(); }); await p.waitForTimeout(400); const f2 = await ozet(p);
  t("S2", "2f doğrudan ACT.runReplace() (bekleyen çalışma yok) eski RUN'ı SİLMEZ", ayni(o0.run, f2.run) && ayni(o0.ls, f2.ls), JSON.stringify({ f2run: f2.run, f2ls: f2.ls }));
  await p.evaluate(() => { UI.pendingRun = bankaCfg({ kind: "practice", title: "Soru bankası", mode: "study", qs: bankListesi().slice(0, 5) }); ACT.runReplace(); }); await p.waitForTimeout(500); const f3 = await ozet(p);
  t("S2", "2g doğrudan ACT.runReplace() (bekleyen güvenli banka cfg'siyle) eski RUN'ı silmez/ezmez; bekleyen cfg temizlenir; yeni /oturum isteği yok", ayni(o0.run, f3.run) && ayni(o0.ls, f3.ls) && !f3.pending && D.istekler.length === r0, JSON.stringify({ f3run: f3.run, pending: f3.pending }));
  await p.evaluate(() => { ACT.resume(); }); await p.waitForTimeout(300); const f4 = await ozet(p);
  t("S2", "2h güvenli #banka ekranından ACT.resume() eski RUN'ı açmaz (inRun false), değiştirmez", !f4.inRun && ayni(o0.run, f4.run) && ayni(o0.ls, f4.ls), JSON.stringify({ inRun: f4.inRun, f4run: f4.run }));
  t("S2", "2i ake.run'daki eski RUN'ın soru ve cevapları korunur (sayı ve alan varlığı: 6 soru, 2 cevap, 6 cevap alanlı soru, yerel/işaretsiz)", f4.ls && f4.ls.n === 6 && f4.ls.ans === 2 && f4.ls.aAlan === 6 && f4.ls.svN === 0 && !f4.ls.gvn && f4.ls.id === o0.run.id, JSON.stringify({ ls: f4.ls }));
  /* kullanıcı eski RUN'ı BAŞKA akışta (güvenli olmayan ekran) açıp bitirebilmeli */
  await p.evaluate(() => { location.hash = "#bugun"; render(); }); await p.waitForTimeout(400);
  const bant = await p.evaluate(() => { const e = document.querySelector(".banner"); return e ? e.innerText : ""; }); await sec(p, "resume"); await p.waitForTimeout(400); const f5 = await ozet(p);
  t("S2", "2j başka ekranda (#bugun) 'Yarım kalan oturum' bandı eski RUN'ı gösterir ve 'Devam et' onu açar (veri kaybı yok); pendingRun temiz", bant.includes(o0.run.title) && f5.inRun && ayni(o0.run, f5.run) && !f5.pending, JSON.stringify({ bant: bant.slice(0, 120), inRun: f5.inRun, f5run: f5.run, pending: f5.pending })); await c.close(); }

console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı` + (kirmizi.length ? "\nKIRMIZI: " + kirmizi.join(" | ") : ""));
await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
