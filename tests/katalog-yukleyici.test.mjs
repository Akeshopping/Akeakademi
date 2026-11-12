// B4 Aşama 3B · güvenli katalog yükleyici (index.html içindeki KAT bloğu) BİRİM testleri. Sentetik veri; ağ YOK (sahte fetch); gerçek kullanıcı verisi YOK.
// Blok index.html'den işaretçilerle çıkarılır (tek doğruluk kaynağı) ve BANK/depolama OLMAYAN izole bir kapsamda çalıştırılır:
// blok BANK'a ya da localStorage/sessionStorage/indexedDB'ye dokunursa test patlar. Çalıştırma: node tests/katalog-yukleyici.test.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"), "utf8");
const bas = html.lastIndexOf("/* =====", html.indexOf("[KAT-BASLA]")), bit = html.indexOf("/* [KAT-BITIR] */");
if (bas < 0 || bit < 0 || bit < bas) { console.error("KAT bloğu index.html'de bulunamadı"); process.exit(1); }
const BLOK = html.slice(bas, bit);
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 300)); };

/* ---- sentetik katalog: 1127 soru, 52 os + 37 fix (kesişmez); gizli cevap/çözüm yalnız "sunucuda" ---- */
const N = 1127, GIZLI = new Map(), SORULAR = [];
for (let i = 0; i < N; i++) {
  const id = "syn" + String(i).padStart(4, "0"), q = { id, s: ["mat", "turkce", "fizik"][i % 3], t: "Konu " + (i % 7), d: 1 + (i % 3), q: "Sentetik soru " + i, o: ["A" + i, "B" + i, "C" + i, "D" + i, "E" + i] };
  if (i % 21 === 0 && i / 21 < 52) q.os = 1;           // 52 os
  else if (i % 30 === 1 && Math.floor(i / 30) < 37) q.fix = 1;   // 37 fix
  if (i % 50 === 2) q.p = "Sentetik paragraf " + i;
  SORULAR.push(q); GIZLI.set(id, { a: i % 5, x: "SIRRI-COZUM-" + i });
}
const OS = SORULAR.filter(q => q.os).length, FIX = SORULAR.filter(q => q.fix).length;

const yanit = (durum, govde, baslik = {}) => ({ status: durum, ok: durum >= 200 && durum < 300, headers: { get: k => baslik[String(k).toLowerCase()] ?? null }, json: async () => { if (govde === "BOZUK") throw new SyntaxError("x"); return govde; } });
/* sahte sunucu: katalog'un gerçek keyset davranışı. ayar: { bayrak, sorular, degistir(sayfaNo, govde) , durum } */
function sunucu(ayar = {}) {
  const cagrilar = []; let sayfaNo = 0; const liste = ayar.sorular || SORULAR;
  const fetch = async (yol, init = {}) => {
    cagrilar.push({ yol, init });
    const u = new URL(yol, "https://site.test");
    if (u.pathname !== "/api/soru/katalog") return yanit(404, {});
    for (const k of u.searchParams.keys()) if (k !== "limit" && k !== "sonra") return yanit(400, { error: "bilinmeyen_parametre" });
    if (ayar.durum) { const d = typeof ayar.durum === "function" ? ayar.durum(sayfaNo) : ayar.durum; if (d) { sayfaNo++; return d; } }
    const limit = +u.searchParams.get("limit"), sonra = u.searchParams.get("sonra");
    const kalanlar = liste.filter(q => sonra === null || q.id > sonra), devam = kalanlar.length > limit, sayfa = devam ? kalanlar.slice(0, limit) : kalanlar;
    let govde = { n: sayfa.length, bayrak: ayar.bayrak || "hazir", sorular: sayfa.map(q => ({ ...q, o: q.o.slice() })), sonraki: devam ? sayfa[sayfa.length - 1].id : null };
    if (ayar.degistir) govde = ayar.degistir(sayfaNo, govde) || govde;
    sayfaNo++; return yanit(200, govde);
  };
  return { fetch, cagrilar };
}
function kur(fetch, { bayrak = true, arama = "" } = {}) {
  const tuzak = ad => new Proxy({}, { get() { throw new Error("YASAK DEPOLAMA KULLANIMI: " + ad); }, set() { throw new Error("YASAK DEPOLAMA KULLANIMI: " + ad); } });
  const win = bayrak ? { AKE_KATALOG: true } : {}, loc = { search: arama };
  const f = new Function("fetch", "window", "location", "localStorage", "sessionStorage", "indexedDB", "LS", BLOK + "\nreturn KAT;");
  return f(fetch, win, loc, tuzak("localStorage"), tuzak("sessionStorage"), tuzak("indexedDB"), tuzak("LS"));
}
const dizge = o => JSON.stringify(o);
const sizdirdiMi = s => /SIRRI|"a"\s*:|"x"\s*:|"govde"|"rk"|"kopya_of"/.test(dizge(s));

