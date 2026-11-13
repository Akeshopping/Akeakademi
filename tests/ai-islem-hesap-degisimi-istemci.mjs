// B4 · uçuştaki AI işlemleri (planAI / sendChat) hesap değişiminden SONRA yeni hesabı etkilemez — GERÇEK Chromium + yerel sahte API (sentetik veri; Production/Preview/D1 yok).
// AI.fn / AI.fn.json sayfada kapıyla tutulan sahte işlevlerle değiştirilir (ağ yok); hesap geçişi uygulamanın kendi çıkış/giriş akışıyla yapılır.
// Çalıştırma: node tests/ai-islem-hesap-degisimi-istemci.mjs   Mutasyon için KAT_HTML=<index.html yolu>
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


/* ---- AI yardımcıları: AI.fn / AI.fn.json kapıyla tutulan sahte işlevler (ağ yok) ---- */
const kur = (p, tag) => p.evaluate(tag => {
  WEBAI.plan = "premium"; AI.off = false; window.__g = window.__g || {}; const g = window.__g[tag] = {};
  const mk = ad => (x, opts) => new Promise((res, rej) => { g[ad] = { x, opts, res, rej }; });   /* iptal sinyali BİLEREK yok sayılır: en kötü durum = yanıt yine de gelir */
  AI.fn = mk("chat"); AI.fn.json = mk("plan");
}, tag);
const baslat = (p, tur, metin) => p.evaluate(([tur, metin]) => { window.__op = tur === "plan" ? planAI() : sendChat(metin); }, [tur, metin || ""]);
const vardi = (p, tag, ad) => p.waitForFunction(([tag, ad]) => !!(window.__g[tag] && window.__g[tag][ad]), [tag, ad], { timeout: 4000 }).then(() => true, () => false);
const ac = (p, tag, ad, yol, v) => p.evaluate(([tag, ad, yol, v]) => { window.__g[tag][ad][yol](v); }, [tag, ad, yol, v]);
const bitir = p => p.evaluate(() => window.__op);
const dur = p => p.evaluate(() => ({ plan: JSON.stringify(S.plan), chat: JSON.stringify(UI.chat), lsChat: localStorage.getItem("ake.chat") || "", lsState: localStorage.getItem("ake.state") || "", planBusy: UI.planBusy, chatBusy: UI.chatBusy, planErr: UI.planErr || "", toast: UI.toast || "", dirtyPlan: dirty.has("plan"), ctlBos: chatCtl === null, sahip: S.sahip, uid: HESAP.user && HESAP.user.id }));
const PLAN_A = [{ day: 0, text: "A-PLAN-ISARET-1", s: "mat", min: 30 }, { day: 1, text: "A-PLAN-ISARET-2", s: "", min: 20 }];
const PLAN_B = [{ day: 2, text: "B-PLAN-ISARET-9", s: "mat", min: 25 }];
const ISARET_A = /A-PLAN-ISARET|A-SOHBET|A-YANIT|A-AKIS|A-HATA-METNI/;
const bekleBulut = async p => { await p.evaluate(() => flush()); await BEKLE(p); await p.waitForTimeout(300); };

