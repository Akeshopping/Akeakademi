/* AKE Akademi · yolculuktaki ders sayfaları (gerçek TYT, AYT, YDT konu başlıkları) */
export const SAYFA = [
  ["TYT · Matematik", "Fonksiyonlar", ["f(x) = 2x + 3", "f(g(x)) = 2g(x) + 3", "Tanım kümesi · görüntü kümesi"], "grafik"],
  ["TYT · Türkçe", "Paragraf", ["Ana düşünce, parçanın", "tamamına yayılan yargıdır.", "Yardımcı düşünceler onu destekler."], "satir"],
  ["AYT · Fizik", "Optik", ["Gelme açısı = yansıma açısı", "Düz aynada görüntü sanaldır."], "isin"],
  ["TYT · Kimya", "Mol kavramı", ["n = m / M", "1 mol = 6,02 · 10²³ tanecik"], "satir"],
  ["TYT · Biyoloji", "Hücre", ["Prokaryot: çekirdek zarı yok", "Ökaryot: zarlı organeller var"], "hucre"],
  ["TYT · Deneme", "Cevap kâğıdı", ["120 soru · 165 dakika"], "optik"],
  ["AYT · Tarih", "Kurtuluş Savaşı", ["1919 · Samsun", "1920 · TBMM", "1922 · Büyük Taarruz"], "zaman"],
  ["TYT · Coğrafya", "Türkiye'nin iklimi", ["Karadeniz: her mevsim yağışlı", "Akdeniz: yazlar sıcak ve kurak"], "cubuk"],
  ["AYT · Edebiyat", "Divan şiiri", ["Aruz ölçüsü", "Gazel · kaside · mesnevi"], "satir"],
  ["TYT · Geometri", "Üçgenler", ["İç açılar toplamı 180°", "Dış açı = uzak iki iç açı"], "ucgen"],
  ["YDT · İngilizce", "Fiil zamanları", ["had already started", "By the time we arrived…"], "satir"],
  ["AYT · Matematik", "Türev", ["Türev, teğetin eğimidir.", "(x²)' = 2x"], "grafik"],
  ["TYT · Fizik", "Kuvvet ve hareket", ["F = m · a", "Net kuvvet sıfırsa cisim", "sabit hızla hareketine devam eder."], "isin"],
  ["AYT · Biyoloji", "Genetik", ["Mendel: baskın ve çekinik özellik", "Aa × Aa → 3 : 1 fenotip oranı"], "hucre"],
  ["AYT · Kimya", "Asitler ve bazlar", ["pH < 7 asidik, pH > 7 bazik", "pH = 7 nötr (25 °C)"], "cubuk"],
  ["TYT · Felsefe", "Bilgi felsefesi", ["Doğru bilgi mümkün mü?", "Rasyonalizm · Empirizm"], "satir"],
  ["Yanlış defteri", "Tekrar zamanı", ["3 soru bugün tekrar edilecek", "Fonksiyonlar · Hücre · Ses olayları"], "yanlis"],
  ["Bugün", "Çalışma masası", ["Kaldığın yerden devam et", "26 / 40 soru"], "son"]
];

