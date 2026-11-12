// B4 istemci uçtan uca testi: gerçek tarayıcı + gerçek /api/hesap ve /api/soru işleyicileri + yerel izole D1 (node:sqlite).
// Production/Preview'a dokunmaz. Çalıştırma: node tests/soru-b4-istemci.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
import { kur } from "./yardim/soru-v2.mjs";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hesapMod = await import(pathToFileURL(path.join(KOK, "functions/api/hesap/[[yol]].js")).href);
const soruMod = await import(pathToFileURL(path.join(KOK, "functions/api/soru/[[yol]].js")).href);
const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(readFileSync(KOK + "/index.html")); } r.statusCode = 404; r.end(); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch(); let gecen = 0, kalan = 0;
const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 400)); };
const O0 = "https://akeakademi.com";

/* yerel BANK'ı bir kez oku; sunucu tablosunu ondan doldur (sunucu cevabı yalnız orada tutar) */
const okuyucu = await (await b.newContext({ serviceWorkers: "block" })).newPage();
await okuyucu.goto(URL0, { waitUntil: "load" });
const BANKA = await okuyucu.evaluate(() => BANK.filter(q => !q.p).map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, q: q.q, o: q.o, a: q.a, x: q.x })));
await okuyucu.context().close();
const A = new Map(BANKA.map(q => [q.id, q]));

let PAYLAS = null;   // ortak.js modül düzeyinde şema bayrağı tuttuğu için tek D1 paylaşılır; her senaryo kendi kullanıcısını ve (gerekirse) değişik bayrağı kullanır
async function ortam({ bayrak = "1", paket = false } = {}) {
  if (!PAYLAS) {
    const T = await kur({ bayrak: "1" }); await T.hazirla();
    const ins = T.DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, ?, ?, NULL, 'banka', 0, 0, 'statik', ?, ?, ?, ?, ?, NULL)");
    T.DB.db.exec("BEGIN"); BANKA.forEach((q, i) => ins.run(q.id, q.s, q.t, q.d, i + 1, "h-" + q.id, JSON.stringify({ q: q.q, o: q.o }), q.a, q.x)); T.DB.db.exec("COMMIT"); PAYLAS = T;
  }
  const T = PAYLAS, env = Object.assign({}, T.env); if (bayrak == null) delete env.AKE_SORU_V2; else env.AKE_SORU_V2 = bayrak;
  const g = await T.giris("ogrenci" + Math.floor(Math.random() * 1e9) + "@ornek.com"); if (paket) T.premiumYap(g.kid);
  return { T, g, env, istekler: [] };
}
async function sayfa(O) {
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const p = await c.newPage(), hatalar = []; p.on("pageerror", e => hatalar.push(e.message));
  await p.route("**/api/**", async r => {
    const rq = r.request(), u = new URL(rq.url()), yol = u.pathname, soru = yol.startsWith("/api/soru/"), hesap = yol.startsWith("/api/hesap/");
    if (!soru && !hesap) return r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    const m = rq.method(), govde = m === "GET" || m === "HEAD" ? undefined : rq.postData() || undefined;
    const ad = yol.replace(soru ? "/api/soru/" : "/api/hesap/", "");
    const req = new Request(O0 + yol + u.search, { method: m, headers: { "content-type": "application/json", cookie: O.g.cookie, origin: O0, "cf-connecting-ip": "10.9.9.9" }, body: govde });
    if (O.hook) { const h = await O.hook(yol, "once"); if (h) return r.fulfill({ status: h, contentType: "application/json", body: JSON.stringify({ error: "sunucu_hatasi" }) }); }
    const y = await (soru ? soruMod : hesapMod).onRequest({ request: req, env: O.env, params: { yol: ad.split("/") } });
    const tx = await y.text(); O.istekler.push({ yol, m, govde, durum: y.status, govde_yanit: tx });
    const h = {}; y.headers.forEach((v, k) => { if (k !== "set-cookie" && k !== "content-encoding") h[k] = v; });
    if (O.hook && (await O.hook(yol, "sonra"))) return r.abort();   // sunucu işini yaptı, yanıt istemciye ulaşmadı (belirsiz ağ)
    return r.fulfill({ status: y.status, headers: h, body: tx });
  });
  await p.goto(URL0 + "#bugun", { waitUntil: "load" });
  await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); await p.waitForTimeout(300);
  return { c, p, hatalar };
}
/* belirli kimliklerle oturum başlat; kimlikler yerel BANK'tan (sunucuda aynı kimlikle var) */
const baslat = (p, ids, { mod = "study", kind, gens = 0 } = {}) => p.evaluate(async ([ids, mod, kind, gens]) => {
  RUN = null; UI.modal = null; UI.svBusy = false;
  const qs = ids.map(id => BANK.find(q => q.id === id));
  for (let i = 0; i < gens; i++) { const g = GENS[i]; qs.push(genQ(g, g.subs[0], new Set())); }
  startRun({ kind: kind || (mod === "exam" ? "exam" : "practice"), title: "Test", mode: mod, qs, secs: [{ n: "T", from: 0, to: qs.length }], dur: mod === "exam" ? 30 : 0 });
  for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
  return { run: RUN ? RUN.qs.length : 0, modal: UI.modal ? UI.modal.title : null };
}, [ids, mod, kind, gens]);
const idler = (n, bas = 0) => BANKA.slice(bas, bas + n).map(q => q.id);
const oturumYanitlari = O => O.istekler.filter(i => i.yol === "/api/soru/oturum" && i.durum === 200);

