// B4 · Hesaplar arası ÇALIŞMA VERİSİ karışması koruması — GERÇEK Chromium + yerel sahte API (sentetik veri; Production/Preview/D1'e dokunulmaz).
// Akış uygulamanın kendi yollarıyla yürür: girişli sayfa → ilerleme (touch/flush) → ACT.cikis → HESAP_SUB.girisKod ile giriş → hesapEsitle/flush.
// Sahte sunucu her GET/PUT `veri` isteğini (çerezdeki hesap + x-ake-hesap başlığı + gövde) kaydeder; başlık/oturum uyuşmazlığında gerçek sunucu gibi 409 hesap_uyumsuz döner.
// Çalıştırma: node tests/hesap-veri-karisma-istemci.mjs   (Playwright + chromium gerekir). Kıyas/mutasyon için KAT_HTML=<index.html yolu>
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
  await c.addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__kota && /^ake\.(yuva|sahipsiz)\./.test(k)) throw new DOMException("dolu", "QuotaExceededError"); return o.call(this, k, v); }; });
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

/* ================= 0) SAHİBİ BİLİNMEYEN eski yerel kayıt: KORUNUR, seçim öncesi buluta GİTMEZ, aktarım açık seçimle ================= */
{
  sifirla(); const { c, p } = await sayfa("A", anonDurum()); await BEKLE(p); await p.waitForTimeout(400);
  let y = JSON.parse(await yerel(p));
  t("0 sahibi bilinmeyen eski kayıt seçimden ÖNCE hesaba aktarılmadı (A buluttunda ANON yok, PUT yok)", !/ANON-soru-1/.test(bulut().A) && !/ANON-soru-1/.test(bPut("A")), bulut().A.slice(0, 200));
  const slot = y.anahtarlar.find(k => k.startsWith("ake.sahipsiz.")), slotMetin = slot ? await yuvaOku(p, slot) : "";
  t("0a eski kayıt 'ake.sahipsiz.*' yuvasına GERİ ALINABİLİR biçimde kopyalandı (silinmedi)", !!slot && /ANON-soru-1/.test(slotMetin), JSON.stringify(y.anahtarlar));
  t("0b yerel durumun sahibi A oldu ve aktarım için açık kullanıcı sorusu gösterildi", y.sahip === "A" && /eski ilerleme/i.test(y.modal || ""), JSON.stringify([y.sahip, y.modal]));
  await p.evaluate(() => { (ACT.sahipsizSonra).call(ACT); }); await p.waitForTimeout(300); y = JSON.parse(await yerel(p));
  t("0c 'Şimdi değil': kayıt cihazda durur, hâlâ buluta gitmedi", y.anahtarlar.some(k => k.startsWith("ake.sahipsiz.")) && !/ANON-soru-1/.test(bulut().A + bPut("A")));
  await p.evaluate(() => { UI.sahipsizSordu = false; return ACT.sahipsizAktar.call(ACT); }); await BEKLE(p); await p.waitForTimeout(400); y = JSON.parse(await yerel(p));
  t("0d açık seçim ('Hesabıma aktar'): ilerleme A'nın hesabına yazıldı ve yuva kaldırıldı", /ANON-soru-1/.test(bulut().A) && y.ans.includes("ANON-soru-1") && !y.anahtarlar.some(k => k.startsWith("ake.sahipsiz.")), JSON.stringify([bulut().A.slice(0, 150), y.ans, y.anahtarlar]));
  await c.close();
}
{
  sifirla(); const { c, p } = await sayfa("A"); await BEKLE(p); const y = JSON.parse(await yerel(p));
  t("0e KORUNAN: boş yerel durum ilk girişte sessizce benimsenir (soru yok, yuva yok)", y.sahip === "A" && !y.modal && y.anahtarlar.length === 0, JSON.stringify([y.sahip, y.modal, y.anahtarlar]));
  await c.close();
}
{
  sifirla(); DB.A.stats = { _u: simdi + 100000, ans: { "A-bulut-soru-1": [1, 0, 0, simdi, 1] }, topic: {}, daily: {}, para: { times: [], c: 0, w: 0 }, badges: {}, tr: {}, td: {} };
  const { c, p } = await sayfa("A", anonDurum(simdi)); await BEKLE(p); await p.waitForTimeout(300); const y = JSON.parse(await yerel(p));
  t("0f hesap kaydı eski kayıttan yeni (aktarılacak bir şey yok): soru çıkmaz, PUT yok, eski kayıt yine de yuvada saklı", !/eski ilerleme/i.test(y.modal || "") && !/ANON-soru-1/.test(bPut("A")) && y.anahtarlar.some(k => k.startsWith("ake.sahipsiz.")), JSON.stringify([y.modal, y.anahtarlar]));
  await c.close();
}

