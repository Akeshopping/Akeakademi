// B4 · hesap geçişi / sekme çakışmasında DEPOLAMA HATALARI: kayıp yok, sahip-veri karışması yok, yeniden deneme ve açılışta toparlanma — GERÇEK Chromium + yerel sahte API + sahte depolama hataları.
// Hata enjektörü: sayfada window.__fail = [regex kaynakları] → eşleşen anahtara setItem QuotaExceededError atar (sayfa yenilenince sıfırlanır = depolama düzeldi).
// Kayıp kontrolü bellekte değil KALICI kayıtlarda (localStorage) ve yeniden açılışta yapılır. Çalıştırma: node tests/hesap-gecis-depolama-hatasi-istemci.mjs   (KAT_HTML=<index.html> ile mutasyon)
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), YENI = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"), "utf8");
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 500)); };
const bekle = ms => new Promise(o => setTimeout(o, ms));

/* ---- sahte sunucu ---- */
const ESKI = 1000;   // B'nin bulut kaydının zaman damgası (1970): A'nın yerel damgası kesinlikle daha yeni
const DB = {}, PUTLAR = [], D = { getSay: 0, putHata: {}, tutGet: {}, tutPut: {}, putDurum: {}, eski409: null };
const sifirla = () => {
  DB.A = {}; DB.C = {}; DB.B = {
    profile: { _u: ESKI, profile: { name: "Bora-B-ISMI", alan: "SAY", hedef: "", gunluk: 40, examDate: "2027-06-19", ok: true } },
    stats: { _u: ESKI, ans: { "B-bulut-soru-1": [1, 0, 0, ESKI, 1] }, topic: {}, daily: {}, para: { times: [], c: 0, w: 0 }, badges: {}, tr: {}, td: {} } };
  PUTLAR.length = 0; D.getSay = 0; D.putHata = {}; D.tutGet = {}; D.tutPut = {}; D.putDurum = {}; D.eski409 = null;
};
const kulOf = q => ((q.headers.cookie || "").match(/(?:^|;\s*)oturum=([^;]+)/) || [])[1];
const js = (r, kod, o, h = {}) => { r.statusCode = kod; r.setHeader("content-type", "application/json"); r.setHeader("cache-control", "no-store"); for (const k in h) r.setHeader(k, h[k]); r.end(JSON.stringify(o)); };
const govde = q => new Promise(ok => { let b = ""; q.on("data", d => b += d); q.on("end", () => ok(b)); });
const kapi = () => { let ac; const p = new Promise(o => { ac = o; }); return { kapi: p, ac }; };
const srv = http.createServer(async (q, r) => {
  const f = new URL(q.url, "http://x").pathname, kul = kulOf(q), baslik = q.headers["x-ake-hesap"];
  if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(YENI); }
  if (f === "/api/hesap/ben") { if (!kul || !DB[kul]) return js(r, 401, { error: "giris" }); return js(r, 200, { kullanici: { id: kul, eposta: kul.toLowerCase() + "@x.test", ad: "" }, paket: null, ucretsiz: null, ayar: { google: false, eposta: true } }); }
  if (f === "/api/hesap/veri" && q.method === "GET") {
    D.getSay++; if (D.tutGet[kul]) await D.tutGet[kul].kapi;   /* bekleyen GET: test serbest bırakana kadar yanıt gelmez (kimlik İSTEK ANINDAKİ çerezden) */
    if (!kul || !DB[kul]) return js(r, 401, {});
    if (baslik !== undefined && baslik !== kul) return js(r, 409, { error: "hesap_uyumsuz" });
    return js(r, 200, { alanlar: DB[kul] });
  }
  if (f.startsWith("/api/hesap/veri/") && q.method === "PUT") {
    const alan = f.split("/").pop(), b = await govde(q);
    PUTLAR.push({ hesap: kul, baslik, alan, govde: b, kabul: baslik === undefined || baslik === kul });
    if (D.tutPut[kul]) { const k = D.tutPut[kul]; D.tutPut[kul] = null; await k.kapi; if (D.putDurum[kul]) return js(r, D.putDurum[kul], {}); }
    if (!kul || !DB[kul]) return js(r, 401, {});
    if (baslik !== undefined && baslik !== kul) return js(r, 409, { error: "hesap_uyumsuz" });
    if (D.putHata[kul]) return js(r, D.putHata[kul], {});
    if (D.eski409 && D.eski409 === kul + ":" + alan) { D.eski409 = null; return js(r, 409, { error: "eski", u: 1 }); }
    let o = {}; try { o = JSON.parse(b); } catch (e) { } DB[kul][alan] = o; return js(r, 200, { ok: true });
  }
  if (f === "/api/hesap/cikis") return js(r, 200, { ok: true }, { "set-cookie": "oturum=; Path=/; Max-Age=0" });
  if (f === "/api/hesap/kod-dogrula") { const b = JSON.parse((await govde(q)) || "{}"), id = String(b.eposta || "").charAt(0).toUpperCase(); if (!DB[id]) return js(r, 400, { error: "kod_gecersiz" }); return js(r, 200, { kullanici: { id, eposta: b.eposta, ad: "" }, paket: null, ucretsiz: null }, { "set-cookie": "oturum=" + id + "; Path=/" }); }
  if (f.startsWith("/api/")) return js(r, 404, {});
  r.statusCode = 404; r.end("");
});
await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"] });

