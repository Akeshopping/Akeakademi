// B4 Aşama 3B-2 · KHAVUZ adaptörü BİRİM testleri. Sentetik veri; ağ YOK; depolama/BANK YOK.
// Eski senkron fonksiyonlar (poolOf, buildSet, topicsOf, bankFiltered, osymElle) index.html'den GERÇEK kaynağıyla çıkarılır ve eski havuzla (sentetik BANK) karşılaştırılır.
// Çalıştırma: node tests/katalog-havuz.test.mjs   (env KHAVUZ_HTML ile index.html yolu değiştirilebilir)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), html = fs.readFileSync(process.env.KHAVUZ_HTML || path.join(KOK, "index.html"), "utf8");
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 300)); };
const kes = (bas, bit) => { const a = html.lastIndexOf("/* =====", html.indexOf(bas)), b = html.indexOf(bit); if (a < 0 || b < a) { console.error("blok bulunamadı: " + bas); process.exit(1); } return html.slice(a, b); };
const KATB = kes("[KAT-BASLA]", "/* [KAT-BITIR] */"), HB = kes("[KHAVUZ-BASLA]", "/* [KHAVUZ-BITIR] */");
const fn = ad => { const a = html.indexOf("\nfunction " + ad + "("); if (a < 0) { console.error("işlev yok: " + ad); process.exit(1); } const b = html.indexOf("\n}\n", a); return html.slice(a, b + 3); };
const ESKI_KOD = ["poolOf", "buildSet", "topicsOf", "bankFiltered"].map(fn).join("\n") + "\n" + html.slice(html.indexOf("const osymElle = "), html.indexOf("\n", html.indexOf("const osymElle = ")));

/* ---- sentetik veri ---- */
const DERS = ["mat", "turkce", "fizik"], SORULAR = [];
for (let i = 0; i < 300; i++) { const q = { id: "syn" + String(i).padStart(4, "0"), s: DERS[i % 3], t: ["Konu A", "Konu B", "Çok Özel", "İş problemleri", "İş Problemleri"][i % 5], d: 1 + (i % 3), q: "Sentetik İSTANBUL soru " + i, o: ["A", "B", "C", "D", "E"].map(h => h + i) }; if (i % 7 === 0) q.os = 1; else if (i % 11 === 0) q.fix = 1; if (i % 13 === 0) q.p = "Paragraf ışık " + i; SORULAR.push(q); }
const TOP = SORULAR.length, OS = SORULAR.filter(q => q.os).length, FIX = SORULAR.filter(q => q.fix).length;
const ESLE = (s, tt) => tt === "İş problemleri" ? "İş Problemleri" : tt;   // KONU_ESLE'nin sentetik karşılığı
function kat(ayar = {}) { const cagri = []; const K = { async yukle(o) { cagri.push(o); if (ayar.hata) return { ok: false, durum: ayar.hata, mesaj: "x", sorular: [] }; const liste = ayar.sorular || SORULAR; return Object.freeze({ ok: true, durum: "tamam", sorular: Object.freeze(liste.map(q => Object.freeze({ ...q }))), bayrak: ayar.bayrak || "hazir", bayrakHazir: (ayar.bayrak || "hazir") === "hazir", sayim: { toplam: liste.length, os: liste.filter(q => q.os).length, fix: liste.filter(q => q.fix).length, sayfa: 1 } }); } }; return { K, cagri }; }
function kurH(katObj, { bayrak = true, arama = "", fqv = true } = {}) {
  const tuzak = ad => new Proxy({}, { get() { throw new Error("YASAK KULLANIM: " + ad); }, set() { throw new Error("YASAK KULLANIM: " + ad); } });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])), fq = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const f = new Function("KAT", "window", "location", "KONU_ESLE", "esc", "fq", "localStorage", "sessionStorage", "indexedDB", "LS", "BANK", "EKQ", "allQ", "fetch", HB + "\nreturn KHAVUZ;");
  return f(katObj, bayrak ? { AKE_KATALOG_HAVUZ: true } : {}, { search: arama }, tuzak("KONU_ESLE"), esc, fqv ? fq : undefined, tuzak("localStorage"), tuzak("sessionStorage"), tuzak("indexedDB"), tuzak("LS"), tuzak("BANK"), tuzak("EKQ"), tuzak("allQ"), () => { throw new Error("YASAK AĞ"); });
}
/* eski sistem: gerçek kaynak, sentetik BANK (konular eski gibi ESLE'li) */
function kurEski(bank, S, UI = { bank: {} }) {
  const f = new Function("BANK", "EKQ", "S", "UI", "GENS", "shuffle", "pick", "genQ", "gensOf0", "SUBJ", `const allQ = () => BANK.concat(EKQ, S.aiQs); function gensOf(){return []}\n${ESKI_KOD}\nreturn { poolOf, buildSet, topicsOf, bankFiltered, osymElle };`);
  return f(bank, [], S, UI, [], a => a, a => a[0], () => null, null, { mat: { n: "Mat" }, turkce: { n: "Tr" }, fizik: { n: "Fiz" } });
}
const eskiBank = SORULAR.map(q => ({ ...q, t: ESLE(q.s, q.t) }));
const ids = a => a.map(q => q.id).sort().join(","), hasSet = x => ids(x);
const S0 = () => ({ reports: { syn0004: 1, syn0010: 1 }, ans: { syn0001: [1, 0, 0, 500, 1], syn0002: [0, 1, 0, 100, 0], syn0003: [1, 0, 0, 300, 1], syn0100: [0, 1, 0, 50, 0] }, aiQs: [] });

