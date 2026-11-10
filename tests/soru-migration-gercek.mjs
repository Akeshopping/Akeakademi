// Korumalı soru bankası · PR 1: GERÇEK kaynaklarla göç doğrulaması (yerel SQLite'a; üretime hiç bağlanmaz)
// Gömülü banka index.html'den çıkarılır (Playwright), r01 + pilot-100 dosyalardan okunur; D1'deki 89 ok-* satırı SENTETİK fixture'dır.
// Çalıştırma: node tests/soru-migration-gercek.mjs   (Playwright + chromium gerekir). Hiçbir dosya yazmaz (bellekte SQLite).
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { SORU_TABLO_SQL, soruKanonikSema } from "../lib/soru-kanonik.js";
import { planla, uygula, rapor, d1Yerel, satirlariOku, gomuluBankaCikar, statikKaynaklar, BEKLENEN } from "../fabrika/soru-migrate.mjs";
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : ek); };
const sha = s => createHash("sha256").update(s).digest("hex");
/* 1) gömülü banka deterministik mi (3 ayrı yükleme) */
const cikti = []; for (let i = 0; i < 3; i++) cikti.push(await gomuluBankaCikar());
const hs = cikti.map(c => sha(JSON.stringify(c)));
t("1a Gömülü banka tam 728 soru", cikti.every(c => c.length === 728), cikti.map(c => c.length).join(","));
t("1b Çıkarma deterministik (3 yüklemede aynı özet)", new Set(hs).size === 1, hs.join(","));
t("1c Kimlikler benzersiz", new Set(cikti[0].map(q => q.id)).size === 728);
const gomulu = cikti[0], statik = statikKaynaklar(), say = Object.fromEntries(statik.map(k => [k.ad, k.sorular.length]));
t("2 Kaynak sayıları 728 / 99 / 100 (927) ve D1'deki 89 bunun DIŞINDA", gomulu.length === BEKLENEN.embedded && say.r01 === 99 && say["pilot-100"] === 100 && 728 + 99 + 100 === 927, JSON.stringify(say));
/* 2) yerel D1 benzeri: 89 sentetik ok-* satırı */
const db = new DatabaseSync(":memory:"); db.exec(SORU_TABLO_SQL);
const ek = db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, ?, ?, ?, ?, 'onayli', ?, ?)");
for (let i = 0; i < 89; i++) { const q = { id: "ok-fixture" + i, s: "mat", t: "Fixture", d: 1 + (i % 3), q: "FIXTURE-SORU-" + i, o: [0, 1, 2, 3, 4].map(k => `FIXTURE-SIK-${i}-${k}`), a: i % 5, x: "FIXTURE-COZUM-" + i }; ek.run(q.id, q.s, q.t, q.d, JSON.stringify(q), 1e12 + i, 1e12 + i); }
await soruKanonikSema(d1Yerel(db));
const K = () => [{ ad: "embedded", tur: "gomulu", sorular: gomulu }, ...statik];
const p1 = await planla({ kaynaklar: K(), mevcut: satirlariOku(db) }), r1 = rapor(p1);
t("3 Dry-run başarılı: 0 çatışma, 0 geçersiz, 0 sapma", p1.basarili && r1.sayim.conflicts === 0 && r1.sayim.invalid === 0 && r1.sayim.sapma === 0, JSON.stringify([p1.catisma, p1.gecersiz, p1.sapma]));
t("4 Beklenen toplam 1016; yeni 927, doldurma 89", r1.sayim.expected_total === 1016 && r1.sayim.new_insert === 927 && r1.sayim.backfill === 89 && r1.sayim.final_total === 1016, JSON.stringify(r1.sayim));
t("5 Dry-run veritabanına hiçbir şey yazmadı", db.prepare("SELECT COUNT(*) AS n FROM soru").get().n === 89 && db.prepare("SELECT COUNT(*) AS n FROM soru WHERE h IS NOT NULL").get().n === 0);
const u1 = await uygula(db, p1), n1 = db.prepare("SELECT COUNT(*) AS n FROM soru").get().n;
t("6 Yerel göç sonrası 1016", n1 === 1016, JSON.stringify(u1));
const rk1 = db.prepare("SELECT id, rk FROM soru ORDER BY id").all().map(r => r.id + ":" + r.rk).join("|");
const p2 = await planla({ kaynaklar: K(), mevcut: satirlariOku(db) }), r2 = rapor(p2); const u2 = await uygula(db, p2);
t("7 İkinci göç: yeni 0, doldurma 0, no-op 1016, final 1016", r2.sayim.new_insert === 0 && r2.sayim.backfill === 0 && r2.sayim.idempotent_noop === 1016 && db.prepare("SELECT COUNT(*) AS n FROM soru").get().n === 1016, JSON.stringify(r2.sayim));
t("8 rk ikinci göçte değişmedi", db.prepare("SELECT id, rk FROM soru ORDER BY id").all().map(r => r.id + ":" + r.rk).join("|") === rk1);
const pilot = db.prepare("SELECT COUNT(*) AS n FROM soru WHERE id LIKE 'AKE-YKS-PILOT-%'").get().n;
t("9 Pilot 100: kaynakta 100, hedefte 100, eksik 0, içerik özeti aynı", pilot === 100 && r1.pilot.kaynak_id === 100 && r1.pilot.hedef_id === 100 && r1.pilot.eksik === 0 && r1.pilot.icerik_hash_once === r2.pilot.icerik_hash_once, JSON.stringify(r1.pilot));
t("10 Dormant durum: göçle gelen 927 satır 'banka', legacy 89 'onayli' (legacy /api/sorular çıktısı değişmez)", db.prepare("SELECT COUNT(*) AS n FROM soru WHERE durum='banka'").get().n === 927 && db.prepare("SELECT COUNT(*) AS n FROM soru WHERE durum='onayli'").get().n === 89);
t("11 Kaynak kırılımı: gomulu 728 / statik 199 / ai 89", ["gomulu", "statik", "ai"].map(k => db.prepare("SELECT COUNT(*) AS n FROM soru WHERE kaynak=?").get(k).n).join("/") === "728/199/89");
const js = JSON.stringify(r1); t("12 Rapor soru metni taşımıyor (örnek 50 sorunun kökü rapor metninde geçmiyor)", !gomulu.slice(0, 50).some(q => js.includes(q.q.slice(0, 25))));
console.log(`\nDuplicate: tam içerik kopyası ${r1.sayim.duplicate_content} (${r1.sayim.duplicate_content_groups} grup) · yalnız-q ${r1.sayim.q_only_duplicate_groups} grup / ${r1.sayim.q_only_duplicate_members} soru`);
console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