async function baglam(kul, baslangicLS) {
  const c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce" });
  if (baslangicLS) await c.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch (e) { } }, ["ake.state", JSON.stringify(baslangicLS)]);
  await c.addInitScript(() => { const o = Storage.prototype.setItem; window.__fail = (() => { try { return JSON.parse(sessionStorage.getItem("__failkal") || "[]"); } catch (e) { return []; } })(); Storage.prototype.setItem = function (k, v) { if (window.__fail.some(r => new RegExp(r).test(k))) throw new DOMException("dolu", "QuotaExceededError"); return o.call(this, k, v); }; });
  if (kul) await c.addCookies([{ name: "oturum", value: kul, url: URL0 }]);
  return c;
}
async function sayfaAc(c) {
  const p = await c.newPage(); const hatalar = []; p.on("pageerror", e => hatalar.push(String(e)));
  const y = await p.goto(URL0, { waitUntil: "load" }); await p.waitForTimeout(1200);
  const sag = await p.evaluate(() => ({ s: typeof S === "object", f: typeof flush === "function", e: typeof hesapEsitle === "function", u: HESAP.user && HESAP.user.id, g: typeof HESAP_SUB.girisKod === "function", c: !!(ACT.cikis || SUB.cikis), o: typeof OT === "object" }));
  if (!y || y.status() !== 200 || !sag.s || !sag.f || !sag.e || !sag.g || !sag.c) { console.error("TEST GEÇERSİZ: sayfa/işlevler yok " + JSON.stringify(sag)); process.exit(2); }
  return { p, ilk: sag.u, hatalar, sahipVar: sag.o };
}
const sayfa = async (kul, ls) => { const c = await baglam(kul, ls); const s = await sayfaAc(c); return { c, ...s }; };
const bulut = () => ({ A: JSON.stringify(DB.A), B: JSON.stringify(DB.B), C: JSON.stringify(DB.C) });
const cikis = p => p.evaluate(async () => { const f = ACT.cikis || SUB.cikis; await f.call(ACT); });
const giris = (p, kul) => p.evaluate(async kul => { HESAP.eposta = kul.toLowerCase() + "@x.test"; const fd = new FormData(); fd.set("kod", "123456"); await HESAP_SUB.girisKod.call(HESAP_SUB, fd); return HESAP.user && HESAP.user.id; }, kul);
const yerel = p => p.evaluate(() => JSON.stringify({ ans: Object.keys(S.ans), ad: S.profile.name, mist: Object.keys(S.mistakes), sahip: S.sahip, run: RUN ? RUN.id : null, runLS: localStorage.getItem("ake.run") ? JSON.parse(localStorage.getItem("ake.run")).id : null, ls: localStorage.getItem("ake.state"), anahtarlar: Object.keys(localStorage).filter(k => /^ake\.(yuva|sahipsiz)\./.test(k)), modal: UI.modal && UI.modal.title, ek: localStorage.getItem("ake.ek") }));
const yuvaOku = (p, k) => p.evaluate(k => localStorage.getItem(k), k);
const BEKLE = p => p.waitForFunction(() => cloud.state === "cloud" && !cloud.busy && dirty.size === 0, null, { timeout: 8000 }).catch(() => { });
const ilerlemeA = p => p.evaluate(() => {
  S.ans["A-soru-1"] = [3, 1, 0, Date.now(), 1]; S.profile.name = "Ahmet-A-ISMI"; S.mistakes["A-hata-1"] = { ts: Date.now(), learned: false, n: 1 };
  touch("stats", "profile", "mistakes");
  RUN = { id: "run-A", kind: "practice", title: "A-denemesi", mode: "study", qs: [], i: 0, ans: {}, t0: Date.now() }; saveRun();
});
const bPut = h => PUTLAR.filter(x => x.hesap === h && x.kabul).map(x => x.govde).join("\n");   /* yalnız sunucunun KABUL ettiği yazmalar */
const uyumsuzSay = () => PUTLAR.filter(x => !x.kabul).length;
const SIZ_A = /A-soru-1|Ahmet-A-ISMI|A-hata-1/;
const simdi = Date.now();
const anonDurum = (upd = simdi) => ({ v: 1, upd: { stats: upd }, profile: { name: "", alan: "SAY", hedef: "", gunluk: 40, examDate: "2027-06-19", ok: false }, ans: { "ANON-soru-1": [1, 0, 0, upd, 1] }, topic: {}, daily: {}, para: { times: [], c: 0, w: 0 }, exams: [], mistakes: {}, cards: {}, myCards: [], plan: { tasks: [] }, aiQs: [], reports: {}, badges: {}, tr: {}, td: {} });

