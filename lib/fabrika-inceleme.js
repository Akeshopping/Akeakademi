// AKE Soru Fabrikası · saf (veritabanı/ağ kullanmayan) inceleme yardımcıları: pasaj (p) denetimi, biçim denetimi, benzerlik uyarısı,
// denetçi sorunlarının yapılandırılması, şık karıştırma. Hiçbiri bir soruyu silmez, kararını değiştirmez ya da "özgün" demez;
// yalnızca uyarı/bulgu üretir. Dış soru havuzu (ÖSYM/yayınevi) karşılaştırması BURADA YOKTUR: yalnız elimizdeki taslaklar arası bakılır.

const kucuk = s => String(s == null ? "" : s).toLocaleLowerCase("tr");

/* ---------- pasaj (p) ---------- */
/* Kök bir metne/şekle/tabloya atıf yapıyor mu? ("Aşağıdaki cümlelerin hangisinde…" atıf DEĞİLDİR: şıklar cümledir.) */
const PASAJ_ATFI = /parçaya göre|parçada|parçanın|metne göre|metinde|yukarıdaki (?:parça|metin|şekil|tablo|grafik)|verilen (?:parça|metin|şekil|tablo|grafik)|şekle göre|tabloya göre|grafiğe göre/i;
export const gercekPasajMi = p => { const t = String(p == null ? "" : p).trim(); return t.length >= 60 && /[.!?…]/.test(t) && t.split(/\s+/).length >= 10; };
/* → { p } (p yalnız gerçek paragrafsa dolu) ya da { p: "", hata: "pasaj_eksik" } (kök pasaja atıf yapıyor ama gerçek pasaj yok) */
export function pasajDegerlendir({ p, q } = {}) {
  const t = String(p == null ? "" : p).trim();
  if (gercekPasajMi(t)) return { p: t };
  if (PASAJ_ATFI.test(String(q || ""))) return { p: "", hata: "pasaj_eksik" };
  return { p: "" };
}

/* ---------- biçim ---------- */
const ISARET_ATFI = /altı çizili|altı çizilmiş|koyu (?:yazılmış|renkli|harfle)|kalın yazılmış|italik|eğik yazılmış|renkli yazılmış|işaretlenmiş|«\s*»/i;
const ISARETLI = /«[^»«]+»|<u>|<b>|<i>|<strong>|<em>|__[^_]+__|\*\*[^*]+\*\*/;
/* k: { q, o, p? } → [{ kod, mesaj }]. Yalnız KESİN biçim hataları; üslup/içerik yorumu yapmaz. */
export function bicimSorunlari(k) {
  const s = [], kok = String((k && k.q) || ""), o = Array.isArray(k && k.o) ? k.o : [];
  const aranan = [String((k && k.p) || ""), o.join("\n"), kok.replace(/«\s*»/g, "")].join("\n");
  if (ISARET_ATFI.test(kok) && !ISARETLI.test(aranan)) s.push({ kod: "isaret_eksik", mesaj: "Soru kökü işaretli/altı çizili ifadeye atıf yapıyor ama seçeneklerde ya da metinde işaretli ifade («…») yok; öğrenci neyin kastedildiğini göremez." });
  return s;
}

/* ---------- inceleme uyarıları (okuma anında hesaplanır; kayda yazılmaz) ---------- */
const KAYNAK_GEREKLI = (ders, konu) => ders === "edebiyat" || /deyim|atasöz|ikileme|söz sanat/i.test(String(konu || ""));
const SERT = new Set(["isaret_eksik", "p_pasaj_degil", "pasaj_eksik"]);
export const sertUyariMi = tur => SERT.has(tur);
/* k: { s, t, q, o, p? } → kendi başına belli olan uyarılar (benzerlik hariç) */
export function tekilUyarilar(k) {
  const u = [];
  for (const b of bicimSorunlari(k)) u.push({ tur: b.kod, agirlik: "sert", mesaj: b.mesaj });
  const p = String((k && k.p) || "").trim();
  if (p && !gercekPasajMi(p)) u.push({ tur: "p_pasaj_degil", agirlik: "sert", mesaj: `Pasaj (p) alanı gerçek bir metin değil, etiket gibi: "${p.slice(0, 60)}". Öğrenci ekranında pasaj kutusu olarak görünür.` });
  else if (!p && PASAJ_ATFI.test(String((k && k.q) || ""))) u.push({ tur: "pasaj_eksik", agirlik: "sert", mesaj: "Soru kökü bir parçaya/tabloya atıf yapıyor ama pasaj yok." });
  if (KAYNAK_GEREKLI(k && k.s, k && k.t)) u.push({ tur: "kaynak_dogrulama", agirlik: "yumusak", mesaj: "Deyim/edebiyat bilgisi TDK ya da ders kitabı gibi güvenilir bir kaynakla doğrulanmadı; ikincil sitelerde anlamlar birbirinden farklı çıkabiliyor." });
  return u;
}

