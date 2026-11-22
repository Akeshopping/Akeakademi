// AKE Soru Fabrikası · robot hattı: taslak → kör model denetimi → inceleme kuyruğu → yönetici yayım kararı.
// Bu modül Pages Functions (yönetim uçları) VE ayrı Cloudflare Worker (worker/fabrika-worker.js) tarafından kullanılır.
//
// İKİ AYRI DURUM (asla birleşmez):
//   model_durum  : bekliyor | gecti | revizyon | ret | belirsiz     ← "model kontrolünden geçti" yalnız bunu söyler
//   yayim_durum  : yok | onayli | red                               ← "yayıma onaylandı" yalnız yönetici kararıyla olur
// Canlı bankaya (soru.durum = 'onayli') giden TEK yol yayimKarari(): model_durum='gecti' + denetim_tam=1 + tekrar=0 şartını
// UPDATE'in kendi WHERE'inde (atomik batch + final ASSERT) arar. Robot/işçi kodu hiçbir yerde 'onayli' yazmaz.
//
// Sayısal doğrulama: model çıktısından kod ÇALIŞTIRILMAZ. sayisal alanı daima 'yapilmadi'dır (kör denetçi bağımsız çözer; bu kod doğrulaması değildir).
// Anthropic anahtarı yalnız ortamdan (Worker Secret) okunur; bu dosyada yazılı değer yoktur.
import { rastgele, jsonAyikla, gunTR } from "./ortak.js";
import { soruYazKanonik, soruOnayla, kanonikSemaHazir, bayrakAcik } from "./soru-yaz.js";
import { cevrimdisiSema, tamHash, yolAcikMi, GECIT_CEVRIMDISI_SQL, cevrimdisiEksikler } from "./fabrika-cevrimdisi-cekirdek.js";
import { gercekPasajMi, pasajDegerlendir, bicimSorunlari, tekilUyarilar, benzerlikUyarilari, sertUyariMi, sorunlariCoz, inceAyarMi, siklariKaristir } from "./fabrika-inceleme.js";
export { pasajDegerlendir, bicimSorunlari, benzerlikUyarilari, siklariKaristir };

export const PILOT_AZAMI = 10;
const IS_AZAMI_DENEME = 3, KILIT_MS = 180000, GERI_ILK_MS = 30000, GERI_TAVAN_MS = 300000;
const VARSAYILAN_GUNLUK_CAGRI = 40;
const KONULAR = [["mat", "Sayılar"], ["turkce", "Sözcükte anlam"], ["turkce", "Deyimler"], ["mat", "Problemler"], ["edebiyat", "Divan edebiyatı"], ["ingilizce", "Tenses"]];

/* ---- okuma güvenliği: GET uçları DDL ÇALIŞTIRMAZ ----
   fabrikaSema() tablo kurar/ALTER eder; bu yalnız yazan yollarda (ve AÇIK hazırlık adımında, fabrikaHazirla) çalışır. Okuma uçları yalnız fabrikaHazirMi() ile
   salt okunur kontrol yapar; tablolar yoksa boş sonuç + "hazir:false" döner, hiçbir şey kurmaz. */
export const GEREKLI_TABLOLAR = ["fabrika_ayar", "fabrika_pilot", "fabrika_is", "fabrika_soru", "fabrika_cagri", "fabrika_not", "fabrika_uzman", "fabrika_cevrimdisi", "fabrika_uzman_baglam", "fabrika_surum"];
const GEREKLI_SORU_KOLONLARI = ["kaynak", "rk", "h", "govde", "a", "x", "kopya_of"];
export async function fabrikaHazirMi(env) {   // SALT OKUNUR (sqlite_master + pragma_table_info)
  const var_ = new Set(((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results || []).map(r => r.name));
  const eksik = GEREKLI_TABLOLAR.filter(t => !var_.has(t));
  const kol = new Set(((await env.DB.prepare("SELECT name FROM pragma_table_info('soru')").all()).results || []).map(r => r.name));
  for (const k of GEREKLI_SORU_KOLONLARI) if (!kol.has(k)) eksik.push("soru." + k);
  return { hazir: eksik.length === 0, eksik };
}
/* AÇIK hazırlık adımı: tabloları kurar (eskiden her GET'in yan etkisiydi). Yönetim ucu bunu yalnız önizleme (pages.dev alt alan adı) + açık onay cümlesiyle çağırır. */
export async function fabrikaHazirla(env) {
  const once = await fabrikaHazirMi(env);
  await fabrikaSema(env);
  return { once, sonra: await fabrikaHazirMi(env) };
}
export function onizlemeMi(url) {   // production (akeakademi.com ve akeakademi.pages.dev) FALSE; yalnız <dal|hash>.akeakademi.pages.dev TRUE
  let h = ""; try { h = new URL(url).hostname.toLowerCase(); } catch (e) { return false; }
  return h.endsWith(".akeakademi.pages.dev") && h !== "akeakademi.pages.dev" && h.length > ".akeakademi.pages.dev".length;
}

const semaHazir = new WeakSet();
export async function fabrikaSema(env) {
  if (semaHazir.has(env.DB)) return;
  await kanonikSemaHazir(env);   // soru tablosu kanonik kolonları (V2); hat bunlara dayanır
  const d = env.DB;
  await d.prepare("CREATE TABLE IF NOT EXISTS fabrika_ayar (k TEXT PRIMARY KEY, v TEXT)").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS fabrika_pilot (id TEXT PRIMARY KEY, hedef INTEGER, durum TEXT, ders TEXT, konu TEXT, baslangic INTEGER, bitis INTEGER)").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS fabrika_is (id TEXT PRIMARY KEY, tur TEXT, soru_id TEXT, pilot_id TEXT, ders TEXT, konu TEXT, durum TEXT, deneme INTEGER DEFAULT 0, azami INTEGER, kilit_bitis INTEGER, kilit_kimlik TEXT, sonraki INTEGER, hata TEXT, olusturma INTEGER, guncelleme INTEGER)").run();
  await d.prepare("CREATE INDEX IF NOT EXISTS fabrika_is_durum ON fabrika_is (durum, sonraki)").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS fabrika_soru (soru_id TEXT PRIMARY KEY, pilot_id TEXT, surum INTEGER, asama TEXT, model_durum TEXT, denetim_tam INTEGER DEFAULT 0, tekrar INTEGER DEFAULT 0, sayisal TEXT DEFAULT 'yapilmadi', denetim_json TEXT, olusturma INTEGER, guncelleme INTEGER, yayim_durum TEXT DEFAULT 'yok', yayim_kim TEXT, yayim_tarih INTEGER)").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS fabrika_cagri (id TEXT PRIMARY KEY, is_id TEXT, tur TEXT, soru_id TEXT, surum INTEGER, model TEXT, giris INTEGER, cikis INTEGER, sure_ms INTEGER, hata TEXT, tarih INTEGER, gun TEXT)").run();
  await d.prepare("CREATE INDEX IF NOT EXISTS fabrika_cagri_gun ON fabrika_cagri (gun)").run();
  /* İnceleme notları (ör. "uzman bekliyor"): soru kaydına DOKUNMAZ, yalnız yeni bir tablo. Açık not varsa yayım hiçbir bayrakla açılmaz. */
  await d.prepare("CREATE TABLE IF NOT EXISTS fabrika_not (id TEXT PRIMARY KEY, soru_id TEXT, tur TEXT, mesaj TEXT, durum TEXT, olusturan TEXT, olusturma INTEGER, kapatan TEXT, kapanis INTEGER, kapanis_notu TEXT)").run();
  await d.prepare("CREATE INDEX IF NOT EXISTS fabrika_not_soru ON fabrika_not (soru_id, durum)").run();
  await uzmanSema(d);
  await cevrimdisiSema(d);   // çevrimdışı inceleme + uzman bağlamı + sürüm günlüğü (yalnız yeni tablolar; varsayılan yayım yolunu DEĞİŞTİRMEZ)
  semaHazir.add(d);
}

