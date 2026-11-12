// AKE Akademi · yönetim uçları (yalnızca yönetici hesabı) · adres: /api/yonetim/...
//   GET  durum            Shopier kurulum durumu ve son siparişler
//   POST shopier-kur      Shopier'de sipariş bildirimini (webhook) kurar; SHOPIER_PAT gerekir
//   POST deneme-siparis   Ödeme yapmadan sahte bir siparişle sistemi dener (kod e-postası yöneticiye gider)
//   POST tekrar-gonder {id}  Bir siparişin kod e-postasını yeniden gönderir
//   POST soru-uret {s,t,sn,e,d,n,ornek}  AI ile soru üretir, onaya koyar
//   GET  sorular          onay bekleyen sorular ve sayılar
//   GET  aboneler         paketi süren aboneler
//   POST abone-iptal {kid}  abonenin paketini iptal eder (hesabı silmez); kullanıcı/aktif paket yoksa 404
//   Durum değiştiren (GET/HEAD/OPTIONS dışı) tüm istekler aynı kaynaktan (same-origin) gelmek zorundadır; aksi halde 403 "origin".
//   POST soru-karar {id|[id], karar:"onay"|"red"}
import { bayrakAcik, soruYazKanonik, kanonikAlanlar, soruOnayla } from "../../../lib/soru-yaz.js";
import { kodKutusu, json, fail, sema, oturum, yoneticiMi, ayarOku, ayarYaz, siparisIsle, epostaGonder, epostaSablon, PAKETLER, claude, jsonAyikla, soruSema, rastgele, giderBugun, giderYaz, gunTR, pushToken } from "../../../lib/ortak.js";

