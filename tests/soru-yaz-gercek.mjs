// PR 3 · göç uyumu (yerel SQLite, üretime bağlanmaz): 1127 + 89 legacy = 1216 → göç → 1 AI dual-write = 1217 → plan tekrar: no-op/çatışma yok → ikinci göç 1217.
import { DatabaseSync } from "node:sqlite";
import { SORU_TABLO_SQL, soruKanonikSema } from "../lib/soru-kanonik.js";
import { soruYazKanonik } from "../lib/soru-yaz.js";
import { planla, uygula, rapor, d1Yerel, satirlariOku, gomuluBankaCikar, statikKaynaklar } from "../fabrika/soru-migrate.mjs";
let gecen = 0, kalan = 0; const t = (ad, ok, ek = "") => { ok ? gecen++ : kalan++; console.log(ok ? "GEÇTİ " : "KALDI ", ad, ok ? "" : ek); };
const gomulu = await gomuluBankaCikar(), statik = statikKaynaklar(), K = () => [{ ad: "embedded", tur: "gomulu", sorular: gomulu }, ...statik];
const db = new DatabaseSync(":memory:"); db.exec(SORU_TABLO_SQL);
const ek = db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, ?, ?, ?, ?, 'onayli', ?, ?)");
for (let i = 0; i < 89; i++) { const q = { id: "ok-fixture" + i, s: "mat", t: "Fixture", d: 1 + (i % 3), q: "FIXTURE-SORU-" + i, o: [0, 1, 2, 3, 4].map(k => `FIXTURE-SIK-${i}-${k}`), a: i % 5, x: "FIXTURE-COZUM-" + i }; ek.run(q.id, q.s, q.t, q.d, JSON.stringify(q), 1e12 + i, 1e12 + i); }
const D = d1Yerel(db); await soruKanonikSema(D);
const n = () => db.prepare("SELECT COUNT(*) n FROM soru").get().n;
t("1 başlangıç 1127 kaynak + 89 legacy; ilk göç → 1216", (await uygula(db, await planla({ kaynaklar: K(), mevcut: satirlariOku(db) })), n() === 1216), String(n()));
const env = { DB: D };
const r = await soruYazKanonik(env, { s: "mat", t: "Sentetik", d: 2, q: "SENTETIK-AI-SORU-GOC", o: [0, 1, 2, 3, 4].map(k => "SENTETIK-AI-SIK-" + k), a: 2, x: "SENTETIK-AI-COZUM" });
t("2 1 sentetik AI dual-write → 1217", r.durum === "yazildi" && n() === 1217, JSON.stringify(r));
const once = JSON.stringify(db.prepare("SELECT * FROM soru WHERE id = ?").get(r.id));
const p = await planla({ kaynaklar: K(), mevcut: satirlariOku(db) }), rp = rapor(p);
t("3 plan tekrar: çatışma 0, geçersiz 0, sapma 0, yeni 0, doldurma 0", p.basarili && rp.sayim.conflicts === 0 && rp.sayim.invalid === 0 && rp.sayim.sapma === 0 && rp.sayim.new_insert === 0 && rp.sayim.backfill === 0, JSON.stringify(rp.sayim));
await uygula(db, p);
t("4 ikinci göç: 1217; yeni AI satır overwrite edilmedi", n() === 1217 && JSON.stringify(db.prepare("SELECT * FROM soru WHERE id = ?").get(r.id)) === once);
console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