/* ---- branş uzmanı kararı: model denetimi ve yönetici yayımından AYRI, DEĞİŞTİRİLEMEZ kayıt ----
   Uzmanın kimliği gerçekten doğrulanamaz: kayıt, yöneticinin (kaydeden) "şu uzman şunu karar verdi" beyanıdır; kim kaydetti, ne zaman, hangi gerekçeyle
   izlenebilir. Pilot sorusu (fabrika_soru.pilot_id dolu) için geçerli kabul yoksa soru.durum='onayli' yapılması tetikleyiciyle VERİTABANI düzeyinde reddedilir. */
const UZMAN_KABUL_SQL = `EXISTS (SELECT 1 FROM fabrika_uzman u WHERE u.soru_id = NEW.id AND u.karar = 'kabul' AND u.icerik_h = NEW.h)
  AND NOT EXISTS (SELECT 1 FROM fabrika_uzman u WHERE u.soru_id = NEW.id AND u.karar = 'red')
  AND NOT EXISTS (SELECT 1 FROM fabrika_not n WHERE n.soru_id = NEW.id AND n.tur = 'uzman_bekliyor' AND n.durum = 'acik')`;
export async function uzmanSema(d) {
  await d.prepare(`CREATE TABLE IF NOT EXISTS fabrika_uzman (id TEXT PRIMARY KEY, soru_id TEXT NOT NULL, surum INTEGER, icerik_h TEXT,
    karar TEXT NOT NULL CHECK (karar IN ('kabul','red')), uzman_ad TEXT NOT NULL CHECK (length(trim(uzman_ad)) >= 2), brans TEXT NOT NULL CHECK (length(trim(brans)) >= 1),
    gerekce TEXT NOT NULL CHECK (length(trim(gerekce)) >= 1), tarih INTEGER NOT NULL CHECK (tarih > 0), kayit INTEGER NOT NULL, kaydeden TEXT NOT NULL CHECK (length(trim(kaydeden)) >= 1))`).run();
  await d.prepare("CREATE INDEX IF NOT EXISTS fabrika_uzman_soru ON fabrika_uzman (soru_id, karar)").run();
  await d.prepare("CREATE TRIGGER IF NOT EXISTS fabrika_uzman_degistirme BEFORE UPDATE ON fabrika_uzman BEGIN SELECT RAISE(ABORT, 'fabrika_uzman_degistirilemez'); END").run();
  await d.prepare("CREATE TRIGGER IF NOT EXISTS fabrika_uzman_silme BEFORE DELETE ON fabrika_uzman BEGIN SELECT RAISE(ABORT, 'fabrika_uzman_degistirilemez'); END").run();
  await d.prepare(`CREATE TRIGGER IF NOT EXISTS fabrika_uzman_yayim_kapisi BEFORE UPDATE OF durum ON soru
    WHEN NEW.durum = 'onayli' AND OLD.durum != 'onayli' AND EXISTS (SELECT 1 FROM fabrika_soru f WHERE f.soru_id = NEW.id AND f.pilot_id IS NOT NULL) AND NOT (${UZMAN_KABUL_SQL})
    BEGIN SELECT RAISE(ABORT, 'uzman_kabulu_yok'); END`).run();
}

