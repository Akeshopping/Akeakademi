// AKE Akademi · Haftalık veli raporu (iş mantığı) · hem Pages Functions hem zamanlanmış Worker kullanır.
// Özellik, ortam değişkeni VELI_RAPORU="1" olmadan HİÇBİR şey göndermez (varsayılan kapalı).
import { sha256, rastgele, aktifPaket, epostaGonder } from "./ortak.js";

export const ONAY_SURUM = "2026-11-taslak-1";
export const TOKEN_ONAY_MS = 48 * 3600e3;      // doğrulama bağlantısı 48 saat
export const TOKEN_YONET_MS = 35 * 24 * 3600e3; // durdurma bağlantısı 35 gün (bir sonraki rapora kadar)
export const MAKS_DENEME = 3;
export const YENIDEN_MS = 90 * 60e3;
/** Tek çalıştırmada en fazla işlenecek öğrenci (Worker alt istek sınırı için). Kalanlar sonraki cron tetiklemesine kalır. */
export const VARSAYILAN_PARTI = 40;
/** Gönderimler arası bekleme (Resend 10 istek/sn sınırının altında kalmak için). */
export const VARSAYILAN_ARALIK_MS = 150;
export const ADRES_GUNLUK_SINIR = 5;
const EPOSTA_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
export const DERS = { turkce: "Türkçe", tarih: "Tarih", cografya: "Coğrafya", felsefe: "Felsefe", din: "Din Kültürü", mat: "Matematik", geo: "Geometri", fizik: "Fizik", kimya: "Kimya", biyoloji: "Biyoloji", amat: "AYT Matematik", afizik: "AYT Fizik", akimya: "AYT Kimya", abiyoloji: "AYT Biyoloji", edebiyat: "Edebiyat", tarih2: "AYT Tarih", cografya2: "AYT Coğrafya", psikoloji: "Psikoloji", sosyoloji: "Sosyoloji", mantik: "Mantık", ingilizce: "İngilizce" };

export const veliAcik = env => String(env.VELI_RAPORU || "") === "1";
export const epostaGecerli = e => EPOSTA_RE.test(String(e || ""));
export const maskele = e => { const [a, d] = String(e || "").split("@"); return a ? a[0] + "***@" + (d || "") : ""; };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = v => { v = Number(v); return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0; };
const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
export const veliOzet = async (env, eposta) => sha256(String(eposta || "").trim().toLowerCase() + ":veli:" + (env.AKE_GIZLI || "ake"));
const tokenOzet = (env, raw) => sha256("vt:" + raw + ":" + (env.AKE_GIZLI || "ake"));

/* ---------- Türkiye saati (UTC+3, yaz saati yok) ve hafta hesabı ---------- */
export const trGun = ms => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
export const addGun = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
export function isoHafta(iso) {
  const d = new Date(Date.parse(iso + "T00:00:00Z")), g = (d.getUTCDay() + 6) % 7; // pzt=0
  d.setUTCDate(d.getUTCDate() - g + 3); // haftanın perşembesi
  const y = d.getUTCFullYear(), ilk = new Date(Date.UTC(y, 0, 4));
  const h = 1 + Math.round(((d - ilk) / 86400000 - 3 + ((ilk.getUTCDay() + 6) % 7)) / 7);
  return y + "-W" + String(h).padStart(2, "0");
}
/** Rapor penceresi: gönderim günü dahil son 7 gün (pazar 19:00 gönderiminde pazartesi–pazar). */
export function pencere(now) {
  const bit = trGun(now), bas = addGun(bit, -6);
  return { bas, bit, onceBas: addGun(bas, -7), onceBit: addGun(bas, -1), hafta: isoHafta(bit) };
}
/** Bir sonraki "Türkiye saatiyle pazar 19:00" anı (UTC ms). Cron: 0 16 * * SUN (UTC). */
export function sonrakiGonderim(now) {
  const tr = new Date(now + 3 * 3600e3);
  let gun = (7 - tr.getUTCDay()) % 7; // pazara kalan gün
  const hedefTr = Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + gun, 19, 0, 0);
  let utc = hedefTr - 3 * 3600e3;
  if (utc <= now) utc += 7 * 86400000;
  return utc;
}

