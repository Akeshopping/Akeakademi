// B4 Aşama 3A · GERÇEK veri provası (yerel, izole): gömülü BANK'taki os/fix işaretleri → göç → soru_meta → API. Production/Preview D1'e dokunmaz; yazılan her şey geçici dizindedir.
// Çalıştırma: node tests/soru-bayrak-gercek.mjs   (Playwright + chromium gerekir)
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto"; import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { gomuluBankaCikar } from "../fabrika/soru-migrate.mjs";
import { planla, uygula, dogrula } from "../fabrika/soru-bayrak-doldur.mjs";
import { BAYRAK_HAZIR_ID } from "../lib/soru-api.js";
import { kur, sizintiBul } from "./yardim/soru-v2.mjs";

let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : String(ek).slice(0, 300)); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bayrak-gercek-")), dbYol = path.join(tmp, "yerel.sqlite"), embYol = path.join(tmp, "gomulu.json");
const kaynak = await gomuluBankaCikar(undefined, { bayrak: true }); fs.writeFileSync(embYol, JSON.stringify(kaynak));
const osIds = new Set(kaynak.filter(q => q.os).map(q => q.id)), fixIds = new Set(kaynak.filter(q => q.fix).map(q => q.id));
t("1 gömülü BANK: 728 soru; 52 os + 37 fix işareti çıkarıldı (çakışma yok)", kaynak.length === 728 && osIds.size === 52 && fixIds.size === 37 && ![...osIds].some(i => fixIds.has(i)), `${kaynak.length}/${osIds.size}/${fixIds.size}`);
const goc = spawnSync(process.execPath, ["fabrika/soru-migrate.mjs", "--apply", "--db", dbYol, "--embedded-json", embYol], { encoding: "utf8" });
t("2 yerel göç provası: 1127 satır, BAŞARILI", goc.status === 0 && /SONUÇ: BAŞARILI/.test(goc.stdout) && /"sonra":1127/.test(goc.stdout), goc.stdout.slice(-300));
const db = new DatabaseSync(dbYol);
const ozet = () => crypto.createHash("sha256").update(JSON.stringify(db.prepare("SELECT id, s, t, d, durum, kopya_of, h, rk, govde, a, x, kaynak FROM soru ORDER BY id").all())).digest("hex");
const once = ozet(), n0 = db.prepare("SELECT COUNT(*) AS n FROM soru").get().n;
const { hedef, sayim } = planla(kaynak, db);
t("3 plan: 89 bayraklı kaynak, 89 eşleşme, 0 eşleşmeyen, 0 kopya yönlendirme", sayim.bayrakli === 89 && sayim.eslesen === 89 && sayim.eslesmeyen === 0 && sayim.os === 52 && sayim.fix === 37 && hedef.size === 89, JSON.stringify(sayim));
t("4 doldurma öncesi doğrulama: tablo yok → tamam=false", dogrula(db, hedef).tamam === false);
const u = uygula(db, hedef), d = dogrula(db, hedef);
t("5 doldurma + doğrulama: 52 os / 37 fix birebir, fazla/eksik/farklı 0, işaret satırı toplamlarla", u.os === 52 && u.fix === 37 && d.tamam && d.eksik.length + d.fazla.length + d.farkli.length === 0 && d.isaret && d.isaretTamam, JSON.stringify(d));
const metaOs = new Set(db.prepare("SELECT id FROM soru_meta WHERE os = 1 AND id != ?").all(BAYRAK_HAZIR_ID).map(r => r.id)), metaFix = new Set(db.prepare("SELECT id FROM soru_meta WHERE fix = 1 AND id != ?").all(BAYRAK_HAZIR_ID).map(r => r.id));
t("6 soru_meta kimlik kümeleri BANK ile BİREBİR (os ve fix)", metaOs.size === 52 && metaFix.size === 37 && [...osIds].every(i => metaOs.has(i)) && [...fixIds].every(i => metaFix.has(i)));
t("7 1127 sorunun kimlikleri, cevap anahtarları ve gövdeleri DEĞİŞMEDİ (özet aynı); satır sayısı aynı", ozet() === once && db.prepare("SELECT COUNT(*) AS n FROM soru").get().n === n0 && n0 === 1127);
const bankaMap = new Map(kaynak.map(q => [q.id, q]));
const bozuk = db.prepare("SELECT id, govde, a, x FROM soru WHERE kaynak = 'gomulu'").all().filter(r => { const q = bankaMap.get(r.id); if (!q) return true; const g = JSON.parse(r.govde); return r.a !== q.a || r.x.trim() !== String(q.x).trim() || JSON.stringify(g.o) !== JSON.stringify(q.o.map(String).map(s => s.trim())); });
t("8 gömülü 728 sorunun DB'deki cevap indeksi, çözümü ve şık SIRASI kaynakla aynı", bozuk.length === 0, bozuk.slice(0, 3).map(r => r.id).join());

