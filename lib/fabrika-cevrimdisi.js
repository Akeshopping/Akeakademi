// Çevrimdışı inceleme akışı (yönetici): sürümlü içe alma → çevrimdışı inceleme kaydı → (insan) uzman kararı → yayım kararı.
// Bu akış ücretli model denetimi YAPMAZ ve öyle KAYDETMEZ (bkz. fabrika-cevrimdisi-cekirdek.js). Üretim/denetim API çağrısı yoktur.
import { rastgele } from "./ortak.js";
import { fabrikaSema, fabrikaHazirMi } from "./fabrika.js";
import { soruYazKanonik, kanonikAlanlar } from "./soru-yaz.js";
import { CEVRIMDISI_KAYNAK, KAPSAM_ANAHTARLARI, tamHash, cevrimdisiEksikler } from "./fabrika-cevrimdisi-cekirdek.js";
export { CEVRIMDISI_KAYNAK, KAPSAM_ANAHTARLARI };

const t = x => String(x == null ? "" : x).trim();
export const CEVRIMDISI_PILOT = "cevrimdisi-paket1";

/* kayit: {id, s, t, d, q, o[5], a, x, p?}. Yoksa taslak olarak yazılır; taslak olarak varsa ve içerik FARKLIYSA yeni sürüm olarak güncellenir (eski/yeni json fabrika_surum'da saklanır,
   eski içeriğe bağlı inceleme/uzman kayıtları otomatik geçersiz kalır). Taslak dışı satıra ve karar verilmiş soruya DOKUNULMAZ. */
