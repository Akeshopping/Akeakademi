import test from "node:test";
import assert from "node:assert/strict";
import { pilotSec, makulMu, secenekDegeri } from "../fabrika/soru-fabrika-pilot.mjs";

const mk = (n, a = n % 5, ek = {}) => {
  const c = 4 * n, o = [c - 8, c - 4, c, c + 4, c + 8].map(String);
  const sirali = [...o]; const dog = sirali.splice(2, 1)[0]; sirali.splice(a, 0, dog);   // doğru şık a konumunda
  return { id: "py-x-" + String(n).padStart(8, "0"), konu: "k", aday: Object.assign({ id: "py-x-" + String(n).padStart(8, "0"), s: "mat", t: "K", d: 1 + (n % 3), q: `Bir sayı ${n} ve ${n + 7} ise sonuç kaçtır?`, o: sirali, a, x: "çözüm" }, ek) };
};
const havuz = (kadar, baslangic = 3) => Array.from({ length: kadar }, (_, i) => mk(baslangic + i));

test("her şablondan en çok 5; toplam tavan; sonuç deterministik ve girdi sırasından bağımsız", () => {
  const a = havuz(60);
  const r1 = pilotSec(a), r2 = pilotSec([...a].reverse());
  assert.deepEqual(r1.secilen, r2.secilen);
  assert.deepEqual(pilotSec(a).secilen, r1.secilen);
  assert.equal(r1.secilen.length, 5);
  assert.equal(new Set(r1.secilen).size, 5);
});

test("dosyadaki ilk 5 soru otomatik alınmaz; cevap konumları ve zorluk çeşitlenir", () => {
  const a = havuz(60), ilk5 = a.slice(0, 5).map(l => l.id);
  const r = pilotSec(a);
  assert.notDeepEqual([...r.secilen].sort(), ilk5.sort());
  const konum = new Set(r.secilen.map(id => a.find(l => l.id === id).aday.a));
  assert.ok(konum.size >= 4, "cevap konumları çeşitli olmalı: " + konum.size);
  assert.equal(new Set(r.secilen.map(id => a.find(l => l.id === id).aday.d)).size, 3);
});

test("toplam üst sınır uygulanır (farklı şablonlar)", () => {
  const a = [];
  for (let g = 0; g < 10; g++) for (let i = 0; i < 8; i++) { const l = mk(100 + i + g * 50); l.aday.q = `Şablon ${"abcdefghij"[g]} sayı ${100 + i + g * 50} için sonuç kaçtır?`; a.push(l); }
  const r = pilotSec(a, { sablonBasina: 5, tavan: 23 });
  assert.equal(r.secilen.length, 23);
  assert.equal(r.rapor.sablonSayisi, 10);
});

test("makul olmayan çeldirici elenir; yeterli makul aday yoksa gevşetilir ve raporlanır", () => {
  assert.equal(makulMu(mk(10).aday), true);
  const kotu = mk(10).aday; kotu.o = ["1", "2", "40", "900", "5000"]; kotu.a = 2;
  assert.equal(makulMu(kotu), false);
  const a = [...havuz(4), ...Array.from({ length: 4 }, (_, i) => { const l = mk(80 + i); l.aday.o = ["1", "2", String(l.aday.o[l.aday.a]), "9000", "9001"]; l.aday.a = 2; return l; })];
  a.forEach(l => { l.aday.q = "Aynı kalıp sayı " + l.aday.q.length; });
  const r = pilotSec(a);
  assert.equal(r.rapor.gevsetilen, 1);
  assert.ok(r.rapor.sablonlar[0].gevsetildi);
  assert.equal(r.secilen.length, 5);
});

test("seçenek değeri: virgül, eksi, yüzde, kesir", () => {
  assert.equal(secenekDegeri("−3,5"), -3.5);
  assert.equal(secenekDegeri("%25"), 25);
  assert.equal(secenekDegeri("7/4"), 1.75);
  assert.ok(Number.isNaN(secenekDegeri("x")));
});