/* API uçtan uca: gerçek göç satırları + soru_meta yerel D1 kabuğuna kopyalanır */
const T = await kur({ bayrak: "1", kanonik: true }); await T.hazirla();
const cols = db.prepare("PRAGMA table_info(soru)").all().map(r => r.name), ins = T.DB.db.prepare(`INSERT INTO soru (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
T.DB.db.exec("BEGIN"); for (const r of db.prepare("SELECT * FROM soru").all()) ins.run(...cols.map(c => r[c] ?? null)); T.DB.db.exec("COMMIT");
const katalogTopla = async cookie => { const hepsi = []; let sonra = null, bayrak = null; for (let i = 0; i < 20; i++) { const r = await T.api("katalog?limit=1000" + (sonra ? "&sonra=" + encodeURIComponent(sonra) : ""), { m: "GET", cookie }); if (r.s !== 200) throw new Error("katalog " + r.s); bayrak = r.j.bayrak; hepsi.push(...r.j.sorular); sonra = r.j.sonraki; if (!sonra) break; } return { hepsi, bayrak }; };
const g = await T.giris("gercek@ornek.com"); T.premiumYap(g.kid);
const eksik = await katalogTopla(g.cookie);
t("9 soru_meta henüz YOK iken katalog 1127 soru verir, bayrak 'eksik', os/fix yok, anahtar yok", eksik.hepsi.length === 1127 && eksik.bayrak === "eksik" && eksik.hepsi.every(q => !("os" in q) && !("fix" in q)) && sizintiBul(eksik.hepsi).length === 0);
T.DB.db.exec(fs.readFileSync("migrations/0003_soru_meta.sql", "utf8"));   // migration elle (API oluşturmaz)
const bos = await katalogTopla(g.cookie);
t("10 tablo VAR ama BOŞ iken bayrak 'eksik' (sessiz 'bayraksız' iddiası yok)", bos.bayrak === "eksik" && bos.hepsi.every(q => !("os" in q) && !("fix" in q)));
const ym = T.DB.db.prepare("INSERT INTO soru_meta (id, os, fix) VALUES (?, ?, ?)"); T.DB.db.exec("BEGIN"); for (const r of db.prepare("SELECT id, os, fix FROM soru_meta").all()) ym.run(r.id, r.os, r.fix); T.DB.db.exec("COMMIT");
const dolu = await katalogTopla(g.cookie), kOs = new Set(dolu.hepsi.filter(q => q.os === 1).map(q => q.id)), kFix = new Set(dolu.hepsi.filter(q => q.fix === 1).map(q => q.id));
t("11 tablo DOLU iken katalog: 1127 soru, bayrak 'hazir', tam 52 os / 37 fix kimliği BANK ile birebir; değerler yalnız 1", dolu.hepsi.length === 1127 && dolu.bayrak === "hazir" && kOs.size === 52 && kFix.size === 37 && [...osIds].every(i => kOs.has(i)) && [...fixIds].every(i => kFix.has(i)) && dolu.hepsi.every(q => (q.os === undefined || q.os === 1) && (q.fix === undefined || q.fix === 1)));
const sunulan = new Map(dolu.hepsi.map(q => [q.id, q]));
t("12 API'nin verdiği şık sırası ve metni kaynakla aynı (728 gömülü soru)", kaynak.every(q => JSON.stringify(sunulan.get(q.id).o) === JSON.stringify(q.o.map(String).map(s => s.trim()))));
t("13 katalog yanıtında a/x/h/rk/json/govde/kaynak/kopya_of yok", sizintiBul(dolu.hepsi).length === 0);

/* 37 sabit-sıra sorusu: oturum bayraklı gelir; ORİJİNAL cevap indeksiyle doğru bulunur (alıştırma + deneme) */
const fixListe = [...fixIds];
const pr = await T.api("oturum", { cookie: g.cookie, govde: { istek: T.yeniIstek(), mod: "practice", idler: fixListe } });
t("14 37 sabit-sıra sorusunun HEPSİ oturumda fix:1 ile gelir", pr.s === 200 && pr.j.bayrak === "hazir" && pr.j.sorular.length === 37 && pr.j.sorular.every(q => q.fix === 1), pr.s + " " + (pr.j && pr.j.sorular && pr.j.sorular.length));
let dogru = 0; for (const id of fixListe) { const c = await T.api("cevap", { cookie: g.cookie, govde: { oturum: pr.j.oturum, soru: id, secim: bankaMap.get(id).a } }); if (c.j.dogru === true && c.j.a === bankaMap.get(id).a) dogru++; }
t("15 alıştırma: 37 soruda BANK'taki doğru indeksle verilen cevap 37/37 doğru", dogru === 37, dogru);
const ex = await T.api("oturum", { cookie: g.cookie, govde: { istek: T.yeniIstek(), mod: "exam", idler: fixListe } });
const sizdi = (await Promise.all(fixListe.slice(0, 5).map(id => T.api("cevap", { cookie: g.cookie, govde: { oturum: ex.j.oturum, soru: id, secim: bankaMap.get(id).a } })))).some(r => /"a"|"x"/.test(r.t));
const bt = await T.api("bitir", { cookie: g.cookie, govde: { oturum: ex.j.oturum, cevaplar: fixListe.map(id => ({ soru: id, secim: bankaMap.get(id).a })) } });
t("16 deneme: bitirmeden anahtar yok; bitirince 37/37 doğru, 0 yanlış, 0 boş", !sizdi && bt.j.dogru === 37 && bt.j.yanlis === 0 && bt.j.bos === 0, JSON.stringify([bt.j.dogru, bt.j.yanlis, bt.j.bos]));
const osListe = [...osIds].slice(0, 50), po = await T.api("oturum", { cookie: g.cookie, govde: { istek: T.yeniIstek(), mod: "practice", idler: osListe } });
t("17 os işaretli sorular oturumda os:1 ile gelir (ÖSYM filtresi için)", po.s === 200 && po.j.sorular.length === 50 && po.j.sorular.every(q => q.os === 1));
db.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
