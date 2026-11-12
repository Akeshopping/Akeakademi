// AKE Akademi · korumalı soru bankası · yönetim soru yazımı için kanonik çift yazım (PR 3/6)
// KAPILI: yalnız AKE_SORU_V2=1 iken kullanılır. Bayrak kapalıyken çağıran (yönetim) eski legacy davranışını AYNEN çalıştırır; bu modülün
// hiçbir işlevi çağrılmaz, soruKanonikSema/ALTER tetiklenmez.
// Hash/normalize/doğrulama kuralları lib/soru-kanonik.js'tedir; burada ikinci kez yazılmaz.
import { rastgele } from "./ortak.js";
import { soruKanonikSema, dogrulaSoru, kanonikHash, govdeOf, rkUret, normalize } from "./soru-kanonik.js";
import { bayrakAcik, DERSLER } from "./soru-api.js";
export { bayrakAcik };

export const KAYNAK_AI = "ai";
/* Çok adımlı batch'te "assert": koşul sağlanmazsa SQLite 'integer overflow' hatası verir → D1 batch'in tamamı geri alınır. */
const ASSERT = kosul => `SELECT CASE WHEN ${kosul} THEN 0 ELSE abs(-9223372036854775808) END AS tamam`;
/* h eşit kanonik (kopya_of NULL) kayıtlar arasında seçim: kaynak önceliği gomulu < statik < ai, sonra kimlik. Yeni AI soru mevcut kanoniği asla devirmez. */
const KANONIK_SEC = "SELECT id FROM soru WHERE h = ? AND kopya_of IS NULL AND id != ? AND durum IN ('banka','onayli') ORDER BY CASE kaynak WHEN 'gomulu' THEN 0 WHEN 'statik' THEN 1 ELSE 2 END, id LIMIT 1";
const CATISMA = "SELECT 1 FROM soru WHERE h = ? AND kopya_of IS NULL AND id != ? AND durum IN ('banka','onayli') AND (a IS NOT ? OR x IS NOT ?)";

const semaHazir = new WeakSet();
export async function kanonikSemaHazir(env) {   // yalnız bayrak açıkken çağrılır; D1 bağlantısı başına bir kez
  if (semaHazir.has(env.DB)) return;
  await soruKanonikSema(env.DB); semaHazir.add(env.DB);
}

/* q: {id,s,t,d,p?,q,o,a,x} → kanonik alanlar ya da hata listesi. Geçersiz soru kanonik bankaya YAZILMAZ. */
export async function kanonikAlanlar(q, kaynak = KAYNAK_AI) {
  const hata = dogrulaSoru(q, DERSLER);
  if (hata.length) return { hata };
  return { alan: { kaynak, rk: rkUret(), h: await kanonikHash(q), govde: govdeOf(q), a: q.a, x: String(q.x) } };
}
const yeniId = () => "ok-" + rastgele(5);
const cakisma = e => /UNIQUE|PRIMARY KEY|constraint/i.test(String(e && e.message));

/* Tek AI sorusu: legacy json + kanonik kolonlar TEK INSERT'te (yarım çift yazım olamaz).
   kopya_of ve çatışma kararı INSERT'in içinde (aynı ifade, serileştirilmiş D1'de yarışsız) verilir:
     - h eşit ve cevap/çözüm de eşit kanonik var → satır YAZILIR, kopya_of = o kanonik (V2 havuzuna girmez)
     - h eşit ama cevap/çözüm farklı → editoryal ÇATIŞMA: YAZILMAZ ('catisma')
     - id çakışması → üzerine yazılmaz; yeni kimlikle en çok 4 deneme, sonra 'idCakisma'
   Dönüş: { durum: 'yazildi'|'kopya'|'catisma'|'gecersiz'|'idCakisma', id?, kopyaOf?, hata? } */
