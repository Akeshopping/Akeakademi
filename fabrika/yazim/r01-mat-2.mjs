// Tur 1 · Matematik (devam)
import { soru, tr, sapma } from "../lib.mjs";
import { gcd, bul, C, fak, kesir } from "../yardim.mjs";
const T = "mat";

/* Hareket / iş / problemler */
{ const km = (60 + 80) * 3;
  soru({ s: T, t: "Hareket Problemleri", d: 2, q: "Aynı noktadan aynı anda, birbirine zıt yönlerde yola çıkan iki araçtan biri saatte 60 km, diğeri saatte 80 km hızla gidiyor. 3 saat sonra araçlar arasındaki uzaklık kaç km olur?", dogru: km, yanlis: [60, 180, 240, 360, 480], x: () => `Zıt yönde giden araçlar birbirinden saatte 60 + 80 = 140 km uzaklaşır. 3 saatte aradaki uzaklık 140·3 = ${km} km olur. Hızları çıkarmak aynı yönde gidiş içindir.` }); }
{ const t = 360 / (70 + 50);
  soru({ s: T, t: "Hareket Problemleri", d: 2, q: "A ve B kentleri arası 360 km'dir. A'dan saatte 70 km, B'den saatte 50 km hızla aynı anda birbirine doğru yola çıkan iki araç kaç saat sonra karşılaşır?", dogru: t, yanlis: [2, 4, 5, 6, 7.2], x: () => `Birbirine doğru giden araçların hızları toplanır: 70 + 50 = 120 km/sa. Karşılaşma süresi 360 / 120 = ${t} saattir.` }); }
{ const v = Math.round(2 / (1 / 60 + 1 / 40));
  soru({ s: T, t: "Hareket Problemleri", d: 3, q: "Bir araç bir yolun ilk yarısını saatte 60 km, ikinci yarısını saatte 40 km hızla alıyor. Aracın bu yoldaki ortalama hızı saatte kaç km'dir?", dogru: v, yanlis: [40, 45, 50, 52, 55], x: () => `Ortalama hız, toplam yolun toplam süreye bölümüdür. Yol 2d alınırsa süre d/60 + d/40 = d/24 olur; ortalama hız 2d / (d/24) = ${v} km/sa'tir. 60 ile 40'ın aritmetik ortalaması olan 50'yi almak sık yapılan hatadır, çünkü araç yavaş kısımda daha uzun süre kalır.` }); }
{ const t = 1 / (1 / 12 + 1 / 6);
  soru({ s: T, t: "İş problemleri", d: 2, q: "Bir işi A tek başına 12 günde, B tek başına 6 günde bitirebiliyor. İkisi birlikte çalışırsa işi kaç günde bitirirler?", dogru: t, yanlis: [3, 5, 6, 8, 9], x: () => `Günlük işler 1/12 ve 1/6 olduğundan birlikte günde 1/12 + 2/12 = 3/12 = 1/4 iş yaparlar. İş ${t} günde biter.` }); }
{ const b = 1 / (1 / 10 - 1 / 15);
  soru({ s: T, t: "İş problemleri", d: 3, q: "A ve B birlikte çalışarak bir işi 10 günde bitiriyor. A bu işi tek başına 15 günde bitirebildiğine göre B tek başına kaç günde bitirir?", dogru: Math.round(b), yanlis: [20, 25, 35, 40, 45], x: () => `B'nin günlük işi, birlikte yapılan işten A'nın işi çıkarılarak bulunur: 1/10 − 1/15 = 3/30 − 2/30 = 1/30. B işi tek başına ${Math.round(b)} günde bitirir. 15 − 10 = 5 almak yanlıştır.` }); }
{ const k = bul(1, 100, v => 3 * v + v + 12 === 52)[0], ali = 3 * k;
  soru({ s: T, t: "Problemler", d: 1, q: "Ali'nin yaşı Veli'nin yaşının 3 katıdır. 6 yıl sonra ikisinin yaşları toplamı 52 olacağına göre Ali'nin bugünkü yaşı kaçtır?", dogru: ali, yanlis: [10, 20, 24, 36, 39], x: () => `Veli'nin yaşı v ise Ali 3v yaşındadır. 6 yıl sonra (v + 6) + (3v + 6) = 52 olur; buradan 4v = 40 ve v = ${k} bulunur. Ali ${ali} yaşındadır.` }); }
{ const s = 240 * 1.25;
  soru({ s: T, t: "Problemler", d: 1, q: "Maliyeti 240 TL olan bir ürün %25 kârla satılırsa satış fiyatı kaç TL olur?", dogru: s, yanlis: [250, 264, 280, 320, 340], x: () => `Kâr 240·25/100 = 60 TL'dir. Satış fiyatı 240 + 60 = ${s} TL olur.` }); }