/* ---------- Rapor hesabı: yalnızca kayıtlı ve güvenilir metrikler ---------- */
export function raporHesapla(stats, exams, now, ad) {
  const w = pencere(now), daily = (stats && stats.daily) || {};
  const topla = (bas, bit) => {
    let q = 0, c = 0, gun = 0; const ders = {};
    for (let d = bas; d <= bit; d = addGun(d, 1)) {
      const x = daily[d]; if (!x) continue;
      const dq = num(x.q), dc = Math.min(num(x.c), dq);
      if (dq > 0) { gun++; q += dq; c += dc; for (const [k, v] of Object.entries(x.tp || {})) { const s = String(k).split("|")[0]; ders[s] = (ders[s] || 0) + num(v); } }
    }
    return { q, c, gun, ders };
  };
  const bu = topla(w.bas, w.bit), once = topla(w.onceBas, w.onceBit);
  const ex = (Array.isArray(exams) ? exams : []).filter(e => e && trGun(num(e.date)) >= w.bas && trGun(num(e.date)) <= w.bit && num(e.date) > 0);
  const denemeBos = ex.reduce((a, e) => a + num(e.b), 0);
  const dersler = Object.entries(bu.ders).map(([k, n]) => ({ k, ad: DERS[k] || k, n })).sort((a, b) => b.n - a.n);
  const zayif = Object.entries((stats && stats.topic) || {}).map(([k, v]) => {
    const d = num(v && v[0]), y = num(v && v[1]), n = d + y; const [s, t] = String(k).split("|");
    return { ders: DERS[s] || s, konu: t || "", n, acc: pct(d, n) };
  }).filter(x => x.n >= 8 && x.acc < 50 && x.konu).sort((a, b) => a.acc - b.acc || b.n - a.n).slice(0, 3);
  const r = {
    ad: String(ad || "Öğrenci").slice(0, 60), bas: w.bas, bit: w.bit, hafta: w.hafta,
    q: bu.q, d: bu.c, y: bu.q - bu.c, dogruluk: bu.q ? pct(bu.c, bu.q) : null,
    bos: ex.length ? denemeBos : null, aktifGun: bu.gun, deneme: ex.length, dersler,
    once: once.q ? { q: once.q, dogruluk: pct(once.c, once.q), aktifGun: once.gun } : null,
    zayif, yeterli: bu.q >= 10
  };
  r.degerlendirme = degerlendirme(r);
  return r;
}
export function degerlendirme(r) {
  if (!r.yeterli) return "Bu hafta yeterli çalışma verisi bulunmuyor.";
  const p = [`Bu hafta ${r.aktifGun} günde toplam ${r.q} soru çözüldü; doğruluk %${r.dogruluk}.`];
  if (r.once) {
    const fark = r.q - r.once.q, dp = r.dogruluk - r.once.dogruluk;
    p.push(`Geçen haftaya göre çözülen soru sayısı ${fark === 0 ? "aynı" : (fark > 0 ? "+" : "") + fark}, doğruluk ${dp === 0 ? "aynı" : (dp > 0 ? "+" : "") + dp + " puan"}.`);
  }
  if (r.aktifGun < 3) p.push("Çalışma haftada 3 günden az güne yayıldı.");
  if (r.zayif.length) p.push("Genel kayıtlarda doğruluğu düşük kalan konular aşağıda listelendi.");
  return p.join(" ");
}

