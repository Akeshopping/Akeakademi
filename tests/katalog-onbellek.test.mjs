// B4 Aşama 3B-2 · KAT + KHAVUZ ÖNBELLEK / YARIŞ regresyon testleri (GERÇEK iki blok index.html'den çıkarılır; sahte fetch; ağ YOK; gerçek veri YOK).
// Sunucu durumu istek ANINDA anlık görüntülenir: geç tamamlanan eski istek, eski içeriği taşır (gerçek yarışı sınar). Çalıştırma: node tests/katalog-onbellek.test.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), html = fs.readFileSync(process.env.KAT_HTML || path.join(KOK, "index.html"), "utf8");
const kes = (bas, bit) => { const a = html.lastIndexOf("/* =====", html.indexOf(bas)), b = html.indexOf(bit); if (a < 0 || b < a) { console.error("blok yok: " + bas); process.exit(1); } return html.slice(a, b); };
const BLOK = kes("[KAT-BASLA]", "/* [KAT-BITIR] */") + "\n" + kes("[KHAVUZ-BASLA]", "/* [KHAVUZ-BITIR] */");
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 320)); };
let bitti = false; process.on("exit", c => { if (!bitti) { console.log("KALDI test tamamlanmadan bitti (askıda kalan söz: bir yükleme hiç sonuçlanmadı)"); process.exitCode = 1; } });
const tik = () => new Promise(r => setTimeout(r, 0)), bekle = async (kosul, ms = 500) => { const b = Date.now(); while (!kosul() && Date.now() - b < ms) await tik(); return kosul(); };

/* ---- sahte sunucu: durum istek anında anlık görüntülenir ---- */
const OS = 3, FIX = 2;
function veri(surum, n) { return [...Array(n)].map((_, i) => { const q = { id: "s" + String(i).padStart(3, "0"), s: ["mat", "turkce"][i % 2], t: "Konu " + (i % 3), d: 1 + (i % 3), q: "v" + surum + "-soru-" + i, o: ["A", "B", "C", "D", "E"].map(h => h + i) }; if (i < OS) q.os = 1; else if (i < OS + FIX) q.fix = 1; return q; }); }
const yanit = (durum, govde) => ({ status: durum, ok: durum >= 200 && durum < 300, headers: { get: () => null }, json: async () => govde });
function kur(ilkN = 20) {
  const S = { surum: 1, n: ilkN, oturum: true, cagri: [], tut: null, hata500: false };
  S.fetch = async (yol, init = {}) => {
    const kay = { yol, init, surum: S.surum, n: S.n, oturum: S.oturum, coz: null, sira: S.cagri.length }; S.cagri.push(kay);   // anlık görüntü
    if (S.tut && S.tut(kay)) await new Promise(r => { kay.coz = r; });
    if (!kay.oturum) return yanit(401, {}); if (kay.hata500) return yanit(500, {});
    const liste = veri(kay.surum, kay.n); return yanit(200, { n: liste.length, bayrak: "hazir", sorular: liste, sonraki: null }); };
  const esc = s => String(s), fq = esc;
  const { KAT, KHAVUZ } = new Function("fetch", "window", "location", "esc", "fq", BLOK + "\nreturn { KAT, KHAVUZ };")(S.fetch, { AKE_KATALOG: true, AKE_KATALOG_HAVUZ: true }, { search: "" }, esc, fq);
  return { S, KAT, KHAVUZ };
}
const bek = (n, o = {}) => ({ beklenenToplam: n, beklenenOs: OS, beklenenFix: FIX, ...o });
const icerik = H => ["mat", "turkce"].flatMap(s => H.poolOf(s).sorular).map(q => q.q).sort().join("|");
const surumler = H => new Set(["mat", "turkce"].flatMap(s => H.poolOf(s).sorular).map(q => q.q.split("-")[0])).size === 1 ? ["mat", "turkce"].flatMap(s => H.poolOf(s).sorular)[0]?.q.split("-")[0] : "karisik";

