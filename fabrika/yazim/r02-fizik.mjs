// Tur 2 · Fizik pilot seti (TYT + AYT) — tüm sayılar kodla hesaplanır, ikinci bir yöntemle sağlaması yapılır
import { soru, tr } from "../lib.mjs";
import assert from "node:assert/strict";
import { H } from "./r02-yardim.mjs";
const on = "f2", g = 10;
const yak = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `sağlama tutmadı: ${a} ≠ ${b}`);

/* ---- TYT Fizik ---- */
{ // Kaldırma kuvveti: tamamen batması için eklenecek kütle
  const rho = 0.6, V = 200, rs = 1, mc = rho * V, ek = rs * V - mc;           // g, cm³
  yak(ek, 80); yak(V * (rs - rho), ek);                                         // ikinci yol: V(ρsu − ρcisim)
  soru({ on, s: "fizik", t: "Kaldırma kuvveti", d: 2, ...H(ek, [mc, rs * V, 40, 160, 100], 0),
    q: `Özkütlesi ${tr(rho)} g/cm³, hacmi ${V} cm³ olan homojen bir cisim, özkütlesi ${rs} g/cm³ olan suda yüzmektedir. Cismin üzerine bir ek kütle konularak cismin tamamen suya batıp dengede kalması sağlanacaktır.\nBuna göre ek kütle en az kaç gramdır? (Ek kütle cismin üzerindedir, suya değmez ve cismin yüzmesini bozmaz.)`,
    x: () => `Cisim tamamen battığında kaldırma kuvveti, taşırdığı ${V} cm³ suyun ağırlığına eşittir: ${rs * V} g'lık suyun ağırlığı. Cismin kütlesi ${tr(rho)} · ${V} = ${mc} g olduğundan ek kütle ${rs * V} − ${mc} = ${ek} g bulunur. ${mc} g cismin kendi kütlesi, ${rs * V} g ise batan cismin taşırdığı suyun kütlesidir; ikisi de istenen değer değildir.` }); }
{ // İpli cisim: gerilme
  const V = 400e-6, rc = 750, rw = 1000, Fk = rw * V * g, G = rc * V * g, T = Fk - G;
  yak(T, 1); yak((rw - rc) * V * g, T);
  soru({ on, s: "fizik", t: "Kaldırma kuvveti", d: 3, ...H(T, [3, 4, 7, 0.5, 2], 0),
    q: `Hacmi 400 cm³ ve özkütlesi 0,75 g/cm³ olan homojen bir cisim, tabanına bir iple bağlanarak özkütlesi 1 g/cm³ olan suyla dolu bir kapta tamamen suya batmış ve dengede tutulmaktadır.\nBuna göre ipteki gerilme kuvveti kaç N'dur? (g = 10 m/s²)`,
    x: () => `Birimleri SI'ya çevirelim: 1 g/cm³ = 1000 kg/m³, 400 cm³ = ${tr(V, 6)} m³. Cisim tamamen batmış olduğundan kaldırma kuvveti 1000 · ${tr(V, 6)} · 10 = ${tr(Fk)} N'dur. Cismin ağırlığı 750 · ${tr(V, 6)} · 10 = ${tr(G)} N'dur. Cisim yukarı doğru itildiğinden denge için ip aşağı doğru çeker: T + G = Fk, T = ${tr(Fk)} − ${tr(G)} = ${tr(T)} N. ${tr(G)} N yalnız ağırlık, ${tr(Fk)} N yalnız kaldırma kuvvetidir; gerilme ikisinin farkıdır.` }); }
{ // Dalga: ortam değişince frekans sabit
  const l1 = 6, v1 = 12, v2 = 8, f = v1 / l1, l2 = v2 / f;
  yak(l2, 4); yak(l1 * v2 / v1, l2);
  soru({ on, s: "fizik", t: "Dalgalar", d: 2, ...H(l2, [2, 3, 8, 9, 12], 2),
    q: `Derin bir bölgeden sığ bir bölgeye geçen su dalgalarının derin bölgedeki dalga boyu ${l1} cm ve yayılma hızı ${v1} cm/s'dir. Sığ bölgede dalgaların hızı ${v2} cm/s olmaktadır.\nBuna göre sığ bölgedeki dalga boyu kaç cm'dir?`,
    x: () => `Dalga bir ortamdan diğerine geçerken frekansı değişmez. Derin bölgede f = v/λ = ${v1}/${l1} = ${f} Hz'dir. Sığ bölgede λ = v/f = ${v2}/${f} = ${l2} cm olur. Hız azaldığı için dalga boyu da küçülür; ${tr(l1 * v1 / v2)} cm değeri oranın ters kurulmasıyla elde edilir ve yanlıştır.` }); }
{ // Görünür derinlik
  const h = 60, n = 4 / 3, hg = h / n;
  yak(hg, 45);
  soru({ on, s: "fizik", t: "Optik", d: 2, ...H(hg, [60, 80, 36, 75, 30], 1),
    q: `Derinliği ${h} cm olan bir havuz, kırılma indisi 4/3 olan suyla doludur. Havuzun tabanına dik doğrultuda, havadan bakan bir gözlemci taban üzerindeki küçük bir taşı görmektedir.\nBu gözlemciye göre taş, su yüzeyinden kaç cm aşağıdadır?`,
    x: () => `Dik doğrultuda bakıldığında görünür derinlik, gerçek derinliğin ortamın kırılma indisine bölünmesiyle bulunur: ${h} / (4/3) = ${hg} cm. Cisim gerçek derinliğinde (${h} cm) görünmez; sudan havaya bakan gözlemciye daha sığ görünür. ${tr(h * n)} cm ise bölme yerine çarpma yapılarak bulunan hatalı değerdir.` }); }
{ // Devre: paralel kolun akımı
  const R1 = 6, R2 = 3, R3 = 4, V = 18;
  const Rp = R1 * R2 / (R1 + R2), Re = Rp + R3, I = V / Re, Vp = I * Rp, I1 = Vp / R1, I2 = Vp / R2;
  yak(I1, 1); yak(I1 + I2, I); yak(I * R2 / (R1 + R2), I1);
  soru({ on, s: "fizik", t: "Elektrik", d: 3, ...H(I1, [I2, I, 6, 1.5, 0.5], 0),
    q: `Bir devrede ${R1} Ω ve ${R2} Ω'luk dirençler birbirine paralel bağlanmış, bu paralel grup ${R3} Ω'luk bir dirençle seri bağlanmıştır. Devre, iç direnci önemsiz ${V} V'luk bir üretece bağlanmıştır.\nBuna göre ${R1} Ω'luk dirençten geçen akım kaç amperdir?`,
    x: () => `Paralel grubun eşdeğeri ${R1}·${R2}/(${R1}+${R2}) = ${Rp} Ω, toplam direnç ${Rp} + ${R3} = ${Re} Ω'dur. Ana koldaki akım ${V}/${Re} = ${I} A'dir. Paralel gruptaki gerilim ${I}·${Rp} = ${Vp} V olur; ${R1} Ω'luk koldan ${Vp}/${R1} = ${I1} A geçer. ${I2} A ${R2} Ω'luk koldan geçen, ${I} A ise toplam akımdır.` }); }