/* ================= 1-4) A → B → A (A'nın damgası B'nin bulut kaydından YENİ) ================= */
{
  sifirla(); const { c, p, ilk } = await sayfa("A"); t("1 sayfa A oturumuyla açıldı", ilk === "A", ilk);
  await p.evaluate(() => localStorage.setItem("ake.ek", JSON.stringify([{ id: "ek-1" }])));
  await ilerlemeA(p); await p.evaluate(() => flush()); await BEKLE(p);
  t("1a A'nın ilerlemesi A'nın hesabına yazıldı", /A-soru-1/.test(bulut().A) && /Ahmet-A-ISMI/.test(bulut().A), bulut().A.slice(0, 200));
  const aUpd = await p.evaluate(() => S.upd.stats); t("1b ön koşul: A'nın yerel damgası B'nin bulut kaydından YENİ", aUpd > ESKI, aUpd);
  PUTLAR.length = 0; await cikis(p); const sonra = await p.evaluate(() => ({ u: HESAP.user, ls: localStorage.getItem("ake.state") }));
  t("1c çıkışta yerel ilerleme cihazda KORUNDU, HESAP.user boş", sonra.u === null && /A-soru-1/.test(sonra.ls || ""));
  const bid = await giris(p, "B"); t("1d B, uygulamanın giriş akışıyla girdi", bid === "B", bid);
  await BEKLE(p); await p.waitForTimeout(400);
  const bp = PUTLAR.filter(x => x.hesap === "B");
  t("2 B'ye giden PUT isteklerinde A'nın ilerlemesi YOK", !SIZ_A.test(bPut("B")), "B'ye giden: " + bp.map(x => x.alan + ":" + x.govde.slice(0, 100)).join(" | "));
  t("2c normal geçişte hiçbir PUT yanlış hesap başlığıyla gönderilmedi (sunucu reddi gerekmedi)", uyumsuzSay() === 0, JSON.stringify(PUTLAR.filter(x => !x.kabul).map(x => x.baslik + ">" + x.hesap)));
  t("2a B'nin bulut kaydında A'nın verisi YOK", !SIZ_A.test(bulut().B), bulut().B.slice(0, 200));
  t("2b B'nin kendi bulut verisi EZİLMEDİ (B-bulut-soru-1, Bora-B-ISMI)", /B-bulut-soru-1/.test(bulut().B) && /Bora-B-ISMI/.test(bulut().B), bulut().B.slice(0, 200));
  const y = JSON.parse(await yerel(p));
  t("3 B oturumunda yerel durum B'nin verisi (Bora-B-ISMI, A'nın cevabı yok), sahip B", y.ad === "Bora-B-ISMI" && !y.ans.includes("A-soru-1") && y.sahip === "B", JSON.stringify({ ad: y.ad, ans: y.ans, sahip: y.sahip }));
  t("3a B oturumunda A'nın hata defteri kaydı yok", !y.mist.includes("A-hata-1"), JSON.stringify(y.mist));
  t("3b B oturumunda A'nın açık çalışması (RUN / ake.run) yok", y.run === null && y.runLS === null, JSON.stringify([y.run, y.runLS]));
  t("3c B'nin kendi bulut verisi B oturumunda görünüyor", y.ans.includes("B-bulut-soru-1"), JSON.stringify(y.ans));
  t("3d A'nın ilerlemesi + RUN'ı 'ake.yuva.A' yuvasında KORUNDU", y.anahtarlar.includes("ake.yuva.A") && /A-soru-1/.test(await yuvaOku(p, "ake.yuva.A")) && /run-A/.test(await yuvaOku(p, "ake.yuva.A")), JSON.stringify(y.anahtarlar));
  t("3e ortak soru önbelleği 'ake.ek' (EKQ) hesap değişiminde olduğu gibi kaldı (hesap verisi değil)", y.ek === JSON.stringify([{ id: "ek-1" }]), y.ek);
  /* B kendi ilerlemesini yapar → çıkış → A'ya DÖNÜŞ */
  await p.evaluate(() => { S.ans["B-yeni-soru-9"] = [1, 0, 0, Date.now(), 1]; touch("stats"); }); await p.evaluate(() => flush()); await BEKLE(p);
  PUTLAR.length = 0; await cikis(p);
  const aid = await giris(p, "A"); await BEKLE(p); await p.waitForTimeout(400);
  const ya = JSON.parse(await yerel(p));
  t("4 A'ya dönüş girişi yapıldı", aid === "A", aid);
  t("4a A'ya dönüşte A'nın ilerlemesi geri yüklendi (cevap, ad, hata defteri, RUN)", ya.ans.includes("A-soru-1") && ya.ad === "Ahmet-A-ISMI" && ya.mist.includes("A-hata-1") && ya.run === "run-A", JSON.stringify({ ans: ya.ans, ad: ya.ad, mist: ya.mist, run: ya.run }));
  t("4b B'nin ilerlemesi A'nın hesabına KARIŞMADI", !/B-yeni-soru-9|B-bulut-soru-1/.test(bPut("A") + bulut().A), (bPut("A") + bulut().A).slice(0, 200));
  t("4c A oturumunda B'nin cevapları yok", !ya.ans.includes("B-yeni-soru-9") && !ya.ans.includes("B-bulut-soru-1"), JSON.stringify(ya.ans));
  await c.close();
}