/* ---------- benzerlik (yalnız elimizdeki taslaklar arası; DIŞ HAVUZ KARŞILAŞTIRMASI DEĞİLDİR) ---------- */
const DURAK = new Set(["aşağıdakilerden", "hangisidir", "hangisi", "kaçtır", "olduğuna", "göre", "olmaktadır", "olarak", "ile", "için", "gibi", "bir", "ve", "ya", "da", "bu", "şu", "en", "çok", "daha"]);
const MIN_KOK_KELIME = 6;   // çok kısa kökler (ör. sentetik test metni) ayırt edici değildir; benzerlik hesaplanmaz
function kelimeler(metin, sayiMaskele) {
  let t = kucuk(metin).replace(/[^\p{L}\p{N}]+/gu, " ").trim(); if (sayiMaskele) t = t.replace(/\d+/g, "#");
  return t ? t.split(/\s+/).filter(w => w.length >= 2 && !DURAK.has(w)) : [];
}
const kok4 = w => (w === "#" ? "#" : w.slice(0, 4));
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
/* bir şıktaki ardışık kelime çiftleri (kelimeler 4 harfe kırpılır: ek farklarını yutar); sayı içeren çiftler atılır */
const sikCiftleri = secenekler => { const s = new Set(); for (const o of secenekler) { const w = kelimeler(o, false).map(kok4); for (let i = 0; i + 1 < w.length; i++) s.add(w[i] + " " + w[i + 1]); } return s; };
const ogeHazirla = k => { const kw = kelimeler(k.q, true).map(kok4); return { id: k.id, s: k.s, t: k.t, kokKw: kw.length, kok: new Set(kw), ciftler: sikCiftleri(k.o || []) }; };
export const ciftOlc = (a, b) => ({ skor: Math.round(jaccard(a.kok, b.kok) * 100) / 100, ortakHam: [...a.ciftler].filter(g => b.ciftler.has(g) && !g.split(" ").every(w => a.kok.has(w) && b.kok.has(w))) });
export const ham = (k1, k2) => ciftOlc(ogeHazirla(k1), ogeHazirla(k2));   // yalnız eşik kalibrasyonu/test için
/* liste: [{ id, s, t, q, o }] → { [id]: [{ tur:"benzerlik", ilgili, skor, ortak, mesaj }] }. Yalnız aynı ders + aynı konu çiftleri karşılaştırılır. */
export function benzerlikUyarilari(liste) {
  const out = {};
  const oge = (liste || []).map(ogeHazirla);
  const ekle = (id, ilgili, skor, ortak, neden) => (out[id] = out[id] || []).push({ tur: "benzerlik", ilgili, skor, ortak, mesaj: `Benzer soru olabilir (${ilgili}): ${neden}. Bu bir inceleme uyarısıdır; özgünlük dış kaynaklarla karşılaştırılmadı ve soru silinmedi.` });
  for (let i = 0; i < oge.length; i++) for (let j = i + 1; j < oge.length; j++) {
    const a = oge[i], b = oge[j];
    if (a.s !== b.s || a.t !== b.t || a.kokKw < MIN_KOK_KELIME || b.kokKw < MIN_KOK_KELIME) continue;
    const { skor, ortakHam } = ciftOlc(a, b);
    const sablon = skor >= SABLON_ESIK, ifade = ortakHam.length >= IFADE_ESIK; if (!sablon && !ifade) continue;
    const ortak = ortakHam.slice(0, 5), neden = [sablon ? `soru kökü yapısı benzer (benzerlik ${skor})` : null, ifade ? `şıklarda ortak ifade: ${ortak.slice(0, 3).join(" · ")}` : null].filter(Boolean).join("; ");
    ekle(a.id, b.id, skor, ortak, neden); ekle(b.id, a.id, skor, ortak, neden);
  }
  return out;
}
export const SABLON_ESIK = 0.5, IFADE_ESIK = 2;

