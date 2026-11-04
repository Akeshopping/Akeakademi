// AKE Akademi · arkadaş ligi, sınıf (öğretmen paneli), canlı deneme ve odak odası için ortak yardımcılar
import { rastgele, B32 } from "./ortak.js";

let hazir = false;
export async function sosyalSema(env) {
  if (hazir) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS lig (id TEXT PRIMARY KEY, ad TEXT, sahip TEXT, kod TEXT UNIQUE, tarih INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS lig_uye (lig TEXT NOT NULL, kid TEXT NOT NULL, takma TEXT, tarih INTEGER, PRIMARY KEY (lig, kid))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS lig_uye_kid ON lig_uye (kid)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS xp (kid TEXT NOT NULL, hafta TEXT NOT NULL, xp INTEGER DEFAULT 0, gun TEXT, gunxp INTEGER DEFAULT 0, PRIMARY KEY (kid, hafta))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS takma (kid TEXT PRIMARY KEY, ad TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sinif (id TEXT PRIMARY KEY, ad TEXT, ogretmen TEXT, kod TEXT UNIQUE, tarih INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS sinif_ogretmen ON sinif (ogretmen)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sinif_uye (sinif TEXT NOT NULL, kid TEXT NOT NULL, tarih INTEGER, PRIMARY KEY (sinif, kid))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS sinif_uye_kid ON sinif_uye (kid)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ozet (kid TEXT PRIMARY KEY, json TEXT, u INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS canli (id TEXT PRIMARY KEY, baslik TEXT, tur TEXT, baslangic INTEGER, sure INTEGER, adet INTEGER, sorular TEXT, secs TEXT, tarih INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS canli_bas ON canli (baslangic)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS canli_sonuc (canli TEXT NOT NULL, kid TEXT NOT NULL, cevap TEXT, d INTEGER, y INTEGER, b INTEGER, net REAL, sure INTEGER, tarih INTEGER, PRIMARY KEY (canli, kid))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS canli_sonuc_net ON canli_sonuc (canli, net)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS nabiz (id TEXT PRIMARY KEY, t INTEGER)")
  ]);
  hazir = true;
}

/* Türkiye saatine göre ISO hafta anahtarı: "2026-W45". Hafta pazartesi 00:00'da başlar. */
export function haftaAnahtar(ms) {
  const d = new Date((ms == null ? Date.now() : ms) + 3 * 3600000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const gun = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - gun);
  const yil = t.getUTCFullYear(), ilk = new Date(Date.UTC(yil, 0, 1));
  const no = Math.ceil(((t - ilk) / 86400000 + 1) / 7);
  return yil + "-W" + String(no).padStart(2, "0");
}
/* Bu haftanın bitişi (gelecek pazartesi 00:00, Türkiye saati) */
export function haftaBitis(ms) {
  const now = ms == null ? Date.now() : ms, d = new Date(now + 3 * 3600000);
  const gun = d.getUTCDay() || 7, gece = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 3 * 3600000;
  return gece + (8 - gun) * 86400000;
}
export const davetKodu = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return [...a].map(x => B32[x & 31]).join(""); };
export const kodTemiz = c => String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").slice(0, 12);
export const yeniId = p => p + rastgele(8);
export const net = (d, y) => Math.round((d - y / 4) * 100) / 100;
export const takmaTemiz = s => String(s || "").replace(/[<>"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);

export async function takmaAl(env, u) {
  const r = await env.DB.prepare("SELECT ad FROM takma WHERE kid = ?").bind(u.id).first();
  if (r && r.ad) return r.ad;
  return takmaTemiz(String(u.ad || "").split(" ")[0]) || "Öğrenci";
}

/* Hesap silinince: üyelikler, puanlar, özet, canlı deneme sonuçları silinir; sahip olunan ligler devredilir, sınıflar kapanır */
export async function sosyalSil(env, kid) {
  await sosyalSema(env);
  const { results: sahip } = await env.DB.prepare("SELECT id FROM lig WHERE sahip = ?").bind(kid).all();
  for (const l of sahip || []) {
    const yeni = await env.DB.prepare("SELECT kid FROM lig_uye WHERE lig = ? AND kid != ? ORDER BY tarih LIMIT 1").bind(l.id, kid).first();
    if (yeni) await env.DB.prepare("UPDATE lig SET sahip = ? WHERE id = ?").bind(yeni.kid, l.id).run();
    else await env.DB.prepare("DELETE FROM lig WHERE id = ?").bind(l.id).run();
  }
  const { results: sinif } = await env.DB.prepare("SELECT id FROM sinif WHERE ogretmen = ?").bind(kid).all();
  const ops = (sinif || []).flatMap(s => [env.DB.prepare("DELETE FROM sinif_uye WHERE sinif = ?").bind(s.id), env.DB.prepare("DELETE FROM sinif WHERE id = ?").bind(s.id)]);
  await env.DB.batch(ops.concat([
    env.DB.prepare("DELETE FROM lig_uye WHERE kid = ?").bind(kid),
    env.DB.prepare("DELETE FROM sinif_uye WHERE kid = ?").bind(kid),
    env.DB.prepare("DELETE FROM xp WHERE kid = ?").bind(kid),
    env.DB.prepare("DELETE FROM takma WHERE kid = ?").bind(kid),
    env.DB.prepare("DELETE FROM ozet WHERE kid = ?").bind(kid),
    env.DB.prepare("DELETE FROM canli_sonuc WHERE kid = ?").bind(kid)
  ]));
}
