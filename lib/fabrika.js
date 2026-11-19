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

export const PILOT_AZAMI = 10;
const IS_AZAMI_DENEME = 3, KILIT_MS = 180000, GERI_ILK_MS = 30000, GERI_TAVAN_MS = 300000;
const VARSAYILAN_GUNLUK_CAGRI = 40;
const KONULAR = [["mat", "Sayılar"], ["turkce", "Sözcükte anlam"], ["turkce", "Deyimler"], ["mat", "Problemler"], ["edebiyat", "Divan edebiyatı"], ["ingilizce", "Tenses"]];

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
  semaHazir.add(d);
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
  const i = await env.DB.prepare("UPDATE fabrika_is SET durum = 'iptal', guncelleme = ? WHERE durum = 'bekliyor'").bind(simdi).run();
  return { ok: true, durdurulanPilot: (p.meta && p.meta.changes) || 0, iptalIs: (i.meta && i.meta.changes) || 0 };
}
async function pilotBitirmeyiDene(env, pilotId) {
  if (!pilotId) return;
  await env.DB.prepare("UPDATE fabrika_pilot SET durum = 'bitti', bitis = ? WHERE id = ? AND durum = 'calisiyor' AND NOT EXISTS (SELECT 1 FROM fabrika_is WHERE pilot_id = ? AND durum IN ('bekliyor','calisiyor'))").bind(Date.now(), pilotId, pilotId).run();
}

/* ---- istemler ---- */
const uretimIstemi = (ders, konu, ornekler = []) => `YKS ${ders} dersi, "${konu}" konusu için 1 adet orta seviyede, özgün çoktan seçmeli soru yaz.
Kurallar:
- ÖSYM soru tarzına ve 2026-2027 YKS müfredatına uy; hiçbir kaynaktan soru kopyalama, bilinen bir sorunun sayılarını/adlarını değiştirip yeniden üretme.
- Tam 5 seçenek ve yalnızca bir kesin doğru cevap olsun; seçenekler birbirinden farklı, makul ve güçlü çeldiriciler olsun.
- Sayısal sorularda sonucu iki kez hesapla. Sözel sorularda tartışmalı ya da yoruma açık bilgi kullanma.
- Soru ve seçenekler Türkçe olsun (İngilizce dersinde soru ve seçenekler İngilizce, açıklama Türkçe). Matematiği düz metinle yaz: x^2, √x, a/b. Şekil gerektiren soru yazma.
- Açıklama 2-4 cümle olsun ve çözümü adım adım göstersin.
Yalnızca JSON dizisi döndür: [{"p":"","q":"Soru metni","o":["…","…","…","…","…"],"a":2,"x":"Açıklama"}]
"a", doğru seçeneğin 0-4 arası sırasıdır.${ornekler.length ? "\n" + ornekler.join("\n") : ""}`;

/* KÖR denetim: yalnız soru metni (varsa pasaj) ve beş seçenek verilir. Cevap anahtarı, çözüm, üretici notu ve konu/zorluk etiketi YOK. */
export const denetimIstemi = ({ p, q, o }) => `Aşağıdaki çoktan seçmeli YKS sorusunu bağımsız olarak çöz ve kalitesini denetle. Soruyu ilk kez görüyorsun.

${p ? "PASAJ:\n" + p + "\n\n" : ""}SORU:
${q}

SEÇENEKLER:
${o.map((x, i) => "ABCDE"[i] + ") " + x).join("\n")}

Görevin: soruyu kendin çöz, hangi şıkkın kesin doğru olduğunu belirle. Birden fazla şık doğru sayılabiliyorsa ya da hiçbiri kesin doğru değilse bunu belirt. Eksik veri, belirsiz ifade, yanlış/tartışmalı bilgi ve zayıf çeldiriciler varsa "sorunlar" listesine yaz.
Yalnızca şu JSON nesnesini döndür:
{"cevap": 0-4 arası seçtiğin şıkkın sırası (A=0) ya da kesin cevap yoksa null, "tek_dogru": true/false, "belirsiz": true/false, "sorunlar": ["kısa sorun cümleleri"]}`;

