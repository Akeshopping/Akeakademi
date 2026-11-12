// B4 Aşama 3A · İSTEMCİ: soru_meta YOK / BOŞ / DOLU iken sabit şık sırası (fix) ve puanlama. Gerçek tarayıcı + gerçek /api/soru işleyicileri + yerel izole D1.
// Production/Preview'a dokunmaz. Çalıştırma: node tests/soru-bayrak-istemci.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
import { kur } from "./yardim/soru-v2.mjs";
import { BAYRAK_HAZIR_ID } from "../lib/soru-api.js";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hesapMod = await import(pathToFileURL(path.join(KOK, "functions/api/hesap/[[yol]].js")).href), soruMod = await import(pathToFileURL(path.join(KOK, "functions/api/soru/[[yol]].js")).href);
const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(fs.readFileSync(KOK + "/index.html")); } r.statusCode = 404; r.end("yok"); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/", O0 = "https://akeakademi.com";
const b = await pw.chromium.launch(); let gecen = 0, kalan = 0;
const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 400)); };

const okuyucu = await (await b.newContext({ serviceWorkers: "block" })).newPage(); await okuyucu.goto(URL0, { waitUntil: "load" });
const BANKA = await okuyucu.evaluate(() => BANK.map(q => ({ id: q.id, s: q.s, t: q.t, d: q.d, p: q.p || null, q: q.q, o: q.o, a: q.a, x: q.x, os: q.os ? 1 : 0, fix: q.fix ? 1 : 0 })));
await okuyucu.context().close();
const FIX = BANKA.filter(q => q.fix), OS = BANKA.filter(q => q.os), HEPSI = new Map(BANKA.map(q => [q.id, q]));
t("0 gömülü BANK: 728 soru, 37 fix, 52 os", BANKA.length === 728 && FIX.length === 37 && OS.length === 52, `${BANKA.length}/${FIX.length}/${OS.length}`);

const T = await kur({ bayrak: "1" }); await T.hazirla();
const ins = T.DB.db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of) VALUES (?, ?, ?, ?, NULL, 'banka', 0, 0, 'gomulu', ?, ?, ?, ?, ?, NULL)");
T.DB.db.exec("BEGIN"); BANKA.forEach((q, i) => ins.run(q.id, q.s, q.t, q.d, i + 1, "h-" + q.id, JSON.stringify(q.p ? { p: q.p, q: q.q, o: q.o } : { q: q.q, o: q.o }), q.a, q.x)); T.DB.db.exec("COMMIT");
const GOC = fs.readFileSync(path.join(KOK, "migrations/0003_soru_meta.sql"), "utf8");
const g = await T.giris("istemci3a@ornek.com"); T.premiumYap(g.kid);

async function sayfa(yerelFixSil = []) {
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" }), p = await c.newPage(), yanitlar = [];
  await p.route("**/api/**", async r => {
    const rq = r.request(), u = new URL(rq.url()), yol = u.pathname, soru = yol.startsWith("/api/soru/"), hesap = yol.startsWith("/api/hesap/");
    if (!soru && !hesap) return r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    const m = rq.method(), govde = m === "GET" || m === "HEAD" ? undefined : rq.postData() || undefined, ad = yol.replace(soru ? "/api/soru/" : "/api/hesap/", "");
    const y = await (soru ? soruMod : hesapMod).onRequest({ request: new Request(O0 + yol + u.search, { method: m, headers: { "content-type": "application/json", cookie: g.cookie, origin: O0, "cf-connecting-ip": "10.9.9.9" }, body: govde }), env: T.env, params: { yol: ad.split("/") } });
    const tx = await y.text(); if (soru) yanitlar.push({ yol, durum: y.status, tx }); const h = {}; y.headers.forEach((v, k) => { if (k !== "set-cookie" && k !== "content-encoding") h[k] = v; });
    return r.fulfill({ status: y.status, headers: h, body: tx });
  });
  await p.goto(URL0 + "#bugun", { waitUntil: "load" }); await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); await p.waitForTimeout(300);
  if (yerelFixSil.length) await p.evaluate(ids => ids.forEach(id => { const q = BANK.find(x => x.id === id); if (q) delete q.fix; }), yerelFixSil);   // "BANK işareti yok" simülasyonu (3C sonrası durum)
  return { c, p, yanitlar };
}
const baslat = (p, ids, mod = "study") => p.evaluate(async ([ids, mod]) => {
  RUN = null; UI.modal = null; UI.svBusy = false; const qs = ids.map(id => BANK.find(q => q.id === id));
  startRun({ kind: mod === "exam" ? "exam" : "practice", title: "Test", mode: mod, qs, secs: [{ n: "T", from: 0, to: qs.length }], dur: mod === "exam" ? 30 : 0 });
  for (let i = 0; i < 40 && !RUN && !UI.modal; i++) await new Promise(r => setTimeout(r, 100));
  return RUN ? { n: RUN.qs.length, sv: RUN.qs.every(q => !!q.sv), perm: RUN.perm, o: RUN.qs.map(q => q.o) } : { n: 0, modal: UI.modal && UI.modal.title };
}, [ids, mod]);
const ID = [0, 1, 2, 3, 4], ozdes = perm => perm.every(pp => JSON.stringify(pp) === JSON.stringify(ID));
const son = S => JSON.parse(S.yanitlar.filter(y => y.yol === "/api/soru/oturum" && y.durum === 200).at(-1).tx);
const fixIds = FIX.slice(0, 40).map(q => q.id);

