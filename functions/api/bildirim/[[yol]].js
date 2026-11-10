// AKE Akademi · telefon/tablet bildirimleri (Web Push) · adres: /api/bildirim/...
//   GET  anahtar            herkese açık VAPID anahtarı (tarayıcı abonelik için ister)
//   POST abone {sub,slots}  giriş yapmış öğrenci bu cihazı bildirimlere ekler
//   POST iptal {endpoint}   cihazı çıkarır
//   POST test               yalnızca kendi cihazlarına deneme bildirimi
//   GET/POST gonder?k=...&s=sabah|ogle|aksam   zamanlayıcı çağırır (gizli anahtar gerekir)
import { json, fail, sema, oturum, ayarOku, ayarYaz, pushToken } from "../../../lib/ortak.js";
import { vapidUret, pushAdresi, pushGonder } from "../../../lib/webpush.js";

const SLOTLAR = ["sabah", "ogle", "aksam"];
const MESAJ = {
  sabah: [
    ["Günaydın! ☀️", "Bugünün sorusu seni bekliyor. Güne bir soruyla başla."],
    ["Yeni gün, yeni soru", "Her gün 20 soru = ayda 600 soru. Bugünün ilk sorusunu çöz."],
    ["Bugün hangi dersi çalışıyorsun?", "Konu seç, AKE Akademi'de hemen soru çözmeye başla."],
    ["Güne güçlü başla 💪", "Dünkü yanlışlarını gözden geçirmek için en iyi zaman şimdi."],
    ["Bir günün başı, bir sorunun ucu", "Günün sorusunu çözüp seriyi koru."],
    ["Çalışma planın hazır", "Bugünkü hedefini kontrol et ve ilk adımı at."]
  ],
  ogle: [
    ["Kısa bir mola, hızlı bir soru ⏱️", "10 dakikan varsa bir konu çalış, bir mini test çöz."],
    ["Yanlış defterin seni bekliyor", "Kaçırdığın soruları tekrar et, aynı hatayı bir daha yapma."],
    ["Bugünkü hedefe ne kadar yakınsın?", "Çözdüğün soru sayını kontrol et, kalanı tamamla."],
    ["Zor soruya hazır mısın?", "Bugün 5 zor seviye soru çöz; deneme sınavında fark yaratır."],
    ["Paragraf zamanı 📖", "5 paragraf sorusu hem hızını hem anlamanı geliştirir."],
    ["AI öğretmen yanında", "Takıldığın konuyu AI öğretmene sor, adım adım anlatsın."]
  ],
  aksam: [
    ["Gün bitmeden bir deneme? 📝", "Bu akşam kısa bir deneme çöz, ilerlemeni gör."],
    ["Serini koru 🔥", "Bugün henüz soru çözmediysen şimdi tam zamanı."],
    ["Akşam tekrarı", "Bugün çözdüğün yanlışları bir kez daha gözden geçir, kalıcı olsun."],
    ["Bugün ne öğrendin?", "Bir konu özeti iste, AI öğretmenle bugünü kapat."],
    ["Yarın için küçük bir adım", "10 soru çöz, yarına bir adım önde başla."],
    ["İyi çalışmalar, iyi geceler 🌙", "Bugünün çalışmasını tamamla; yarın seni yeni sorular bekliyor."]
  ]
};
const TEST = ["AKE Akademi bildirimleri açık ✅", "Bundan sonra seçtiğin saatlerde kısa hatırlatmalar alacaksın."];

