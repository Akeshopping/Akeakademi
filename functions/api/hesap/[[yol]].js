// AKE Akademi · hesap sunucusu (Cloudflare Pages Function) · adres: /api/hesap/...
//
// Gerekenler (Cloudflare > Workers & Pages > akeakademi > Settings):
//   Bindings: D1 veritabanı, değişken adı DB
//   RESEND_API_KEY      (Secret) giriş kodu e-postaları için
//   GOOGLE_CLIENT_ID    Google ile giriş için (isteğe bağlı)
//   GOOGLE_CLIENT_SECRET (Secret) Google ile giriş için (isteğe bağlı)
//   AKE_GIZLI           (Secret) erişim kodlarını doğrulayan anahtar (AI ile aynı)
//   AKE_YONETICI        (isteğe bağlı) yönetici e-postası, varsayılan alikaaneren13@gmail.com
//
// Uçlar:
//   POST kod-gonder {eposta}         e-postaya 8 haneli giriş kodu gönderir (60 sn bekleme + saatte 5 kod: tek atomik komut)
//   POST kod-dogrula {eposta, kod}    kodu doğrular, oturum açar (çerez). Deneme hakkı ÖNCE atomik ayrılır, kod tek komutta tüketilir.
//   GET  ben                          oturumdaki kullanıcı, paket, bu ayki kullanım
//   GET  kota                         ücretsiz kalan hak (günlük soru, aylık deneme)
//   POST kota {tur, adet}             ücretsiz hak ayırır (tur: soru | deneme); biterse 402
//   POST cikis                        oturumu kapatır
//   GET  google / google-donus        Google ile giriş
//   GET  veri                         hesaptaki çalışma verisi (alanlar)
//   PUT  veri/<alan>                  bir alanı kaydeder
//   POST kod-bagla {kod}              erişim kodunu hesaba bağlar
//   POST sil                          hesabı ve verilerini siler

import { json, fail, sha256, sema, oturum, oturumAc, cerez, cerezYaz, kullaniciBulVeyaAc, yoneticiMi, aktifPaket, kodBagla, kullanimAl, limitler, epostaGonder, epostaSablon, bekleyenKodlariBagla } from "../../../lib/ortak.js";
import { sosyalSil } from "../../../lib/sosyal.js";
import { kotaDurum, kotaAl, kotaKorumaYaz, kotaTemizle } from "../../../lib/kota.js";

const ALANLAR = ["profile", "stats", "exams", "mistakes", "cards", "plan", "ai", "reports"];
const EPOSTA_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const ipHits = new Map();

/* Giriş kodu ayarları. Yeni kodlar 8 haneli. ESKI_KOD_HANE yalnızca geçiş içindir: dağıtımdan önce gönderilmiş 6 haneli kodlar
   (en çok 10 dk geçerli) çalışmaya devam etsin. Hash kod metnini içerdiği için 6 haneli bir giriş 8 haneli kodu asla eşleştirmez;
   dağıtımdan 10 dk sonra ESKI_KOD_HANE kabulü güvenle kaldırılabilir. */
const KOD_HANE = 8, ESKI_KOD_HANE = 6, KOD_OMRU_MS = 10 * 60000, DENEME_LIMIT = 5, BEKLEME_MS = 60000, PENCERE_MS = 3600000, SAATLIK_KOD = 5;
const degisti = r => !!(r && r.meta && r.meta.changes > 0);
/* Tek tip hata: yanlış kod, süresi dolmuş kod, dolan deneme hakkı, hiç istenmemiş kod ve kullanılmış kod ayırt edilemez (hesap/kod durumu sızmaz) */
const kodHatasi = () => fail(400, "kod_yanlis", "Kod hatalı ya da süresi dolmuş. Yeni kod iste.");
/* Düzgün dağılımlı (modulo yanlılığı olmayan) 8 haneli kod; baştaki sıfırlar korunur */
function girisKodu() {
  const a = new Uint32Array(1), sinir = Math.floor(4294967296 / 10 ** KOD_HANE) * 10 ** KOD_HANE;
  do { crypto.getRandomValues(a); } while (a[0] >= sinir);
  return String(a[0] % 10 ** KOD_HANE).padStart(KOD_HANE, "0");
}

