// Tur 1 · Geometri — hesaplar kodla
import { soru, tr } from "../lib.mjs";
import { yaklasik } from "../yardim.mjs";
const G = "geo";
const h = (a, b) => Math.sqrt(a * a + b * b);

{ const v = h(9, 12);
  soru({ s: G, t: "Dik üçgen", d: 1, q: "Dik kenar uzunlukları 9 cm ve 12 cm olan dik üçgenin hipotenüs uzunluğu kaç cm'dir?", dogru: v, yanlis: [11, 13, 14, 18, 21], x: () => `Pisagor bağıntısından hipotenüs² = 9² + 12² = 81 + 144 = 225 olur. Hipotenüs √225 = ${v} cm'dir.` }); }
{ const hy = 6 * 8 / 10;
  soru({ s: G, t: "Dik üçgen", d: 2, q: "Dik kenar uzunlukları 6 cm ve 8 cm olan dik üçgende hipotenüse ait yüksekliğin uzunluğu kaç cm'dir?", dogru: hy, yanlis: [2.4, 3.6, 4, 5, 6], x: () => `Hipotenüs √(36 + 64) = 10 cm'dir. Alan iki yolla yazılırsa 6·8/2 = 10·h/2 olur. Buradan h = 48/10 = ${tr(hy)} cm bulunur.` }); }
{ const par = 36 / 4, hip = 4 + par;
  soru({ s: G, t: "Dik üçgen", d: 3, q: "Dik üçgende hipotenüse ait yükseklik 6 cm'dir ve bu yükseklik hipotenüsü iki parçaya ayırır. Parçalardan biri 4 cm olduğuna göre hipotenüsün uzunluğu kaç cm'dir?", dogru: hip, yanlis: [9, 10, 12, 14, 16], x: () => `Öklid bağıntısına göre yükseklik², hipotenüsün parçalarının çarpımına eşittir: 6² = 4·y olduğundan diğer parça y = ${par} cm olur. Hipotenüs 4 + ${par} = ${hip} cm'dir.` }); }
{ const t = (180 - 40) / 2;
  soru({ s: G, t: "İkizkenar üçgen", d: 1, q: "Tepe açısı 40° olan bir ikizkenar üçgenin taban açılarından biri kaç derecedir?", dogru: t, yanlis: [40, 60, 65, 75, 80], x: () => `Üçgenin iç açıları toplamı 180°'dir. Taban açıları eşit olduğundan her biri (180° − 40°) / 2 = ${t}° olur.` }); }
{ const yuk = Math.sqrt(10 * 10 - 6 * 6), alan = 12 * yuk / 2;
  soru({ s: G, t: "İkizkenar üçgen", d: 2, q: "Çevresi 32 cm olan bir ikizkenar üçgenin tabanı 12 cm'dir. Bu üçgenin alanı kaç cm²'dir?", dogru: alan, yanlis: [36, 40, 60, 72, 96], x: () => `Eşit kenarların her biri (32 − 12) / 2 = 10 cm'dir. Tabana ait yükseklik tabanı ortalar: h = √(10² − 6²) = ${yuk} cm. Alan 12·${yuk} / 2 = ${alan} cm²'dir.` }); }
{ const s = 21, a = Math.sqrt(s * (s - 13) * (s - 14) * (s - 15));
  soru({ s: G, t: "Üçgenler", d: 2, q: "Kenar uzunlukları 13 cm, 14 cm ve 15 cm olan üçgenin alanı kaç cm²'dir?", dogru: a, yanlis: [72, 78, 90, 91, 105], x: () => `Yarı çevre u = (13 + 14 + 15) / 2 = 21'dir. Heron formülüyle alan √(21·8·7·6) = √7056 = ${a} cm² bulunur.` }); }
{ const a = 84, r = a / 21;
  soru({ s: G, t: "Üçgenler", d: 3, q: "Kenar uzunlukları 13 cm, 14 cm ve 15 cm olan üçgenin iç teğet çemberinin yarıçapı kaç cm'dir?", dogru: r, yanlis: [2, 3, 5, 6, 7], x: () => `Üçgenin alanı Heron formülüyle 84 cm²'dir. İç teğet çemberin yarıçapı r = Alan / Yarı çevre = 84 / 21 = ${r} cm olur.` }); }
{ const a = (6 - 2) * 180 / 6;
  soru({ s: G, t: "Çokgenler", d: 1, q: "Düzgün altıgenin bir iç açısı kaç derecedir?", dogru: a, yanlis: [60, 108, 135, 144, 150], x: () => `n kenarlı düzgün çokgenin bir iç açısı (n − 2)·180° / n'dir. n = 6 için 4·180° / 6 = ${a}° bulunur. 60° dış açı değil, merkez açıdır.` }); }
{ const n = 10;
  soru({ s: G, t: "Çokgenler", d: 2, q: "İç açılarının ölçüleri toplamı 1440° olan çokgenin kenar sayısı kaçtır?", dogru: n, yanlis: [8, 9, 11, 12, 14], x: () => `İç açılar toplamı (n − 2)·180° olduğundan (n − 2)·180 = 1440 ve n − 2 = 8 olur. Çokgenin kenar sayısı ${n}'dur.` }); }
{ let n = 0; for (let k = 3; k < 40; k++) if (k * (k - 3) / 2 === 27) n = k;
  soru({ s: G, t: "Çokgenler", d: 3, q: "Köşegen sayısı 27 olan konveks çokgenin kenar sayısı kaçtır?", dogru: n, yanlis: [6, 8, 10, 11, 12], x: () => `Köşegen sayısı n(n − 3)/2'dir. n(n − 3) = 54 olur ve n = 9 için 9·6 = 54 sağlanır. Çokgen ${n} kenarlıdır.` }); }
{ const a = 6 * 12;
  soru({ s: G, t: "Dörtgenler", d: 1, q: "Kenar uzunlukları 6 cm ve 12 cm olan dikdörtgenin alanı kaç cm²'dir?", dogru: a, yanlis: [36, 48, 54, 64, 144], x: () => `Dikdörtgenin alanı kısa kenar ile uzun kenarın çarpımıdır: 6·12 = ${a} cm². Çevre formülü 2·(6 + 12) = 36 ile karıştırılmamalıdır.` }); }
{ const k = h(5, 12), c = 4 * k;
  soru({ s: G, t: "Dörtgenler", d: 2, q: "Köşegen uzunlukları 10 cm ve 24 cm olan eşkenar dörtgenin çevresi kaç cm'dir?", dogru: c, yanlis: [34, 48, 50, 60, 68], x: () => `Eşkenar dörtgenin köşegenleri birbirini dik ortalar. Yarım köşegenler 5 ve 12 olduğundan kenar √(25 + 144) = ${k} cm'dir. Çevre 4·${k} = ${c} cm olur.` }); }
{ const a = (8 + 14) * 6 / 2;
  soru({ s: G, t: "Dörtgenler", d: 2, q: "Paralel kenarları 8 cm ve 14 cm, yüksekliği 6 cm olan yamuğun alanı kaç cm²'dir?", dogru: a, yanlis: [48, 56, 84, 99, 132], x: () => `Yamuğun alanı (alt taban + üst taban)·yükseklik / 2'dir. (8 + 14)·6 / 2 = ${a} cm² bulunur. 2'ye bölmeyi unutmak 132 sonucunu verir.` }); }
{ const c = 2 * 22 / 7 * 7;
  soru({ s: G, t: "Çember ve daire", d: 1, q: "Yarıçapı 7 cm olan çemberin çevresi kaç cm'dir? (π = 22/7 alınız.)", dogru: c, yanlis: [14, 22, 28, 49, 154], x: () => `Çember çevresi 2πr formülüyle bulunur: 2·(22/7)·7 = ${c} cm. 154 daire alanıdır (πr²).` }); }
{ const a = 3 * 36 * 60 / 360;
  soru({ s: G, t: "Çember ve daire", d: 2, q: "Yarıçapı 6 cm olan bir daire diliminin merkez açısı 60°'dir. Bu dilimin alanı kaç cm²'dir? (π = 3 alınız.)", dogru: a, yanlis: [6, 9, 12, 36, 108], x: () => `Dairenin alanı π·r² = 3·36 = 108 cm²'dir. Dilim, dairenin 60/360 = 1/6'sı olduğundan alanı 108 / 6 = ${a} cm² olur.` }); }
{ const kr = 2 * Math.sqrt(13 * 13 - 5 * 5);
  soru({ s: G, t: "Çember ve daire", d: 3, q: "Yarıçapı 13 cm olan bir çemberde, merkeze uzaklığı 5 cm olan kirişin uzunluğu kaç cm'dir?", dogru: kr, yanlis: [10, 12, 18, 26, 25], x: () => `Merkezden kirişe indirilen dikme kirişi ortalar. Yarım kiriş √(13² − 5²) = √144 = 12 cm olduğundan kiriş ${kr} cm'dir. 12'yi cevap sanmak yarım kirişi almaktır.` }); }
{ const bc = 8 * (4 + 6) / 4;
  soru({ s: G, t: "Benzerlik", d: 2, q: "ABC üçgeninde D noktası [AB] üzerinde, E noktası [AC] üzerindedir ve DE // BC'dir. |AD| = 4 cm, |DB| = 6 cm ve |DE| = 8 cm olduğuna göre |BC| kaç cm'dir?", dogru: bc, yanlis: [12, 14, 16, 18, 24], x: () => `DE // BC olduğundan ADE ve ABC üçgenleri benzerdir. Benzerlik oranı AD / AB = 4 / 10'dur. DE / BC = 4 / 10 olduğundan BC = 8·10 / 4 = ${bc} cm bulunur. 8 + 6 = 14 almak yanlıştır.` }); }
{ const b = 36 * (3 / 2) ** 2;
  soru({ s: G, t: "Benzerlik", d: 3, q: "İki benzer çokgenin benzerlik oranı 2/3'tür. Küçük çokgenin alanı 36 cm² ise büyük çokgenin alanı kaç cm²'dir?", dogru: b, yanlis: [54, 64, 72, 90, 108], x: () => `Benzer şekillerin alanları oranı, benzerlik oranının karesidir: (2/3)² = 4/9. Büyük alan A için 36 / A = 4/9 olduğundan A = ${b} cm² olur. Oranı karesiz alıp 54 bulmak yaygın bir hatadır.` }); }
{ const u = h(8, 15);
  soru({ s: G, t: "Analitik geometri", d: 1, q: "Analitik düzlemde K(2, −1) ve L(10, 14) noktaları arasındaki uzaklık kaç birimdir?", dogru: u, yanlis: [15, 16, 19, 21, 23], x: () => `Uzaklık √((10 − 2)² + (14 − (−1))²) = √(64 + 225) = √289 = ${u} birimdir. İkinci farkı 14 − 1 = 13 yazmak işaret hatasıdır.` }); }
{ const bx = 2 * 3 - (-1), by = 2 * 5 - 2;
  soru({ s: G, t: "Analitik geometri", d: 2, q: "AB doğru parçasının orta noktası M(3, 5) ve A noktası (−1, 2) olduğuna göre B noktasının koordinatları toplamı kaçtır?", dogru: bx + by, yanlis: [8, 11, 13, 14, 17], x: () => `Orta nokta koordinatları uç noktaların ortalamasıdır. x_B = 2·3 − (−1) = ${bx} ve y_B = 2·5 − 2 = ${by} bulunur. B(${bx}, ${by}) olduğundan toplam ${bx + by}'tir.` }); }
{ const a = (24 / 3) * (24 / 4) / 2;
  soru({ s: G, t: "Analitik geometri", d: 3, q: "3x + 4y = 24 doğrusunun koordinat eksenleriyle oluşturduğu üçgenin alanı kaç birimkaredir?", dogru: a, yanlis: [12, 18, 28, 36, 48], x: () => `Doğru x eksenini y = 0 için x = 8'de, y eksenini x = 0 için y = 6'da keser. Oluşan dik üçgenin alanı 8·6 / 2 = ${a} birimkaredir.` }); }
{ const v = 4 ** 3;
  soru({ s: G, t: "Katı cisimler", d: 1, q: "Bir ayrıtı 4 cm olan küpün hacmi kaç cm³'tür?", dogru: v, yanlis: [12, 16, 48, 96, 144], x: () => `Küpün hacmi ayrıtın küpüdür: 4³ = ${v} cm³. 96 küpün yüzey alanıdır (6·4²).` }); }
{ const v = 3 * 3 * 10;
  soru({ s: G, t: "Katı cisimler", d: 2, q: "Taban yarıçapı 3 cm ve yüksekliği 10 cm olan dik silindirin hacmi kaç π cm³'tür?", dogru: v, yanlis: [30, 60, 75, 120, 300], x: () => `Silindirin hacmi πr²h'dir. π·3²·10 = ${v}π cm³ olur.` }); }
{ const l = h(6, 8), y = 6 * l;
  soru({ s: G, t: "Katı cisimler", d: 3, q: "Taban yarıçapı 6 cm, yüksekliği 8 cm olan dik dairesel koninin yanal alanı kaç π cm²'dir?", dogru: y, yanlis: [48, 60 + 36, 80, 108, 120], x: () => `Eğik yüksekliği (ana doğru) Pisagor ile bulunur: l = √(6² + 8²) = ${l} cm. Yanal alan π·r·l = π·6·${l} = ${y}π cm²'dir. Yüksekliği (8) kullanmak yanlıştır.` }); }