async function vapid(env) {
  let pub = await ayarOku(env, "vapid_pub"), priv = await ayarOku(env, "vapid_priv");
  if (!pub || !priv) { const v = await vapidUret(); await ayarYaz(env, "vapid_pub", v.pub); await ayarYaz(env, "vapid_priv", v.priv); pub = v.pub; priv = v.priv; }
  return { pub, priv };
}
const esit = (a, b) => { a = String(a || ""); b = String(b || ""); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const gunNo = () => Math.floor((Date.now() + 3 * 3600e3) / 86400e3);
const subGecerli = s => s && pushAdresi(s.endpoint) && s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string" && s.keys.p256dh.length < 200 && s.keys.auth.length < 60;

export async function onRequest({ request, env, params }) {
  if (!env.DB) return fail(500, "yapilandirma");
  await sema(env);
  const ad = [].concat(params.yol || [])[0] || "", m = request.method, url = new URL(request.url);

  if (ad === "anahtar" && m === "GET") { const v = await vapid(env); return json(200, { anahtar: v.pub }); }

  if (ad === "gonder") {
    if (!esit(url.searchParams.get("k"), await pushToken(env))) return fail(403, "yetki");
    const s = url.searchParams.get("s") || "sabah"; if (!SLOTLAR.includes(s)) return fail(400, "slot");
    const v = await vapid(env), liste = MESAJ[s], [t, b] = liste[gunNo() % liste.length];
    const bas = Math.max(0, +url.searchParams.get("o") || 0), LIM = 800;
    const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push WHERE slots LIKE ? ORDER BY endpoint LIMIT ? OFFSET ?").bind('%"' + s + '"%', LIM, bas).all();
    let ok = 0, silinen = 0, hata = 0; const rows = results || [];
    for (let i = 0; i < rows.length; i += 25) {
      const sonuc = await Promise.all(rows.slice(i, i + 25).map(r => pushGonder({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, { t, b, u: "/", tag: "ake-" + s }, v)));
      for (let j = 0; j < sonuc.length; j++) { const x = sonuc[j]; if (x.ok) ok++; else if (x.silinmeli) { silinen++; await env.DB.prepare("DELETE FROM push WHERE endpoint = ?").bind(rows[i + j].endpoint).run(); } else hata++; }
    }
    return json(200, { slot: s, gonderilen: ok, silinen, hata, siradaki: rows.length === LIM ? bas + LIM : null });
  }

  const u = await oturum(request, env);
  if (!u) return fail(401, "giris", "Bildirimler için giriş yapmalısın.");

  if (ad === "abone" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { }
    if (!subGecerli(b?.sub)) return fail(400, "gecersiz");
    const slots = [].concat(b.slots || []).filter(x => SLOTLAR.includes(x)); if (!slots.length) return fail(400, "slot", "En az bir saat seç.");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM push WHERE kid = ? AND endpoint != ?").bind(u.id, b.sub.endpoint).first();
    if (n && n.n >= 5) await env.DB.prepare("DELETE FROM push WHERE endpoint IN (SELECT endpoint FROM push WHERE kid = ? AND endpoint != ? ORDER BY tarih ASC LIMIT ?)").bind(u.id, b.sub.endpoint, n.n - 4).run();
    const r = await env.DB.prepare("INSERT INTO push (endpoint, kid, p256dh, auth, slots, tarih) SELECT ?, id, ?, ?, ?, ? FROM kullanici WHERE id = ? ON CONFLICT (endpoint) DO UPDATE SET kid = excluded.kid, p256dh = excluded.p256dh, auth = excluded.auth, slots = excluded.slots, tarih = excluded.tarih")
      .bind(b.sub.endpoint, b.sub.keys.p256dh, b.sub.keys.auth, JSON.stringify(slots), Date.now(), u.id).run();
    if (r.meta?.changes !== 1) return fail(401, "giris", "Bildirimler için giriş yapmalısın.");
    return json(200, { ok: true, slots });
  }
  if (ad === "iptal" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { }
    if (b.endpoint) await env.DB.prepare("DELETE FROM push WHERE endpoint = ? AND kid = ?").bind(String(b.endpoint), u.id).run();
    return json(200, { ok: true });
  }
  if (ad === "durum" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT endpoint, slots FROM push WHERE kid = ?").bind(u.id).all();
    return json(200, { cihazlar: (results || []).map(r => ({ endpoint: r.endpoint, slots: JSON.parse(r.slots || "[]") })) });
  }
  if (ad === "test" && m === "POST") {
    const v = await vapid(env); const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push WHERE kid = ?").bind(u.id).all();
    let ok = 0; for (const r of results || []) { const x = await pushGonder(r, { t: TEST[0], b: TEST[1], u: "/", tag: "ake-test" }, v, { urgency: "high", ttl: 600 }); if (x.ok) ok++; else if (x.silinmeli) await env.DB.prepare("DELETE FROM push WHERE endpoint = ?").bind(r.endpoint).run(); }
    return json(200, { gonderilen: ok, cihaz: (results || []).length });
  }
  return fail(404, "yok");
}
