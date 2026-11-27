import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dosyalariOku, degerlendir, yerelAktar } from "../fabrika/soru-fabrika-aktar.mjs";

const soru = (n, ek = {}) => Object.assign({
  id: "py-tyt_matematik-" + n.toString(16).padStart(8, "0"), s: "tyt_matematik", t: "Deneme Konusu", d: 2,
  q: `Birinci sayı ${n} olduğuna göre bu sayının iki katı kaçtır?`, o: [String(2 * n - 4), String(2 * n - 2), String(2 * n), String(2 * n + 2), String(2 * n + 4)], a: 2,
  x: `Sayının iki katı 2·${n} = ${2 * n} olur. Doğru cevap C şıkkıdır.`
}, ek);

function kur(sorular, bagimsiz) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aktar-"));
  const k = path.join(dir, "girdi", "deneme"); fs.mkdirSync(k, { recursive: true });
  fs.writeFileSync(path.join(k, "onayli.jsonl"), sorular.map(s => JSON.stringify(s)).join("\n") + "\n");
  fs.writeFileSync(path.join(k, "red.jsonl"), "");
  fs.writeFileSync(path.join(k, "rapor.json"), JSON.stringify({ onayli: sorular.length, red: 0 }));
  return { dir, girdi: path.join(dir, "girdi"), bagimsiz: Object.fromEntries(sorular.map(s => [s.id, bagimsiz && bagimsiz[s.id] || { s: "dogru", n: "" }])) };
}
const ortak = { mevcutKonu: {}, mevcutHash: new Map(), mevcutId: new Set(), mevcutKok: new Set(), mevcutGolge: [] };

test("geçerli sorular uygun; bozuk, yanlış cevaplı, tekrar ve çözülemeyen ayrılır", async () => {
  const iyi = [soru(11), soru(2000), soru(3333333)];
  const bozuk = soru(4, { o: ["1", "2", "3", "4"] });                                 // 4 şık
  const kimlikHatali = soru(5, { id: "ok-abc" });                                      // beklenmeyen kimlik biçimi
  const ayniIcerik = soru(6, { q: iyi[0].q, o: iyi[0].o, x: iyi[0].x, id: "py-tyt_matematik-0000ffff" });
  const sorular = [...iyi, bozuk, kimlikHatali, ayniIcerik, soru(77)];
  const { dir, girdi, bagimsiz } = kur(sorular, { [soru(77).id]: { s: "yanlis", n: "test" } });
  const { konular } = dosyalariOku(girdi);
  const { ledger, rapor } = await degerlendir({ konular, bagimsiz, ...ortak });
  const sonuc = Object.fromEntries(ledger.map(l => [l.id, l.sonuc]));
  assert.equal(sonuc[iyi[0].id], "uygun");
  assert.equal(sonuc[bozuk.id], "gecersiz");
  assert.equal(sonuc[kimlikHatali.id], "gecersiz");
  assert.equal(sonuc[ayniIcerik.id], "tekrar");
  assert.equal(sonuc[soru(77).id], "inceleme");
  assert.equal(rapor.genel.okunan, sorular.length);
  assert.equal(rapor.konu.deneme.sayiUyusmazligi.length, 0);
  fs.rmSync(dir, { recursive: true });
});

test("rapor sayısı dosya sayısıyla uyuşmazsa bildirilir", async () => {
  const { dir, girdi, bagimsiz } = kur([soru(1), soru(2)]);
  fs.writeFileSync(path.join(girdi, "deneme", "rapor.json"), JSON.stringify({ onayli: 5, red: 0 }));
  const { ledger, rapor } = await degerlendir({ konular: dosyalariOku(girdi).konular, bagimsiz, ...ortak });
  assert.equal(rapor.konu.deneme.sayiUyusmazligi.length, 1);
  assert.equal(ledger.length, 2);
  fs.rmSync(dir, { recursive: true });
});

test("yerel aktarım: yalnız 'bekliyor', yayımlı sayı değişmez, yeniden çalıştırma tekrar eklemez", async () => {
  const { dir, girdi, bagimsiz } = kur([soru(10), soru(20), soru(30), soru(40), soru(50)]);
  const dbYol = path.join(dir, "staging.sqlite");
  const db = new DatabaseSync(dbYol);
  db.exec("CREATE TABLE soru (id TEXT PRIMARY KEY, s TEXT, t TEXT, d INTEGER, json TEXT, durum TEXT, tarih INTEGER, karar INTEGER)");
  db.prepare("INSERT INTO soru VALUES ('ok-1','mat','T',1,'{}','onayli',1,1)").run(); db.close();
  const bir = async () => { const { konular } = dosyalariOku(girdi); const { ledger } = await degerlendir({ konular, bagimsiz, ...ortak }); return { ledger, yazma: await yerelAktar(dbYol, ledger) }; };
  const a = await bir();
  assert.equal(a.yazma.sonuclar.aktarildi, 5);
  assert.equal(a.yazma.once.onayli, a.yazma.sonra.onayli);
  assert.equal(a.yazma.sonra.bekliyor, 5);
  const b = await bir();                                                              // ikinci çalıştırma
  assert.equal(b.yazma.sonuclar.aktarildi, 0);
  assert.equal(b.yazma.sonuclar.zaten_var, 5);
  assert.equal(b.yazma.sonra.toplam, a.yazma.sonra.toplam);
  fs.rmSync(dir, { recursive: true });
});

test("yarıda kalan aktarım güvenle sürer: önce 3 soru, sonra 5 soru → toplam 5", async () => {
  const hepsi = [soru(10), soru(20), soru(30), soru(40), soru(50)];
  const { dir, girdi, bagimsiz } = kur(hepsi);
  const dbYol = path.join(dir, "staging.sqlite");
  new DatabaseSync(dbYol).close();
  const { konular } = dosyalariOku(girdi);
  const { ledger } = await degerlendir({ konular, bagimsiz, ...ortak });
  await yerelAktar(dbYol, ledger.slice(0, 3).map(l => ({ ...l })));                   // "yarıda kesilme"
  const { ledger: l2 } = await degerlendir({ konular: dosyalariOku(girdi).konular, bagimsiz, ...ortak });
  const y = await yerelAktar(dbYol, l2);
  assert.equal(y.sonuclar.zaten_var, 3);
  assert.equal(y.sonuclar.aktarildi, 2);
  assert.equal(y.sonra.toplam, 5);
  fs.rmSync(dir, { recursive: true });
});

test("aynı id farklı içerikle varsa üzerine yazılmaz (çatışma)", async () => {
  const { dir, girdi, bagimsiz } = kur([soru(10)]);
  const dbYol = path.join(dir, "staging.sqlite");
  const db = new DatabaseSync(dbYol);
  db.exec("CREATE TABLE soru (id TEXT PRIMARY KEY, s TEXT, t TEXT, d INTEGER, json TEXT, durum TEXT, tarih INTEGER, karar INTEGER)");
  db.prepare("INSERT INTO soru VALUES (?, 'mat','T',1,'{\"farkli\":1}','bekliyor',1,NULL)").run(soru(10).id); db.close();
  const { ledger } = await degerlendir({ konular: dosyalariOku(girdi).konular, bagimsiz, ...ortak });
  const y = await yerelAktar(dbYol, ledger);
  assert.equal(y.sonuclar.catisma, 1);
  assert.equal(JSON.parse(new DatabaseSync(dbYol).prepare("SELECT json FROM soru").get().json).farkli, 1);
  fs.rmSync(dir, { recursive: true });
});
