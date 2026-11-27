// AKE Akademi · Soru Fabrikası · PİLOT seçimi (saf, deterministik, yeniden çalıştırılabilir)
//
// Amaç: aday sorular içinden İNSAN İNCELEMESİNE gidecek küçük bir set seçmek. Bu set "onaylı" DEĞİLDİR; hiçbir soru bu dosyada onaylanmaz/yayımlanmaz.
// Kural (sabit, rastgelelik YOK, girdi sırasından bağımsız: adaylar önce kimliğe göre sıralanır):
//   1) Şablon = soru metninde sayılar '#' yapılınca aynı kalan metin (aynı cümle kalıbı).
//   2) Her şablondan en çok ONLAR_KADAR (varsayılan 5), toplam en çok TOPLAM_TAVAN (varsayılan 200) soru.
//   3) Uygunluk: cevap önemsiz değil (|cevap| ≥ 2; kesirde 0/1 hariç) ve çeldiriciler makul: her çeldirici cevaba
//      |çeldirici − cevap| ≤ max(0,75·|cevap|, 6) uzaklıkta, cevapla aynı işaretli, cevaptan farklı. Uygun aday < 5 ise
//      ŞABLON KOTASI ASLA uygun olmayan soruyla doldurulmaz: uygun aday 5'ten azsa o şablondan 5'ten az soru
//      alınır ve eksik "eksik" alanında raporlanır. Ayrıca bağımsız denetimde (gerçeklik, çözüm anlatımı, metin, şık) bulgusu olan
//      aday (l.engel doluysa) hiç aday olamaz; toplam sayı 200'e zorlanmaz.
//   4) Çeşitlilik: soru metnindeki sayılar + cevap değeri + zorluk, şablon içinde 0-1'e ölçeklenir. İlk soru şablonun "orta"
//      durumuna (merkeze) en yakın olandır; sonrakiler, seçilmişlere en UZAK olandır (maximin). Cevap şıkkı konumu ve zorluk
//      henüz seçilmemişse uzaklığa bonus eklenir. Eşitlikte küçük kimlik kazanır. Dosyadaki ilk 5 soru otomatik alınmaz.
export const ONLAR_KADAR = 5, TOPLAM_TAVAN = 200;
const sablonOf = q => q.replace(/\d+([.,]\d+)?/g, "#");
export const SAYI = /\d+(?:[.,]\d+)?/g;

