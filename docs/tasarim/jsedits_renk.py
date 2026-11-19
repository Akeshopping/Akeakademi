# Renk paletleri, özel renk, şeffaf kartlar, plan yerleşimi, rozet düzeni (uret.py son adımda çalıştırır).
# Bu dosya yalnız görünüm koduna dokunur: ERISIM/erisimKart, vPlan/planBugun, rozetKart. Giriş, kota, soru, API koduna dokunmaz.

# 1) Erken başlık betiği: palet ve şeffaflık ilk boyamadan önce uygulanır (renk titremesi olmaz).
rep('if(f==="l"||f==="xl")d.setAttribute("data-fs",f);}catch(e){}</script>',
    'if(f==="l"||f==="xl")d.setAttribute("data-fs",f);var p=localStorage.getItem("ake.pal");if(p==="zumrut"||p==="lavanta"||p==="bakir")d.setAttribute("data-pal",p);'
    'var sy=localStorage.getItem("ake.saydam"),sv=localStorage.getItem("ake.saydamSv");d.setAttribute("data-saydam",sy==="off"?"off":(sv==="belirgin"?"belirgin":"dengeli"));'
    'var oc=JSON.parse(localStorage.getItem("ake.ozelcss")||"null");if(oc&&oc[t==="dark"?"d":"l"])d.style.cssText+=oc[t==="dark"?"d":"l"];}catch(e){}</script>')

# 2) Durum: palet, şeffaflık, özel renkler
rep('acilis: LS.get("ake.acilis") || "esik" };',
    'acilis: LS.get("ake.acilis") || "esik", pal: LS.get("ake.pal") || "mercan", saydam: LS.get("ake.saydam") === "off" ? "off" : "on", saydamSv: LS.get("ake.saydamSv") === "belirgin" ? "belirgin" : "dengeli" };')