async function govde(request) { try { return await request.json(); } catch (e) { return {}; } }
function ipSinir(request, anahtar, adet, ms) {
  const ip = request.headers.get("cf-connecting-ip") || "?", k = anahtar + "|" + ip, now = Date.now();
  const l = (ipHits.get(k) || []).filter(t => now - t < ms); if (l.length >= adet) return false;
  l.push(now); ipHits.set(k, l); if (ipHits.size > 20000) ipHits.clear(); return true;
}
const kullaniciJson = (env, u) => ({ id: u.id, eposta: u.eposta || "", ad: u.ad || "", yonetici: yoneticiMi(env, u) });

export async function onRequest({ request, env, params }) {
  const yol = [].concat(params.yol || []), ad = yol[0] || "", m = request.method;
  if (!env.DB) return fail(500, "yapilandirma", "Veritabanı bağlı değil (DB).");
  try { await sema(env); } catch (e) { console.error("sema", e); return fail(500, "yapilandirma", "Veritabanı hazırlanamadı."); }
  const url = new URL(request.url);

  /* ---------- e-posta ile giriş ---------- */
  if (ad === "kod-gonder" && m === "POST") {
    const b = await govde(request), eposta = String(b.eposta || "").trim().toLowerCase();
    if (!EPOSTA_RE.test(eposta)) return fail(400, "eposta_gecersiz");
    if (!ipSinir(request, "kod", 8, 3600000)) return fail(429, "cok_istek");
    const now = Date.now(), kod = girisKodu(), hash = await sha256(eposta + ":" + kod + ":" + (env.AKE_GIZLI || "ake"));
    /* Bekleme süresi ve saatlik sınır TEK atomik komutta uygulanır (önce oku, sonra yaz yarışı yok): eşzamanlı istekler bekleme süresini
       atlayıp her seferinde deneme sayacını sıfırlayamaz. Şartlar sağlanmazsa satıra dokunulmaz ve etkilenen satır 0 olur. */
    const talep = await env.DB.prepare(`INSERT INTO giris (eposta, hash, bitis, deneme, son_gonderim, pencere, sayac) VALUES (?, ?, ?, 0, ?, ?, 1)
      ON CONFLICT (eposta) DO UPDATE SET hash = excluded.hash, bitis = excluded.bitis, deneme = 0, son_gonderim = excluded.son_gonderim,
        pencere = CASE WHEN excluded.son_gonderim - COALESCE(giris.pencere, 0) < ${PENCERE_MS} THEN giris.pencere ELSE excluded.son_gonderim END,
        sayac = CASE WHEN excluded.son_gonderim - COALESCE(giris.pencere, 0) < ${PENCERE_MS} THEN COALESCE(giris.sayac, 0) + 1 ELSE 1 END
      WHERE excluded.son_gonderim - COALESCE(giris.son_gonderim, 0) >= ${BEKLEME_MS}
        AND (excluded.son_gonderim - COALESCE(giris.pencere, 0) >= ${PENCERE_MS} OR COALESCE(giris.sayac, 0) < ${SAATLIK_KOD})`)
      .bind(eposta, hash, now + KOD_OMRU_MS, now, now).run();
    if (!degisti(talep)) { /* yalnızca ileti için okunur (karar yukarıdaki atomik komutta verildi) */
      const g = await env.DB.prepare("SELECT son_gonderim FROM giris WHERE eposta = ?").bind(eposta).first();
      return now - ((g && g.son_gonderim) || 0) < BEKLEME_MS ? fail(429, "bekle", "Yeni kod için 1 dakika bekle.") : fail(429, "cok_istek", "Bir saat içinde en fazla 5 kod istenebilir.");
    }
    const r = await epostaGonder(env, {
      to: eposta, subject: `AKE Akademi giriş kodun: ${kod}`,
      text: `AKE Akademi giriş kodun: ${kod}\n\nKod 10 dakika geçerlidir. Bu kodu kimseyle paylaşma.`,
      html: epostaSablon("Giriş kodun", `<p style="margin:0 0 14px">akeakademi.com'a giriş yapmak için bu kodu yaz:</p><div style="font-size:32px;font-weight:800;letter-spacing:5px;background:#e9eeff;color:#1c38b0;border-radius:10px;padding:14px;text-align:center">${kod}</div><p style="margin:14px 0 0;color:#475569">Kod 10 dakika geçerlidir. Bu kodu kimseyle paylaşma; AKE Akademi senden asla kod istemez.</p>`)
    });
    if (!r.ok) return fail(502, r.hata === "yapilandirma" ? "yapilandirma" : "eposta", "E-posta gönderilemedi.");
    return json(200, { ok: true });
  }
  if (ad === "kod-dogrula" && m === "POST") {
    const b = await govde(request), eposta = String(b.eposta || "").trim().toLowerCase(), kod = String(b.kod || "").replace(/\D/g, "");
    if (!EPOSTA_RE.test(eposta) || (kod.length !== KOD_HANE && kod.length !== ESKI_KOD_HANE)) return fail(400, "kod_gecersiz");
    if (!ipSinir(request, "dogrula", 30, 3600000)) return fail(429, "cok_istek");
    /* 0) Doğrulanacak kod kaydı okunur (yalnızca hangi kod sürümüne bağlanacağımızı belirler; karar verilmez). Süreç sürerken yeni kod üretilirse
       (kod-gonder hash'i değiştirir) bu doğrulamanın ayıracağı hak YENİ kodun kaydına geçemesin diye hak, okunan hash'e bağlanır. */
    const kayit = await env.DB.prepare("SELECT hash FROM giris WHERE eposta = ? AND hash IS NOT NULL AND bitis > ?").bind(eposta, Date.now()).first();
    if (!kayit || !kayit.hash) return kodHatasi();
    /* 1) Deneme hakkı, kod karşılaştırılmadan ÖNCE tek atomik komutla ayrılır: şart (okunan kod hâlâ aynı + süresi geçmedi + hak < 5) ve artış aynı komuttadır.
       Eşzamanlı N istekten en çok 5'i bu adımı geçer; sınır dolmuşsa kod doğru olsa bile reddedilir. Sayaç başarısız denemelerde geri alınmaz.
       Araya yeni kod girmişse (hash değişti) komut hiçbir satıra dokunmaz: yeni kodun sayacı/kaydı bu doğrulamadan etkilenmez. */
    const rez = await env.DB.prepare("UPDATE giris SET deneme = COALESCE(deneme, 0) + 1 WHERE eposta = ? AND hash = ? AND bitis > ? AND COALESCE(deneme, 0) < ?").bind(eposta, kayit.hash, Date.now(), DENEME_LIMIT).run();
    if (!degisti(rez)) return kodHatasi();
    /* 2) Karşılaştırma ve tüketim de tek atomik komuttur (hash eşleşirse silinir): aynı doğru kodla gelen eşzamanlı isteklerden yalnızca biri etkilenir (tek kullanım).
       Hak ayrılan kayıtla (kayit.hash) gönderilen kodun özeti aynı olmalı; bu komut yalnızca gönderilen koda karşılık gelen kaydı tüketir. */
    const hash = await sha256(eposta + ":" + kod + ":" + (env.AKE_GIZLI || "ake"));
    if (hash !== kayit.hash) return kodHatasi();
    const tuk = await env.DB.prepare("UPDATE giris SET hash = NULL, deneme = 0 WHERE eposta = ? AND hash = ? AND bitis > ?").bind(eposta, hash, Date.now()).run();
    if (!degisti(tuk)) return kodHatasi();
    const kid = await kullaniciBulVeyaAc(env, { eposta }), c = await oturumAc(env, kid);
    await bekleyenKodlariBagla(env, kid, eposta).catch(() => { });
    const u = { id: kid, eposta, ad: "" };
    return json(200, { kullanici: kullaniciJson(env, u), paket: await aktifPaket(env, kid), ucretsiz: await kotaDurum(env, kid).catch(() => null) }, { "set-cookie": c });
  }

  /* ---------- Google ile giriş ---------- */
  if (ad === "google" && m === "GET") {
    if (!env.GOOGLE_CLIENT_ID) return Response.redirect(url.origin + "/#hesap", 302);
    const state = crypto.randomUUID(), redir = url.origin + "/api/hesap/google-donus";
    const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redir, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
    return new Response(null, { status: 302, headers: { location: "https://accounts.google.com/o/oauth2/v2/auth?" + q, "set-cookie": cerezYaz("ake_g", state, 600) } });
  }
  if (ad === "google-donus" && m === "GET") {
    const hata = r => new Response(null, { status: 302, headers: { location: url.origin + "/#hesap?hata=" + r, "set-cookie": cerezYaz("ake_g", "", 0) } });
    const code = url.searchParams.get("code"), state = url.searchParams.get("state");
    if (!code || !state || state !== cerez(request, "ake_g")) return hata("google");
    const t = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET || "", redirect_uri: url.origin + "/api/hesap/google-donus", grant_type: "authorization_code" }) }).catch(() => null);
    if (!t || !t.ok) { console.error("google token", t && t.status, t && (await t.text().catch(() => "")).slice(0, 200)); return hata("google"); }
    const tj = await t.json().catch(() => ({}));
    let p = {};
    try { let s = String(tj.id_token || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)))); } catch (e) { return hata("google"); }
    /* Belirteç doğrudan Google'ın sunucusundan alındı; yine de temel alanlar kontrol edilir */
    if (p.aud !== env.GOOGLE_CLIENT_ID || !/accounts\.google\.com$/.test(p.iss || "") || (p.exp || 0) * 1000 < Date.now() || !p.email || !p.email_verified) return hata("google");
    const kid = await kullaniciBulVeyaAc(env, { eposta: p.email, ad: p.given_name || p.name || "", google: "g:" + p.sub });
    await bekleyenKodlariBagla(env, kid, p.email).catch(() => { });
    const c = await oturumAc(env, kid);
    const h = new Headers({ location: url.origin + "/#hesap?giris=ok" }); h.append("set-cookie", c); h.append("set-cookie", cerezYaz("ake_g", "", 0));
    return new Response(null, { status: 302, headers: h });
  }

  /* ---------- oturum gerektirenler ---------- */
  const u = await oturum(request, env);
  if (ad === "ben" && m === "GET") {
    const ayar = { google: !!env.GOOGLE_CLIENT_ID, eposta: !!env.RESEND_API_KEY };
    if (!u) return json(401, { error: "giris", ayar });
    const paket = await aktifPaket(env, u.id), k = await kullanimAl(env, u.id);
    return json(200, { kullanici: kullaniciJson(env, u), paket, kullanim: k, limit: paket ? limitler(env, paket.plan) : null, ucretsiz: await kotaDurum(env, u.id).catch(() => null), ayar });
  }
  if (!u) return fail(401, "giris");
  if (ad === "kota" && m === "GET") return json(200, await kotaDurum(env, u.id));
  if (ad === "kota" && m === "POST") {
    const b = await govde(request), r = await kotaAl(env, u.id, String(b.tur || ""), b.adet);
    if (r.hata) return json(r.durum || 400, { error: r.hata, ...r });
    return json(200, r);
  }
  if (ad === "cikis" && m === "POST") {
    const t = cerez(request, "ake_s"); if (t) await env.DB.prepare("DELETE FROM oturum WHERE hash = ?").bind(await sha256(t)).run();
    return json(200, { ok: true }, { "set-cookie": cerezYaz("ake_s", "", 0) });
  }
  if (ad === "veri" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT alan, json FROM veri WHERE kid = ?").bind(u.id).all();
    const alanlar = {}; (results || []).forEach(r => { try { alanlar[r.alan] = JSON.parse(r.json); } catch (e) { } });
    return json(200, { alanlar });
  }
  if (ad === "veri" && m === "PUT") {
    const alan = yol[1]; if (!ALANLAR.includes(alan)) return fail(400, "alan");
    const ham = await request.text(); if (ham.length > 262144) return fail(413, "buyuk");
    let o; try { o = JSON.parse(ham); } catch (e) { return fail(400, "json"); }
    const yeniU = Number(o && o._u) || Date.now();
    /* Daha yeni kayıt varsa üzerine yazma (iki cihaz aynı anda) */
    const var_ = await env.DB.prepare("SELECT u FROM veri WHERE kid = ? AND alan = ?").bind(u.id, alan).first();
    if (var_ && var_.u > yeniU) return json(409, { error: "eski", u: var_.u });
    await env.DB.prepare("INSERT INTO veri (kid, alan, json, u) VALUES (?, ?, ?, ?) ON CONFLICT (kid, alan) DO UPDATE SET json = excluded.json, u = excluded.u").bind(u.id, alan, ham, yeniU).run();
    return json(200, { ok: true });
  }
  if (ad === "kod-bagla" && m === "POST") {
    if (!ipSinir(request, "bagla", 20, 3600000)) return fail(429, "cok_istek");
    const b = await govde(request), r = await kodBagla(env, u.id, b.kod);
    if (r.hata) return fail(r.durum || 400, r.hata);
    const k = await kullanimAl(env, u.id);
    return json(200, { paket: r.paket, kullanim: k, limit: r.paket ? limitler(env, r.paket.plan) : null });
  }
  if (ad === "sil" && m === "POST") {
    try { await sosyalSil(env, u.id); } catch (e) { console.error("sosyal sil", e); }
    /* Ücretsiz kota kötüye kullanımı önleme kaydı: bu günün soru ve bu ayın deneme kullanımı, e-postadan türetilen takma adlı kimliğe
       yazılır (düz e-posta, ad, Google kimliği, kid tutulmaz). Böylece aynı e-postayla yeniden açınca hak sıfırlanmaz. Kişisel hesap verisi
       aşağıda mevcut şekilde silinir. Hata olursa silme yine de tamamlanır. */
    await kotaKorumaYaz(env, u.id).catch(() => { });
    await env.DB.batch([
      env.DB.prepare("DELETE FROM veri WHERE kid = ?").bind(u.id),
      env.DB.prepare("DELETE FROM oturum WHERE kid = ?").bind(u.id),
      env.DB.prepare("DELETE FROM kullanim WHERE kid = ?").bind(u.id),
      env.DB.prepare("DELETE FROM ucretsiz WHERE kid = ?").bind(u.id),
      env.DB.prepare("UPDATE kod SET kid = 'silindi' WHERE kid = ?").bind(u.id),
      env.DB.prepare("DELETE FROM giris WHERE eposta = ?").bind(u.eposta || ""),
      env.DB.prepare("DELETE FROM kullanici WHERE id = ?").bind(u.id)
    ]);
    await kotaTemizle(env, true).catch(() => { }); /* geçmiş dönemlerin takma adlı kayıtlarını da sil */
    return json(200, { ok: true }, { "set-cookie": cerezYaz("ake_s", "", 0) });
  }
  return fail(404, "yok");
}