/* Sayılar */
{ const k = bul(1, 40, n => (n - 2) + n + (n + 2) === 63 && n % 2 === 1)[0] + 2;
  soru({ s: T, t: "Sayılar", d: 1, q: "Ardışık üç tek sayının toplamı 63'tür. Bu sayıların en büyüğü kaçtır?", dogru: k, yanlis: [19, 21, 25, 27, 23 + 2], x: () => `Ortadaki sayı 63 / 3 = 21'dir. Ardışık tek sayılar 19, 21 ve ${k}'tür. En büyük sayı ${k} olur.` }); }
{ let r = null; for (let a = 1; a <= 9; a++) for (let b = 0; b <= 9; b++) if ((10 * a + b) - (10 * b + a) === 27 && a + b === 11) r = 10 * a + b;
  soru({ s: T, t: "Sayılar", d: 2, q: "ab iki basamaklı bir doğal sayıdır. ab − ba = 27 ve a + b = 11 olduğuna göre ab sayısı kaçtır?", dogru: r, yanlis: [29, 47, 56, 65, 83], x: () => `ab − ba = 9(a − b) olduğundan 9(a − b) = 27 ve a − b = 3 bulunur. a + b = 11 ile birlikte a = 7, b = 4 olur. Sayı ${r}'tür.` }); }