rep('const koyuMu = () => ERISIM.tema === "dark";\n', r'''const koyuMu = () => ERISIM.tema === "dark";
/* ---------- renk paletleri · özel renk · şeffaf kartlar ---------- */
/* lp/dp: açık/koyu sayfa zemini, dc: koyu kart, ik: sabit koyu yüzey (üst çubuk, hero), isik/cizgi: açılış ışığı */
const PALET = {
  mercan: { ad: "Mercan & Mürekkep", ac: "Sıcak ve odaklı (varsayılan)", lp: "#F8F5F0", dp: "#1E1A21", dc: "#28232C", ik: "#28232C", la: "#B73F36", da: "#F27D6D", isik: "#F27D6D", cizgi: "#D94F43" },
  zumrut: { ad: "Zümrüt & Krem", ac: "Sakin ve ferah", lp: "#F6F3EA", dp: "#111D1A", dc: "#1A2924", ik: "#1B2A26", la: "#0F766E", da: "#5CD6C0", isik: "#5CD6C0", cizgi: "#14907F" },
  lavanta: { ad: "Lavanta & Gece", ac: "Yumuşak ve gece odaklı", lp: "#F6F4FB", dp: "#15122A", dc: "#1F1B3A", ik: "#1F1B3A", la: "#5B49B8", da: "#B9ABFF", isik: "#B9ABFF", cizgi: "#7B68D6" },
  bakir: { ad: "Bakır & Kömür", ac: "Sıcak ve ciddi", lp: "#F7F4F0", dp: "#1A1A1A", dc: "#242424", ik: "#242424", la: "#9C4B1F", da: "#F0A573", isik: "#F0A573", cizgi: "#C2642E" }
};
const RENK_ALAN = [["vurgu", "Vurgu rengi", "Düğme, seçili menü, odak halkası, grafik vurgusu"], ["baslik", "Başlık vurgusu", "Küçük üst başlıklar"], ["acilis", "Açılış ışığı", "Açılış animasyonunun ışık ve çizgi rengi"]];
const RENK_ONAY = [["#B73F36", "Mercan"], ["#0F766E", "Zümrüt"], ["#5B49B8", "Lavanta"], ["#9C4B1F", "Bakır"], ["#1D6FA5", "Deniz mavisi"], ["#8A5A00", "Amber"], ["#A23B72", "Gül"], ["#3F6B3A", "Orman"]];
const rkHex = h => { h = String(h || "").trim().replace(/^#/, ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); return /^[0-9a-f]{6}$/i.test(h) ? h.toLowerCase() : null; };
const rkRgb = h => { h = rkHex(h); return h ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : [0, 0, 0]; };
const rkLum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const rkKon = (a, b) => { const x = rkLum(a), y = rkLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const rkStr = c => "#" + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const rkKar = (c, t, k) => c.map((v, i) => v + (t[i] - v) * k);
/* rengi, verilen tüm zeminlere karşı en az `min` kontrasta gelene dek koyulaştırır (yon=0) ya da açar (yon=1) */
function rkGuvenli(c, zeminler, min, yon) {
  const t = yon ? [255, 255, 255] : [0, 0, 0]; let r = c;
  for (let i = 1; i <= 40 && zeminler.some(z => rkKon(r, z) < min); i++) r = rkKar(c, t, i / 40);
  return r;
}
function ozelOku() { try { const o = JSON.parse(LS.get("ake.ozel") || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
/* seçilen renklerin o temaya göre okunaklı karşılıkları (CSS değişkenleri) */
function ozelDeger(o, pk, koyu) {
  const P = PALET[pk] || PALET.mercan, W = [255, 255, 255], v = {};
  const zem = koyu ? [rkRgb(P.dp), rkRgb(P.dc)] : [rkRgb(P.lp), W], ink = [rkRgb(P.ik)], dark = [rkRgb(P.dp)];
  const h = rkHex(o.vurgu);
  if (h) {
    const c = rkRgb(h), ac = koyu ? rkGuvenli(c, zem, 4.5, 1) : rkGuvenli(c, zem, 4.5, 0);
    const hover = koyu ? rkKar(ac, W, .22) : rkKar(ac, [0, 0, 0], .16), deco = koyu ? ac : rkGuvenli(c, zem, 3, 0);
    const isik = rkGuvenli(rkKar(c, W, koyu ? 0 : .45), koyu ? dark : ink, 4.5, 1);
    v["--coral"] = rkStr(ac); v["--coral-hover"] = rkStr(hover); v["--coral-deco"] = rkStr(deco); v["--coral-light"] = rkStr(isik); v["--coral-ink"] = rkStr(ac);
    v["--coral-soft"] = `rgba(${ac.map(Math.round).join(",")},${koyu ? .14 : .1})`;
    v["--on-coral"] = rkKon(ac, W) >= rkKon(ac, [22, 22, 22]) ? "#FFFFFF" : "#161616";
    v["--coral-deco-rgb"] = deco.map(Math.round).join(","); v["--coral-light-rgb"] = isik.map(Math.round).join(",");
  }
  const b = rkHex(o.baslik);
  if (b) { const c = rkRgb(b); v["--baslik"] = rkStr(koyu ? rkGuvenli(c, zem, 4.5, 1) : rkGuvenli(c, zem, 4.5, 0)); v["--baslik-light"] = rkStr(rkGuvenli(c, koyu ? dark : ink, 4.5, 1)); }
  return v;
}
function acilisRengi(o, pk) {
  const P = PALET[pk] || PALET.mercan, a = rkHex(o.acilis);
  if (!a) return { isik: P.isik, cizgi: P.cizgi, ozel: false };
  const c = rkRgb(a), isik = rkStr(rkGuvenli(c, [rkRgb(P.ik)], 4.5, 1));
  return { isik, cizgi: rkStr(rkGuvenli(c, [rkRgb(P.ik)], 3, 1)), ozel: true };
}
function renkUygula() {
  const d = document.documentElement, koyu = d.getAttribute("data-theme") === "dark", pk = PALET[ERISIM.pal] ? ERISIM.pal : "mercan", o = ozelOku();
  if (pk === "mercan") d.removeAttribute("data-pal"); else d.setAttribute("data-pal", pk);
  d.setAttribute("data-saydam", ERISIM.saydam === "off" ? "off" : ERISIM.saydamSv);
  ["--coral", "--coral-hover", "--coral-deco", "--coral-light", "--coral-ink", "--coral-soft", "--on-coral", "--coral-deco-rgb", "--coral-light-rgb", "--baslik", "--baslik-light"].forEach(p => d.style.removeProperty(p));
  const v = ozelDeger(o, pk, koyu); Object.keys(v).forEach(p => d.style.setProperty(p, v[p]));
  const ar = acilisRengi(o, pk); d.style.setProperty("--acilis-isik", ar.isik); d.style.setProperty("--acilis-cizgi", ar.cizgi); d.style.setProperty("--acilis-rgb", rkRgb(ar.isik).join(","));
  /* açılış sahnesi (ayrı sayfa) için: yalnız özel seçildiyse yazılır */
  if (ar.ozel) { LS.set("ake.acilisrenk", ar.isik + "," + ar.cizgi); } else LS.del("ake.acilisrenk");
  const css = k => Object.entries(ozelDeger(o, pk, k)).map(([a, b]) => a + ":" + b + ";").join("");
  if (Object.keys(o).some(k => rkHex(o[k]))) LS.set("ake.ozelcss", JSON.stringify({ l: css(false), d: css(true) })); else LS.del("ake.ozelcss");
}
function renkKaydet(k, hex) {
  const o = ozelOku(); if (hex === null) delete o[k]; else o[k] = hex;
  if (Object.keys(o).length) LS.set("ake.ozel", JSON.stringify(o)); else LS.del("ake.ozel");
  renkUygula();
}
function palKart(k) {
  const P = PALET[k], on = ERISIM.pal === k;
  return `<button type="button" class="pal-kart${on ? " on" : ""}" data-a="erisim" data-k="pal" data-v="${k}" aria-pressed="${on}"><span class="pal-sw" aria-hidden="true"><i style="background:${P.lp}"></i><i style="background:${P.la}"></i><i style="background:${P.dp}"></i><i style="background:${P.da}"></i></span><strong>${P.ad}</strong><small>${P.ac}</small></button>`;
}
function renkBolumu() {
  const o = ozelOku(), P = PALET[ERISIM.pal] || PALET.mercan, acik = !!UI.renkAcik, ozelVar = Object.keys(o).some(k => rkHex(o[k]));
  const satir = ([k, ad, ac]) => {
    const cur = rkHex(o[k]);
    return `<div class="renk-satir"><div><b>${ad}</b><p class="small muted">${ac}</p></div><div class="renk-sec" role="group" aria-label="${ad}">
      <button type="button" class="renk-chip${!cur ? " on" : ""}" data-a="renkSec" data-k="${k}" data-v="pal" aria-pressed="${!cur}">Paletten al</button>
      ${RENK_ONAY.map(([h, n]) => `<button type="button" class="renk-nokta${cur === h.slice(1).toLowerCase() ? " on" : ""}" data-a="renkSec" data-k="${k}" data-v="${h}" style="--c:${h}" aria-label="${n}" title="${n}" aria-pressed="${cur === h.slice(1).toLowerCase()}"></button>`).join("")}
      <label class="renk-ozel${cur && !RENK_ONAY.some(x => x[0].slice(1).toLowerCase() === cur) ? " on" : ""}"><span>Özel</span><input type="color" data-c="renkOzel" data-k="${k}" value="${cur ? "#" + cur : P.la}" aria-label="${ad} için özel renk"><input type="text" class="in" data-c="renkOzel" data-k="${k}" value="${cur ? "#" + cur : ""}" placeholder="#7A3FF2" maxlength="7" inputmode="text" autocomplete="off" aria-label="${ad} onaltılık renk kodu"></label></div></div>`;
  };
  return `<div class="erisim-blok" id="renkler"><h3 class="erisim-bas">Renk paleti</h3>
    <p class="small muted">Seçimin bu cihazda saklanır. Doğru, yanlış ve hata renkleri paletten bağımsız kalır.</p>
    <div class="pal-grid" role="group" aria-label="Renk paleti">${Object.keys(PALET).map(palKart).join("")}</div>
    <div class="row"><button type="button" class="btn sm ghost" data-a="renkAc" aria-expanded="${acik}" aria-controls="renkGel">${acik ? "Gelişmiş renkleri gizle" : "Gelişmiş renkler"}</button>${ERISIM.pal !== "mercan" || ozelVar ? `<button type="button" class="btn sm ghost" data-a="renkSifirla">Varsayılana dön</button>` : ""}</div>
    ${acik ? `<div id="renkGel" class="renk-gel"><p class="small muted">Okunmayacak renkler kendiliğinden daha koyu ya da açık eşdeğeriyle değiştirilir. Soru ve gövde yazısı rengi değişmez.</p>${RENK_ALAN.map(satir).join("")}</div>` : ""}</div>`;
}
function saydamBolumu() {
  const ac = ERISIM.saydam !== "off";
  return `<div class="erisim-blok" id="saydam"><h3 class="erisim-bas">Şeffaf kartlar</h3>
    <div class="erisim-row"><div><b>Şeffaf kartlar</b><p class="small muted">Çalışma planı kartlarında arkadaki ışık hafifçe görünür. Soru çözme ekranı etkilenmez.</p></div>${segSec("saydam", ERISIM.saydam, [["on", "Açık"], ["off", "Kapalı"]])}</div>
    ${ac ? `<div class="erisim-row"><b>Düzey</b>${segSec("saydamSv", ERISIM.saydamSv, [["dengeli", "Dengeli"], ["belirgin", "Belirgin"]])}</div>` : ""}
    <div class="sd-ornek" aria-hidden="true"><span class="sd-isik"></span><span class="sd-isik b"></span><div class="sd-kart"><b>Bugün · Salı</b><span>2/5 görev tamam</span><i></i></div></div></div>`;
}
''')

