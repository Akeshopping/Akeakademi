// AKE Akademi · site hata kaydı (Cloudflare Pages Function) · adres: /api/hata
//   POST /api/hata {m, s, l, p, c}   ziyaretçinin tarayıcısında oluşan beklenmeyen hata (kişisel veri içermez)
//   GET  /api/hata                   (yönetici) son hatalar
//   POST /api/hata/temizle           (yönetici) listeyi sıfırlar
import { json, fail, sema, oturum, yoneticiMi, sha256 } from "../../lib/ortak.js";
import { hizSinir, ipHiz, bekleBaslik } from "../../lib/hiz.js";

const kirp = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").slice(0, n);
let hazir = false;

export async function onRequest({ request, env }) {
  if (!env.DB) return fail(500, "yapilandirma");
  await sema(env);
  if (!hazir) { await env.DB.prepare("CREATE TABLE IF NOT EXISTS hata (anahtar TEXT PRIMARY KEY, mesaj TEXT, kaynak TEXT, sayfa TEXT, cihaz TEXT, sayi INTEGER, ilk INTEGER, son INTEGER)").run(); hazir = true; }
  const url = new URL(request.url), now = Date.now(), temizle = url.pathname.replace(/\/+$/, "").endsWith("/temizle");

  if (request.method === "POST" && !temizle) {
    /* Kayıt sınırı (D1, atomik): IP başına saatte 20 + tüm site için saatte 1500 yazma (farklı IP'lerle tabloyu şişirmeyi/yazma yükünü sınırlar). */
    const hi = await ipHiz(env, request, "hata", 20, 3600000);
    if (!hi.izin) return fail(429, "cok_istek", "", bekleBaslik(hi));
    const hg = await hizSinir(env, { kova: "hata-genel", kimlik: "tum", adet: 1500, ms: 3600000 });
    if (!hg.izin) return fail(429, "cok_istek", "", bekleBaslik(hg));
    let b = {}; try { b = await request.json(); } catch (e) { }
    const mesaj = kirp(b.m, 300).trim();
    if (!mesaj) return fail(400, "gecersiz");
    const kaynak = kirp(b.s, 160) + (b.l ? ":" + (+b.l || 0) : ""), anahtar = (await sha256(mesaj + "|" + kaynak)).slice(0, 24);
    await env.DB.prepare("INSERT INTO hata (anahtar, mesaj, kaynak, sayfa, cihaz, sayi, ilk, son) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT (anahtar) DO UPDATE SET sayi = sayi + 1, son = excluded.son, sayfa = excluded.sayfa, cihaz = excluded.cihaz")
      .bind(anahtar, mesaj, kaynak, kirp(b.p, 40), kirp(b.c, 80), now, now).run();
    if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM hata WHERE anahtar NOT IN (SELECT anahtar FROM hata ORDER BY son DESC LIMIT 300)").run();
    return json(200, { ok: true });
  }

  const u = await oturum(request, env);
  if (!yoneticiMi(env, u)) return fail(403, "yetki");
  if (request.method === "POST" && temizle) { await env.DB.prepare("DELETE FROM hata").run(); return json(200, { ok: true }); }
  if (request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT mesaj, kaynak, sayfa, cihaz, sayi, ilk, son FROM hata ORDER BY son DESC LIMIT 60").all();
    return json(200, { hatalar: results || [] }, { "cache-control": "no-store" });
  }
  return fail(405, "yok");
}
