/* Açılış sahnelerinin renkleri: Ayarlar'daki palet ve özel "Açılış ışığı" seçimi (localStorage, aynı site).
   Hiçbir şey seçilmediyse varsayılan Mercan & Mürekkep değerleri kalır. */
(function () {
  var P = {
    mercan: ["#F27D6D", "#D94F43", "#FAD6D0"], zumrut: ["#5CD6C0", "#14907F", "#CFF3EA"],
    lavanta: ["#B9ABFF", "#7B68D6", "#E4DEFF"], bakir: ["#F0A573", "#C2642E", "#F8DCC8"]
  };
  var r = P.mercan;
  try {
    var k = localStorage.getItem("ake.pal"); if (P[k]) r = P[k];
    var o = (localStorage.getItem("ake.acilisrenk") || "").split(",");
    if (/^#[0-9a-f]{6}$/i.test(o[0]) && /^#[0-9a-f]{6}$/i.test(o[1])) {
      var c = [1, 3, 5].map(function (i) { return parseInt(o[0].slice(i, i + 2), 16); });
      var pale = "#" + c.map(function (v) { return ("0" + Math.round(v + (255 - v) * .6).toString(16)).slice(-2); }).join("");
      r = [o[0], o[1], pale];
    }
  } catch (e) { }
  var rgb = [1, 3, 5].map(function (i) { return parseInt(r[0].slice(i, i + 2), 16); }).join(",");
  window.AKE_ACILIS = { isik: r[0], cizgi: r[1], pale: r[2], rgb: rgb };
  var s = document.documentElement.style;
  s.setProperty("--ai", r[0]); s.setProperty("--ac", r[1]); s.setProperty("--ap", r[2]); s.setProperty("--ai-rgb", rgb);
})();