/* 1) ÇALIŞMA MODU: soru cevapsız gelir; cevap sonrası doğru seçenek + çözüm gelir ve ekranda görünür */
{ const O = await ortam({ paket: true }), s = await sayfa(O), ids = idler(5);
  const r = await baslat(s.p, ids); t("1a 5 soru sunucu oturumuyla başladı", r.run === 5 && oturumYanitlari(O).length === 1, JSON.stringify(r));
  const ilk = await s.p.evaluate(() => ({ a: RUN.qs.map(q => q.a), x: RUN.qs.map(q => q.x), sv: RUN.qs.every(q => !!q.sv), ls: localStorage.getItem("ake.run") }));
  t("1b başlangıçta RUN içinde cevap ve çözüm yok", ilk.a.every(v => v === undefined) && ilk.x.every(v => v === undefined) && ilk.sv);
  t("1c localStorage ake.run içinde çözüm metni yok", !ids.some(id => ilk.ls.includes(A.get(id).x)), "ls sızıntısı");
  const ykt = oturumYanitlari(O)[0].govde_yanit; t("1d oturum yanıtında a/x ve çözüm yok", !/"a":|"x":/.test(ykt) && !ids.some(id => ykt.includes(A.get(id).x)));
  const dogru = A.get(ids[0]).a; await s.p.evaluate(o => pickAnswer(o), (dogru + 1) % 5); await s.p.waitForFunction(() => RUN.rev[0] === true, null, { timeout: 5000 });
  const son = await s.p.evaluate(() => ({ a: RUN.qs[0].a, x: RUN.qs[0].x, metin: document.querySelector(".expl") && document.querySelector(".expl").innerText, ans: RUN.ans[0] }));
  t("1e cevaptan sonra doğru seçenek sunucudan geldi", son.a === dogru, JSON.stringify(son));
  t("1f açıklama ekranda ve doğru metin", !!son.metin && son.metin.includes("Yanlış") && son.metin.replace(/\s+/g, " ").includes(A.get(ids[0]).x.slice(0, 20).replace(/\s+/g, " ")), son.metin);
  const ikinci = await s.p.evaluate(async () => { pickAnswer(0); await new Promise(r => setTimeout(r, 200)); return RUN.ans[0]; }); t("1g aynı soru ikinci kez cevaplanamaz", ikinci === (dogru + 1) % 5);
  const bekleyen = A.get(ids[1]); t("1h cevaplanmamış sorunun çözümü hâlâ istemcide yok", await s.p.evaluate(() => RUN.qs[1].x === undefined && RUN.qs[1].a === undefined));
  await s.p.evaluate(() => { for (let i = 1; i < RUN.qs.length; i++) { RUN.cur = i; } }); 
  t("1i sayfa hatası yok", s.hatalar.length === 0, s.hatalar.join("|")); await s.c.close(); }

