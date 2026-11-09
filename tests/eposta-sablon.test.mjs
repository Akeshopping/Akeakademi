// E-posta şablonu logo testi · çalıştırma: node --test tests/eposta-sablon.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { epostaSablon } from "../lib/ortak.js";

const html = epostaSablon("Deneme", "<p>içerik</p>");
test("logo: mutlak HTTPS adresi, PNG, alt metni ve boyutları var", () => {
  const m = html.match(/<img[^>]*src="([^"]+)"[^>]*>/); assert.ok(m, "img yok");
  assert.match(m[1], /^https:\/\/akeakademi\.com\/icons\/[\w.-]+\.png$/);
  assert.match(m[0], /alt="AKE Akademi"/); assert.match(m[0], /width="40"/); assert.match(m[0], /height="40"/);
});
test("logo dosyası depoda var ve geçerli PNG (144x144 = 40px ekranın 3,6 katı)", () => {
  const yol = "icons/" + html.match(/icons\/([\w.-]+\.png)/)[1]; assert.ok(existsSync(yol), yol);
  const b = readFileSync(yol); assert.equal(b.subarray(1, 4).toString(), "PNG");
  assert.equal(b.readUInt32BE(16), 144); assert.equal(b.readUInt32BE(20), 144); assert.ok(b.length < 30000);
});
test("e-posta istemcilerinin desteklemediği özellik yok: svg, animasyon, script, harici CSS, değişken", () => {
  assert.ok(!/<svg|<script|<link|<style|@keyframes|animation|var\(--|@import|background-image/i.test(html));
});
test("eski logo (icon-192) artık kullanılmıyor", () => assert.ok(!/icon-192|icon-512|apple-touch/.test(html)));