/* 1) BAYRAK KAPALI: hiçbir istek yok */
{ const s = sunucu(), K = kur(s.fetch, { bayrak: false }); const r = await K.yukle();
  t("1 bayrak KAPALIYKEN hiç istek yapılmaz; durum 'kapali_bayrak'", s.cagrilar.length === 0 && r.ok === false && r.durum === "kapali_bayrak" && K.acik() === false); }
/* 1b) adres bayrağı */
{ const s = sunucu(), K = kur(s.fetch, { bayrak: false, arama: "?x=1&katalog=1" }); const r = await K.yukle(); t("1b ?katalog=1 ile açılır", K.acik() === true && r.ok === true);
  const s2 = sunucu(), K2 = kur(s2.fetch, { bayrak: false, arama: "?katalog=10" }); t("1c '?katalog=10' bayrağı AÇMAZ", K2.acik() === false && (await K2.yukle()).durum === "kapali_bayrak" && s2.cagrilar.length === 0); }

/* 2) 1127 soru, sayfalama, parametre kısıtı */
{ const s = sunucu(), K = kur(s.fetch); const r = await K.yukle();
  t("2 1127 soru yüklendi (2 sayfa), tamam", r.ok && r.sorular.length === 1127 && r.sayim.sayfa === 2 && r.durum === "tamam", dizge(r.sayim || r));
  t("3 os=52 ve fix=37 korundu; değerler yalnız 1", r.sayim.os === 52 && r.sayim.fix === 37 && r.sayim.os === OS && r.sayim.fix === FIX && r.sorular.every(q => (!("os" in q) || q.os === 1) && (!("fix" in q) || q.fix === 1)));
  t("4 yalnız limit ve sonra gönderildi; yol yalnız /api/soru/katalog; yalnız GET + same-origin", s.cagrilar.length === 2 && s.cagrilar.every(c => { const u = new URL(c.yol, "https://site.test"); return u.pathname === "/api/soru/katalog" && [...u.searchParams.keys()].every(k => k === "limit" || k === "sonra") && c.init.method === "GET" && c.init.credentials === "same-origin"; }) && !/sonra/.test(s.cagrilar[0].yol) && /sonra=syn0999/.test(s.cagrilar[1].yol), s.cagrilar.map(c => c.yol).join(" | "));
  t("5 kimlik sırası ve içerik sunucudakiyle aynı; paragraf (p) korundu", r.sorular.every((q, i) => q.id === SORULAR[i].id && q.q === SORULAR[i].q && dizge(q.o) === dizge(SORULAR[i].o) && q.p === SORULAR[i].p));
  t("6 sonuçta cevap/çözüm anahtarı YOK (a, x, SIRRI…)", !sizdirdiMi(r.sorular) && r.sorular.every(q => !("a" in q) && !("x" in q)));
  t("7 sonuç dondurulmuş (değiştirilemez)", Object.isFrozen(r) && Object.isFrozen(r.sorular) && Object.isFrozen(r.sorular[0]) && Object.isFrozen(r.sorular[0].o));
  const r2 = await K.yukle(); t("8 ikinci çağrı bellekten döner (yeni istek yok); yenile:true yeniden ister", r2 === r && s.cagrilar.length === 2 && (await K.yukle({ yenile: true })).ok && s.cagrilar.length === 4);
  K.temizle(); }
{ const s = sunucu(), K = kur(s.fetch); const r = await K.yukle({ limit: 400 }); t("9 küçük limit: 3 sayfa, aynı 1127", r.ok && r.sorular.length === 1127 && r.sayim.sayfa === 3 && s.cagrilar.every(c => /limit=400/.test(c.yol)));
  const s2 = sunucu(), K2 = kur(s2.fetch); await K2.yukle({ limit: 99999 }); t("9b geçersiz limit 1000'e döner", /limit=1000/.test(s2.cagrilar[0].yol)); }
{ const s = sunucu(), K = kur(s.fetch); const [a, b] = await Promise.all([K.yukle(), K.yukle()]); t("9c eşzamanlı çağrılar tek zinciri paylaşır (yalnız 2 istek)", a === b && s.cagrilar.length === 2); }
{ const s = sunucu({ bayrak: "eksik" }), K = kur(s.fetch); const r = await K.yukle(); t("9d bayrak 'eksik': yükler ama bayrakHazir=false (bilinmeyen, 'bayraksız' sayılmaz)", r.ok && r.bayrak === "eksik" && r.bayrakHazir === false); }
{ const s = sunucu(), K = kur(s.fetch); const r = await K.yukle({ beklenenToplam: 1127 }); t("9e beklenenToplam=1127 uyuşunca tamam", r.ok); }

