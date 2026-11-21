# Varsayılan Eşik açılışı: iframe'li 3B sahne yerine hafif, yerel ve ~3,3 sn'lik K logosu açılışı.
# Marka renkleri aynı; büyütme/kırpma yok (yalnız opaklık + küçük kayma). "Animasyonu geç" ilk andan görünür.
# İlk ziyarette bir kez oynar (ake.esik); tekrar gelen beklemez. Azaltılmış hareket/animasyon kapalıysa oynamaz.
# Perde tıklamayı tutmaz: sayfadaki herhangi bir dokunuş/tuş açılışı hemen kapatır, Giriş yap / Ücretsiz hesap aç gecikmez.
rep('function atl3dAcilis() {', r'''/* Eşik açılışı "Bir sorudan bir yola" (~2,4 sn): konu haritasının dili (nokta + ince bağlantı); 3 yol, biri K hattına dönüşür; amblem üst çubuktaki logoya tek hareketle oturur. */
function akeEsikAcilis(zorla) {
  window.__atl3d = 1;
  const pre = () => { try { document.documentElement.classList.remove("ake-pre"); } catch (e) { } };
  if (document.getElementById("atlIntro")) { pre(); return true; }
  let goruldu = false; try { goruldu = !!LS.get("ake.esik"); LS.set("ake.esik", "1"); } catch (e) { }
  if ((goruldu && !zorla) || atlHareketAz()) { pre(); return true; }   /* hareketi azalt: açılış yok, tanıtım doğrudan */
  const dusuk = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
  const K = "M6 60V32A26 26 0 0 1 32 6H58V60z M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z";
  const KD = "M6 60V32A26 26 0 0 1 32 6H58V60z", KG = "M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z";   /* dış hat ve harf ayrı çizilir (SVG her alt yolda çizgi desenini yeniden başlatır) */
  let p0 = 66; try { const a = document.createElementNS("http://www.w3.org/2000/svg", "path"), b = a.cloneNode(); a.setAttribute("d", KD); b.setAttribute("d", "M6 60V32A26 26 0 0 1 32 6"); p0 = 100 - 100 * b.getTotalLength() / a.getTotalLength(); } catch (e) { }
  const nd = (x, y, t) => `<circle class="nd" cx="${x}" cy="${y}" r="1.15" style="--t:${t}s"/>`, rg = (x, y, t) => `<circle class="nr" cx="${x}" cy="${y}" r="3.2" style="--t:${t}s"/>`;
  const ov = document.createElement("div"); ov.id = "atlIntro"; ov.className = "ake-yol" + (dusuk ? " dusuk" : "");
  ov.setAttribute("role", "status"); ov.setAttribute("aria-label", "AKE Akademi açılışı");
  const fond = document.createElement("div"); fond.className = "ake-yol-fond"; fond.setAttribute("aria-hidden", "true");
  ov.innerHTML = `<svg class="ake-yol-svg" viewBox="-64 -64 192 192" aria-hidden="true"><defs><linearGradient id="akeYolG" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="60"><stop offset="0" style="stop-color:var(--logo-a,#F27D6D)"/><stop offset="1" style="stop-color:var(--logo-b,#B73F36)"/></linearGradient></defs>
      <g class="alt"><path class="br" d="M6 60L-8 49L-30 52" pathLength="100"/>${nd(-8, 49, .5)}${nd(-30, 52, .85)}${rg(-30, 52, .85)}
        <path class="br" d="M6 60L20 76L50 72" pathLength="100" style="--d:.06s"/>${nd(20, 76, .52)}${nd(50, 72, .9)}${rg(50, 72, .9)}</g>
      <g class="sec">${nd(6, 32, .55)}${nd(32, 6, .88)}${rg(32, 6, .88)}</g>
      <path class="ake-yol-yol" d="${KD}" pathLength="100" fill="none" style="--p0:${p0.toFixed(2)}"/><path class="ake-yol-harf" d="${KG}" pathLength="100" fill="none"/>
      <path class="ake-yol-dolgu" d="${K}" fill="url(#akeYolG)" fill-rule="evenodd"/>
      <g class="org"><circle class="org-r" cx="6" cy="60" r="5"/><circle class="org-d" cx="6" cy="60" r="1.8"/></g></svg>
    <a class="ake-yol-giris" href="#hesap">Giriş yap</a><button type="button" class="ake-yol-atla">Animasyonu geç</button>`;
  const svg = ov.querySelector(".ake-yol-svg");
  let bitti = false, gecti = false, zt = 0, zg = 0, zs = 0, zw = 0;
  const logoGoster = () => { try { document.documentElement.classList.remove("ake-yol-on"); } catch (e) { } };
  const temizle = () => { clearTimeout(zt); clearTimeout(zg); clearTimeout(zs); clearTimeout(zw); document.removeEventListener("keydown", kd); document.removeEventListener("pointerdown", pd, true); window.removeEventListener("hashchange", son); logoGoster(); ov.remove(); fond.remove(); };
  /* geçiş sırası: (1) amblem koyu zeminde logonun yerine uçar, (2) iner inmez gerçek logo aynı yerde açılır ve zemin çekilir (amblem son kareye kadar yerinde kalır, boşluk olmaz); tanıtım ancak bundan sonra görünür */
  const gec = hizli => {
    if (gecti) return; gecti = true; clearTimeout(zg);
    const ucus = hizli ? 180 : 380, cek = hizli ? 150 : 230;
    try {
      const logoEl = document.querySelector(".brand .logo-tile"), r = logoEl && logoEl.getBoundingClientRect(), k = svg.getBoundingClientRect();
      if (r && r.width > 4 && k.width > 4) { const s = r.width / (k.width / 3); svg.style.transitionDuration = ucus + "ms"; svg.style.transform = `translate(${r.left + r.width / 2 - (k.left + k.width / 2)}px,${r.top + r.height / 2 - (k.top + k.height / 2)}px) scale(${s})`; }
    } catch (e) { }
    ov.classList.add("gec");
    clearTimeout(zw); zw = setTimeout(() => { logoGoster(); fond.style.transitionDuration = cek + "ms"; fond.classList.add("ac"); }, ucus - 20);
    clearTimeout(zs); zs = setTimeout(temizle, ucus - 20 + cek + 30);
  };
  const son = () => { if (bitti) return; bitti = true; gec(true); };
  const kd = () => son(), pd = () => son();
  try {
    document.body.appendChild(fond); document.body.appendChild(ov); pre();
    document.documentElement.classList.add("ake-yol-on");
    ov.querySelector(".ake-yol-atla").addEventListener("click", son);
    ov.akeGec = () => { bitti = true; gec(false); }; /* yalnız ölçüm/kayıt betikleri için */
    document.addEventListener("keydown", kd); document.addEventListener("pointerdown", pd, true); window.addEventListener("hashchange", son);
    zg = setTimeout(() => { bitti = true; gec(false); }, dusuk ? 1400 : 1800);
    zt = setTimeout(temizle, 2500);
  } catch (e) { temizle(); pre(); }
  return true;
}
''' + 'function atl3dAcilis() {', 1)
rep('if (!atlHareketAz() && (zorla || !window.__atl3d) && atl3dAcilis()) return;', 'if (!atlHareketAz() && (zorla || !window.__atl3d) && akeEsikAcilis(zorla)) return;', 1)
rep('if (ERISIM.acilis !== "esik" && akeAlternatifAcilis(ERISIM.acilis)) return; atl3dAcilis(); }', 'if (ERISIM.acilis !== "esik" && akeAlternatifAcilis(ERISIM.acilis)) return; akeEsikAcilis(false); }', 1)
# tekrar ziyarette eski 2B açılışa düşmesin
rep('akeEsikAcilis(zorla)) return;\n  if (!zorla && atlHareketAz()) return;', 'akeEsikAcilis(zorla)) return;\n  if (!zorla && (window.__atl3d || atlHareketAz())) return;', 1)
# hareketi azalt: açılış tamamen kapanmasın; hareketsiz amblem + opaklık geçişi (akeEsikAcilis içinde "az" kolu)
rep('function atl3dIlk() { if (window.__atl3d || document.getElementById("atlIntro") || atlHareketAz()) return;', 'function atl3dIlk() { if (window.__atl3d || document.getElementById("atlIntro")) return;', 1)
rep('if (!atlHareketAz() && (zorla || !window.__atl3d) && akeEsikAcilis(zorla)) return;', 'if ((zorla || !window.__atl3d) && akeEsikAcilis(zorla)) return;', 1)

# ilk ziyarette sayfa, açılış perdesi gelmeden önce bir kare görünmesin (3 sn güvenlik zamanlayıcısı: açılış hata verse bile site açılır)
rep('<script src="/ayar.js"></script>\n<link rel="stylesheet" href="/acilis/alternatifler.css?v=6">', '<script>(function(){try{if(!localStorage.getItem("ake.esik")&&(localStorage.getItem("ake.acilis")||"esik")==="esik"){var d=document.documentElement;d.classList.add("ake-pre");setTimeout(function(){d.classList.remove("ake-pre")},3000)}}catch(e){}})();</script>\n<style>html.ake-pre{background:#28232C}html.ake-pre #app{visibility:hidden}</style>\n<script src="/ayar.js"></script>\n<link rel="stylesheet" href="/acilis/alternatifler.css?v=6">', 1)