export async function soruYazKanonik(env, aday, { idUret = yeniId, durum = "onayli", kaynak = KAYNAK_AI } = {}) {
  await kanonikSemaHazir(env);
  for (let deneme = 0; deneme < 4; deneme++) {
    const id = idUret(), q = Object.assign({ id }, aday);   // id önce: legacy json anahtar sırası eskisiyle aynı (id,s,t,d,q,o,a,x,p)
    const k = await kanonikAlanlar(q, kaynak);
    if (k.hata) return { durum: "gecersiz", hata: k.hata };
    const f = k.alan, simdi = Date.now();
    try {
      const r = await env.DB.prepare(`INSERT INTO soru (id, s, t, d, json, durum, tarih, karar, kaynak, rk, h, govde, a, x, kopya_of)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (${KANONIK_SEC}) WHERE NOT EXISTS (${CATISMA})`)
        .bind(id, q.s, q.t, q.d, JSON.stringify(q), durum, simdi, simdi, f.kaynak, f.rk, f.h, f.govde, f.a, f.x, f.h, id, f.h, id, f.a, f.x).run();
      if (!(r && r.meta && r.meta.changes > 0)) return { durum: "catisma", id };
      const s = await env.DB.prepare("SELECT kopya_of FROM soru WHERE id = ?").bind(id).first();
      return s && s.kopya_of ? { durum: "kopya", id, kopyaOf: s.kopya_of } : { durum: "yazildi", id };
    } catch (e) {
      if (!cakisma(e)) throw e;   // id çakışması dışındaki hata yukarı çıkar (sessiz yutulmaz)
    }
  }
  return { durum: "idCakisma" };
}

/* soru-karar 'onay' (bayrak açık): bekleyen satırlar için kanonik alanlar boşsa doldurulur ve onay TEK batch'te uygulanır.
   Hepsi önceden doğrulanır; biri geçersiz/çatışmalıysa HİÇBİRİ onaylanmaz (sessiz kısmi onay yok). Son ifade bir assert'tür:
   batch sonunda hedef satırlardan biri hâlâ 'bekliyor' ise tüm batch geri alınır.
   Dönüş: { ok: true, onaylanan, kopya } ya da { ok: false, hatalar: [{id, neden}] } */