/* ---------- E-posta (yalnızca satır içi stil; mobilde tek sütun, tablo tabanlı) ---------- */
const trTarih = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
export const RAPOR_BASLIK = "AKE Akademi | Haftalık Öğrenci Gelişim Raporu";
export function raporHtml(r, durdurUrl) {
  const kutu = (b, v) => `<td width="50%" valign="top" style="padding:5px"><div style="background:#fbf8f1;border:1px solid #e0d8c8;border-radius:10px;padding:12px 10px"><div style="font-size:12px;color:#66625a">${b}</div><div style="font-size:22px;font-weight:700;color:#171715;margin-top:2px">${v}</div></div></td>`;
  const bos = r.bos == null ? "—" : r.bos;
  const sat = (a, b) => `<tr><td style="padding:7px 0;border-bottom:1px solid #ebe4d5;font-size:14px;color:#30302b">${esc(a)}</td><td align="right" style="padding:7px 0;border-bottom:1px solid #ebe4d5;font-size:14px;color:#171715;font-weight:600">${esc(b)}</td></tr>`;
  const ders = r.dersler.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${r.dersler.map(d => sat(d.ad, d.n + " soru")).join("")}</table>` : `<p style="margin:0;font-size:14px;color:#66625a">Bu hafta ders bazında kayıt yok.</p>`;
  const kars = r.once ? `<p style="margin:0;font-size:14px;color:#30302b">Geçen hafta: ${r.once.q} soru, doğruluk %${r.once.dogruluk}, ${r.once.aktifGun} aktif gün.</p>` : `<p style="margin:0;font-size:14px;color:#66625a">Karşılaştırma için geçen haftaya ait yeterli veri yok.</p>`;
  const zayif = r.zayif.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${r.zayif.map(z => sat(z.ders + " · " + z.konu, "%" + z.acc + " (" + z.n + " soru)")).join("")}</table><p style="margin:6px 0 0;font-size:12px;color:#66625a">Tüm zamanlara ait kayıtlardan; yalnızca en az 8 soru çözülen konular.</p>` : `<p style="margin:0;font-size:14px;color:#66625a">Bu başlık için yeterli veri yok.</p>`;
  const h2 = t => `<h2 style="font-size:15px;margin:22px 0 8px;color:#254236">${t}</h2>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;background:#f5f1e8;font-family:Segoe UI,Arial,sans-serif;color:#171715">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(r.ad)} için ${trTarih(r.bas)} – ${trTarih(r.bit)} haftalık çalışma özeti</div>
<div style="max-width:560px;margin:0 auto;padding:16px 10px">
<div style="background:#171715;border-radius:14px 14px 0 0;padding:18px 16px;border-bottom:3px solid #C5A572"><img src="https://akeakademi.com/icons/eposta-logo-v2.png" width="36" height="36" alt="AKE Akademi" border="0" style="display:inline-block;vertical-align:middle;width:36px;height:36px;border-radius:9px;margin-right:10px;border:0"><span style="vertical-align:middle;font-weight:700;font-size:16px;color:#F5F1E8">AKE Akademi</span></div>
<div style="background:#fff;border:1px solid #e0d8c8;border-top:0;border-radius:0 0 14px 14px;padding:20px 16px">
<h1 style="font-size:19px;line-height:1.3;margin:0 0 4px;color:#171715">${RAPOR_BASLIK}</h1>
<p style="margin:0 0 14px;font-size:14px;color:#66625a"><b style="color:#171715">${esc(r.ad)}</b> · ${trTarih(r.bas)} – ${trTarih(r.bit)}</p>
${r.yeterli ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${kutu("Çözülen soru", r.q)}${kutu("Doğruluk", "%" + r.dogruluk)}</tr><tr>${kutu("Doğru / Yanlış", r.d + " / " + r.y)}${kutu("Aktif çalışma günü", r.aktifGun + " / 7")}</tr><tr>${kutu("Tamamlanan deneme", r.deneme)}${kutu("Boş (denemelerde)", bos)}</tr></table>` : ""}
<div style="margin-top:12px;padding:12px;border-left:3px solid #C5A572;background:#fbf8f1;font-size:14px;line-height:1.5;color:#30302b">${esc(r.degerlendirme)}</div>
${r.yeterli ? `${h2("Ders bazında çözülen soru")}${ders}${h2("Önceki haftayla karşılaştırma")}${kars}${h2("Geliştirilmesi gereken konular")}${zayif}` : ""}
<p style="margin:18px 0 0;font-size:12px;color:#66625a">Boş sayısı yalnızca deneme sınavlarında kaydedilir. Çalışma süresi kaydedilmediği için rapora eklenmemiştir.</p>
</div>
<p style="font-size:12px;line-height:1.6;color:#66625a;margin:14px 6px 0">Bu rapor, öğrencinin ve sizin onayınızla haftada bir gönderilir. <a href="${esc(durdurUrl)}" style="color:#254236;font-weight:600">Rapor gönderimini durdur / iletişim tercihlerini yönet</a></p>
</div></body></html>`;
}
export function raporMetin(r, durdurUrl) {
  const s = [RAPOR_BASLIK, `${r.ad} · ${r.bas} – ${r.bit}`, ""];
  if (r.yeterli) {
    s.push(`Çözülen soru: ${r.q}`, `Doğru: ${r.d} · Yanlış: ${r.y}${r.bos != null ? " · Boş (denemelerde): " + r.bos : ""}`, `Doğruluk: %${r.dogruluk}`, `Aktif çalışma günü: ${r.aktifGun}/7`, `Tamamlanan deneme: ${r.deneme}`, "");
    r.dersler.forEach(d => s.push(`- ${d.ad}: ${d.n} soru`));
    s.push("");
  }
  s.push(r.degerlendirme, "", "Gönderimi durdur / tercihleri yönet: " + durdurUrl);
  return s.join("\n");
}

/* ---------- Veli onay e-postası ---------- */
export const AYDINLATMA = [
  "Veri sorumlusu: AKE Akademi (info@akeakademi.com).",
  "Hangi veriler: öğrencinin adı, haftalık çözülen soru, doğru/yanlış/boş sayıları, doğruluk yüzdesi, ders bazlı çözüm sayıları, aktif çalışma günleri, tamamlanan deneme sayısı ve genel olarak düşük doğruluklu konular.",
  "Amaç: öğrencinin çalışma gelişimini, sizin ve öğrencinin talebi üzerine, haftada bir e-posta ile bilgilendirmek.",
  "Hukuki sebep: açık rıza. Rıza vermek zorunlu değildir; vermezseniz hiçbir rapor gönderilmez.",
  "Saklama: gönderim kaydı (tarih, durum) ve izin değişiklikleri denetim amacıyla tutulur; rapor içeriği saklanmaz. Öğrenci hesabını sildiğinde bu kayıtlar da silinir.",
  "Haklarınız: KVKK madde 11 kapsamındaki haklarınız için info@akeakademi.com adresine yazabilir, rızanızı her rapor e-postasındaki bağlantıdan istediğiniz zaman geri çekebilirsiniz."
];
export function onayEposta(ogrenciAd, kucuk, onayUrl) {
  const metin = kucuk ? "Bu hesabın sahibi 18 yaşından küçük olduğunu belirtti. Raporu almak için veli/yasal temsilci olarak açık rızanız gerekir." : "Bu hesabın sahibi, haftalık çalışma raporunun bu adrese gönderilmesini istedi. Raporu almak için sizin de onayınız gerekir.";
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f5f1e8;font-family:Segoe UI,Arial,sans-serif;color:#171715"><div style="max-width:520px;margin:0 auto;padding:16px 10px">
<div style="background:#171715;border-radius:14px 14px 0 0;padding:16px;border-bottom:3px solid #C5A572"><img src="https://akeakademi.com/icons/eposta-logo-v2.png" width="36" height="36" alt="AKE Akademi" border="0" style="display:inline-block;vertical-align:middle;border-radius:9px;margin-right:10px"><span style="vertical-align:middle;font-weight:700;color:#F5F1E8">AKE Akademi</span></div>
<div style="background:#fff;border:1px solid #e0d8c8;border-top:0;border-radius:0 0 14px 14px;padding:20px 16px"><h1 style="font-size:19px;margin:0 0 10px">Veli raporu onayı</h1>
<p style="font-size:14px;line-height:1.55;margin:0 0 10px"><b>${esc(ogrenciAd || "Bir öğrenci")}</b> adlı kullanıcı, AKE Akademi haftalık gelişim raporunun bu e-posta adresine gönderilmesini istedi.</p>
<p style="font-size:14px;line-height:1.55;margin:0 0 14px">${metin} Siz onaylamadan hiçbir kişisel veri paylaşılmaz.</p>
<p style="margin:0 0 16px"><a href="${esc(onayUrl)}" style="display:inline-block;background:#254236;color:#F5F1E8;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:10px">Aydınlatma metnini oku ve karar ver</a></p>
<p style="font-size:12px;color:#66625a;margin:0">Bağlantı 48 saat geçerli ve tek kullanımlıktır. Bu isteği siz yapmadıysanız bu e-postayı yok sayın; hiçbir şey paylaşılmaz.</p></div></div></body></html>`;
  return { html, text: `AKE Akademi veli raporu onayı\n\n${ogrenciAd || "Bir öğrenci"} haftalık gelişim raporunun bu adrese gönderilmesini istedi. ${metin}\nSiz onaylamadan veri paylaşılmaz.\n\nAydınlatma metnini okumak ve karar vermek için: ${onayUrl}\n(48 saat geçerli, tek kullanımlık.)` };
}

