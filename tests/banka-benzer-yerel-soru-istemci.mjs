// B4 3C-1 açığı (kaynak okumasıyla bulundu) · #banka GÜVENLİ RUN'ında "Benzerini çöz" / benzer AI yerel cevaplı soru ekler mi?
// Gerçek Chromium + SAHTE API (Production/Preview/D1'e dokunmaz). Uygulama koduna dokunulmaz; bu dosya CI'a EKLENMEZ.
// Bayrak: window.AKE_KATALOG_BANKA === true (+ AKE_KATALOG, AKE_KATALOG_HAVUZ). Cevap anahtarı DEĞERLERİ çıktıya yazılmaz; yalnız varlık/sayı raporlanır.
// Gruplar: [KARAKT] bayrak KAPALI (mevcut davranış, yeşil kalmalı) · [KONTROL] güvenli başlangıç sağlam mı · [AÇIK] güvenli RUN'a yerel/AI soru GİRMEMELİ (şu an kırmızı = açığın kanıtı)
// Çalıştırma: node tests/banka-benzer-yerel-soru-istemci.mjs   ·   çıkış kodu: kırmızı sayısı > 0 ise 1
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), HTML = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"));
let gecen = 0, kalan = 0; const kirmizi = [];
const t = (grup, ad, ok, ek = "") => { ok ? gecen++ : (kalan++, kirmizi.push(grup + " " + ad)); console.log(ok ? "GEÇTİ " : "KALDI ", `[${grup}]`, ad, ok ? "" : String(ek).slice(0, 600)); };

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
const katKur = (ders, konu, on) => { const l = []; for (let i = 0; i < 30; i++) { const no = String(i).padStart(3, "0"); l.push({ id: `kat-${on}-${no}`, s: ders, t: konu, d: 1 + (i % 3), q: `KAT-${on.toUpperCase()}-${no} sentetik katalog sorusu`, o: ["A", "B", "C", "D", "E"].map(x => x + no) }); }
  l.forEach(x => { KATID[x.id] = x; }); return l; };

