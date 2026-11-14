// B4 Aşama 3B-2 · GERÇEK tarayıcıda KHAVUZ: sayfanın kendi eski fonksiyonları (poolOf, topicsOf, bankFiltered, osymElle, buildSet) ile KHAVUZ karşılaştırılır.
// Katalog, sayfanın kendi BANK'ından (a/x/çözüm ÇIKARILARAK) ve /sorular/*.json HAM konu adlarıyla kurulur; ağ taklit edilir, Production/Preview'a dokunulmaz.
// Çalıştırma: node tests/katalog-havuz-istemci.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), YENI = fs.readFileSync(process.env.KHAVUZ_HTML || path.join(KOK, "index.html"), "utf8");
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 400)); };
const HAM = new Map(); for (const f of JSON.parse(fs.readFileSync(path.join(KOK, "sorular/liste.json"), "utf8")).dosyalar || JSON.parse(fs.readFileSync(path.join(KOK, "sorular/liste.json"), "utf8"))) { const ad = typeof f === "string" ? f : f.dosya || f.ad; try { for (const q of JSON.parse(fs.readFileSync(path.join(KOK, "sorular", ad), "utf8"))) HAM.set(q.id, q.t); } catch (e) { } }
function servis() { const s = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split("?")[0]); if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(YENI); } if (f.startsWith("/sorular/")) { const p = path.join(KOK, f); if (fs.existsSync(p)) { r.setHeader("content-type", "application/json"); return r.end(fs.readFileSync(p)); } } r.statusCode = 404; r.end(""); }); return new Promise(ok => s.listen(0, "127.0.0.1", () => ok({ s, url: "http://127.0.0.1:" + s.address().port + "/" }))); }
const sv = await servis(), b = await pw.chromium.launch(), c = await b.newContext({ serviceWorkers: "block", reducedMotion: "reduce" }), p = await c.newPage(); let katIstek = 0;
await p.route("**/*", r => { const u = new URL(r.request().url()); if (u.hostname !== "127.0.0.1") return r.abort(); if (u.pathname.startsWith("/api/")) { if (u.pathname === "/api/soru/katalog") katIstek++; return r.fulfill({ status: 404, contentType: "application/json", body: "{}" }); } return r.continue(); });
await p.addInitScript(() => { window.AKE_KATALOG = true; window.AKE_KATALOG_HAVUZ = true; });
const y = await p.goto(sv.url, { waitUntil: "load" }); await p.waitForFunction(() => typeof BANK !== "undefined" && BANK.length >= 1000, null, { timeout: 15000 }).catch(() => { });
const sag = await p.evaluate(() => ({ bank: typeof BANK !== "undefined" ? BANK.length : -1, h: typeof KHAVUZ !== "undefined" })); if (!y || y.status() !== 200 || sag.bank < 728 || !sag.h) { console.error("TEST GEÇERSİZ: " + JSON.stringify(sag)); process.exit(2); }
/* katalog: BANK'tan cevapsız kopya; JSON kaynaklı sorularda HAM konu adı */
const r = await p.evaluate(async ham => {
  const kat = BANK.map(q => { const o = { id: q.id, s: q.s, t: ham[q.id] ?? q.t, d: q.d, q: q.q, o: q.o.slice() }; if (q.p) o.p = q.p; if (q.os) o.os = 1; if (q.fix) o.fix = 1; return o; }).sort((a, b) => a.id < b.id ? -1 : 1);
  return { n: kat.length, os: kat.filter(q => q.os).length, fix: kat.filter(q => q.fix).length, kat, hamFark: kat.filter(q => ham[q.id] !== undefined && ham[q.id] !== BANK.find(x => x.id === q.id).t).length };
}, Object.fromEntries(HAM));
t("0 hazırlık: sayfa BANK'ı ≥1000, katalog cevapsız kopyadan kuruldu, a/x yok", r.n >= 1000 && !r.kat.some(q => "a" in q || "x" in q), JSON.stringify({ n: r.n }));
/* gerçek KAT, /api/soru/katalog taklidiyle (sayfa içi fetch) */
await p.unroute("**/*"); const KAT_SORULAR = r.kat;
await p.route("**/*", rt => { const u = new URL(rt.request().url()); if (u.hostname !== "127.0.0.1") return rt.abort(); if (u.pathname === "/api/soru/katalog") { const limit = +u.searchParams.get("limit"), sonra = u.searchParams.get("sonra"), kal = KAT_SORULAR.filter(q => sonra === null || q.id > sonra), devam = kal.length > limit, sayfa = devam ? kal.slice(0, limit) : kal; return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ n: sayfa.length, bayrak: "hazir", beklenen: (sonra === null || !devam) ? { toplam: KAT_SORULAR.length, os: KAT_SORULAR.filter(q => q.os === 1).length, fix: KAT_SORULAR.filter(q => q.fix === 1).length } : null, sorular: sayfa, sonraki: devam ? sayfa[sayfa.length - 1].id : null }) }); } if (u.pathname.startsWith("/api/")) return rt.fulfill({ status: 404, contentType: "application/json", body: "{}" }); return rt.continue(); });
const sonuc = await p.evaluate(async toplam => {
  let esleCagri = 0; const esleAsil = KONU_ESLE; window.KONU_ESLE = function () { esleCagri++; return esleAsil.apply(this, arguments); };
  const yuk = await KHAVUZ.yukle({ beklenenToplam: toplam, beklenenOs: BANK.filter(q => q.os).length, beklenenFix: BANK.filter(q => q.fix).length });
  const ids = a => a.map(q => q.id).sort().join(","), fark = []; let say = 0;
  const ctx = { reports: S.reports, ans: S.ans };
  const dersler = Object.keys(SUBJ);
  for (const s of dersler) for (const topic of [undefined, ...topicsOf(s).map(x => x.t).slice(0, 4)]) for (const diff of [undefined, 1, 2, 3]) { say++; const e = poolOf(s, { topic, diff }).filter(q => q.src !== "ai" && !EKQ.includes(q)), y2 = KHAVUZ.poolOf(s, { topic, diff }, ctx).sorular; if (ids(e) !== ids(y2)) fark.push(s + "|" + topic + "|" + diff); }
  const tf = []; for (const s of dersler) { const e = topicsOf(s).filter(x => x.n).map(x => x.t + ":" + x.n).join("|"), y2 = KHAVUZ.topicsOf(s).konular.map(x => x.t + ":" + x.n).join("|"); if (e !== y2) tf.push(s); }
  const of = []; for (const s of dersler) if (ids(osymElle(s)) !== ids(KHAVUZ.osymElle(s, ctx).sorular)) of.push(s);
  const bf = []; for (const q of ["", "ışık", "ISIK", "paragraf"]) for (const tt of [undefined]) { UI.bank = Object.assign({}, UI.bank, { s: "", t: "", d: 0, src: "", st: "", q }); if (ids(bankFiltered()) !== ids(KHAVUZ.bankFiltered({ q }, ctx).sorular)) bf.push(q); }
  const bankT = new Map(BANK.map(q => [q.id, q.t])), konuFark = []; for (const s of dersler) for (const q of KHAVUZ.poolOf(s, {}, ctx).sorular) if (q.t !== bankT.get(q.id)) konuFark.push(q.id);
  const hamFarkli = []; for (const s of dersler) for (const q of KHAVUZ.poolOf(s, {}, ctx).sorular) if (q.tHam !== q.t) hamFarkli.push(q.id + ":" + q.tHam + "→" + q.t);
  const sizdi = dersler.some(s => KHAVUZ.poolOf(s, {}, ctx).sorular.some(q => Object.keys(q).some(k => !["id", "s", "t", "d", "p", "q", "o", "os", "fix", "tHam"].includes(k))));
  window.KONU_ESLE = esleAsil;
  return { esleCagri, konuFark, hamFarkli, sizdi, yuk: yuk.ok ? { toplam: yuk.toplam, os: yuk.os, fix: yuk.fix } : yuk, say, fark, tf, of, bf, ham: !!KHAVUZ.poolOf(dersler[0], {}, ctx).sorular.length };
}, r.n).catch(e => ({ hata: String(e) }));
t("1 gerçek KAT → KHAVUZ yüklendi (toplam/os/fix BANK ile aynı)", !sonuc.hata && sonuc.yuk && sonuc.yuk.toplam === r.n && sonuc.yuk.os === r.os && sonuc.yuk.fix === r.fix, JSON.stringify(sonuc.hata || sonuc.yuk));
t(`2 poolOf: sayfanın kendi eski fonksiyonuyla AYNI (${sonuc.say} bileşim)`, sonuc.fark && sonuc.fark.length === 0, (sonuc.fark || []).slice(0, 3).join(" | "));
t("3 topicsOf aynı (konu adı + sayı; ham JSON konu adları KONU_ESLE ile eşlendi)", sonuc.tf && sonuc.tf.length === 0, (sonuc.tf || []).join());
t("4 osymElle aynı", sonuc.of && sonuc.of.length === 0, (sonuc.of || []).join());
t("5 bankFiltered (metin araması) aynı", sonuc.bf && sonuc.bf.length === 0, (sonuc.bf || []).join());
/* 6) sayfa davranışı: havuz hiçbir ekrana bağlı değil; BANK değişmedi; depolamaya yazılmadı */
const son = await p.evaluate(() => ({ bank: BANK.length, ls: Object.keys(localStorage).filter(k => /havuz|khavuz|katalog/i.test(k)) })); t("6a her sorunun konusu, sayfadaki KONU_ESLE'li BANK konusuyla AYNI (1127 soru, KHAVUZ kendi bağımsız eşlemesiyle)", sonuc.konuFark && sonuc.konuFark.length === 0 && r.n >= 1000, (sonuc.konuFark || []).slice(0, 3).join());
t("6b KHAVUZ, sayfadaki KONU_ESLE'yi HİÇ çağırmadı (ortak duruma yan etki yok)", sonuc.esleCagri === 0, sonuc.esleCagri);
t("6c olumlu kontrol: ham ve eşlenmiş konu gerçekten farklı sorular var (eşleme sınanıyor); bunlar bilinen 'İş problemleri' çifti", sonuc.hamFarkli && sonuc.hamFarkli.length > 0 && sonuc.hamFarkli.every(x => /İş problemleri→İş Problemleri$/.test(x)), JSON.stringify(sonuc.hamFarkli));
t("6d havuz öğeleri yalnız izin listesi alanlarını taşır", sonuc.sizdi === false);
t("6 KHAVUZ depolamaya hiçbir şey yazmadı", son.ls.length === 0, JSON.stringify(son));
await b.close(); sv.s.close(); console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
