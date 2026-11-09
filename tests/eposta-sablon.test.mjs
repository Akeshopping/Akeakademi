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

import { kodKutusu } from "../lib/ortak.js";
test("kod kutusu: tek satır (nowrap), eşit genişlikli yazı, seçilebilir; satır kıran öğe yok", () => {
  const k = kodKutusu("AKE-281A-AGWA-MAFP-A351", "Premium · 1 yıl"); const kodDiv = k.match(/<div style="[^"]*">AKE-281A-AGWA-MAFP-A351<\/div>/)[0];
  assert.match(kodDiv, /white-space:nowrap/); assert.match(kodDiv, /monospace/); assert.match(kodDiv, /font-size:16px/); assert.match(kodDiv, /user-select:all/);
  assert.ok(!/<br|<wbr|&shy;|&#8209;|‑|word-break|overflow-wrap/i.test(k)); assert.ok(k.includes("AKE-281A-AGWA-MAFP-A351"), "kod metni aynen (kopyalanınca bozulmaz)");
});
test("erişim kodu, yeniden gönderme ve diğer kod e-postaları aynı kod kutusunu ve şablonu kullanır", async () => {
  const fs = await import("node:fs"); const a = fs.readFileSync("lib/ortak.js", "utf8"), y = fs.readFileSync("functions/api/yonetim/[[yol]].js", "utf8");
  assert.match(a, /kodlar\.map\(k => kodKutusu\(/); assert.match(y, /\$\{kodKutusu\(kod\)\}/); assert.ok(!/font-size:22px;font-weight:800;letter-spacing:2px/.test(a + y), "eski sarmalanan kod stili kalmamalı");
  assert.match(y, /epostaSablon\("Erişim kodun"/);
});