/* ---- yardımcılar ---- */
const hata = (p, ...r) => p.evaluate(r => { window.__fail = r; try { sessionStorage.setItem("__failkal", JSON.stringify(r)); } catch (e) { } }, r);   /* sessionStorage: hata YENİDEN AÇILAN sayfada da sürer; yalnız hata(p) (boş) çağrısıyla kalkar */
const kalici = p => p.evaluate(() => {
  const g = k => localStorage.getItem(k), j = k => { try { return JSON.parse(g(k)); } catch (e) { return null; } };
  const st = j("ake.state"), run = j("ake.run");
  return { sahip: st && st.sahip, ans: st ? Object.keys(st.ans) : [], ad: st && st.profile && st.profile.name, bayrak: g("ake.sahip"), runId: run && run.id, chat: g("ake.chat") || "", yuvaA: g("ake.yuva.A") || "", yuvaB: g("ake.yuva.B") || "", anahtarlar: Object.keys(localStorage) };
});
const bellek = p => p.evaluate(() => ({ modal: UI.modal ? UI.modal.title : null, engelli: OT.engelli, bekle: OT.bekle, sahip: S.sahip, osahip: OT.sahip, ans: Object.keys(S.ans), runId: RUN && RUN.id, chat: JSON.stringify(UI.chat), col: !!cloud.col }));
const yenidenDene = p => p.evaluate(() => { ACT.sahipYenidenDene.call(ACT); });
const yeniden = async p => { await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1800); await BEKLE(p); };
const KARISIK = /A-soru-1|Ahmet-A-ISMI|A-hata-1|run-A\b|A-sekme-yeni/;