/* ================= 5) ÜÇ HESAP A → B → C → A; A'nın buluta ULAŞMAMIŞ ilerlemesi geri gelir ================= */
{
  sifirla(); D.putHata.A = 503; const { c, p } = await sayfa("A");
  await ilerlemeA(p); await p.evaluate(() => flush()); await p.waitForTimeout(600);
  t("5 ön koşul: A'nın ilerlemesi buluta ULAŞMADI (sunucu 503)", !SIZ_A.test(bulut().A), bulut().A.slice(0, 120));
  await cikis(p); PUTLAR.length = 0; await giris(p, "B"); await BEKLE(p);
  t("5a B'ye geçişte A'nın kaydedilmemiş ilerlemesi B'ye gitmedi", !SIZ_A.test(bPut("B") + bulut().B));
  await p.waitForTimeout(9000);   // A'nın 8 sn'lik yeniden deneme zamanlayıcısı varsa B oturumunda tetiklenirdi
  t("5b eski yeniden deneme zamanlayıcısı B oturumunda A verisi göndermedi (9 sn bekleme)", !SIZ_A.test(PUTLAR.map(x => x.govde).join("\n")) && PUTLAR.every(x => x.hesap !== "A"), JSON.stringify(PUTLAR.map(x => x.hesap + ":" + x.alan)));
  await cikis(p); await giris(p, "C"); await BEKLE(p);
  await p.evaluate(() => { S.ans["C-soru-1"] = [1, 0, 0, Date.now(), 1]; touch("stats"); }); await p.evaluate(() => flush()); await BEKLE(p);
  let y = JSON.parse(await yerel(p));
  t("5c C oturumu: yalnız C'nin verisi; A ve B yuvaları saklı", y.sahip === "C" && y.ans.includes("C-soru-1") && !y.ans.includes("A-soru-1") && !y.ans.includes("B-bulut-soru-1") && y.anahtarlar.includes("ake.yuva.A") && y.anahtarlar.includes("ake.yuva.B"), JSON.stringify(y));
  t("5d C'nin bulutunda yalnız C verisi", /C-soru-1/.test(bulut().C) && !/A-soru-1|B-bulut-soru-1/.test(bulut().C), bulut().C.slice(0, 160));
  D.putHata = {}; PUTLAR.length = 0; await cikis(p); await giris(p, "A"); await BEKLE(p); await p.waitForTimeout(300); y = JSON.parse(await yerel(p));
  t("5e A'ya dönüş: buluta ulaşmamış ilerleme (A-soru-1, ad, hata, RUN) yerelden geri geldi", y.ans.includes("A-soru-1") && y.ad === "Ahmet-A-ISMI" && y.mist.includes("A-hata-1") && y.run === "run-A" && !y.ans.includes("C-soru-1"), JSON.stringify(y));
  t("5f geri gelen ilerleme YALNIZ A'nın hesabına yüklendi", /A-soru-1/.test(bulut().A) && !/C-soru-1|B-bulut-soru-1/.test(bulut().A) && !/A-soru-1/.test(bulut().B + bulut().C), bulut().A.slice(0, 120));
  await cikis(p); await giris(p, "B"); await BEKLE(p); y = JSON.parse(await yerel(p));
  t("5g B'ye dönüş: B'nin verisi geri geldi, A/C verisi yok", y.sahip === "B" && y.ad === "Bora-B-ISMI" && y.ans.includes("B-bulut-soru-1") && !y.ans.includes("A-soru-1") && !y.ans.includes("C-soru-1"), JSON.stringify(y));
  await c.close();
}

