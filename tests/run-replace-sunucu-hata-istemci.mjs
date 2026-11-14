// B4 · GÜVENLİ banka/paragraf "Yenisini başlat" + sunucu hatası testi (gerçek Chromium + SAHTE API; Production/Preview/D1'e dokunmaz). Uygulama koduna dokunulmaz; CI'a EKLENMEZ.
// Sözleşme: işaretli güvenli RUN açıkken "Yenisini başlat" onaylanır; yeni /api/soru/oturum isteği 500 veya 402 dönerse eski RUN ve ake.run AYNEN korunur (kimlik, soru sayısı, cevap sayısı),
// yerel fallback açılmaz; aynı istek sonra başarılı olunca onaylı değiştirme gerçekleşir. Cevap DEĞERLERİ çıktıya yazılmaz.
// Çalıştırma: node tests/run-replace-sunucu-hata-istemci.mjs
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 700)); };

const D = { istekler: [], kota: 0, ai: 0, cevap: 0, mod: "tam" };   // mod: "tam" | "500" | "402" (yalnız /api/soru/oturum)
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
    if (D.mod === "500") return js(r, 500, { error: "x" });
    if (D.mod === "402") return js(r, 402, { error: "kota", kota: { kalan: 0 } });
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



async function bankaRunAc(p) {
  await p.evaluate(async () => { RUN = null; UI.modal = null; ACT.bankAll(); for (let i = 0; i < 40 && !RUN; i++) await new Promise(r => setTimeout(r, 100)); });
  await p.waitForSelector('[data-a="pick"]', { timeout: 4000 }).catch(() => { }); await p.click('[data-a="pick"][data-o="0"]').catch(() => { });
  await p.waitForFunction(() => RUN && RUN.ans.some(a => a != null) && !UI.svBusy, null, { timeout: 4000 }).catch(() => { }); await p.waitForTimeout(200);
}
const gitHash = (p, h) => p.evaluate(h => { UI.inRun = false; location.hash = h; render(); }, h);
const degismedi = (a, c, ls0, ls1) => ayni(a, c) && ayni(ls0, ls1);
/* kaynak RUN'ı aç (banka → paragraf başlat | paragraf → banka başlat), "Yenisini başlat" penceresini aç */
async function penceredeBekle(p, kaynak) {
  if (kaynak === "banka") { await bankaRunAc(p); await gitHash(p, "#paragraf"); await p.waitForSelector('[data-a="paraStart"]', { timeout: 6000 }).catch(() => { }); await sec(p, "paraStart"); }
  else { await p.waitForSelector('[data-a="paraStart"]', { timeout: 6000 }).catch(() => { }); await sec(p, "paraStart"); await p.waitForFunction(() => RUN && RUN.gvn === "paragraf", null, { timeout: 5000 }).catch(() => { }); await p.waitForTimeout(300);
    await gitHash(p, "#banka"); await p.waitForTimeout(400); await p.evaluate(() => { UI.modal = null; ACT.bankAll(); }); }
  await p.waitForTimeout(500);
}
const YENI = { banka: "paragraf", paragraf: "banka" };

