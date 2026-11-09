// Yönetim paneli V2 regresyon testi · sahte (mock) API'lerle, gerçek veriye/ödemeye dokunmaz.
// Çalıştırma: node tests/panel/panel-regresyon.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(readFileSync(KOK + "/index.html")); } r.statusCode = 404; r.end("yok"); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const TUM = new Set();
const b = await pw.chromium.launch(); let gecen = 0, kalan = 0; const hatalar = [];
const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : ek); };
const J = (o, st = 200) => ({ status: st, contentType: "application/json", body: JSON.stringify(o) });
const DURUM = { pat: true, eposta: true, webhook: true, webhookId: "1", inceleme: 1, sayilar: { kullanici: 128, paket: 14 }, siparisler: [{ id: "1001!1", eposta: "a@ornek.com", ad: "Ayşe", paket: "premium-ay", tutar: "199", tarih: Date.UTC(2026, 10, 8), durum: "gonderildi" }, { id: "1002!kod", eposta: "b@ornek.com", ad: "Mert", paket: "orta-ay", tutar: "99", tarih: Date.UTC(2026, 10, 8), durum: "kod_uretilemedi" }] };
// sahte sunucu: her çağrı kaydedilir; senaryoya göre yanıt değişir. Tanımsız /api çağrısı = hata.
async function sayfa(sen = {}, w = 1280, h = 860, hash = "yonetim") {
  const c = await b.newContext({ viewport: { width: w, height: h } }), p = await c.newPage(), log = [], say = {};
  p.on("pageerror", e => hatalar.push(e.message));
  await p.route("**/acilis/**", r => r.abort());
  await p.route("**/api/**", async r => {
    const u = new URL(r.request().url()), yol = u.pathname, m = r.request().method(), body = r.request().postData(); TUM.add(m + " " + yol); log.push({ m, yol, body: body ? JSON.parse(body) : null });
    say[yol] = (say[yol] || 0) + 1;
    const ozel = sen[yol]; if (ozel) { const y = ozel(say[yol], body); if (y) return r.fulfill(y); }
    if (yol === "/api/hesap/ben") return r.fulfill(J({ kullanici: { id: "k1", eposta: "yonetici@ornek.com", ad: "Yönetici", yonetici: true }, paket: { plan: "premium", bitis: "2099-01-01" } }));
    if (yol === "/api/hesap/veri") return r.fulfill(J({ alanlar: {} }));
    if (yol === "/api/yonetim/durum") return r.fulfill(J(DURUM));
    if (yol === "/api/yonetim/aboneler") return r.fulfill(J({ aboneler: [{ kid: "a1", eposta: "o1@ornek.com", ad: "Ayşe", plan: "premium", bitis: "2026-12-08" }] }));
    if (yol === "/api/yonetim/maliyet") return r.fulfill(J({ bugunUsd: 0, ayUsd: 0, ayCagri: 0, soruUretBugun: 0, soruUretLimit: 10 }));
    if (yol === "/api/yonetim/bildirim") return r.fulfill(J({ origin: "https://x.test", token: "t", cihaz: 0, kisi: 0 }));
    if (yol === "/api/yonetim/sorular") return r.fulfill(J({ sayi: { onayli: 0, bekliyor: 0 }, bekleyen: [] }));
    if (yol === "/api/yonetim/shopier-kur") return r.fulfill(J({ ok: true, url: "https://akeakademi.com/api/shopier" }));
    if (yol === "/api/yonetim/siparis-tamamla" || yol === "/api/yonetim/tekrar-gonder" || yol === "/api/yonetim/abone-iptal") return r.fulfill(J({ ok: true }));
    if (yol === "/api/yonetim/deneme-siparis") return r.fulfill(J({ ok: true, kodlar: [{ kod: "AKE-TEST-0000-0000-0000" }] }));
    if (yol === "/api/yonetim/veli") return r.fulfill(J({ hata: "yok" }, 404));
    // Katı mod: yukarıda açıkça tanımlanmamış HER çağrı (GET dahil) testi başarısız kılar. Öğrenci kabuğunun arka plan çağrıları da tek tek burada adlandırılır.
    const ARKA = { "GET /api/sorular": { sorular: [] }, "GET /api/sosyal/ben": {}, "GET /api/sosyal/canli": {}, "GET /api/sosyal/lig": {}, "GET /api/hata": {}, "POST /api/sosyal/canli/olustur": {} };
    if (ARKA[m + " " + yol]) return r.fulfill(J(ARKA[m + " " + yol]));
    hatalar.push("TANIMSIZ API ÇAĞRISI " + m + " " + yol); return r.fulfill(J({}, 500));
  });
  await p.addInitScript(() => { try { localStorage.setItem("ake.intro", "1"); } catch (e) { } });
  await p.goto(URL0 + "#" + hash, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1600);
  await p.evaluate(() => document.querySelectorAll(".atl-intro,.atl-intro3d,#atlIntro,#intro").forEach(e => e.style.display = "none"));
  p.log = log; p.say = say; return p;
}
const tab = async (p, k) => { await p.click(`.yn-tabs [data-k="${k}"]`); await p.waitForTimeout(350); };
const govde = p => p.evaluate(() => (document.querySelector(".yn-body") || document.querySelector(".yn")).innerText);
const yaz = (p, yol) => p.log.filter(x => x.m === "POST" && x.yol === yol);
// 1) 7 sekme
let p = await sayfa(); t("7 sekme görünür", (await p.$$eval(".yn-tabs button", e => e.length)) === 7);
// 2) Siparişler: kod yeniden gönderme + eksik kod tamamlama
await tab(p, "siparis");
await p.click('[data-a="yonTekrar"][data-id="1001!1"]'); await p.waitForTimeout(400);
t("Kodu yeniden gönder: doğru uç ve sipariş no ile POST", yaz(p, "/api/yonetim/tekrar-gonder").length === 1 && yaz(p, "/api/yonetim/tekrar-gonder")[0].body.id === "1001!1");
await p.click('[data-a="yonTamamla"][data-id="1002!kod"]'); await p.waitForTimeout(500);
t("Eksik kodları tamamla: doğru uç ve sipariş no ile POST", yaz(p, "/api/yonetim/siparis-tamamla").length === 1 && yaz(p, "/api/yonetim/siparis-tamamla")[0].body.id === "1002!kod");
t("Tamamlama sonrası liste yeniden yüklenir", p.say["/api/yonetim/durum"] >= 2);
// 3) Shopier kurulum
await tab(p, "ozet"); const kur = await p.$('[data-a="yonKur"]');
if (kur) { await kur.click(); await p.waitForTimeout(500); await tab(p, "kod"); t("Shopier kurulum: shopier-kur POST edildi, başarı mesajı gösterildi", yaz(p, "/api/yonetim/shopier-kur").length === 1 && /Otomatik satış kuruldu/.test(await govde(p))); }
else { await tab(p, "siparis"); const k2 = await p.$('[data-a="yonKur"]'); t("Shopier kurulum düğmesi bulundu", !!k2); if (k2) { await k2.click(); await p.waitForTimeout(500); t("Shopier kurulum: shopier-kur POST edildi", yaz(p, "/api/yonetim/shopier-kur").length === 1); } }
// 4) Kod gönder
await tab(p, "kod"); await p.selectOption('[data-c="yonPaket"]', "premium-yil"); await p.fill('[data-c="yonEposta"]', "arkadas@ornek.com"); await p.dispatchEvent('[data-c="yonEposta"]', "change"); await p.click('[data-a="yonDeneme"]'); await p.waitForTimeout(500);
const dn = yaz(p, "/api/yonetim/deneme-siparis")[0]; t("Erişim kodu gönder: seçilen paket ve e-posta ile POST", !!dn && dn.body.paket === "premium-yil" && dn.body.eposta === "arkadas@ornek.com", JSON.stringify(dn));
t("Erişim kodu gönder: sonuç mesajı görünür", /AKE-TEST-0000/.test(await govde(p)));
// 5) Üyelik yönetimi: çift onaylı iptal
await tab(p, "uye"); await p.click('[data-a="yonAboneIptal"]'); await p.waitForTimeout(300);
t("İptal: ilk onayda henüz istek gitmedi", yaz(p, "/api/yonetim/abone-iptal").length === 0);
await p.click('[data-a="yonAboneIptal2"]'); await p.waitForTimeout(300); t("İptal: ikinci onayda da istek gitmedi", yaz(p, "/api/yonetim/abone-iptal").length === 0);
await p.click('[data-a="yonAboneIptalGo"]'); await p.waitForTimeout(500); t("İptal: yalnızca çift onaydan sonra doğru kid ile POST", yaz(p, "/api/yonetim/abone-iptal").length === 1 && yaz(p, "/api/yonetim/abone-iptal")[0].body.kid === "a1");
// 6) Veli: API yok (404) → açık durum, hata yok
await tab(p, "veli"); await p.waitForTimeout(500); let v = await govde(p);
t("Veli Raporları API'si yokken 'Henüz etkin değil' gösterilir", /Henüz etkin değil/.test(v) && !/alınamadı|hata/i.test(v), v.slice(0, 120));
t("Veli sekmesi hiçbir /api/veli/* çağrısı yapmaz", !p.log.some(x => x.yol.startsWith("/api/veli/")));
t("Panel tek başına: sayfa hatası yok", hatalar.length === 0, hatalar.join(" | ")); await p.context().close();
// 7) Yükleme/hata/yeniden deneme
p = await sayfa({ "/api/yonetim/veli": n => n === 1 ? J({}, 503) : J({ hazir: false, acik: false }) });
await tab(p, "veli"); await p.waitForTimeout(500); v = await govde(p);
t("Veli 503: hata mesajı ve 'Tekrar dene' görünür (sonsuz yükleme yok)", /alınamadı/.test(v) && !!(await p.$('[data-a="yonVeliYenile"]')), v.slice(0, 100));
await p.click('[data-a="yonVeliYenile"]'); await p.waitForTimeout(600); v = await govde(p);
t("Veli: 'Tekrar dene' sonrası kurulum durumu gösterilir", /Kurulum durumu/.test(v) && p.say["/api/yonetim/veli"] === 2, v.slice(0, 100)); await p.context().close();
p = await sayfa({ "/api/yonetim/veli": () => { throw new Error("ağ"); } });
await p.close().catch(() => { });
p = await sayfa({ "/api/yonetim/veli": (n) => n === 1 ? { status: 200, contentType: "application/json", body: "{bozuk" } : J({ hazir: false }) });
await tab(p, "veli"); await p.waitForTimeout(500); t("Veli bozuk JSON: hata durumu ve yeniden deneme", /alınamadı/.test(await govde(p)) && !!(await p.$('[data-a="yonVeliYenile"]'))); await p.context().close();
p = await sayfa({ "/api/yonetim/durum": n => n === 1 ? J({ message: "geçici hata" }, 500) : null });
await p.waitForTimeout(300); const ilk = await p.evaluate(() => document.querySelector(".yn").innerText);
t("Ana yükleme 500: hata + 'Tekrar dene' (sonsuz 'Yükleniyor' yok)", /geçici hata/.test(ilk) && !!(await p.$('.yn [data-a="yonYenile"]')) && !/^\s*Yükleniyor/m.test(ilk.split("Yönetim bölümleri").pop() || ""), ilk.slice(0, 200));
await p.click('.yn [data-a="yonYenile"]'); await p.waitForTimeout(700); t("Ana yükleme: tekrar denenince panel açılır", (await p.$$eval(".yn-body", e => e.length)) === 1 && p.say["/api/yonetim/durum"] === 2); await p.context().close();
p = await sayfa({ "/api/yonetim/aboneler": n => n === 1 ? J({}, 500) : null });
await tab(p, "uye"); await p.waitForTimeout(500); t("Aboneler 500: hata ve 'Tekrar dene' (boş liste gibi görünmez)", /yüklenemedi/.test(await govde(p)) && !!(await p.$('[data-a="yonAboneYenile"]')));
await p.click('[data-a="yonAboneYenile"]'); await p.waitForTimeout(600); t("Aboneler: tekrar denenince liste gelir", /Ayşe/.test(await govde(p))); await p.context().close();
p = await sayfa({ "/api/yonetim/maliyet": () => J({}, 500) }); await tab(p, "analitik"); await p.waitForTimeout(500);
t("Analitik: maliyet 500 → uyarı ve 'Tekrar dene'", /yüklenemedi/.test(await govde(p)) && !!(await p.$('.yn-body [data-a="yonYenile"]'))); await p.context().close();
p = await sayfa({ "/api/yonetim/shopier-kur": () => J({ message: "Kurulamadı (sahte hata)" }, 500) }); await tab(p, "ozet");
const kd = await p.$('[data-a="yonKur"]'); if (kd) { await kd.click(); await p.waitForTimeout(500); t("Shopier kurulum hatası kullanıcıya gösterilir", /sahte hata/.test(await p.evaluate(() => document.body.innerText))); } await p.context().close();
p = await sayfa({ "/api/yonetim/tekrar-gonder": () => J({}, 500) }); await tab(p, "siparis"); await p.click('[data-a="yonTekrar"][data-id="1001!1"]'); await p.waitForTimeout(400);
t("Kod yeniden gönderme hatası: 'Gönderilemedi' bildirimi", /Gönderilemedi/.test(await p.evaluate(() => document.body.innerText))); await p.context().close();
p = await sayfa({ "/api/yonetim/deneme-siparis": () => J({ durum: "eposta_hatasi", kodlar: [{ kod: "AKE-HATA-0000-0000-0000" }] }) }); await tab(p, "kod"); await p.click('[data-a="yonDeneme"]'); await p.waitForTimeout(500);
{ const g = await govde(p); t("E-posta gitmediğinde panel 'gönderildi' demez, kodu elle iletmeyi söyler", /e-posta gönderilemedi/.test(g) && !/adresine gönderildi/.test(g) && /AKE-HATA/.test(g), g.slice(0, 160)); } await p.context().close();
// 8) Öğrenci ekranı CSS yalıtımı: öğrenci başlığındaki 'Akademi' altın renge boyanmamalı
p = await sayfa({}, 1280, 860, "bugun"); const renk = await p.evaluate(() => { const e = document.querySelector("header.top .brand .wm span"); return e ? getComputedStyle(e).color : null; });
t("Öğrenci başlığı: 'Akademi' rengi yönetim stilinden etkilenmiyor", renk && renk !== "rgb(197, 165, 114)", String(renk));
t("Öğrenci ekranında yönetim sınıfı yok", (await p.$$eval(".yn,.yn-tabs,.yn-hero", e => e.length)) === 0); await p.context().close();
const BE = readFileSync(KOK + "/functions/api/yonetim/[[yol]].js", "utf8"), ROTA = new Set([...BE.matchAll(/ad === "([\w-]+)" && m === "(GET|POST)"/g)].map(x => x[2] + " /api/yonetim/" + x[1]));
const yoksa = [...TUM].filter(x => x.includes("/api/yonetim/") && !ROTA.has(x) && x !== "GET /api/yonetim/veli"); t("Ön yüzün çağırdığı tüm yönetim uçları (yöntem+adres) gerçek backend'de var", yoksa.length === 0 && TUM.size > 10, yoksa.join(", "));
t("Hiç tanımsız/gerçek API çağrısı yapılmadı", !hatalar.some(h => /TANIMSIZ/.test(h)), hatalar.join(" | "));
t("Sayfa hatası yok (tüm senaryolar)", !hatalar.some(h => !/TANIMSIZ/.test(h)), hatalar.join(" | "));
await b.close(); srv.close(); console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