/* ---------- Veritabanı işlemleri ---------- */
export async function veliHazirMi(env) {
  try { await env.DB.prepare("SELECT 1 FROM veli_ayar LIMIT 1").first(); return true; } catch (e) { return false; }
}
export async function denetim(env, kid, olay, ayrinti) {
  await env.DB.prepare("INSERT INTO veli_denetim (kid, olay, ayrinti, tarih) VALUES (?, ?, ?, ?)").bind(kid, olay, ayrinti || "", Date.now()).run();
}
export async function ayarGetir(env, kid) {
  return (await env.DB.prepare("SELECT kid, veli_eposta, durum, etkin, yas_grubu, onay_tarih, onay_surum, onayli_hash, son_gonderim FROM veli_ayar WHERE kid = ?").bind(kid).first()) || null;
}
export async function tokenleriKapat(env, kid, tur) {
  await env.DB.prepare("UPDATE veli_token SET kullanildi = 1 WHERE kid = ? AND kullanildi = 0" + (tur ? " AND tur = ?" : "")).bind(...(tur ? [kid, tur] : [kid])).run();
}
export async function tokenUret(env, kid, tur, veliHash, sureMs) {
  const raw = rastgele(24), h = await tokenOzet(env, raw);
  await env.DB.prepare("INSERT INTO veli_token (hash, kid, tur, veli_hash, bitis, kullanildi, tarih) VALUES (?, ?, ?, ?, ?, 0, ?)").bind(h, kid, tur, veliHash || "", Date.now() + sureMs, Date.now()).run();
  return raw;
}
/** Belirteci okur (tüketmez). Geçersiz, süresi dolmuş veya kullanılmışsa null. */
export async function tokenOku(env, raw, tur) {
  if (!raw || String(raw).length < 20) return null;
  const r = await env.DB.prepare("SELECT hash, kid, tur, veli_hash, bitis, kullanildi FROM veli_token WHERE hash = ?").bind(await tokenOzet(env, String(raw))).first();
  if (!r || r.tur !== tur || r.kullanildi || r.bitis < Date.now()) return null;
  return r;
}
/** Belirteci TEK SEFERLİK tüketir (atomik); ikinci kullanım başarısız olur. */
export async function tokenTuket(env, raw, tur) {
  const t = await tokenOku(env, raw, tur); if (!t) return null;
  const r = await env.DB.prepare("UPDATE veli_token SET kullanildi = 1 WHERE hash = ? AND kullanildi = 0 AND bitis >= ?").bind(t.hash, Date.now()).run();
  return r && r.meta && r.meta.changes === 1 ? t : null;
}
export async function ucretliMi(env, kid) {
  const p = await aktifPaket(env, kid);
  return !!p && (p.plan === "orta" || p.plan === "premium") && !p.deneme;
}