for (const kaynak of ["banka", "paragraf"]) for (const mod of ["500", "402"]) {
  D.mod = "tam"; sifirla(); const { c, p } = await sayfa({ hash: kaynak === "banka" ? "#banka" : "#paragraf" });
  if (kaynak === "paragraf") { /* paragraf RUN'ı: #paragraf'ta başlat */ }
  const ad = `${kaynak}→${YENI[kaynak]} / ${mod}`;
  if (kaynak === "banka") await penceredeBekle(p, "banka"); else await penceredeBekle(p, "paragraf");
  const onceki = await p.evaluate(() => null); const hepsi = await ozet(p);   // pencere açıkken RUN hâlâ kaynak RUN'ıdır
  D.mod = mod; const r0 = D.istekler.length, k0 = D.kota; await sec(p, "runReplace"); await p.waitForTimeout(1300); const o1 = await ozet(p);
  const kaynakOzet = hepsi;
  t("HATA " + ad, "a eski RUN ve ake.run AYNI kalır (kimlik, soru sayısı, cevap sayısı, cevap alanı sayısı); sunucuya istek gitti", !!kaynakOzet.run && kaynakOzet.run.gvn === kaynak && degismedi(kaynakOzet.run, o1.run, kaynakOzet.ls, o1.ls) && D.istekler.length === r0 + 1, JSON.stringify({ once: kaynakOzet.run, sonra: o1.run, ls: o1.ls, istek: D.istekler.length - r0 }));
  t("HATA " + ad, "b yerel fallback açılmaz: RUN'da yerel (sunucu oturumsuz) soru yok, kota isteği yok, kullanıcıya hata/limit penceresi gösterilir", !!o1.run && o1.run.svN === o1.run.n && D.kota === k0 && o1.modal.length > 0 && !(await p.evaluate(() => UI.svBusy)), JSON.stringify({ o1run: o1.run, kota: D.kota - k0, modal: o1.modal }));
  /* aynı istek başarılı olunca onaylı değiştirme */
  D.mod = "tam"; const tekrarVar = await p.evaluate(() => !!document.querySelector('[data-a="svTekrar"]'));
  if (tekrarVar) { await sec(p, "svTekrar"); } else { await p.evaluate(() => { UI.modal = null; render(); }); await gitHash(p, kaynak === "banka" ? "#paragraf" : "#banka"); await p.waitForTimeout(500);
    if (kaynak === "banka") { await p.waitForSelector('[data-a="paraStart"]', { timeout: 6000 }).catch(() => { }); await sec(p, "paraStart"); } else { await p.evaluate(() => { ACT.bankAll(); }); } await p.waitForTimeout(500); await sec(p, "runReplace"); }
  await p.waitForTimeout(1600); const o2 = await ozet(p);
  t("HATA " + ad, `c sunucu sonra başarılı olunca (${tekrarVar ? "aynı istek 'Tekrar dene'" : "yeniden onay"}) onaylı değiştirme olur: yeni RUN '${YENI[kaynak]}' işaretli, tümü sunucu oturumlu, cevapsız; ake.run yeni RUN ile aynı; eski id yok`, !!o2.run && o2.run.id !== kaynakOzet.run.id && o2.run.gvn === YENI[kaynak] && o2.run.svN === o2.run.n && o2.run.aAlan === 0 && ayni(o2.run, o2.ls) && o2.ls.id !== kaynakOzet.run.id, JSON.stringify({ tekrarVar, o2run: o2.run, o2ls: o2.ls })); await c.close(); }

/* güvenli OLMAYAN akış: mevcut onay davranışı korunur (eski RUN onayla hemen değişir) */
{ D.mod = "tam"; sifirla(); const { c, p } = await sayfa({ hash: "#bugun" });
  await p.evaluate(() => { window.SV_KAPAT = true; RUN = null; baslatRun({ kind: "practice", title: "Eski yerel oturum", mode: "study", qs: BANK.slice(0, 6) }); RUN.ans[0] = 0; saveRun(); UI.inRun = false; render(); }); const o0 = await ozet(p);
  await p.evaluate(() => { startRun({ kind: "practice", title: "Yeni yerel oturum", mode: "study", qs: BANK.slice(10, 14), canli: { ad: "x" } }); }); await p.waitForTimeout(400); await sec(p, "runReplace"); await p.waitForTimeout(800); const o1 = await ozet(p);
  t("YEREL", "d güvenli olmayan akışta 'Yenisini başlat' eski yerel RUN'ı onayla değiştirir (mevcut davranış): yeni id/başlık, ake.run aynı", !!o1.run && o1.run.id !== o0.run.id && o1.run.title === "Yeni yerel oturum" && ayni(o1.run, o1.ls), JSON.stringify({ o1run: o1.run })); await c.close(); }

console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı` + (kirmizi.length ? "\nKIRMIZI: " + kirmizi.join(" | ") : ""));
await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
