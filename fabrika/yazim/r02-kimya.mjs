// Tur 2 · Kimya pilot seti (TYT + AYT) — tüm sayılar kodla hesaplanır, ikinci bir yöntemle sağlaması yapılır
// Atom kütleleri: H=1, C=12, N=14, O=16, Na=23, S=32, Cl=35,5, Ca=40, Fe=56, Cu=64
import { soru, tr } from "../lib.mjs";
import assert from "node:assert/strict";
import { H } from "./r02-yardim.mjs";
const on = "f2";
const R = x => Math.round(x * 1e6) / 1e6;
const yak = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `sağlama tutmadı: ${a} ≠ ${b}`);

/* ---- TYT Kimya ---- */
{ // Sabit oranlar kanunu
  const oran = [7, 4], mFe = 14, mS = 10, gerekenS = R(mFe * oran[1] / oran[0]), artan = R(mS - gerekenS), FeS = R(mFe + gerekenS);
  yak(FeS, 22); yak(artan, 2); yak(Math.min(mFe / 56, mS / 32) * 88, FeS);   // mol yoluyla: FeS = 88 g/mol
  soru({ on, s: "kimya", t: "Kimyanın temel kanunları", d: 2, ...H(FeS, [11, 14, 20, 24], 3),
    q: `Demir (Fe) ve kükürt (S) elementleri FeS bileşiğini oluştururken kütlece sabit oranda, mFe / mS = 7/4 oranında birleşir.\n${mFe} g Fe ile ${mS} g S tepkimeye sokuluyor ve tepkime tam verimle sonuçlanıyor.\nBuna göre kaç gram FeS oluşur?`,
    x: () => `${mFe} g Fe, ${mFe}·4/7 = ${tr(gerekenS)} g S ile birleşir. Kükürt ${mS} g olduğundan ${tr(artan)} g S artar. Oluşan FeS kütlesi ${mFe} + ${gerekenS} = ${tr(FeS)} g'dır (kütlenin korunumu: ${mFe + mS} g girdi − ${tr(artan)} g artan = ${tr(FeS)} g). ${mFe + mS} g bütün girdinin toplamıdır, ancak ${tr(artan)} g S tepkimeye girmemiştir.` }); }
{ // Sınırlayıcı bileşen: amonyak
  const mN2 = 28, mH2 = 9, nN2 = mN2 / 28, nH2 = mH2 / 2, nNH3 = R(Math.min(nN2, nH2 / 3) * 2), m = R(nNH3 * 17);
  yak(m, 34); yak(nH2, 4.5);
  soru({ on, s: "kimya", t: "Mol Kavramı", d: 2, ...H(m, [17, 37, 51, 68], 1),
    q: `N₂(g) + 3H₂(g) → 2NH₃(g) tepkimesine göre ${mN2} g N₂ ile ${mH2} g H₂ karıştırılıyor ve tepkime tam verimle sonuçlanıyor.\nBuna göre en fazla kaç gram NH₃ oluşur? (H = 1, N = 14)`,
    x: () => `N₂ mol sayısı ${mN2}/28 = ${nN2}, H₂ mol sayısı ${mH2}/2 = ${tr(nH2)} mol'dür. ${nN2} mol N₂ için ${3 * nN2} mol H₂ gerekir; H₂ yeterli olduğundan sınırlayıcı bileşen N₂'dir. NH₃ = 2·${nN2} = ${tr(nNH3)} mol, kütle ${tr(nNH3)}·17 = ${tr(m)} g bulunur. ${tr(nH2 * 2 / 3 * 17)} g, H₂'yi sınırlayıcı sanmaktan; ${mN2 + mH2} g ise giren kütleleri toplamaktan gelir.` }); }
{ // Saflık hesabı
  const mOrnek = 25, V = 4.48, nCO2 = R(V / 22.4), mCaCO3 = R(nCO2 * 100), saflik = R(mCaCO3 / mOrnek * 100);
  yak(saflik, 80); yak(nCO2, 0.2);
  soru({ on, s: "kimya", t: "Kimyasal hesaplamalar", d: 3, ...H(saflik, [20, 40, 60, 90], 3),
    q: `Saf olmayan ${mOrnek} gramlık bir CaCO₃ örneği yeterli miktarda HCl çözeltisi ile tepkimeye sokuluyor:\nCaCO₃(k) + 2HCl(aq) → CaCl₂(aq) + H₂O(s) + CO₂(g)\nNormal koşullarda ${tr(V)} L CO₂ gazı toplandığına göre örnekteki CaCO₃'ün kütlece yüzde saflığı kaçtır? (C = 12, O = 16, Ca = 40; yabancı maddeler tepkimeye girmiyor; normal koşullarda 1 mol gaz 22,4 L)`,
    x: () => `CO₂ mol sayısı ${tr(V)}/22,4 = ${tr(nCO2)} mol'dür. Tepkimede 1 mol CaCO₃ 1 mol CO₂ verdiğinden ${tr(nCO2)} mol CaCO₃ harcanmıştır. CaCO₃'ün mol kütlesi 100 g/mol olduğundan saf CaCO₃ kütlesi ${tr(nCO2)}·100 = ${tr(mCaCO3)} g'dır. Saflık = ${tr(mCaCO3)}/${mOrnek}·100 = %${tr(saflik)} bulunur. ${tr(mCaCO3)} değeri saf madde kütlesidir, yüzde değil.` }); }
{ // Kaynama noktası karşılaştırma (bilgi)
  soru({ on, s: "kimya", t: "Kimyasal türler arası etkileşim", d: 2, incele: true, sirala: "sabit", secenekler: ["NH₃", "HF", "H₂S", "H₂O", "CH₄"], dogru: 4,
    q: `CH₄, NH₃, H₂O, HF ve H₂S maddelerinin aynı dış basınçta kaynama noktaları karşılaştırıldığında hangisinin kaynama noktası en düşüktür?`,
    x: () => `CH₄ apolar bir moleküldür ve yalnızca zayıf London kuvvetleri içerir; moleküller arası çekim en zayıftır, kaynama noktası yaklaşık −162 °C ile en düşüktür. NH₃, H₂O ve HF molekülleri arasında hidrojen bağı vardır, bu yüzden kaynama noktaları yüksektir. H₂S polar bir moleküldür (dipol-dipol ve London kuvvetleri) ve kaynama noktası yaklaşık −60 °C ile CH₄'ten yüksektir.` }); }
{ // Gaz: sabit hacimde sıcaklık-basınç
  const P1 = 2, T1 = 27 + 273, T2 = 327 + 273, P2 = R(P1 * T2 / T1);
  yak(P2, 4);
  soru({ on, s: "kimya", t: "Maddenin halleri", d: 2, ...H(P2, [3, 6, 8, 1, 2], 3),
    q: `Hacmi değişmeyen sert bir kapta bulunan ideal davranışlı bir gazın 27 °C'deki basıncı ${P1} atm'dir. Gaz sabit mol sayısında 327 °C'ye kadar ısıtılıyor.\nBuna göre gazın son basıncı kaç atm olur?`,
    x: () => `Sabit hacim ve mol sayısında P/T sabittir ve sıcaklık Kelvin cinsinden alınmalıdır. T₁ = 27 + 273 = ${T1} K, T₂ = 327 + 273 = ${T2} K. P₂ = ${P1}·${T2}/${T1} = ${tr(P2)} atm bulunur. Santigrat değerleri oranlamak (327/27) yanlış sonuç verir.` }); }

