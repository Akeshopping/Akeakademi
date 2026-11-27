# Matematik doğrulaması: bağımsız çözücü nasıl çalışır, neyi kapsar, sınırları

Bu belge soru METNİ içermez. Kod: `fabrika/uretim_py/bagimsiz_cozum.py`. Çalıştırma:
`python3 fabrika/uretim_py/bagimsiz_cozum.py <zip-klasörü> <çıktı.json>` → soru kimliği başına `dogru | yanlis | cozulemedi`.

## Nasıl çalışır
1. Girdi yalnız `onayli.jsonl` içindeki **soru metni (`q`), şıklar (`o`) ve işaretli indeks (`a`)** değeridir. Üretici kodu, `meta`, parametre (`prm`) ve üretimdeki denetçi **kullanılmaz** (dosyalarda bunlar zaten yoktur).
2. Soru metni, bilinen bir cümle kalıbına regex ile eşlenir ve sayılar metinden okunur (`yaş toplamı 99`, `oran 7/4` gibi).
3. Soru, metindeki koşullardan **yeniden çözülür**: tam sayı aralığı taraması (ör. yaş için 0-150, eşitsizlik için −500…500), `Fraction` ile tam kesir aritmetiği (rasyonel, kâr-zarar, karışım), iki bilinmeyenli sistemde tarama (geçmiş-gelecek yaş), sayı basamakları için 10-99 / 100-999 taraması, `x + 1/x = k` için sayısal kök.
4. Tarama ile çözülenlerde **çözüm benzersiz olmalıdır**; benzersiz değilse `cozulemedi` (soru belirsizdir).
5. Şıklar metinden `Fraction` olarak okunur (ondalık virgül, `−`, `%`, `a/b`). Bulunan değer **tam olarak bir şıkla** eşleşmeli ve o şık işaretli şık olmalıdır; aksi `yanlis`.

## Kapsadığı soru türleri (39 cümle kalıbı, 7 konu)
- **Sayı Basamakları:** yer değiştirmeli iki basamaklı sayı; rakamları farklı en büyük 3 basamaklı sayı; rakam toplamlı çift sayı sayısı.
- **Rasyonel Sayılar:** iki kesrin toplamı; "bir sayının p/q kadarı K"; yolun bölümleri.
- **Basit Eşitsizlikler:** `ax±b < c` pozitif tam sayı sayısı; çift taraflı eşitsizlikte tam sayı toplamı; `|ax−b| ≤ c` tam sayı sayısı.
- **Çarpanlara Ayırma:** `x²−y²`, `a²+b²` (toplam-çarpımdan), `x³+1/x³`.
- **Yaş Problemleri:** 3 eski kalıp + 6 yeni yapı × 3 alt tip (k katı/toplam, aile, oran, geçmiş-gelecek, ortalama, sabit fark).
- **Kâr Zarar:** kârlı satış fiyatı, zararlı satıştan alış fiyatı, iki malda net zarar. **Karışım:** iki çözelti karışımı, su ekleme, hedef yüzdeye göre miktar.

Bilinmeyen bir cümle kalıbı **sessizce geçmez**; `cozulemedi` olarak raporlanır ve ön kontrolde `inceleme` listesine düşer.

## Ne kadar kanıtladı
- 18.719 sorunun **tamamı** `dogru` çıktı (0 `yanlis`, 0 `cozulemedi`).
- Mutasyon denemesi: her konudan rastgele sorularda işaretli cevap bilerek bir şık kaydırıldı: **1.244 / 1.244 bozuk soru yakalandı**. Çözücü "her şeye evet" demiyor.

## Sınırlar (önemli)
1. **Aynı yazar.** Üretici ve bu çözücü aynı oturumda aynı kişi (yapay zekâ) tarafından yazıldı. Kodları ayrı ve üreticiden hiçbir şey içe aktarmıyor, ama bir soruyu **ikisi de aynı şekilde yanlış yorumlarsa** (ör. "kaç yıl önce" ifadesini aynı hatayla okumak) bu ortak hata yakalanmaz. İnsan/öğretmen gözü bu yüzden hâlâ gerekli; örnek rapor (`soru-fabrika-ornek-inceleme.md`) bunun için hazırlandı.
2. **Yalnız sayısal sonuç.** Soru metninin ÖSYM diline uygunluğu, çözüm anlatımının adım adım doğruluğu (yalnız doğru şık harfini ve değerini içerdiği denetlenir), çeldiricilerin gerçekçiliği, zorluk etiketi doğrulanmaz.
3. **Yalnız bilinen kalıplar.** 39 cümle kalıbı dışındaki bir soru doğrulanmaz. Yeni kalıp eklenince çözücüye de yeni kural eklenmelidir.
4. **Tarama aralıkları sınırlıdır** (yaş 0-150, eşitsizlik −500…500). Üretici bu aralıkların içinde kalır; çözücü aralık dışı bir çözüm varsa onu görmez.
5. **Yüksek tekrar.** Doğruluk kanıtı sorular çeşitli olduğu anlamına gelmez; bkz. `soru-fabrika-sablon-ve-benzerlik.md` (18.719 soru = 40 cümle kalıbı).