const kuyrukaYaz = (env, tur, soruId, pilotId, ders, konu, simdi) =>
  env.DB.prepare("INSERT INTO fabrika_is (id, tur, soru_id, pilot_id, ders, konu, durum, deneme, azami, sonraki, olusturma, guncelleme) VALUES (?, ?, ?, ?, ?, ?, 'bekliyor', 0, ?, ?, ?, ?)").bind("is-" + rastgele(6), tur, soruId, pilotId, ders, konu, IS_AZAMI_DENEME, simdi, simdi, simdi).run();

/* ---- fiyat (tahmin DEĞİL, yalnızca kaydedilmiş token × env'deki liste fiyatı; gerçek fatura Anthropic Console'dadır) ---- */
export function usdHesapla(env, model, giris, cikis) {
  const guclu = /guclu|sonnet|opus|fable|mythos/i.test(String(model || ""));
  const [gi, ci] = guclu ? [+env.AKE_FIYAT_GUCLU_GIRIS || 3, +env.AKE_FIYAT_GUCLU_CIKIS || 15] : [+env.AKE_FIYAT_HIZLI_GIRIS || 1, +env.AKE_FIYAT_HIZLI_CIKIS || 5];
  return ((giris || 0) * gi + (cikis || 0) * ci) / 1e6;
}