/* 2) DENEME: bitene kadar hiçbir ağ yanıtında anahtar yok; puan sunucuda; istemcide değiştirilen a işe yaramaz */
{ const O = await ortam({ paket: true }), s = await sayfa(O), ids = idler(8, 10);
  const r = await baslat(s.p, ids, { mod: "exam" }); t("2a deneme başladı", r.run === 8, JSON.stringify(r));
  const secimler = ids.map((id, i) => i < 4 ? A.get(id).a : i < 7 ? (A.get(id).a + 1) % 5 : null);   // 4 doğru, 3 yanlış, 1 boş
  await s.p.evaluate(sc => { sc.forEach((v, i) => { RUN.cur = i; if (v != null) pickAnswer(v); }); /* sahte anahtar yerleştirme denemesi */ RUN.qs.forEach((q, i) => { q.a = (i % 5); q.x = "SAHTE"; }); }, secimler);
  const onceki = O.istekler.filter(i => i.yol.startsWith("/api/soru/")).map(i => i.govde_yanit).join("\n");
  t("2b bitmeden hiçbir soru yanıtında anahtar/çözüm yok", !/"a":|"x":/.test(onceki) && !ids.some(id => onceki.includes(A.get(id).x)));
  t("2c deneme modunda cevap endpoint'i çağrılmadı", !O.istekler.some(i => i.yol === "/api/soru/cevap"));
  await s.p.evaluate(() => { finishRun(false); }); await s.p.waitForFunction(() => !RUN && !!UI.resultId, null, { timeout: 8000 });
  const sonuc = await s.p.evaluate(() => { const e = S.exams[S.exams.length - 1]; return { d: e.d, y: e.y, b: e.b, sv: e.qs.some(q => q.sv), ilkA: e.qs[0].a, ilkX: e.qs[0].x }; });
  t("2d sonuç sunucu hesabıyla: 4 doğru / 3 yanlış / 1 boş (sahte yerel anahtara rağmen)", sonuc.d === 4 && sonuc.y === 3 && sonuc.b === 1, JSON.stringify(sonuc));
  t("2e sonuç kaydında gerçek anahtar ve çözüm var, oturum kimliği yok", sonuc.ilkA === A.get(ids[0]).a && sonuc.ilkX === A.get(ids[0]).x && !sonuc.sv);
  const bt = O.istekler.filter(i => i.yol === "/api/soru/bitir"); t("2f tek /bitir çağrısı, toplu cevaplarla", bt.length === 1 && JSON.parse(bt[0].govde).cevaplar.length === 8, JSON.stringify(bt.map(x => x.durum)));
  t("2g sayfa hatası yok", s.hatalar.length === 0, s.hatalar.join("|")); await s.c.close(); }