/* ---- robot anahtarı (VARSAYILAN KAPALI) ---- */
export async function robotAcikMi(env) {
  await fabrikaSema(env);
  const r = await env.DB.prepare("SELECT v FROM fabrika_ayar WHERE k = 'robot'").first();
  return !!r && r.v === "1";
}
export async function robotAyarla(env, acik) {
  if (acik && !bayrakAcik(env)) return { ok: false, neden: "v2_kapali" };   // kanonik soru şeması (AKE_SORU_V2=1) olmadan hat çalıştırılmaz
  await fabrikaSema(env);
  await env.DB.prepare("INSERT INTO fabrika_ayar (k, v) VALUES ('robot', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(acik ? "1" : "0").run();
  return { ok: true, robot: !!acik };
}

/* ---- pilot ---- */
export async function pilotBaslat(env, { hedef, ders, konu } = {}) {
  await fabrikaSema(env);
  if (!(await robotAcikMi(env))) return { ok: false, neden: "robot_kapali" };
  const var_ = await env.DB.prepare("SELECT id FROM fabrika_pilot WHERE durum = 'calisiyor' LIMIT 1").first();
  if (var_) return { ok: false, neden: "pilot_zaten_var", pilotId: var_.id };
  const n = Math.max(1, Math.min(PILOT_AZAMI, Math.floor(+hedef) || PILOT_AZAMI)), id = "pilot-" + rastgele(5), simdi = Date.now();
  const st = [env.DB.prepare("INSERT INTO fabrika_pilot (id, hedef, durum, ders, konu, baslangic) VALUES (?, ?, 'calisiyor', ?, ?, ?)").bind(id, n, ders || null, konu || null, simdi)];
  for (let i = 0; i < n; i++) {
    const [d, k] = ders && konu ? [String(ders), String(konu).slice(0, 80)] : KONULAR[i % KONULAR.length];
    st.push(env.DB.prepare("INSERT INTO fabrika_is (id, tur, pilot_id, ders, konu, durum, deneme, azami, sonraki, olusturma, guncelleme) VALUES (?, 'uret', ?, ?, ?, 'bekliyor', 0, ?, ?, ?, ?)").bind("is-" + rastgele(6), id, d, k, IS_AZAMI_DENEME, simdi, simdi, simdi));
  }
  await env.DB.batch(st);
  return { ok: true, pilotId: id, hedef: n };
}
export async function pilotDurdur(env) {
  await fabrikaSema(env); const simdi = Date.now();
  const p = await env.DB.prepare("UPDATE fabrika_pilot SET durum = 'durdu', bitis = ? WHERE durum = 'calisiyor'").bind(simdi).run();
  const i = await env.DB.prepare("UPDATE fabrika_is SET durum = 'iptal', guncelleme = ? WHERE durum = 'bekliyor' AND pilot_id IS NOT NULL").bind(simdi).run();
  /* Model yanıtı şu an beklenen ('calisiyor') işler İPTAL EDİLEMEZ (çağrı çoktan gitti). Yanıt gelirse kaydedilir (çağrı günlüğü + gider), ama yeni iş/denetim başlatılmaz. */
  const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM fabrika_is WHERE durum = 'calisiyor' AND pilot_id IS NOT NULL").first();
  return { ok: true, durdurulanPilot: (p.meta && p.meta.changes) || 0, iptalIs: (i.meta && i.meta.changes) || 0, calisanIs: (c && c.n) || 0 };
}
async function pilotBitirmeyiDene(env, pilotId) {
  if (!pilotId) return;
  await env.DB.prepare("UPDATE fabrika_pilot SET durum = 'bitti', bitis = ? WHERE id = ? AND durum = 'calisiyor' AND NOT EXISTS (SELECT 1 FROM fabrika_is WHERE pilot_id = ? AND durum IN ('bekliyor','calisiyor'))").bind(Date.now(), pilotId, pilotId).run();
}

/* ---- istemler ---- */
export const uretimIstemi = (ders, konu, ornekler = []) => `YKS ${ders} dersi, "${konu}" konusu için 1 adet orta seviyede, özgün çoktan seçmeli soru yaz.
Kurallar:
- ÖSYM soru tarzına ve 2026-2027 YKS müfredatına uy; hiçbir kaynaktan soru kopyalama, bilinen bir sorunun sayılarını/adlarını değiştirip yeniden üretme.
- Tam 5 seçenek ve yalnızca bir kesin doğru cevap olsun; seçenekler birbirinden farklı, makul ve güçlü çeldiriciler olsun. Her yanlış seçenek belirli bir hata tipine (tek koşulu sağlama, işlem/işaret hatası, yanlış formül, yakın anlam vb.) dayansın; rastgele değer koyma.
- Sayısal sorularda sonucu iki kez hesapla. Sözel sorularda tartışmalı ya da yoruma açık bilgi kullanma. Deyim/atasözü ve edebiyat bilgisinde yalnızca TDK ve ders kitaplarında anlamı/özelliği aynı olan, tartışmasız olanı kullan; kaynaklara göre anlamı değişen deyimden kaçın.
- Soru ve seçenekler Türkçe olsun (İngilizce dersinde soru ve seçenekler İngilizce, açıklama Türkçe). Matematiği düz metinle yaz: x^2, √x, a/b. Şekil gerektiren soru yazma.
- "p" alanı YALNIZCA soru gerçekten bir paragrafa/metne dayanıyorsa o metin olsun (en az iki cümle). Metne ihtiyaç yoksa "p" boş ("") kalsın; ders ya da konu adını ya da herhangi bir etiketi "p" içine ASLA yazma. Soru kökü "parçaya göre/yukarıdaki metin/tablo" diyorsa o içerik "p" içinde bulunmalı.
- Bir ifadenin "altı çizili", "koyu" ya da "işaretli" olduğunu söyleme; işaretlenecek ifadeyi seçeneklerin içinde «…» arasına al ve kökte "«» işaretleri arasındaki" de.
- Açıklama 2-4 cümle olsun ve çözümü adım adım göstersin. Açıklamada seçenek harfi (A, B, C, D, E) kullanma; seçeneğin içeriğine atıf yap. Seçeneklerin sırasını sistem karıştırabilir; doğru seçeneğin yerini dengelemeye çalışma, yalnızca "a" alanını doğru yaz.
Yalnızca JSON dizisi döndür: [{"p":"","q":"Soru metni","o":["…","…","…","…","…"],"a":2,"x":"Açıklama"}]
"a", doğru seçeneğin 0-4 arası sırasıdır.${ornekler.length ? "\n" + ornekler.join("\n") : ""}`;

/* KÖR denetim: yalnız soru metni (varsa pasaj) ve beş seçenek verilir. Cevap anahtarı, çözüm, üretici notu ve konu/zorluk etiketi YOK. */
export const denetimIstemi = ({ p, q, o }) => `Aşağıdaki çoktan seçmeli YKS sorusunu bağımsız olarak çöz ve kalitesini denetle. Soruyu ilk kez görüyorsun.

${p ? "PASAJ:\n" + p + "\n\n" : ""}SORU:
${q}

SEÇENEKLER:
${o.map((x, i) => "ABCDE"[i] + ") " + x).join("\n")}

Görevin: soruyu kendin çöz, hangi şıkkın kesin doğru olduğunu belirle. Birden fazla şık doğru sayılabiliyorsa ya da hiçbiri kesin doğru değilse bunu belirt. Eksik veri, belirsiz ifade, yanlış/tartışmalı bilgi ve zayıf çeldiriciler varsa "sorunlar" listesine yaz. Her yanlış şıkkın neden yanlış olduğunu ve gerçek bir hata tipine dayanıp dayanmadığını değerlendir.
Sorun yoksa "sorunlar" boş dizi olsun; "ciddi sorun yok" gibi olumlu bir cümleyi sorun olarak YAZMA.
Her sorun için tür ve ağırlık ver:
- "tur": "yanlis_cevap" | "belirsizlik" | "celdirici" | "cozum" | "duzey" | "bicim" | "diger"
- "agirlik": "engelleyici" (öğrenciye yanlış, eksik, birden çok doğrulu ya da çözülemez soru gösterir) | "ince_ayar" (soru çözülebilir ve cevabı kesin; yalnızca iyileştirme önerisi — yalnız "celdirici" ve "duzey" türleri ince_ayar olabilir)
Yalnızca şu JSON nesnesini döndür:
{"cevap": 0-4 arası seçtiğin şıkkın sırası (A=0) ya da kesin cevap yoksa null, "tek_dogru": true/false, "belirsiz": true/false, "sorunlar": [{"tur": "celdirici", "agirlik": "ince_ayar", "metin": "kısa sorun cümlesi"}]}`;

const kuyrukaYaz = (env, tur, soruId, pilotId, ders, konu, simdi) =>
  env.DB.prepare("INSERT INTO fabrika_is (id, tur, soru_id, pilot_id, ders, konu, durum, deneme, azami, sonraki, olusturma, guncelleme) VALUES (?, ?, ?, ?, ?, ?, 'bekliyor', 0, ?, ?, ?, ?)").bind("is-" + rastgele(6), tur, soruId, pilotId, ders, konu, IS_AZAMI_DENEME, simdi, simdi, simdi).run();

/* ---- fiyat: yalnız BİLİNEN modeller için, kayıtlı token × liste fiyatı (USD / milyon token). Bilinmeyen model → null (fiyat UYDURULMAZ).
   claude-sonnet-5-5: 2 $ giriş / 10 $ çıkış. Kaynak: Anthropic fiyat sayfası (platform.claude.com/docs/en/about-claude/pricing); değer 19 Kas 2026'da
   birbirinden bağımsız birkaç kaynaktan aynı bulundu, resmî sayfa bu oturumda doğrudan okunamadı. Değişirse burada güncellenir.
   Başka model için fiyatı operatör açıkça verir: AKE_FABRIKA_FIYATLAR='{"model-adi":[giris,cikis]}'. Gerçek fatura Anthropic Console'dadır. ---- */
export const BILINEN_FIYATLAR = { "claude-sonnet-5-5": [2, 10] };
function fiyatBul(env, model) {
  const m = String(model || ""); if (!m) return null;
  if (env && env.AKE_FABRIKA_FIYATLAR) { try { const o = JSON.parse(env.AKE_FABRIKA_FIYATLAR), f = o && Object.prototype.hasOwnProperty.call(o, m) ? o[m] : null; if (Array.isArray(f) && f.length === 2 && f.every(x => typeof x === "number" && Number.isFinite(x) && x >= 0)) return f; } catch (e) { } }
  return Object.prototype.hasOwnProperty.call(BILINEN_FIYATLAR, m) ? BILINEN_FIYATLAR[m] : null;
}
export function usdHesapla(env, model, giris, cikis) {
  const f = fiyatBul(env, model); if (!f) return null;
  return ((giris || 0) * f[0] + (cikis || 0) * f[1]) / 1e6;
}
/* model bazında satırlardan { usd (yalnız fiyatı bilinenler), fiyatsizCagri, fiyatsizModeller } */
export function usdToplam(env, satirlar) {
  const o = { usd: 0, fiyatsizCagri: 0, fiyatsizModeller: [] };
  for (const r of satirlar) { const u = usdHesapla(env, r.model, r.giris, r.cikis); if (u === null) { o.fiyatsizCagri += r.n || 1; if (!o.fiyatsizModeller.includes(r.model)) o.fiyatsizModeller.push(r.model); } else o.usd += u; }
  return o;
}

/* ---- işçi ---- */
export const gunlukLimit = env => { const n = parseInt(env.AKE_FABRIKA_GUNLUK_CAGRI, 10); return Number.isFinite(n) && n >= 0 ? n : VARSAYILAN_GUNLUK_CAGRI; };
async function kotaDolduMu(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM fabrika_cagri WHERE gun = ?").bind(gunTR()).first();
  return ((r && r.n) || 0) >= gunlukLimit(env);
}
async function isAl(env, simdi) {
  const kimlik = rastgele(6), kosul = "(((durum = 'bekliyor' AND sonraki <= ?1) OR (durum = 'calisiyor' AND kilit_bitis < ?1)) AND (pilot_id IS NULL OR EXISTS (SELECT 1 FROM fabrika_pilot p WHERE p.id = fabrika_is.pilot_id AND p.durum = 'calisiyor')))";
  return await env.DB.prepare(`UPDATE fabrika_is SET durum = 'calisiyor', kilit_bitis = ?2, kilit_kimlik = ?3, guncelleme = ?1
    WHERE id = (SELECT id FROM fabrika_is WHERE ${kosul} ORDER BY sonraki, olusturma LIMIT 1) AND ${kosul} RETURNING *`).bind(simdi, simdi + KILIT_MS, kimlik).first();
}
async function isBitir(env, is, simdi, hata, beklemeMs) {
  if (!hata) { await env.DB.prepare("UPDATE fabrika_is SET durum = 'bitti', hata = NULL, guncelleme = ? WHERE id = ? AND kilit_kimlik = ?").bind(simdi, is.id, is.kilit_kimlik).run(); return; }
  const deneme = (is.deneme || 0) + 1;
  if (is.pilot_id) {   // durdurma sırasında yanıt beklenen iş hata ile dönerse yeniden denenmez
    const p = await env.DB.prepare("SELECT durum FROM fabrika_pilot WHERE id = ?").bind(is.pilot_id).first();
    if (!p || p.durum !== "calisiyor") { await env.DB.prepare("UPDATE fabrika_is SET durum = 'iptal', deneme = ?, hata = ?, guncelleme = ? WHERE id = ? AND kilit_kimlik = ?").bind(deneme, String(hata).slice(0, 200), simdi, is.id, is.kilit_kimlik).run(); return; }
  }
  if (deneme >= is.azami) {
    await env.DB.prepare("UPDATE fabrika_is SET durum = 'olu', deneme = ?, hata = ?, guncelleme = ? WHERE id = ? AND kilit_kimlik = ?").bind(deneme, String(hata).slice(0, 200), simdi, is.id, is.kilit_kimlik).run();
    if (is.tur === "denetle" && is.soru_id) await env.DB.prepare("UPDATE fabrika_soru SET asama = 'denetim_eksik', denetim_tam = 0, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(simdi, is.soru_id).run();
    return;
  }
  const bekle = Math.min(GERI_TAVAN_MS, Math.max(beklemeMs || 0, GERI_ILK_MS * 2 ** (deneme - 1)));   // retry-after da olsa üst sınır: GERI_TAVAN_MS
  await env.DB.prepare("UPDATE fabrika_is SET durum = 'bekliyor', deneme = ?, hata = ?, sonraki = ?, kilit_bitis = NULL, guncelleme = ? WHERE id = ? AND kilit_kimlik = ?").bind(deneme, String(hata).slice(0, 200), simdi + bekle, simdi, is.id, is.kilit_kimlik).run();
}
async function cagriYap(env, claudeFn, { is, tur, model, prompt, max_tokens, soruId, surum }) {
  const t0 = Date.now(); let r;
  try { r = (await claudeFn({ tur, model, prompt, max_tokens })) || { hata: "bos_yanit" }; } catch (e) { r = { hata: "istisna: " + String(e && e.message || e).slice(0, 120) }; }
  const cagriId = "cg-" + rastgele(6);
  await env.DB.prepare("INSERT INTO fabrika_cagri (id, is_id, tur, soru_id, surum, model, giris, cikis, sure_ms, hata, tarih, gun) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(cagriId, is.id, tur, soruId || null, surum || null, model, r.giris || 0, r.cikis || 0, Date.now() - t0, r.hata ? String(r.hata).slice(0, 200) : null, Date.now(), gunTR()).run();
  return Object.assign(r, { cagriId });
}
const modelAdi = (env, tur) => (tur === "uretim" ? env.AKE_FABRIKA_MODEL_URETIM : env.AKE_FABRIKA_MODEL_DENETIM) || "claude-sonnet-5-5";

/* Bir taslağı hatta alır: fabrika kaydı + (tekrar değilse) kör denetim işi. soru-uret (yönetim) ve robot üretimi AYNI yolu kullanır.
   tekrar: canlı bankada ya da daha önce yazılmış taslakta aynı kanonik gövde (h) varsa; sıralama rowid'dir (eşzamanlı yazımda da kararlı). */
export async function taslagiKuyrugaAl(env, { id, pilotId = null, ders, konu, simdi = Date.now(), denetimIsiYaz = true, uretimCagriId = null }) {
  await fabrikaSema(env);
  const s = await env.DB.prepare("SELECT h, kopya_of FROM soru WHERE id = ?").bind(id).first();
  const dup = await env.DB.prepare("SELECT 1 AS v FROM soru WHERE h = ? AND id != ? AND (durum IN ('banka','onayli') OR (durum = 'taslak' AND rowid < (SELECT rowid FROM soru WHERE id = ?))) LIMIT 1").bind(s.h, id, id).first();
  const tekrar = !!(dup || s.kopya_of);
  await env.DB.prepare("INSERT INTO fabrika_soru (soru_id, pilot_id, surum, asama, model_durum, denetim_tam, tekrar, sayisal, olusturma, guncelleme) VALUES (?, ?, 1, ?, 'bekliyor', 0, ?, 'yapilmadi', ?, ?)")
    .bind(id, pilotId, tekrar ? "tekrar" : "denetim_bekliyor", tekrar ? 1 : 0, simdi, simdi).run();
  if (uretimCagriId) await env.DB.prepare("UPDATE fabrika_cagri SET soru_id = ?, surum = 1 WHERE id = ?").bind(id, uretimCagriId).run();   // üretim çağrısı ↔ oluşan soru + sürüm
  if (!tekrar && denetimIsiYaz) await kuyrukaYaz(env, "denetle", id, pilotId, ders, konu, simdi);
  return { tekrar };
}

async function uretIsle(env, claudeFn, is, simdi, karistir) {
  const r = await cagriYap(env, claudeFn, { is, tur: "uretim", model: modelAdi(env, "uretim"), prompt: uretimIstemi(is.ders, is.konu), max_tokens: 4000 });   // soru_id/sürüm: soru oluşunca bağlanır
  if (r.hata) return isBitir(env, is, simdi, r.hata, r.bekle_ms);
  const dizi = jsonAyikla(r.metin), o = Array.isArray(dizi) ? dizi[0] : null;
  if (!o || typeof o !== "object") return isBitir(env, is, simdi, "uretim_cozumlenemedi");
  let aday = { s: is.ders, t: is.konu, d: 2, q: String(o.q || "").trim(), o: Array.isArray(o.o) ? o.o.map(x => String(x).trim()) : [], a: Number(o.a), x: String(o.x || "").trim() || "Açıklama eklenmedi." };
  /* Pasaj (p): yalnız gerçek bir paragrafsa saklanır; "Matematik - Problemler" gibi etiketler öğrenciye pasaj kutusu olarak giderdi. Kök pasaja atıf yapıp pasaj yoksa soru YAZILMAZ. */
  const pas = pasajDegerlendir({ p: o.p, q: aday.q });
  if (pas.hata) return isBitir(env, is, simdi, "gecersiz: " + pas.hata);
  if (pas.p) aday.p = pas.p;
  const bicim = bicimSorunlari(aday);
  if (bicim.length) return isBitir(env, is, simdi, "gecersiz: " + bicim.map(b => b.kod).join(","));
  if (karistir && Array.isArray(aday.o) && aday.o.length === 5 && Number.isInteger(aday.a)) { const k = siklariKaristir(aday, karistir); if (k.karisti) aday = { ...aday, o: k.o, a: k.a }; }
  const y = await soruYazKanonik(env, aday);   // varsayılan 'taslak'; canlı durum burada İMKÂNSIZ
  if (y.durum === "gecersiz") return isBitir(env, is, simdi, "gecersiz: " + (y.hata || []).join("; ").slice(0, 120));
  if (y.durum !== "yazildi" && y.durum !== "kopya") return isBitir(env, is, simdi, y.durum);
  const p = await env.DB.prepare("SELECT durum FROM fabrika_pilot WHERE id = ?").bind(is.pilot_id).first();
  await taslagiKuyrugaAl(env, { id: y.id, pilotId: is.pilot_id, ders: is.ders, konu: is.konu, simdi, denetimIsiYaz: !p || p.durum === "calisiyor", uretimCagriId: r.cagriId });   // pilot durdurulduysa yeni denetim başlatılmaz
  await isBitir(env, is, simdi, null);
}
async function denetleIsle(env, claudeFn, is, simdi) {
  const row = await env.DB.prepare("SELECT s.govde, s.a AS anahtar, f.surum FROM soru s JOIN fabrika_soru f ON f.soru_id = s.id WHERE s.id = ?").bind(is.soru_id).first();
  if (!row) return isBitir(env, is, simdi, "soru_yok");
  let g; try { g = JSON.parse(row.govde); } catch (e) { return isBitir(env, is, simdi, "govde_bozuk"); }
  const r = await cagriYap(env, claudeFn, { is, tur: "denetim", model: modelAdi(env, "denetim"), prompt: denetimIstemi({ p: g.p, q: g.q, o: g.o }), max_tokens: 1500, soruId: is.soru_id, surum: row.surum });
  if (r.hata) return isBitir(env, is, simdi, r.hata, r.bekle_ms);
  const j = jsonAyikla(r.metin), nesne = j && typeof j === "object" && !Array.isArray(j);
  const cevapGecerli = nesne && (j.cevap === null || (Number.isInteger(j.cevap) && j.cevap >= 0 && j.cevap <= 4));
  /* 'gecti' için denetçi tek_dogru === true VE belirsiz === false (boolean, açıkça) bildirmeli ve sorunlar dizisi bulunmalı.
     Eksik/yanlış tipli alan asla 'gecti' vermez. Sorunlar {tur, agirlik, metin} olarak yapılandırılır: yalnız açıkça agirlik="ince_ayar" olan çeldirici/düzey notları
     'gecti'yi engellemez (notlar denetim kaydında ve panelde görünür kalır); engelleyici, türü/ağırlığı belirtilmemiş (eski düz metin dahil) ya da diğer türlerdeki her sorun
     revizyona gider. 'gecti' bir insan uzman onayı DEĞİLDİR; yayım kapısı ayrıca uyarılara ve uzman notlarına bakar (yayimKarari). */
  let karar, ayrinti;
  if (!nesne || !cevapGecerli) { karar = "belirsiz"; ayrinti = { neden: "denetci_ciktisi_cozumlenemedi" }; }
  else {
    const dizi = Array.isArray(j.sorunlar), turler = dizi ? sorunlariCoz(j.sorunlar) : [];
    /* Kural tabanlı biçim denetimi: denetçi göremese/yazmasa bile işaretsiz "altı çizili" gibi kesin biçim hataları engelleyicidir. */
    for (const b of bicimSorunlari(g)) turler.push({ tur: "bicim", agirlik: "engelleyici", metin: b.mesaj, kaynak: "kural" });
    const gp = String(g.p || "").trim(); if (gp && !gercekPasajMi(gp)) turler.push({ tur: "bicim", agirlik: "engelleyici", metin: "Pasaj (p) alanı gerçek bir metin değil, etiket gibi.", kaynak: "kural" });
    const sorunlar = turler.map(x => x.metin);
    ayrinti = { cevap: j.cevap, tek_dogru: j.tek_dogru, belirsiz: j.belirsiz, sorunlar, sorun_turleri: turler, anahtarla_uyum: j.cevap === row.anahtar };
    if (j.cevap === null || j.belirsiz === true) karar = "belirsiz";
    else if (j.tek_dogru === false) karar = "ret";
    else if (j.tek_dogru !== true || j.belirsiz !== false || !dizi) { karar = "belirsiz"; ayrinti.neden = "zorunlu_alan_eksik_ya_da_tipi_yanlis"; }
    else if (j.cevap !== row.anahtar) karar = "revizyon";
    else if (turler.some(x => !inceAyarMi(x))) karar = "revizyon";   // engelleyici / türü ya da ağırlığı belirtilmemiş / çeldirici-düzey dışı her sorun
    else karar = "gecti";                                           // yalnız açıkça "ince_ayar" çeldirici/düzey notları varsa: geçer, notlar görünür kalır
  }
  await env.DB.prepare("UPDATE fabrika_soru SET model_durum = ?, denetim_tam = 1, asama = 'inceleme', denetim_json = ?, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(karar, JSON.stringify(ayrinti), simdi, is.soru_id).run();
  await isBitir(env, is, simdi, null);
}

/* Bir turda en çok `azami` iş işler. claudeFn: async ({tur, model, prompt, max_tokens}) → {metin, giris, cikis} | {hata, bekle_ms?} */
export async function isIsle(env, { claudeFn, azami = 3, simdi = Date.now, karistir = null } = {}) {
  await fabrikaSema(env);
  if (!(await robotAcikMi(env))) return { islenen: 0, neden: "robot_kapali" };
  await env.DB.prepare("UPDATE fabrika_is SET durum = 'iptal', guncelleme = ?1 WHERE durum = 'calisiyor' AND kilit_bitis < ?1 AND pilot_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM fabrika_pilot p WHERE p.id = fabrika_is.pilot_id AND p.durum = 'calisiyor')").bind(simdi()).run();
  let islenen = 0;
  while (islenen < azami) {
    if (await kotaDolduMu(env)) return { islenen, neden: "gunluk_kota" };
    const t = simdi(), is = await isAl(env, t);
    if (!is) break;
    try { if (is.tur === "uret") await uretIsle(env, claudeFn, is, t, karistir); else if (is.tur === "denetle") await denetleIsle(env, claudeFn, is, t); else await isBitir(env, is, t, "bilinmeyen_tur"); }
    catch (e) { await isBitir(env, is, t, "istisna: " + String(e && e.message || e)); }   // iş kilitte takılı kalmasın
    await pilotBitirmeyiDene(env, is.pilot_id);
    islenen++;
  }
  return { islenen };
}

/* ---- panel verisi ---- */
export async function fabrikaDurum(env) {
  const h = await fabrikaHazirMi(env); if (!h.hazir) return { hazir: false, eksik: h.eksik };   // GET: tablo kurmaz
  const robotOku = async () => { const r = await env.DB.prepare("SELECT v FROM fabrika_ayar WHERE k = 'robot'").first(); return !!r && r.v === "1"; };
  const c = async w => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM fabrika_soru WHERE ${w}`).first()).n;
  const sayilar = {
    uretilen: await c("1=1"), model_gecti: await c("model_durum = 'gecti'"), revizyon: await c("model_durum = 'revizyon'"), ret: await c("model_durum = 'ret'"),
    belirsiz: await c("model_durum = 'belirsiz'"), denetim_eksik: await c("denetim_tam = 0 AND tekrar = 0"), tekrar: await c("tekrar = 1"),
    yayinda: await c("asama = 'yayinda'"), red: await c("yayim_durum = 'red'"),
    /* ÜÇ AYRI kayıt: model denetimi (model_gecti), branş uzmanı (uzman_*), yönetici yayımı (yonetici_yayimladi). Eski kayıtlar geriye dönük uzman onaylı SAYILMAZ. */
    uzman_kabul: await c(`EXISTS (SELECT 1 FROM fabrika_uzman u JOIN soru s ON s.id = u.soru_id WHERE u.soru_id = fabrika_soru.soru_id AND u.karar = 'kabul' AND u.icerik_h = s.h) AND NOT EXISTS (SELECT 1 FROM fabrika_uzman u WHERE u.soru_id = fabrika_soru.soru_id AND u.karar = 'red')`),
    uzman_red: await c("EXISTS (SELECT 1 FROM fabrika_uzman u WHERE u.soru_id = fabrika_soru.soru_id AND u.karar = 'red')"), yonetici_yayimladi: await c("yayim_durum = 'onayli'")
  };
  const pilot = await env.DB.prepare("SELECT * FROM fabrika_pilot ORDER BY baslangic DESC LIMIT 1").first();
  const kuyruk = {}; for (const r of (await env.DB.prepare("SELECT durum, COUNT(*) AS n FROM fabrika_is GROUP BY durum").all()).results || []) kuyruk[r.durum] = r.n;
  const cg = (await env.DB.prepare("SELECT model, SUM(giris) AS giris, SUM(cikis) AS cikis, COUNT(*) AS n, SUM(CASE WHEN hata IS NOT NULL THEN 1 ELSE 0 END) AS hata FROM fabrika_cagri GROUP BY model").all()).results || [];
  const cagri = { toplam: 0, hata: 0, giris: 0, cikis: 0, usd: 0, fiyatsizCagri: 0, fiyatsizModeller: [] };
  for (const r of cg) { cagri.toplam += r.n; cagri.hata += r.hata; cagri.giris += r.giris; cagri.cikis += r.cikis; }
  Object.assign(cagri, usdToplam(env, cg));
  const bugun = (await env.DB.prepare("SELECT COUNT(*) AS n FROM fabrika_cagri WHERE gun = ?").bind(gunTR()).first()).n;
  return { robot: await robotOku(), pilot: pilot || null, sayilar, kuyruk, cagri, gunlukCagri: bugun, gunlukLimit: gunlukLimit(env), sayisalDogrulama: "yapilmadi", pilotAzami: PILOT_AZAMI };
}
export async function adaylar(env) {
  if (!(await fabrikaHazirMi(env)).hazir) return [];   // GET: tablo kurmaz
  const { results } = await env.DB.prepare(`SELECT s.id, s.s, s.t, s.d, s.h, s.json, f.model_durum, f.denetim_tam, f.tekrar, f.sayisal, f.surum, f.asama, f.denetim_json
    FROM fabrika_soru f JOIN soru s ON s.id = f.soru_id WHERE f.yayim_durum = 'yok' AND f.asama IN ('inceleme','denetim_eksik','denetim_bekliyor','tekrar') ORDER BY f.olusturma, s.id LIMIT 200`).all();
  const liste = (results || []).map(r => { let q = {}; try { q = JSON.parse(r.json) || {}; } catch (e) { } let den = null; try { den = r.denetim_json ? JSON.parse(r.denetim_json) : null; } catch (e) { }
    return { id: r.id, s: r.s, t: r.t, d: r.d, p: q.p || "", q: q.q, o: q.o, a: q.a, x: q.x, model_durum: r.model_durum, denetim_tam: r.denetim_tam, tekrar: r.tekrar, sayisal: r.sayisal, surum: r.surum, asama: r.asama, denetim: den }; });
  /* İnceleme uyarıları OKUMA anında hesaplanır; soru kaydına/model kararına/tekrar alanına yazılmaz ve hiçbir soruyu silmez. Benzerlik yalnız bu liste içindedir (dış havuz karşılaştırması yok). */
  const benz = benzerlikUyarilari(liste), notlar = {};
  for (const n of (await env.DB.prepare("SELECT id, soru_id, tur, mesaj, durum, olusturan, olusturma, kapatan, kapanis, kapanis_notu FROM fabrika_not ORDER BY olusturma").all()).results || []) (notlar[n.soru_id] = notlar[n.soru_id] || []).push(n);
  const uz = await uzmanDurumlari(env, (results || []).map(r => [r.id, r.h]));
  return liste.map(k => ({ ...k, uyarilar: [...tekilUyarilar(k), ...(benz[k.id] || [])], notlar: notlar[k.id] || [], uzman: uz[k.id] }));
}

/* Uzman durumu: 'red' (kesin) > 'kabul' (yalnız ŞU ANKİ içeriğe/h bağlı kayıt) > 'yok'. Notu kapatmak durumu DEĞİŞTİRMEZ. */
async function uzmanDurumlari(env, idH) {
  const cikti = {}; for (const [id] of idH) cikti[id] = { durum: "yok" };
  const rows = (await env.DB.prepare("SELECT soru_id, karar, icerik_h, uzman_ad, brans, gerekce, tarih, kaydeden FROM fabrika_uzman ORDER BY kayit").all()).results || [], hMap = new Map(idH);
  for (const r of rows) { const o = cikti[r.soru_id]; if (!o || o.durum === "red") continue;
    if (r.karar === "red") cikti[r.soru_id] = { durum: "red", uzman_ad: r.uzman_ad, brans: r.brans, gerekce: r.gerekce, tarih: r.tarih, kaydeden: r.kaydeden };
    else if (r.icerik_h === hMap.get(r.soru_id)) cikti[r.soru_id] = { durum: "kabul", uzman_ad: r.uzman_ad, brans: r.brans, gerekce: r.gerekce, tarih: r.tarih, kaydeden: r.kaydeden }; }
  return cikti;
}
export async function uzmanKarari(env, { soruId, karar, uzmanAd, brans, gerekce, tarih, kaydeden } = {}) {
  await fabrikaSema(env);
  const t = x => String(x == null ? "" : x).trim(), ad = t(uzmanAd), br = t(brans), ge = t(gerekce), kd = t(kaydeden);
  if (karar !== "kabul" && karar !== "red") return { ok: false, neden: "karar_gecersiz" };
  if (ad.length < 2) return { ok: false, neden: "uzman_ad_eksik" };
  if (!br) return { ok: false, neden: "brans_eksik" };
  if (ge.length < 15) return { ok: false, neden: "gerekce_kisa" };
  const ms = typeof tarih === "number" ? tarih : (/^\d{4}-\d{2}-\d{2}/.test(t(tarih)) ? Date.parse(t(tarih)) : NaN);
  if (!Number.isFinite(ms) || ms <= 0 || ms > Date.now() + 43200000) return { ok: false, neden: "tarih_gecersiz" };   // gelecek tarih olmaz (12 sa saat dilimi payı)
  if (!kd) return { ok: false, neden: "kaydeden_eksik" };
  const r = await env.DB.prepare("SELECT f.surum, f.yayim_durum, s.h, s.durum, s.a, s.x, s.d FROM fabrika_soru f JOIN soru s ON s.id = f.soru_id WHERE f.soru_id = ?").bind(t(soruId)).first();
  if (!r) return { ok: false, neden: "kayit_yok" };
  if (r.yayim_durum !== "yok" || r.durum !== "taslak") return { ok: false, neden: "karar_verilmis" };
  if (await env.DB.prepare("SELECT 1 AS v FROM fabrika_uzman WHERE soru_id = ? AND karar = 'red'").bind(t(soruId)).first()) return { ok: false, neden: "uzman_reddetmis" };
  const id = "uz-" + rastgele(6);
  /* Uzman kaydı + aynı içeriğin (h, a, x, d) bağlam anlık görüntüsü TEK batch'te: çözüm metni ya da güçlük sonradan değişirse çevrimdışı yol bu kabulü tanımaz. */
  await env.DB.batch([
    env.DB.prepare("INSERT INTO fabrika_uzman (id, soru_id, surum, icerik_h, karar, uzman_ad, brans, gerekce, tarih, kayit, kaydeden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, t(soruId), r.surum, r.h, karar, ad.slice(0, 120), br.slice(0, 120), ge.slice(0, 1000), ms, Date.now(), kd.slice(0, 120)),
    env.DB.prepare("INSERT INTO fabrika_uzman_baglam (uzman_id, soru_id, icerik_h, tam_h, a, x, d, kayit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, t(soruId), r.h, await tamHash(r), r.a, r.x == null ? "" : r.x, r.d, Date.now())]);
  return { ok: true, id };
}

/* ---- inceleme notları (ör. uzman kararı bekliyor): soru kaydına dokunmaz; açık not varken yayım HİÇBİR bayrakla açılmaz ---- */
const NOT_TURLERI = ["uzman_bekliyor"];
export async function notEkle(env, { soruId, tur, mesaj, kim } = {}) {
  await fabrikaSema(env);
  const m = String(mesaj == null ? "" : mesaj).trim();
  if (!NOT_TURLERI.includes(tur)) return { ok: false, neden: "tur_gecersiz" };
  if (!m) return { ok: false, neden: "mesaj_bos" };
  const var_ = await env.DB.prepare("SELECT 1 AS v FROM fabrika_soru WHERE soru_id = ?").bind(String(soruId || "")).first();
  if (!var_) return { ok: false, neden: "kayit_yok" };
  const id = "not-" + rastgele(6);
  await env.DB.prepare("INSERT INTO fabrika_not (id, soru_id, tur, mesaj, durum, olusturan, olusturma) VALUES (?, ?, ?, ?, 'acik', ?, ?)").bind(id, String(soruId), tur, m.slice(0, 500), String(kim || "").slice(0, 120), Date.now()).run();
  return { ok: true, id };
}
export async function notKapat(env, { notId, kim, gerekce } = {}) {
  await fabrikaSema(env);
  const g = String(gerekce == null ? "" : gerekce).trim();
  if (!g) return { ok: false, neden: "gerekce_bos" };
  const r = await env.DB.prepare("UPDATE fabrika_not SET durum = 'kapali', kapatan = ?, kapanis = ?, kapanis_notu = ? WHERE id = ? AND durum = 'acik'").bind(String(kim || "").slice(0, 120), Date.now(), g.slice(0, 500), String(notId || "")).run();
  return (r.meta && r.meta.changes) ? { ok: true } : { ok: false, neden: "not_yok_ya_da_kapali" };
}
export async function cagrilar(env, limit = 100) {   // usd: fiyatı bilinmeyen modelde null
  if (!(await fabrikaHazirMi(env)).hazir) return [];   // GET: tablo kurmaz
  const { results } = await env.DB.prepare("SELECT id, is_id, tur, soru_id, surum, model, giris, cikis, sure_ms, hata, tarih FROM fabrika_cagri ORDER BY tarih DESC LIMIT ?").bind(Math.min(500, limit)).all();
  return (results || []).map(r => ({ ...r, usd: usdHesapla(env, r.model, r.giris, r.cikis) }));
}

/* ---- yönetici yayım kararı: canlı bankaya giden TEK yol ---- */
const GECIT_SQL = `AND EXISTS (SELECT 1 FROM fabrika_soru f WHERE f.soru_id = soru.id AND f.asama = 'inceleme' AND f.model_durum = 'gecti' AND f.denetim_tam = 1 AND f.tekrar = 0 AND f.yayim_durum = 'yok')
  AND EXISTS (SELECT 1 FROM fabrika_uzman u WHERE u.soru_id = soru.id AND u.karar = 'kabul' AND u.icerik_h = soru.h)
  AND NOT EXISTS (SELECT 1 FROM fabrika_uzman u WHERE u.soru_id = soru.id AND u.karar = 'red')
  AND NOT EXISTS (SELECT 1 FROM fabrika_not n WHERE n.soru_id = soru.id AND n.tur = 'uzman_bekliyor' AND n.durum = 'acik')
  AND NOT EXISTS (SELECT 1 FROM soru z WHERE z.h = soru.h AND z.id != soru.id AND z.durum IN ('banka','onayli'))`;
export async function yayimKarari(env, ids, karar, kim, { uyariKabul = false, cevrimdisiKabul = false } = {}) {
  await fabrikaSema(env);
  if (karar !== "yayin" && karar !== "red") return { ok: false, hatalar: [{ id: "*", neden: "karar_gecersiz" }] };   // geçersiz değer ASLA otomatik red sayılmaz
  ids = [...new Set([].concat(ids || []).map(String))].slice(0, 100);
  if (!ids.length) return { ok: false, hatalar: [{ id: "*", neden: "id_yok" }] };
  const hatalar = [], rows = {};
  for (const id of ids) {
    const r = await env.DB.prepare("SELECT f.*, s.durum AS soru_durum FROM fabrika_soru f JOIN soru s ON s.id = f.soru_id WHERE f.soru_id = ?").bind(id).first();
    rows[id] = r;
    if (!r) { hatalar.push({ id, neden: "kayit_yok" }); continue; }
    if (r.yayim_durum !== "yok") { hatalar.push({ id, neden: "karar_verilmis" }); continue; }
    if (r.soru_durum !== "taslak") { hatalar.push({ id, neden: "taslak_degil" }); continue; }
    if (karar !== "yayin") continue;
    /* Çevrimdışı yol YALNIZ sunucu bayrağı (AKE_CEVRIMDISI_YAYIM=1) + isteğin açık cevrimdisiKabul:true değeri + model_durum='cevrimdisi_gecti' iken: ücretli model denetimi YAPILMIŞ sayılmaz. */
    const cdYol = cevrimdisiKabul === true && yolAcikMi(env) && r.model_durum === "cevrimdisi_gecti";
    r._cd = cdYol;
    if (r.tekrar) hatalar.push({ id, neden: "tekrar" });
    else if (cdYol) {
      if (r.asama !== "inceleme") hatalar.push({ id, neden: "asama_uygun_degil:" + r.asama });
      else for (const e of await cevrimdisiEksikler(env, id)) hatalar.push({ id, neden: e });
    }
    else if (!r.denetim_tam) hatalar.push({ id, neden: "denetim_tamamlanmadi" });
    else if (r.model_durum !== "gecti") hatalar.push({ id, neden: "model_gecmedi:" + r.model_durum });
    else if (r.asama !== "inceleme") hatalar.push({ id, neden: "asama_uygun_degil:" + r.asama });
  }
  /* Uzman kapısı (yalnız yayın): geçerli, içeriğe bağlı uzman kabulü ŞART. "uyariKabul" ve notu kapatmak bunun yerine GEÇMEZ. Asıl zorlama aşağıdaki atomik SQL geçidi + tetikleyicidir. */
  if (karar === "yayin") {
    const idH = []; for (const id of ids) if (rows[id]) idH.push([id, (await env.DB.prepare("SELECT h FROM soru WHERE id = ?").bind(id).first() || {}).h]);
    const ud = await uzmanDurumlari(env, idH);
    for (const [id] of idH) {
      if (ud[id].durum === "red") hatalar.push({ id, neden: "uzman_reddetti" });
      else if (ud[id].durum !== "kabul") hatalar.push({ id, neden: "uzman_karari_yok" });
      if ((await env.DB.prepare("SELECT 1 AS v FROM fabrika_not WHERE soru_id = ? AND tur = 'uzman_bekliyor' AND durum = 'acik'").bind(id).first())) hatalar.push({ id, neden: "uzman_bekliyor" });
    }
  }
  /* Uyarı kapısı (yalnız yayın): açık uzman notu HİÇBİR bayrakla geçilmez; sert biçim/pasaj uyarıları da geçilmez; yumuşak uyarılar (benzerlik, kaynak doğrulaması)
     yöneticinin açık "uyariKabul" kararını ister. Bu kabul bir İNSAN UZMAN ONAYI DEĞİLDİR ve model kararını değiştirmez. */
  if (karar === "yayin" && !hatalar.length) {
    const uz = new Map((await adaylar(env)).map(a => [a.id, a]));
    for (const id of ids) {
      const a = uz.get(id); if (!a) continue;
      if ((a.notlar || []).some(n => n.durum === "acik" && n.tur === "uzman_bekliyor")) { hatalar.push({ id, neden: "uzman_bekliyor" }); continue; }
      for (const u of a.uyarilar || []) if (sertUyariMi(u.tur) || !uyariKabul) hatalar.push({ id, neden: "inceleme_uyarisi:" + u.tur });
    }
  }
  if (hatalar.length) return { ok: false, hatalar };
  const simdi = Date.now(), k = String(kim || "").slice(0, 120);
  if (karar === "red") {
    const st = []; for (const id of ids) { st.push(env.DB.prepare("UPDATE soru SET durum = 'red', karar = ? WHERE id = ? AND durum = 'taslak'").bind(simdi, id)); st.push(env.DB.prepare("UPDATE fabrika_soru SET yayim_durum = 'red', asama = 'red', yayim_kim = ?, yayim_tarih = ?, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(k, simdi, simdi, id)); }
    await env.DB.batch(st); return { ok: true, n: ids.length, red: ids.length };
  }
  const cdSayi = ids.filter(id => rows[id] && rows[id]._cd).length;
  if (cdSayi && cdSayi !== ids.length) return { ok: false, hatalar: [{ id: "*", neden: "karma_yol: cevrimdisi ve model denetimi ayni istekte olamaz" }] };
  const r = await soruOnayla(env, ids, { onceki: "taslak", ek: cdSayi ? GECIT_CEVRIMDISI_SQL : GECIT_SQL, sonra: id => env.DB.prepare("UPDATE fabrika_soru SET yayim_durum = 'onayli', asama = 'yayinda', yayim_kim = ?, yayim_tarih = ?, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(k, simdi, simdi, id) });
  if (!r.ok) return { ok: false, hatalar: r.hatalar };
  return { ok: true, n: ids.length, yayimlanan: r.onaylanan };
}