export function secenekDegeri(s) {
  const t = String(s).replace(/−/g, "-").replace(/%/g, "").replace(",", ".").trim();
  if (/^-?\d+\/\d+$/.test(t)) { const [a, b] = t.split("/").map(Number); return b ? a / b : NaN; }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function makulMu(q) {
  const v = q.o.map(secenekDegeri);
  if (v.some(x => !Number.isFinite(x))) return false;
  const c = v[q.a];
  if (Math.abs(c) < 2 && !String(q.o[q.a]).includes("/")) return false;
  const tolerans = Math.max(0.75 * Math.abs(c), 6);
  return v.every((x, i) => i === q.a || (x !== c && Math.sign(x) === Math.sign(c) && Math.abs(x - c) <= tolerans));
}

function ozellik(q) {
  const sayilar = (q.q.match(SAYI) || []).map(x => Number(x.replace(",", ".")));
  return { sayilar, cevap: secenekDegeri(q.o[q.a]), a: q.a, d: q.d };
}

/* aday: [{id, konu, aday: <soru>}] → { secilen: [id], rapor } */
export function pilotSec(adaylar, { sablonBasina = ONLAR_KADAR, tavan = TOPLAM_TAVAN } = {}) {
  const sirali = [...adaylar].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const gruplar = new Map();
  for (const l of sirali) { const k = l.konu + "|" + sablonOf(l.aday.q); (gruplar.get(k) || gruplar.set(k, []).get(k)).push(l); }
  const secim = [];
  for (const k of [...gruplar.keys()].sort()) {
    const grup = gruplar.get(k);
    const uygun = grup.filter(l => !l.engel && makulMu(l.aday));
    const havuz = uygun;
    if (!havuz.length) { secim.push({ konu: grup[0].konu, sablon: sablonOf(grup[0].aday.q), aday: grup.length, uygun: 0, eksik: sablonBasina, secilen: [] }); continue; }
    const oz = havuz.map(l => ozellik(l.aday));
    const boyut = Math.max(...oz.map(o => o.sayilar.length), 0);
    const vek = oz.map(o => [...o.sayilar, ...Array(boyut - o.sayilar.length).fill(0), o.cevap]);
    const lo = Array(boyut + 1).fill(Infinity), hi = Array(boyut + 1).fill(-Infinity);
    for (const v of vek) v.forEach((x, i) => { if (Number.isFinite(x)) { lo[i] = Math.min(lo[i], x); hi[i] = Math.max(hi[i], x); } });
    const norm = vek.map(v => v.map((x, i) => (hi[i] > lo[i] && Number.isFinite(x) ? (x - lo[i]) / (hi[i] - lo[i]) : 0)));
    const merkez = norm[0].map((_, i) => norm.reduce((t, v) => t + v[i], 0) / norm.length);
    const mesafe = (u, v) => Math.sqrt(u.reduce((t, x, i) => t + (x - v[i]) ** 2, 0));
    const secilen = [], n = Math.min(sablonBasina, havuz.length), alinan = new Set();
    for (let adim = 0; adim < n; adim++) {
      let en = -1, enPuan = -Infinity;
      for (let i = 0; i < havuz.length; i++) {
        if (alinan.has(i)) continue;
        let puan;
        if (!secilen.length) puan = -mesafe(norm[i], merkez);
        else {
          puan = Math.min(...secilen.map(j => mesafe(norm[i], norm[j])));
          if (!secilen.some(j => oz[j].a === oz[i].a)) puan += 1;
          if (!secilen.some(j => oz[j].d === oz[i].d)) puan += 0.5;
        }
        if (puan > enPuan + 1e-12) { enPuan = puan; en = i; }     // eşitlikte ilk (küçük kimlik) kalır
      }
      alinan.add(en); secilen.push(en);
    }
    secim.push({ konu: grup[0].konu, sablon: sablonOf(grup[0].aday.q), aday: grup.length, uygun: uygun.length, eksik: Math.max(0, sablonBasina - n), secilen: secilen.map(i => havuz[i].id) });
  }
  /* toplam tavan: fazlalık, en çok soru seçilmiş şablonlardan (eşitlikte sondaki şablondan) sondan kırpılır */
  let toplam = secim.reduce((t, s) => t + s.secilen.length, 0);
  while (toplam > tavan) {
    let hedef = null;
    for (const s of secim) if (!hedef || s.secilen.length >= hedef.secilen.length) hedef = s;
    hedef.secilen.pop(); toplam--;
  }
  const ids = secim.flatMap(s => s.secilen);
  const say = (f) => ids.reduce((m, id) => { const l = sirali.find(x => x.id === id); const k = f(l); m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    secilen: ids,
    rapor: {
      kural: { sablonBasina, tavan, uygunlukEsigi: "|cevap|>=2; çeldirici <= max(0,75*|cevap|,6) uzakta, aynı işaretli, cevaptan farklı", sira: "maximin çeşitlilik, merkezden başla, eşitlikte küçük kimlik" },
      toplam: ids.length, sablonSayisi: secim.length, eksikSablon: secim.filter(s => s.eksik > 0).length, eksikToplam: secim.reduce((t, s) => t + s.eksik, 0),
      konuBazinda: say(l => l.konu), cevapKonumu: say(l => "ABCDE"[l.aday.a]), zorluk: say(l => l.aday.d),
      sablonlar: secim
    }
  };
}