/* 1) 20 → 10 soruya değişim */
{ const { S, KAT, KHAVUZ: H } = kur(20); const r1 = await H.yukle(bek(20)); S.n = 10; S.surum = 2;
  t("1 başlangıç: 20 soru", r1.ok && r1.toplam === 20 && S.cagri.length === 1);
  const r2 = await H.yukle(bek(10)); t("1a hazır havuz FARKLI beklenenle çağrılırsa sessizce başarılı DÖNMEZ ('beklenen_farkli'); yeni istek atılmaz; havuz korunur", r2.ok === false && r2.durum === "beklenen_farkli" && S.cagri.length === 1 && H.durumu().toplam === 20 && H.poolOf("mat").ok, JSON.stringify(r2));
  const r3 = await H.yukle(bek(10, { yenile: true })); t("1b yenile:true ile yeniden yükleme: 10 soru, yeni içerik", r3.ok && r3.toplam === 10 && S.cagri.length === 2 && surumler(H) === "v2", JSON.stringify(r3));
  S.n = 20; S.surum = 3; H.temizle(); const r4 = await H.yukle(bek(20)); t("1c temizle() + yükleme: KAT önbelleği de temizlendi, taze 20 soru (bayat 10 değil)", r4.ok && r4.toplam === 20 && S.cagri.length === 3 && surumler(H) === "v3", JSON.stringify([r4, S.cagri.length]));
  S.n = 10; S.surum = 4; H.temizle(); const r5 = await H.yukle(bek(20)); t("1d sunucu 10'a düşmüşken 20 bekleyen çağrı güvenle durur (KAT'ın eksik_sayfa durumu iletilir), havuz boş", r5.ok === false && (r5.durum === "eksik_sayfa" || r5.durum === "eksik_katalog") && H.poolOf("mat").ok === false, JSON.stringify(r5)); }
/* 2) aynı sayıda değişen içerik */
{ const { S, KHAVUZ: H } = kur(20); await H.yukle(bek(20)); S.surum = 2;
  const eskiIcerik = icerik(H); const ayni = await H.yukle(bek(20)); t("2 yenileme/temizleme olmadan yeniden çekilmez (sözleşme): içerik v1 kalır", ayni.ok && surumler(H) === "v1" && S.cagri.length === 1);
  await H.yukle(bek(20, { yenile: true })); t("2a aynı sayıda değişen içerik, yenile:true ile alınır (v2)", surumler(H) === "v2" && icerik(H) !== eskiIcerik && S.cagri.length === 2);
  S.surum = 3; H.temizle(); await H.yukle(bek(20)); t("2b temizle() ile de alınır (v3)", surumler(H) === "v3" && S.cagri.length === 3); }
/* 3) KAT.temizle() sırasında devam eden yükleme önbelleği yeniden dolduramaz */
{ const { S, KAT } = kur(20); S.tut = k => k.sira === 0; const p1 = KAT.yukle(bek(20)); await tik(); KAT.temizle(); S.tut = null; S.cagri[0].coz(); const r1 = await p1;
  t("3 KAT.temizle()'den sonra biten eski yükleme 'iptal' döner (bayat veri sunmaz)", r1.ok === false && r1.durum === "iptal", JSON.stringify(r1).slice(0, 120));
  const n0 = S.cagri.length; const r2 = await KAT.yukle(bek(20)); t("3a önbellek BOŞ kaldı: sonraki yükleme yeniden ağa gider", r2.ok && S.cagri.length === n0 + 1); }
{ const { S, KAT } = kur(20); S.tut = k => k.sira === 0; const p1 = KAT.yukle(bek(20)); await tik(); KAT.temizle(); S.surum = 2; S.tut = null; const r2 = await KAT.yukle(bek(20)); S.cagri[0].coz(); const r1 = await p1;
  const r3 = await KAT.yukle(bek(20)); t("3b yeni yükleme bitip eski GEÇ bitince önbellek yeni (v2) kalır, eski (v1) ezmez", r2.ok && r1.durum === "iptal" && r3.ok && r3.sorular[0].q.startsWith("v2-") && S.cagri.length === 2, JSON.stringify([r1.durum, r3.sorular && r3.sorular[0].q])); }
