// Çevrimdışı inceleme + içeriğe bağlı uzman kararı: ŞEMA, SQL GEÇİDİ ve doğrulama yardımcıları (lib/fabrika.js içe aktarır; bu dosya fabrika.js'i içe aktarmaz).
//
// NEDEN VAR: Yayım kapısı (fabrika.js › yayimKarari) yalnız ücretli KÖR MODEL denetimini ('gecti' + denetim_tam = 1) tanır. Claude sohbetinde ya da kodla yapılan çevrimdışı
// incelemeler o denetim DEĞİLDİR ve öyle kaydedilemez. Bu dosya onları AYRI, değiştirilemez bir kayıt olarak tutar ve ayrı bir yayım yolu tanımlar:
//   • model_durum ASLA 'gecti' yapılmaz; 'cevrimdisi_gecti' | 'cevrimdisi_revizyon' | 'cevrimdisi_ret' kullanılır, denetim_tam 0 kalır, model_denetimi alanı daima 'yapilmadi'.
//   • İnceleme kaydı ve uzman kararı, sorunun TAM içeriğine (h = ders+pasaj+kök+şıklar, ayrıca a, x, d) bağlıdır; içerik değişirse kayıt otomatik geçersiz olur (SQL'de eşitlik aranır).
//   • Yol varsayılan KAPALI: AKE_CEVRIMDISI_YAYIM = "1" ve yayım isteğinde cevrimdisiKabul:true gerekir. Uzman kabulü (insan) ve yönetici kararı yine şarttır.
//   • Hiçbir işlev SQL ile 'onayli' yazmaz; yayım yine soruOnayla'nın atomik batch'inden geçer.
import { sha256 } from "./ortak.js";

export const CEVRIMDISI_KAYNAK = "claude_sohbet_cevrimdisi";
export const KAPSAM_ANAHTARLARI = ["bagimsiz_cozum", "cozum_metni", "celdirici", "dil", "guclu_etiketi", "benzerlik"];   // gecti için hepsi 'yapildi' olmalı

export async function cevrimdisiSema(d) {
  await d.prepare(`CREATE TABLE IF NOT EXISTS fabrika_cevrimdisi (id TEXT PRIMARY KEY, soru_id TEXT NOT NULL, surum INTEGER, icerik_h TEXT NOT NULL, tam_h TEXT NOT NULL,
    a INTEGER NOT NULL, x TEXT NOT NULL, d INTEGER NOT NULL,
    kaynak TEXT NOT NULL CHECK (kaynak = '${CEVRIMDISI_KAYNAK}'), arac TEXT NOT NULL CHECK (length(trim(arac)) >= 3), kapsam TEXT NOT NULL,
    sonuc TEXT NOT NULL CHECK (sonuc IN ('gecti','revizyon','ret')), bulgular TEXT,
    model_denetimi TEXT NOT NULL DEFAULT 'yapilmadi' CHECK (model_denetimi = 'yapilmadi'),
    kayit INTEGER NOT NULL, kaydeden TEXT NOT NULL CHECK (length(trim(kaydeden)) >= 1))`).run();
  await d.prepare("CREATE INDEX IF NOT EXISTS fabrika_cevrimdisi_soru ON fabrika_cevrimdisi (soru_id, kayit)").run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS fabrika_uzman_baglam (uzman_id TEXT PRIMARY KEY, soru_id TEXT NOT NULL, icerik_h TEXT NOT NULL, tam_h TEXT NOT NULL, a INTEGER NOT NULL, x TEXT NOT NULL, d INTEGER NOT NULL, kayit INTEGER NOT NULL)`).run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS fabrika_surum (id TEXT PRIMARY KEY, soru_id TEXT NOT NULL, surum INTEGER NOT NULL, eski_json TEXT, yeni_json TEXT NOT NULL, neden TEXT NOT NULL CHECK (length(trim(neden)) >= 5), kaydeden TEXT NOT NULL, kayit INTEGER NOT NULL)`).run();
  for (const t of ["fabrika_cevrimdisi", "fabrika_uzman_baglam", "fabrika_surum"]) {
    await d.prepare(`CREATE TRIGGER IF NOT EXISTS ${t}_degistirme BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, '${t}_degistirilemez'); END`).run();
    await d.prepare(`CREATE TRIGGER IF NOT EXISTS ${t}_silme BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, '${t}_degistirilemez'); END`).run();
  }
}

