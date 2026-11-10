// PR 4 test yardımcıları: tamamen SENTETİK 1127'lik kaynak + sentetik legacy D1 satırları + yazma izleyici. Gerçek soru metni YOK.
import { DatabaseSync } from "node:sqlite";
import { SORU_TABLO_SQL } from "../../lib/soru-kanonik.js";
import { sqliteSurucu } from "../../fabrika/soru-d1-migrate.mjs";

export const DERS = ["mat", "turkce", "fizik", "kimya", "tarih"];
export const soru = (id, i, ek = {}) => ({ id, s: DERS[i % 5], t: "Sentetik Konu " + (i % 7), d: 1 + (i % 3), q: "SENTETIK-KOK-" + id, o: [0, 1, 2, 3, 4].map(k => `SENTETIK-SIK-${id}-${k}`), a: i % 5, x: "SENTETIK-COZUM-" + id, ...ek });
export function kaynaklar() {
  const uret = (ad, onek, n, tur) => ({ ad, tur, sorular: Array.from({ length: n }, (_, i) => soru(`${onek}-${i}`, i)) });
  return [uret("embedded", "emb", 728, "gomulu"), uret("r01", "r01", 99, "statik"), uret("pilot-100", "AKE-YKS-PILOT", 100, "statik"), uret("ake-yks-02-200", "yks02", 200, "statik")];
}
/* legacy D1: n sentetik ok-* satırı + istenirse özel satırlar. Kolonlar yalnız legacy (kanonik kolon YOK). */
export function legacyDb(n = 89, { ek } = {}) {
  const db = new DatabaseSync(":memory:"); db.exec(SORU_TABLO_SQL);
  const ins = db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (let i = 0; i < n; i++) { const q = soru("ok-leg" + i, 1000 + i); ins.run(q.id, q.s, q.t, q.d, JSON.stringify(q), i % 10 === 0 ? "bekliyor" : "onayli", 1e12 + i, 1e12 + i); }
  if (ek) ek(db, ins);
  return db;
}
export const legacyEkle = (db, q, durum = "onayli") => db.prepare("INSERT INTO soru (id, s, t, d, json, durum, tarih, karar) VALUES (?, ?, ?, ?, ?, ?, 1, 1)").run(q.id, q.s, q.t, q.d, JSON.stringify(q), durum);
/* sürücüyü sar: tüm hazırlanan SQL'ler ve yazma sayısı izlenir; failAt: n. batch'te hata */
export function izle(surucu, { batchHata = null } = {}) {
  const iz = { sql: [], yazma: 0, batch: 0 };
  const d1 = surucu.d1, prep = d1.prepare.bind(d1), bat = d1.batch.bind(d1);
  d1.prepare = sql => { iz.sql.push(sql); if (!/^\s*(SELECT|PRAGMA\s+table_info)/i.test(sql)) iz.yazma++; return prep(sql); };
  d1.batch = async arr => { iz.batch++; if (batchHata && batchHata(iz.batch, arr)) throw new Error("enjekte batch hatası #" + iz.batch); return bat(arr); };
  return iz;
}
export const yeni = (db, { id = "stg-id-1234567890", name = "stg-db" } = {}) => ({ db, surucu: sqliteSurucu(db, { id, name }), kimlik: { id, name } });
export const say = (db, w = "") => db.prepare("SELECT COUNT(*) n FROM soru " + w).get().n;
export const sutunlar = db => db.prepare("PRAGMA table_info(soru)").all().map(r => r.name);