/* Kombinatorik / olasılık */
{ const v = C(5, 2);
  soru({ s: T, t: "Permütasyon ve Kombinasyon", d: 1, q: "5 kişilik bir gruptan 2 kişilik bir komite kaç farklı şekilde seçilebilir?", dogru: v, yanlis: [5, 7, 15, 20, 25], x: () => `Komitede sıra önemli olmadığından kombinasyon kullanılır: C(5, 2) = 5·4 / 2 = ${v}. Sıra önemli olsaydı 20 bulunurdu.` }); }
{ const v = fak(9) / (2 * 2 * 2);
  soru({ s: T, t: "Permütasyon ve Kombinasyon", d: 2, q: "MATEMATİK sözcüğündeki harflerin tamamı kullanılarak anlamlı ya da anlamsız 9 harfli kaç farklı sözcük yazılabilir?", dogru: v, yanlis: [fak(9), fak(9) / 2, fak(9) / 4, fak(9) / 6, 40320], x: () => `Sözcükte M, A ve T harfleri ikişer kez geçer. Tekrarlı permütasyondan 9! / (2!·2!·2!) = 362880 / 8 = ${v} bulunur.` }); }
{ let n = 0; for (let a = 1; a <= 4; a++) for (let b = 0; b <= 4; b++) for (let c = 0; c <= 4; c += 2) if (a !== b && a !== c && b !== c) n++;
  soru({ s: T, t: "Permütasyon ve Kombinasyon", d: 3, q: "0, 1, 2, 3 ve 4 rakamları birer kez kullanılarak yazılabilen, rakamları farklı üç basamaklı kaç çift doğal sayı vardır?", dogru: n, yanlis: [24, 28, 36, 48, 20], x: () => `Birler basamağı 0 ise yüzler için 4, onlar için 3 seçenek vardır: 12 sayı. Birler basamağı 2 veya 4 ise yüzler basamağında 0 ve birler rakamı kullanılamaz, 3 seçenek kalır; onlar basamağında 3 seçenek kalır: 2·3·3 = 18 sayı. Toplam 12 + 18 = ${n} olur.` }); }
{ const p = (() => { let s = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === 7) s++; return s / 36; })();
  soru({ s: T, t: "Olasılık", d: 1, q: "Hilesiz iki zar birlikte atılıyor. Üste gelen sayıların toplamının 7 olma olasılığı kaçtır?", dogru: p, yanlis: [5 / 36, 1 / 9, 7 / 36, 1 / 12, 1 / 4], bic: kesir, x: () => `Toplamı 7 yapan çiftler (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) olmak üzere 6 tanedir. Toplam durum 36 olduğundan olasılık 6/36 = 1/6'dır.` }); }
{ const p = C(4, 2) / C(10, 2);
  soru({ s: T, t: "Olasılık", d: 2, q: "Bir torbada 4 kırmızı ve 6 mavi top vardır. Torbadan geri koymadan art arda 2 top çekiliyor. İkisinin de kırmızı olma olasılığı kaçtır?", dogru: p, yanlis: [4 / 25, 1 / 5, 6 / 25, 4 / 15, 2 / 5], bic: kesir, x: () => `İstenen durum sayısı C(4, 2) = 6, tüm durum sayısı C(10, 2) = 45'tir. Olasılık 6/45 = 2/15'tir. Toplar geri konulsaydı (4/10)·(4/10) = 4/25 bulunurdu.` }); }
{ const p = C(4, 2) / 16;
  soru({ s: T, t: "Olasılık", d: 3, q: "Hilesiz bir madeni para 4 kez atılıyor. Tam 2 kez yazı gelme olasılığı kaçtır?", dogru: p, yanlis: [1 / 4, 1 / 2, 5 / 16, 7 / 16, 3 / 16], bic: kesir, x: () => `4 atışta tüm durum sayısı 2^4 = 16'dır. 4 atışın 2'sinde yazı gelmesi C(4, 2) = 6 farklı şekilde olur. Olasılık 6/16 = 3/8'dir.` }); }

