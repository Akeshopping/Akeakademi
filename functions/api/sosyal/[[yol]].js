// AKE Akademi · sosyal sunucu (Cloudflare Pages Function) · adres: /api/sosyal/...
//
// Hesap sistemiyle aynı D1 veritabanını (DB) kullanır; ek ayar gerekmez.
//
// Uçlar:
//   GET  ben                         takma ad, bu haftanın puanı, üyelik sayıları
//   POST takma {takma}               liglerde ve sıralamalarda görünen ad
//   POST xp {d, y, deneme, odak}     çalışma puanı ekler (günlük üst sınır var)
//   GET  lig                         liglerim ve haftalık sıralamaları
//   POST lig/kur {ad}  · lig/katil {kod}  · lig/ayril {id}
//   GET  sinif                       katıldığım ve öğretmeni olduğum sınıflar
//   POST sinif/kur {ad} · sinif/katil {kod} · sinif/ayril {id}
//   GET  sinif/<id>                  (öğretmen) öğrencilerin özetleri
//   POST sinif/<id>/cikar {kid} · sinif/<id>/sil   (öğretmen)
//   POST ozet {ozet}                 sınıf üyesi öğrencinin çalışma özeti
//   GET  canli                       planlanan, açık ve biten canlı denemeler
//   GET  canli/<id>/sorular          (deneme açıkken) cevapsız sorular
//   POST canli/<id>/gonder {cevap, sure}
//   GET  canli/<id>/sonuc            sıralama; deneme bitince cevaplar ve çözümler
//   POST canli/olustur · canli/<id>/sil   (yönetici)
//   GET/POST oda {id}                odak odasında şu an kaç kişi var

import { json, fail, sema, oturum, yoneticiMi, bugunIso } from "../../../lib/ortak.js";
import { ipHiz, hizSinir, bekleBaslik } from "../../../lib/hiz.js";
import { sosyalSema, haftaAnahtar, haftaBitis, davetKodu, kodTemiz, yeniId, net, takmaTemiz, takmaAl } from "../../../lib/sosyal.js";