/** Öğrenci adres girer: eski onay geçersiz olur, veliye doğrulama e-postası gider. */
export async function adresKaydet(env, kid, { eposta, yas, ogrenciAd, origin }) {
  if (!veliAcik(env)) return { hata: "kapali", durum: 403 };
  eposta = String(eposta || "").trim().toLowerCase();
  if (!epostaGecerli(eposta)) return { hata: "eposta_gecersiz", durum: 400 };
  if (!["yetiskin", "kucuk"].includes(yas)) return { hata: "yas_gerekli", durum: 400 };
  if (!(await ucretliMi(env, kid))) return { hata: "paket_gerekli", durum: 403 };
  const son = await env.DB.prepare("SELECT COUNT(*) AS n FROM veli_denetim WHERE kid = ? AND olay = 'adres_girildi' AND tarih > ?").bind(kid, Date.now() - 86400000).first();
  if (son && son.n >= ADRES_GUNLUK_SINIR) return { hata: "cok_istek", durum: 429 };
  const vh = await veliOzet(env, eposta), simdi = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE veli_token SET kullanildi = 1 WHERE kid = ? AND kullanildi = 0").bind(kid),
    env.DB.prepare("INSERT INTO veli_ayar (kid, veli_eposta, durum, etkin, yas_grubu, onay_tarih, onay_surum, onayli_hash, guncelleme) VALUES (?, ?, 'bekliyor', 0, ?, NULL, NULL, NULL, ?) ON CONFLICT (kid) DO UPDATE SET veli_eposta = excluded.veli_eposta, durum = 'bekliyor', etkin = 0, yas_grubu = excluded.yas_grubu, onay_tarih = NULL, onay_surum = NULL, onayli_hash = NULL, guncelleme = excluded.guncelleme").bind(kid, eposta, yas, simdi)
  ]);
  await denetim(env, kid, "adres_girildi", maskele(eposta) + " · " + yas);
  const raw = await tokenUret(env, kid, "onay", vh, TOKEN_ONAY_MS);
  const m = onayEposta(ogrenciAd, yas === "kucuk", origin + "/api/veli/onay?t=" + raw);
  const g = await epostaGonder(env, { to: eposta, subject: "AKE Akademi | Veli raporu onayı", html: m.html, text: m.text });
  if (!g.ok) { await denetim(env, kid, "onay_eposta_hata", g.hata || ""); return { hata: "eposta", durum: 502 }; }
  await denetim(env, kid, "onay_eposta_gonderildi", maskele(eposta));
  return { ok: true };
}
export async function onayVer(env, raw) {
  const t = await tokenTuket(env, raw, "onay"); if (!t) return { hata: "gecersiz" };
  const a = await ayarGetir(env, t.kid);
  if (!a || a.durum !== "bekliyor" || (await veliOzet(env, a.veli_eposta)) !== t.veli_hash) return { hata: "gecersiz" };
  await env.DB.prepare("UPDATE veli_ayar SET durum = 'onayli', onay_tarih = ?, onay_surum = ?, onayli_hash = ?, guncelleme = ? WHERE kid = ? AND durum = 'bekliyor'").bind(Date.now(), ONAY_SURUM, t.veli_hash, Date.now(), t.kid).run();
  await denetim(env, t.kid, "veli_onayladi", ONAY_SURUM);
  return { ok: true };
}
export async function etkinDegistir(env, kid, deger) {
  if (!veliAcik(env)) return { hata: "kapali", durum: 403 };
  const a = await ayarGetir(env, kid);
  if (deger) {
    if (!a || a.durum !== "onayli") return { hata: "onay_gerekli", durum: 409 };
    if (!(await ucretliMi(env, kid))) return { hata: "paket_gerekli", durum: 403 };
  }
  if (!a) return { ok: true };
  await env.DB.prepare("UPDATE veli_ayar SET etkin = ?, guncelleme = ? WHERE kid = ?").bind(deger ? 1 : 0, Date.now(), kid).run();
  await denetim(env, kid, deger ? "etkinlestirildi" : "devre_disi", "");
  return { ok: true };
}
/** İzin geri çekme: öğrenci panelinden ya da veli bağlantısından. Hemen ve kalıcı durdurur. */
export async function izinGeriCek(env, kid, kaynak) {
  await env.DB.batch([
    env.DB.prepare("UPDATE veli_token SET kullanildi = 1 WHERE kid = ? AND kullanildi = 0").bind(kid),
    env.DB.prepare("UPDATE veli_ayar SET durum = 'iptal', etkin = 0, onay_tarih = NULL, onayli_hash = NULL, guncelleme = ? WHERE kid = ?").bind(Date.now(), kid)
  ]);
  await denetim(env, kid, "izin_geri_cekildi", kaynak);
  return { ok: true };
}
export async function veliDurdur(env, raw) {
  const t = await tokenTuket(env, raw, "yonet"); if (!t) return { hata: "gecersiz" };
  await izinGeriCek(env, t.kid, "veli_baglantisi");
  return { ok: true };
}
export async function hesapSilVeli(env, kid) {
  try {
    await env.DB.batch(["veli_ayar", "veli_token", "veli_log", "veli_denetim"].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE kid = ?`).bind(kid)));
  } catch (e) { /* tablolar henüz oluşturulmamış olabilir */ }
}

/* ---------- Haftalık gönderim (zamanlanmış Worker çağırır) ---------- */
async function gonderilebilirMi(env, a, now) {
  if (!a || !a.etkin || a.durum !== "onayli" || !a.veli_eposta) return "izin_yok";
  if ((await veliOzet(env, a.veli_eposta)) !== a.onayli_hash) return "adres_degisti";
  if (!(await ucretliMi(env, a.kid))) return "abonelik_yok";
  return "";
}
export async function raporKur(env, kid, now) {
  const { results } = await env.DB.prepare("SELECT alan, json FROM veri WHERE kid = ? AND alan IN ('stats', 'exams', 'profile')").bind(kid).all();
  const al = {}; (results || []).forEach(r => { try { al[r.alan] = JSON.parse(r.json); } catch (e) { } });
  const k = await env.DB.prepare("SELECT ad FROM kullanici WHERE id = ?").bind(kid).first();
  const ad = (al.profile && al.profile.name) || (k && k.ad) || "Öğrenci";
  return raporHesapla(al.stats || {}, Array.isArray(al.exams) ? al.exams : (al.exams && al.exams.list) || [], now, ad);
}
export async function haftalikGonder(env, { now = Date.now(), origin = "https://akeakademi.com", parti, aralikMs } = {}) {
  const ozet = { acik: veliAcik(env), aday: 0, gonderildi: 0, hata: 0, atlandi: 0, zatenGonderildi: 0, kalan: 0 };
  const sinir = Math.max(1, Math.min(500, Number(parti ?? env.VELI_PARTI) || VARSAYILAN_PARTI));
  const bekle = Math.max(0, aralikMs ?? (env.VELI_ARALIK_MS !== undefined ? Number(env.VELI_ARALIK_MS) : VARSAYILAN_ARALIK_MS));
  if (!ozet.acik || !(await veliHazirMi(env))) return ozet;
  const { hafta } = pencere(now);
  // Bu hafta zaten gönderilmiş, sürmekte olan ya da yeniden deneme hakkı/zamanı olmayan kayıtlar baştan elenir (D1 okuma ve alt istek tasarrufu).
  const { results } = await env.DB.prepare("SELECT a.kid FROM veli_ayar a WHERE a.etkin = 1 AND a.durum = 'onayli' AND NOT EXISTS (SELECT 1 FROM veli_log l WHERE l.kid = a.kid AND l.hafta = ? AND l.veli_hash = a.onayli_hash AND (l.durum IN ('gonderildi', 'gonderiliyor') OR (l.durum = 'hata' AND (l.deneme >= ? OR COALESCE(l.sonraki, 0) > ?)))) ORDER BY a.kid LIMIT ?").bind(hafta, MAKS_DENEME, now, sinir + 1).all();
  const liste = results || [];
  if (liste.length > sinir) { ozet.kalan = 1; liste.length = sinir; }
  let ilk = true;
  for (const { kid } of liste) {
    ozet.aday++;
    const a = await ayarGetir(env, kid), neden = await gonderilebilirMi(env, a, now);
    if (neden) { ozet.atlandi++; await denetim(env, kid, "atlandi", neden); continue; }
    const vh = await veliOzet(env, a.veli_eposta);
    await env.DB.prepare("INSERT OR IGNORE INTO veli_log (kid, hafta, veli_hash, veli_maske, durum, deneme, tarih) VALUES (?, ?, ?, ?, 'bekliyor', 0, ?)").bind(kid, hafta, vh, maskele(a.veli_eposta), now).run();
    const l = await env.DB.prepare("SELECT id, durum, deneme, sonraki FROM veli_log WHERE kid = ? AND hafta = ? AND veli_hash = ?").bind(kid, hafta, vh).first();
    if (!l) continue;
    if (l.durum === "gonderildi") { ozet.zatenGonderildi++; continue; }
    if (l.durum === "gonderiliyor" || (l.durum === "hata" && (l.deneme >= MAKS_DENEME || (l.sonraki || 0) > now))) { ozet.atlandi++; continue; }
    const kapti = await env.DB.prepare("UPDATE veli_log SET durum = 'gonderiliyor', tarih = ? WHERE id = ? AND durum IN ('bekliyor', 'hata')").bind(now, l.id).run();
    if (!kapti || !kapti.meta || kapti.meta.changes !== 1) { ozet.atlandi++; continue; }
    if (!ilk && bekle) await new Promise(r => setTimeout(r, bekle));
    ilk = false;
    let g;
    try {
      const rapor = await raporKur(env, kid, now);
      const raw = await tokenUret(env, kid, "yonet", vh, TOKEN_YONET_MS), durdur = origin + "/api/veli/yonet?t=" + raw;
      g = await epostaGonder(env, { to: a.veli_eposta, subject: RAPOR_BASLIK, html: raporHtml(rapor, durdur), text: raporMetin(rapor, durdur) });
    } catch (e) { g = { ok: false, hata: "olusturma" }; }
    if (g.ok) {
      await env.DB.batch([
        env.DB.prepare("UPDATE veli_log SET durum = 'gonderildi', deneme = deneme + 1, hata = NULL, sonraki = NULL, tarih = ? WHERE id = ?").bind(Date.now(), l.id),
        env.DB.prepare("UPDATE veli_ayar SET son_gonderim = ? WHERE kid = ?").bind(Date.now(), kid)
      ]);
      ozet.gonderildi++;
    } else {
      await env.DB.prepare("UPDATE veli_log SET durum = 'hata', deneme = deneme + 1, hata = ?, sonraki = ?, tarih = ? WHERE id = ?").bind(String(g.hata || "eposta").slice(0, 40), now + YENIDEN_MS, Date.now(), l.id).run();
      ozet.hata++;
    }
  }
  return ozet;
}

/* ---------- Öğrenci ve yönetici görünümleri ---------- */
export async function durumGetir(env, kid, now = Date.now()) {
  const acik = veliAcik(env), hazir = acik && await veliHazirMi(env);
  const o = { acik, hazir, ucretli: await ucretliMi(env, kid).catch(() => false) };
  if (!hazir) return o;
  const a = await ayarGetir(env, kid);
  const son = await env.DB.prepare("SELECT hafta, durum, deneme, tarih FROM veli_log WHERE kid = ? ORDER BY tarih DESC LIMIT 1").bind(kid).first();
  Object.assign(o, a ? { durum: a.durum, etkin: !!a.etkin, veli: maskele(a.veli_eposta), yas: a.yas_grubu, sonGonderim: a.son_gonderim || null } : { durum: "yok", etkin: false, veli: "", yas: "", sonGonderim: null });
  o.sonraki = o.etkin && o.durum === "onayli" && o.ucretli ? sonrakiGonderim(now) : null;
  o.sonDeneme = son ? { durum: son.durum, tarih: son.tarih } : null;
  return o;
}
export async function yoneticiOzet(env, now = Date.now()) {
  if (!(await veliHazirMi(env))) return { hazir: false, acik: veliAcik(env) };
  const t7 = now - 7 * 86400000;
  const s = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM veli_ayar WHERE etkin = 1 AND durum = 'onayli') AS etkin, (SELECT COUNT(*) FROM veli_ayar WHERE durum = 'onayli') AS dogrulanmis, (SELECT COUNT(*) FROM veli_log WHERE durum = 'gonderildi' AND tarih >= ?) AS basarili, (SELECT COUNT(*) FROM veli_log WHERE durum = 'hata' AND deneme >= ? AND tarih >= ?) AS kalici, (SELECT COUNT(*) FROM veli_log WHERE durum = 'hata' AND deneme < ? AND tarih >= ?) AS yeniden, (SELECT MAX(tarih) FROM veli_log WHERE durum = 'gonderildi') AS son").bind(t7, MAKS_DENEME, t7, MAKS_DENEME, t7).first();
  const { results } = await env.DB.prepare("SELECT kid, hafta, veli_maske, durum, deneme, hata, tarih FROM veli_log ORDER BY tarih DESC LIMIT 50").all();
  return { hazir: true, acik: veliAcik(env), etkin: s.etkin, dogrulanmis: s.dogrulanmis, basarili: s.basarili, basarisiz: s.kalici + s.yeniden, kalici: s.kalici, son: s.son, sonraki: sonrakiGonderim(now),
    limitUyari: s.etkin >= 80 ? "Etkin abonelik sayısı Resend Free günlük 100 e-posta sınırına yaklaşıyor; Resend planını ve Workers Paid durumunu kontrol edin." : "",
    gecmis: (results || []).map(r => ({ ogrenci: String(r.kid).slice(0, 6), hafta: r.hafta, veli: r.veli_maske, durum: r.durum, deneme: r.deneme, hata: r.hata, tarih: r.tarih })) };
}