/* ---- AYT Kimya ---- */
{ // Kısmi basınçlar, gaz karışımı
  const V1 = 2, P1 = 4, V2 = 6, P2 = 2, Vt = V1 + V2, Pt = R((P1 * V1 + P2 * V2) / Vt);
  yak(Pt, 2.5); yak(P1 * V1 / Vt + P2 * V2 / Vt, Pt);
  soru({ on, s: "akimya", t: "Gazlar", d: 3, ...H(Pt, [1.5, 2, 3, 4, 1], 3),
    q: `Sabit sıcaklıkta, ${V1} L'lik bir kapta ${P1} atm basınçlı He gazı ile ${V2} L'lik başka bir kapta ${P2} atm basınçlı Ne gazı bulunmaktadır. İki kap, hacmi önemsiz bir boruyla musluk aracılığıyla birleştirilip musluk açılıyor ve gazlar karıştırılıyor.\nGaz karışımının son toplam basıncı kaç atm olur? (Gazlar birbirleriyle tepkimeye girmez.)`,
    x: () => `Toplam hacim ${V1} + ${V2} = ${Vt} L olur. Sıcaklık sabit olduğundan Boyle yasasına göre He'un kısmi basıncı ${P1}·${V1}/${Vt} = ${tr(P1 * V1 / Vt)} atm, Ne'un kısmi basıncı ${P2}·${V2}/${Vt} = ${tr(P2 * V2 / Vt)} atm olur. Toplam basınç (Dalton) ${tr(Pt)} atm'dir. İki basıncın aritmetik ortalaması olan ${tr((P1 + P2) / 2)} atm, hacimler farklı olduğu için yanlıştır.` }); }
{ // Karışım derişimi
  const M1 = 0.4, V1 = 200, M2 = 0.1, V2 = 300, n = R(M1 * V1 / 1000 + M2 * V2 / 1000), M = R(n / ((V1 + V2) / 1000));
  yak(M, 0.22);
  soru({ on, s: "akimya", t: "Sıvı çözeltiler", d: 2, ...H(M, [0.25, 0.11, 0.44, 0.5], 1),
    q: `${tr(M1)} M ${V1} mL NaCl çözeltisi ile ${tr(M2)} M ${V2} mL NaCl çözeltisi karıştırılıyor. Hacimlerin toplanabildiği kabul edilecektir.\nOluşan çözeltinin derişimi kaç M'dır?`,
    x: () => `Karışımdaki toplam mol sayısı ${tr(M1)}·0,2 + ${tr(M2)}·0,3 = ${tr(M1 * 0.2)} + ${tr(M2 * 0.3)} = ${tr(n)} mol'dür. Toplam hacim ${V1 + V2} mL = 0,5 L olduğundan derişim ${tr(n)}/0,5 = ${tr(M)} M bulunur. ${tr((M1 + M2) / 2)} M iki derişimin ortalamasıdır ve hacimler eşit olmadığı için yanlıştır.` }); }
{ // Kaynama noktası yükselmesi
  const m = 11.7, M = 58.5, kg = 0.5, i = 2, Kb = 0.5, mol = R(m / M), molal = R(mol / kg), dT = R(i * Kb * molal), bp = R(100 + dT);
  yak(dT, 0.4); yak(bp, 100.4);
  soru({ on, s: "akimya", t: "Sıvı çözeltiler", d: 3, ...H(bp, [100.1, 100.2, 100.8, 102], 2),
    q: `${tr(m)} g NaCl, 500 g suda tamamen çözünüyor. Suyun molal kaynama noktası yükselme sabiti Kb = ${tr(Kb)} °C·kg/mol, NaCl'nin mol kütlesi ${tr(M)} g/mol'dür. NaCl çözeltide tamamen iyonlaşmaktadır.\nBuna göre çözeltinin 1 atm'deki kaynama noktası kaç °C'dir? (Saf suyun kaynama noktası 100 °C)`,
    x: () => `NaCl mol sayısı ${tr(m)}/${tr(M)} = ${tr(mol)} mol; çözelti ${tr(molal)} molal'dir (0,5 kg su). NaCl → Na⁺ + Cl⁻ olduğundan van't Hoff çarpanı i = ${i} alınır. ΔTk = i·Kb·m = ${i}·${tr(Kb)}·${tr(molal)} = ${tr(dT)} °C. Kaynama noktası 100 + ${tr(dT)} = ${tr(bp)} °C'dir. İyonlaşma dikkate alınmazsa yalnız ${tr(Kb * molal)} °C yükselme bulunur ve 100,2 °C sonucu çıkar.` }); }
{ // Denge sabiti
  const n0 = 1, V = 1, nNO2 = 0.4, nN2O4 = R(n0 - nNO2 / 2), Kc = R((nNO2 / V) ** 2 / (nN2O4 / V));
  yak(Kc, 0.2);
  soru({ on, s: "akimya", t: "Kimyasal denge", d: 3, ...H(Kc, [0.16, 0.4, 0.5, 0.8], 1),
    q: `${V} litrelik sabit hacimli boş bir kaba ${n0} mol N₂O₄(g) konuyor ve sabit sıcaklıkta\nN₂O₄(g) ⇌ 2NO₂(g)\ndengesi kuruluyor. Dengede kapta ${tr(nNO2)} mol NO₂(g) bulunduğuna göre bu sıcaklıkta denge sabiti Kc kaçtır?`,
    x: () => `${tr(nNO2)} mol NO₂ oluşması için ${tr(nNO2 / 2)} mol N₂O₄ harcanmıştır. Dengede N₂O₄ = ${n0} − ${tr(nNO2 / 2)} = ${tr(nN2O4)} mol'dür. Kc = [NO₂]² / [N₂O₄] = (${tr(nNO2)})² / ${tr(nN2O4)} = ${tr(nNO2 ** 2)} / ${tr(nN2O4)} = ${tr(Kc)} bulunur. NO₂ derişiminin karesi alınmazsa ${tr(nNO2 / nN2O4)} elde edilir.` }); }
{ // Nötrleşme
  const pHb = 12, pHa = 3, Vb = 0.05, Va = 0.5, nOH = 10 ** (pHb - 14) * Vb, nH = 10 ** (-pHa) * Va;
  yak(nOH, nH, 1e-15);
  soru({ on, s: "akimya", t: "Asit-baz dengesi", d: 3, ...H(7, [3, 5, 7.5, 10, 12], 1),
    q: `25 °C'de pH değeri ${pHb} olan 50 mL NaOH çözeltisi ile pH değeri ${pHa} olan 500 mL HCl çözeltisi karıştırılıyor.\nKarışımın pH değeri kaçtır?`,
    x: () => `pH = 12 olan NaOH çözeltisinde [OH⁻] = 10⁻² M olduğundan 0,05 L'de 5·10⁻⁴ mol OH⁻ vardır. pH = 3 olan HCl çözeltisinde [H⁺] = 10⁻³ M olduğundan 0,5 L'de 5·10⁻⁴ mol H⁺ vardır. Mol sayıları eşit olduğu için tam nötrleşme olur; oluşan NaCl çözeltisi 25 °C'de nötrdür ve pH = 7'dir. pH değerlerinin ortalaması olan 7,5 değeri, hacimler farklı olduğu için yanlıştır; çözüm mol sayılarının karşılaştırılmasıyla yapılır.` }); }
{ // Faraday
  const I = 5, t = 1930, F = 96500, Q = I * t, nE = Q / F, nCu = nE / 2, m = nCu * 64;
  yak(Math.round(nE * 1000) / 1000, 0.1); yak(Math.round(m * 1000) / 1000, 3.2);
  const mm = Math.round(m * 1000) / 1000;
  soru({ on, s: "akimya", t: "Elektrokimya", d: 3, ...H(mm, [0.32, 1.6, 6.4, 32], 2),
    q: `CuSO₄ çözeltisi, inert elektrotlar kullanılarak ${I} A'lik sabit akımla ${t} saniye elektroliz ediliyor.\nBuna göre katotta biriken Cu kütlesi kaç gramdır? (Cu = 64, 1 mol elektronun yükü 96500 C; Cu²⁺ + 2e⁻ → Cu)`,
    x: () => `Geçen yük Q = I·t = ${I}·${t} = ${Q} C'dir. Mol elektron sayısı ${Q}/${F} = ${tr(Math.round(nE * 1000) / 1000)} mol olur. Cu²⁺ + 2e⁻ → Cu olduğundan ${tr(Math.round(nCu * 1000) / 1000)} mol Cu birikir. Kütle ${tr(Math.round(nCu * 1000) / 1000)}·64 = ${tr(mm)} g bulunur. Elektron sayısı 2 ile bölünmezse ${tr(m * 2)} g gibi iki kat büyük bir değer elde edilir.` }); }
{ // Hess yasası
  const dC = -394, dH2 = -286, dYanma = -890, dOlusum = dC + 2 * dH2 - dYanma;
  yak(dOlusum, -76);
  soru({ on, s: "akimya", t: "Kimyasal tepkimelerde enerji", d: 3, ...H(dOlusum, [76, -966, -1856, 210, 966, 1856], 0),
    q: `Aşağıdaki tepkimeler ve entalpi değişimleri veriliyor:\nC(k) + O₂(g) → CO₂(g)  ΔH = ${tr(dC)} kJ\nH₂(g) + ½O₂(g) → H₂O(s)  ΔH = ${tr(dH2)} kJ\nCH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(s)  ΔH = ${tr(dYanma)} kJ\nBuna göre C(k) + 2H₂(g) → CH₄(g) tepkimesinin ΔH değeri kaç kJ'dür?`,
    x: () => `İstenen tepkime, birinci tepkime ile ikinci tepkimenin 2 katının toplanması ve üçüncü tepkimenin ters çevrilmesiyle elde edilir: ΔH = (${tr(dC)}) + 2·(${tr(dH2)}) − (${tr(dYanma)}) = ${tr(dC)} − ${-2 * dH2} + ${-dYanma} = ${tr(dOlusum)} kJ. Üçüncü tepkimenin ters çevrilirken işaretinin değiştirilmemesi ${tr(dC + 2 * dH2 + dYanma)} kJ'ü, ikinci tepkimenin 2 ile çarpılmaması ise ${tr(dC + dH2 - dYanma)} kJ'ü verir.` }); }
{ // Yapı izomerleri (bilgi)
  soru({ on, s: "akimya", t: "Organik kimya", d: 3, incele: true, ...H(5, [1, 2, 3, 4], 4),
    q: `C₆H₁₄ molekül formülüne sahip, açık zincirli doymuş hidrokarbonların (alkanların) kaç farklı yapı izomeri vardır?`,
    x: () => `C₆H₁₄ için beş farklı karbon iskeleti çizilebilir: n-hekzan (düz zincir), 2-metilpentan, 3-metilpentan, 2,2-dimetilbütan ve 2,3-dimetilbütan. Başka bir dallanma bu beş yapıdan biriyle aynı maddeyi verir (örneğin 4-metilpentan ismi 2-metilpentanla aynıdır). Bu yüzden izomer sayısı 5'tir. C₅H₁₂ için bu sayı 3, C₄H₁₀ için 2'dir.` }); }