/* ---- işçi ---- */
const gunlukLimit = env => { const n = parseInt(env.AKE_FABRIKA_GUNLUK_CAGRI, 10); return Number.isFinite(n) && n >= 0 ? n : VARSAYILAN_GUNLUK_CAGRI; };
async function kotaDolduMu(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM fabrika_cagri WHERE gun = ?").bind(gunTR()).first();
  return ((r && r.n) || 0) >= gunlukLimit(env);
}
async function isAl(env, simdi) {
  const kimlik = rastgele(6), kosul = "((durum = 'bekliyor' AND sonraki <= ?1) OR (durum = 'calisiyor' AND kilit_bitis < ?1))";
  return await env.DB.prepare(`UPDATE fabrika_is SET durum = 'calisiyor', kilit_bitis = ?2, kilit_kimlik = ?3, guncelleme = ?1
    WHERE id = (SELECT id FROM fabrika_is WHERE ${kosul} ORDER BY sonraki, olusturma LIMIT 1) AND ${kosul} RETURNING *`).bind(simdi, simdi + KILIT_MS, kimlik).first();
}
async function isBitir(env, is, simdi, hata, beklemeMs) {
  if (!hata) { await env.DB.prepare("UPDATE fabrika_is SET durum = 'bitti', hata = NULL, guncelleme = ? WHERE id = ? AND kilit_kimlik = ?").bind(simdi, is.id, is.kilit_kimlik).run(); return; }
  const deneme = (is.deneme || 0) + 1;
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
  await env.DB.prepare("INSERT INTO fabrika_cagri (id, is_id, tur, soru_id, surum, model, giris, cikis, sure_ms, hata, tarih, gun) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("cg-" + rastgele(6), is.id, tur, soruId || null, surum || null, model, r.giris || 0, r.cikis || 0, Date.now() - t0, r.hata ? String(r.hata).slice(0, 200) : null, Date.now(), gunTR()).run();
  return r;
}
const modelAdi = (env, tur) => (tur === "uretim" ? env.AKE_FABRIKA_MODEL_URETIM : env.AKE_FABRIKA_MODEL_DENETIM) || "claude-sonnet-5-5";

/* Bir taslağı hatta alır: fabrika kaydı + (tekrar değilse) kör denetim işi. soru-uret (yönetim) ve robot üretimi AYNI yolu kullanır.
   tekrar: canlı bankada ya da daha önce yazılmış taslakta aynı kanonik gövde (h) varsa; sıralama rowid'dir (eşzamanlı yazımda da kararlı). */
export async function taslagiKuyrugaAl(env, { id, pilotId = null, ders, konu, simdi = Date.now(), denetimIsiYaz = true }) {
  await fabrikaSema(env);
  const s = await env.DB.prepare("SELECT h, kopya_of FROM soru WHERE id = ?").bind(id).first();
  const dup = await env.DB.prepare("SELECT 1 AS v FROM soru WHERE h = ? AND id != ? AND (durum IN ('banka','onayli') OR (durum = 'taslak' AND rowid < (SELECT rowid FROM soru WHERE id = ?))) LIMIT 1").bind(s.h, id, id).first();
  const tekrar = !!(dup || s.kopya_of);
  await env.DB.prepare("INSERT INTO fabrika_soru (soru_id, pilot_id, surum, asama, model_durum, denetim_tam, tekrar, sayisal, olusturma, guncelleme) VALUES (?, ?, 1, ?, 'bekliyor', 0, ?, 'yapilmadi', ?, ?)")
    .bind(id, pilotId, tekrar ? "tekrar" : "denetim_bekliyor", tekrar ? 1 : 0, simdi, simdi).run();
  if (!tekrar && denetimIsiYaz) await kuyrukaYaz(env, "denetle", id, pilotId, ders, konu, simdi);
  return { tekrar };
}

async function uretIsle(env, claudeFn, is, simdi) {
  const r = await cagriYap(env, claudeFn, { is, tur: "uretim", model: modelAdi(env, "uretim"), prompt: uretimIstemi(is.ders, is.konu), max_tokens: 4000, surum: 1 });
  if (r.hata) return isBitir(env, is, simdi, r.hata, r.bekle_ms);
  const dizi = jsonAyikla(r.metin), o = Array.isArray(dizi) ? dizi[0] : null;
  if (!o || typeof o !== "object") return isBitir(env, is, simdi, "uretim_cozumlenemedi");
  const aday = { s: is.ders, t: is.konu, d: 2, q: String(o.q || "").trim(), o: Array.isArray(o.o) ? o.o.map(x => String(x).trim()) : [], a: Number(o.a), x: String(o.x || "").trim() || "Açıklama eklenmedi." };
  if (typeof o.p === "string" && o.p.trim()) aday.p = o.p.trim();
  const y = await soruYazKanonik(env, aday);   // varsayılan 'taslak'; canlı durum burada İMKÂNSIZ
  if (y.durum === "gecersiz") return isBitir(env, is, simdi, "gecersiz: " + (y.hata || []).join("; ").slice(0, 120));
  if (y.durum !== "yazildi" && y.durum !== "kopya") return isBitir(env, is, simdi, y.durum);
  const p = await env.DB.prepare("SELECT durum FROM fabrika_pilot WHERE id = ?").bind(is.pilot_id).first();
  await taslagiKuyrugaAl(env, { id: y.id, pilotId: is.pilot_id, ders: is.ders, konu: is.konu, simdi, denetimIsiYaz: !p || p.durum === "calisiyor" });
  await isBitir(env, is, simdi, null);
}
async function denetleIsle(env, claudeFn, is, simdi) {
  const row = await env.DB.prepare("SELECT s.govde, s.a AS anahtar, f.surum FROM soru s JOIN fabrika_soru f ON f.soru_id = s.id WHERE s.id = ?").bind(is.soru_id).first();
  if (!row) return isBitir(env, is, simdi, "soru_yok");
  let g; try { g = JSON.parse(row.govde); } catch (e) { return isBitir(env, is, simdi, "govde_bozuk"); }
  const r = await cagriYap(env, claudeFn, { is, tur: "denetim", model: modelAdi(env, "denetim"), prompt: denetimIstemi({ p: g.p, q: g.q, o: g.o }), max_tokens: 1500, soruId: is.soru_id, surum: row.surum });
  if (r.hata) return isBitir(env, is, simdi, r.hata, r.bekle_ms);
  const j = jsonAyikla(r.metin), gecerli = j && typeof j === "object" && !Array.isArray(j) && (j.cevap === null || (Number.isInteger(j.cevap) && j.cevap >= 0 && j.cevap <= 4));
  let karar, ayrinti;
  if (!gecerli) { karar = "belirsiz"; ayrinti = { neden: "denetci_ciktisi_cozumlenemedi" }; }
  else {
    const sorunlar = Array.isArray(j.sorunlar) ? j.sorunlar.map(String).slice(0, 10) : [];
    ayrinti = { cevap: j.cevap, tek_dogru: j.tek_dogru, belirsiz: j.belirsiz, sorunlar, anahtarla_uyum: j.cevap === row.anahtar };
    if (j.cevap === null || j.belirsiz === true) karar = "belirsiz";
    else if (j.tek_dogru === false) karar = "ret";
    else if (j.cevap !== row.anahtar) karar = "revizyon";
    else karar = "gecti";
  }
  await env.DB.prepare("UPDATE fabrika_soru SET model_durum = ?, denetim_tam = 1, asama = 'inceleme', denetim_json = ?, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(karar, JSON.stringify(ayrinti), simdi, is.soru_id).run();
  await isBitir(env, is, simdi, null);
}

/* Bir turda en çok `azami` iş işler. claudeFn: async ({tur, model, prompt, max_tokens}) → {metin, giris, cikis} | {hata, bekle_ms?} */
export async function isIsle(env, { claudeFn, azami = 3, simdi = Date.now } = {}) {
  await fabrikaSema(env);
  if (!(await robotAcikMi(env))) return { islenen: 0, neden: "robot_kapali" };
  let islenen = 0;
  while (islenen < azami) {
    if (await kotaDolduMu(env)) return { islenen, neden: "gunluk_kota" };
    const t = simdi(), is = await isAl(env, t);
    if (!is) break;
    try { if (is.tur === "uret") await uretIsle(env, claudeFn, is, t); else if (is.tur === "denetle") await denetleIsle(env, claudeFn, is, t); else await isBitir(env, is, t, "bilinmeyen_tur"); }
    catch (e) { await isBitir(env, is, t, "istisna: " + String(e && e.message || e)); }   // iş kilitte takılı kalmasın
    await pilotBitirmeyiDene(env, is.pilot_id);
    islenen++;
  }
  return { islenen };
}

/* ---- panel verisi ---- */
export async function fabrikaDurum(env) {
  await fabrikaSema(env);
  const c = async w => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM fabrika_soru WHERE ${w}`).first()).n;
  const sayilar = {
    uretilen: await c("1=1"), model_gecti: await c("model_durum = 'gecti'"), revizyon: await c("model_durum = 'revizyon'"), ret: await c("model_durum = 'ret'"),
    belirsiz: await c("model_durum = 'belirsiz'"), denetim_eksik: await c("denetim_tam = 0 AND tekrar = 0"), tekrar: await c("tekrar = 1"),
    yayinda: await c("asama = 'yayinda'"), insan_onayli: await c("yayim_durum = 'onayli'"), red: await c("yayim_durum = 'red'")
  };
  const pilot = await env.DB.prepare("SELECT * FROM fabrika_pilot ORDER BY baslangic DESC LIMIT 1").first();
  const kuyruk = {}; for (const r of (await env.DB.prepare("SELECT durum, COUNT(*) AS n FROM fabrika_is GROUP BY durum").all()).results || []) kuyruk[r.durum] = r.n;
  const cg = (await env.DB.prepare("SELECT model, SUM(giris) AS giris, SUM(cikis) AS cikis, COUNT(*) AS n, SUM(CASE WHEN hata IS NOT NULL THEN 1 ELSE 0 END) AS hata FROM fabrika_cagri GROUP BY model").all()).results || [];
  const cagri = { toplam: 0, hata: 0, giris: 0, cikis: 0, usd: 0 };
  for (const r of cg) { cagri.toplam += r.n; cagri.hata += r.hata; cagri.giris += r.giris; cagri.cikis += r.cikis; cagri.usd += usdHesapla(env, r.model, r.giris, r.cikis); }
  const bugun = (await env.DB.prepare("SELECT COUNT(*) AS n FROM fabrika_cagri WHERE gun = ?").bind(gunTR()).first()).n;
  return { robot: await robotAcikMi(env), pilot: pilot || null, sayilar, kuyruk, cagri, gunlukCagri: bugun, gunlukLimit: gunlukLimit(env), sayisalDogrulama: "yapilmadi", pilotAzami: PILOT_AZAMI };
}
export async function adaylar(env) {
  await fabrikaSema(env);
  const { results } = await env.DB.prepare(`SELECT s.id, s.s, s.t, s.d, s.json, f.model_durum, f.denetim_tam, f.tekrar, f.sayisal, f.surum, f.asama, f.denetim_json
    FROM fabrika_soru f JOIN soru s ON s.id = f.soru_id WHERE f.yayim_durum = 'yok' AND f.asama IN ('inceleme','denetim_eksik','tekrar') ORDER BY f.olusturma, s.id LIMIT 200`).all();
  return (results || []).map(r => { let q = {}; try { q = JSON.parse(r.json) || {}; } catch (e) { } let den = null; try { den = r.denetim_json ? JSON.parse(r.denetim_json) : null; } catch (e) { }
    return { id: r.id, s: r.s, t: r.t, d: r.d, p: q.p || "", q: q.q, o: q.o, a: q.a, x: q.x, model_durum: r.model_durum, denetim_tam: r.denetim_tam, tekrar: r.tekrar, sayisal: r.sayisal, surum: r.surum, asama: r.asama, denetim: den }; });
}
export async function cagrilar(env, limit = 100) {
  await fabrikaSema(env);
  const { results } = await env.DB.prepare("SELECT id, is_id, tur, soru_id, surum, model, giris, cikis, sure_ms, hata, tarih FROM fabrika_cagri ORDER BY tarih DESC LIMIT ?").bind(Math.min(500, limit)).all();
  return (results || []).map(r => ({ ...r, usd: usdHesapla({}, r.model, r.giris, r.cikis) }));
}

/* ---- yönetici yayım kararı: canlı bankaya giden TEK yol ---- */
const GECIT_SQL = `AND EXISTS (SELECT 1 FROM fabrika_soru f WHERE f.soru_id = soru.id AND f.asama = 'inceleme' AND f.model_durum = 'gecti' AND f.denetim_tam = 1 AND f.tekrar = 0 AND f.yayim_durum = 'yok')
  AND NOT EXISTS (SELECT 1 FROM soru z WHERE z.h = soru.h AND z.id != soru.id AND z.durum IN ('banka','onayli'))`;
export async function yayimKarari(env, ids, karar, kim) {
  await fabrikaSema(env);
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
    if (r.tekrar) hatalar.push({ id, neden: "tekrar" });
    else if (!r.denetim_tam) hatalar.push({ id, neden: "denetim_tamamlanmadi" });
    else if (r.model_durum !== "gecti") hatalar.push({ id, neden: "model_gecmedi:" + r.model_durum });
    else if (r.asama !== "inceleme") hatalar.push({ id, neden: "asama_uygun_degil:" + r.asama });
  }
  if (hatalar.length) return { ok: false, hatalar };
  const simdi = Date.now(), k = String(kim || "").slice(0, 120);
  if (karar === "red") {
    const st = []; for (const id of ids) { st.push(env.DB.prepare("UPDATE soru SET durum = 'red', karar = ? WHERE id = ? AND durum = 'taslak'").bind(simdi, id)); st.push(env.DB.prepare("UPDATE fabrika_soru SET yayim_durum = 'red', asama = 'red', yayim_kim = ?, yayim_tarih = ?, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(k, simdi, simdi, id)); }
    await env.DB.batch(st); return { ok: true, n: ids.length, red: ids.length };
  }
  const r = await soruOnayla(env, ids, { onceki: "taslak", ek: GECIT_SQL, sonra: id => env.DB.prepare("UPDATE fabrika_soru SET yayim_durum = 'onayli', asama = 'yayinda', yayim_kim = ?, yayim_tarih = ?, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(k, simdi, simdi, id) });
  if (!r.ok) return { ok: false, hatalar: r.hatalar };
  return { ok: true, n: ids.length, yayimlanan: r.onaylanan };
}