# 3) Uygulama ve izin verilen değerler
rep('  if (ERISIM.hareket === "off") d.setAttribute("data-motion", "off"); else d.removeAttribute("data-motion");\n',
    '  if (ERISIM.hareket === "off") d.setAttribute("data-motion", "off"); else d.removeAttribute("data-motion");\n  renkUygula();\n')
rep('acilis: ["esik", "iz", "yogunlas", "sayfa"] };',
    'acilis: ["esik", "iz", "yogunlas", "sayfa"], pal: ["mercan", "zumrut", "lavanta", "bakir"], saydam: ["on", "off"], saydamSv: ["dengeli", "belirgin"] };')

# 4) Ayarlar kartı: başlıklar + renk + şeffaflık bölümleri
rep('<h2>Görünüm ve erişilebilirlik</h2>\n    <div class="erisim-row"><b>Tema</b>',
    '<h2>Görünüm ve erişilebilirlik</h2>\n    <h3 class="erisim-bas">Okuma ve tema</h3>\n    <div class="erisim-row"><b>Tema</b>')
rep('    <div class="erisim-row"><b>Animasyonlar</b>${segSec("hareket", ERISIM.hareket, [["on", "Açık"], ["off", "Kapalı"]])}</div>\n',
    '    <div class="erisim-row"><b>Animasyonlar</b>${segSec("hareket", ERISIM.hareket, [["on", "Açık"], ["off", "Kapalı"]])}</div>\n    ${renkBolumu()}${saydamBolumu()}\n    <h3 class="erisim-bas">Açılış</h3>\n')

