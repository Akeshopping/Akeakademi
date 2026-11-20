# Tanıtım ilk ekranı: ürün ne yapıyor (somut), gerçek sayılar çağrının yanında, yıldız haritası açıklaması.
# Sayılar atlVeri()'den (V.soru, V.konu) gelir; sabit yazılmaz. Logo, animasyon ve palet değişmez.
rep('''      <p class="atl-lead">Yapay zekâ destekli kişisel öğrenme deneyimiyle sınav hazırlığını bir adım ileri taşı.</p>
      <div class="atl-cta"><a class="atl-b p lg" href="#hesap">Ücretsiz hesap aç</a><button type="button" class="atl-b lg" data-a="atlKes" data-k="nasil">Platformu keşfet</button></div>
      <div class="atl-note"><span>Giriş ücretsiz</span><span>Çözümlü ${fmtN(V.soru)} soru</span><span>${V.konu} konu</span></div>''',
'''      <p class="atl-lead">YKS için çözümlü soru, yanlış defteri ve kişisel plan tek yerde. Konunu seç, çöz, yanlışlarını tekrar et.</p>
      <div class="atl-say" role="list" aria-label="Platformda neler var"><div role="listitem"><b>${fmtN(V.soru)}</b><span>çözümlü soru</span></div><div role="listitem"><b>${V.konu}</b><span>konu</span></div><div role="listitem"><b>${V.reg.length}</b><span>ders grubu</span></div></div>
      <div class="atl-cta"><a class="atl-b p lg" href="#hesap">Ücretsiz hesap aç</a><button type="button" class="atl-b lg" data-a="atlKes" data-k="nasil">Platformu keşfet</button></div>
      <div class="atl-note"><span>Giriş ücretsiz</span></div>''', 1)
rep('''<div class="atl-leg" aria-label="Ders bölgeleri">''', '''<p class="atl-harita-not">Her nokta bir konu, renkler dersleri gösterir. Bir noktaya gelince ya da dokununca konu adı ve soru sayısı açılır.</p>
      <div class="atl-leg" aria-label="Ders bölgeleri">''', 1)