/* ders/konu: "gercek" → BANK'ta çok soru olan konu (yerel benzer bulunur) · "yok" → BANK'ta olmayan konu (yerel benzer bulunmaz → benzerYok/AI teklifi yolu) */
async function sayfa({ guvenli, konu = "gercek", ai = false } = {}) {
  KAT.set("kul1", konu === "gercek" ? katKur(SEC.s, SEC.t, "a") : katKur(SEC.s, "Sentetik Konu Yok", "a"));
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1200, height: 900 } }), p = await c.newPage(), hatalar = []; p.on("pageerror", e => hatalar.push(e.message));
  await p.addInitScript(g => { if (g) { window.AKE_KATALOG_BANKA = true; window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; } }, guvenli);
  await c.addCookies([{ name: "oturum", value: "kul1", url: URL0 }]);
  await p.goto(URL0 + "#banka", { waitUntil: "load" });
  await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 });
  if (ai) await p.evaluate(() => { WEBAI.code = "sentetik-kod"; webAIAc(); render(); });   // GERÇEK webAI() → sahte /api/ai (sayaç); Production AI'ına dokunulmaz
  await p.waitForTimeout(300); return { c, p, hatalar };
}
/* "Soru bankası" çalışması başlat (bankAll) + ilk soruyu GERÇEK arayüzden cevapla (çözüm bloğu ve "Benzerini çöz" düğmesi bu durumda görünür) */
async function baslatVeCevapla(p, guvenli) {
  if (guvenli) await p.waitForFunction(() => ["hazir", "durdu"].includes(KHAVUZ.durumu().durum), null, { timeout: 6000 }).catch(() => { });
  await p.waitForTimeout(150);
  await p.evaluate(async () => { RUN = null; UI.modal = null; UI.svBusy = false; ACT.bankAll(); for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 200)); });
  if (!(await p.evaluate(() => !!RUN))) return false;
  await p.waitForSelector('[data-a="pick"]', { timeout: 4000 }).catch(() => { });
  await p.click('[data-a="pick"][data-o="0"]').catch(() => { });
  await p.waitForFunction(() => RUN && Number.isInteger(RUN.qs[RUN.cur].a) && !UI.svBusy, null, { timeout: 4000 }).catch(() => { });
  await p.waitForTimeout(200); return true;
}
/* cevap DEĞERİ yok; yalnız sayı/varlık */
const ozet = p => p.evaluate(() => {
  const ls = (() => { try { return localStorage.getItem("ake.run") || ""; } catch (e) { return ""; } })(); let o = {}; try { o = JSON.parse(ls); } catch (e) { }
  const R = RUN, yerel = R ? R.qs.filter(q => !q.sv) : [];
  return { run: !!R, n: R ? R.qs.length : 0, svN: R ? R.qs.filter(q => q.sv).length : 0, yerelN: yerel.length, yerelAVar: yerel.filter(q => Number.isInteger(q.a)).length,
    yerelAI: yerel.filter(q => String(q.id).startsWith("ai-")).length, yerelGen: yerel.filter(q => String(q.id).startsWith("g:")).length, yerelBank: yerel.filter(q => !String(q.id).startsWith("ai-") && !String(q.id).startsWith("g:")).length,
    gvn: R ? (R.gvn || null) : null, lsGvn: o && o.gvn ? o.gvn : null, lsN: Array.isArray(o.qs) ? o.qs.length : -1, lsYerelA: Array.isArray(o.qs) ? o.qs.filter(q => !q.sv && Number.isInteger(q.a)).length : -1,
    benzerDugme: !!document.querySelector('[data-a="benzerEkle"]'), aiQs: (S.aiQs || []).length, aiay: (() => { try { return localStorage.getItem("ake.aiay") || ""; } catch (e) { return ""; } })(),
    modal: UI.modal ? String(UI.modal.title || "") : "", benzerBusy: !!UI.benzerBusy };
});
const sifirla = () => { D.istekler.length = 0; D.kota = 0; D.ai = 0; D.cevap = 0; };
const bekle = ms => new Promise(r => setTimeout(r, ms));