/* 1) bayrak KAPALI */
{ const { K, cagri } = kat(); const H = kurH(K, { bayrak: false }); const r = await H.yukle(); t("1 bayrak KAPALI: KAT bile çağrılmaz, durum 'kapali_bayrak', havuz yok", cagri.length === 0 && r.ok === false && r.durum === "kapali_bayrak" && H.poolOf("mat").ok === false && H.acik() === false); }
{ const { K } = kat(), H = kurH(K, { bayrak: false, arama: "?x=1&katalogHavuz=1" }); t("1b ?katalogHavuz=1 açar; '=10' açmaz", H.acik() === true && kurH(K, { bayrak: false, arama: "?katalogHavuz=10" }).acik() === false); }
/* 2) yükleme + sayı guard'ı */
{ const { K, cagri } = kat(), H = kurH(K); const r = await H.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); t("2 yükleme: hazır, toplam/os/fix doğru, KAT'a beklenenToplam iletildi", r.ok && r.toplam === TOP && r.os === OS && r.fix === FIX && r.bayrakHazir === true && cagri[0].beklenenToplam === TOP, JSON.stringify(r));
  const r2 = await H.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); t("2b hazırken ikinci çağrı yeniden KAT çağırmaz", r2.ok && cagri.length === 1); }
{ const { K } = kat({ sorular: SORULAR.slice(0, TOP - 1) }), H = kurH(K); const r = await H.yukle({ beklenenToplam: TOP }); t("3 eksik katalog (önbellekten dönse bile): durur, havuz boş, BANK'a düşmez", r.ok === false && r.durum === "eksik_katalog" && H.poolOf("mat").durum === "hazir_degil" && H.durumu().toplam === 0, JSON.stringify(r)); }
{ const { K } = kat({ sorular: SORULAR.concat([{ ...SORULAR[0], id: "syn9999" }]) }), H = kurH(K); t("3b fazla soru da durdurur", (await H.yukle({ beklenenToplam: TOP })).durum === "eksik_katalog"); }
{ const { K } = kat(), H = kurH(K); t("3c varsayılan beklenen 1127: 300'lük sentetik katalog durdurulur", (await H.yukle()).durum === "eksik_katalog"); }
for (const d of ["giris_gerekli", "cok_istek", "sunucu_hatasi", "ag_hatasi", "sizinti", "kapali_bayrak", "bozuk_yanit"]) { const { K } = kat({ hata: d }), H = kurH(K); const r = await H.yukle({ beklenenToplam: TOP }); t(`4 KAT '${d}' → havuz kurulmaz, durum aynen iletilir, sorgular hazir_degil`, r.ok === false && r.durum === d && H.poolOf("mat").ok === false && H.bankFiltered({}).ok === false && H.topicsOf("mat").ok === false && H.osymElle("mat").ok === false && H.fixMi(SORULAR[0]) === null && H.sayilar().ok === false); }
{ const k = { async yukle() { throw new Error("patladı"); } }, H = kurH(k); const r = await H.yukle({ beklenenToplam: TOP }); t("4b KAT istisna fırlatırsa kapanır (beklenmeyen_hata)", r.ok === false && r.durum === "beklenmeyen_hata"); }
{ let say = 0; const ilk = kat().K, k = { async yukle(o) { say++; return say === 1 ? ilk.yukle(o) : { ok: false, durum: "ag_hatasi", mesaj: "x", sorular: [] }; } }, H = kurH(k); const r1 = await H.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); const r2 = await H.yukle({ yenile: true, beklenenToplam: TOP });
  t("4c başarılı yüklemeden sonra yenile başarısız olursa havuz BOŞALIR (eski veri kalmaz)", r1.ok && r2.ok === false && r2.durum === "ag_hatasi" && H.poolOf("mat").ok === false && H.durumu().toplam === 0, JSON.stringify(r2)); }
{ const { K } = kat({ sorular: SORULAR.map((q, i) => i === 5 ? { ...q, a: 2 } : q) }), H = kurH(K); const r = await H.yukle({ beklenenToplam: TOP }); t("5 a alanı görülürse kurulmaz (sizinti)", r.ok === false && r.durum === "sizinti" && !/"a"/.test(JSON.stringify(r))); }
{ const { K } = kat({ sorular: SORULAR.map((q, i) => i === 5 ? { ...q, x: "SIRRI" } : q) }), H = kurH(K); const r = await H.yukle({ beklenenToplam: TOP }); t("5b x alanı da; çıktıda sır yok", r.durum === "sizinti" && !/SIRRI/.test(JSON.stringify(r))); }
{ const { K } = kat({ sorular: SORULAR.map((q, i) => i === 5 ? { ...q, cozum: "s" } : q) }), H = kurH(K); t("5c 'cozum' alanı da", (await H.yukle({ beklenenToplam: TOP })).durum === "sizinti"); }
{ const { K } = kat(), H = kurH(K); const r = await H.yukle({ beklenenToplam: TOP, beklenenOs: OS + 1, beklenenFix: FIX }); t("6 os sayısı uyuşmazsa durur", r.ok === false && r.durum === "bayrak_sayim_uyusmuyor"); }
{ const { K } = kat(), H = kurH(K); t("6b fix sayısı uyuşmazsa durur", (await H.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX - 1 })).durum === "bayrak_sayim_uyusmuyor"); }
/* 7) bayrak 'eksik' */
{ const { K } = kat({ bayrak: "eksik", sorular: SORULAR.map(q => { const { os, fix, ...r } = q; return r; }) }), H = kurH(K); const r = await H.yukle({ beklenenToplam: TOP });
  t("7 bayrak eksik: filtreler çalışır, osymElle/fixMi DURUR", r.ok && r.bayrakHazir === false && H.poolOf("mat").ok && H.osymElle("mat").durum === "bayrak_hazir_degil" && H.osymElle("mat").ok === false && H.fixMi(SORULAR[0]) === null); }