const LET = ["A", "B", "C", "D", "E"];
/* AI soru üretimi: hızlı model yazar, güçlü model cevabı görmeden çözer; tutanlar onaya düşer */
async function soruUret(env, b) {
  const s = String(b.s || ""), t = String(b.t || "").slice(0, 80), sn = String(b.sn || s), e = String(b.e || "YKS"), d = [1, 2, 3].includes(+b.d) ? +b.d : 2, n = Math.max(1, Math.min(10, +b.n || 5));
  const ornek = Array.isArray(b.ornek) ? b.ornek.slice(0, 2) : [], en = s === "ingilizce";
  const prompt = `${e} ${sn} dersi, "${t}" konusu için ${n} adet ${["", "kolay", "orta", "zor"][d]} seviyede, özgün çoktan seçmeli soru yaz.
Kurallar:
- ÖSYM soru tarzına ve 2026-2027 YKS müfredatına uy; hiçbir kaynaktan soru kopyalama.
- Her soruda tam 5 seçenek ve yalnızca bir kesin doğru cevap olsun; seçenekler birbirinden farklı ve makul olsun.
- Doğru cevabın yeri sorudan soruya değişsin (hep aynı şık olmasın).
- Sayısal sorularda sonucu iki kez hesapla. Sözel sorularda tartışmalı, yoruma açık ya da güncelliğini yitirebilecek bilgi kullanma.
- ${en ? "Soru ve seçenekler İngilizce, açıklama Türkçe olsun." : "Soru, seçenekler ve açıklama Türkçe olsun."}
- Paragraf sorusu yazıyorsan parçayı "p" alanına, soru kökünü "q" alanına koy; değilse "p" boş kalsın.
- Matematik ifadelerini düz metinle yaz: x^2, √x, a/b. LaTeX kullanma. Şekil gerektiren soru yazma.
- Soruda numaralı ifadeler (I, II, III…) kullanırsan seçenekler de "Yalnız I", "I ve II", "I, II ve III" gibi bu numaralara göre olsun; numaralı ifade kullanmayacaksan hiç numara koyma.
- Açıklama 2-4 cümle olsun ve çözümü adım adım göstersin.
${ornek.length ? "Üslup için bu konudaki mevcut örnekler (kopyalama, aynı tarzda yeni soru yaz):\n" + ornek.map(o => "- " + String(o).slice(0, 400)).join("\n") + "\n" : ""}Yalnızca JSON dizisi döndür:
[{"p":"","q":"Soru metni","o":["…","…","…","…","…"],"a":2,"x":"Açıklama"}]
"a", doğru seçeneğin 0-4 arası sırasıdır.`;
  const ham = await claude(env, { model: env.AKE_MODEL_HIZLI || "claude-haiku-5-5", prompt, effort: "medium", max_tokens: 12000 });
  let arr = jsonAyikla(ham);
  /* Yanıt yarıda kesildiyse ya da bozuksa: dizideki tamamlanmış soruları tek tek kurtar (boşa token harcanmasın) */
  if (!Array.isArray(arr)) {
    arr = []; const t = String(ham || "").replace(/```(?:json)?/gi, ""); let der = 0, bas = -1, str = false, kc = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (str) { if (kc) kc = false; else if (c === "\\") kc = true; else if (c === '"') str = false; continue; }
      if (c === '"') str = true; else if (c === "{") { if (!der) bas = i; der++; } else if (c === "}" && der) { der--; if (!der && bas >= 0) { try { arr.push(JSON.parse(t.slice(bas, i + 1))); } catch (e) { } bas = -1; } }
    }
  }
  if (!arr.length) return { hata: "uretim" };
  arr = arr.map(o => o && Object.assign({}, o, { a: Number(o.a) })).filter(o => o && typeof o.q === "string" && o.q.trim() && Array.isArray(o.o) && o.o.length === 5 && o.o.every(x => typeof x === "string" && x.trim()) && new Set(o.o.map(x => x.trim())).size === 5 && Number.isInteger(o.a) && o.a >= 0 && o.a <= 4).slice(0, n);
  /* numaralı ifade (I, II, III) varsa seçenekler de numaralara göre olmalı; yoksa soruyu ele */
  const nmr = o => (((o.p || "") + "\n" + o.q).match(/(^|\n)\s*(I{1,3}|IV|V)[.)]\s|\((I{1,3}|IV|V)\)/g) || []).length >= 2, rmz = o => o.o.filter(x => /^(yalnız\s+)?(I{1,3}|IV|V)(\s|,|$)/i.test(String(x).trim())).length;
  arr = arr.filter(o => !nmr(o) || rmz(o) >= 3);
  if (!arr.length) return { hata: "uretim" };
  const tut = arr; /* ikinci AI kontrolü kaldırıldı (token tasarrufu); sorular onay kuyruğunda elle kontrol edilir */
  const v2 = bayrakAcik(env), say = { yazilan: 0, gecersiz: 0, kopya: 0, catisma: 0, idCakisma: 0 };   // AKE_SORU_V2=1: legacy json + kanonik kolonlar tek INSERT'te (lib/soru-yaz.js)
  for (const o of tut) {
    if (v2) {
      const aday = { s, t, d, q: o.q.trim(), o: o.o.map(x => x.trim()), a: o.a, x: String(o.x || "").trim() || "Açıklama eklenmedi." };
      if (typeof o.p === "string" && o.p.trim()) aday.p = o.p.trim();
      const r = await soruYazKanonik(env, aday);
      if (r.durum === "yazildi" || r.durum === "kopya") say.yazilan++;
      if (r.durum === "kopya") say.kopya++; else if (r.durum === "gecersiz") say.gecersiz++; else if (r.durum === "catisma") say.catisma++; else if (r.durum === "idCakisma") say.idCakisma++;
      continue;
    }
    const q = { id: "ok-" + rastgele(5), s, t, d, q: o.q.trim(), o: o.o.map(x => x.trim()), a: o.a, x: String(o.x || "").trim() || "Açıklama eklenmedi." };
    if (typeof o.p === "string" && o.p.trim()) q.p = o.p.trim();
    await env.DB.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, ?, ?, ?, ?, 'onayli', ?, ?)").bind(q.id, s, t, d, JSON.stringify(q), Date.now(), Date.now()).run();
  }
  return v2 ? { uretilen: arr.length, gecen: say.yazilan, gecersiz: say.gecersiz, kopya: say.kopya, catisma: say.catisma, idCakisma: say.idCakisma } : { uretilen: arr.length, gecen: tut.length };
}

/* Cross-site istek koruması (CSRF): durum değiştiren isteğin Origin'i bu isteğin kendi adresinin origin'i ile birebir aynı olmalı.
   Joker (wildcard) yok: www ve apex ayrı origin sayılır; tarayıcı hangi adresten sayfayı açtıysa istek de oraya gider (göreli fetch).
   Origin yoksa (bazı eski istemciler) Sec-Fetch-Site: same-origin ya da aynı origin'li Referer aranır; hiçbiri yoksa reddedilir. */
const GUVENLI_YONTEM = new Set(["GET", "HEAD", "OPTIONS"]);
function ayniKaynak(request) {
  if (GUVENLI_YONTEM.has(request.method)) return true;
  const beklenen = new URL(request.url).origin, o = request.headers.get("origin");
  if (o !== null) return o === beklenen;
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  const ref = request.headers.get("referer");
  if (ref) { try { return new URL(ref).origin === beklenen; } catch (e) { return false; } }
  return false;
}

const API = "https://api.shopier.com/v1";
async function shopier(env, path, opt) {
  const r = await fetch(API + path, Object.assign({ headers: { Authorization: "Bearer " + env.SHOPIER_PAT, "content-type": "application/json", accept: "application/json" } }, opt || {})).catch(() => null);
  if (!r) return { ok: false, status: 0, j: null };
  let j = null; try { j = await r.json(); } catch (e) { }
  return { ok: r.ok, status: r.status, j };
}

/* soru-ice-aktar: aynı kimlikli kayıt varsa yüklenen içerik kanonik alanlara çevrilip mevcut kayıtla karşılaştırılır.
   Yanıtta yalnız FARKLI ALAN ADLARI döner (cevap/çözüm değeri asla yazılmaz). */
async function idIcerikKarsilastir(env, id, aday) {
  const m = await env.DB.prepare("SELECT s, t, d, govde, a, x FROM soru WHERE id = ?").bind(id).first();
  if (!m) return { ayni: false, farkli: ["kayit_okunamadi"] };
  const k = await kanonikAlanlar(Object.assign({ id }, aday), "statik");
  if (k.hata) return { ayni: false, farkli: ["gecersiz"] };
  if (m.govde == null || m.a == null || m.x == null) return { ayni: false, farkli: ["mevcut_kanonik_yok"] };
  const f = [];
  if (m.s !== aday.s) f.push("s"); if (m.t !== aday.t) f.push("t"); if (m.d !== aday.d) f.push("d");
  if (m.govde !== k.alan.govde) f.push("govde"); if (m.a !== k.alan.a) f.push("a"); if (String(m.x) !== k.alan.x) f.push("x");
  return { ayni: !f.length, farkli: f };
}
export async function onRequest({ request, env, params }) {
  if (!env.DB) return fail(500, "yapilandirma");
  if (!ayniKaynak(request)) return fail(403, "origin", "Bu istek farklı bir siteden geldiği için reddedildi.");
  await sema(env);
  const u = await oturum(request, env);
  if (!u || !yoneticiMi(env, u)) return fail(403, "yetki");
  const ad = [].concat(params.yol || [])[0] || "", m = request.method, origin = new URL(request.url).origin;
  /* Soru göçü sırasında yazma kilidi (varsayılan KAPALI; AKE_SORU_V2'den bağımsız): yalnız soru yazan iki uç 503 verir, okuma/ödeme/hesap etkilenmez. */
  if (env.AKE_SORU_MIGRATION_LOCK === "1" && m === "POST" && (ad === "soru-uret" || ad === "soru-karar" || ad === "soru-ice-aktar")) return fail(503, "bakim", "Soru yazımı geçici olarak durduruldu (bakım). Biraz sonra tekrar dene.", { "retry-after": "300" });

  if (ad === "durum" && m === "GET") {
    /* inceleme bekleyenler: doğrulanamayan ödeme/tutar/para, kod üretim hatası, yarım kalmış (5 dk+) kod üretimi, takılmış (10 dk+) e-posta gönderimi */
    const INC = "(durum IN ('odeme_dogrulanamadi', 'tutar_uyusmuyor', 'para_dogrulanamadi', 'kod_uretilemedi') OR (durum = 'kod_bekliyor' AND tarih < ?) OR (durum = 'gonderiliyor' AND tarih < ?))";
    const simdi = Date.now(), t1 = simdi - 300000, t2 = simdi - 600000;
    const { results } = await env.DB.prepare("SELECT id, eposta, ad, paket, tutar, tarih, durum FROM siparis ORDER BY (" + INC + ") DESC, tarih DESC LIMIT 50").bind(t1, t2).all();
    const bekleyen = await env.DB.prepare("SELECT COUNT(*) AS n FROM siparis WHERE " + INC).bind(t1, t2).first();
    const tok = await ayarOku(env, "shopier_webhook_token"), wid = await ayarOku(env, "shopier_webhook_id");
    const say = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM kullanici) AS kullanici, (SELECT COUNT(*) FROM kod WHERE kid IS NOT NULL AND kid != 'silindi') AS paket").first();
    return json(200, { pat: !!env.SHOPIER_PAT, eposta: !!env.RESEND_API_KEY, webhook: !!tok, webhookId: wid || "", siparisler: results || [], inceleme: (bekleyen && bekleyen.n) || 0, sayilar: say || {} });
  }
  if (ad === "aboneler" && m === "GET") {
    const bugun = new Date().toISOString().slice(0, 10);
    const { results } = await env.DB.prepare("SELECT k.id AS kid, k.eposta AS eposta, k.ad AS ad, c.plan AS plan, c.bitis AS bitis FROM kod c JOIN kullanici k ON k.id = c.kid WHERE c.kid IS NOT NULL AND c.kid != 'silindi' AND (c.bitis IS NULL OR c.bitis >= ?) ORDER BY c.bitis ASC LIMIT 300").bind(bugun).all();
    return json(200, { aboneler: results || [] });
  }
  if (ad === "abone-iptal" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { }
    const kid = String(b.kid || ""); if (!kid || kid === "silindi") return fail(400, "kid");
    if (!(await env.DB.prepare("SELECT id FROM kullanici WHERE id = ?").bind(kid).first())) return fail(404, "kullanici_yok", "Bu kullanıcı bulunamadı.");
    const bugun = new Date().toISOString().slice(0, 10);
    const aktif = await env.DB.prepare("SELECT COUNT(*) AS n FROM kod WHERE kid = ? AND (bitis IS NULL OR bitis >= ?)").bind(kid, bugun).first();
    if (!aktif || !aktif.n) return fail(404, "paket_yok", "Bu kullanıcının iptal edilecek aktif paketi yok (zaten iptal edilmiş olabilir).");
    const r = await env.DB.prepare("UPDATE kod SET kid = 'silindi' WHERE kid = ? AND (bitis IS NULL OR bitis >= ?)").bind(kid, bugun).run(); /* yalnızca aktif paketler; süresi dolmuş kayıtlar olduğu gibi kalır */
    const n = (r && r.meta && r.meta.changes) || 0;
    if (!n) return fail(409, "degismedi", "Paket iptal edilemedi; liste yenilenip tekrar denenebilir.");
    return json(200, { ok: true, kapatilan: n });
  }
  if (ad === "bildirim" && m === "GET") {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS push (endpoint TEXT PRIMARY KEY, kid TEXT, p256dh TEXT, auth TEXT, slots TEXT, tarih INTEGER)").run();
    const t = await pushToken(env), n = await env.DB.prepare("SELECT COUNT(*) AS cihaz, COUNT(DISTINCT kid) AS kisi FROM push").first();
    return json(200, { token: t, cihaz: (n && n.cihaz) || 0, kisi: (n && n.kisi) || 0, origin });
  }
  if (ad === "maliyet" && m === "GET") {
    /* Dolar fiyatları (milyon token başına) env ile değiştirilebilir; akışsız çağrılarda gerçek token, diğerlerinde de akıştan okunan token kullanılır */
    const fy = { hizli: [+env.AKE_FIYAT_HIZLI_GIRIS || 1, +env.AKE_FIYAT_HIZLI_CIKIS || 5], guclu: [+env.AKE_FIYAT_GUCLU_GIRIS || 3, +env.AKE_FIYAT_GUCLU_CIKIS || 15] };
    const ay = gunTR().slice(0, 7);
    let rows = []; try { rows = (await env.DB.prepare("SELECT gun, kaynak, model, adet, giris, cikis FROM gider WHERE gun >= ? ORDER BY gun DESC").bind(ay + "-01").all()).results || []; } catch (e) { }
    const tipf = m => /guclu|sonnet|opus/i.test(m) ? fy.guclu : fy.hizli;
    const usd = r => r.kaynak === "soru-uret" ? 0 : (r.giris * tipf(r.model)[0] + r.cikis * tipf(r.model)[1]) / 1e6;
    const bugun = gunTR(); let ayUsd = 0, bugunUsd = 0, ayCagri = 0, bugunCagri = 0; const kaynak = {};
    rows.forEach(r => { const u = usd(r); ayUsd += u; if (r.gun === bugun) bugunUsd += u; if (r.kaynak !== "soru-uret") { ayCagri += r.adet; if (r.gun === bugun) bugunCagri += r.adet; } kaynak[r.kaynak] = (kaynak[r.kaynak] || 0) + u; });
    return json(200, { ay, ayUsd, bugunUsd, ayCagri, bugunCagri, kaynak, soruUretBugun: rows.filter(r => r.gun === bugun && r.kaynak === "soru-uret").reduce((s, r) => s + r.adet, 0), soruUretLimit: +env.AKE_SORU_GUNLUK || 20, butceUsd: +env.AKE_AYLIK_BUTCE_USD || 0 });
  }
  if (ad === "shopier-kur" && m === "POST") {
    if (!env.SHOPIER_PAT) return fail(400, "pat_yok", "Cloudflare'e SHOPIER_PAT eklenmemiş.");
    const url = origin.replace("://www.", "://") + "/api/shopier";
    const l = await shopier(env, "/webhooks");
    if (l.status === 401 || l.status === 403) return fail(400, "pat_gecersiz", "Shopier anahtarı geçersiz ya da webhook yetkisi yok.");
    /* Shopier her olay için tek adrese izin verir; eski kaydı silip yeniden kur (imza anahtarı yalnızca kurulumda verilir) */
    for (const w of (Array.isArray(l.j) ? l.j : (l.j && l.j.data) || [])) if (w && w.event === "order.created" && w.id) await shopier(env, "/webhooks/" + encodeURIComponent(w.id), { method: "DELETE" });
    const c = await shopier(env, "/webhooks", { method: "POST", body: JSON.stringify({ event: "order.created", url }) });
    const w = c.j && (c.j.data || c.j);
    if (!c.ok || !w || !w.token) { console.error("webhook", c.status, JSON.stringify(c.j).slice(0, 300)); return fail(502, "shopier", "Shopier webhook kurulamadı (" + c.status + ")."); }
    await ayarYaz(env, "shopier_webhook_token", w.token); await ayarYaz(env, "shopier_webhook_id", String(w.id || ""));
    return json(200, { ok: true, url });
  }
  if (ad === "deneme-siparis" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { }
    const paket = PAKETLER[b.paket] ? b.paket : "orta-ay";
    const urun = { "orta-ay": "52547800", "orta-yil": "52547904", "premium-ay": "52547968", "premium-yil": "52547986" }[paket];
    const o = { id: "deneme-" + Date.now(), paymentStatus: "paid", billingInfo: { email: (typeof b.eposta === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.eposta.trim()) ? b.eposta.trim().toLowerCase() : u.eposta), firstName: "Deneme" }, lineItems: [{ productId: urun, title: "AKE Akademi deneme", quantity: 1 }], totals: { total: "0" } };
    const r = await siparisIsle(env, o, true);
    return json(200, r);
  }
  if (ad === "soru-uret" && m === "POST") {
    if (!env.ANTHROPIC_API_KEY) return fail(500, "yapilandirma");
    await soruSema(env);
    let b = {}; try { b = await request.json(); } catch (e) { }
    if (!b.s || !b.t) return fail(400, "eksik");
    const glim = +env.AKE_SORU_GUNLUK || 20;
    if (await giderBugun(env, "soru-uret") >= glim) return fail(429, "gunluk_limit", `Günlük AI soru üretme sınırına (${glim}) ulaşıldı. Yarın tekrar dene.`);
    await giderYaz(env, "soru-uret", "cagri", 0, 0);
    const r = await soruUret(env, b);
    return r.hata ? fail(502, r.hata, "AI soru üretemedi, tekrar dene.") : json(200, r);
  }
  /* Toplu soru yükleme (eski "sorular/*.json + liste.json" akışının güvenli yerine): yalnız yönetici, yalnız AKE_SORU_V2=1.
     Her soru dogrulaSoru ile doğrulanır ve kanonik sütunlarla (govde/a/x/h/rk) tek INSERT'te yazılır; 'banka' durumunda eklenir,
     yani herkese açık eski /api/sorular'da GÖRÜNMEZ ve istemciye cevapsız (oturum API'si) verilir. Kimlik korunur; aynı kimlik/içerik tekrar yüklenirse yazılmaz (tekrar çalıştırılabilir). */
  if (ad === "soru-ice-aktar" && m === "POST") {
    if (!bayrakAcik(env)) return fail(409, "v2_kapali", "Toplu yükleme yalnız korumalı soru sistemi (AKE_SORU_V2) açıkken yapılır.");
    let b = {}; try { b = await request.json(); } catch (e) { }
    const l = Array.isArray(b.sorular) ? b.sorular : null;
    if (!l || !l.length || l.length > 100) return fail(400, "gecersiz", "sorular 1-100 elemanlı dizi olmalı.");
    const sayi = { yazildi: 0, kopya: 0, var: 0, catisma: 0, kimlikCatismasi: 0, gecersiz: 0 }, sorunlu = [];
    for (const q of l) {
      const id = q && typeof q.id === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(q.id) ? q.id : null;
      if (!id) { sayi.gecersiz++; sorunlu.push({ id: null, neden: "id" }); continue; }
      const aday = {}; for (const k of ["s", "t", "d", "p", "q", "o", "a", "x"]) if (q[k] !== undefined) aday[k] = q[k];
      const r = await soruYazKanonik(env, aday, { idUret: () => id, durum: "banka", kaynak: "statik" });
      if (r.durum === "yazildi") sayi.yazildi++; else if (r.durum === "kopya") sayi.kopya++;
      else if (r.durum === "idCakisma") {   // kimlik zaten var: içerik bütünlüğü denetlenir; mevcut kayıt asla değiştirilmez/silinmez
        const k = await idIcerikKarsilastir(env, id, aday);
        if (k.ayni) sayi.var++; else { sayi.kimlikCatismasi++; sorunlu.push({ id, neden: "kimlik_farkli_icerik", farkli: k.farkli }); }
      } else { sayi[r.durum === "catisma" ? "catisma" : "gecersiz"]++; sorunlu.push({ id, neden: r.durum, hata: r.hata }); }
    }
    return json(200, { ok: true, ...sayi, sorunlu: sorunlu.slice(0, 50) });
  }
  if (ad === "sorular" && m === "GET") {
    await soruSema(env);
    const { results } = await env.DB.prepare("SELECT id, json, tarih FROM soru WHERE durum = 'bekliyor' ORDER BY tarih ASC LIMIT 100").all();
    const say = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM soru WHERE durum = 'onayli') AS onayli, (SELECT COUNT(*) FROM soru WHERE durum = 'bekliyor') AS bekliyor").first();
    const sayim = {}; ((await env.DB.prepare("SELECT s, t, COUNT(*) AS n FROM soru WHERE durum = 'onayli' GROUP BY s, t").all()).results || []).forEach(r => { sayim[r.s + "|" + r.t] = r.n; });
    return json(200, { bekleyen: (results || []).map(r => JSON.parse(r.json)), sayi: say || {}, onayliKonu: sayim });
  }
  if (ad === "soru-karar" && m === "POST") {
    await soruSema(env);
    let b = {}; try { b = await request.json(); } catch (e) { }
    const ids = [].concat(b.id || []).map(String).slice(0, 100), karar = b.karar === "onay" ? "onayli" : "red";
    if (bayrakAcik(env) && karar === "onayli") {   // AKE_SORU_V2=1: kanonik alanlar doldurulmadan onay YOK; hepsi ya da hiçbiri (tek batch)
      const r = await soruOnayla(env, ids);
      return r.ok ? json(200, { ok: true, n: ids.length, onaylanan: r.onaylanan, kopya: r.kopya }) : json(409, { error: "dogrulama", message: "Hiçbir soru onaylanmadı: kanonik doğrulama başarısız.", hatalar: r.hatalar });
    }
    for (const id of ids) await env.DB.prepare("UPDATE soru SET durum = ?, karar = ? WHERE id = ? AND durum = 'bekliyor'").bind(karar, Date.now(), id).run();
    return json(200, { ok: true, n: ids.length });
  }
  if (ad === "tekrar-gonder" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { }
    const s = await env.DB.prepare("SELECT * FROM siparis WHERE id = ?").bind(String(b.id || "")).first();
    if (!s || !s.anahtar || !s.eposta) return fail(404, "yok");
    const kod = "AKE-" + s.anahtar.match(/.{4}/g).join("-"), adi = (PAKETLER[s.paket] || [, , s.paket])[2];
    const r = await epostaGonder(env, { to: s.eposta, subject: "AKE Akademi erişim kodun", text: `Erişim kodun (${adi}): ${kod}\nakeakademi.com'da bu e-postayla giriş yap.`, html: epostaSablon("Erişim kodun", `<p style="margin:0">${adi}</p>${kodKutusu(kod)}<p style="margin:12px 0 0">akeakademi.com'da bu e-postayla giriş yap; paketin otomatik tanımlanır.</p>`) });
    if (r.ok) await env.DB.prepare("UPDATE siparis SET durum = 'gonderildi' WHERE id = ?").bind(s.id).run();
    return r.ok ? json(200, { ok: true }) : fail(502, "eposta");
  }
  if (ad === "siparis-tamamla" && m === "POST") {
    /* Yarım kalmış kod üretimini güvenle tamamlar: yönetici yalnızca bir işaret kaydını seçer; plan, tutar ve e-posta kayıtlı doğrulanmış yükten gelir
       ve sipariş, webhook ile aynı kontrollerden (ödeme, para, ürün, tutar) yeniden geçer. Hazır kalemler tekrar üretilmez. */
    let b = {}; try { b = await request.json(); } catch (e) { }
    const sid = String(b.id || ""); if (!/^[\w.-]{1,64}!kod$/.test(sid)) return fail(400, "gecersiz");
    const k = await env.DB.prepare("SELECT id, durum, tarih, ham FROM siparis WHERE id = ?").bind(sid).first();
    if (!k || !["kod_uretilemedi", "kod_bekliyor"].includes(k.durum)) return fail(404, "yok", "Bu kayıt tamamlanmayı beklemiyor.");
    if (k.durum === "kod_bekliyor" && Date.now() - (+k.tarih || 0) < 120000) return fail(409, "suruyor", "İşlem hâlâ sürüyor olabilir; 2 dakika sonra tekrar dene.");
    let o = null; try { o = JSON.parse(k.ham); } catch (e) { }
    if (!o || typeof o !== "object" || String(o.id || "") + "!kod" !== sid) return fail(422, "ham_yok", "Sipariş verisi kayıtta tam değil; erişim kodunu Shopier panelindeki siparişe bakıp elle gönder.");
    try { const r = await siparisIsle(env, o); console.log("siparis-tamamla", u.eposta, sid, r.durum); return json(200, { ok: true, durum: r.durum }); }
    catch (e) { console.error("siparis-tamamla", sid, e && e.message); return fail(500, "tamamlanamadi", "Tamamlanamadı; birazdan tekrar dene."); }
  }
  return fail(404, "yok");
}