export async function cevrimdisiIceAl(env, { kayit, neden, kaydeden, pilotId = CEVRIMDISI_PILOT } = {}) {
  await fabrikaSema(env);
  if (!kayit || !t(kayit.id)) return { ok: false, neden: "kayit_eksik" };
  if (t(neden).length < 5) return { ok: false, neden: "neden_kisa" };
  if (!t(kaydeden)) return { ok: false, neden: "kaydeden_eksik" };
  const id = t(kayit.id), q = { id, s: kayit.s, t: kayit.t, d: kayit.d, q: kayit.q, o: kayit.o, a: kayit.a, x: kayit.x }; if (t(kayit.p)) q.p = kayit.p;
  const var_ = await env.DB.prepare("SELECT durum, json, h, a, x, d FROM soru WHERE id = ?").bind(id).first();
  let degisti = false, surum = 1;
  const fs = await env.DB.prepare("SELECT surum, yayim_durum FROM fabrika_soru WHERE soru_id = ?").bind(id).first();
  if (!var_) {
    const y = await soruYazKanonik(env, (({ id: _, ...r }) => r)(q), { idUret: () => id });
    if (y.durum !== "yazildi" && y.durum !== "kopya") return { ok: false, neden: "yazilamadi:" + y.durum, hata: y.hata };
    degisti = true;
  } else {
    if (var_.durum !== "taslak") return { ok: false, neden: "taslak_degil" };
    if (fs && fs.yayim_durum !== "yok") return { ok: false, neden: "karar_verilmis" };
    const k = await kanonikAlanlar(q); if (k.hata) return { ok: false, neden: "gecersiz", hata: k.hata };
    const f = k.alan, yeniJson = JSON.stringify(q);
    if (f.h !== var_.h || f.a !== var_.a || f.x !== var_.x || q.d !== var_.d) {
      surum = (fs ? fs.surum : 1) + 1; degisti = true;
      const st = [env.DB.prepare("INSERT INTO fabrika_surum (id, soru_id, surum, eski_json, yeni_json, neden, kaydeden, kayit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("sv-" + rastgele(6), id, surum, var_.json, yeniJson, t(neden).slice(0, 500), t(kaydeden).slice(0, 120), Date.now()),
        env.DB.prepare("UPDATE soru SET s = ?, t = ?, d = ?, json = ?, h = ?, govde = ?, a = ?, x = ? WHERE id = ? AND durum = 'taslak'").bind(q.s, q.t, q.d, yeniJson, f.h, f.govde, f.a, f.x, id)];
      if (fs) st.push(env.DB.prepare("UPDATE fabrika_soru SET surum = ?, model_durum = 'cevrimdisi_bekliyor', denetim_tam = 0, denetim_json = NULL, asama = 'inceleme', guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'").bind(surum, Date.now(), id));
      await env.DB.batch(st);
    } else if (fs) surum = fs.surum;
  }
  if (!fs) {
    const s = await env.DB.prepare("SELECT h, kopya_of FROM soru WHERE id = ?").bind(id).first();
    const dup = await env.DB.prepare("SELECT 1 AS v FROM soru WHERE h = ? AND id != ? AND (durum IN ('banka','onayli') OR (durum = 'taslak' AND rowid < (SELECT rowid FROM soru WHERE id = ?))) LIMIT 1").bind(s.h, id, id).first();
    const tekrar = !!(dup || s.kopya_of), simdi = Date.now();
    await env.DB.prepare("INSERT INTO fabrika_soru (soru_id, pilot_id, surum, asama, model_durum, denetim_tam, tekrar, sayisal, olusturma, guncelleme) VALUES (?, ?, ?, ?, 'cevrimdisi_bekliyor', 0, ?, 'yapilmadi', ?, ?)")
      .bind(id, pilotId, surum, tekrar ? "tekrar" : "inceleme", tekrar ? 1 : 0, simdi, simdi).run();
  }
  return { ok: true, id, surum, degisti };
}

/* Çevrimdışı inceleme kaydı. kapsam: her anahtar 'yapildi' | 'yapilmadi' (yapılmayan açıkça yazılır). sonuc 'gecti' için TÜM kapsam 'yapildi' ve engelleyici bulgu yok.
   model_durum 'gecti' OLMAZ. Kayıt, o anki içeriğe (h, a, x, d) bağlanır. */
export async function cevrimdisiInceleme(env, { soruId, sonuc, arac, kapsam, bulgular, kaydeden } = {}) {
  await fabrikaSema(env);
  if (!["gecti", "revizyon", "ret"].includes(sonuc)) return { ok: false, neden: "sonuc_gecersiz" };
  if (t(arac).length < 3) return { ok: false, neden: "arac_eksik" };
  if (!t(kaydeden)) return { ok: false, neden: "kaydeden_eksik" };
  if (!kapsam || typeof kapsam !== "object") return { ok: false, neden: "kapsam_eksik" };
  for (const k of KAPSAM_ANAHTARLARI) if (kapsam[k] !== "yapildi" && kapsam[k] !== "yapilmadi") return { ok: false, neden: "kapsam_eksik:" + k };
  const b = Array.isArray(bulgular) ? bulgular : [];
  if (b.some(x => !x || typeof x !== "object" || !t(x.metin) || !["engelleyici", "ince_ayar"].includes(x.agirlik))) return { ok: false, neden: "bulgu_gecersiz" };
  if (sonuc === "gecti") {
    const eksik = KAPSAM_ANAHTARLARI.filter(k => kapsam[k] !== "yapildi"); if (eksik.length) return { ok: false, neden: "gecti_icin_kapsam_tam_degil:" + eksik.join(",") };
    if (b.some(x => x.agirlik === "engelleyici")) return { ok: false, neden: "engelleyici_bulgu_varken_gecti_olmaz" };
  }
  const r = await env.DB.prepare("SELECT f.surum, f.yayim_durum, f.tekrar, s.h, s.a, s.x, s.d, s.durum FROM fabrika_soru f JOIN soru s ON s.id = f.soru_id WHERE f.soru_id = ?").bind(t(soruId)).first();
  if (!r) return { ok: false, neden: "kayit_yok" };
  if (r.yayim_durum !== "yok" || r.durum !== "taslak") return { ok: false, neden: "karar_verilmis" };
  if (sonuc === "gecti" && r.tekrar) return { ok: false, neden: "tekrar_gecti_olmaz" };
  const simdi = Date.now(), cid = "cd-" + rastgele(6);
  const ayrinti = { kaynak: CEVRIMDISI_KAYNAK, model_denetimi: "yapilmadi", ucretli_api: false, sonuc, arac: t(arac).slice(0, 200), kapsam, bulgular: b };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO fabrika_cevrimdisi (id, soru_id, surum, icerik_h, tam_h, a, x, d, kaynak, arac, kapsam, sonuc, bulgular, kayit, kaydeden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(cid, t(soruId), r.surum, r.h, await tamHash(r), r.a, r.x == null ? "" : r.x, r.d, CEVRIMDISI_KAYNAK, t(arac).slice(0, 200), JSON.stringify(kapsam), sonuc, JSON.stringify(b), simdi, t(kaydeden).slice(0, 120)),
    env.DB.prepare("UPDATE fabrika_soru SET model_durum = ?, denetim_tam = 0, denetim_json = ?, asama = CASE WHEN tekrar = 1 THEN asama ELSE 'inceleme' END, guncelleme = ? WHERE soru_id = ? AND yayim_durum = 'yok'")
      .bind("cevrimdisi_" + sonuc, JSON.stringify(ayrinti), simdi, t(soruId))]);
  return { ok: true, id: cid, model_durum: "cevrimdisi_" + sonuc };
}

/* Salt okunur: her çevrimdışı soru için hangi kayıt var, güncel mi, hangi İNSAN kararları eksik. */
export async function cevrimdisiDurum(env) {
  if (!(await fabrikaHazirMi(env)).hazir) return [];   // GET: tablo kurmaz
  const { results } = await env.DB.prepare("SELECT f.soru_id, f.surum, f.model_durum, f.denetim_tam, f.tekrar, f.yayim_durum, s.durum FROM fabrika_soru f JOIN soru s ON s.id = f.soru_id WHERE f.pilot_id = ? ORDER BY f.soru_id").bind(CEVRIMDISI_PILOT).all();
  const cikti = [];
  for (const r of results || []) {
    const eksik = await cevrimdisiEksikler(env, r.soru_id);
    const notAcik = !!(await env.DB.prepare("SELECT 1 AS v FROM fabrika_not WHERE soru_id = ? AND tur = 'uzman_bekliyor' AND durum = 'acik'").bind(r.soru_id).first());
    cikti.push({ id: r.soru_id, surum: r.surum, soru_durum: r.durum, yayim_durum: r.yayim_durum, model_durum: r.model_durum, denetim_tam: r.denetim_tam, tekrar: r.tekrar, eksikler: eksik.concat(notAcik ? ["uzman_bekliyor_notu_acik"] : []) });
  }
  return cikti;
}
