// Tur 1 · AYT Matematik — hesaplar kodla
import { soru, tr } from "../lib.mjs";
import { bul, kesir, C, yaklasik } from "../yardim.mjs";
const A = "amat";
const tur = (f, x, e = 1e-6) => (f(x + e) - f(x - e)) / (2 * e);

{ const l = (3 + 3) ;
  soru({ s: A, t: "Limit", d: 1, q: "lim (x→3) (x² − 9) / (x − 3) limitinin değeri kaçtır?", dogru: l, yanlis: [0, 3, 9, 12, 18], x: () => `Pay (x − 3)(x + 3) biçiminde çarpanlara ayrılır ve (x − 3) sadeleşir. Limit x + 3 ifadesinin x = 3'teki değeridir: ${l}. Doğrudan yerine yazmak 0/0 belirsizliği verir.` }); }
{ const l = 3 / 5;
  soru({ s: A, t: "Limit", d: 2, q: "lim (x→∞) (3x² + 2x) / (5x² − 1) limitinin değeri kaçtır?", dogru: l, yanlis: [0, 2 / 5, 1, 5 / 3, 2], bic: kesir, x: () => `x sonsuza giderken pay ve paydada en yüksek dereceli terimlerin katsayıları oranlanır: 3/5. Dereceler eşit olduğu için limit ${kesir(l)}'tir.` }); }
{ const f = x => Math.sin(4 * x) / (2 * x), v = Math.round(f(1e-7));
  soru({ s: A, t: "Limit", d: 3, q: "lim (x→0) sin(4x) / (2x) limitinin değeri kaçtır?", dogru: v, yanlis: [0, 1, 4, 3, 1 / 2], bic: kesir, x: () => `sin(4x) / (2x) = (sin 4x / 4x)·(4x / 2x) şeklinde yazılır. x → 0 iken sin 4x / 4x → 1 ve 4x / 2x = 2 olduğundan limit ${v}'dir.` }); }
{ const f = x => x ** 3 - 4 * x, v = Math.round(tur(f, 2));
  soru({ s: A, t: "Türev", d: 1, q: "f(x) = x³ − 4x fonksiyonu için f′(2) değeri kaçtır?", dogru: v, yanlis: [0, 4, 6, 12, 16], x: () => `f′(x) = 3x² − 4 olur. f′(2) = 3·4 − 4 = ${v} bulunur.` }); }
{ const f = x => (x * x + 1) * (x - 3), v = Math.round(tur(f, 1));
  soru({ s: A, t: "Türev", d: 2, q: "f(x) = (x² + 1)(x − 3) fonksiyonu için f′(1) değeri kaçtır?", dogru: v, yanlis: [-4, 0, 2, 4, -6], x: () => `Çarpımın türevi: f′(x) = 2x(x − 3) + (x² + 1)·1 olur. x = 1 için 2·1·(−2) + 2 = ${v} bulunur. Her çarpanın türevini ayrı alıp çarpmak (2x·1 = 2) hatalıdır.` }); }
{ const f = x => x * x - 4 * x + 5, m = Math.round(tur(f, 3));
  soru({ s: A, t: "Türev", d: 2, q: "y = x² − 4x + 5 eğrisine apsisi 3 olan noktada çizilen teğetin eğimi kaçtır?", dogru: m, yanlis: [-2, 0, 1, 3, 5], x: () => `Teğetin eğimi türevin o noktadaki değeridir. y′ = 2x − 4 olduğundan x = 3 için eğim 2·3 − 4 = ${m} olur. Noktanın ordinatı (y = 2) eğim değildir.` }); }
{ const f = x => x ** 3 - 12 * x + 5; let mn = Infinity, xm = 0; for (let x = -10; x <= 10; x += 0.001) { const y = f(x); if (x > 0 && y < mn) { mn = y; xm = x; } }
  const v = Math.round(f(Math.round(xm)));
  soru({ s: A, t: "Türev uygulamaları", d: 2, q: "f(x) = x³ − 12x + 5 fonksiyonunun yerel minimum değeri kaçtır?", dogru: v, yanlis: [-27, -16, -3, 5, 11], x: () => `f′(x) = 3x² − 12 = 0 ise x = ±2 olur. f″(x) = 6x olduğundan x = 2'de f″ > 0, yani yerel minimum vardır. f(2) = 8 − 24 + 5 = ${v} bulunur. x = −2'deki değer (f(−2) = 21) yerel maksimumdur.` }); }
{ let mx = 0; for (let x = 0; x <= 20; x += 0.5) mx = Math.max(mx, x * (20 - x));
  soru({ s: A, t: "Türev uygulamaları", d: 3, q: "Çevresi 40 cm olan dikdörtgenlerin en büyük alanı kaç cm²'dir?", dogru: mx, yanlis: [64, 75, 96, 99, 120], x: () => `Kenarlar x ve 20 − x olursa alan A(x) = x(20 − x) olur. A′(x) = 20 − 2x = 0 ise x = 10 bulunur, yani şekil karedir. En büyük alan 10·10 = ${mx} cm²'dir.` }); }
{ const v = 2 ** 3;
  soru({ s: A, t: "İntegral", d: 1, q: "∫ (0'dan 2'ye) 3x² dx belirli integralinin değeri kaçtır?", dogru: v, yanlis: [2, 4, 6, 12, 16], x: () => `3x²'nin ilkeli x³'tür. Sınırlar yerine yazılırsa 2³ − 0³ = ${v} bulunur.` }); }
{ const F = x => x * x + x, v = F(3) - F(1);
  soru({ s: A, t: "İntegral", d: 2, q: "∫ (1'den 3'e) (2x + 1) dx belirli integralinin değeri kaçtır?", dogru: v, yanlis: [7, 8, 9, 12, 14], x: () => `2x + 1'in ilkeli x² + x'tir. F(3) − F(1) = 12 − 2 = ${v} bulunur.` }); }
{ const v = 2 ** 4 / 4 - 2 ** 2 / 2;
  soru({ s: A, t: "İntegral", d: 3, q: "∫ (0'dan 2'ye) (x³ − x) dx belirli integralinin değeri kaçtır?", dogru: v, yanlis: [0, 1, 3, 4, 6], x: () => `x³ − x'in ilkeli x⁴/4 − x²/2'dir. x = 2 için 4 − 2 = 2, x = 0 için 0 olduğundan sonuç ${v}'dir. Fonksiyon 0 ile 1 arasında negatiftir ama integral işaretli alan verir.` }); }
{ const v = Math.log2(32);
  soru({ s: A, t: "Logaritma", d: 1, q: "log₂ 32 ifadesinin değeri kaçtır?", dogru: v, yanlis: [2, 4, 6, 8, 16], x: () => `2 üzeri kaç 32 eder sorusunun cevabı aranır. 2^5 = 32 olduğundan log₂ 32 = ${v} bulunur.` }); }
{ const x = bul(3, 30, x => x * (x - 2) === 3)[0];
  soru({ s: A, t: "Logaritma", d: 2, q: "log₃ x + log₃ (x − 2) = 1 denklemini sağlayan x değeri kaçtır?", dogru: x, yanlis: [-1, 1, 2, 4, 5], x: () => `Logaritmaların toplamı çarpımın logaritmasıdır: log₃ [x(x − 2)] = 1 ve x(x − 2) = 3 olur. x² − 2x − 3 = 0 ise x = 3 veya x = −1 bulunur. Logaritma tanımı için x > 2 gerektiğinden x = −1 elenir ve x = ${x} olur.` }); }
{ const v = 2 ** 4;
  soru({ s: A, t: "Logaritma", d: 3, q: "log₄ x + log₂ x = 6 olduğuna göre x kaçtır?", dogru: v, yanlis: [4, 8, 12, 32, 64], x: () => `log₄ x = (log₂ x) / 2 olduğundan t = log₂ x için t/2 + t = 6 olur. Buradan 3t/2 = 6 ve t = 4 bulunur. x = 2^4 = ${v}'dır.` }); }
{ const v = Math.sin(Math.PI / 6) * Math.cos(Math.PI / 3) + Math.tan(Math.PI / 4);
  soru({ s: A, t: "Trigonometri", d: 1, q: "sin 30° · cos 60° + tan 45° ifadesinin değeri kaçtır?", dogru: 1.25, yanlis: [1 / 4, 1, 3 / 2, 7 / 4, 2], bic: kesir, x: () => `sin 30° = 1/2, cos 60° = 1/2 ve tan 45° = 1'dir. İfade (1/2)·(1/2) + 1 = 1/4 + 1 = 5/4 olur. Çarpmayı toplama çevirip 1/2 + 1/2 + 1 = 2 yazmak hatadır.` }); }
{ const s = 3 / 5;
  soru({ s: A, t: "Trigonometri", d: 2, q: "x dar açı ve tan x = 3/4 olduğuna göre sin x değeri kaçtır?", dogru: s, yanlis: [3 / 4, 4 / 5, 4 / 3, 5 / 3, 5 / 4], bic: kesir, x: () => `tan x = karşı/komşu = 3/4 olan dik üçgende hipotenüs √(9 + 16) = 5'tir. sin x = karşı/hipotenüs = 3/5 olur. 4/5 değeri cos x'tir.` }); }
{ const sc = (1 / 4 - 1) / 2;
  soru({ s: A, t: "Trigonometri", d: 3, q: "sin x + cos x = 1/2 olduğuna göre sin x · cos x çarpımı kaçtır?", dogru: sc, yanlis: [-3 / 4, -1 / 4, 3 / 8, 1 / 4, 3 / 4], bic: kesir, x: () => `Eşitliğin iki tarafının karesi alınırsa sin²x + cos²x + 2 sin x cos x = 1/4 olur. sin²x + cos²x = 1 olduğundan 2 sin x cos x = 1/4 − 1 = −3/4 ve sin x cos x = ${kesir(sc)} bulunur.` }); }
{ const t = 3 + 1 - 2 - 5 + 0; // (2+3i)+(1-5i) = 3 - 2i -> 3 + (-2) = 1
  const re = 2 + 1, im = 3 - 5;
  soru({ s: A, t: "Karmaşık sayılar", d: 1, q: "z₁ = 2 + 3i ve z₂ = 1 − 5i karmaşık sayıları için z₁ + z₂ toplamının gerçel ve sanal kısımlarının toplamı kaçtır?", dogru: re + im, yanlis: [-2, 0, 3, 4, 5], x: () => `z₁ + z₂ = (2 + 1) + (3 − 5)i = ${re} − 2i olur. Gerçel kısım ${re}, sanal kısım −2 olduğundan toplamları ${re + im}'dir.` }); }
{ const v = Math.hypot(3, 4);
  soru({ s: A, t: "Karmaşık sayılar", d: 2, q: "z = 3 + 4i karmaşık sayısının modülü |z| kaçtır?", dogru: v, yanlis: [1, 3, 4, 7, 25], x: () => `|a + bi| = √(a² + b²) olduğundan |z| = √(9 + 16) = ${v} bulunur. 25 modülün karesidir.` }); }
{ // (1+i)^8
  let re = 1, im = 0; for (let k = 0; k < 8; k++) { const r2 = re * 1 - im * 1, i2 = re * 1 + im * 1; re = r2; im = i2; }
  soru({ s: A, t: "Karmaşık sayılar", d: 3, q: "(1 + i)⁸ işleminin sonucu kaçtır?", dogru: re, yanlis: [-16, -1, 1, 8, 32], x: () => `(1 + i)² = 1 + 2i + i² = 2i olur. (1 + i)⁸ = ((1 + i)²)⁴ = (2i)⁴ = 16·i⁴ = ${re} bulunur. i⁴ = 1 olduğundan sonuç gerçel bir sayıdır.` }); }
{ const a10 = 3 + 9 * 4;
  soru({ s: A, t: "Diziler", d: 1, q: "İlk terimi 3, ortak farkı 4 olan aritmetik dizinin 10. terimi kaçtır?", dogru: a10, yanlis: [31, 36, 40, 43, 47], x: () => `aₙ = a₁ + (n − 1)d olduğundan a₁₀ = 3 + 9·4 = ${a10} bulunur. 10·4 = 40 üzerinden gitmek ilk terimi unutmaktır.` }); }
{ const r = 3, a1 = 6 / r, a4 = a1 * r ** 3;
  soru({ s: A, t: "Diziler", d: 2, q: "Terimleri pozitif bir geometrik dizide a₂ = 6 ve a₅ = 162'dir. Bu dizinin a₄ terimi kaçtır?", dogru: a4, yanlis: [18, 36, 48, 72, 81], x: () => `a₅ / a₂ = r³ olduğundan r³ = 27 ve r = ${r} bulunur. a₃ = 18 ve a₄ = 18·3 = ${a4} olur. Kontrol: a₅ = 54·3 = 162.` }); }
{ const s9 = 9 * 30 / 2;
  soru({ s: A, t: "Diziler", d: 3, q: "Bir aritmetik dizide a₃ + a₇ = 30'dur. Bu dizinin ilk 9 teriminin toplamı kaçtır?", dogru: s9, yanlis: [90, 120, 150, 180, 270], x: () => `Aritmetik dizide terim numaraları toplamı aynı olan terimlerin toplamı eşittir: a₁ + a₉ = a₃ + a₇ = 30. S₉ = 9·(a₁ + a₉) / 2 = 9·30 / 2 = ${s9} bulunur.` }); }
{ const v = 5 - 9;
  soru({ s: A, t: "Parabol", d: 2, q: "y = x² − 6x + 5 parabolünün tepe noktasının ordinatı kaçtır?", dogru: v, yanlis: [-9, -5, 3, 5, 9], x: () => `Tepe noktasının apsisi −b/(2a) = 3'tür. y = 9 − 18 + 5 = ${v} bulunur. Ordinat tepe noktasının y koordinatıdır; 3 ise apsistir.` }); }
{ const k = 9 - 4;
  soru({ s: A, t: "Parabol", d: 3, q: "y = −x² + 4x + k parabolünün en büyük değeri 9 olduğuna göre k kaçtır?", dogru: k, yanlis: [3, 4, 6, 7, 9], x: () => `Tepe noktasının apsisi −b/(2a) = 2'dir. y(2) = −4 + 8 + k = 4 + k ve bu en büyük değer 9 olduğundan k = ${k} bulunur.` }); }
{ const f = x => (x - 2) / 3, g = x => 3 * x + 2; const v = g(7 - 0) ; const inv = (7 + 2) / 3;
  soru({ s: A, t: "Fonksiyonlar", d: 2, q: "f(x) = 3x − 2 fonksiyonunun tersi olan f⁻¹ için f⁻¹(7) değeri kaçtır?", dogru: inv, yanlis: [1, 2, 5, 19, 21], x: () => `f(x) = 7 ise 3x − 2 = 7 ve x = ${inv} olur. Bu yüzden f⁻¹(7) = ${inv} bulunur. f(7) = 19'u hesaplamak tersi değil kendisidir.` }); }
{ const f = x => x * x + 1, g = x => 2 * x - 3, v = f(g(3));
  soru({ s: A, t: "Fonksiyonlar", d: 3, q: "f(x) = x² + 1 ve g(x) = 2x − 3 olduğuna göre (f∘g)(3) değeri kaçtır?", dogru: v, yanlis: [7, 8, 13, 17, 26], x: () => `(f∘g)(3) = f(g(3)) olduğundan önce g(3) = 3 hesaplanır, sonra f(3) = 9 + 1 = ${v} bulunur. (g∘f)(3) = 17 olurdu.` }); }
{ const n = bul(-50, 50, x => Math.abs(x - 2) < 5).length;
  soru({ s: A, t: "Eşitsizlikler", d: 2, q: "|x − 2| < 5 eşitsizliğini sağlayan kaç farklı x tam sayısı vardır?", dogru: n, yanlis: [7, 8, 10, 11, 5], x: () => `|x − 2| < 5 ise −5 < x − 2 < 5 ve −3 < x < 7 olur. Bu aralıktaki tam sayılar −2'den 6'ya kadar ${n} tanedir. Uç değerler (−3 ve 7) eşitlik olmadığı için dahil edilmez.` }); }
{ const n = bul(-20, 20, x => x * x - 5 * x - 14 < 0).length;
  soru({ s: A, t: "Eşitsizlikler", d: 3, q: "x² − 5x − 14 < 0 eşitsizliğini sağlayan kaç farklı x tam sayısı vardır?", dogru: n, yanlis: [6, 7, 9, 10, 11], x: () => `x² − 5x − 14 = (x − 7)(x + 2) olduğundan kökler −2 ve 7'dir. Parabol kollar yukarı olduğundan negatif bölge −2 < x < 7 aralığıdır. Tam sayılar −1'den 6'ya kadar ${n} tanedir.` }); }
{ const v = C(5, 2) * C(4, 2);
  soru({ s: A, t: "Permütasyon ve Kombinasyon", d: 3, q: "5 erkek ve 4 kız öğrenci arasından 2 erkek ve 2 kız öğrenciden oluşan 4 kişilik bir ekip kaç farklı şekilde seçilebilir?", dogru: v, yanlis: [20, 30, 54, 90, 126], x: () => `2 erkek C(5, 2) = 10 şekilde, 2 kız C(4, 2) = 6 şekilde seçilir. Seçimler birbirinden bağımsız olduğundan çarpılır: 10·6 = ${v}. 126 = C(9, 4) ise cinsiyet şartı olmadan seçimdir.` }); }
