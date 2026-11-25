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
/* Sınav (deneme) oturumu: BİTTİKTEN sonra tek seferde işlenir. Web finishRun() ile aynı iki sonuç: (1) her soru stats'a (doğru/yanlış/boş;
   boş yalnız topic[2]), (2) `exams` belgesine tek özet kaydı {id:"m:<oturum>", kind:"exam", d, y, b, net, sections, ...} (qs yok: web de eski kayıtlardan qs'yi atar).
   ÇİFT SAYIM KORUMASI: (a) özet kaydı kimliği oturuma bağlıdır; zaten varsa yeniden eklenmez. (b) stats güncellemesi ile ilerleme_olay satırları (tüm sorular, boşlar dahil)
   tek batch'te, "stats gerçekten değişti" şartıyla yazılır; olay satırı olan oturum bir daha işlenmez. (c) özet kaydı yazılamazsa stats'a dokunulmaz (changes() şartı).
   Kısmi durum (özet yazıldı, stats yazılamadı) güvenlidir: yeniden denemede özet atlanır, stats bir kez işlenir. */
const EXAMS_SINIR = 60;
export async function denemeOturum(env, kid, oturumId, tz) {
  const P = q => env.DB.prepare(q);
  const eid = "m:" + oturumId;
  for (let deneme = 0; deneme < 6; deneme++) {
    const o = await P("SELECT id, mod, durum, olusturma, bitis FROM soru_oturum WHERE id = ? AND kid = ?").bind(oturumId, kid).first();
    if (!o || o.mod !== "exam") return { durum: 404, kod: "yok", mesaj: "" };
    if (o.durum !== "bitti") return { durum: 409, kod: "oturum_acik", mesaj: "Deneme önce bitirilmeli." };
    const var_ = await P("SELECT 1 AS v FROM ilerleme_olay WHERE kid = ? AND oturum = ? LIMIT 1").bind(kid, oturumId).first();
    const { results } = await P(`SELECT q.soru_id AS id, q.secim AS secim, q.dogru AS dogru, s.s AS ders, s.t AS konu, s.d AS d
      FROM soru_oturum_soru q JOIN soru s ON s.id = q.soru_id WHERE q.oturum = ? ORDER BY q.sira`).bind(oturumId).all();
    const satirlar = results || [];
    if (!satirlar.length) return null;
    const exCur = await P("SELECT json, u FROM veri WHERE kid = ? AND alan = 'exams'").bind(kid).first();
    let exDoc = { exams: [] };
    if (exCur) { try { exDoc = JSON.parse(exCur.json); } catch (e) { return { durum: 503, kod: "gecici", mesaj: "" }; } if (!exDoc || typeof exDoc !== "object" || Array.isArray(exDoc)) return { durum: 503, kod: "gecici", mesaj: "" }; }
    if (!Array.isArray(exDoc.exams)) exDoc.exams = [];
    const ozetVar = exDoc.exams.some(e => e && e.id === eid);
    if (ozetVar && var_) return null;   // ikisi de tamam
    let D = 0, Y = 0, B = 0;
    for (const r of satirlar) { if (r.secim == null) B++; else if (r.dogru) D++; else Y++; }
    const st = [];
    let exHam = null, exYeniU = 0;
    if (!ozetVar) {
      const sure = Math.max(0, Math.min(86400, Math.round(((o.bitis || Date.now()) - (o.olusturma || o.bitis || Date.now())) / 1000)));
      exDoc.exams.push({ id: eid, kind: "exam", type: null, title: "Mobil deneme", date: o.bitis || Date.now(), secs: sure, dur: 0, mode: "exam", src: "mobil",
        sections: [{ n: "Mobil deneme", d: D, y: Y, b: B, net: D - Y / 4 }], d: D, y: Y, b: B, net: D - Y / 4 });
      if (exDoc.exams.length > EXAMS_SINIR) exDoc.exams = exDoc.exams.slice(-EXAMS_SINIR);
      exYeniU = Math.max(Date.now(), (exCur ? exCur.u : 0) + 1); exDoc._u = exYeniU;
      exHam = JSON.stringify(exDoc); if (exHam.length > 262144) return { durum: 413, kod: "buyuk", mesaj: "" };
      st.push(exCur ? P("UPDATE veri SET json = ?, u = ? WHERE kid = ? AND alan = 'exams' AND u = ?").bind(exHam, exYeniU, kid, exCur.u)
                    : P("INSERT INTO veri (kid, alan, json, u) SELECT ?, 'exams', ?, ? WHERE NOT EXISTS (SELECT 1 FROM veri WHERE kid = ? AND alan = 'exams')").bind(kid, exHam, exYeniU, kid));
    }
    if (!var_) {
      const cur = await P("SELECT json, u FROM veri WHERE kid = ? AND alan = 'stats'").bind(kid).first();
      let stats = {};
      if (cur) { try { stats = JSON.parse(cur.json); } catch (e) { return { durum: 503, kod: "gecici", mesaj: "" }; } if (!stats || typeof stats !== "object" || Array.isArray(stats)) return { durum: 503, kod: "gecici", mesaj: "" }; }
      for (const r of satirlar) stats = ilerlemeUygula(stats, { ders: r.ders, konu: r.konu, zorluk: r.d, sonuc: r.secim == null ? -1 : (r.dogru ? 1 : 0), gunMs: o.bitis || Date.now(), tzDk: tz });
      const yeniU = Math.max(Date.now(), (cur ? cur.u : 0) + 1); stats._u = yeniU;
      const ham = JSON.stringify(stats); if (ham.length > 262144) return { durum: 413, kod: "buyuk", mesaj: "" };
      const sart = st.length ? " AND changes() = 1" : "";   // özet yazılamadıysa stats'a dokunma
      st.push(cur ? P(`UPDATE veri SET json = ?, u = ? WHERE kid = ? AND alan = 'stats' AND u = ?${sart}`).bind(ham, yeniU, kid, cur.u)
                  : P(`INSERT INTO veri (kid, alan, json, u) SELECT ?, 'stats', ?, ? WHERE NOT EXISTS (SELECT 1 FROM veri WHERE kid = ? AND alan = 'stats')${sart}`).bind(kid, ham, yeniU, kid));
      st.push(P("INSERT INTO ilerleme_olay (kid, oturum, soru_id, zaman) SELECT ?, ?, j.value, ? FROM json_each(?) j WHERE changes() = 1").bind(kid, oturumId, Date.now(), JSON.stringify(satirlar.map(r => r.id))));
    }
    try { await env.DB.batch(st); }
    catch (e) { if (!/UNIQUE|constraint/i.test(String(e && e.message))) throw e; }
  }
  return { durum: 503, kod: "mesgul", mesaj: "Şu an yoğun, tekrar dene." };
}
const BEKLEYEN_OTURUM = `SELECT DISTINCT q.oturum AS id FROM soru_oturum_soru q JOIN soru_oturum o ON o.id = q.oturum
  WHERE o.kid = ? AND o.mod = 'practice' AND q.secim IS NOT NULL AND q.dogru IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ilerleme_olay e WHERE e.kid = o.kid AND e.oturum = q.oturum AND e.soru_id = q.soru_id)`;

const BEKLEYEN_DENEME = `SELECT o.id AS id FROM soru_oturum o WHERE o.kid = ? AND o.mod = 'exam' AND o.durum = 'bitti'
  AND NOT EXISTS (SELECT 1 FROM ilerleme_olay e WHERE e.kid = o.kid AND e.oturum = o.id)`;
export async function bekleyenDenemeler(env, kid, limit) {
  const { results } = await env.DB.prepare(BEKLEYEN_DENEME + " ORDER BY o.id LIMIT ?").bind(kid, limit).all();
  return (results || []).map(r => r.id);
}
export async function bekleyenDenemeSayisi(env, kid) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${BEKLEYEN_DENEME})`).bind(kid).first();
  return r ? r.n : 0;
}
export async function bekleyenOturumlar(env, kid, limit) {
  const { results } = await env.DB.prepare(BEKLEYEN_OTURUM + " ORDER BY q.oturum LIMIT ?").bind(kid, limit).all();
  return (results || []).map(r => r.id);
}
export async function bekleyenOturumSayisi(env, kid) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${BEKLEYEN_OTURUM})`).bind(kid).first();
  return r ? r.n : 0;
}
