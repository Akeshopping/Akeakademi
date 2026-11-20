# Varsayılan Eşik açılışı: iframe'li 3B sahne yerine hafif, yerel ve ~3,3 sn'lik K logosu açılışı.
# Marka renkleri aynı; büyütme/kırpma yok (yalnız opaklık + küçük kayma). "Animasyonu geç" ilk andan görünür.
# İlk ziyarette bir kez oynar (ake.esik); tekrar gelen beklemez. Azaltılmış hareket/animasyon kapalıysa oynamaz.
# Perde tıklamayı tutmaz: sayfadaki herhangi bir dokunuş/tuş açılışı hemen kapatır, Giriş yap / Ücretsiz hesap aç gecikmez.
rep('function atl3dAcilis() {', r'''/* Eşik açılışı: "Bir sorudan bir yola" (~2,4 sn). Işık noktası → farklı yönlere ince çizgiler → tek yol = gerçek K amblem → sitedeki logoya oturur. */
function akeEsikAcilis(zorla) {
  window.__atl3d = 1;
  const pre = () => { try { document.documentElement.classList.remove("ake-pre"); } catch (e) { } };
  if (document.getElementById("atlIntro")) { pre(); return true; }
  let goruldu = false; try { goruldu = !!LS.get("ake.esik"); LS.set("ake.esik", "1"); } catch (e) { }
  if (goruldu && !zorla) { pre(); return true; }
  const az = atlHareketAz();
  const dusuk = !az && ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2);
  const K = "M6 60V32A26 26 0 0 1 32 6H58V60z M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z";
  const ARA = ["M6 60C-6 54 -20 46 -34 48", "M6 60C0 72 -2 86 -14 96", "M6 60C10 44 0 24 -10 6", "M6 60C26 64 50 74 74 76", "M6 60C22 46 44 38 70 24"];
  const ov = document.createElement("div"); ov.id = "atlIntro"; ov.className = "ake-yol" + (az ? " az" : "") + (dusuk ? " dusuk" : "");
  ov.setAttribute("role", "status"); ov.setAttribute("aria-label", "AKE Akademi açılışı");
  const fond = document.createElement("div"); fond.className = "ake-yol-fond"; fond.setAttribute("aria-hidden", "true");
  ov.innerHTML = `<svg class="ake-yol-svg" viewBox="-64 -64 192 192" aria-hidden="true"><defs><linearGradient id="akeYolG" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="60"><stop offset="0" style="stop-color:var(--logo-a,#F27D6D)"/><stop offset="1" style="stop-color:var(--logo-b,#B73F36)"/></linearGradient>
      <radialGradient id="akeYolI"><stop offset="0" stop-color="#F8F5F0" stop-opacity=".55"/><stop offset="1" stop-color="#F8F5F0" stop-opacity="0"/></radialGradient></defs>
      <g class="ake-yol-aralar">${ARA.map((d, i) => `<path class="ake-yol-ara" style="--d:${i * .04}s" d="${d}" pathLength="100"/>`).join("")}</g>
      <circle class="ake-yol-isik" cx="6" cy="60" r="10" fill="url(#akeYolI)"/><circle class="ake-yol-nokta" cx="6" cy="60" r="1.5"/>
      <path class="ake-yol-yol" d="${K}" pathLength="100" fill="none"/>
      <path class="ake-yol-dolgu" d="${K}" fill="url(#akeYolG)" fill-rule="evenodd"/></svg>
    <button type="button" class="ake-yol-atla">Animasyonu geç</button>`;
  const svg = ov.querySelector(".ake-yol-svg");
  let bitti = false, gecti = false, zt = 0, zg = 0, zs = 0;
  const logoGoster = () => { try { document.documentElement.classList.remove("ake-yol-on"); } catch (e) { } };
  const temizle = () => { clearTimeout(zt); clearTimeout(zg); clearTimeout(zs); document.removeEventListener("keydown", kd); document.removeEventListener("pointerdown", pd, true); window.removeEventListener("hashchange", son); logoGoster(); ov.remove(); fond.remove(); };
  const gec = hizli => {
    if (gecti) return; gecti = true; clearTimeout(zg);
    try {
      const logoEl = document.querySelector(".brand .logo-tile"), r = logoEl && logoEl.getBoundingClientRect(), k = svg.getBoundingClientRect();
      if (!az && r && r.width > 4 && k.width > 4) { const s = r.width / (k.width / 3); svg.style.transform = `translate(${r.left + r.width / 2 - (k.left + k.width / 2)}px,${r.top + r.height / 2 - (k.top + k.height / 2)}px) scale(${s})`; }
    } catch (e) { }
    ov.classList.add("gec"); fond.classList.add("gec"); if (hizli) { ov.classList.add("hizli"); fond.classList.add("hizli"); }
    clearTimeout(zs); zs = setTimeout(temizle, hizli ? 260 : 420);
  };
  const son = () => { if (bitti) return; bitti = true; gec(true); };
  const kd = () => son(), pd = () => son();
  try {
    document.body.appendChild(fond); document.body.appendChild(ov); pre();
    document.documentElement.classList.add("ake-yol-on");
    ov.querySelector(".ake-yol-atla").addEventListener("click", son);
    ov.akeGec = () => { bitti = true; gec(false); }; /* yalnız ölçüm/kayıt betikleri için */
    document.addEventListener("keydown", kd); document.addEventListener("pointerdown", pd, true); window.addEventListener("hashchange", son);
    zg = setTimeout(() => { bitti = true; gec(false); }, az ? 600 : dusuk ? 1500 : 2000);
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