/* A'da işlem başlar → (çıkış, B girişi [, B çıkışı, A dönüşü]) → A'nın gecikmiş sonucu gelir */
async function gecis(ad, { tur, sonuc, donus }) {
  sifirla(); const { c, p, hatalar } = await sayfa("A"); await BEKLE(p);
  await kur(p, "A"); await baslat(p, tur, "A-SOHBET-SORU"); const ok = await vardi(p, "A", tur === "plan" ? "plan" : "chat");
  t(ad + " ön koşul: işlem A'da başladı ve sonucu bekliyor", ok);
  await cikis(p); const bid = await giris(p, "B"); await BEKLE(p); await p.waitForTimeout(300);
  if (donus) { await cikis(p); await giris(p, "A"); await BEKLE(p); await p.waitForTimeout(300); }
  const hedef = donus ? "A" : "B"; await p.evaluate(() => { UI.toast = null; });
  const once = await dur(p); PUTLAR.length = 0;
  t(ad + " ön koşul: yeni oturum " + hedef + " ve eski işlemin meşgul bayrakları yeni oturuma taşınmadı", once.uid === hedef && !once.planBusy && !once.chatBusy, JSON.stringify([once.uid, once.planBusy, once.chatBusy]));
  const slot = tur === "plan" ? "plan" : "chat";
  if (sonuc === "basari") await ac(p, "A", slot, "res", tur === "plan" ? PLAN_A : { text: "A-YANIT-METNI" });
  else if (sonuc === "hata") await ac(p, "A", slot, "rej", { code: "rate_limited" });
  else await ac(p, "A", slot, "rej", { code: "rate_limited", text: "A-HATA-METNI" });
  await bitir(p); await p.waitForTimeout(400); await bekleBulut(p);
  const sonra = await dur(p);
  t(ad + " yeni hesabın S.plan'ı değişmedi (A'nın görevi yok)", sonra.plan === once.plan && !ISARET_A.test(sonra.plan), sonra.plan.slice(0, 160));
  t(ad + " yeni hesabın UI.chat ve ake.chat kaydı değişmedi", sonra.chat === once.chat && sonra.lsChat === once.lsChat && !/A-YANIT|A-HATA-METNI/.test(sonra.chat + sonra.lsChat), (sonra.chat + "|" + sonra.lsChat).slice(0, 200));
  t(ad + " yerel durumda (ake.state) A'nın plan işareti yok ve 'plan' kirli değil", !/A-PLAN-ISARET/.test(sonra.lsState) && !sonra.dirtyPlan, String(sonra.dirtyPlan));
  t(ad + " ekran: toast/planErr değişmedi, meşgul bayrakları yeni oturumda kapalı", sonra.toast === "" && sonra.planErr === once.planErr && !sonra.planBusy && !sonra.chatBusy, JSON.stringify([sonra.toast, sonra.planErr, sonra.planBusy, sonra.chatBusy]));
  const gonderilen = bPut(hedef) + "\n" + bulut()[hedef];
  t(ad + " kabul edilen PUT gövdelerinde ve bulutta A'nın planı/yanıtı YOK", !ISARET_A.test(gonderilen), gonderilen.slice(0, 200));
  t(ad + " hiçbir PUT yanlış hesap başlığıyla gitmedi", uyumsuzSay() === 0, String(uyumsuzSay()));
  t(ad + " sayfada yakalanmamış hata yok", hatalar.length === 0, hatalar.join("|"));
  await c.close();
}
for (const tur of ["plan", "chat"]) for (const sonuc of ["basari", "hata", "hata-metinli"]) {
  if (tur === "plan" && sonuc === "hata-metinli") continue;
  await gecis(`${tur}/${sonuc} A→B`, { tur, sonuc, donus: false });
  await gecis(`${tur}/${sonuc} A→B→A`, { tur, sonuc, donus: true });
}

/* ---- B'nin KENDİ devam eden işlemi, A'nın geç gelen sonuçlarından etkilenmez; akış callback'i B ekranına yazmaz ---- */
for (const tur of ["plan", "chat"]) {
  sifirla(); const { c, p } = await sayfa("A"); await BEKLE(p);
  await kur(p, "A"); await baslat(p, tur, "A-SOHBET-SORU"); await vardi(p, "A", tur === "plan" ? "plan" : "chat"); await p.evaluate(() => { window.__opA = window.__op; });
  await cikis(p); await giris(p, "B"); await BEKLE(p); await p.waitForTimeout(300);
  await kur(p, "B"); await baslat(p, tur, "B-SOHBET-SORU"); const bvar = await vardi(p, "B", tur === "plan" ? "plan" : "chat");
  t(`B ${tur}: B kendi işlemini başlatabildi (eski işlemin meşgul bayrağı engellemedi)`, bvar);
  PUTLAR.length = 0;
  await p.evaluate(() => { const d = document.createElement("div"); d.id = "chat-live"; d.textContent = "B-CANLI"; document.body.appendChild(d); });
  if (tur === "chat") { await p.evaluate(() => window.__g.A.chat.opts.onText({ text: "A-AKIS-PARCASI" })); const k = await p.evaluate(() => document.getElementById("chat-live").innerHTML); t("B chat: A'nın akış callback'i B'nin canlı alanına yazmadı", k === "B-CANLI", k); }
  await ac(p, "A", tur === "plan" ? "plan" : "chat", "res", tur === "plan" ? PLAN_A : { text: "A-YANIT-METNI" }); await p.evaluate(() => window.__opA); await p.waitForTimeout(300);
  const ara = await dur(p);
  t(`B ${tur}: A'nın sonucu geldi → B'nin devam eden işlemi sürüyor (meşgul bayrağı açık) ve B verisi temiz`, (tur === "plan" ? ara.planBusy : ara.chatBusy) && !ISARET_A.test(ara.plan + ara.chat + ara.lsChat), JSON.stringify([ara.planBusy, ara.chatBusy]));
  await ac(p, "B", tur === "plan" ? "plan" : "chat", "res", tur === "plan" ? PLAN_B : { text: "B-YANIT-METNI" }); await bitir(p); await p.waitForTimeout(300); await bekleBulut(p);
  const son = await dur(p), bg = bPut("B") + "\n" + bulut().B;
  if (tur === "plan") t("B plan: B'nin kendi planı uygulandı ve B'ye yazıldı; A'nın planı yok", /B-PLAN-ISARET-9/.test(son.plan) && /B-PLAN-ISARET-9/.test(bg) && !ISARET_A.test(son.plan + bg) && !son.planBusy, son.plan.slice(0, 160));
  else t("B chat: B'nin yanıtı B'nin sohbetine ve ake.chat'e yazıldı; A'nın yanıtı yok", /B-YANIT-METNI/.test(son.chat) && /B-YANIT-METNI/.test(son.lsChat) && !/A-YANIT|A-SOHBET/.test(son.chat + son.lsChat) && !son.chatBusy, (son.chat + "|" + son.lsChat).slice(0, 200));
  await c.close();
}