/* 4) eski isteğin geç hata vermesi */
{ const { S, KAT, KHAVUZ: H } = kur(20); S.tut = k => k.sira === 0; const p1 = H.yukle(bek(20)); await tik(); H.temizle(); S.tut = null; S.surum = 2; const r2 = await H.yukle(bek(20)); S.cagri[0].hata500 = true; S.cagri[0].coz(); const r1 = await p1;
  t("4 eski isteğin geç 500 hatası, yeni sağlıklı havuzu/önbelleği bozmaz", r1.durum === "iptal" && r2.ok && H.durumu().ok && surumler(H) === "v2");
  const n = S.cagri.length; await KAT.yukle(bek(20)); t("4a KAT önbelleği sağlam: ağa tekrar gidilmez", S.cagri.length === n); }
{ const { S, KHAVUZ: H } = kur(20); S.tut = k => k.sira === 0; const p1 = H.yukle(bek(20)); await tik(); H.temizle(); S.tut = null; await H.yukle(bek(20)); S.cagri[0].coz(); S.cagri[0].hata500 = false; const r1 = await p1; t("4b eski isteğin geç BAŞARISI da yeni havuzu ezmez", r1.durum === "iptal" && H.durumu().ok); }
/* 5) eşzamanlı yenileme ve temizleme */
{ const { S, KHAVUZ: H } = kur(20); S.tut = k => true; const a = H.yukle(bek(20, { yenile: true })), b = H.yukle(bek(20, { yenile: true })); await tik(); t("5 aynı beklenenle eşzamanlı iki yenileme TEK ağ isteğine katılır", a === b && S.cagri.length === 1); S.cagri[0].coz(); const [x, y] = await Promise.all([a, b]); t("5a ikisi de aynı sağlıklı sonucu alır", x.ok && y.ok && H.durumu().ok); }
{ const { S, KHAVUZ: H } = kur(20); S.tut = k => true; const a = H.yukle(bek(20)); await tik(); S.surum = 2; const b = H.yukle(bek(20, { yenile: true })); await tik();
  t("5b yenilemesiz bekleyen işe yenile:true KATILMAZ: ikinci ağ isteği başlar", a !== b && S.cagri.length === 2 && S.cagri[1].init.cache === "reload");
  S.cagri[1].coz(); const rb = await b; S.cagri[0].coz(); const ra = await a; t("5c eski (yenilemesiz) iş 'iptal'; havuz yenileme işinin (v2) verisi", ra.durum === "iptal" && rb.ok && surumler(H) === "v2", JSON.stringify([ra.durum, rb.ok, surumler(H)])); }
{ const { S, KHAVUZ: H } = kur(20); S.tut = k => true; const a = H.yukle(bek(20, { yenile: true })); await tik(); H.temizle(); const b = H.yukle(bek(20, { yenile: true })); await tik(); S.surum = 2; S.cagri[0].coz(); S.cagri[1].coz(); const [ra, rb] = await Promise.all([a, b]);
  t("5d yenileme sırasında temizle(): eski iş iptal, yeni yenileme tamamlanır", ra.durum === "iptal" && rb.ok && H.durumu().ok); }
{ const { S, KHAVUZ: H } = kur(20); S.tut = k => true; const a = H.yukle(bek(20)); await tik(); H.temizle(); H.temizle(); S.cagri[0].coz(); const r = await a; t("5e ardışık temizle(): havuz ve önbellek boş kalır", r.durum === "iptal" && H.durumu().durum === "bos" && H.poolOf("mat").ok === false); }
/* 5f) rastgele işlem dizileri: son durum modelle uyumlu mu */
{ let hataSay = 0, sayi = 0; const tohum = n => { let x = n; return () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296; };
  for (let k = 1; k <= 150; k++) { const r = tohum(k), { S, KHAVUZ: H, KAT } = kur(20); const bekleyenler = []; S.tut = c => r() < 0.7; let sonIs = null, sonYuk = null; const sonuclar = [];
    for (let i = 0; i < 12; i++) { const ne = r(); S.surum = i + 1;
      if (ne < 0.4) { const y = ne < 0.15; const p = H.yukle(bek(20, y ? { yenile: true } : {})); sonuclar.push(p); sonIs = "yukle"; }
      else if (ne < 0.55) { H.temizle(); sonIs = "temizle"; }
      else { const b = S.cagri.filter(c => c.coz && !c.cozuldu); if (b.length) { const c = b[Math.floor(r() * b.length)]; c.cozuldu = true; c.coz(); } }
      await tik(); }
    S.tut = null; S.cagri.forEach(c => { if (c.coz && !c.cozuldu) { c.cozuldu = true; c.coz(); } }); await Promise.all(sonuclar); await tik(); sayi++;
    const hazir = H.durumu().ok, katSay = S.cagri.length; const kr = await KAT.yukle(bek(20)); const yeniAg = S.cagri.length > katSay;   // KAT önbelleği doluysa ağa gitmez
    /* değişmezler: (i) havuz hazırsa içeriği, ağa giden istekler arasında SON başlatılan ve iptal edilmemiş olanın değil ama hiçbir zaman karışık değil; (ii) son işlem temizle ise havuz boş ve KAT önbelleği boş */
    const surum = hazir ? surumler(H) : null; if (surum === "karisik") hataSay++;
    if (sonIs === "temizle" && (hazir || !yeniAg)) hataSay++;
    if (hazir && S.cagri.length && !S.cagri.some(c => "v" + c.surum === surum)) hataSay++; }
  t(`5f ${sayi} rastgele yükle/yenile/temizle/tamamla dizisinde: içerik karışmaz, son işlem temizle ise havuz ve KAT önbelleği boş`, sayi === 150 && hataSay === 0, hataSay); }