/* A etkin → B ilerlemesi + RUN + sohbet → A'ya dönüş → çıkış: 'ake.yuva.B' (RUN+sohbet içeren) hazır, durum A'nın */
async function hazirB() {
  sifirla(); const { c, p } = await sayfa("A"); await ilerlemeA(p); await p.evaluate(() => flush()); await BEKLE(p);
  await cikis(p); await giris(p, "B"); await BEKLE(p);
  await p.evaluate(() => { S.ans["B-yeni-soru-9"] = [1, 0, 0, Date.now(), 1]; touch("stats"); RUN = { id: "run-B", kind: "practice", title: "B-denemesi", mode: "study", qs: [], i: 0, ans: {}, t0: Date.now() }; saveRun(); UI.chat = [{ role: "user", content: "B-SOHBET-1" }]; localStorage.setItem("ake.chat", JSON.stringify(UI.chat)); });
  await p.evaluate(() => flush()); await BEKLE(p);
  await cikis(p); await giris(p, "A"); await BEKLE(p); await p.waitForTimeout(300); await cikis(p);
  return { c, p };
}
const bTamam = (ad, k, m) => {
  t(ad + " KALICI: sahip B, B'nin cevabı, A'nın verisi YOK", k.sahip === "B" && k.bayrak === "B" && k.ans.includes("B-yeni-soru-9") && !k.ans.includes("A-soru-1"), JSON.stringify([k.sahip, k.bayrak, k.ans]));
  t(ad + " KALICI: ake.run B'nin açık çalışması (run-B), A'nınki değil", k.runId === "run-B", String(k.runId));
  t(ad + " KALICI: sohbet B'nin (B-SOHBET-1), A'nın değil", /B-SOHBET-1/.test(k.chat), k.chat.slice(0, 80));
  t(ad + " KALICI: kaynak yuva (B) silindi, A'nın yuvası (A-soru-1 + run-A) korunuyor", !k.yuvaB && /A-soru-1/.test(k.yuvaA) && /run-A/.test(k.yuvaA), JSON.stringify(k.anahtarlar));
};
async function aDonus(ad, p) {   /* A'ya dönüşte A'nın her şeyi geri gelir, B'ninkiler karışmaz */
  await BEKLE(p); PUTLAR.length = 0; await cikis(p); const id = await giris(p, "A"); await BEKLE(p); await p.waitForTimeout(400);
  const k = await kalici(p);
  t(ad + " normal B→A: A'nın cevabı+RUN geri, B'nin verisi A'ya karışmadı", id === "A" && k.ans.includes("A-soru-1") && !k.ans.includes("B-yeni-soru-9") && k.runId === "run-A" && !/B-SOHBET-1/.test(k.chat), JSON.stringify([k.ans, k.runId]));
  t(ad + " B'nin verisi A'nın hesabına gitmedi", !/B-yeni-soru-9|B-SOHBET-1/.test(bPut("A") + bulut().A), (bPut("A") + bulut().A).slice(0, 150));
}