/* 3) Eski sistem (AKE_SORU_V2 kapalı): yerel akış aynen; bir kez denenir, sonra tekrar çağrılmaz */
{ const O = await ortam({ bayrak: null, paket: true }), s = await sayfa(O);
  const r = await baslat(s.p, idler(4)); const a = await s.p.evaluate(() => RUN.qs.map(q => q.a));
  t("3a bayrak kapalı: oturum yerelde başladı, cevaplar yerelde (eski davranış)", r.run === 4 && a.every(Number.isInteger) && !(await s.p.evaluate(() => RUN.qs.some(q => q.sv))), JSON.stringify({ r, a }));
  await baslat(s.p, idler(4, 4)); t("3b ikinci başlatmada sunucuya tekrar gidilmedi", O.istekler.filter(i => i.yol === "/api/soru/oturum").length === 1);
  await s.p.evaluate(() => pickAnswer(0)); t("3c yerel cevap sonrası açıklama gösterildi", await s.p.evaluate(() => RUN.rev[0] === true && !!document.querySelector(".expl")));
  await s.c.close(); }

/* 4) Üretilen (gen) sorular yerelde kalır; kitaplık soruları sunucuda — karma set */
{ const O = await ortam({ paket: true }), s = await sayfa(O);
  const r = await baslat(s.p, idler(3), { gens: 2 }); const d = await s.p.evaluate(() => RUN.qs.map(q => ({ g: !!q.gen, sv: !!q.sv, a: q.a })));
  t("4a karma set: 3 sunucu + 2 yerel üretilmiş", r.run === 5 && d.filter(x => x.sv).length === 3 && d.filter(x => x.g).length === 2 && d.filter(x => x.g).every(x => Number.isInteger(x.a)) && d.filter(x => x.sv).every(x => x.a === undefined), JSON.stringify(d));
  await s.c.close(); }

/* 5) Yanlış defteri tekrarı yerel kalır (öğrenci o soruları zaten görmüş) */
{ const O = await ortam({ paket: true }), s = await sayfa(O);
  await baslat(s.p, idler(2), { kind: "mistakes" }); t("5 yanlış defteri turu sunucu oturumu açmadı", O.istekler.filter(i => i.yol === "/api/soru/oturum").length === 0 && await s.p.evaluate(() => !!RUN && !RUN.qs.some(q => q.sv))); await s.c.close(); }

/* 6) Ücretsiz kota: pratik 25 istenir → 20 verilir; ikinci başlatma limit penceresi; sonuçta kota tek sefer düşer */
{ const O = await ortam({ paket: false }), s = await sayfa(O);
  const r1 = await baslat(s.p, idler(25)); t("6a ücretsiz pratikte 25 sorudan 20'si verildi", r1.run === 20, JSON.stringify(r1));
  const kd = O.istekler.filter(i => i.yol === "/api/hesap/kota"); t("6b eski kota ucu ayrıca çağrılmadı (çifte düşüm yok)", kd.length === 0, JSON.stringify(kd.map(x => x.govde)));
  const r2 = await baslat(s.p, idler(3, 30)); t("6c hak bitince soru yok, limit penceresi açıldı", r2.run === 0 && /bitti/.test(r2.modal || ""), JSON.stringify(r2));
  await s.c.close(); }
/* 7) Ücretsiz deneme: ayda 1; ikincisi engellenir */
{ const O = await ortam({ paket: false }), s = await sayfa(O);
  const d1 = await baslat(s.p, idler(5), { mod: "exam" }), d2 = await baslat(s.p, idler(5, 5), { mod: "exam" });
  t("7a ilk deneme başladı, ikincisi engellendi", d1.run === 5 && d2.run === 0 && /deneme/.test(d2.modal || ""), JSON.stringify({ d1, d2 })); await s.c.close(); }