/* ---------- denetçi sorunlarını yapılandır ---------- */
export const SORUN_TURLERI = ["yanlis_cevap", "belirsizlik", "celdirici", "cozum", "duzey", "bicim", "diger"];
/* ince_ayar yalnız çeldirici/düzey türlerinde ve açıkça "ince_ayar" ise engellemez; geri kalan her şey (eksik/yanlış alan dahil) engelleyicidir */
export const inceAyarMi = s => s && s.agirlik === "ince_ayar" && (s.tur === "celdirici" || s.tur === "duzey");
export function sorunlariCoz(dizi) {
  const out = [];
  for (const x of dizi || []) {
    if (typeof x === "string") { const m = x.trim(); if (m) out.push({ tur: "belirtilmemis", agirlik: "belirtilmemis", metin: m.slice(0, 400), kaynak: "model" }); continue; }
    if (x && typeof x === "object") {
      const m = String(x.metin == null ? (x.mesaj == null ? "" : x.mesaj) : x.metin).trim();
      out.push(m ? { tur: String(x.tur || "belirtilmemis").slice(0, 30), agirlik: String(x.agirlik || "belirtilmemis").slice(0, 30), metin: m.slice(0, 400), kaynak: "model" }
        : { tur: String(x.tur || "belirtilmemis").slice(0, 30), agirlik: "belirtilmemis", metin: "(sorun metni boş)", kaynak: "model" });
    }
  }
  return out.slice(0, 10);
}

/* ---------- şık karıştırma ---------- */
/* Çözüm/kök/şıklar bir şık HARFİNE atıf yapıyorsa (ör. "D seçeneğinde", "doğru cevap D", "A ve B") ya da şıklar sıralı sayılar / "hiçbiri-hepsi" /
   numaralı ifadelerse karıştırılmaz: karıştırmak çözüm ile cevabı birbirinden koparırdı. Karıştırma tek soruda tek seferlik rastgeledir;
   10 soruda harfleri eşitlemek bir kalite ölçütü DEĞİLDİR ve burada hedeflenmez. */
const HARF_ATFI = /(?<![\p{L}\p{N}'’])[A-E](?![\p{L}\p{N}])/u;
const SIKLI_IFADE = /hiçbiri|hepsi|yukarıdakilerin|(?<![\p{L}\p{N}])(?:I|II|III|IV|V)(?![\p{L}\p{N}])/iu;
const ILKSAYI = x => { const m = /-?\d+(?:[.,]\d+)?/.exec(String(x)); return m ? parseFloat(m[0].replace(",", ".")) : null; };
function sirali(o) {
  const n = o.map(ILKSAYI); if (n.some(v => v === null)) return false;
  return n.every((v, i) => i === 0 || v > n[i - 1]) || n.every((v, i) => i === 0 || v < n[i - 1]);
}
export function siklariKaristir({ q, o, a, x } = {}, rnd = Math.random) {
  const ayni = { q, o, a, x, karisti: false };
  if (!Array.isArray(o) || o.length !== 5 || !Number.isInteger(a) || a < 0 || a > 4) return ayni;
  const metin = [String(x || ""), String(q || ""), ...o].join("\n");
  if (HARF_ATFI.test(metin) || o.some(s => SIKLI_IFADE.test(s)) || sirali(o)) return ayni;
  const idx = [0, 1, 2, 3, 4];
  for (let i = 4; i > 0; i--) { const j = Math.min(i, Math.floor(rnd() * (i + 1))); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const yeni = idx.map(k => o[k]);
  return { q, o: yeni, a: idx.indexOf(a), x, karisti: true };
}