/* ===== 1) İKİ SEKME ÇAKIŞMASI: A'nın yedek yuvasına yazma BAŞARISIZ → yenileme YOK, ilerleme bellekte, görünür hata; düzelince yeniden dene ===== */
{
  sifirla(); const c = await baglam("A"); const p1 = (await sayfaAc(c)).p;
  await ilerlemeA(p1); await p1.evaluate(() => flush()); await BEKLE(p1);
  await p1.evaluate(() => { S.ans["A-sekme-yeni"] = [1, 0, 0, Date.now(), 1]; touch("stats"); window.__isaret = 1; clearTimeout(saveTimer); });
  await hata(p1, "^ake\\.yuva\\.");
  const p2 = (await sayfaAc(c)).p; PUTLAR.length = 0;
  await cikis(p2); await giris(p2, "B"); await BEKLE(p2); await p1.waitForTimeout(2500);
  const kal = await kalici(p2);
  let m = null, yenilendi = false; try { m = await bellek(p1); yenilendi = (await p1.evaluate(() => window.__isaret)) !== 1; } catch (e) { yenilendi = true; }
  t("1 yedek yazılamadı: sekme 1 OTOMATİK YENİLENMEDİ", !yenilendi);
  t("1a bellekteki kaydedilmemiş ilerleme (A-sekme-yeni) KORUNDU", m && m.ans.includes("A-sekme-yeni"), JSON.stringify(m && m.ans));
  t("1b görünür hata: 'Depolama dolu' penceresi, eşitleme durduruldu (engelli, bulut yok)", m && m.modal === "Depolama dolu" && m.engelli && !m.col && m.bekle === "cakisma", JSON.stringify(m));
  t("1c KALICI: B'nin durumu sekme 1 tarafından ezilmedi (sahip B, A-sekme-yeni yok); A yuvası yazılmadı", kal.sahip === "B" && !/A-sekme-yeni/.test(JSON.stringify(kal.ans)) && !/A-sekme-yeni/.test(kal.yuvaA), JSON.stringify([kal.sahip, kal.ans, kal.yuvaA.length]));
  t("1d B'ye A verisi gitmedi", !SIZ_A.test(bPut("B") + bulut().B) && !/A-sekme-yeni/.test(bulut().B));
  await yenidenDene(p1); await p1.waitForTimeout(600);
  const hala = await p1.evaluate(() => window.__isaret === 1);
  t("1e depolama HÂLÂ bozukken 'Yeniden dene': yenileme yok, hata yine görünür (kalıcı kilit değil)", hala && /Depolama dolu/.test((await bellek(p1)).modal || ""));
  await hata(p1); await yenidenDene(p1);
  await p1.waitForFunction(() => window.__isaret === undefined, null, { timeout: 6000 }).catch(() => { }); await p1.waitForTimeout(1500);
  const k2 = await kalici(p2);
  t("1f depolama düzelince 'Yeniden dene': ilerleme KALICI olarak A yuvasına yazıldı, ardından sayfa yenilendi", /A-sekme-yeni/.test(k2.yuvaA) && (await p1.evaluate(() => window.__isaret)) === undefined, k2.yuvaA.slice(0, 80));
  const y1 = await bellek(p1);
  t("1g yenilenen sekme B oturumunda (A verisi yok)", y1.sahip === "B" && !y1.ans.includes("A-sekme-yeni"), JSON.stringify([y1.sahip, y1.ans]));
  /* yeniden açılış + A'ya dönüş: A-sekme-yeni geri gelir */
  PUTLAR.length = 0; await cikis(p1); await giris(p1, "A"); await BEKLE(p1); await p1.waitForTimeout(400);
  const ya = await bellek(p1);
  t("1h normal B→A: A'nın sekmedeki ilerlemesi (A-sekme-yeni) ve A-soru-1 geri geldi", ya.sahip === "A" && ya.ans.includes("A-sekme-yeni") && ya.ans.includes("A-soru-1"), JSON.stringify(ya.ans));
  await c.close();
}

/* ===== 2) B'nin yuvası geri yüklenirken ake.run yazma BAŞARISIZ: yuva SİLİNMEZ, A'nın RUN'ı B'ye karışmaz; yeniden dene + yenileme ===== */
for (const mod of ["yenidenDene", "yenileme"]) {
  const { c, p } = await hazirB(); const ad = "2/" + mod;
  const yuvaOnce = (await kalici(p)).yuvaB; t(ad + " ön koşul: B'nin yuvası RUN ve sohbetle hazır", /run-B/.test(yuvaOnce) && /B-SOHBET-1/.test(yuvaOnce));
  await hata(p, "^ake\\.run$"); PUTLAR.length = 0; await giris(p, "B"); await p.waitForTimeout(1000);
  let m = await bellek(p), k = await kalici(p);
  t(ad + " ake.run yazılamadı: görünür hata, eşitleme durdu", m.modal === "Depolama dolu" && m.engelli && !m.col && m.bekle === "gecis", JSON.stringify(m));
  t(ad + " KALICI: B'nin yuvası SİLİNMEDİ (RUN+sohbet duruyor)", /run-B/.test(k.yuvaB) && /B-SOHBET-1/.test(k.yuvaB), k.yuvaB.slice(0, 60));
  t(ad + " KALICI: A'nın açık çalışması B'nin sahipliğinde KALMADI (ake.run run-A değil)", k.runId !== "run-A", String(k.runId));
  t(ad + " A'nın verisi B'ye gitmedi", !SIZ_A.test(bPut("B") + bulut().B), bPut("B").slice(0, 100));
  if (mod === "yenidenDene") {
    await yenidenDene(p); await p.waitForTimeout(500);
    t(ad + " depolama bozukken yeniden dene: hata yine görünür, yuva silinmedi", /Depolama dolu/.test((await bellek(p)).modal || "") && /run-B/.test((await kalici(p)).yuvaB));
    await hata(p); await yenidenDene(p); await p.waitForTimeout(800); await BEKLE(p); await p.waitForTimeout(400);
  } else { await hata(p); await yeniden(p); }
  k = await kalici(p); bTamam(ad + " düzelince", k);
  t(ad + " engel kalktı (modal yok, engelli değil)", !(await bellek(p)).engelli);
  /* ayrıca yeniden açılışta aynı durum */
  await yeniden(p); k = await kalici(p); bTamam(ad + " YENİDEN AÇILIŞ", k);
  await aDonus(ad, p); await c.close();
}