/* 3) HTTP durumları — hepsi güvenli hata, hiçbir BANK'a düşüş yok, kısmi veri yok */
const durumDene = async (ad, durum, beklenen, ek) => { const s = sunucu({ durum }), K = kur(s.fetch); const r = await K.yukle(); t(ad, r.ok === false && r.durum === beklenen && r.sorular.length === 0 && s.cagrilar.length === 1 && (!ek || ek(r)), dizge(r)); };
await durumDene("10 401 → giris_gerekli", yanit(401, { error: "oturum" }), "giris_gerekli");
await durumDene("11 429 → cok_istek (Retry-After okunur, otomatik yeniden deneme YOK)", yanit(429, { error: "cok_istek" }, { "retry-after": "120" }), "cok_istek", r => r.bekleSn === 120);
await durumDene("11b 429 Retry-After yoksa bekleSn=null", yanit(429, {}), "cok_istek", r => r.bekleSn === null);
await durumDene("12 500 → sunucu_hatasi", yanit(500, {}), "sunucu_hatasi");
await durumDene("12b 503 → sunucu_hatasi", yanit(503, {}), "sunucu_hatasi");
await durumDene("13 404 (V2 kapalı) → kapali", yanit(404, {}), "kapali");
await durumDene("13b 403 → reddedildi", yanit(403, {}), "reddedildi");
await durumDene("13c 400 → istek_reddedildi", yanit(400, {}), "istek_reddedildi");
await durumDene("13d 418 → beklenmeyen_durum", yanit(418, {}), "beklenmeyen_durum");
await durumDene("13e bozuk JSON → bozuk_yanit", yanit(200, "BOZUK"), "bozuk_yanit");
{ const K = kur(async () => { throw new TypeError("ağ yok"); }); const r = await K.yukle(); t("14 ağ hatası → ag_hatasi", !r.ok && r.durum === "ag_hatasi" && r.sorular.length === 0); }
{ const K = kur(async () => { const e = new Error("a"); e.name = "AbortError"; throw e; }); const r = await K.yukle(); t("14b iptal → iptal", !r.ok && r.durum === "iptal"); }
{ const s = sunucu({ durum: n => n === 1 ? yanit(429, {}, { "retry-after": "5" }) : null }), K = kur(s.fetch); const r = await K.yukle();
  t("15 2. sayfada 429: ilk sayfanın soruları DÖNMEZ (yarım katalog yok), tekrar istek atılmaz", !r.ok && r.durum === "cok_istek" && r.sorular.length === 0 && s.cagrilar.length === 2);
  const r2 = await K.yukle(); t("15b hata önbelleğe alınmaz: sonraki çağrı yeniden dener", s.cagrilar.length >= 3 && r2.ok === true, dizge(r2).slice(0, 120)); }