/* ---- Aynı hesapta normal tamamlanma (koruma meşru işlemi engellemez) ---- */
{
  sifirla(); const { c, p } = await sayfa("A"); await BEKLE(p); await kur(p, "A"); PUTLAR.length = 0;
  await baslat(p, "plan"); await vardi(p, "A", "plan"); await ac(p, "A", "plan", "res", PLAN_A); await bitir(p); await bekleBulut(p);
  let d = await dur(p);
  t("N1 aynı hesap, plan başarısı: görevler uygulandı, toast, meşgul kapalı, A'ya yazıldı", /A-PLAN-ISARET-1/.test(d.plan) && /planın hazır/i.test(d.toast) && !d.planBusy && /A-PLAN-ISARET-1/.test(bPut("A")), JSON.stringify([d.plan.slice(0, 80), d.toast, d.planBusy]));
  await baslat(p, "plan"); await vardi(p, "A", "plan"); await ac(p, "A", "plan", "rej", { code: "rate_limited" }); await bitir(p); d = await dur(p);
  t("N2 aynı hesap, plan hatası: planErr gösterilir, meşgul kapalı", d.planErr.length > 0 && !d.planBusy, d.planErr);
  await baslat(p, "chat", "A-SOHBET-SORU"); await vardi(p, "A", "chat"); await ac(p, "A", "chat", "res", { text: "A-YANIT-METNI" }); await bitir(p); d = await dur(p);
  t("N3 aynı hesap, chat başarısı: yanıt UI.chat ve ake.chat'e yazıldı, meşgul kapalı, istek denetleyicisi boş", /A-YANIT-METNI/.test(d.chat) && /A-YANIT-METNI/.test(d.lsChat) && !d.chatBusy && d.ctlBos, JSON.stringify([d.chatBusy, d.ctlBos]));
  await baslat(p, "chat", "A-SOHBET-SORU-2"); await vardi(p, "A", "chat"); await p.evaluate(() => { window.__g.A.chat.opts.onText({ text: "A-AKIS-PARCASI" }); });
  const canli = await p.evaluate(() => { const e = document.getElementById("chat-live"); return e ? e.innerHTML : null; });
  t("N4 aynı hesap: akış callback'i canlı alana yazar", canli === null || /A-AKIS-PARCASI/.test(canli), String(canli));
  await ac(p, "A", "chat", "rej", { code: "x", text: "A-HATA-METNI" }); await bitir(p); d = await dur(p);
  t("N5 aynı hesap, chat hatası (metinli): kısmi metin sohbete eklenir, meşgul kapalı", /A-HATA-METNI/.test(d.chat) && !d.chatBusy, d.chat.slice(-120));
  /* aynı kimlikle hesap yenileme (nesil artmaz): uçuştaki işlem yine uygulanır */
  await baslat(p, "plan"); await vardi(p, "A", "plan");
  await p.evaluate(() => hesapUygula({ kullanici: { id: "A", eposta: "a@x.test", ad: "" } }));
  const nesilAyni = await p.evaluate(() => OT.nesil);
  await ac(p, "A", "plan", "res", [{ day: 3, text: "A-PLAN-ISARET-3", s: "", min: 10 }]); await bitir(p); d = await dur(p);
  t("N6 aynı kimlikle hesapUygula: uçuştaki plan işlemi yine uygulanır", /A-PLAN-ISARET-3/.test(d.plan) && !d.planBusy, d.plan.slice(0, 100) + " nesil=" + nesilAyni);
  await c.close();
}

await b.close(); srv.close();
console.log(`\nÖZET: ${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
