// AKE Soru Fabrikası · soru kurucu
// Sayısal sorularda doğru şık KODLA hesaplanır; şıkların yeri ve a numarası kodla belirlenir.
import fs from "node:fs";

export const DERSLER = ["turkce","tarih","cografya","felsefe","din","mat","geo","fizik","kimya","biyoloji","amat","afizik","akimya","abiyoloji","edebiyat","tarih2","cografya2","psikoloji","sosyoloji","mantik","ingilizce"];
export const SAYISAL = new Set(["mat","geo","amat","fizik","kimya","afizik","akimya"]);

const LISTE = [];
export const tumu = () => LISTE;
let say = {};

function h32(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

/** Sayıyı Türkçe yazım biçimine çevirir (virgül, binlik ayracı yok). */
export function tr(n, k = 6) {
  if (typeof n === "string") return n;
  if (Number.isInteger(n)) return String(n).replace("-", "−");
  let s = String(+n.toFixed(k)); return s.replace(".", ",").replace("-", "−");
}
/** a/b kesri (sadeleşmiş) */
export function kes(a, b) { const g = (x, y) => y ? g(y, x % y) : Math.abs(x); const d = g(a, b); a /= d; b /= d; if (b < 0) { a = -a; b = -b; } return b === 1 ? String(a) : a + "/" + b; }

/**
 * def:
 *  s,t,d,q,p?        : ders, konu, zorluk, soru kökü, metin
 *  dogru             : doğru cevap (sayı veya metin) -> sayısal sorularda hesaplanmış değer
 *  yanlis            : en az 4 yanlış cevap (sayı veya metin) — fazlası olursa ilk 4 farklı olan alınır
 *  bic               : sayıyı yazıya çeviren fonksiyon (varsayılan tr)
 *  sirala            : "artan" (sayısal şıklar) | "karisik" (varsayılan: sözel, dengeli konum) | "sabit" (verilen sıra, dogru: indeks)
 *  x                 : açıklama (metin)
 *  incele            : true ise öğretmen incelemesine yazılır
 */
export function soru(def) {
  const { s, t, d, q, p, dogru, yanlis, x } = def;
  if (!DERSLER.includes(s)) throw new Error("ders yok: " + s);
  if (![1, 2, 3].includes(d)) throw new Error("d geçersiz: " + q);
  const bic = def.bic || tr;
  const sirala = def.sirala || (typeof dogru === "number" && SAYISAL.has(s) ? "artan" : "karisik");
  say[s] = (say[s] || 0) + 1;
  const id = (def.on || "f1") + "-" + s + "-" + String(say[s]).padStart(3, "0");
  let o, a;
  if (sirala === "sabit") {
    o = def.secenekler.map(String); a = dogru;
  } else {
    const dg = bic(dogru); const farkli = []; const gor = new Set([dg]);
    for (const y of yanlis) { const b = bic(y); if (!gor.has(b)) { gor.add(b); farkli.push({ b, v: y }); } }
    if (farkli.length < 4) throw new Error("4 farklı yanlış şık yok: " + q);
    let sec = farkli.slice(0, 4);
    if (sirala === "artan") {
      // doğru şıkkın konumu dengeli olsun: hedef konuma göre alt/üst çeldirici seç
      const tum = farkli.map(e => e.v);
      const birim = Number.isInteger(dogru) ? 1 : 0.1, uret = def.uretme !== false;
      const guzel = x => { const e = 10 ** Math.floor(Math.log10(x)), m = x / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; };
      const adim = guzel(Math.max(birim, Math.abs(dogru) * 0.12));
      const yazar = (yon) => tum.filter(v => (yon < 0 ? v < dogru : v > dogru)).sort((m, n) => yon < 0 ? n - m : m - n);
      const tamamla = (yaz, yon) => { const r = yaz.slice(); if (uret) for (let k = 1; r.length < 4 && k < 40; k++) { const v = +(dogru + yon * k * adim).toFixed(6); if (r.includes(v)) continue; if (dogru > 0 && v <= 0) break; r.push(v); } return r; };
      const altY = yazar(-1), ustY = yazar(+1), alt = tamamla(altY, -1), ust = tamamla(ustY, +1);
      const fG = [0, 1, 2, 3, 4].filter(t => alt.length >= t && ust.length >= 4 - t);
      if (!fG.length) throw new Error("şıklar için yeterli çeldirici yok: " + q);
      const fA = fG.filter(t => altY.length >= t && ustY.length >= 4 - t);
      const enaz = Math.min(...fG.map(t => konumToplam[t]));
      const havuz = fA.filter(t => konumToplam[t] <= enaz + 1);
      const adaylar = (havuz.length ? havuz : fG).slice().sort((m, n) => (konumToplam[m] - konumToplam[n]) || (h32(id + m) - h32(id + n)));
      const t = adaylar[0]; konumToplam[t]++;
      const hepsi = [{ b: bic(dogru), v: dogru, ok: 1 }, ...[...alt.slice(0, t), ...ust.slice(0, 4 - t)].map(v => ({ b: bic(v), v }))].sort((m, n) => m.v - n.v);
      o = hepsi.map(e => e.b); a = hepsi.findIndex(e => e.ok);
    } else {
      // yanlışları tutarlı karıştır, doğruyu hedef konuma koy (dengeli dağılım için sayaç)
      const hedef = (def.konum !== undefined) ? def.konum : (konumSayac[s] = ((konumSayac[s] ?? h32(s) % 5) + 3) % 5);
      sec.sort((m, n) => h32(id + m.b) - h32(id + n.b));
      const arr = sec.map(e => e.b); arr.splice(hedef, 0, dg); o = arr; a = hedef;
    }
  }
  const out = { id, s, t, d, q: q.trim(), o, a, x: (typeof x === "function" ? x() : x).trim() };
  { const tum = out.x + " " + out.o.join(" "); if (/\d[.,]\d{5,}|undefined|NaN/.test(tum)) throw new Error("kayan nokta artığı veya hatalı değer: " + out.id + " " + tum.slice(0, 120)); }
  if (p) out.p = p.trim();
  const meta = { incele: def.incele ?? !SAYISAL.has(s) };
  LISTE.push({ soru: out, meta });
  return out;
}
const konumSayac = {}; const konumToplam = [0, 0, 0, 0, 0];
export function sifirla() { say = {}; LISTE.length = 0; for (const k in konumSayac) delete konumSayac[k]; konumToplam.fill(0); }

/** Birkaç farklı hatalı sonuç için yardımcı: 4'ten az gelirse makul sapmalar ekler */
export function sapma(dogru, ...ekler) {
  const s = []; for (const e of ekler) if (typeof e === "number" && isFinite(e) && e !== dogru && !s.includes(e)) s.push(e);
  for (const k of [1, -1, 2, -2, 3, -3, 4, 5, 10]) { if (s.length >= 6) break; const v = dogru + k; if (v !== dogru && !s.includes(v) && (dogru >= 0 ? v >= 0 : true)) s.push(v); }
  return s;
}

export function yaz(dosya) {
  const soruListe = LISTE.map(e => e.soru);
  fs.writeFileSync(dosya, JSON.stringify(soruListe));
  return soruListe.length;
}
export function incelenecekler() { return LISTE.filter(e => e.meta.incele).map(e => e.soru); }