/* ===== 3) DİĞER GEÇİŞ YAZIMLARI: ake.state / ake.sahip / ake.chat başarısız → karışma yok, kayıp yok, toparlanma ===== */
for (const [anahtar, re] of [["ake.state", "^ake\\.state$"], ["ake.sahip", "^ake\\.sahip$"], ["ake.chat", "^ake\\.chat$"]]) {
  for (const mod of ["yenidenDene", "yenileme"]) {
    const { c, p } = await hazirB(); const ad = `3/${anahtar}/${mod}`;
    await hata(p, re); PUTLAR.length = 0; await giris(p, "B"); await p.waitForTimeout(1000);
    let m = await bellek(p), k = await kalici(p);
    t(ad + " yazım başarısız: görünür hata, eşitleme durdu", m.modal === "Depolama dolu" && m.engelli && !m.col, JSON.stringify(m));
    t(ad + " KALICI: B yuvası duruyor (silinmedi) ve A'nın yuvası kayıpsız (A-soru-1 + run-A)", /run-B/.test(k.yuvaB) && /A-soru-1/.test(k.yuvaA) && /run-A/.test(k.yuvaA), JSON.stringify(k.anahtarlar));
    t(ad + " KALICI: sahip ile veri AYRIŞMADI (state sahibi = bayrak; ake.run başkasına ait değil)", (k.sahip === k.bayrak || k.sahip === "B") && !(k.sahip === "B" && k.runId === "run-A") && !(k.sahip === "A" && k.runId === "run-B"), JSON.stringify([k.sahip, k.bayrak, k.runId]));
    t(ad + " A'nın verisi B'ye gitmedi", !SIZ_A.test(bPut("B") + bulut().B));
    if (mod === "yenidenDene") { await hata(p); await yenidenDene(p); await p.waitForTimeout(1000); await BEKLE(p); await p.waitForTimeout(500); }
    else { await hata(p); await yeniden(p); }
    k = await kalici(p); const mm = await bellek(p);
    if (k.sahip !== "B" || k.yuvaB) { /* A'ya ait duruma yazılan state başarısızsa geçiş yeniden açılışta/yeniden denemede tamamlanır */ await yeniden(p); k = await kalici(p); }
    bTamam(ad + " düzelince", k);
    await yeniden(p); k = await kalici(p); bTamam(ad + " YENİDEN AÇILIŞ", k);
    await aDonus(ad, p); await c.close();
  }
}