/* 8) eski/yeni havuz karşılaştırması */
const { K } = kat(), H = kurH(K); await H.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX });
{ let say = 0, fark = [];
  for (const ctxS of [S0(), { reports: {}, ans: {}, aiQs: [] }]) { const E = kurEski(eskiBank, ctxS), c = { reports: ctxS.reports, ans: ctxS.ans };
    for (const s of [...DERS, "yok"]) for (const topic of [undefined, "Konu A", "Konu B", "Çok Özel", "İş Problemleri", "İş problemleri", "Yok"]) for (const diff of [undefined, 1, 2, 3]) for (const src of [undefined, "ai", "x"]) {
      say++; const o = { topic, diff, src }, e = E.poolOf(s, o), y = H.poolOf(s, o, c).sorular;
      if (hasSet(e) !== hasSet(y)) fark.push(JSON.stringify([s, o])); } }
  t(`8 poolOf: eski ≡ yeni (${say} bileşim: ders × konu × zorluk × src × rapor)`, say > 300 && fark.length === 0, fark.slice(0, 3).join(" | ")); }
{ const S = S0(), E = kurEski(eskiBank, S), c = { reports: S.reports, ans: S.ans }; let say = 0, fark = [];
  for (const s of DERS) for (const diff of [undefined, 2]) { const n = 999, e = E.buildSet([[s, n]], { diff }).qs.filter(q => q && q.id), L = H.secimListeleri(s, { diff }, c, a => a.slice()); say++;
    if (hasSet(e) !== hasSet([...L.taze, ...L.eski])) fark.push(s + diff);
    const nTaze = L.taze.length, e2 = E.buildSet([[s, nTaze]], { diff }).qs; if (hasSet(e2) !== hasSet(L.taze)) fark.push("taze" + s + diff);
    const eskiSira = L.eski.map(q => S.ans[q.id][3]); if (eskiSira.some((v, i) => i && eskiSira[i - 1] > v)) fark.push("sira" + s); }
  t(`9 buildSet: eski ≡ yeni (taze/eski ayrımı ve eski soruların zaman sırası) (${say} bileşim)`, fark.length === 0 && H.secimListeleri("mat", {}, { reports: {}, ans: { syn0003: [1, 0, 0, 9, 1], syn0000: [1, 0, 0, 3, 1] } }, a => a.slice()).eski.map(q => q.id).slice(0, 2).join() === "syn0000,syn0003", fark.join()); }
{ let fark = []; const E = kurEski(eskiBank, S0()); for (const s of [...DERS, "yok"]) { const e = E.topicsOf(s).map(x => x.t + ":" + x.n).join("|"), y = H.topicsOf(s).konular.map(x => x.t + ":" + x.n).join("|"); if (e !== y) fark.push(s + " " + e + " ≠ " + y); }
  t("10 topicsOf: eski ≡ yeni (konu adı, sayı, tr sıralaması)", fark.length === 0, fark.join(" ; ")); }
{ let say = 0, fark = []; for (const S of [S0(), { reports: {}, ans: {}, aiQs: [] }]) { const c = { reports: S.reports, ans: S.ans };
    for (const s of [undefined, "mat", "fizik"]) for (const tt of [undefined, "Konu A", "İş Problemleri"]) for (const d of [undefined, 3]) for (const src of [undefined, "ai"]) for (const st of [undefined, "new", "wrong", "ok"]) for (const q of ["", "istanbul", "İSTANBUL", "ışık", "IŞIK", "yokyok", " konu a "]) {
      say++; const B = { s, t: tt, d, src, st, q }, E = kurEski(eskiBank, S, { bank: B }); if (hasSet(E.bankFiltered()) !== hasSet(H.bankFiltered(B, c).sorular)) fark.push(JSON.stringify(B)); } }
  t(`11 bankFiltered: eski ≡ yeni (${say} bileşim; durum süzgeci ve tr-yerel büyük/küçük harf aramasıyla)`, say > 1000 && fark.length === 0, fark.slice(0, 3).join(" | ")); }
{ let fark = []; for (const S of [S0(), { reports: {}, ans: {}, aiQs: [] }]) { const E = kurEski(eskiBank, S); for (const s of DERS) if (hasSet(E.osymElle(s)) !== hasSet(H.osymElle(s, { reports: S.reports }).sorular)) fark.push(s); }
  t("12 osymElle: eski ≡ yeni (raporlananlar dışlanır)", fark.length === 0 && H.osymElle("mat").sorular.length > 0 && H.osymElle("mat", { reports: { [H.osymElle("mat").sorular[0].id]: 1 } }).sorular.length === H.osymElle("mat").sorular.length - 1); }