/* ================= 6) BEKLEYEN GET: çıkış + B girişinden SONRA gelen A yanıtı B'nin durumunu değiştiremez ================= */
{
  sifirla(); DB.A.stats = { _u: simdi + 5000, ans: { "A-bulut-GEC": [1, 0, 0, simdi, 1] }, topic: {}, daily: {}, para: { times: [], c: 0, w: 0 }, badges: {}, tr: {}, td: {} };
  D.tutGet.A = kapi(); const c = await baglam("A"), p0 = await c.newPage(); await p0.goto(URL0, { waitUntil: "load" }); await p0.waitForTimeout(1200);
  const durum0 = await p0.evaluate(() => ({ u: HESAP.user && HESAP.user.id, st: cloud.state })); t("6 ön koşul: A'nın GET isteği sunucuda BEKLİYOR (cloud.state loading)", durum0.u === "A" && durum0.st === "loading", JSON.stringify(durum0));
  await cikis(p0); await giris(p0, "B"); await BEKLE(p0);
  D.tutGet.A.ac(); await p0.waitForTimeout(800);
  const y = JSON.parse(await yerel(p0)), st = await p0.evaluate(() => ({ st: cloud.state, u: HESAP.user && HESAP.user.id, busy: cloud.busy, dirty: dirty.size }));
  t("6a geç gelen A GET yanıtı B'nin yerel durumunu DEĞİŞTİRMEDİ (A-bulut-GEC yok, sahip B, profil Bora)", !y.ans.includes("A-bulut-GEC") && y.sahip === "B" && y.ad === "Bora-B-ISMI", JSON.stringify(y));
  t("6b eşitleme durumu B'ye ait kaldı (cloud, B oturumu)", st.st === "cloud" && st.u === "B", JSON.stringify(st));
  await c.close();
}

/* ================= 7) BEKLEYEN PUT: A'nın uçuştaki kaydı B girişinden sonra 401 ile dönse bile B'nin kimliği/kuyruğu/durumu bozulmaz ================= */
{
  sifirla(); const { c, p } = await sayfa("A"); await BEKLE(p);
  const k = kapi(); D.tutPut.A = k; D.putDurum.A = 401;
  await ilerlemeA(p); await p.evaluate(() => { window.__fl = flush(); }); await p.waitForTimeout(400);
  t("7 ön koşul: A'nın PUT'u sunucuda BEKLİYOR", PUTLAR.some(x => x.hesap === "A"), JSON.stringify(PUTLAR.map(x => x.hesap + ":" + x.alan)));
  await cikis(p); await giris(p, "B"); await BEKLE(p);
  await p.evaluate(() => { S.ans["B-yeni-soru-7"] = [1, 0, 0, Date.now(), 1]; touch("stats"); }); await p.evaluate(() => flush()); await BEKLE(p);
  const st0 = await p.evaluate(() => ({ u: HESAP.user && HESAP.user.id, st: cloud.state, busy: cloud.busy, dirty: dirty.size }));
  t("7a A'nın kaydı hâlâ beklerken B'nin kaydı başarıyla yazıldı (B-yeni-soru-7 B bulutunda), kuyruk boş, kayıt meşgul değil", /B-yeni-soru-7/.test(bulut().B) && st0.u === "B" && st0.st === "cloud" && !st0.busy && st0.dirty === 0, JSON.stringify([st0, bulut().B.slice(0, 120)]));
  k.ac(); await p.waitForTimeout(900);   // gecikmiş eski A PUT'u şimdi 401 ile dönüyor
  const st = await p.evaluate(() => ({ u: HESAP.user && HESAP.user.id, st: cloud.state, col: !!cloud.col, busy: cloud.busy, dirty: dirty.size, sahip: S.sahip }));
  t("7b gecikmiş eski nesil 401'i B'yi çıkışa ZORLAMADI; kayıt durumu/kuyruğu B'de bozulmadı", st.u === "B" && st.st === "cloud" && st.col === true && !st.busy && st.dirty === 0 && st.sahip === "B", JSON.stringify(st));
  t("7c B'nin bulutunda A verisi yok", !SIZ_A.test(bulut().B));
  await c.close();
}