export async function soruOnayla(env, ids) {
  await kanonikSemaHazir(env);
  const hatalar = [], plan = [], bekleyen = [];
  for (const id of ids) {
    const row = await env.DB.prepare("SELECT id, s, t, d, json, h, govde, a, x, rk, kaynak, kopya_of FROM soru WHERE id = ? AND durum = 'bekliyor'").bind(id).first();
    if (!row) continue;                           // bekleyen değil: eski davranış gibi yok sayılır
    bekleyen.push(id);
    const dolu = [row.h, row.govde, row.a, row.x, row.rk, row.kaynak].filter(v => v != null && v !== "").length;
    if (dolu === 6) {                             // kanonik alanlar dolu: "dolu" güvenli demek değildir — tutarlılık yeniden doğrulanır
      let g; try { g = JSON.parse(row.govde); } catch (e) { hatalar.push({ id, neden: "kanonik_tutarsiz: govde bozuk" }); continue; }
      const q = Object.assign({ id: row.id, s: row.s, t: row.t, d: row.d }, g, { a: row.a, x: row.x });
      const hata = dogrulaSoru(q, DERSLER);
      if (hata.length) { hatalar.push({ id, neden: "gecersiz: " + hata.join("; ") }); continue; }
      if (row.h !== await kanonikHash(q)) { hatalar.push({ id, neden: "kanonik_tutarsiz: h govdeyle uyusmuyor" }); continue; }
      plan.push({ id, hazir: true, alan: { h: row.h, a: row.a, x: row.x } }); continue;
    }
    if (dolu > 0) { hatalar.push({ id, neden: "kanonik_tutarsiz: kolonlar yarim dolu" }); continue; }
    let j; try { j = JSON.parse(row.json); } catch (e) { hatalar.push({ id, neden: "json_bozuk" }); continue; }
    if (!j || typeof j !== "object") { hatalar.push({ id, neden: "json_bozuk" }); continue; }
    const q = { id: row.id, s: row.s, t: row.t, d: row.d, q: j.q, o: j.o, a: j.a, x: j.x }; if (typeof j.p === "string" && j.p) q.p = j.p;
    const k = await kanonikAlanlar(q);
    if (k.hata) { hatalar.push({ id, neden: "gecersiz: " + k.hata.join("; ") }); continue; }
    plan.push({ id, alan: k.alan, q });
  }
  /* çatışma: mevcut kanonik satırlarla ve bu istekteki diğer satırlarla (aynı h, farklı cevap/çözüm) — hazır satırlar dahil */
  const gorulen = new Map();
  for (const p of plan) {
    const c = await env.DB.prepare(CATISMA + " LIMIT 1").bind(p.alan.h, p.id, p.alan.a, p.alan.x).first();
    const onceki = gorulen.get(p.alan.h);
    if (c || (onceki && (onceki.a !== p.alan.a || normalize(onceki.x) !== normalize(p.alan.x)))) { hatalar.push({ id: p.id, neden: "catisma: ayni soru govdesi, farkli cevap/cozum" }); continue; }
    if (!onceki) gorulen.set(p.alan.h, { a: p.alan.a, x: p.alan.x });
  }
  if (hatalar.length) return { ok: false, hatalar };
  if (!plan.length) return { ok: true, onaylanan: 0, kopya: 0 };
  const simdi = Date.now(), st = [];
  for (const p of plan) {
    if (p.hazir) {   // kopya_of zaten doluysa korunur; değilse aynı h'li kanonik kayda bağlanır. Çatışma SQL'de de yeniden denetlenir.
      st.push(env.DB.prepare(`UPDATE soru SET durum = 'onayli', karar = ?, kopya_of = COALESCE(kopya_of, (${KANONIK_SEC}))
        WHERE id = ? AND durum = 'bekliyor' AND NOT EXISTS (${CATISMA})`).bind(simdi, p.alan.h, p.id, p.id, p.alan.h, p.id, p.alan.a, p.alan.x));
      continue;
    }
    const f = p.alan;
    st.push(env.DB.prepare(`UPDATE soru SET durum = 'onayli', karar = ?, kaynak = ?, rk = ?, h = ?, govde = ?, a = ?, x = ?, kopya_of = (${KANONIK_SEC})
      WHERE id = ? AND durum = 'bekliyor' AND NOT EXISTS (${CATISMA})`).bind(simdi, f.kaynak, f.rk, f.h, f.govde, f.a, f.x, f.h, p.id, p.id, f.h, p.id, f.a, f.x));
  }
  /* SON ASSERT: başlangıçta bekleyen HER hedef batch sonunda onayli + kanonik tam olmalı (sayım == hedef sayısı). Biri bile eksikse
     (araya giren red/durum değişikliği/silme, çatışmayla no-op olan UPDATE) batch'in tamamı geri alınır. */
  st.push(env.DB.prepare(ASSERT(`(SELECT COUNT(*) FROM soru WHERE id IN (SELECT value FROM json_each(?)) AND durum = 'onayli' AND h IS NOT NULL AND govde IS NOT NULL AND a IS NOT NULL AND x IS NOT NULL AND rk IS NOT NULL AND kaynak IS NOT NULL) = ?`)).bind(JSON.stringify(bekleyen), bekleyen.length));
  try { await env.DB.batch(st); }
  catch (e) { return { ok: false, hatalar: [{ id: "*", neden: "eszamanli_degisiklik: hicbir soru onaylanmadi" }] }; }   // batch geri alındı
  const kop = await env.DB.prepare("SELECT COUNT(*) AS n FROM soru WHERE kopya_of IS NOT NULL AND id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(bekleyen)).first();
  return { ok: true, onaylanan: bekleyen.length, kopya: (kop && kop.n) || 0 };
}
