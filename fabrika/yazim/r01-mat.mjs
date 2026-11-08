// Tur 1 · Matematik, Geometri, AYT Matematik — doğru şıklar kodla hesaplanır
import { soru, sifirla, yaz, tr, sapma, incelenecekler } from "../lib.mjs";
import fs from "node:fs";
sifirla();

const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
const lcm = (a, b) => a / gcd(a, b) * b;
const bul = (lo, hi, f, adim = 1) => { const r = []; for (let x = lo; x <= hi + 1e-9; x += adim) if (f(+x.toFixed(6))) r.push(+x.toFixed(6)); return r; };
const kesir = v => { if (Number.isInteger(v)) return String(v); for (let q = 2; q <= 120; q++) { const p = Math.round(v * q); if (Math.abs(p / q - v) < 1e-9) return p + "/" + q; } return tr(v); };
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const fak = n => n <= 1 ? 1 : n * fak(n - 1);
const T = "mat", G = "geo", A = "amat";
const bic = f => f; // okunurluk için

/* ================= MATEMATİK ================= */
{ const x = bul(0, 20, x => 3 ** (x + 1) - 3 ** x === 54)[0];
  soru({ s: T, t: "Üslü sayılar", d: 1, q: "3^(x+1) − 3^x = 54 olduğuna göre x kaçtır?", dogru: x, yanlis: sapma(x, 2, 4, 5, 1), x: () => `3^(x+1) = 3·3^x olduğundan 3·3^x − 3^x = 2·3^x = 54 olur. Buradan 3^x = 27 ve x = ${x} bulunur. Üsleri çıkarıp 54'ü doğrudan kullanmak yanlıştır.` }); }
{ const x = bul(0, 10, x => 3 ** x * 9 === 243)[0];
  soru({ s: T, t: "Üslü sayılar", d: 1, q: "3^x · 9 = 243 eşitliğini sağlayan x değeri kaçtır?", dogru: x, yanlis: sapma(x, 5, 2, 4, 6), x: () => `9 = 3^2 olduğundan 3^(x+2) = 243 = 3^5 olur. Üsler eşitlenirse x + 2 = 5 ve x = ${x} bulunur.` }); }
{ const v = (2 ** 10 + 2 ** 9) / 2 ** 8;
  soru({ s: T, t: "Üslü sayılar", d: 2, q: "(2^10 + 2^9) / 2^8 işleminin sonucu kaçtır?", dogru: v, yanlis: sapma(v, 4, 8, 12, 3), x: () => `Payda 2^9 ortak çarpanı alınırsa 2^9·(2 + 1) = 3·2^9 olur. Bölüm 3·2^9 / 2^8 = 3·2 = ${v} bulunur.` }); }
{ const x = bul(0, 10, x => 5 ** (x + 2) - 5 ** x === 600)[0];
  soru({ s: T, t: "Üslü sayılar", d: 3, q: "5^(x+2) − 5^x = 600 olduğuna göre x kaçtır?", dogru: x, yanlis: sapma(x, 1, 3, 4, 0), x: () => `5^x ortak çarpan alınırsa 5^x·(25 − 1) = 24·5^x = 600 olur. Buradan 5^x = 25 ve x = ${x} bulunur.` }); }
{ const k = Math.sqrt(48 / 3) + Math.sqrt(12 / 3);
  soru({ s: T, t: "Köklü sayılar", d: 1, q: "√48 + √12 işleminin sonucu aşağıdakilerden hangisidir?", dogru: k, yanlis: [4, 5, 8, 12, 7], bic: v => `${v}√3`, x: () => `√48 = 4√3 ve √12 = 2√3 olduğundan toplam 4√3 + 2√3 = ${k}√3 olur. Kök içlerini toplayıp √60 yazmak yanlıştır.` }); }
{ const ok = Math.abs(Math.sqrt(6 + 2 * Math.sqrt(5)) - (1 + Math.sqrt(5))) < 1e-12; if (!ok) throw new Error("kök hatası");
  soru({ s: T, t: "Köklü sayılar", d: 3, q: "√(6 + 2√5) ifadesinin eşiti aşağıdakilerden hangisidir?", dogru: "1 + √5", yanlis: ["2 + √5", "√6 + √5", "3 + √5", "√5 − 1"], x: "6 + 2√5 = 1 + 5 + 2·1·√5 = (1 + √5)^2 biçiminde tam kare yazılır. Dolayısıyla √(6 + 2√5) = 1 + √5 olur. Kök içindeki ifadeyi tam kareye benzetmek bu soruların temel yoludur." }); }
{ const ks = bul(-50, 50, x => Math.abs(2 * x - 6) === 10); const top = ks.reduce((a, b) => a + b, 0);
  soru({ s: T, t: "Mutlak değer", d: 2, q: "|2x − 6| = 10 denkleminin çözüm kümesindeki elemanların toplamı kaçtır?", dogru: top, yanlis: sapma(top, 8, -2, 10, 4), x: () => `2x − 6 = 10 ise x = ${ks[ks.length - 1]}; 2x − 6 = −10 ise x = ${ks[0]} bulunur. Elemanların toplamı ${ks[0]} + ${ks[ks.length - 1]} = ${top} olur. Yalnız pozitif durumu alıp 8 bulmak eksik çözümdür.` }); }
{ const ks = bul(-30, 30, x => Math.abs(x - 3) + Math.abs(x + 2) === 9, 0.5); const cp = ks.reduce((a, b) => a * b, 1);
  soru({ s: T, t: "Mutlak değer", d: 3, q: "|x − 3| + |x + 2| = 9 denkleminin çözüm kümesindeki elemanların çarpımı kaçtır?", dogru: cp, yanlis: sapma(cp, 20, -10, -25, -15, 10), x: () => `x ≥ 3 için 2x − 1 = 9 ve x = 5; x ≤ −2 için −2x + 1 = 9 ve x = −4 bulunur. −2 < x < 3 aralığında ifade her zaman 5 olduğundan çözüm yoktur. Çarpım 5·(−4) = ${cp} olur.` }); }
{ const a = 3 * 64 / 8;
  soru({ s: T, t: "Oran-Orantı", d: 1, q: "a ile b pozitif sayıları için a / b = 3/5 ve a + b = 64 olduğuna göre a kaçtır?", dogru: a, yanlis: [40, 32, 36, 20, 28], x: () => `a = 3k, b = 5k alınırsa 8k = 64 ve k = 8 olur. Buradan a = 3·8 = ${a} bulunur. b = 40 olduğundan a'yı b ile karıştırmamak gerekir.` }); }
{ const k = 70 / 7, b = 3 * k;
  soru({ s: T, t: "Oran-Orantı", d: 2, q: "A, B ve C sayıları sırasıyla 2, 3 ve 5 ile doğru orantılıdır. A + C = 70 olduğuna göre B kaçtır?", dogru: b, yanlis: [20, 25, 35, 42, 50], x: () => `A = 2k, B = 3k, C = 5k yazılırsa A + C = 7k = 70 ve k = 10 olur. Buradan B = 3·10 = ${b} bulunur.` }); }
{ const v = 480 * 25 / 100;
  soru({ s: T, t: "Yüzde Problemleri", d: 1, q: "480 sayısının %25'i kaçtır?", dogru: v, yanlis: [96, 100, 140, 160, 240], x: () => `%25 = 1/4 olduğundan 480 / 4 = ${v} bulunur.` }); }
{ const son = 100 * 1.2 * 0.8 - 100;
  soru({ s: T, t: "Yüzde Problemleri", d: 2, q: "Bir malın fiyatı önce %20 artırılıyor, sonra yeni fiyat üzerinden %20 indirim yapılıyor. Malın son fiyatı ilk fiyatına göre nasıl değişmiştir?", dogru: Math.round(son), yanlis: [0, 2, 4, -2, 8], bic: v => v === 0 ? "Değişmemiştir" : v < 0 ? `%${-v} azalmıştır` : `%${v} artmıştır`, x: () => `İlk fiyat 100 alınırsa %20 artışla 120 olur. 120'nin %20'si 24 olduğundan indirimli fiyat 96'dır. 96, 100'den %4 azdır. Artış ve indirim yüzdeleri aynı olsa da farklı tabanlara uygulandığı için birbirini götürmez.` }); }
{ const x = 12 / 0.2 - 40;
  soru({ s: T, t: "Yüzde Problemleri", d: 3, q: "Tuz oranı %30 olan 40 litrelik tuzlu su karışımına kaç litre saf su eklenirse tuz oranı %20 olur?", dogru: x, yanlis: [8, 10, 15, 24, 25], x: () => `Karışımdaki tuz 40·0,30 = 12 litredir ve su eklenince tuz miktarı değişmez. Yeni toplam hacim V ise 12 / V = 0,20 ve V = 60 litre olur. Eklenen su 60 − 40 = ${x} litredir.` }); }
{ const e = gcd(36, 48);
  soru({ s: T, t: "EBOB-EKOK", d: 1, q: "36 ve 48 sayılarının en büyük ortak böleni (EBOB) kaçtır?", dogru: e, yanlis: [4, 6, 8, 16, 24], x: () => `36 = 2^2·3^2 ve 48 = 2^4·3 olduğundan ortak asal çarpanların küçük üsleri alınır: 2^2·3 = ${e}.` }); }
{ const b = 6 * 180 / 36;
  soru({ s: T, t: "EBOB-EKOK", d: 2, q: "İki doğal sayının EBOB'u 6, EKOK'u 180'dir. Bu sayılardan biri 36 ise diğeri kaçtır?", dogru: b, yanlis: [18, 24, 45, 54, 60], x: () => `İki sayının çarpımı EBOB·EKOK'a eşittir. 36·b = 6·180 olduğundan b = 1080 / 36 = ${b} bulunur. Kontrol: EBOB(36, 30) = 6 ve EKOK(36, 30) = 180.` }); }
{ const e = gcd(84, 126), n = 2 * (84 + 126) / e;
  soru({ s: T, t: "EBOB-EKOK", d: 3, q: "Kenar uzunlukları 84 m ve 126 m olan dikdörtgen biçimli bir bahçenin çevresine, köşelere de gelecek şekilde eşit aralıklarla en az kaç fidan dikilir?", dogru: n, yanlis: [5, 8, 12, 15, 20], x: () => `Fidanlar arası mesafe en fazla EBOB(84, 126) = ${e} m olabilir. Çevre 2·(84 + 126) = 420 m olduğundan fidan sayısı 420 / ${e} = ${n} bulunur. Mesafe ne kadar büyük olursa fidan sayısı o kadar az olur.` }); }
{ const a = bul(0, 9, a => (4 + a + 6) % 9 === 0)[0];
  soru({ s: T, t: "Bölme ve bölünebilme", d: 1, q: "Üç basamaklı 4a6 sayısı 9 ile tam bölünebildiğine göre a kaçtır?", dogru: a, yanlis: sapma(a, 2, 5, 7, 9), x: () => `9 ile bölünebilmek için rakamlar toplamı 9'un katı olmalıdır. 4 + a + 6 = 10 + a ve a rakam olduğundan 10 + a = 18 için a = ${a} olur. Sayı 486'dır.` }); }
{ const r = bul(0, 27, x => x % 7 === 5 && x % 4 === 3)[0];
  soru({ s: T, t: "Bölme ve bölünebilme", d: 2, q: "Bir doğal sayının 7 ile bölümünden kalan 5, 4 ile bölümünden kalan 3'tür. Bu sayının 28 ile bölümünden kalan kaçtır?", dogru: r, yanlis: [3, 5, 11, 15, 23, 27], x: () => `Sayı 4 ile bölününce kalan 3 olduğundan 3, 7, 11, 15, 19, 23, 27 değerlerine bakılır. Bunlardan 7 ile bölününce kalan 5 olan ${r}'dur (19 = 2·7 + 5). 4 ile 7 aralarında asal olduğundan kalan 28'e göre tektir.` }); }
{ let r = 1n; for (let i = 0; i < 100; i++) r = r * 3n % 10n; const k = Number(r);
  soru({ s: T, t: "Bölme ve bölünebilme", d: 3, q: "3^100 sayısının 10 ile bölümünden kalan kaçtır?", dogru: k, yanlis: [3, 7, 9, 0, 2], x: () => `3'ün kuvvetlerinin birler basamağı 3, 9, 7, 1 şeklinde 4'lü periyotla tekrar eder. 100, 4'ün katı olduğundan birler basamağı periyodun sonundaki ${k} olur. Bu yüzden 10 ile bölümünden kalan ${k}'dir.` }); }
{ let r = null; for (let x = -20; x <= 20; x++) for (let y = -20; y <= 20; y++) if (2 * x + 3 * y === 13 && x - y === -1) r = { x, y };
  soru({ s: T, t: "Denklem sistemleri", d: 2, q: "2x + 3y = 13 ve x − y = −1 denklem sisteminde x·y çarpımı kaçtır?", dogru: r.x * r.y, yanlis: [3, 5, 8, 9, 10], x: () => `İkinci denklemden x = y − 1 bulunur. İlk denklemde yerine yazılırsa 2(y − 1) + 3y = 13 ve 5y = 15 olur. Buradan y = ${r.y}, x = ${r.x} ve x·y = ${r.x * r.y} bulunur.` }); }
{ let z = null; for (let x = 0; x <= 20; x++) for (let y = 0; y <= 20; y++) for (let w = 0; w <= 20; w++) if (x + y === 10 && y + w === 14 && x + w === 12) z = { x, y, w };
  soru({ s: T, t: "Denklem sistemleri", d: 3, q: "x + y = 10, y + z = 14 ve x + z = 12 olduğuna göre z − x farkı kaçtır?", dogru: z.w - z.x, yanlis: [2, 3, 5, 6, 1], x: () => `Üç denklem taraf tarafa toplanırsa 2(x + y + z) = 36 ve x + y + z = 18 olur. z = 18 − 10 = ${z.w}, x = 18 − 14 = ${z.x} bulunur. z − x = ${z.w - z.x}.` }); }