/* ================= 7d) uçuştaki ÇOK ALANLI kayıt turu: ilk PUT B girişinden sonra BAŞARIYLA dönse bile eski tur kalan alanları YENİ hesaba yazmaya devam etmez ================= */
{
  sifirla(); const { c, p } = await sayfa("A"); await BEKLE(p);
  const k = kapi(); D.tutPut.A = k;   // ilk PUT tutulur, 200 ile dönecek
  await ilerlemeA(p); await p.evaluate(() => { window.__fl = flush(); }); await p.waitForTimeout(400);
  await cikis(p); await giris(p, "B"); await BEKLE(p); PUTLAR.length = 0;
  k.ac(); await p.waitForTimeout(1200);
  t("7d eski turun kalan alanları yeni hesaba (B) gönderilmedi (B için hiç PUT yok)", PUTLAR.filter(x => x.hesap === "B").length === 0, JSON.stringify(PUTLAR.map(x => x.hesap + ":" + x.alan + ":" + x.baslik)));
  await c.close();
}

/* ================= 9f) storage olayı ULAŞMAZSA bile saveLocal sahip bayrağını denetler: eski sekme yeni sahibin ake.state'ini EZMEZ ================= */
{
  sifirla(); const c = await baglam("A"); const s1 = await sayfaAc(c), p1 = s1.p;
  await ilerlemeA(p1); await p1.evaluate(() => flush()); await BEKLE(p1);
  await p1.evaluate(() => { clearTimeout(saveTimer); cloud.writable = false; window.sahipCakisma = function () { window.__cak = (window.__cak || 0) + 1; }; S.ans["A-olaysiz"] = [1, 0, 0, Date.now(), 1]; });
  const s2 = await sayfaAc(c), p2 = s2.p; await cikis(p2); await giris(p2, "B"); await BEKLE(p2);
  const durum1 = await p1.evaluate(() => ({ cak: OT.cakisti, sahip: OT.sahip })); await p1.evaluate(() => { window.__cak = 0; saveLocal(); }); await p1.waitForTimeout(300); const cakSay = await p1.evaluate(() => window.__cak);
  const y2 = JSON.parse(await yerel(p2));
  t("9f ön koşul: eski sekmenin çakışma işleyicisi etkisiz (hâlâ A, çakışma işaretlenmedi); yalnız saveLocal denetimi korur", durum1.sahip === "A" && durum1.cak === false, JSON.stringify(durum1));
  t("9f eski sekmenin saveLocal'ı sahip bayrağı uyuşmazlığını yakaladı ve B'nin ake.state'ini EZMEDİ (sahip B, A-olaysiz yok)", y2.sahip === "B" && !/A-olaysiz/.test(y2.ls || "") && cakSay >= 1, JSON.stringify([y2.sahip, cakSay]));
  await c.close();
}

/* ================= 8) DEPOLAMA HATASI: yuva yazılamazsa mevcut veri korunur, B'ye hiçbir şey gitmez, görünür hata ================= */
{
  sifirla(); const { c, p } = await sayfa("A"); await ilerlemeA(p); await p.evaluate(() => flush()); await BEKLE(p);
  const bOnce = bulut().B; PUTLAR.length = 0;
  await p.evaluate(() => { window.__kota = true; }); await cikis(p); await giris(p, "B"); await p.waitForTimeout(800);
  const y = JSON.parse(await yerel(p));
  t("8 depolama dolu: görünür hata (modal 'Depolama dolu')", /Depolama dolu/.test(y.modal || ""), y.modal);
  t("8a A'nın yerel kaydı KORUNDU (A-soru-1, sahip A)", y.ans.includes("A-soru-1") && y.sahip === "A" && /A-soru-1/.test(y.ls || ""), JSON.stringify([y.ans, y.sahip]));
  t("8b B'ye hiçbir PUT gitmedi, B'nin bulutu aynı kaldı", PUTLAR.filter(x => x.hesap === "B").length === 0 && bulut().B === bOnce, JSON.stringify(PUTLAR.map(x => x.hesap)));
  await p.evaluate(() => { window.__kota = false; }); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500); await BEKLE(p);
  const z = JSON.parse(await yerel(p));
  t("8c depolama düzelince yenilemede geçiş tamamlandı: B'nin verisi yüklü, A yuvada", z.sahip === "B" && z.ad === "Bora-B-ISMI" && z.anahtarlar.includes("ake.yuva.A") && /A-soru-1/.test(await yuvaOku(p, "ake.yuva.A")), JSON.stringify(z));
  await c.close();
}