/* 6) farklı beklenen toplam / os / fix */
{ const { S, KHAVUZ: H } = kur(20); await H.yukle(bek(20)); const n0 = S.cagri.length; const tek = [["toplam", bek(19)], ["os", bek(20, { beklenenOs: OS + 1 })], ["fix", bek(20, { beklenenFix: FIX + 1 })], ["varsayılan 1127/52/37", {}]];
  for (const [ad, o] of tek) { const r = await H.yukle(o); t(`6 hazır havuz, farklı ${ad} → 'beklenen_farkli' (ok:false), ağ isteği yok, havuz korunur`, r.ok === false && r.durum === "beklenen_farkli" && S.cagri.length === n0 && H.durumu().ok, JSON.stringify(r)); }
  const ayni = await H.yukle(bek(20)); t("6a aynı beklenenle çağrı başarılı ve ağ isteği yok", ayni.ok && S.cagri.length === n0);
  const yen = await H.yukle(bek(19, { yenile: true })); t("6b farklı beklenen + yenile:true → yeniden doğrulanır (ağ isteği) ve sayı uyuşmadığı için DURUR", yen.ok === false && (yen.durum === "eksik_sayfa" || yen.durum === "eksik_katalog") && S.cagri.length === n0 + 1 && H.poolOf("mat").ok === false, JSON.stringify(yen)); }
{ const { S, KHAVUZ: H } = kur(20); S.tut = k => true; const a = H.yukle(bek(20)); await tik(); const b = await H.yukle(bek(19)); t("6c süren yüklemeye FARKLI beklenenle katılınmaz ('beklenen_farkli'); süren yükleme etkilenmez", b.durum === "beklenen_farkli" && S.cagri.length === 1); S.cagri[0].coz(); t("6d süren yükleme yine de tamamlanır", (await a).ok); }
{ const { S, KHAVUZ: H } = kur(20); S.tut = k => true; const a = H.yukle(bek(20)); await tik(); const b = H.yukle(bek(19, { yenile: true })); await tik(); S.cagri[1].coz(); S.cagri[0].coz(); const [ra, rb] = await Promise.all([a, b]); t("6e süren yüklemeye farklı beklenen + yenile:true: yenisi geçerli, eskisi 'iptal'", ra.durum === "iptal" && rb.ok === false && /^eksik_/.test(rb.durum), JSON.stringify([ra.durum, rb.durum])); }
{ /* bayrak 'eksik' ise os/fix denetlenmez */ const { S, KHAVUZ: H, KAT } = kur(20); const f = S.fetch; const sd = { async yukle(o) { const r = await KAT.yukle(o); return r; } };
  t("6f KAT: önbellekten/ortak işten dönse bile çağıranın beklenenToplam'ı denetlenir", await (async () => { const { S: S2, KAT: K2 } = kur(20); await K2.yukle(bek(20)); const r = await K2.yukle(bek(19)); const r2 = await K2.yukle(bek(20)); return r.durum === "eksik_sayfa" && r2.ok && S2.cagri.length === 1; })()); }