/* 13) farklar: normalizasyon */
{ const ham = H.poolOf("mat", {}).sorular.filter(q => q.tHam === "İş problemleri"), ham2 = SORULAR.filter(q => q.t === "İş problemleri");
  t("13 konu normalizasyonu: ham 'İş problemleri' → 'İş Problemleri', tHam saklı; ham kaynak değişmedi", ham.length > 0 && ham.every(q => q.t === "İş Problemleri") && ham2.length > 0, ham.length);
  /* olumsuz kontrol: eski havuz HAM (eşlenmemiş) konularla kurulsaydı topicsOf farkı çıkardı → karşılaştırma duyarlı */
  const E = kurEski(SORULAR.map(q => ({ ...q })), S0()); t("13b olumsuz kontrol: eşlenmemiş eski havuz, adaptörün konu listesinden SAPAR (test duyarlı)", E.topicsOf("mat").map(x => x.t).join() !== H.topicsOf("mat").konular.map(x => x.t).join()); }
{ const { K } = kat(), Hx = kurH(K); await Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); const kopya = JSON.stringify(SORULAR); const p = Hx.poolOf("mat").sorular; t("14 havuz dondurulmuş; ham sentetik katalog normalizasyondan etkilenmedi", Object.isFrozen(p[0]) && JSON.stringify(SORULAR) === kopya && !SORULAR.some(q => "tHam" in q)); }
{ let hata = null; try { "use strict"; const p = H.poolOf("mat").sorular; p[0].t = "x"; hata = p[0].t === "x" ? "yazıldı" : null; } catch (e) { hata = null; } t("14b havuz öğesi yazılamaz", hata === null); }
/* 15) fixMi / sayilar */
{ const f = SORULAR.find(q => q.fix), nf = SORULAR.find(q => !q.fix); t("15 fixMi: bayrak hazırken true/false", H.fixMi(f) === true && H.fixMi(nf) === false); const s = H.sayilar(); t("15b sayilar: toplam ve ders dağılımı", s.toplam === TOP && Object.values(s.dersler).reduce((a, b) => a + b, 0) === TOP); }
/* 16) tek uçuş */
{ let say = 0; const k = { async yukle(o) { say++; await new Promise(r => setTimeout(r, 20)); return kat().K.yukle(o); } }, Hy = kurH(k); const [a, b] = await Promise.all([Hy.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }), Hy.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX })]); t("16 eşzamanlı iki yükleme tek KAT çağrısı yapar", say === 1 && a.ok && b.ok); }
/* 17) güvenli gösterim */
{ const kk = { id: "<i>1", t: "T<script>", q: "**kalın** <img src=x onerror=alert(1)>", p: "P&\"", o: ["<b>", "**x**", "c", "d", "e"] }, g = H.kacisli(kk);
  t("17 kacisli: HTML kaçışlı (ham '<' yok), fq biçimlemesi korunur", g && !/<(?!\/?b>)/.test(g.q + g.p + g.o.join("") + g.t + g.id) && /<b>kalın<\/b>/.test(g.q) && g.q.includes("&lt;img") && g.o[0] === "&lt;b&gt;");
  t("17b fq/esc yoksa HAM metin döndürülmez (null)", kurH(kat().K, { fqv: false }).kacisli(kk) !== undefined && (() => { const tuzak0 = new Proxy({}, { get() { throw new Error("YASAK KULLANIM"); } }); const f = new Function("KAT", "window", "location", "KONU_ESLE", HB + "\nreturn KHAVUZ;"); const x = f(kat().K, {}, { search: "" }, tuzak0); return x.kacisli(kk) === null; })()); }