/* ================= 9) İKİ SEKME: ortak çerez/depolama değişimi ================= */
{
  sifirla(); const c = await baglam("A"); const s1 = await sayfaAc(c); const p1 = s1.p;
  await ilerlemeA(p1); await p1.evaluate(() => flush()); await BEKLE(p1);
  await p1.evaluate(() => { S.ans["A-sekme-yeni"] = [1, 0, 0, Date.now(), 1]; touch("stats"); });   // kaydedilmemiş (yalnız bellekte)
  const s2 = await sayfaAc(c); const p2 = s2.p; PUTLAR.length = 0;
  await cikis(p2); await giris(p2, "B"); await BEKLE(p2); await p1.waitForTimeout(2500);   // p1: storage olayı → yuva + yenileme
  const bellek = await yerel(p2), y2 = JSON.parse(bellek), y1 = JSON.parse(await yerel(p1));
  t("9 sekme 1'in kaydedilmemiş ilerlemesi A yuvasına KORUNDU", /A-sekme-yeni/.test(await yuvaOku(p2, "ake.yuva.A")), (await yuvaOku(p2, "ake.yuva.A") || "").slice(0, 100));
  t("9a B'nin yerel durumu (ake.state) sekme 1 tarafından EZİLMEDİ (sahip B, A-sekme-yeni yok)", y2.sahip === "B" && !/A-sekme-yeni/.test(y2.ls || ""), JSON.stringify([y2.sahip]));
  t("9b sekme 1 yenilendi ve B'nin durumuna geçti", y1.sahip === "B" && !y1.ans.includes("A-sekme-yeni"), JSON.stringify([y1.sahip, y1.ans]));
  t("9c B'ye A verisi KABUL edilmedi (sekme 1'in gecikmiş A başlıklı yazması sunucuda reddedildi ya da hiç gitmedi)", !SIZ_A.test(bPut("B") + bulut().B) && !/A-sekme-yeni/.test(bulut().B), "PUT B: " + PUTLAR.filter(x => x.hesap === "B").map(x => x.alan + ":" + x.govde.slice(0, 160)).join(" | ") + " || bulutB: " + bulut().B.slice(0, 200));
  await c.close();
}
{
  /* 9d: çerez arka planda değişti (storage olayı YOK): başlık/oturum uyuşmazlığı sunucuda 409 ile reddedilir, yazma olmaz */
  sifirla(); const c = await baglam("A"); const { p } = await sayfaAc(c); await ilerlemeA(p); await p.evaluate(() => flush()); await BEKLE(p);
  await p.evaluate(() => { S.ans["A-arka-plan"] = [1, 0, 0, Date.now(), 1]; touch("stats"); });
  await c.addCookies([{ name: "oturum", value: "B", url: URL0 }]); PUTLAR.length = 0; const bOnce = bulut().B;
  await p.evaluate(() => flush()); await p.waitForTimeout(2500); await BEKLE(p);
  const bp = PUTLAR.filter(x => x.hesap === "B");
  t("9d çerez B'ye döndü: A başlıklı PUT sunucuda REDDEDİLDİ (B bulutu değişmedi)", bp.length >= 1 && bp.every(x => x.baslik === "A") && bulut().B === bOnce, JSON.stringify(bp.map(x => x.baslik)));
  const y = JSON.parse(await yerel(p));
  t("9e yenilemeden sonra B oturumu: sahip B, A'nın bekleyen ilerlemesi yuvada", y.sahip === "B" && y.ad === "Bora-B-ISMI" && /A-arka-plan/.test(await yuvaOku(p, "ake.yuva.A") || ""), JSON.stringify([y.sahip, y.ad]));
  await c.close();
}

/* ================= 10) mevcut 409 "eski" yeniden deneme davranışı korunur ================= */
{
  sifirla(); const { c, p } = await sayfa("A"); await BEKLE(p); const once = D.getSay; D.eski409 = "A:stats";
  await p.evaluate(() => { S.ans["A-eski-409"] = [1, 0, 0, Date.now(), 1]; touch("stats"); flush(); }); await p.waitForTimeout(3200);
  t("10 sunucu 409 'eski' dönünce istemci yeniden eşitleme (GET) yaptı, yeniden yükleme/çakışma yok", D.getSay > once && (await p.evaluate(() => OT.cakisti)) === false, JSON.stringify([D.getSay, once]));
  await c.close();
}

await b.close(); srv.close();
console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
