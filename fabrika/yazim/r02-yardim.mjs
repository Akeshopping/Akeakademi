// Şıkları doğru cevabın hedef sırasına göre kurar: hedef = doğru şıktan önce gelecek şık sayısı (0 = A ... 4 = E).
// Çeldiriciler elle seçilir (öğrencinin gerçek hatalarından); en yakın olanlar alınır, yeterli yoksa hata verir.
import { tr } from "../lib.mjs";
export function H(dogru, yanlis, hedef, bic = tr) {
  const alt = yanlis.filter(v => v < dogru).sort((a, b) => b - a), ust = yanlis.filter(v => v > dogru).sort((a, b) => a - b);
  if (alt.length < hedef || ust.length < 4 - hedef) throw new Error(`hedef ${hedef} için çeldirici yetmiyor: doğru ${dogru}, alt ${alt.length}, üst ${ust.length}`);
  const hepsi = [...alt.slice(0, hedef), dogru, ...ust.slice(0, 4 - hedef)].sort((a, b) => a - b);
  return { sirala: "sabit", secenekler: hepsi.map(v => bic(v)), dogru: hepsi.indexOf(dogru) };
}