export function sayfaCiz(c, [ust, baslik, satir, tur], fontHazir) {
  const x = c.getContext("2d"), W = c.width, H = c.height, F = fontHazir ? '"AKE Sans"' : "system-ui,sans-serif";
  x.fillStyle = "#F5F1E8"; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(90,70,40,${Math.random() * .035})`; x.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
  x.fillStyle = "#6F5A2F"; x.font = `700 22px ${F}`; x.fillText(ust.toLocaleUpperCase("tr-TR"), 44, 70);
  x.fillStyle = "#1c1b18"; x.font = `700 46px ${F}`; x.fillText(baslik, 44, 130);
  x.strokeStyle = "#B69A68"; x.lineWidth = 3; x.beginPath(); x.moveTo(44, 152); x.lineTo(150, 152); x.stroke();
  x.font = `400 27px ${F}`; x.fillStyle = "#4b483f"; satir.forEach((s, i) => x.fillText(s, 44, 210 + i * 44));
  const y0 = 230 + satir.length * 44; x.strokeStyle = "#1c1b18"; x.lineWidth = 3;
  if (tur === "grafik") { x.strokeStyle = "#D8D0C2"; x.lineWidth = 2; x.beginPath(); x.moveTo(60, y0 + 220); x.lineTo(460, y0 + 220); x.moveTo(110, y0 + 260); x.lineTo(110, y0); x.stroke(); x.strokeStyle = "#254236"; x.lineWidth = 4; x.beginPath(); x.moveTo(70, y0 + 250); x.lineTo(440, y0 + 30); x.stroke(); }
  if (tur === "satir" || tur === "son") { x.fillStyle = "#D8D0C2"; for (let i = 0; i < 9; i++) x.fillRect(44, y0 + i * 30, 300 + ((i * 97) % 130), 10); }
  if (tur === "isin") { x.strokeStyle = "#1c1b18"; x.beginPath(); x.moveTo(60, y0 + 200); x.lineTo(460, y0 + 200); x.stroke(); x.strokeStyle = "#a8372a"; x.beginPath(); x.moveTo(100, y0 + 20); x.lineTo(260, y0 + 200); x.lineTo(420, y0 + 20); x.stroke(); x.setLineDash([8, 8]); x.strokeStyle = "#999"; x.beginPath(); x.moveTo(260, y0 + 200); x.lineTo(260, y0); x.stroke(); x.setLineDash([]); }
  if (tur === "hucre") { x.strokeStyle = "#1d6b4a"; x.lineWidth = 4; x.beginPath(); x.ellipse(250, y0 + 130, 190, 120, 0, 0, 7); x.stroke(); x.fillStyle = "rgba(29,107,74,.18)"; x.beginPath(); x.arc(220, y0 + 130, 46, 0, 7); x.fill(); x.stroke(); }
  if (tur === "optik") { x.font = `600 17px ${F}`; for (let r = 0; r < 9; r++) { x.fillStyle = "#66625a"; x.fillText(String(r + 1), 44, y0 + 18 + r * 34); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(100 + k * 52, y0 + 12 + r * 34, 12, 0, 7); x.strokeStyle = "#1c1b18"; x.lineWidth = 2; x.stroke(); if ((r * 3 + k * 2) % 5 === 0) { x.fillStyle = "#1c1b18"; x.fill(); } } } }
  if (tur === "zaman") { x.strokeStyle = "#1c1b18"; x.beginPath(); x.moveTo(60, y0 + 80); x.lineTo(460, y0 + 80); x.stroke(); [100, 260, 420].forEach(px => { x.fillStyle = "#B69A68"; x.beginPath(); x.arc(px, y0 + 80, 12, 0, 7); x.fill(); }); }
  if (tur === "cubuk") { [120, 70, 160, 90, 200].forEach((h, i) => { x.fillStyle = i === 4 ? "#254236" : "#D5DDCF"; x.fillRect(70 + i * 80, y0 + 230 - h, 48, h); }); }
  if (tur === "ucgen") { x.strokeStyle = "#1c1b18"; x.beginPath(); x.moveTo(80, y0 + 230); x.lineTo(430, y0 + 230); x.lineTo(250, y0 + 20); x.closePath(); x.stroke(); }
  if (tur === "yanlis") { x.strokeStyle = "#a8372a"; x.lineWidth = 4; [0, 1, 2].forEach(i => { x.beginPath(); x.moveTo(60, y0 + 30 + i * 70); x.lineTo(90, y0 + 60 + i * 70); x.moveTo(90, y0 + 30 + i * 70); x.lineTo(60, y0 + 60 + i * 70); x.stroke(); x.fillStyle = "#D8D0C2"; x.fillRect(120, y0 + 38 + i * 70, 280, 12); }); }
  if (tur === "son") { x.fillStyle = "#B69A68"; x.fillRect(44, H - 150, 230, 64); x.fillStyle = "#171715"; x.font = `700 26px ${F}`; x.fillText("Devam et", 92, H - 108); }
  x.strokeStyle = "rgba(13,27,51,.12)"; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2);
}


/* Yolculuğun son sayfası: çalışma ekranının başlığıyla aynı yazı. Kamera yaklaşınca gerçek arayüze dönüşür. */
/* Son sayfa: gerçek uygulamanın ilk açılış ekranı (üst çubuk + "Seni tanıyalım" kartı + "Bugünün programı").
   Renkler, yazı tipi ve metinler gerçek arayüzle aynıdır; uydurma sayı yok. İlerleme: orman yeşili. */
const ESIK_K = "M6 60V32A26 26 0 0 1 32 6H58V60z M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z";
function yk(x, X, Y, W, H, R) { x.beginPath(); x.roundRect ? x.roundRect(X, Y, W, H, R) : x.rect(X, Y, W, H); }
export function sonSayfaCiz(c, fontHazir) {
  const x = c.getContext("2d"), W = c.width, H = c.height, F = fontHazir ? '"AKE Sans"' : "system-ui,sans-serif";
  x.fillStyle = "#F5F1E8"; x.fillRect(0, 0, W, H);
  /* üst çubuk */
  x.fillStyle = "#FBF8F1"; x.fillRect(0, 0, W, 76); x.fillStyle = "#E6DFD1"; x.fillRect(0, 76, W, 2);
  yk(x, 28, 18, 40, 40, 11); x.fillStyle = "#171715"; x.fill();
  x.save(); x.translate(28 + 20 - 32 * .44, 18 + 20 - 33 * .44); x.scale(.44, .44); x.fillStyle = "#B69A68"; x.fill(new Path2D(ESIK_K), "evenodd"); x.restore();
  x.fillStyle = "#1C1B18"; x.textBaseline = "alphabetic"; x.font = `700 26px ${F}`; x.fillText("AKE", 78, 48); const wA = x.measureText("AKE ").width;
  x.font = `500 26px ${F}`; x.fillText("Akademi", 78 + wA, 48);
  /* kart: Seni tanıyalım */
  const X0 = 28, CW = W - 56; yk(x, X0, 108, CW, 360, 14); x.fillStyle = "#FBF8F1"; x.fill(); x.strokeStyle = "#D8D0C2"; x.lineWidth = 2; x.stroke();
  x.fillStyle = "#1C1B18"; x.font = `700 30px ${F}`; x.fillText("Seni tanıyalım", X0 + 24, 166);
  [[0, "#254236"], [1, "#E6DFD1"], [2, "#E6DFD1"]].forEach(([i, col]) => { yk(x, X0 + CW - 24 - 3 * 34 + i * 36, 150, 30, 7, 4); x.fillStyle = col; x.fill(); });
  x.fillStyle = "#4B483F"; x.font = `700 17px ${F}`; x.fillText("Adın", X0 + 24, 212);
  yk(x, X0 + 24, 226, CW - 48, 56, 10); x.strokeStyle = "#D8D0C2"; x.stroke(); x.fillStyle = "#66625A"; x.font = `400 21px ${F}`; x.fillText("Adını yaz", X0 + 40, 262);
  x.fillStyle = "#1C1B18"; x.font = `500 22px ${F}`; x.fillText("Alanın", X0 + 24, 322);
  let px = X0 + 24, py = 340; x.font = `700 19px ${F}`;
  [["Sayısal", 1], ["Eşit Ağırlık", 0], ["Sözel", 0]].forEach(([t, on]) => { const w = x.measureText(t).width + 44; yk(x, px, py, w, 46, 23);
    if (on) { x.fillStyle = "#254236"; x.fill(); x.fillStyle = "#F5F1E8"; } else { x.fillStyle = "#FBF8F1"; x.fill(); x.strokeStyle = "#D8D0C2"; x.stroke(); x.fillStyle = "#1C1B18"; }
    x.fillText(t, px + 22, py + 31); px += w + 10; });
  yk(x, X0 + 24, 400, 126, 50, 10); x.fillStyle = "#30302B"; x.fill(); x.fillStyle = "#F5F1E8"; x.font = `700 20px ${F}`; x.fillText("Devam", X0 + 24 + 34, 432);
  /* kart: Bugünün programı */
  yk(x, X0, 492, CW, 260, 14); x.fillStyle = "#FBF8F1"; x.fill(); x.strokeStyle = "#D8D0C2"; x.stroke();
  x.fillStyle = "#1C1B18"; x.font = `700 26px ${F}`; x.fillText("Bugünün programı", X0 + 24, 544);
  x.fillStyle = "#4B483F"; x.font = `500 17px ${F}`; x.textAlign = "right"; x.fillText("0/4 tamam", X0 + CW - 24, 542); x.textAlign = "left";
  yk(x, X0 + 24, 566, CW - 48, 12, 6); x.fillStyle = "#EDE7DA"; x.fill();
}
