// Bildirimleri aç akışı: aşamalar kartta görünür, takılan işlem süre sınırıyla hataya döner, hata ayrıntısı yalnız
// aşama / HTTP durumu / uygulama kodu / tarayıcı hata adı içerir; kayıt doğrulanınca Deneme bildirimi düğmesi çıkar.
// Sahte (mock) API ve sahte tarayıcı bildirim yüzeyi ile gerçek tarayıcıda çalışır; gerçek veriye dokunmaz.
// Çalıştırma: node tests/bildirim-asama.mjs   (Playwright + chromium gerekir)
import { createRequire } from "module"; import http from "node:http"; import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire(process.cwd() + "/"); const pw = require("playwright");
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srv = http.createServer((q, r) => { const f = q.url.split("?")[0]; if (f === "/" || f === "/index.html") { r.setHeader("content-type", "text/html; charset=utf-8"); return r.end(readFileSync(KOK + "/index.html")); } r.statusCode = 404; r.end(); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const URL0 = "http://127.0.0.1:" + srv.address().port + "/";
const b = await pw.chromium.launch(); let gecen = 0, kalan = 0;
const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : ek); };
const J = (o, st = 200) => ({ status: st, contentType: "application/json", body: JSON.stringify(o) });
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/GIZLI-ENDPOINT-DEGERI", P256 = "GIZLI-P256-ANAHTAR", AUTH = "GIZLI-AUTH";