/* 20) AÇIK İZİN LİSTESİ: bilinmeyen alan reddi */
for (const [ad, ek, beklenen] of [["ipucu", { ipucu: "x" }, "bilinmeyen_alan"], ["aciklama", { aciklama: "x" }, "bilinmeyen_alan"], ["tHam (adaptörün kendi alanı dışarıdan gelemez)", { tHam: "x" }, "bilinmeyen_alan"], ["src", { src: "ai" }, "bilinmeyen_alan"], ["a (cevap)", { a: 1 }, "sizinti"]]) {
  const { K } = kat({ sorular: SORULAR.map((q, i) => i === 7 ? Object.assign({ ...q }, ek) : q) }), Hx = kurH(K); const r = await Hx.yukle({ beklenenToplam: TOP });
  t(`20 bilinmeyen alan '${ad}' → havuz kurulmaz (${beklenen})`, r.ok === false && r.durum === beklenen && Hx.poolOf("mat").ok === false && Hx.durumu().toplam === 0, JSON.stringify(r)); }
for (const [ad, deg] of [["o dizi değil", q => ({ ...q, o: "ABCDE" })], ["o içinde sayı", q => ({ ...q, o: [1, 2, 3, 4, 5] })], ["d metin", q => ({ ...q, d: "2" })], ["os=2", q => ({ ...q, os: 2 })], ["fix=true", q => ({ ...q, fix: true })], ["p sayı", q => ({ ...q, p: 5 })], ["boş id", q => ({ ...q, id: "" })], ["boş konu", q => ({ ...q, t: "  " })]]) {
  const { K } = kat({ sorular: SORULAR.map((q, i) => i === 7 ? deg(q) : q) }), Hx = kurH(K); const r = await Hx.yukle({ beklenenToplam: TOP }); t(`20b bozuk şekil '${ad}' → bozuk_soru, havuz yok`, r.ok === false && r.durum === "bozuk_soru" && Hx.poolOf("mat").ok === false, JSON.stringify(r)); }
{ const { K } = kat({ sorular: SORULAR.map((q, i) => i === 7 ? JSON.parse(JSON.stringify(q).replace(/^\{/, '{"__proto__":{"a":1},')) : q) }), Hx = kurH(K); const r = await Hx.yukle({ beklenenToplam: TOP }); t("20e JSON'dan gelen sahip '__proto__' anahtarı reddedilir", r.ok === false && r.durum === "bilinmeyen_alan", JSON.stringify(r)); }
{ const K = { async yukle() { return { ok: true, durum: "tamam", sorular: SORULAR.map((q, i) => i === 7 ? null : q), bayrakHazir: true, sayim: { os: OS, fix: FIX } }; } }, Hx = kurH(K); const r = await Hx.yukle({ beklenenToplam: TOP }); t("20f soru yerine null → bozuk_soru", r.durum === "bozuk_soru" && Hx.poolOf("mat").ok === false, JSON.stringify(r)); }
{ const IZIN = ["id", "s", "t", "d", "p", "q", "o", "os", "fix", "tHam"]; const l = H.poolOf("mat").sorular.concat(H.poolOf("turkce").sorular, H.poolOf("fizik").sorular); t("20c havuz öğeleri YALNIZ izin listesi + tHam alanlarını taşır", l.length === TOP && l.every(q => Object.keys(q).every(k => IZIN.includes(k)) && q.tHam === SORULAR.find(x => x.id === q.id).t && Object.isFrozen(q.o))); }
{ const kaynak = SORULAR.map(q => ({ ...q })), { K } = kat({ sorular: kaynak }), Hx = kurH(K); await Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); const p = Hx.poolOf("mat").sorular[0]; t("20d havuz öğesi, kaynak katalog nesnesini PAYLAŞMAZ (kopya)", kaynak.every(q => q !== p) && p.o !== kaynak.find(q => q.id === p.id).o); }