# 5) Eylemler (OZ_ACT tanımından sonra) ve girdi olayı
rep('/* ===== 9 · Sesli koç: konuşarak sor, cevabı dinle ===== */\n', r'''Object.assign(OZ_ACT, {
  renkAc() { UI.renkAcik = !UI.renkAcik; render(); },
  renkSec(d) { if (d.v === "pal") renkKaydet(d.k, null); else if (rkHex(d.v)) renkKaydet(d.k, "#" + rkHex(d.v)); render(); },
  renkSifirla() { ERISIM.pal = "mercan"; LS.set("ake.pal", "mercan"); LS.del("ake.ozel"); LS.del("ake.ozelcss"); renkUygula(); render(); toast("Renkler varsayılana döndü."); },
  rzHepsi() { UI.rzHepsi = !UI.rzHepsi; render(); }
});
/* ===== 9 · Sesli koç: konuşarak sor, cevabı dinle ===== */
''')
rep('const CHG = {\n', r'''const CHG = {
  renkOzel(el) {
    const h = rkHex(el.value);
    if (!h) { toast("Geçerli bir renk kodu yaz (örnek: #7A3FF2)."); return; }
    const o = ozelOku(); o[el.dataset.k] = "#" + h; LS.set("ake.ozel", JSON.stringify(o)); renkUygula();
    const v = ozelDeger(o, ERISIM.pal, document.documentElement.getAttribute("data-theme") === "dark");
    if (el.dataset.k === "vurgu" && v["--coral"] && v["--coral"] !== "#" + h) toast("Okunaklı olması için rengi biraz ayarladık.");
    render();
  },
''')

