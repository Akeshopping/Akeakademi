// Tur 2 (fizik/kimya pilot seti) kontrolü · çalıştırma: node --test tests/fabrika-r02.test.mjs
// Beklenen cevaplar, üretim kodundan BAĞIMSIZ olarak elle çözülüp buraya yazılmıştır.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const q = JSON.parse(readFileSync("sorular/r02.json", "utf8"));
const liste = JSON.parse(readFileSync("sorular/liste.json", "utf8"));
const BEKLENEN = {
  "f2-fizik-001": "80", "f2-fizik-002": "1", "f2-fizik-003": "4", "f2-fizik-004": "45", "f2-fizik-005": "1",
  "f2-afizik-001": "23", "f2-afizik-002": "8", "f2-afizik-003": "1/2", "f2-afizik-004": "5", "f2-afizik-005": "2,5", "f2-afizik-006": "20", "f2-afizik-007": "15",
  "f2-kimya-001": "22", "f2-kimya-002": "34", "f2-kimya-003": "80", "f2-kimya-004": "CH₄", "f2-kimya-005": "4",
  "f2-akimya-001": "2,5", "f2-akimya-002": "0,22", "f2-akimya-003": "100,4", "f2-akimya-004": "0,2", "f2-akimya-005": "7", "f2-akimya-006": "3,2", "f2-akimya-007": "−76", "f2-akimya-008": "5"
};
test("liste.json r02.json'u içeriyor", () => assert.ok(liste.includes("r02.json")));
test("25 soru, her birinin beklenen cevabı tanımlı ve doğru şıkla aynı", () => {
  assert.equal(q.length, 25); assert.equal(new Set(q.map(x => x.id)).size, 25);
  for (const x of q) { assert.ok(x.id in BEKLENEN, x.id + " beklenen yok"); assert.equal(x.o[x.a], BEKLENEN[x.id], x.id); }
});
test("5 farklı şık, geçerli a ve d, yasak şık yok, açıklama doğru cevabı içeriyor", () => {
  for (const x of q) {
    assert.equal(x.o.length, 5, x.id); assert.equal(new Set(x.o).size, 5, x.id + " şıklar farklı değil");
    assert.ok(Number.isInteger(x.a) && x.a >= 0 && x.a <= 4, x.id); assert.ok([1, 2, 3].includes(x.d), x.id);
    assert.ok(!x.o.some(o => /hepsi|hiçbiri/i.test(o)), x.id);
    assert.ok(x.x.includes(BEKLENEN[x.id]), x.id + " açıklama doğru cevabı içermiyor");
    assert.ok(!/\d[.,]\d{5,}|undefined|NaN/.test(x.q + x.x + x.o.join(" ")), x.id + " sayı artığı");
  }
});
test("sayısal şıklar küçükten büyüğe sıralı", () => {
  const sayi = s => parseFloat(s.replace("−", "-").replace(",", "."));
  for (const x of q) { if (x.o.every(o => /^[−-]?\d+([,.]\d+)?$/.test(o))) { const v = x.o.map(sayi); assert.deepEqual(v, [...v].sort((a, b) => a - b), x.id); } }
});
test("doğru şık konumu dengeli (hiçbir harf %30'u geçmez), zor soru ağırlıklı", () => {
  const c = {}; q.forEach(x => c[x.a] = (c[x.a] || 0) + 1); for (const k in c) assert.ok(c[k] / q.length <= 0.3, "konum " + k + " = " + c[k]);
  assert.ok(q.filter(x => x.d === 3).length >= 10);
});
test("öncüllü olmayan sorularda şık sayısı, ders anahtarları geçerli", () => {
  const okDers = new Set(["fizik", "kimya", "afizik", "akimya"]); for (const x of q) assert.ok(okDers.has(x.s), x.id);
});
