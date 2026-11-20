// Fabrika robotu · yönetim paneli (index.html) statik güvenlik/sözdizimi denetimi. Tarayıcı kodu sır ve model çağrısı taşımaz.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bas = html.indexOf("/* ===== Yönetim: Soru Fabrikası robotu"), son = html.indexOf("/* ===== Sosyal: arkadaş ligi");
const ui = html.slice(bas, son);

test("panel bölümü var ve inline betikler sözdizimi olarak geçerli", () => {
  assert.ok(bas > 0 && son > bas);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(t => t.includes("fabrikaBolumu"));
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]), "inline betik derlenemedi");
});
test("tarayıcı kodu yalnız /api/yonetim/fabrika-* çağırır; model, anahtar ya da öğrenci /api/ai yolu YOK", () => {
  assert.ok(!/api\.anthropic\.com|ANTHROPIC_API_KEY|x-api-key|sk-ant-/i.test(ui));
  assert.ok(!/\/api\/ai\b/.test(ui));
  const yollar = [...ui.matchAll(/fabIstek\("([^"]+)"/g), ...ui.matchAll(/fabEylem\("[^"]+", "([^"]+)"/g)].map(m => m[1]); assert.ok(yollar.length >= 8, String(yollar.length));
  assert.ok(yollar.every(y => /^fabrika-/.test(y)), yollar.join());
});
test("panel işlevleri: başlat, durdur, ilerleme, aday inceleme, yayım/red, çağrı günlüğü; model-geçti ile yayım ayrı etiketli", () => {
  for (const a of ["fabPilotBaslat", "fabPilotDurdur", "fabYayin", "fabRed", "fabRobot", "fabYenile"]) assert.ok(ui.includes(a), a);
  assert.match(ui, /Modelden geçti/); assert.match(ui, /yönetici yayımladı/); assert.match(ui, /Uzman kabul etti/); assert.match(ui, /yapılmadı/);
  assert.match(ui, /disabled/); assert.match(ui, /yayimlanabilir/);   // Yayımla düğmesi şart sağlanmazsa pasif
});
test("maliyet kartı robot giderini ayrı satırda gösterir (sıfır varsayımı yok)", () => {
  assert.match(html, /Soru fabrikası robotu \(üretim \+ kör denetim\)/); assert.ok(html.includes("M.fabrikaUsd"));
});