/* 21) asenkron nesil denetimi: temizle() ve geç biten istekler */
const gecik = ayar => { let coz; const bek = new Promise(r => { coz = r; }); const ic = kat(ayar).K; return { K: { async yukle(o) { const s = await ic.yukle(o); await bek; return s; } }, coz }; };
{ const g = gecik(), Hx = kurH(g.K); const p = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); await Promise.resolve(); t("21 yükleme sürerken durum 'yukleniyor'", Hx.durumu().durum === "yukleniyor");
  Hx.temizle(); t("21a temizle() yüklemeyi hemen iptal eder: durum 'bos', havuz yok", Hx.durumu().durum === "bos" && Hx.poolOf("mat").ok === false);
  g.coz(); const r = await p; t("21b temizle()'den sonra biten ESKİ istek havuzu YENİDEN KURAMAZ ('iptal')", r.ok === false && r.durum === "iptal" && Hx.durumu().durum === "bos" && Hx.poolOf("mat").ok === false && Hx.durumu().toplam === 0, JSON.stringify(r)); }
{ /* eski istek, yeni yükleme bittikten SONRA biter */
  const g1 = gecik({ sorular: SORULAR.map(q => ({ ...q, t: "ESKI-" + q.t })) }), say = { n: 0 }; const K = { async yukle(o) { say.n++; return say.n === 1 ? g1.K.yukle(o) : kat().K.yukle(o); } }, Hx = kurH(K);
  const p1 = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); await Promise.resolve(); Hx.temizle(); const r2 = await Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX });
  t("21c temizle()'den sonra yeni yükleme bağımsız tamamlanır", r2.ok === true && Hx.poolOf("mat").ok === true && say.n === 2);
  g1.coz(); const r1 = await p1; const t1 = Hx.poolOf("mat").sorular.map(q => q.t);
  t("21d yeni havuz kurulduktan sonra eski isteğin GEÇ tamamlanması yeni havuzu EZMEZ, 'iptal' döner", r1.durum === "iptal" && Hx.durumu().ok === true && t1.length > 0 && t1.every(x => !x.startsWith("ESKI-")), JSON.stringify([r1.durum, t1.slice(0, 2)])); }
{ /* eski isteğin geç HATASI yeni sağlıklı havuzu kapatmaz */
  let coz; const bek = new Promise(r => { coz = r; }), say = { n: 0 }; const K = { async yukle(o) { say.n++; if (say.n === 1) { await bek; return { ok: false, durum: "ag_hatasi", mesaj: "x", sorular: [] }; } return kat().K.yukle(o); } }, Hx = kurH(K);
  const p1 = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); await Promise.resolve(); Hx.temizle(); await Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); coz(); const r1 = await p1;
  t("21e eski isteğin geç HATASI yeni sağlıklı havuzu kapatmaz", r1.durum === "iptal" && Hx.durumu().ok === true && Hx.durumu().durum === "hazir"); }
{ /* eski istek ISTISNA ile biterse de */
  let ret; const bek = new Promise((_, r) => { ret = r; }), say = { n: 0 }; const K = { async yukle(o) { say.n++; if (say.n === 1) await bek; return kat().K.yukle(o); } }, Hx = kurH(K);
  const p1 = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); await Promise.resolve(); Hx.temizle(); await Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); ret(new Error("geç hata")); const r1 = await p1;
  t("21f eski isteğin geç İSTİSNASI da yeni havuza dokunmaz", r1.durum === "iptal" && Hx.durumu().ok === true); }
{ /* eşzamanlı yeni yüklemeler tek uçuş; eski iş bekleyen kaydını SİLEMEZ */
  const gs = [gecik(), gecik()], say = { n: 0 }; const K = { async yukle(o) { const g = gs[say.n++]; return g.K.yukle(o); } }, Hx = kurH(K);
  const p1 = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); await Promise.resolve(); Hx.temizle();
  const p2 = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }), p3 = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); await Promise.resolve();
  gs[0].coz(); const r1 = await p1; t("21g eski iş bitti: yeni yükleme hâlâ sürüyor, havuz yok", r1.durum === "iptal" && Hx.durumu().durum === "yukleniyor" && Hx.poolOf("mat").ok === false);
  const p4 = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); t("21h eski iş bittikten sonra da yeni çağrılar AYNI bekleyen işe katılır (tek KAT çağrısı daha yok)", say.n === 2 && p4 === p2 && p3 === p2);
  gs[1].coz(); const [a2, a3, a4] = await Promise.all([p2, p3, p4]); t("21i eşzamanlı yeni yüklemelerin hepsi aynı sağlıklı sonucu alır", a2.ok && a3.ok && a4.ok && Hx.durumu().durum === "hazir" && say.n === 2); }
{ const { K } = kat(), Hx = kurH(K); await Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); Hx.temizle(); t("21j hazır havuzda temizle(): havuz boşalır, sorgular hazir_degil", Hx.durumu().durum === "bos" && Hx.poolOf("mat").ok === false && Hx.osymElle("mat").ok === false);
  const r = await Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); t("21k temizle()'den sonra yeniden yükleme çalışır", r.ok === true && Hx.poolOf("mat").ok); }
{ const g = gecik(), Hx = kurH(g.K); const p = Hx.yukle({ beklenenToplam: TOP, beklenenOs: OS, beklenenFix: FIX }); await Promise.resolve(); Hx.temizle(); Hx.temizle(); g.coz(); const r = await p; t("21l arka arkaya temizle() güvenli", r.durum === "iptal" && Hx.durumu().durum === "bos"); }