/* ===== 4) YEDEK (önceki sahibin yuvası) yazılamıyor: hiçbir şey ayrılmaz; düzelince yeniden dene geçişi baştan tamamlar ===== */
{
  const { c, p } = await hazirB(); const ad = "4";
  await giris(p, "A"); await BEKLE(p); await p.waitForTimeout(300);   // A etkin (yuva B korunur), sonra B'ye geçişte A yuvası yazılamaz
  await p.evaluate(() => { S.ans["A-yeni-2"] = [1, 0, 0, Date.now(), 1]; touch("stats"); }); await p.evaluate(() => flush()); await BEKLE(p);
  await cikis(p); await hata(p, "^ake\\.yuva\\."); PUTLAR.length = 0; await giris(p, "B"); await p.waitForTimeout(1000);
  let m = await bellek(p), k = await kalici(p);
  t(ad + " A yuvası yazılamadı: hata görünür, A'nın verisi yerinde (sahip A, A-yeni-2), B yuvası silinmedi", m.modal === "Depolama dolu" && m.bekle === "yedek" && k.sahip === "A" && k.ans.includes("A-yeni-2") && /run-B/.test(k.yuvaB), JSON.stringify([m.bekle, k.sahip, k.ans]));
  await hata(p); await yenidenDene(p); await p.waitForTimeout(1000); await BEKLE(p); await p.waitForTimeout(400);
  k = await kalici(p);
  t(ad + " düzelince yeniden dene: geçiş tamamlandı (B), A'nın yeni ilerlemesi A yuvasında, B yuvası kalktı", k.sahip === "B" && /A-yeni-2/.test(k.yuvaA) && !k.yuvaB && k.runId === "run-B", JSON.stringify([k.sahip, k.runId, k.yuvaB.length]));
  t(ad + " B'ye A verisi gitmedi", !/A-yeni-2|A-soru-1/.test(bPut("B") + bulut().B));
  await c.close();
}