/* 8) Sayfa yenilemeden sonra devam: cevaplanmış sorunun çözümü saklı, yenisi sunucudan açılır; deneme anahtarı yenilemede de yok */
{ const O = await ortam({ paket: true }), s = await sayfa(O), ids = idler(4, 20);
  await baslat(s.p, ids); await s.p.evaluate(o => pickAnswer(o), A.get(ids[0]).a); await s.p.waitForFunction(() => RUN.rev[0] === true);
  await s.p.reload({ waitUntil: "load" }); await s.p.waitForFunction(() => HESAP.hazir && HESAP.user && RUN); 
  const d = await s.p.evaluate(() => ({ a0: RUN.qs[0].a, a1: RUN.qs[1].a, sv: RUN.qs[1].sv }));
  t("8a yenileme sonrası cevaplanmış soru cevabını koruyor, diğeri hâlâ cevapsız", d.a0 === A.get(ids[0]).a && d.a1 === undefined && !!d.sv, JSON.stringify(d));
  await s.p.evaluate(() => { RUN.cur = 1; }); await s.p.evaluate(o => pickAnswer(o), A.get(ids[1]).a); await s.p.waitForFunction(() => RUN.rev[1] === true, null, { timeout: 5000 });
  t("8b yenilemeden sonra yeni soru sunucudan cevaplandı", await s.p.evaluate(() => RUN.qs[1].a) === A.get(ids[1]).a); await s.c.close(); }
{ const O = await ortam({ paket: true }), s = await sayfa(O), ids = idler(3, 40);
  await baslat(s.p, ids, { mod: "exam" }); await s.p.reload({ waitUntil: "load" }); await s.p.waitForFunction(() => HESAP.hazir && RUN);
  t("8c deneme yenilemeden sonra da anahtarsız", await s.p.evaluate(() => RUN.qs.every(q => q.a === undefined && q.x === undefined)) && !/"a":/.test(await s.p.evaluate(() => localStorage.getItem("ake.run")))); await s.c.close(); }

/* 9) Ağ hatası: çalışma modunda cevap kaydedilemezse soru açık kalır (yerel anahtar yok → ifşa yok) */
{ const O = await ortam({ paket: true }), s = await sayfa(O), ids = idler(2, 50); await baslat(s.p, ids);
  await s.p.route("**/api/soru/cevap", r => r.abort());
  await s.p.evaluate(() => pickAnswer(0)); await s.p.waitForTimeout(600);
  t("9 cevap isteği düşünce soru açıkta, anahtar sızmadı", await s.p.evaluate(() => RUN.rev[0] !== true && RUN.qs[0].a === undefined)); await s.c.close(); }

/* 10) Süresi dolan deneme oturumu: anahtar alınamayan sorular boş sayılır, sonuç yine oluşur, yanlış sayılmaz */
{ const O = await ortam({ paket: true }), s = await sayfa(O), ids = idler(3, 60);
  await baslat(s.p, ids, { mod: "exam" }); await s.p.evaluate(() => { RUN.cur = 0; pickAnswer(1); RUN.cur = 1; pickAnswer(2); });
  O.T.DB.db.prepare("UPDATE soru_oturum SET durum = 'iptal' WHERE kid = ?").run(O.g.kid);
  await s.p.evaluate(() => finishRun(false)); await s.p.waitForFunction(() => !RUN && !!UI.resultId, null, { timeout: 8000 });
  const e = await s.p.evaluate(() => { const x = S.exams[S.exams.length - 1]; return { d: x.d, y: x.y, b: x.b }; }); t("10 bitmiş oturumda sorular boş sayıldı (yanlış sayılmadı)", e.d === 0 && e.y === 0 && e.b === 3, JSON.stringify(e)); await s.c.close(); }

/* 11) beklenmeyen sunucu hatası (500): eski yerel sisteme DÖNÜLMEZ, durur ve tekrar dene sunar; kota düşmez; tekrarda başlar */
{ const O = await ortam({ paket: false }), s = await sayfa(O); let hata = true; O.hook = async (yol, asama) => hata && asama === "once" && yol === "/api/soru/oturum" ? 500 : false;
  const r = await baslat(s.p, idler(5, 70)); const ben = () => s.p.evaluate(async () => (await (await fetch("/api/hesap/ben")).json()).ucretsiz.kalanSoru);
  t("11a 500 → run başlamadı, 'açılamadı' penceresi, yerel akışa düşülmedi", r.run === 0 && /açılamadı/.test(r.modal || "") && !(await s.p.evaluate(() => !!RUN)), JSON.stringify(r));
  t("11b eski kota ucu çağrılmadı, hak düşmedi", !O.istekler.some(i => i.yol === "/api/hesap/kota") && await ben() === 20);
  hata = false; await s.p.click('[data-a="svTekrar"]'); await s.p.waitForFunction(() => !!RUN, null, { timeout: 8000 });
  t("11c 'Tekrar dene' ile sunucu oturumuyla başladı, 5 hak düştü", await s.p.evaluate(() => RUN.qs.length === 5 && RUN.qs.every(q => q.sv && q.a === undefined)) && await ben() === 15); await s.c.close(); }