# 6) Çalışma planı: bugün + ilerleme + görev ekleme solda, odak odası sağda; hafta altta
rep('''  return `<div class="plan-hero"><section class="card plan-bugun">''', '''  return `<section class="card plan-bugun">''')
rep('''<span>Aşağıdan bir görev ekle ya da haftalık planını oluştur.</span></div>`}</section>${pomoKart()}</div>`;''',
    '''<span>Aşağıdan bir görev ekle ya da haftalık planını oluştur.</span></div>`}</section>`;''')
rep('''  return `<div class="view">
  <div class="vhead"><span class="eyebrow">Haftalık düzen</span><h1>Çalışma planım</h1>''',
    '''  return `<div class="view plan-glass">
  <div class="vhead"><span class="eyebrow">Haftalık düzen</span><h1>Çalışma planım</h1>''')
rep('''  ${planBugun(T, ti)}
  <div class="card plan-ozet">''', '''  <div class="plan-grid"><div class="plan-main">${planBugun(T, ti)}
  <div class="card plan-ozet">''')
rep('''    <button class="btn" style="align-self:flex-start">Ekle</button></form>
  <div class="week">''', '''    <button class="btn" style="align-self:flex-start">Ekle</button></form></div>
  <aside class="plan-side" aria-label="Odak odası">${pomoKart()}</aside></div>
  <div class="week">''')

# 7) Gelişim: veri yokken yalnız birkaç sıradaki hedef; tüm rozetler düğmeyle açılır (rozet mantığı değişmez)
rep('''    <div class="rz-grid">${ROZET.map(r => medal(r, !!S.badges[r.id])).join("")}</div>''',
    '''    ${(() => { const az = !UI.rzHepsi && kaz === 0, lst = az ? ROZET.slice(0, 4) : ROZET; return `${az ? `<p class="small muted" style="margin:0">Sıradaki hedeflerin</p>` : ""}<div class="rz-grid">${lst.map(r => medal(r, !!S.badges[r.id])).join("")}</div>${kaz === 0 || UI.rzHepsi ? `<button type="button" class="btn sm ghost" data-a="rzHepsi" aria-expanded="${!az}">${az ? "Tüm rozetleri gör (" + ROZET.length + ")" : "Yalnız sıradaki hedefleri göster"}</button>` : ""}`; })()}''')