/* Tam içerik özeti: h (ders+pasaj+kök+şıklar) + a + x + d. h tek başına çözüm metnini ve güçlüğü KAPSAMAZ; bağlama bu yüzden ayrıca a/x/d eşitliği aranır. */
export const tamHash = r => sha256([r.h, String(r.a), String(r.x == null ? "" : r.x).normalize("NFC").replace(/\s+/g, " ").trim(), String(r.d)].join("\n"));

export function yolAcikMi(env) { return !!env && String(env.AKE_CEVRIMDISI_YAYIM) === "1"; }

/* Yayım UPDATE'ine eklenen atomik geçit (model_durum 'gecti' yerine): son çevrimdisi kayıt 'gecti' ve içerikle birebir; uzman kabulü (insan) aynı içeriğe bağlı; red/açık not yok. */
export const GECIT_CEVRIMDISI_SQL = `AND EXISTS (SELECT 1 FROM fabrika_soru f WHERE f.soru_id = soru.id AND f.asama = 'inceleme' AND f.model_durum = 'cevrimdisi_gecti' AND f.denetim_tam = 0 AND f.tekrar = 0 AND f.yayim_durum = 'yok')
  AND EXISTS (SELECT 1 FROM fabrika_cevrimdisi c WHERE c.soru_id = soru.id AND c.sonuc = 'gecti' AND c.icerik_h = soru.h AND c.a = soru.a AND c.x = soru.x AND c.d = soru.d
    AND c.rowid = (SELECT c2.rowid FROM fabrika_cevrimdisi c2 WHERE c2.soru_id = soru.id ORDER BY c2.kayit DESC, c2.rowid DESC LIMIT 1))
  AND EXISTS (SELECT 1 FROM fabrika_uzman u JOIN fabrika_uzman_baglam b ON b.uzman_id = u.id WHERE u.soru_id = soru.id AND u.karar = 'kabul' AND u.icerik_h = soru.h AND b.a = soru.a AND b.x = soru.x AND b.d = soru.d)
  AND NOT EXISTS (SELECT 1 FROM fabrika_uzman u WHERE u.soru_id = soru.id AND u.karar = 'red')
  AND NOT EXISTS (SELECT 1 FROM fabrika_not n WHERE n.soru_id = soru.id AND n.tur = 'uzman_bekliyor' AND n.durum = 'acik')`;

/* Okunabilir ön denetim (asıl zorlama yukarıdaki SQL): bu soru için çevrimdışı yolun eksikleri. Boş dizi = koşullar sağlanıyor. */
export async function cevrimdisiEksikler(env, id) {
  const s = await env.DB.prepare("SELECT h, a, x, d FROM soru WHERE id = ?").bind(id).first();
  if (!s) return ["soru_yok"];
  const eks = [];
  const c = await env.DB.prepare("SELECT sonuc, icerik_h, a, x, d FROM fabrika_cevrimdisi WHERE soru_id = ? ORDER BY kayit DESC, rowid DESC LIMIT 1").bind(id).first();
  if (!c) eks.push("cevrimdisi_inceleme_yok");
  else if (c.icerik_h !== s.h || c.a !== s.a || c.x !== s.x || c.d !== s.d) eks.push("cevrimdisi_inceleme_eski_icerik");
  else if (c.sonuc !== "gecti") eks.push("cevrimdisi_inceleme_" + c.sonuc);
  const u = await env.DB.prepare("SELECT u.karar FROM fabrika_uzman u JOIN fabrika_uzman_baglam b ON b.uzman_id = u.id WHERE u.soru_id = ? AND u.karar = 'kabul' AND u.icerik_h = ? AND b.a = ? AND b.x = ? AND b.d = ? LIMIT 1").bind(id, s.h, s.a, s.x, s.d).first();
  if (!u) eks.push("uzman_kabulu_bu_icerige_bagli_degil");
  return eks;
}