/* 12) belirsiz ağ: sunucu oturumu açıp kotayı düştü, yanıt ulaşmadı → tekrarda AYNI oturum (replay), ikinci kez kota düşmez */
{ const O = await ortam({ paket: false }), s = await sayfa(O); let kayip = true; O.hook = async (yol, asama) => kayip && asama === "sonra" && yol === "/api/soru/oturum";
  const ben = () => s.p.evaluate(async () => (await (await fetch("/api/hesap/ben")).json()).ucretsiz.kalanSoru);
  const r = await baslat(s.p, idler(5, 80)); const n1 = O.T.DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum WHERE kid = ?").get(O.g.kid).n;
  t("12a yanıt kayboldu: run yok, tekrar dene penceresi; sunucuda 1 oturum ve 5 hak düşmüş", r.run === 0 && /açılamadı/.test(r.modal || "") && n1 === 1 && await ben() === 15, JSON.stringify({ r, n1 }));
  kayip = false; await s.p.click('[data-a="svTekrar"]'); await s.p.waitForFunction(() => !!RUN, null, { timeout: 8000 });
  const n2 = O.T.DB.db.prepare("SELECT COUNT(*) n FROM soru_oturum WHERE kid = ?").get(O.g.kid).n;
  t("12b tekrarda yeni oturum açılmadı, kota ikinci kez düşmedi (hâlâ 15)", n2 === 1 && await ben() === 15 && await s.p.evaluate(() => RUN.qs.length === 5), JSON.stringify({ n2 })); await s.c.close(); }
/* 13) ağ tamamen kopuk (fetch düşer): aynı davranış, yerel sisteme dönülmez */
{ const O = await ortam({ paket: true }), s = await sayfa(O); await s.p.route("**/api/soru/oturum", r => r.abort());
  const r = await baslat(s.p, idler(3, 90)); t("13 ağ hatası → durur, tekrar dene penceresi, yerel RUN yok", r.run === 0 && /açılamadı/.test(r.modal || "")); await s.c.close(); }
/* 14) sunucuda uygun soru henüz yoksa (banka_yok, kota düşmez) → eski yerel akış (migration öncesi V2 açık durumu) */
{ const O = await ortam({ paket: true }), s = await sayfa(O);
  const r = await s.p.evaluate(async () => { RUN = null; UI.modal = null; const qs = [0, 1, 2].map(i => ({ id: "yok-" + i, s: "mat", t: "K", d: 1, q: "Yerel soru " + i, o: ["1", "2", "3", "4", "5"], a: i, x: "yerel çözüm" })); startRun({ kind: "practice", title: "T", mode: "study", qs, secs: [{ n: "T", from: 0, to: 3 }], dur: 0 }); for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100)); return { run: RUN ? RUN.qs.length : 0, a: RUN ? RUN.qs.map(q => q.a) : [] }; });
  t("14 banka_yok → eski yerel akış çalıştı (soru sayısı korundu)", r.run === 3 && r.a.join() === "0,1,2", JSON.stringify(r)); await s.c.close(); }

console.log(`\n${gecen} geçti, ${kalan} kaldı`); await b.close(); srv.close(); process.exit(kalan ? 1 : 0);
