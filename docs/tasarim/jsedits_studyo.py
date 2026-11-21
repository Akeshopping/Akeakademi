# Stüdyo (mobil/tablet): "Teste başla" yapışkan alt çubukta; ders seçilmeden pasif. Seçim/başlatma mantığı (stBasla) aynı.
rep('''  </div>${ozet}</div>
  </div>`;''', '''  </div>${ozet}</div>
    <div class="sc3-yap" role="region" aria-label="Teste başla"><span class="sc3-yap-o" aria-live="polite">${s ? esc(e + " · " + dn + (t ? " · " + t : "") + " · " + o.n + " soru") : "Önce bir ders seç"}</span><button type="button" class="btn pri" data-a="stBasla"${s ? "" : " disabled"}>Teste başla</button></div>
  </div>`;''', 1)