/* 4) yinelenen kimlik, cursor, eksik sayfa */
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) g.sorular[1] = { ...g.sorular[0] }; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("16 sayfa İÇİNDE yinelenen id → yinelenen_id, boş sonuç", !r.ok && r.durum === "yinelenen_id" && r.sorular.length === 0); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 1) { g.sorular[0] = { ...SORULAR[5], o: SORULAR[5].o.slice() }; } return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("17 sayfalar ARASI yinelenen id → reddedilir (yinelenen_id ya da bozuk_siralama), boş sonuç", !r.ok && ["yinelenen_id", "bozuk_siralama"].includes(r.durum) && r.sorular.length === 0, r.durum); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) g.sonraki = "syn0999"; return g; } }); const sd = { ...s }; let say = 0;
  const K = kur(async (yol, i) => { say++; const r = await s.fetch(yol, i); const j = await r.json(); if (say > 1) { j.sonraki = "syn0999"; j.sorular = []; j.n = 0; } return yanit(200, j); }); const r = await K.yukle();
  t("18 cursor DÖNGÜSÜ (aynı imleç tekrar) → cursor_dongusu, sonsuz istek yok", !r.ok && r.durum === "cursor_dongusu" && say <= 3 && r.sorular.length === 0, dizge(r)); }
{ let say = 0; const K = kur(async () => { say++; return yanit(200, { n: 0, bayrak: "hazir", sorular: [], sonraki: "syn" + String(1000 + say).padStart(4, "0") }); }); const r = await K.yukle();
  t("19 sonsuz ilerleyen imleç → cok_sayfa ile durur (en fazla 12 istek)", !r.ok && r.durum === "cok_sayfa" && say === 12 && r.sorular.length === 0, say + " " + r.durum); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) g.sonraki = "bozuk imleç!"; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("20 bozuk imleç biçimi → bozuk_cursor", !r.ok && r.durum === "bozuk_cursor" && r.sorular.length === 0); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) g.sonraki = "syn0001"; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("20b imleç son sorunun GERİSİNDE → bozuk_cursor", !r.ok && r.durum === "bozuk_cursor"); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) g.sonraki = 5; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("20c imleç string değil → bozuk_yanit", !r.ok && r.durum === "bozuk_yanit"); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 1) { g.sorular = g.sorular.slice(0, 100); g.n = 100; g.sonraki = null; } return g; } }), K = kur(s.fetch); const r = await K.yukle({ beklenenToplam: 1127 });
  t("21 EKSİK SAYFA (ozet toplamı ile uyuşmaz) → eksik_sayfa, kısmi katalog verilmez", !r.ok && r.durum === "eksik_sayfa" && r.sorular.length === 0, dizge(r).slice(0, 200)); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) { g.sonraki = null; } return g; } }), K = kur(s.fetch); const r = await K.yukle({ beklenenToplam: 1127 }); t("21b sunucu erken 'bitti' derse (1000/1127) → eksik_sayfa", !r.ok && r.durum === "eksik_sayfa"); }
{ const s = sunucu({ sorular: [] }), K = kur(s.fetch); const r = await K.yukle(); t("21c boş katalog → bos_katalog", !r.ok && r.durum === "bos_katalog"); }
{ const s = sunucu({ degistir: (n, g) => { g.n = g.n + 1; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("22 n ile sorular.length uyuşmaz → bozuk_yanit", !r.ok && r.durum === "bozuk_yanit"); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 1) g.bayrak = "eksik"; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("22b sayfalar arası bayrak tutarsız → bozuk_yanit", !r.ok && r.durum === "bozuk_yanit"); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) g.sorular.reverse(); return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("22c sırasız sayfa → bozuk_siralama", !r.ok && r.durum === "bozuk_siralama"); }

/* 5) CEVAP ANAHTARI SIZINTISI: izin dışı her alan tüm kataloğu atar */
for (const alan of ["a", "x", "h", "rk", "govde", "json", "kaynak", "kopya_of", "cevap", "cozum", "dogru", "yeni_bilinmeyen"]) {
  const s = sunucu({ degistir: (n, g) => { if (n === 1) { const i = 10; g.sorular[i] = { ...g.sorular[i], [alan]: alan === "a" ? 3 : "SIRRI-" + alan }; } return g; } }), K = kur(s.fetch); const r = await K.yukle();
  t(`23 sızıntı: '${alan}' alanı (2. sayfada) → 'sizinti', TÜM katalog atılır`, !r.ok && r.durum === "sizinti" && r.sorular.length === 0 && !sizdirdiMi(r) && !/SIRRI/.test(dizge(r)), dizge(r).slice(0, 200)); }
{ const s = sunucu({ degistir: (n, g) => { g.anahtar = { a: 1 }; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("24 üst düzey yanıtta fazladan alan → 'sizinti'", !r.ok && r.durum === "sizinti" && r.sorular.length === 0); }
{ const s = sunucu({ degistir: (n, g) => { if (n === 0) g.sorular[0].o = ["a", "b", "c", "d"]; return g; } }), K = kur(s.fetch); const r = await K.yukle(); t("25 5 şıktan farklı → bozuk_yanit", !r.ok && r.durum === "bozuk_yanit"); }
{ const bozuklar = [q => { q.id = "bo ş!"; }, q => { q.d = 9; }, q => { q.d = "2"; }, q => { q.q = ""; }, q => { q.s = 5; }, q => { q.os = 2; }, q => { q.fix = true; }, q => { q.o = [1, 2, 3, 4, 5]; }, q => { q.p = 7; }];
  let hepsi = true, nedenler = [];
  for (const b of bozuklar) { const s = sunucu({ degistir: (n, g) => { if (n === 0) b(g.sorular[3]); return g; } }), K = kur(s.fetch); const r = await K.yukle(); if (r.ok || r.sorular.length) { hepsi = false; nedenler.push(b.toString()); } }
  t("26 geçersiz alan değerleri (id, d, q, s, os, fix, o, p) → reddedilir", hepsi, nedenler.join(" ; ")); }

/* 6) KAPSAM: yükleyici hiç oturum/kota ucu çağırmaz, BANK/depolamaya dokunmaz */
{ const s = sunucu(), K = kur(s.fetch); await K.yukle(); const yollar = s.cagrilar.map(c => new URL(c.yol, "https://site.test").pathname);
  t("27 yalnızca /api/soru/katalog çağrıldı (oturum/cevap/bitir/kota/hesap YOK)", yollar.every(p => p === "/api/soru/katalog") && !s.cagrilar.some(c => /oturum|cevap|bitir|kota|hesap|sorular\b/.test(c.yol.replace("/api/soru/katalog", ""))));
  t("28 blok BANK, allQ, EKQ, localStorage, sessionStorage, indexedDB, LS., /sorular/ , 'ake.' içermez", !/\b(BANK|allQ|EKQ|S\.aiQs)\b|localStorage|sessionStorage|indexedDB|\bLS\.|\/sorular\/|"ake\./.test(BLOK.replace(/\/\*[\s\S]*?\*\//g, "")), "yorum dışı kodda yasaklı ad var");
  t("29 blokta başka uç noktası yok: yalnız '/api/soru/katalog'", [...BLOK.matchAll(/\/api\/[a-z\/]+/g)].every(m => m[0] === "/api/soru/katalog")); }
{ const s = sunucu({ durum: yanit(500, {}) }), K = kur(s.fetch); const r = await K.yukle(); t("30 hata durumunda BANK'a düşülmez: kapsamda BANK yok ve sonuç boş (ReferenceError oluşmadı)", !r.ok && r.sorular.length === 0 && typeof r.durum === "string"); }

console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