/* A) soru_meta YOK, B) BOŞ, C) DOLU — yerel BANK işaretleri sağlam: 37 sabit-sıra sorusu HİÇ karışmaz */
for (const [ad, hazirla, beklenen] of [["A tablo YOK", () => { }, "eksik"], ["B tablo VAR ama BOŞ", () => T.DB.db.exec(GOC), "eksik"],
  ["C tablo DOLU", () => { const ym = T.DB.db.prepare("INSERT OR REPLACE INTO soru_meta (id, os, fix) VALUES (?, ?, ?)"); T.DB.db.exec("BEGIN"); BANKA.filter(q => q.os || q.fix).forEach(q => ym.run(q.id, q.os, q.fix)); ym.run(BAYRAK_HAZIR_ID, OS.length, FIX.length); T.DB.db.exec("COMMIT"); }, "hazir"]]) {
  hazirla(); const S = await sayfa(), r = await baslat(S.p, fixIds, "study"), y = son(S);
  t(`${ad}: oturum sunucudan açıldı, bayrak='${beklenen}', 37 sabit-sıra sorusunun şık sırası HİÇ karışmadı (perm kimlik)`, r.n === 37 && r.sv && y.bayrak === beklenen && ozdes(r.perm), JSON.stringify([r.n, r.sv, y.bayrak, ozdes(r.perm)]));
  t(`${ad}: ekrandaki şıklar sunucu sırasıyla aynı (harf-şık eşleşmesi kaymadı)`, r.o.every((o, i) => JSON.stringify(o) === JSON.stringify(HEPSI.get(fixIds[i]).o.map(String).map(s => s.trim()))));
  await S.c.close();
}

/* D) BANK işaretinin kaybolduğu gelecek durum (3C sonrası): sunucu işareti DOLUYSA sıra korunur; EKSİKSE yanıt bunu AÇIKÇA bildirir (kapı) */
{ const sezgiYakalamaz = FIX.filter(q => !(q.o.every(o => /^[−\-]?\d/.test(String(o).trim())) || q.o.some(o => /^(Yalnız |I{1,3}V?(\s|,|$)|IV(\s|,|$)|Hiçbiri|Hepsi|Tümü)/.test(String(o).trim())))).map(q => q.id).slice(0, 27);
  t("D0 sabitSira sezgisinin yakalamadığı sabit-sıra sorusu sayısı 27 (BANK işareti kaybolursa risk)", sezgiYakalamaz.length === 27, sezgiYakalamaz.length);
  let tum = true; for (let i = 0; i < 6; i++) { const S = await sayfa(sezgiYakalamaz), r = await baslat(S.p, sezgiYakalamaz, "study"); tum = tum && r.n === 27 && ozdes(r.perm); await S.c.close(); }
  t("D1 yerel işaret SİLİNMİŞ + soru_meta DOLU: sunucu fix bayrağı 27 sorunun sırasını 6/6 denemede korur", tum);
  T.DB.db.exec("DELETE FROM soru_meta WHERE id = '" + BAYRAK_HAZIR_ID + "'");
  const S = await sayfa(sezgiYakalamaz); await baslat(S.p, sezgiYakalamaz, "study"); const y = son(S);
  t("D2 yerel işaret SİLİNMİŞ + soru_meta işaretsiz: yanıt bayrak='eksik' bildirir (BANK kaldırma KAPISI) ve sorularda sahte fix yok", y.bayrak === "eksik" && y.sorular.every(q => !("fix" in q)), y.bayrak);
  await S.c.close(); T.DB.db.prepare("INSERT OR REPLACE INTO soru_meta (id, os, fix) VALUES (?, ?, ?)").run(BAYRAK_HAZIR_ID, OS.length, FIX.length);
}

