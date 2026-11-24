// AKE Akademi · hesap "stats" belgesine ilerleme işleme (web index.html record() ile AYNI biçim).
//   topic["ders|konu"] = [doğru, yanlış, boş]   daily["YYYY-AA-GG"] = {q, c, tp}   tr["ders|konu"] = son 12 sonuç   td["ders|konu"] = [[d,y],[d,y],[d,y]]
// Yalnız bu dört sayaç değişir; web'in kendi hesapladığı alanlar (ans, para, badges…) olduğu gibi korunur.
// Mobil istemci bu hesabı KENDİ yapmaz: sunucu, kendi kaydettiği cevaplardan (soru_oturum_soru) uygular (bkz. lib/soru-api.js /ilerleme).
const sayi = v => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0);
const nesne = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/* gunMs: cevabın zamanı; tzDk: istemcinin UTC'den dakika farkı (Türkiye +180). Gün anahtarı istemcinin yerel gününe göredir (web gibi). */
export const gunAnahtari = (gunMs, tzDk) => new Date(gunMs + (tzDk || 0) * 60000).toISOString().slice(0, 10);

/* k: { ders, konu, zorluk (1-3), sonuc (1 doğru, 0 yanlış, -1 boş), gunMs, tzDk }. Girdiyi DEĞİŞTİRMEZ; yeni nesne döner. */
export function ilerlemeUygula(stats, k) {
  const s = JSON.parse(JSON.stringify(nesne(stats)));
  const key = k.ders + "|" + k.konu;
  s.topic = nesne(s.topic);
  const t = Array.isArray(s.topic[key]) ? s.topic[key].map(sayi) : [0, 0, 0];
  while (t.length < 3) t.push(0);
  t[k.sonuc === 1 ? 0 : k.sonuc === 0 ? 1 : 2]++;
  s.topic[key] = t;
  if (k.sonuc !== -1) {
    s.daily = nesne(s.daily);
    const gun = gunAnahtari(k.gunMs, k.tzDk), day = nesne(s.daily[gun]);
    day.q = sayi(day.q) + 1; if (k.sonuc === 1) day.c = sayi(day.c) + 1; else day.c = sayi(day.c);
    day.tp = nesne(day.tp); day.tp[key] = sayi(day.tp[key]) + 1;
    s.daily[gun] = day;
    s.tr = nesne(s.tr);
    const dz = String(s.tr[key] || "") + k.sonuc; s.tr[key] = dz.slice(-12);
    s.td = nesne(s.td);
    const eski = Array.isArray(s.td[key]) ? s.td[key] : [], td = [0, 1, 2].map(i => (Array.isArray(eski[i]) ? [sayi(eski[i][0]), sayi(eski[i][1])] : [0, 0]));
    const di = Math.min(2, Math.max(0, (k.zorluk || 2) - 1)); td[di][k.sonuc === 1 ? 0 : 1]++;
    s.td[key] = td;
  }
  return s;
}

/* ---------- veritabanı işleme (yalnız /api/soru/ilerleme çağırır; bayrak kapalıyken hiç çalışmaz) ---------- */
const ILERLEME_SATIR = 200;
/* tek oturumun işlenmemiş cevaplarını hesaba işler; başarıda null, hatada {durum, kod, mesaj} döner */
export async function ilerlemeOturum(env, kid, oturumId, tz) {
  const P = q => env.DB.prepare(q);
  for (let deneme = 0; deneme < 6; deneme++) {
    const { results } = await P(`SELECT q.soru_id AS id, q.cevap_zamani AS zaman, q.dogru AS dogru, s.s AS ders, s.t AS konu, s.d AS d
      FROM soru_oturum_soru q JOIN soru s ON s.id = q.soru_id
      WHERE q.oturum = ? AND q.secim IS NOT NULL AND q.dogru IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM ilerleme_olay e WHERE e.kid = ? AND e.oturum = q.oturum AND e.soru_id = q.soru_id)
      ORDER BY q.sira LIMIT ${ILERLEME_SATIR}`).bind(oturumId, kid).all();
    const satirlar = results || [];
    if (!satirlar.length) return null;
    const cur = await P("SELECT json, u FROM veri WHERE kid = ? AND alan = 'stats'").bind(kid).first();
    let stats = {};
    if (cur) { try { stats = JSON.parse(cur.json); } catch (e) { return { durum: 503, kod: "gecici", mesaj: "" }; } if (!stats || typeof stats !== "object" || Array.isArray(stats)) return { durum: 503, kod: "gecici", mesaj: "" }; }
    for (const r of satirlar) stats = ilerlemeUygula(stats, { ders: r.ders, konu: r.konu, zorluk: r.d, sonuc: r.dogru ? 1 : 0, gunMs: r.zaman || Date.now(), tzDk: tz });
    const yeniU = Math.max(Date.now(), (cur ? cur.u : 0) + 1); stats._u = yeniU;
    const ham = JSON.stringify(stats); if (ham.length > 262144) return { durum: 413, kod: "buyuk", mesaj: "" };
    const st = [
      cur ? P("UPDATE veri SET json = ?, u = ? WHERE kid = ? AND alan = 'stats' AND u = ?").bind(ham, yeniU, kid, cur.u)
          : P("INSERT INTO veri (kid, alan, json, u) SELECT ?, 'stats', ?, ? WHERE NOT EXISTS (SELECT 1 FROM veri WHERE kid = ? AND alan = 'stats')").bind(kid, ham, yeniU, kid),
      P("INSERT INTO ilerleme_olay (kid, oturum, soru_id, zaman) SELECT ?, ?, j.value, ? FROM json_each(?) j WHERE changes() = 1").bind(kid, oturumId, Date.now(), JSON.stringify(satirlar.map(r => r.id)))
    ];
    try { await env.DB.batch(st); }
    catch (e) { if (!/UNIQUE|constraint/i.test(String(e && e.message))) throw e; }   // eşzamanlı aynı çağrı önce bitirdi: yeniden okuyup devam
  }
  return { durum: 503, kod: "mesgul", mesaj: "Şu an yoğun, tekrar dene." };
}
const BEKLEYEN_OTURUM = `SELECT DISTINCT q.oturum AS id FROM soru_oturum_soru q JOIN soru_oturum o ON o.id = q.oturum
  WHERE o.kid = ? AND o.mod = 'practice' AND q.secim IS NOT NULL AND q.dogru IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ilerleme_olay e WHERE e.kid = o.kid AND e.oturum = q.oturum AND e.soru_id = q.soru_id)`;

export async function bekleyenOturumlar(env, kid, limit) {
  const { results } = await env.DB.prepare(BEKLEYEN_OTURUM + " ORDER BY q.oturum LIMIT ?").bind(kid, limit).all();
  return (results || []).map(r => r.id);
}
export async function bekleyenOturumSayisi(env, kid) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${BEKLEYEN_OTURUM})`).bind(kid).first();
  return r ? r.n : 0;
}