/* 22) konu eşlemesi: KONU_ESLE'den bağımsız, deterministik, yan etkisiz */
const kesGercek = () => { const a = html.indexOf("var KONU_ESLE = (function () {"), b = html.indexOf("\n})();", a); return html.slice(a, b + 6); };
const gercekKurucu = () => new Function(kesGercek() + "\nreturn KONU_ESLE;")();
const tohum = n => { let x = n; return () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296; };
const karis = (a, r) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const EZEL = ["İş problemleri", "İş Problemleri", "Anlatım bozukluğu", "Anlatım Bozuklukları", "Osmanlı tarihi", "Osmanlı Tarihi", "Paragraf · Ana fikir", "Paragraf", "Oran orantı", "Oran-orantı", "Ses bilgisi", "Konu A", "KONU A", "konu a", "Çok Özel", "Mantık · alt başlık", "mantık", "constructor", "__proto__", "toString", "Tie ab", "tie Ab"];
const ornek = konular => konular.map((tt, i) => ({ id: "e" + String(i).padStart(4, "0"), s: i % 2 ? "mat" : "turkce", t: tt, d: 1, q: "s" + i, o: ["A", "B", "C", "D", "E"] }));
async function eslemeAl(sorular, hepsi = true) { const k = { async yukle() { return Object.freeze({ ok: true, durum: "tamam", sorular: Object.freeze(sorular.map(q => Object.freeze({ ...q }))), bayrak: "hazir", bayrakHazir: true, sayim: { toplam: sorular.length, os: 0, fix: 0, sayfa: 1 } }); } }, Hx = kurH(k); const r = await Hx.yukle({ beklenenToplam: sorular.length, beklenenOs: 0, beklenenFix: 0 }); if (!r.ok) return { hata: r }; const m = {}; for (const s of ["mat", "turkce"]) Hx.poolOf(s).sorular.forEach(q => { m[q.id] = q.t; }); return m; }
{ const taban = ornek(EZEL.concat(EZEL)), m0 = await eslemeAl(taban); let ayni = true; for (let k = 1; k <= 12; k++) { const kar = karis(taban, tohum(k)), m = await eslemeAl(kar); if (kar.some(q => m[q.id] !== m0[q.id])) ayni = false; }
  t("22 konu eşlemesi KAYIT SIRASINDAN bağımsız (12 farklı karıştırma, aynı sonuç)", !m0.hata && ayni, JSON.stringify(m0.hata || "")); }
{ const taban = ornek(EZEL), a = await eslemeAl(taban), b = await eslemeAl(taban); t("22b tekrar çağrıda aynı sonuç (durum sızıntısı yok)", JSON.stringify(a) === JSON.stringify(b)); }
{ const m = await eslemeAl(ornek(["İş problemleri", "İş Problemleri"]).map(q => ({ ...q, s: "mat" }))); const r = ornek(["İş Problemleri", "İş problemleri"]).map(q => ({ ...q, s: "mat" })), m2 = await eslemeAl(r);
  t("22c bilinen matematik çifti: iki yazım da, hangi sırayla gelirse gelsin, 'İş Problemleri' olur", Object.values(m).every(x => x === "İş Problemleri") && Object.values(m2).every(x => x === "İş Problemleri")); }
{ const m = await eslemeAl(ornek(["constructor", "__proto__", "toString", "hasOwnProperty"])); t("22d prototip adlı konular düz metin kalır (tablo araması güvenli; eski KONU_ESLE bunlarda hata fırlatırdı)", ["constructor", "__proto__", "toString", "hasOwnProperty"].every((ad, i) => m["e000" + i] === ad), JSON.stringify(m)); }
{ /* gerçek KONU_ESLE ile eşitlik: tablo + sonuç */
  const a = html.indexOf("var KONU_ESLE = (function () {\n  const M = ") + "var KONU_ESLE = (function () {\n  const M = ".length, b = html.indexOf("\n};", a) + 2; const M = new Function("return " + html.slice(a, b))();
  const Hk = kurH(kat().K); t("22e HARITA, KONU_ESLE tablosunun BİREBİR kopyası (kayma/sürüklenme denetimi)", JSON.stringify(Hk.haritaKopya()) === JSON.stringify(M) && Object.keys(M["*"]).length > 20); }
{ const konular = []; const M = kurH(kat().K).haritaKopya(); Object.keys(M["*"]).forEach(k => { konular.push(k, M["*"][k]); }); konular.push(...EZEL.filter(x => !["constructor", "__proto__", "toString", "Tie ab", "tie Ab"].includes(x)), "ÇOK ÖZEL", "çok özel");   // eşitlik (aynı büyük harf sayısı) durumu bilerek ayrı sınanır: eski kod ilk görüleni seçer (sıra/durum bağımlı), KHAVUZ tr sıralamasıyla ilkini
  const taban = ornek(konular), G = gercekKurucu(); const gercek = {}; taban.forEach(q => { G(q.s, q.t); }); taban.forEach(q => { G(q.s, q.t); }); taban.forEach(q => { gercek[q.id] = G(q.s, q.t); });   // sayfadaki gibi iki geçiş
  const m = await eslemeAl(taban); const fark = taban.filter(q => gercek[q.id] !== m[q.id]);
  t(`22f gerçek KONU_ESLE ile aynı sonuç (${taban.length} konu girdisi; tablo girdileri, büyük/küçük harf varyantları, '·' ve Paragraf dahil)`, taban.length > 60 && fark.length === 0, fark.slice(0, 3).map(q => q.t + " → " + gercek[q.id] + " ≠ " + m[q.id]).join(" ; ")); }
{ /* yan etki yok: gerçek KONU_ESLE örneği KHAVUZ'dan etkilenmez ve KHAVUZ onu çağırmaz (tuzak) */
  const G1 = gercekKurucu(), G2 = gercekKurucu(); G1("mat", "İŞ PROBLEMLERİ"); G2("mat", "İŞ PROBLEMLERİ"); await eslemeAl(ornek(["İş problemleri", "İş Problemleri", "iş problemleri"]));
  t("22g KHAVUZ yüklemesi gerçek KONU_ESLE'nin ortak durumunu DEĞİŞTİRMEZ", G1("mat", "iş problemleri") === G2("mat", "iş problemleri") && G1("mat", "İş problemleri") === G2("mat", "İş problemleri")); }
{ /* KHAVUZ'un sonucu, KONU_ESLE'nin önceden kirletilmiş durumundan bağımsız */
  const a = await eslemeAl(ornek(["iş problemleri", "İş problemleri"])); const G = gercekKurucu(); G("mat", "İŞ PROBLEMLERİ"); const b = await eslemeAl(ornek(["iş problemleri", "İş problemleri"])); t("22h sonuç, sayfadaki KONU_ESLE durumundan bağımsız", JSON.stringify(a) === JSON.stringify(b)); }
{ const A = ornek(["Tie ab", "tie Ab"]).map(q => ({ ...q, s: "mat" })), a = await eslemeAl(A), b = await eslemeAl(A.slice().reverse());
  const G1 = gercekKurucu(), G2 = gercekKurucu(); const g1 = ["Tie ab", "tie Ab"].map(x => G1("mat", x)), g2 = ["tie Ab", "Tie ab"].map(x => G2("mat", x));
  t("22i eşit büyük harf sayısında KHAVUZ sıradan bağımsız (aynı kanonik yazım); eski KONU_ESLE ise sıraya bağlıdır (bilinen, belgelenmiş fark)", new Set(Object.values(a)).size === 1 && a.e0000 === b.e0000 && a.e0001 === b.e0001 && g1[0] !== g2[0], JSON.stringify([a, g1, g2])); }