/* 7) kullanıcı oturumu değişimi */
{ const { S, KHAVUZ: H } = kur(20); await H.yukle(bek(20)); const alice = icerik(H); S.oturum = false;   // çıkış
  const hala = await H.yukle(bek(20)); t("7 OLUMSUZ KONTROL (sözleşme): çıkıştan sonra temizle() ÇAĞRILMAZSA kurulu havuz bellekte kalır → çağıran temizle() çağırmak ZORUNDA", hala.ok && icerik(H) === alice);
  H.temizle(); t("7a temizle(): havuz boşalır", H.poolOf("mat").ok === false && H.durumu().durum === "bos");
  const girissiz = await H.yukle(bek(20)); t("7b oturum yokken yükleme 'giris_gerekli' (önceki kullanıcının kataloğu GERİ GELMEZ)", girissiz.ok === false && girissiz.durum === "giris_gerekli" && H.poolOf("mat").ok === false && S.cagri[S.cagri.length - 1].init.cache === "reload", JSON.stringify(girissiz));
  S.oturum = true; S.surum = 7; const bob = await H.yukle(bek(20)); t("7c yeni kullanıcı girişi: taze veri (v7), önceki kullanıcıdan hiçbir iz yok", bob.ok && surumler(H) === "v7" && !icerik(H).includes("v1-"), surumler(H));
  S.surum = 8; H.temizle(); await H.yukle(bek(20)); t("7d hesap değişimi (temizle + yükleme) sunucunun o anki verisini alır (v8)", surumler(H) === "v8"); }
/* 8) HTTP önbelleğini atlama (fetch seçenekleri) */
{ const { S, KAT, KHAVUZ: H } = kur(20); await KAT.yukle(bek(20)); const ilk = S.cagri.map(c => c.init.cache);
  t("8 ilk (normal) yükleme: cache 'default'", ilk.length === 1 && ilk[0] === "default", ilk.join());
  await KAT.yukle(bek(20, { yenile: true })); t("8a yenile:true: cache 'reload' (tarayıcının bayat HTTP önbelleği atlanır)", S.cagri[1].init.cache === "reload");
  KAT.temizle(); await KAT.yukle(bek(20)); t("8b temizle()'den sonraki yükleme de 'reload'", S.cagri[2].init.cache === "reload");
  const { S: S4, KAT: K4 } = kur(2500); await K4.yukle({ beklenenToplam: 2500, yenile: true, limit: 1000 }); t("8d çok sayfalı yenilemede HER sayfa isteği 'reload'", S4.cagri.length >= 1 && S4.cagri.every(c => c.init.cache === "reload")); }
/* 9) KAT tek başına: nesil */
{ const { S, KAT } = kur(20); S.tut = k => k.sira === 0; const a = KAT.yukle(bek(20)); await tik(); const b = KAT.yukle(bek(20)); t("9 KAT: aynı anda ikinci çağrı aynı işe katılır (tek ağ isteği)", S.cagri.length === 1 && (await (S.cagri[0].coz(), Promise.all([a, b]))).every(x => x.ok)); }
{ const { S, KAT } = kur(20); S.tut = k => k.sira === 0; const a = KAT.yukle(bek(20)); await tik(); S.surum = 2; const b = KAT.yukle(bek(20, { yenile: true })); await tik(); S.cagri[0].coz(); const ra = await a, rb = await b; const r = await KAT.yukle(bek(20)); t("9a KAT: yenile:true yenilemesiz işi geçersiz kılar; önbellek yeni (v2) veriyle dolar", ra.durum === "iptal" && rb.ok && r.sorular[0].q.startsWith("v2-") && S.cagri.length === 2); }
{ const { S, KAT } = kur(20); S.tut = k => true; const a = KAT.yukle(bek(20)); await tik(); KAT.temizle(); const b = KAT.yukle(bek(20)); await tik(); S.cagri[0].coz(); const ra = await a;
  const c = KAT.yukle(bek(20)); await tik(); t("9b KAT: eski iş bittiğinde yeni işin 'bekleyen' kaydını SİLMEZ; sonraki çağrı yeni işe katılır (yinelenen ağ isteği yok)", ra.durum === "iptal" && S.cagri.length === 2, S.cagri.length);
  S.cagri[1].coz(); const [rb, rc] = await Promise.all([b, c]); t("9c yeni iş ve ona katılan çağrı aynı sağlıklı sonucu alır", rb.ok && rc.ok); }
bitti = true; console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
