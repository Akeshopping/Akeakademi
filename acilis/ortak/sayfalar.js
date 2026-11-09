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
export function sonSayfaCiz(c, fontHazir) {
  const x = c.getContext("2d"), W = c.width, H = c.height, F = fontHazir ? '"AKE Sans"' : "system-ui,sans-serif";
  x.fillStyle = "#F5F1E8"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#6F5A2F"; x.font = `700 22px ${F}`; x.fillText("BUGÜN", 52, 92);
  x.fillStyle = "#1c1b18"; x.font = `700 54px ${F}`;
  ["Bugün 40 soru", "hedefin var.", "26'sını çözdün."].forEach((t, i) => x.fillText(t, 52, 190 + i * 70));
  x.fillStyle = "#D8D0C2"; x.fillRect(52, 440, 408, 14); x.fillStyle = "#1c1b18"; x.fillRect(52, 440, 408 * .65, 14);
  x.fillStyle = "#4b483f"; x.font = `400 26px ${F}`; x.fillText("26 / 40 soru", 52, 500);
  x.fillStyle = "#B69A68"; x.beginPath(); x.roundRect ? x.roundRect(52, 560, 250, 70, 14) : x.rect(52, 560, 250, 70); x.fill();
  x.fillStyle = "#171715"; x.font = `700 27px ${F}`; x.fillText("Devam et", 112, 604);
}