const ODA_TAVAN = 20000;
const SINIR = { ligUye: 8, ligKur: 3, ligKisi: 50, sinifKur: 10, sinifKisi: 300, sinifUye: 3, gunXp: 2500 };
const ONBELLEK = new Map(); /* canlı deneme sıralaması önbelleği (bu sunucu örneğinde) */
/* Sınırlar D1'de (lib/hiz.js): tüm Worker örneklerinde ortak ve atomik. Tablo yoksa engellemez (bellek içi yedek). */
async function ipSinir(env, request, anahtar, adet, ms) { const h = await ipHiz(env, request, "s:" + anahtar, adet, ms); return h.izin ? null : fail(429, "cok_istek", "", bekleBaslik(h)); }
async function kisiSinir(env, kid, anahtar, adet, ms) { const h = await hizSinir(env, { kova: "s:" + anahtar, kimlik: kid, adet, ms }); return h.izin ? null : fail(429, "cok_istek", "", bekleBaslik(h)); }
const YAZMA_YOLLARI = new Set(["takma", "lig", "sinif", "ozet"]);   /* kullanıcının veri yazdığı sosyal uçlar (xp ve canlı yönetici işlemleri ayrı) */
async function govde(request) { try { return await request.json(); } catch (e) { return {}; } }
const tamSayi = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
const adTemiz = s => String(s || "").replace(/[<>"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
const bitisOf = c => c.baslangic + c.sure * 60000;
const durumOf = (c, now) => now < c.baslangic ? "yakinda" : now < bitisOf(c) ? "acik" : "bitti";

async function benzersizKod(env, tablo) {
  for (let i = 0; i < 6; i++) { const k = davetKodu(); if (!await env.DB.prepare(`SELECT 1 FROM ${tablo} WHERE kod = ?`).bind(k).first()) return k; }
  throw new Error("kod üretilemedi");
}
async function haftalikXp(env, kid, hafta) {
  const r = await env.DB.prepare("SELECT xp FROM xp WHERE kid = ? AND hafta = ?").bind(kid, hafta).first();
  return r ? r.xp || 0 : 0;
}
/* Öğretmen ekranında gösterilen çalışma özeti: yalnızca bilinen alanlar, sayılar sayı, metinler kısa düz metin olarak saklanır */
const ozSayi = (v, ust) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(ust || 1e6, n)) : 0; };
const ozMetin = (v, n) => String(v == null ? "" : v).replace(/[<>"'`\\\u0000-\u001f]/g, "").trim().slice(0, n);
function ozetTemiz(o) {
  o = o && typeof o === "object" && !Array.isArray(o) ? o : {};
  const dizi = (a, n) => Array.isArray(a) ? a.slice(0, n) : [];
  return {
    v: 1, h: ozSayi(o.h), hc: ozSayi(o.hc), fm: ozSayi(o.fm), top: ozSayi(o.top), tc: ozSayi(o.tc), seri: ozSayi(o.seri, 5000),
    son: /^\d{4}-\d{2}-\d{2}$/.test(String(o.son || "")) ? String(o.son) : "", alan: ozMetin(o.alan, 20), hedef: ozMetin(o.hedef, 60),
    zayif: dizi(o.zayif, 5).map(w => ({ s: ozMetin(w && w.s, 30), t: ozMetin(w && w.t, 50), p: ozSayi(w && w.p, 100), n: ozSayi(w && w.n) })),
    den: dizi(o.den, 5).map(e => ({ ti: ozMetin(e && e.ti, 50), net: ozSayi(e && e.net, 200), n: ozSayi(e && e.n, 500), tarih: /^\d{4}-\d{2}-\d{2}$/.test(String(e && e.tarih || "")) ? String(e.tarih) : "" })),
    tekrar: ozSayi(o.tekrar)
  };
}
async function ozetTemizle(env, kid) {
  const kalan = await env.DB.prepare("SELECT 1 FROM sinif_uye WHERE kid = ? LIMIT 1").bind(kid).first();
  if (!kalan) await env.DB.prepare("DELETE FROM ozet WHERE kid = ?").bind(kid).run();
}

export async function onRequest({ request, env, params }) {
  const yol = [].concat(params.yol || []), ad = yol[0] || "", m = request.method, now = Date.now();
  if (!env.DB) return fail(500, "yapilandirma", "Veritabanı bağlı değil (DB).");
  try { await sema(env); await sosyalSema(env); } catch (e) { console.error("sema", e); return fail(500, "yapilandirma"); }

  /* ---------- odak odası: oturum gerekmez ---------- */
  if (ad === "oda") {
    if (m === "POST") {
      { const red = await ipSinir(env, request, "oda", 6, 60000); if (red) return red; }
      const b = await govde(request), id = String(b.id || "");
      if (!/^[a-z0-9]{8,40}$/i.test(id)) return fail(400, "gecersiz");
      if (b.cik) await env.DB.prepare("DELETE FROM nabiz WHERE id = ?").bind(id).run();
      else await env.DB.batch([
        /* tablo tavanı: yeni kimlik yalnızca toplam satır < ODA_TAVAN ise eklenir (mevcut kimlik her zaman yenilenir) — tek atomik komut */
        env.DB.prepare("INSERT INTO nabiz (id, t) SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM nabiz) < " + ODA_TAVAN + " OR EXISTS (SELECT 1 FROM nabiz WHERE id = ?1) ON CONFLICT (id) DO UPDATE SET t = excluded.t").bind(id, now),
        env.DB.prepare("DELETE FROM nabiz WHERE t < ?").bind(now - 600000)
      ]);
    }
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM nabiz WHERE t > ?").bind(now - 75000).first();
    return json(200, { n: r ? r.n : 0 }, { "cache-control": "no-store" });
  }

  /* ---------- canlı deneme listesi: oturum isteğe bağlı ---------- */
  const u = await oturum(request, env);
  if (ad === "canli" && !yol[1] && m === "GET") {
    const { results } = await env.DB.prepare("SELECT id, baslik, tur, baslangic, sure, adet FROM canli WHERE baslangic + sure * 60000 > ? ORDER BY baslangic LIMIT 30").bind(now - 21 * 86400000).all();
    const l = results || [], ids = l.map(c => c.id);
    const say = {}, benim = {};
    if (ids.length) {
      const q = ids.map(() => "?").join(",");
      const s = await env.DB.prepare(`SELECT canli, COUNT(*) AS n FROM canli_sonuc WHERE canli IN (${q}) GROUP BY canli`).bind(...ids).all();
      (s.results || []).forEach(r => say[r.canli] = r.n);
      if (u) { const b = await env.DB.prepare(`SELECT canli, d, y, b, net FROM canli_sonuc WHERE kid = ? AND canli IN (${q})`).bind(u.id, ...ids).all(); (b.results || []).forEach(r => benim[r.canli] = { d: r.d, y: r.y, b: r.b, net: r.net }); }
    }
    return json(200, { simdi: now, denemeler: l.map(c => ({ id: c.id, baslik: c.baslik, tur: c.tur, baslangic: c.baslangic, bitis: bitisOf(c), sure: c.sure, adet: c.adet, durum: durumOf(c, now), katilan: say[c.id] || 0, benim: benim[c.id] || null })) }, { "cache-control": "no-store" });
  }

  if (!u) return fail(401, "giris", "Bu özellik için giriş yap.");
  const yon = yoneticiMi(env, u);
  /* Suistimale açık yazma işlemleri (kullanıcı başına, D1'de atomik): genel yazma bütçesi saatte 240; lig/sınıf kurma ve takma ad değiştirme saatte 10.
     Kur→ayrıl→kur döngüsüyle tablo şişirme ve takma ad değiştirme spamı bu sınırlarla kesilir; normal kullanımın çok üstündedir. */
  if (m === "POST" && YAZMA_YOLLARI.has(ad)) {
    const red = (await kisiSinir(env, u.id, "yaz", 240, 3600000)) || (ad === "takma" && (await kisiSinir(env, u.id, "takma", 10, 3600000)))
      || ((ad === "lig" || ad === "sinif") && yol[1] === "kur" && (await kisiSinir(env, u.id, "kur", 10, 3600000)));
    if (red) return red;
  }

  /* ---------- profil ve puan ---------- */
  if (ad === "ben" && m === "GET") {
    const hafta = haftaAnahtar(now);
    const [xp, lig, sinif, ogr] = await Promise.all([
      haftalikXp(env, u.id, hafta),
      env.DB.prepare("SELECT COUNT(*) AS n FROM lig_uye WHERE kid = ?").bind(u.id).first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM sinif_uye WHERE kid = ?").bind(u.id).first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM sinif WHERE ogretmen = ?").bind(u.id).first()
    ]);
    const tv = await env.DB.prepare("SELECT 1 FROM takma WHERE kid = ?").bind(u.id).first();
    return json(200, { takma: await takmaAl(env, u), takmaVar: !!tv, hafta, haftaBitis: haftaBitis(now), xp, lig: lig.n, sinif: sinif.n, ogretmen: ogr.n });
  }
  if (ad === "takma" && m === "POST") {
    const t = takmaTemiz((await govde(request)).takma);
    if (t.length < 2) return fail(400, "takma_kisa", "En az 2 harf yaz.");
    await env.DB.prepare("INSERT INTO takma (kid, ad) VALUES (?, ?) ON CONFLICT (kid) DO UPDATE SET ad = excluded.ad").bind(u.id, t).run();
    return json(200, { takma: t });
  }
  if (ad === "xp" && m === "POST") {
    { const red = await kisiSinir(env, u.id, "xp", 30, 60000); if (red) return red; }
    const b = await govde(request);
    const ham = tamSayi(b.d, 400) * 10 + tamSayi(b.y, 400) * 2 + tamSayi(b.deneme, 2) * 50 + tamSayi(b.odak, 6) * 25;
    const hafta = haftaAnahtar(now), gun = bugunIso();
    const r = await env.DB.prepare("SELECT xp, gun, gunxp FROM xp WHERE kid = ? AND hafta = ?").bind(u.id, hafta).first();
    const gunxp = r && r.gun === gun ? r.gunxp || 0 : 0, ekle = Math.max(0, Math.min(ham, SINIR.gunXp - gunxp));
    await env.DB.prepare("INSERT INTO xp (kid, hafta, xp, gun, gunxp) VALUES (?, ?, ?, ?, ?) ON CONFLICT (kid, hafta) DO UPDATE SET xp = xp + excluded.xp, gun = excluded.gun, gunxp = ?")
      .bind(u.id, hafta, ekle, gun, gunxp + ekle, gunxp + ekle).run();
    return json(200, { hafta, eklenen: ekle, xp: (r ? r.xp || 0 : 0) + ekle, sinir: gunxp + ekle >= SINIR.gunXp });
  }

  /* ---------- arkadaş ligi ---------- */
  if (ad === "lig") {
    const alt = yol[1] || "";
    if (!alt && m === "GET") {
      const hafta = haftaAnahtar(now), gecen = haftaAnahtar(now - 7 * 86400000);
      const { results: ligler } = await env.DB.prepare("SELECT l.id, l.ad, l.kod, l.sahip FROM lig_uye u JOIN lig l ON l.id = u.lig WHERE u.kid = ? ORDER BY u.tarih").bind(u.id).all();
      const out = [];
      for (const l of ligler || []) {
        const { results: uy } = await env.DB.prepare("SELECT u.kid, COALESCE(t.ad, u.takma) AS takma, COALESCE(x.xp, 0) AS xp, COALESCE(g.xp, 0) AS gxp FROM lig_uye u LEFT JOIN takma t ON t.kid = u.kid LEFT JOIN xp x ON x.kid = u.kid AND x.hafta = ? LEFT JOIN xp g ON g.kid = u.kid AND g.hafta = ? WHERE u.lig = ?").bind(hafta, gecen, l.id).all();
        const list = (uy || []).map(r => ({ takma: r.takma || "Öğrenci", xp: r.xp, gxp: r.gxp, ben: r.kid === u.id })).sort((a, b) => b.xp - a.xp || a.takma.localeCompare(b.takma, "tr"));
        const g = list.slice().sort((a, b) => b.gxp - a.gxp)[0];
        out.push({ id: l.id, ad: l.ad, kod: l.kod, sahip: l.sahip === u.id, uyeler: list.map(({ gxp, ...r }) => r), gecenBirinci: g && g.gxp > 0 ? { takma: g.takma, xp: g.gxp, ben: g.ben } : null });
      }
      return json(200, { hafta, haftaBitis: haftaBitis(now), ligler: out });
    }
    if (alt === "kur" && m === "POST") {
      const b = await govde(request), lad = adTemiz(b.ad);
      if (lad.length < 2) return fail(400, "ad_kisa", "Lige bir ad ver.");
      const [kur, uye] = await Promise.all([env.DB.prepare("SELECT COUNT(*) AS n FROM lig WHERE sahip = ?").bind(u.id).first(), env.DB.prepare("SELECT COUNT(*) AS n FROM lig_uye WHERE kid = ?").bind(u.id).first()]);
      if (kur.n >= SINIR.ligKur) return fail(400, "sinir", `En fazla ${SINIR.ligKur} lig kurabilirsin.`);
      if (uye.n >= SINIR.ligUye) return fail(400, "sinir", `En fazla ${SINIR.ligUye} ligde olabilirsin.`);
      const id = yeniId("l"), kod = await benzersizKod(env, "lig"), takma = await takmaAl(env, u);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO lig (id, ad, sahip, kod, tarih) VALUES (?, ?, ?, ?, ?)").bind(id, lad, u.id, kod, now),
        env.DB.prepare("INSERT INTO lig_uye (lig, kid, takma, tarih) VALUES (?, ?, ?, ?)").bind(id, u.id, takma, now)
      ]);
      return json(200, { id, kod });
    }
    if (alt === "katil" && m === "POST") {
      { const red = await ipSinir(env, request, "katil", 20, 3600000); if (red) return red; }
      const kod = kodTemiz((await govde(request)).kod);
      const l = kod.length === 6 ? await env.DB.prepare("SELECT id, ad FROM lig WHERE kod = ?").bind(kod).first() : null;
      if (!l) return fail(404, "kod_yok", "Bu davet kodu ile bir lig bulunamadı.");
      if (await env.DB.prepare("SELECT 1 FROM lig_uye WHERE lig = ? AND kid = ?").bind(l.id, u.id).first()) return json(200, { id: l.id, ad: l.ad, zaten: true });
      const [uye, kisi] = await Promise.all([env.DB.prepare("SELECT COUNT(*) AS n FROM lig_uye WHERE kid = ?").bind(u.id).first(), env.DB.prepare("SELECT COUNT(*) AS n FROM lig_uye WHERE lig = ?").bind(l.id).first()]);
      if (uye.n >= SINIR.ligUye) return fail(400, "sinir", `En fazla ${SINIR.ligUye} ligde olabilirsin.`);
      if (kisi.n >= SINIR.ligKisi) return fail(400, "dolu", "Bu lig dolu.");
      await env.DB.prepare("INSERT INTO lig_uye (lig, kid, takma, tarih) VALUES (?, ?, ?, ?)").bind(l.id, u.id, await takmaAl(env, u), now).run();
      return json(200, { id: l.id, ad: l.ad });
    }
    if (alt === "ayril" && m === "POST") {
      const id = String((await govde(request)).id || "");
      const l = await env.DB.prepare("SELECT sahip FROM lig WHERE id = ?").bind(id).first();
      if (!l) return fail(404, "yok");
      await env.DB.prepare("DELETE FROM lig_uye WHERE lig = ? AND kid = ?").bind(id, u.id).run();
      if (l.sahip === u.id) {
        const yeni = await env.DB.prepare("SELECT kid FROM lig_uye WHERE lig = ? ORDER BY tarih LIMIT 1").bind(id).first();
        if (yeni) await env.DB.prepare("UPDATE lig SET sahip = ? WHERE id = ?").bind(yeni.kid, id).run();
        else await env.DB.prepare("DELETE FROM lig WHERE id = ?").bind(id).run();
      }
      return json(200, { ok: true });
    }
    return fail(404, "yok");
  }

  /* ---------- sınıf ve öğretmen paneli ---------- */
  if (ad === "sinif") {
    const alt = yol[1] || "";
    if (!alt && m === "GET") {
      const [o, t] = await Promise.all([
        env.DB.prepare("SELECT s.id, s.ad, k.ad AS ogretmen FROM sinif_uye u JOIN sinif s ON s.id = u.sinif LEFT JOIN kullanici k ON k.id = s.ogretmen WHERE u.kid = ? ORDER BY u.tarih").bind(u.id).all(),
        env.DB.prepare("SELECT s.id, s.ad, s.kod, (SELECT COUNT(*) FROM sinif_uye x WHERE x.sinif = s.id) AS n FROM sinif s WHERE s.ogretmen = ? ORDER BY s.tarih").bind(u.id).all()
      ]);
      return json(200, { ogrenci: (o.results || []).map(r => ({ id: r.id, ad: r.ad, ogretmen: r.ogretmen || "" })), ogretmen: t.results || [] });
    }
    if (alt === "kur" && m === "POST") {
      const sad = adTemiz((await govde(request)).ad);
      if (sad.length < 2) return fail(400, "ad_kisa", "Sınıfa bir ad ver.");
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM sinif WHERE ogretmen = ?").bind(u.id).first();
      if (n.n >= SINIR.sinifKur) return fail(400, "sinir", `En fazla ${SINIR.sinifKur} sınıf açabilirsin.`);
      const id = yeniId("s"), kod = await benzersizKod(env, "sinif");
      await env.DB.prepare("INSERT INTO sinif (id, ad, ogretmen, kod, tarih) VALUES (?, ?, ?, ?, ?)").bind(id, sad, u.id, kod, now).run();
      return json(200, { id, kod });
    }
    if (alt === "katil" && m === "POST") {
      { const red = await ipSinir(env, request, "katil", 20, 3600000); if (red) return red; }
      const kod = kodTemiz((await govde(request)).kod);
      const s = kod.length === 6 ? await env.DB.prepare("SELECT id, ad, ogretmen FROM sinif WHERE kod = ?").bind(kod).first() : null;
      if (!s) return fail(404, "kod_yok", "Bu kodla bir sınıf bulunamadı.");
      if (s.ogretmen === u.id) return fail(400, "kendi", "Bu sınıfın öğretmeni sensin.");
      if (await env.DB.prepare("SELECT 1 FROM sinif_uye WHERE sinif = ? AND kid = ?").bind(s.id, u.id).first()) return json(200, { id: s.id, ad: s.ad, zaten: true });
      const [uye, kisi] = await Promise.all([env.DB.prepare("SELECT COUNT(*) AS n FROM sinif_uye WHERE kid = ?").bind(u.id).first(), env.DB.prepare("SELECT COUNT(*) AS n FROM sinif_uye WHERE sinif = ?").bind(s.id).first()]);
      if (uye.n >= SINIR.sinifUye) return fail(400, "sinir", `En fazla ${SINIR.sinifUye} sınıfa katılabilirsin.`);
      if (kisi.n >= SINIR.sinifKisi) return fail(400, "dolu", "Bu sınıf dolu.");
      await env.DB.prepare("INSERT INTO sinif_uye (sinif, kid, tarih) VALUES (?, ?, ?)").bind(s.id, u.id, now).run();
      return json(200, { id: s.id, ad: s.ad });
    }
    if (alt === "ayril" && m === "POST") {
      const id = String((await govde(request)).id || "");
      await env.DB.prepare("DELETE FROM sinif_uye WHERE sinif = ? AND kid = ?").bind(id, u.id).run();
      await ozetTemizle(env, u.id);
      return json(200, { ok: true });
    }
    /* öğretmenin kendi sınıfı */
    const s = await env.DB.prepare("SELECT id, ad, kod, ogretmen FROM sinif WHERE id = ?").bind(alt).first();
    if (!s || (s.ogretmen !== u.id && !yon)) return fail(404, "yok");
    const islem = yol[2] || "";
    if (!islem && m === "GET") {
      const { results } = await env.DB.prepare("SELECT u.kid, u.tarih, t.ad AS takma, k.ad AS kad, o.json, o.u FROM sinif_uye u LEFT JOIN takma t ON t.kid = u.kid LEFT JOIN kullanici k ON k.id = u.kid LEFT JOIN ozet o ON o.kid = u.kid WHERE u.sinif = ? ORDER BY u.tarih").bind(s.id).all();
      const ogr = (results || []).map(r => { let oz = null; try { oz = r.json ? JSON.parse(r.json) : null; } catch (e) { } return { kid: r.kid, ad: r.takma || r.kad || "Öğrenci", tamAd: r.kad || "", katilma: r.tarih, ozet: oz, u: r.u || 0 }; });
      return json(200, { id: s.id, ad: s.ad, kod: s.kod, ogrenciler: ogr });
    }
    if (islem === "cikar" && m === "POST") {
      const kid = String((await govde(request)).kid || "");
      await env.DB.prepare("DELETE FROM sinif_uye WHERE sinif = ? AND kid = ?").bind(s.id, kid).run();
      await ozetTemizle(env, kid);
      return json(200, { ok: true });
    }
    if (islem === "sil" && m === "POST") {
      const { results } = await env.DB.prepare("SELECT kid FROM sinif_uye WHERE sinif = ?").bind(s.id).all();
      await env.DB.batch([env.DB.prepare("DELETE FROM sinif_uye WHERE sinif = ?").bind(s.id), env.DB.prepare("DELETE FROM sinif WHERE id = ?").bind(s.id)]);
      for (const r of results || []) await ozetTemizle(env, r.kid);
      return json(200, { ok: true });
    }
    return fail(404, "yok");
  }
  if (ad === "ozet" && m === "POST") {
    const uye = await env.DB.prepare("SELECT 1 FROM sinif_uye WHERE kid = ? LIMIT 1").bind(u.id).first();
    if (!uye) return json(200, { kayit: false });
    const b = await govde(request);
    if (JSON.stringify(b.ozet || {}).length > 8000) return fail(413, "buyuk");
    const s = JSON.stringify(ozetTemiz(b.ozet));
    await env.DB.prepare("INSERT INTO ozet (kid, json, u) VALUES (?, ?, ?) ON CONFLICT (kid) DO UPDATE SET json = excluded.json, u = excluded.u").bind(u.id, s, now).run();
    return json(200, { kayit: true });
  }

  /* ---------- canlı deneme ---------- */
  if (ad === "canli") {
    if (yol[1] === "olustur" && m === "POST") {
      if (!yon) return fail(403, "yetki");
      const b = await govde(request), sorular = Array.isArray(b.sorular) ? b.sorular : [];
      const baslangic = Math.floor(+b.baslangic || 0), sure = tamSayi(b.sure, 300), baslik = adTemiz(b.baslik);
      if (!baslik || baslangic < now - 3600000 || sure < 5) return fail(400, "gecersiz", "Başlık, başlangıç zamanı ve süreyi kontrol et.");
      if (sorular.length < 5 || sorular.length > 200 || !sorular.every(q => q && typeof q.q === "string" && Array.isArray(q.o) && q.o.length === 5 && Number.isInteger(q.a) && q.a >= 0 && q.a < 5)) return fail(400, "sorular", "Sorular eksik ya da hatalı.");
      const js = JSON.stringify(sorular); if (js.length > 2500000) return fail(413, "buyuk");
      const secs = Array.isArray(b.secs) ? b.secs.slice(0, 20).map(x => ({ n: adTemiz(x.n), from: tamSayi(x.from, 200), to: tamSayi(x.to, 200) })) : [{ n: baslik, from: 0, to: sorular.length }];
      const id = yeniId("c");
      await env.DB.prepare("INSERT INTO canli (id, baslik, tur, baslangic, sure, adet, sorular, secs, tarih) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, baslik, adTemiz(b.tur).slice(0, 8), baslangic, sure, sorular.length, js, JSON.stringify(secs), now).run();
      return json(200, { id });
    }
    const c = await env.DB.prepare("SELECT * FROM canli WHERE id = ?").bind(String(yol[1] || "")).first();
    if (!c) return fail(404, "yok", "Bu deneme bulunamadı.");
    const islem = yol[2] || "", bitis = bitisOf(c), durum = durumOf(c, now);
    if (islem === "sil" && m === "POST") {
      if (!yon) return fail(403, "yetki");
      await env.DB.batch([env.DB.prepare("DELETE FROM canli_sonuc WHERE canli = ?").bind(c.id), env.DB.prepare("DELETE FROM canli WHERE id = ?").bind(c.id)]);
      return json(200, { ok: true });
    }
    const benim = await env.DB.prepare("SELECT cevap, d, y, b, net, sure FROM canli_sonuc WHERE canli = ? AND kid = ?").bind(c.id, u.id).first();
    if (islem === "sorular" && m === "GET") {
      if (durum === "yakinda") return fail(425, "erken", "Deneme henüz başlamadı.");
      if (benim) return fail(409, "gonderildi", "Bu denemeyi zaten gönderdin.");
      if (now > bitis - 60000) return fail(410, "bitti", "Deneme bitti.");
      const qs = JSON.parse(c.sorular).map(({ a, x, ...q }) => q);
      return json(200, { id: c.id, baslik: c.baslik, tur: c.tur, bitis, secs: JSON.parse(c.secs || "[]"), sorular: qs }, { "cache-control": "no-store" });
    }
    if (islem === "gonder" && m === "POST") {
      if (durum === "yakinda") return fail(425, "erken");
      if (now > bitis + 180000) return fail(410, "bitti", "Gönderim süresi doldu.");
      if (benim) return json(200, { d: benim.d, y: benim.y, b: benim.b, net: benim.net, bitis, zaten: true });
      const b = await govde(request), qs = JSON.parse(c.sorular), cev = Array.isArray(b.cevap) ? b.cevap : [];
      if (cev.length !== qs.length) return fail(400, "gecersiz");
      let d = 0, y = 0, bos = 0;
      const temiz = qs.map((q, i) => { const a = cev[i]; if (!Number.isInteger(a) || a < 0 || a > 4) { bos++; return null; } if (a === q.a) d++; else y++; return a; });
      const sure = Math.min(c.sure * 60, tamSayi(b.sure, 86400));
      await env.DB.prepare("INSERT OR IGNORE INTO canli_sonuc (canli, kid, cevap, d, y, b, net, sure, tarih) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(c.id, u.id, JSON.stringify(temiz), d, y, bos, net(d, y), sure, now).run();
      return json(200, { d, y, b: bos, net: net(d, y), bitis });
    }
    if (islem === "sonuc" && m === "GET") {
      const ben = benim ? { d: benim.d, y: benim.y, b: benim.b, net: benim.net, sure: benim.sure } : null;
      /* Bitmiş denemenin sıralaması 20 sn önbelleğe alınır: binlerce kişi aynı anda sonuca bakınca veritabanı yorulmaz */
      const onb = ONBELLEK.get(c.id), taze = onb && now - onb.t < 20000 && now >= bitis;
      const say = taze ? onb.say : await env.DB.prepare("SELECT COUNT(*) AS n FROM canli_sonuc WHERE canli = ?").bind(c.id).first();
      const temel = { id: c.id, baslik: c.baslik, tur: c.tur, baslangic: c.baslangic, bitis, sure: c.sure, adet: c.adet, durum, katilan: say.n, benim: ben };
      if (now < bitis) return json(200, Object.assign(temel, { acik: false }), { "cache-control": "no-store" });
      let results;
      if (taze) results = onb.results;
      else {
        const r0 = await env.DB.prepare("SELECT s.kid, COALESCE(t.ad, 'Öğrenci') AS takma, s.d, s.y, s.b, s.net, s.sure FROM canli_sonuc s LEFT JOIN takma t ON t.kid = s.kid WHERE s.canli = ? ORDER BY s.net DESC, s.sure ASC LIMIT 100").bind(c.id).all();
        results = r0.results; if (ONBELLEK.size > 50) ONBELLEK.clear(); ONBELLEK.set(c.id, { t: now, say, results });
      }
      let sira = null;
      if (ben) { const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM canli_sonuc WHERE canli = ? AND (net > ? OR (net = ? AND sure < ?))").bind(c.id, ben.net, ben.net, ben.sure).first(); sira = r.n + 1; }
      const ilk = (results || []).map((r, i) => ({ sira: i + 1, takma: String(r.takma || "Öğrenci").split(" ")[0], d: r.d, y: r.y, b: r.b, net: r.net, ben: r.kid === u.id }));
      return json(200, Object.assign(temel, { acik: true, sira, siralama: ilk, sorular: JSON.parse(c.sorular), secs: JSON.parse(c.secs || "[]"), cevabim: benim ? JSON.parse(benim.cevap || "[]") : null }));
    }
    return fail(404, "yok");
  }
  return fail(404, "yok");
}