/* ===== 5) AÇILIŞTA DEVAM EDEN DEPOLAMA HATASI: görünür hata + Yeniden dene (modal ve başlıkta), sahte 'kayıtlı' etiketi yok; hata sürerken deneme; hata kalkınca düğmeyle toparlanma (yenileme gerekmez) ===== */
for (const [ad, re, ek] of [["ake.run", "^ake\\.run$"], ["ake.chat", "^ake\\.chat$"], ["ake.state", "^ake\\.state$"]]) {
  const { c, p } = await hazirB(); const A5 = "5/" + ad;
  await hata(p, re); await giris(p, "B"); await p.waitForTimeout(800);       // ilk deneme: hata (yuva korunur)
  await yeniden(p);                                                          // YENİDEN AÇILIŞ: hata SÜRÜYOR (sessionStorage)
  let m = await p.evaluate(() => ({ modal: UI.modal ? UI.modal.title : null, acts: UI.modal ? UI.modal.acts.map(a => a.a) : [], engelli: OT.engelli, bekle: OT.bekle, etiket: (document.querySelector("#savest .lbl, .sahip-uyari span") || {}).textContent, btn: !!document.querySelector('.top [data-a="sahipYenidenDene"], .sahip-uyari [data-a="sahipYenidenDene"]'), dom: !!document.querySelector(".modal, [role=dialog], .mdl") || document.body.innerText.includes("Depolama dolu"), fail: window.__fail.length }));
  let k = await kalici(p);
  t(A5 + " açılış (hata sürüyor): ön koşul hata hâlâ etkin", m.fail === 1, JSON.stringify(m));
  t(A5 + " açılış tamamlanınca GÖRÜNÜR hata penceresi ve 'Yeniden dene' eylemi var", m.modal === "Depolama dolu" && m.acts.includes("sahipYenidenDene") && m.dom && m.engelli && m.bekle === "gecis", JSON.stringify(m));
  t(A5 + " sayfada (başlık veya uyarı şeridi) erişilebilir 'Yeniden dene' düğmesi var", m.btn);
  t(A5 + " kayıt etiketi 'kayıtlı' demiyor (kayıt durdu)", /durdu/i.test(m.etiket || "") && !/kayıtlı/i.test(m.etiket || ""), String(m.etiket));
  t(A5 + " KALICI: B yuvası, A yuvası korunuyor (RUN+sohbet+ilerleme)", /run-B/.test(k.yuvaB) && /B-SOHBET-1/.test(k.yuvaB) && /A-soru-1/.test(k.yuvaA), JSON.stringify(k.anahtarlar));
  t(A5 + " KALICI: A'nın RUN'ı B'nin sahipliğinde değil", !(k.sahip === "B" && k.runId === "run-A"), JSON.stringify([k.sahip, k.runId]));
  await p.evaluate(() => { UI.modal = null; location.hash = "#bugun"; render(); });   /* başlıklı sayfa: başlıktaki kayıt etiketi ve düğme */
  const bl = await p.evaluate(() => ({ etiket: (document.querySelector("#savest .lbl") || {}).textContent, btn: !!document.querySelector('.top [data-a="sahipYenidenDene"]') }));
  t(A5 + " başlıklı sayfada: başlık etiketi 'Kayıt durdu' (ASLA 'Bu cihazda kayıtlı') ve başlıkta 'Yeniden dene' düğmesi", /durdu/i.test(bl.etiket || "") && !/kayıtlı/i.test(bl.etiket || "") && bl.btn, JSON.stringify(bl));
  /* hata sürerken yeniden dene (başlıktaki düğmeyle): yine görünür hata, yuva silinmedi, engel kalıcı kilit değil */
  await p.evaluate(() => { UI.modal = null; render(); });
  await p.click('.top [data-a="sahipYenidenDene"], .sahip-uyari [data-a="sahipYenidenDene"]', { timeout: 5000 }); await p.waitForTimeout(500);
  m = await p.evaluate(() => ({ modal: UI.modal ? UI.modal.title : null, engelli: OT.engelli, etiket: (document.querySelector("#savest .lbl, .sahip-uyari span") || {}).textContent }));
  t(A5 + " hata sürerken Yeniden dene: hata yine görünür, kayıt durdu etiketi, başarı izlenimi yok", m.modal === "Depolama dolu" && m.engelli && /durdu/i.test(m.etiket || ""), JSON.stringify(m));
  k = await kalici(p); t(A5 + " hata sürerken deneme sonrası yuvalar ve ilerleme KORUNDU", /run-B/.test(k.yuvaB) && /A-soru-1/.test(k.yuvaA), JSON.stringify(k.anahtarlar));
  /* hata YALNIZ test kaldırınca kalkar → düğmeyle toparlanma, YENİLEME YOK */
  await hata(p); await p.evaluate(() => { window.__isaret5 = 1; });
  await p.evaluate(() => { UI.modal = null; render(); }); await p.click('.top [data-a="sahipYenidenDene"], .sahip-uyari [data-a="sahipYenidenDene"]', { timeout: 5000 }); await p.waitForTimeout(1200); await BEKLE(p); await p.waitForTimeout(400);
  const ayni = await p.evaluate(() => window.__isaret5 === 1);
  m = await p.evaluate(() => ({ modal: UI.modal ? UI.modal.title : null, engelli: OT.engelli, bekle: OT.bekle, etiket: (document.querySelector("#savest .lbl, .sahip-uyari span") || {}).textContent, btn: !!document.querySelector('.top [data-a="sahipYenidenDene"], .sahip-uyari [data-a="sahipYenidenDene"]') }));
  t(A5 + " hata kalkınca düğmeyle toparlandı: sayfa yenilenmedi, engel yok, düğme/hata penceresi kalktı, etiket normal", ayni && !m.engelli && !m.modal && !m.btn && !/durdu/i.test(m.etiket || ""), JSON.stringify(m));
  k = await kalici(p); bTamam(A5 + " toparlanma", k);
  t(A5 + " toparlanma sonrası bulut eşitlemesi çalıştı, A verisi B'ye gitmedi", !SIZ_A.test(bPut("B") + bulut().B), bPut("B").slice(0, 100));
  await yeniden(p); k = await kalici(p); bTamam(A5 + " YENİDEN AÇILIŞ", k);
  await aDonus(A5, p); await c.close();
}

await b.close(); srv.close();
console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