/* sen: { abone: 'ok'|400|500|'asili', subscribe: 'ok'|'ret'|'asili', durum: 'var'|'bos', izin: 'granted'|'default-verir'|'default-reddet' } */
async function sayfa(sen) {
  const c = await b.newContext({ viewport: { width: 1000, height: 1200 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const p = await c.newPage(), istekler = [], hatalar = []; p.on("pageerror", e => hatalar.push(e.message));
  await p.addInitScript(([sen, ENDPOINT, P256, AUTH]) => {
    const sTO = window.setTimeout; window.setTimeout = (f, ms, ...a) => sTO(f, window.__hizli && ms >= 8000 && ms <= 60000 ? ms / 100 : ms, ...a); /* sayfa hazır olduktan sonra süre sınırlarını hızlandır */
    const sub = { endpoint: ENDPOINT, toJSON() { return { endpoint: ENDPOINT, keys: { p256dh: P256, auth: AUTH } }; }, unsubscribe: async () => true };
    let var_ = null;
    const pm = { getSubscription: async () => var_, subscribe: async () => { if (sen.subscribe === "ret") throw new DOMException("push service error", "NotAllowedError"); if (sen.subscribe === "asili") return new Promise(() => { }); var_ = sub; return sub; } };
    const reg = { pushManager: pm };
    Object.defineProperty(navigator, "serviceWorker", { value: { ready: Promise.resolve(reg), register: async () => reg, getRegistration: async () => reg, addEventListener() { }, controller: null }, configurable: true });
    let izin = sen.izin === "granted" ? "granted" : "default";
    window.Notification = class { static get permission() { return izin; } static async requestPermission() { if (sen.izin === "default-reddet") { izin = "denied"; return "denied"; } izin = "granted"; return "granted"; } };
  }, [sen, ENDPOINT, P256, AUTH]);
  await p.route("**/api/**", async r => {
    const u = new URL(r.request().url()), y = u.pathname, m = r.request().method(); istekler.push(m + " " + y);
    if (y === "/api/hesap/ben") return r.fulfill(J({ kullanici: { id: "k1", eposta: "test@ornek.com", ad: "Test" }, kullanim: { mesaj: 0, guclu: 0 }, limit: { mesaj: 0, guclu: 0 }, ayar: { google: false, eposta: true }, paket: null, ucretsiz: { sinirsiz: false, limit: { soru: 20, deneme: 1 }, kalanSoru: 20, kalanDeneme: 1 } }));
    if (y === "/api/bildirim/anahtar") return r.fulfill(J({ anahtar: "BGizliVapidGenel0123456789012345678901234567890123456789012345678901234567890123456789AAAAAA" }));
    if (y === "/api/bildirim/abone") { if (sen.abone === "asili") return new Promise(() => { }); if (sen.abone === 400) return r.fulfill(J({ error: "gecersiz" }, 400)); if (sen.abone === 500) return r.fulfill(J({ error: "yapilandirma", message: "GIZLI-MESAJ" }, 500)); sen.kayitli = true; return r.fulfill(J({ ok: true, slots: ["sabah"] })); }
    if (y === "/api/bildirim/durum") return r.fulfill(J({ cihazlar: (sen.durum === "bos" || !sen.kayitli) ? [] : [{ endpoint: ENDPOINT, slots: ["sabah", "aksam"] }] }));
    if (y === "/api/bildirim/test") return r.fulfill(J({ gonderilen: sen.testGonderilen ?? 1, cihaz: 1 }));
    return r.fulfill(J({}, 404));
  });
  await p.goto(URL0 + "#ayarlar", { waitUntil: "load" });
  await p.waitForFunction(() => HESAP.hazir && HESAP.user, null, { timeout: 8000 }); await p.waitForSelector("#bildirimler"); await p.waitForTimeout(400); await p.evaluate(() => { window.__hizli = true; });
  return { c, p, istekler, hatalar };
}
const asamalar = p => p.$$eval("#pushAsamalar li", l => Object.fromEntries(l.map(x => [x.dataset.asama, x.dataset.durum])));
const kart = p => p.$eval("#bildirimler", e => e.innerText);

{ /* 1) başarılı akış */
  const s = { abone: "ok", subscribe: "ok", izin: "default-verir" }, { c, p, istekler, hatalar } = await sayfa(s);
  t("1a Başlangıçta aşama listesi yok, deneme düğmesi yok", !(await p.$("#pushAsamalar")) && !(await p.$('[data-a="pushTest"]')));
  await p.click('[data-a="pushAc"]'); await p.waitForSelector('[data-a="pushTest"]', { timeout: 5000 });
  const a = await asamalar(p);
  t("1b Beş aşama da 'ok'", ["izin", "sw", "abone", "kayit", "dogrula"].every(k => a[k] === "ok"), JSON.stringify(a));
  t("1c Kayıt sonrası durum doğrulandı, kayıtlı cihaz 1 yazıyor", /kayıtlı cihaz: 1/.test(await kart(p)));
  t("1d İstek sırası: anahtar → abone → durum", (() => { const i = istekler.filter(x => x.includes("/api/bildirim/")); const sira = i.map(x => x.split("/").pop()); const ia = sira.indexOf("anahtar"), ib = sira.indexOf("abone"), ic = sira.lastIndexOf("durum"); return ia >= 0 && ib > ia && ic > ib; })(), istekler.join(","));
  await p.click('[data-a="pushTest"]'); await p.waitForSelector("#pushTestSonuc");
  t("1e Deneme bildirimi gönderilen/cihaz sayısını yazıyor", /gönderilen 1, cihaz 1/.test(await p.$eval("#pushTestSonuc", e => e.innerText)));
  t("1f Sayfa hatası yok", hatalar.length === 0, hatalar.join("|")); await c.close();
}
{ /* 2) sunucu reddi: 400 gecersiz → kayıt aşaması hata, ayrıntı yalnız aşama/HTTP/kod; yeniden denemede durum tutarlı */
  const s = { abone: 400, subscribe: "ok", izin: "granted" }, { c, p } = await sayfa(s);
  await p.click('[data-a="pushAc"]'); await p.waitForSelector("#pushHata");
  const a = await asamalar(p), h = await p.$eval("#pushHata", e => e.innerText);
  t("2a Aşamalar: izin/sw/abone ok, kayıt hata, doğrulama bekliyor", a.izin === "ok" && a.sw === "ok" && a.abone === "ok" && a.kayit === "hata" && a.dogrula === "bekliyor", JSON.stringify(a));
  t("2b Ayrıntı: aşama kayit · HTTP 400 · kod: gecersiz", /aşama kayit/.test(h) && /HTTP 400/.test(h) && /kod: gecersiz/.test(h), h);
  t("2c Düğme yeniden etkin (takılı kalmadı), deneme düğmesi yok", !(await p.$eval('[data-a="pushAc"]', e => e.disabled)) && !(await p.$('[data-a="pushTest"]')));
  s.abone = "ok"; await p.click('[data-a="pushAc"]'); await p.waitForSelector('[data-a="pushTest"]', { timeout: 5000 });
  const a2 = await asamalar(p);
  t("2d Yeniden denemede eski hata temizlendi, tüm aşamalar ok", !(await p.$("#pushHata")) && ["izin", "sw", "abone", "kayit", "dogrula"].every(k => a2[k] === "ok"), JSON.stringify(a2)); await c.close();
}
{ /* 3) 500 yapılandırma + gizli mesaj: ayrıntıya yalnız kod çıkar, mesaj/endpoint/anahtar çıkmaz */
  const { c, p } = await sayfa({ abone: 500, subscribe: "ok", izin: "granted" });
  await p.click('[data-a="pushAc"]'); await p.waitForSelector("#pushHata"); const k = await kart(p);
  t("3a HTTP 500 ve kod yapilandirma gösterilir", /HTTP 500/.test(k) && /kod: yapilandirma/.test(k), k);
  t("3b Sunucu mesajı, endpoint ve abonelik anahtarları kartta yok", !/GIZLI/.test(k) && !k.includes("fcm.googleapis"), k); await c.close();
}
{ /* 4) tarayıcı aboneliği reddi: tarayıcı hata adı */
  const { c, p, istekler } = await sayfa({ abone: "ok", subscribe: "ret", izin: "granted" });
  await p.click('[data-a="pushAc"]'); await p.waitForSelector("#pushHata"); const a = await asamalar(p), h = await p.$eval("#pushHata", e => e.innerText);
  t("4a Tarayıcı aboneliği aşaması hata; tarayıcı hata adı NotAllowedError; HTTP yok", a.abone === "hata" && /tarayıcı: NotAllowedError/.test(h) && !/HTTP/.test(h), h + JSON.stringify(a));
  t("4b Sunucuya kayıt isteği hiç gitmedi", !istekler.includes("POST /api/bildirim/abone")); await c.close();
}
{ /* 5) bekleyen işlem: abonelik oluşturma asılı → süre sınırı */
  const { c, p } = await sayfa({ abone: "ok", subscribe: "asili", izin: "granted" });
  await p.click('[data-a="pushAc"]'); await p.waitForSelector("#pushHata", { timeout: 8000 }); const h = await p.$eval("#pushHata", e => e.innerText);
  t("5a Asılı tarayıcı aboneliği zaman aşımına düşer", /aşama abone/.test(h) && /tarayıcı: ZamanAsimi/.test(h), h);
  t("5b Düğme yeniden etkin", !(await p.$eval('[data-a="pushAc"]', e => e.disabled))); await c.close();
}
{ /* 6) bekleyen işlem: sunucu kaydı asılı */
  const { c, p } = await sayfa({ abone: "asili", subscribe: "ok", izin: "granted" });
  await p.click('[data-a="pushAc"]'); await p.waitForSelector("#pushHata", { timeout: 8000 }); const h = await p.$eval("#pushHata", e => e.innerText);
  t("6 Asılı sunucu kaydı: aşama kayit, zaman aşımı", /aşama kayit/.test(h) && /ZamanAsimi/.test(h), h); await c.close();
}
{ /* 7) izin reddi */
  const { c, p } = await sayfa({ abone: "ok", subscribe: "ok", izin: "default-reddet" });
  await p.click('[data-a="pushAc"]'); await p.waitForSelector("#pushHata"); const h = await p.$eval("#pushHata", e => e.innerText);
  t("7 İzin reddi: aşama izin, tarayıcı NotAllowedError", /aşama izin/.test(h) && /NotAllowedError/.test(h), h); await c.close();
}
{ /* 8) sunucu kaydı kabul etti ama durumda cihaz yok */
  const { c, p } = await sayfa({ abone: "ok", subscribe: "ok", izin: "granted", durum: "bos" });
  await p.click('[data-a="pushAc"]'); await p.waitForSelector("#pushHata"); const h = await p.$eval("#pushHata", e => e.innerText);
  t("8 Cihaz doğrulanamazsa dogrula aşaması kod kayit_yok ile hata, deneme düğmesi yok", /aşama dogrula/.test(h) && /kod: kayit_yok/.test(h) && !(await p.$('[data-a="pushTest"]')), h); await c.close();
}
{ /* 9) deneme gönderimi 0 cihaza ulaşırsa da sayılar yazılır */
  const { c, p } = await sayfa({ abone: "ok", subscribe: "ok", izin: "granted", testGonderilen: 0 });
  await p.click('[data-a="pushAc"]'); await p.waitForSelector('[data-a="pushTest"]'); await p.click('[data-a="pushTest"]'); await p.waitForSelector("#pushTestSonuc");
  t("9 gönderilen 0, cihaz 1 aynen yazılır", /gönderilen 0, cihaz 1/.test(await p.$eval("#pushTestSonuc", e => e.innerText))); await c.close();
}
await b.close(); srv.close(); console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
