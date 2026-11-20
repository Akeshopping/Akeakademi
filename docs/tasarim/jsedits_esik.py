# Varsayılan Eşik açılışı: iframe'li 3B sahne yerine hafif, yerel ve ~3,3 sn'lik K logosu açılışı.
# Marka renkleri aynı; büyütme/kırpma yok (yalnız opaklık + küçük kayma). "Animasyonu geç" ilk andan görünür.
# İlk ziyarette bir kez oynar (ake.esik); tekrar gelen beklemez. Azaltılmış hareket/animasyon kapalıysa oynamaz.
# Perde tıklamayı tutmaz: sayfadaki herhangi bir dokunuş/tuş açılışı hemen kapatır, Giriş yap / Ücretsiz hesap aç gecikmez.
rep('function atl3dAcilis() {', r'''/* Eşik açılışı (yeni): K logosu çizilir, ışık süpürür, derinlik için üç katman; ~3,3 sn */
function akeEsikAcilis(zorla) {
  window.__atl3d = 1;
  if (document.getElementById("atlIntro") || atlHareketAz()) return true;
  let goruldu = false; try { goruldu = !!LS.get("ake.esik"); LS.set("ake.esik", "1"); } catch (e) { }
  if (goruldu && !zorla) return true;
  const K = "M6 60V32A26 26 0 0 1 32 6H58V60z M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z";
  const ov = document.createElement("div"); ov.id = "atlIntro"; ov.className = "ake-esik"; ov.setAttribute("role", "status"); ov.setAttribute("aria-label", "AKE Akademi açılışı");
  ov.innerHTML = `<div class="ake-esik-isik" aria-hidden="true"></div><div class="ake-esik-sahne" aria-hidden="true">
    <svg class="ake-esik-k" viewBox="0 0 64 64"><defs><linearGradient id="akeEsG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F27D6D"/><stop offset="1" stop-color="#B73F36"/></linearGradient>
      <clipPath id="akeEsC"><path d="${K}" fill-rule="evenodd"/></clipPath></defs>
      <path class="ake-esik-g" d="${K}" fill="none" stroke="#F27D6D" stroke-width="1" pathLength="100"/>
      <path class="ake-esik-d" d="${K}" fill="url(#akeEsG)" fill-rule="evenodd"/>
      <g clip-path="url(#akeEsC)"><rect class="ake-esik-s" x="-30" y="-10" width="16" height="90" fill="#F8F5F0" opacity=".55" transform="skewX(-20)"/></g></svg>
    <div class="ake-esik-yazi">AKE <span>Akademi</span></div></div>
    <button type="button" class="ake-esik-atla">Animasyonu geç</button>`;
  document.body.appendChild(ov);
  let bitti = false;
  const kapat = () => { if (bitti) return; bitti = true; clearTimeout(zt); document.removeEventListener("keydown", kd); document.removeEventListener("pointerdown", pd, true); window.removeEventListener("hashchange", kapat); ov.classList.add("out"); setTimeout(() => ov.remove(), 420); };
  const kd = () => kapat(), pd = () => kapat();
  ov.querySelector(".ake-esik-atla").addEventListener("click", kapat);
  document.addEventListener("keydown", kd); document.addEventListener("pointerdown", pd, true); window.addEventListener("hashchange", kapat);
  const zt = setTimeout(kapat, 3300);
  return true;
}
function atl3dAcilis() {''', 1)
rep('if (!atlHareketAz() && (zorla || !window.__atl3d) && atl3dAcilis()) return;', 'if (!atlHareketAz() && (zorla || !window.__atl3d) && akeEsikAcilis(zorla)) return;', 1)
rep('if (ERISIM.acilis !== "esik" && akeAlternatifAcilis(ERISIM.acilis)) return; atl3dAcilis(); }', 'if (ERISIM.acilis !== "esik" && akeAlternatifAcilis(ERISIM.acilis)) return; akeEsikAcilis(false); }', 1)
# tekrar ziyarette eski 2B açılışa düşmesin
rep('akeEsikAcilis(zorla)) return;\n  if (!zorla && atlHareketAz()) return;', 'akeEsikAcilis(zorla)) return;\n  if (!zorla && (window.__atl3d || atlHareketAz())) return;', 1)
