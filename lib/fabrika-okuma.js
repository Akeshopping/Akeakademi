/* Salt okunur taslak okuma ucu için çekirdek. YALNIZ SELECT çalıştırır.
   sema(), fabrikaSema(), kanonikSemaHazir() veya herhangi bir CREATE/ALTER/INSERT/UPDATE/DELETE ÇAĞIRMAZ.
   Oturum doğrulaması da ortak oturum()'dan farklı olarak sema() çağırmaz: tablolar yoksa erişim reddedilir, kurulmaz. */
import { cerez, sha256, yoneticiMi } from "./ortak.js";

export async function oturumSaltOkunur(request, env) {
  const t = cerez(request, "ake_s"); if (!t || t.length < 40) return null;
  try {
    const r = await env.DB.prepare("SELECT k.id, k.eposta, k.ad, o.bitis FROM oturum o JOIN kullanici k ON k.id = o.kid WHERE o.hash = ?").bind(await sha256(t)).first();
    if (!r || r.bitis < Date.now()) return null;
    return { id: r.id, eposta: r.eposta, ad: r.ad || "" };
  } catch (e) { return null; }   // tablo yok/okunamıyor → giriş yok sayılır; hiçbir şey kurulmaz
}
export const yoneticiSaltOkunur = async (request, env) => { const u = await oturumSaltOkunur(request, env); return u && yoneticiMi(env, u) ? u : null; };

const KIMLIK = /^[A-Za-z0-9_-]{1,40}$/;
/* ids verilirse yalnız o kimlikler (en çok 50); verilmezse durum='taslak' satırları (en çok 200). Ayrıca durum dağılımı. İçerik DÖNMEZ. */
export async function taslakOku(env, ids) {
  const db = env.DB, liste = [...new Set((ids || []).map(String))].filter(x => KIMLIK.test(x)).slice(0, 50);
  const var_ = new Set(((await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results || []).map(r => r.name));
  if (!var_.has("soru")) return { soruTablosu: false, durumlar: {}, satirlar: [], bulunmayan: liste };
  const kol = new Set(((await db.prepare("SELECT name FROM pragma_table_info('soru')").all()).results || []).map(r => r.name));
  const sec = ["id", "durum", ...["h", "kaynak", "rk"].filter(k => kol.has(k))].join(", ");
  const durumlar = {}; for (const r of (await db.prepare("SELECT durum, COUNT(*) AS n FROM soru GROUP BY durum").all()).results || []) durumlar[r.durum ?? "(null)"] = r.n;
  let satirlar;
  if (liste.length) satirlar = (await db.prepare(`SELECT ${sec} FROM soru WHERE id IN (${liste.map(() => "?").join(",")}) ORDER BY id`).bind(...liste).all()).results || [];
  else satirlar = (await db.prepare(`SELECT ${sec} FROM soru WHERE durum = 'taslak' ORDER BY id LIMIT 200`).all()).results || [];
  const bulunan = new Set(satirlar.map(r => r.id));
  return { soruTablosu: true, kolonlar: [...kol], durumlar, satirlar, bulunmayan: liste.filter(x => !bulunan.has(x)) };
}