/* E) PUANLAMA: görüntü sırası ne olursa olsun seçim ORİJİNAL indeksle gider; doğru/yanlış ve harf eşleşmesi tutar */
{ const S = await sayfa(), norm = HEPSI, ids = BANKA.filter(q => !q.fix && !q.os && q.o.every(o => !/^[−\-]?\d/.test(String(o).trim())) && !q.o.some(o => /^(Yalnız |I{1,3}V?(\s|,|$)|IV(\s|,|$)|Hiçbiri|Hepsi|Tümü)/.test(String(o).trim()))).slice(0, 6).map(q => q.id);
  const r = await baslat(S.p, ids, "study");
  const sonuc = await S.p.evaluate(async () => {
    const out = []; for (let i = 0; i < RUN.qs.length; i++) {
      RUN.cur = i; const q = RUN.qs[i], perm = RUN.perm[i].slice(); const kuralli = perm.map((oi, pos) => ({ oi, pos }));
      const hedef = i % 2 === 0 ? "dogru" : "yanlis"; /* çift sıralar doğru, tek sıralar yanlış: doğru indeksi sunucudan öğrenmek için önce YANLIŞ olmayan bir tahminle denemeyiz */
      pickAnswer(perm[0]); for (let k = 0; k < 40 && q.a == null; k++) await new Promise(r => setTimeout(r, 50));
      out.push({ id: q.id, perm, ilkPoz: 0, secilen: perm[0], a: q.a, harf: typeof LET !== "undefined" && q.a != null ? LET[perm.indexOf(q.a)] : null, ans: RUN.ans[i] });
    } return out; });
  let tutarli = true; for (const x of sonuc) { const k = norm.get(x.id); if (x.a !== k.a) tutarli = false; if (x.harf !== "ABCDE"[x.perm.indexOf(k.a)]) tutarli = false; if (x.ans !== x.secilen) tutarli = false; }
  t("E1 alıştırma: görüntü sırası (perm) ne olursa olsun sunucunun verdiği doğru indeks BANK'takiyle aynı; harf = görüntülenen konum", r.n === 6 && tutarli, JSON.stringify(sonuc.map(x => [x.a, norm.get(x.id).a])));
  const dogruSay = sonuc.filter(x => x.secilen === x.a).length, sunucuDogru = S.yanitlar.filter(y => y.yol === "/api/soru/cevap").map(y => JSON.parse(y.tx).dogru).filter(Boolean).length;
  t("E2 sunucunun doğru sayısı, istemcinin orijinal indeks karşılaştırmasıyla aynı", dogruSay === sunucuDogru, dogruSay + "/" + sunucuDogru);
  const isaret = S.yanitlar.length, ex = await baslat(S.p, ids, "exam");   // deneme: son durumu bitir sonucu belirler
  const bt = await S.p.evaluate(async hedefler => { for (let i = 0; i < RUN.qs.length; i++) { RUN.cur = i; pickAnswer(hedefler[i]); } finishRun(false); for (let k = 0; k < 60 && !UI.lastResult && !UI.resultId; k++) await new Promise(r => setTimeout(r, 100)); const R = UI.lastResult || (S && null); return null; }, ids.map(id => HEPSI.get(id).a));
  const bitir = S.yanitlar.filter(y => y.yol === "/api/soru/bitir").at(-1), bj = bitir && JSON.parse(bitir.tx);
  t("E3 deneme: tüm cevaplar doğru indeksle verildi → sunucu puanı 6/6 doğru, 0 yanlış; bitirmeden anahtar yoktu", !!bj && bj.dogru === 6 && bj.yanlis === 0 && bj.bos === 0 && S.yanitlar.slice(isaret).filter(y => y.yol !== "/api/soru/bitir").every(y => !/"a"\s*:|"x"\s*:/.test(y.tx)), bj ? JSON.stringify([bj.dogru, bj.yanlis, bj.bos]) : "yanıt yok");
  await S.c.close(); }

await b.close(); srv.close(); console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