/* ---- AYT Fizik ---- */
{ // Düşey çember en alt nokta gerilmesi
  const m = 0.5, r = 1, v = 6, T = m * g + m * v * v / r;
  yak(T, 23); yak(m * (g + v * v / r), T);
  soru({ on, s: "afizik", t: "Çembersel hareket", d: 3, ...H(T, [18, 5, 13, 28, 33], 3),
    q: `Kütlesi ${tr(m)} kg olan bir cisim, ${r} m uzunluğundaki hafif bir ipin ucuna bağlanmış ve düşey düzlemde dairesel yörüngede döndürülmektedir. Cisim en alt noktadan ${v} m/s hızla geçerken ipteki gerilme kuvveti kaç N olur? (g = 10 m/s²)`,
    x: () => `En alt noktada merkeze doğru (yukarı) net kuvvet gerekir: T − mg = mv²/r. T = mg + mv²/r = ${tr(m * g)} + ${tr(m * v * v / r)} = ${T} N. ${tr(m * v * v / r)} N yalnız merkezcil kuvveti, ${tr(m * g)} N yalnız ağırlığı verir; ağırlık çıkarılarak ${tr(m * v * v / r - m * g)} N bulunması da işaret hatasıdır.` }); }
{ // Kepler 3. yasa
  const r = 4, T = Math.sqrt(r ** 3);
  yak(T, 8);
  soru({ on, s: "afizik", t: "Kütle çekim ve Kepler yasaları", d: 2, ...H(T, [2, 4, 16, 64], 2),
    q: `Güneş etrafında dairesel yörüngede dolanan bir gezegenin yörünge yarıçapı ${r} AB'dir (1 AB = Dünya'nın Güneş'e uzaklığı). Dünya'nın dolanma periyodu 1 yıldır.\nBuna göre bu gezegenin dolanma periyodu kaç yıldır?`,
    x: () => `Kepler'in üçüncü yasasına göre T² / r³ sabittir. Dünya için bu oran 1² / 1³ = 1'dir. Gezegen için T² = ${r}³ = ${r ** 3} ve T = ${T} yıl bulunur. ${r} yıl periyodun yarıçapla doğru orantılı sanılmasından, ${r ** 3} ise küpün periyoda eşitlenmesinden gelen hatalardır.` }); }
{ // Yüklü parçacık, yarıçap oranı
  const mp = 1, qp = 1, ma = 4, qa = 2, oran = (mp / qp) / (ma / qa);
  yak(oran, 0.5);
  soru({ on, s: "afizik", t: "Manyetik alan", d: 3, sirala: "sabit", secenekler: ["1/4", "1/2", "1", "2", "4"], dogru: 1,
    q: `Düzgün bir manyetik alana, alan çizgilerine dik ve aynı hızla giren bir proton ile bir alfa parçacığı (He çekirdeği; kütlesi protonun 4 katı, yükü protonun 2 katı) alan içinde dairesel yörüngeler çizmektedir.\nProtonun yörünge yarıçapının alfa parçacığının yörünge yarıçapına oranı (r_proton / r_alfa) kaçtır?`,
    x: () => `Dairesel harekette qvB = mv²/r olduğundan r = mv/(qB) bulunur. Hız ve B aynı olduğu için r, m/q ile orantılıdır. Proton için m/q = ${mp / qp}, alfa için ${ma}/${qa} = ${ma / qa} olur. r_proton / r_alfa = ${mp / qp}/${ma / qa} bulunur. 2 değeri oranın ters alınmasıyla, 4 ise yalnız kütle oranının kullanılmasıyla elde edilir.` }); }
{ // İdeal transformatör
  const Np = 200, Ns = 50, Vp = 220, R = 11, Vs = Vp * Ns / Np, Is = Vs / R;
  yak(Vs, 55); yak(Is, 5);
  soru({ on, s: "afizik", t: "Elektromanyetik indüksiyon", d: 2, ...H(Is, [1.25, 20, 25, 55, 220], 0),
    q: `Birincil sarım sayısı ${Np}, ikincil sarım sayısı ${Ns} olan ideal bir transformatörün birincil sargısı ${Vp} V'luk alternatif gerilime bağlanmıştır. İkincil sargıya ${R} Ω'luk bir direnç bağlanmıştır.\nBuna göre ikincil devredeki akımın etkin değeri kaç amperdir?`,
    x: () => `İdeal transformatörde V_s / V_p = N_s / N_p olduğundan V_s = ${Vp}·${Ns}/${Np} = ${Vs} V'tur. İkincil akım I_s = V_s / R = ${Vs}/${R} = ${Is} A bulunur. ${Vs} değeri gerilimin kendisidir, ${Vp / R} değeri ise dönüşüm oranı hiç kullanılmadan elde edilir.` }); }
{ // Fotoelektrik
  const lam = 248, hc = 1240, W = 2.5, E = hc / lam, K = E - W;
  yak(E, 5); yak(K, 2.5);
  soru({ on, s: "afizik", t: "Modern fizik", d: 3, ...H(K, [0, 5, 7.5, 2], 2),
    q: `Bağlanma (iş) fonksiyonu ${tr(W)} eV olan bir metal yüzeye dalga boyu ${lam} nm olan monokromatik ışık gönderiliyor. (Planck sabiti ile ışık hızının çarpımı hc = ${hc} eV·nm alınacaktır.)\nBuna göre sökülen fotoelektronların en büyük kinetik enerjisi kaç eV'tur?`,
    x: () => `Foton enerjisi E = hc/λ = ${hc}/${lam} = ${E} eV'tur. Fotoelektrik denklemi K_maks = E − W = ${E} − ${tr(W)} = ${tr(K)} eV verir. ${E} eV fotonun tüm enerjisidir; bağlanma enerjisi çıkarılmadan kinetik enerji olamaz.` }); }
{ // Yay + enerji
  const m = 2, v = 4, k = 800, x = v * Math.sqrt(m / k), xcm = Math.round(x * 100);
  yak(0.5 * m * v * v, 0.5 * k * x * x); yak(xcm, 20);
  soru({ on, s: "afizik", t: "Enerji korunumu", d: 3, ...H(xcm, [10, 40, 5, 25], 2),
    q: `Sürtünmesiz yatay bir düzlemde ${m} kg kütleli bir cisim, ${v} m/s hızla ilerleyip yay sabiti ${k} N/m olan hafif bir yaya çarpmaktadır. Yayın bir ucu duvara sabittir.\nBuna göre yay en fazla kaç cm sıkışır?`,
    x: () => `Cismin kinetik enerjisi tamamen yayın potansiyel enerjisine dönüşür: ½mv² = ½kx². x = v√(m/k) = ${v}·√(${m}/${k}) = ${v}·${tr(Math.sqrt(m / k))} = ${tr(x)} m = ${xcm} cm bulunur. Sonuç metre cinsinden 0,2 çıktığı için santimetreye çevrilmelidir.` }); }
{ // Atwood
  const m1 = 3, m2 = 1, a = (m1 - m2) * g / (m1 + m2), T = m1 * (g - a);
  yak(T, 15); yak(2 * m1 * m2 * g / (m1 + m2), T); yak(m2 * (g + a), T);
  soru({ on, s: "afizik", t: "Newton'un hareket yasaları", d: 3, ...H(T, [10, 20, 30, 7.5, 5], 3),
    q: `Sürtünmesiz, hafif makaradan geçen hafif bir ipin uçlarına ${m1} kg ve ${m2} kg kütleli iki cisim bağlanmış ve sistem serbest bırakılmıştır.\nBuna göre ipteki gerilme kuvveti kaç N'dur? (g = 10 m/s²)`,
    x: () => `Sistemin ivmesi a = (${m1} − ${m2})·10/(${m1} + ${m2}) = ${a} m/s²'dir. Hafif kütleli cisim için T − ${m2}·10 = ${m2}·${a} eşitliğinden T = ${T} N bulunur. Ağır cisim için de ${m1}·10 − T = ${m1}·${a} aynı sonucu verir. ${m2 * g} N hafif cismin ağırlığı, ${m1 * g} N ise ağır cismin ağırlığıdır; gerilme bunlara eşit değildir.` }); }