/* =====================  KARAKTERİZASYON (bayrak KAPALI): mevcut davranış korunmalı  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: false }); const ok = await baslatVeCevapla(p, false); const o0 = await ozet(p);
  await p.evaluate(() => ACT.benzerEkle()); await p.waitForTimeout(400); const o1 = await ozet(p);
  t("KARAKT", "K1 bayrak kapalı: 'Benzerini çöz' görünür ve benzerEkle yerel soru ekler (mevcut davranış; güvenli mod dışında DEĞİŞMEMELİ)", ok && o0.benzerDugme && o1.n > o0.n && o1.yerelN > 0, JSON.stringify({ o0: { n: o0.n, dugme: o0.benzerDugme }, o1: { n: o1.n, yerelN: o1.yerelN } })); await c.close(); }

/* =====================  KONTROL: güvenli başlangıç sağlam (sorunun "benzer" yoluna gelmeden önceki durum)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); const ok = await baslatVeCevapla(p, true); const o = await ozet(p);
  t("KONTROL", "C1 güvenli banka çalışması sunucu oturumuyla başladı: tüm sorular sv'li, yerel soru yok, ilk soru sunucudan cevaplandı", ok && o.n === 30 && o.svN === 30 && o.yerelN === 0 && D.istekler.length >= 1 && D.cevap >= 1, JSON.stringify({ ...o, istek: D.istekler.length, cevap: D.cevap }));
  t("KONTROL", "C2 başlangıçta ake.run'da yerel cevaplı soru yok", o.lsN === 30 && o.lsYerelA === 0, JSON.stringify({ lsN: o.lsN, lsYerelA: o.lsYerelA })); await c.close(); }

/* =====================  AÇIK: güvenli #banka RUN'ına yerel/AI cevaplı soru GİRMEMELİ (beklenen: kırmızı)  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await baslatVeCevapla(p, true); const o = await ozet(p);
  t("AÇIK", "A1 güvenli #banka RUN'ı kalıcı işaretli (RUN.gvn) ve işaret ake.run'a da yazılır", !!o.gvn && !!o.lsGvn, JSON.stringify({ gvn: o.gvn, lsGvn: o.lsGvn }));
  t("AÇIK", "A2 güvenli RUN'da 'Benzerini çöz' DÜĞMESİ görünmez", o.benzerDugme === false, JSON.stringify({ dugmeVar: o.benzerDugme })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await baslatVeCevapla(p, true); const o0 = await ozet(p), k0 = D.kota, a0 = D.ai, r0 = D.istekler.length;
  await p.evaluate(() => ACT.benzerEkle()); await p.waitForTimeout(500); const o1 = await ozet(p);
  const ek = { once: { n: o0.n, yerelN: o0.yerelN }, sonra: { n: o1.n, yerelN: o1.yerelN, yerelAVar: o1.yerelAVar, yerelBank: o1.yerelBank, yerelGen: o1.yerelGen, lsN: o1.lsN, lsYerelA: o1.lsYerelA } };
  t("AÇIK", "A3 benzerEkle eylemi (düğme gizli olsa da doğrudan çağrı) RUN'a yerel soru EKLEMEZ", o1.n === o0.n && o1.yerelN === 0, JSON.stringify(ek));
  t("AÇIK", "A4 benzerEkle sonrası RUN'da yerel CEVAPLI soru yok (BANK/GENS kaynaklı a/x istemcide RUN'a girmemeli)", o1.yerelAVar === 0, JSON.stringify(ek));
  t("AÇIK", "A5 benzerEkle sonrası ake.run'a (localStorage) yerel cevaplı soru YAZILMAZ", o1.lsYerelA === 0, JSON.stringify(ek));
  t("KONTROL", "C3 benzerEkle AI çağrısı ve kota isteği yapmaz (yalnız yerel yol; yeni /oturum isteği de yok)", D.ai === a0 && D.kota === k0 && D.istekler.length === r0, JSON.stringify({ ai: D.ai - a0, kota: D.kota - k0, oturumIstegi: D.istekler.length - r0 })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, ai: true }); await baslatVeCevapla(p, true);
  const d0 = await ozet(p); await p.evaluate(() => { const q = RUN.qs[RUN.cur]; UI.benzerQ = { q: snap(q), yer: "run" }; });
  await p.evaluate(() => ACT.benzerAIGo()); await p.waitForTimeout(1500); const o1 = await ozet(p);
  const ek = { aiCagrisi: D.ai, aiQs: o1.aiQs, runN: o1.n, yerelAI: o1.yerelAI, aiay: o1.aiay ? "var" : "yok" };
  t("AÇIK", "A6 benzer AI eylemi: AI çağrısı YAPILMAZ ve hak harcanmaz (ake.aiay artmaz)", D.ai === 0 && (o1.aiay || "") === (d0.aiay || ""), JSON.stringify(ek));
  t("AÇIK", "A7 benzer AI eylemi: RUN'a ve S.aiQs'a yerel cevaplı AI sorusu EKLENMEZ", o1.n === d0.n && o1.yerelAI === 0 && o1.aiQs === d0.aiQs, JSON.stringify(ek)); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, ai: true, konu: "yok" }); await baslatVeCevapla(p, true);   // yerel benzeri OLMAYAN konu → benzerYok → AI teklifi yolu
  const d0 = await ozet(p);
  await p.evaluate(() => ACT.benzerEkle()); await p.waitForTimeout(500); const o1 = await ozet(p);
  t("AÇIK", "A8 yerel benzeri olmayan konuda benzerEkle 'AI ile benzer soru üretilsin mi?' teklifini AÇMAZ (güvenli RUN'a AI yolu yok)", !/benzer/i.test(o1.modal), JSON.stringify({ modal: o1.modal }));
  if (/benzer/i.test(o1.modal)) { await p.evaluate(() => ACT.benzerAIGo()); await p.waitForTimeout(1500); }
  const o2 = await ozet(p);
  t("AÇIK", "A9 aynı yolda sonuçta AI çağrısı olmaz, RUN ve S.aiQs değişmez", D.ai === 0 && o2.n === d0.n && o2.aiQs === d0.aiQs, JSON.stringify({ aiCagrisi: D.ai, n0: d0.n, n2: o2.n, aiQs: o2.aiQs, yerelAI: o2.yerelAI })); await c.close(); }

/* =====================  YENİLEME + DEVAM: koruma işaret kalıcı olduğu için yenilemeden sonra da sürer  ===================== */
{ sifirla(); const { c, p } = await sayfa({ guvenli: true, ai: true, konu: "yok" }); await baslatVeCevapla(p, true); const d0 = await ozet(p);
  await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 });
  await p.evaluate(() => { WEBAI.code = "sentetik-kod"; webAIAc(); }); await p.waitForTimeout(500);
  await p.evaluate(() => { if (RUN) ACT.resume(); }); await p.waitForTimeout(300); const o1 = await ozet(p);
  t("AÇIK", "R1 yenileme sonrası güvenli RUN geri yüklenir, RUN.gvn işareti korunur, tüm sorular sv'li ve cevapsız", o1.run && o1.n === d0.n && !!o1.gvn && o1.svN === o1.n, JSON.stringify({ n0: d0.n, n1: o1.n, gvn: o1.gvn, svN: o1.svN }));
  const a0 = D.ai, k0 = D.kota, r0 = D.istekler.length;
  await p.evaluate(() => ACT.benzerEkle()); await p.waitForTimeout(400);
  await p.evaluate(() => { const q = RUN.qs[RUN.cur]; benzerYok(q, "run"); }); await p.waitForTimeout(300);
  await p.evaluate(() => { const q = RUN.qs[RUN.cur]; UI.benzerQ = { q: snap(q), yer: "run" }; ACT.benzerAIGo(); }); await p.waitForTimeout(1200);
  await p.evaluate(() => { const q = RUN.qs[RUN.cur]; benzerYerlestir([Object.assign(snap(q), { id: "yerel-x", sv: undefined, a: 0, x: "sentetik" })]); }); await p.waitForTimeout(300);
  const o2 = await ozet(p);
  t("AÇIK", "R2 yenileme + devamdan sonra benzerEkle/benzerYok/benzerAIGo/benzerYerlestir doğrudan çağrılsa da RUN, ake.run ve S.aiQs'a yerel cevaplı soru girmez", o2.n === o1.n && o2.yerelN === 0 && o2.yerelAVar === 0 && o2.lsYerelA === 0 && o2.aiQs === o1.aiQs, JSON.stringify({ n1: o1.n, n2: o2.n, yerelN: o2.yerelN, lsYerelA: o2.lsYerelA, aiQs: o2.aiQs }));
  t("AÇIK", "R3 aynı çağrılar AI isteği, hak harcaması (ake.aiay), kota ve yeni /oturum isteği üretmez; teklif modalı açık kalmaz", D.ai === a0 && D.kota === k0 && D.istekler.length === r0 && (o2.aiay || "") === (o1.aiay || "") && !/benzer/i.test(o2.modal), JSON.stringify({ ai: D.ai - a0, kota: D.kota - k0, oturum: D.istekler.length - r0, modal: o2.modal })); await c.close(); }
{ sifirla(); const { c, p } = await sayfa({ guvenli: true }); await baslatVeCevapla(p, true);
  const m = await p.evaluate(() => { const T = window.toast; let g = ""; window.toast = x => { g = String(x); }; ACT.benzerEkle(); window.toast = T; return g; });
  t("AÇIK", "R4 banka için engel metni genel 'güvenli oturum' (paragrafa özgü ifade yok)", /güvenli oturum/i.test(m) && !/paragraf/i.test(m), JSON.stringify({ metin: m })); await c.close(); }

console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı` + (kirmizi.length ? "\nKIRMIZI: " + kirmizi.join(" | ") : ""));
await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