/* 18) statik tarama: bloğun kodunda yasak adlar yok */
{ const kod = HB.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/"(?:[^"\\]|\\.)*"/g, '""'); const yasak = ["BANK", "EKQ", "allQ", "localStorage", "sessionStorage", "indexedDB", "LS\\.", "fetch", "/sorular", "api/sorular", "XMLHttpRequest", "innerHTML", "S\\.reports", "S\\.ans", "S\\.aiQs", "\\bS\\b", "KONU_ESLE"];
  const bulunan = yasak.filter(y => new RegExp(y).test(kod)); t("18 blok kodu BANK/EKQ/allQ/KONU_ESLE/depolama/fetch/eski kaynak/innerHTML/global S İÇERMEZ", bulunan.length === 0, bulunan.join()); }
{ const kod = HB.replace(/\/\*[\s\S]*?\*\//g, ""); t("18b blok yalnız KAT.yukle/KAT.temizle çağırır (başka KAT.* yok) ve a/x anahtarlarını okumaz", (kod.match(/KAT\.(\w+)/g) || []).every(x => x === "KAT.yukle" || x === "KAT.temizle") && !/q\.(a|x|h)\b/.test(kod)); }
{ const bas = html.lastIndexOf("/* =====", html.indexOf("[KHAVUZ-BASLA]")), bitM = "/* [KHAVUZ-BITIR] */", oncesi = html.slice(0, bas), sonrasi = html.slice(html.indexOf(bitM) + bitM.length); const uyg = (oncesi + sonrasi).match(/KHAVUZ/g) || []; t("19 KHAVUZ başka hiçbir yerden çağrılmıyor (ekranlara bağlı DEĞİL)", uyg.length === 0, uyg.length); }
console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