/* Denklemler / ortalama / kümeler / fonksiyon / önerme */
{ const m = bul(-20, 20, m => 9 - 3 * (m + 1) + 12 === 0)[0];
  soru({ s: T, t: "İkinci dereceden denklemler", d: 2, q: "x² − (m + 1)x + 12 = 0 denkleminin köklerinden biri 3 olduğuna göre m kaçtır?", dogru: m, yanlis: [3, 4, 5, 7, 9], x: () => `x = 3 denklemi sağlar: 9 − 3(m + 1) + 12 = 0 olur. Buradan 18 − 3m = 0 ve m = ${m} bulunur. Kontrol: x² − 7x + 12 = (x − 3)(x − 4), kökler 3 ve 4'tür.` }); }
{ const k = bul(-50, 50, k => { const d = 36 - 4 * k; return d > 0 && Math.abs(Math.sqrt(d)) === 2; })[0];
  soru({ s: T, t: "İkinci dereceden denklemler", d: 3, q: "x² − 6x + k = 0 denkleminin kökleri arasındaki fark 2 olduğuna göre k kaçtır?", dogru: k, yanlis: [5, 7, 9, 10, 12], x: () => `Kökler x1 + x2 = 6 ve x2 − x1 = 2 ise x1 = 2, x2 = 4 olur. Kökler çarpımı k = 2·4 = ${k} bulunur.` }); }
{ const c = 15 * 6 - 14 * 5;
  soru({ s: T, t: "Ortalama", d: 1, q: "6 sayının aritmetik ortalaması 15'tir. Bu sayılardan biri çıkarılınca kalan 5 sayının ortalaması 14 oluyor. Çıkarılan sayı kaçtır?", dogru: c, yanlis: [14, 15, 16, 18, 25], x: () => `6 sayının toplamı 15·6 = 90'dır. Kalan 5 sayının toplamı 14·5 = 70'tir. Çıkarılan sayı 90 − 70 = ${c} olur.` }); }
{ const u = 12 + 9 - 4;
  soru({ s: T, t: "Kümeler", d: 1, q: "s(A) = 12, s(B) = 9 ve s(A ∩ B) = 4 olduğuna göre s(A ∪ B) kaçtır?", dogru: u, yanlis: [13, 15, 16, 21, 25], x: () => `s(A ∪ B) = s(A) + s(B) − s(A ∩ B) = 12 + 9 − 4 = ${u} olur. Kesişimi çıkarmayıp 21 bulmak ortak elemanları iki kez saymaktır.` }); }
{ const x = 25 + 18 - (40 - 6);
  soru({ s: T, t: "Kümeler", d: 2, q: "40 kişilik bir sınıfta 25 kişi futbol, 18 kişi basketbol oynuyor, 6 kişi ise iki sporu da yapmıyor. İki sporu da yapan kaç kişi vardır?", dogru: x, yanlis: [5, 7, 11, 13, 15], x: () => `En az bir spor yapan öğrenci sayısı 40 − 6 = 34'tür. s(F ∪ B) = s(F) + s(B) − s(F ∩ B) olduğundan 34 = 25 + 18 − x ve x = ${x} bulunur.` }); }
{ const n = bul(3, 30, n => C(n, 3) === 20)[0];
  soru({ s: T, t: "Kümeler", d: 3, q: "Bir A kümesinin 3 elemanlı alt kümelerinin sayısı 20'dir. Buna göre A kümesinin eleman sayısı kaçtır?", dogru: n, yanlis: [4, 5, 7, 8, 10], x: () => `C(n, 3) = 20 olmalıdır. n = 6 için C(6, 3) = 6·5·4 / 6 = 20 olduğundan n = ${n} bulunur.` }); }
{ const f = x => 2 * x + 3, g = x => x - 1, v = f(g(5));
  soru({ s: T, t: "Fonksiyonlar", d: 1, q: "f(x) = 2x + 3 ve g(x) = x − 1 olduğuna göre f(g(5)) değeri kaçtır?", dogru: v, yanlis: [8, 9, 10, 12, 13], x: () => `Önce içteki fonksiyon hesaplanır: g(5) = 4. Sonra f(4) = 2·4 + 3 = ${v} bulunur. Sıra ters alınırsa g(f(5)) = 12 bulunur.` }); }
{ const v = 3 * (8 - 2) - 1;
  soru({ s: T, t: "Fonksiyonlar", d: 2, q: "f(x + 2) = 3x − 1 olduğuna göre f(8) değeri kaçtır?", dogru: v, yanlis: [15, 16, 19, 23, 24], x: () => `x + 2 = 8 için x = 6 olur. f(8) = 3·6 − 1 = ${v} bulunur. Parantez içine 8 yazıp x = 8 almak yanlıştır.` }); }
{ const p = true, q = false, r = false; const d = [p && q, p || q, !q || r ? (!q ? true : r) : true, !r || p, !q && p];
  const dd = [p && q, p || q, (!q) || r, (!r) || p, (!q) && p]; // III: q → r  ≡ ¬q ∨ r ; IV: r → p ≡ ¬r ∨ p
  const n = dd.filter(Boolean).length;
  soru({ s: T, t: "Önermeler", d: 2, q: "p: \"2 bir asal sayıdır\", q: \"9 bir asal sayıdır\" ve r: \"15 bir çift sayıdır\" önermeleri veriliyor.\n\n1. p ∧ q\n2. p ∨ q\n3. q → r\n4. r → p\n5. ¬q ∧ p\n\nYukarıdaki bileşik önermelerden kaç tanesi doğrudur?", dogru: n, yanlis: [0, 1, 2, 3, 5], x: () => `p doğru, q yanlış, r yanlıştır. 1. önerme: D ∧ Y = Y. 2. önerme: D ∨ Y = D. 3. önerme: Y → Y = D. 4. önerme: Y → D = D. 5. önerme: ¬q = D olduğundan D ∧ D = D. Doğru olanlar 2, 3, 4 ve 5 numaralı önermeler olmak üzere ${n} tanedir.` }); }
