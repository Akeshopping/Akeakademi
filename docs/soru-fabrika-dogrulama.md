# Matematik doğrulaması: bağımsız çözücü nasıl çalışır, neyi kapsar, sınırları

Bu belge soru METNİ içermez. Kod: `fabrika/uretim_py/bagimsiz_cozum.py`. Çalıştırma:
`python3 fabrika/uretim_py/bagimsiz_cozum.py <zip-klasörü> <çıktı.json>` → soru kimliği başına `dogru | yanlis | cozulemedi`.

## Nasıl çalışır
1. Girdi yalnız `onayli.jsonl` içindeki **soru metni (`q`), şıklar (`o`) ve işaretli indeks (`a`)** değeridir. Üretici kodu, `meta`, parametre (`prm`) ve üretimdeki denetçi **kullanılmaz** (dosyalarda bunlar zaten yoktur).
2. Soru metni, bilinen bir cümle kalıbına regex ile eşlenir ve sayılar metinden okunur (`yaş toplamı 99`, `oran 7/4` gibi).
3. Soru, metindeki koşullardan **yeniden çözülür**: tam sayı aralığı taraması (ör. yaş için 0-150, eşitsizlik için −500…500), `Fraction` ile tam kesir aritmetiği (rasyonel, kâr-zarar, karışım), iki bilinmeyenli sistemde tarama (geçmiş-gelecek yaş), sayı basamakları için 10-99 / 100-999 taraması, `x + 1/x = k` için sayısal kök.
4. Tarama ile çözülenlerde **çözüm benzersiz olmalıdır**; benzersiz değilse `cozulemedi` (soru belirsizdir).
5. Şıklar metinden `Fraction` olarak okunur (ondalık virgül, `−`, `%`, `a/b`). Bulunan değer **tam olarak bir şıkla** eşleşmeli ve o şık işaretli şık olmalıdır; aksi `yanlis`.

## Kapsadığı soru türleri (39 çözüm kuralı, 7 konu)
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
3. **Yalnız bilinen kalıplar.** 39 çözüm kuralı dışındaki bir soru doğrulanmaz. Yeni kalıp eklenince çözücüye de yeni kural eklenmelidir.
4. **Tarama aralıkları sınırlıdır** (yaş 0-150, eşitsizlik −500…500). Üretici bu aralıkların içinde kalır; çözücü aralık dışı bir çözüm varsa onu görmez.
5. **Yüksek tekrar.** Doğruluk kanıtı sorular çeşitli olduğu anlamına gelmez; bkz. `soru-fabrika-sablon-ve-benzerlik.md` (18.719 soru = 40 şablon).

## "40 şablon" ile "39 kural" neden farklı? (boşluk var mı?)
İki sayı farklı şeyleri sayar: **şablon** = soru metninde sayılar `#` yapılınca aynı kalan metin (ZIP'te 40 farklı). **Kural** = çözücünün regex + çözüm yöntemi (39 tane). Birebir değiller. Tek tek eşleme (ZIP'teki 18.719 sorunun hepsi bir kurala düştü, hiçbiri iki kurala düşmedi):
- **Fazla şablon (+8):** Eşitsizlik için 2 kural var (`ax±b < c` sayısı ve çift taraflı toplam) ama bunlar işaret farkıyla **10 farklı şablon** üretir (örn. `3x + 7 < 17` ve `3x − 7 < 17` ayrı şablon, `−# < … ≤ #` ve `# < … ≤ #` ayrı şablon). Aynı çözüm kuralı bu 10 şablonu çözer; çözücüde boşluk yok.
- **Eksik şablon (−7):** 37 regex kuralından **7'si ZIP'te hiç soruya rastlamadı** (eski yaş "kaç yıl sonra"; yeni yaş yapılarının her birinin orta (d=2) alt tipi: `baba kaç yaşındadır` (kat), aile `baba`, oran `yaş farkı`, geçmiş-gelecek `babanın yaşı`, ortalama `katılan kişi`, sabit fark `m yıl sonra toplam`).
- Hesap: 39 kural − 7 kullanılmayan = 32 kural ZIP'te iş gördü; bunların 2'si (eşitsizlik) 10 şablon verdi, 30'u birer şablon verdi: 30 + 10 = **40 şablon** (= 32 + 8 fazla). Yani 40 ≠ 39 çelişki değil, sayım birimi farkı.

**Kök neden: doğrulayıcıda değil, üretici CLI'sında hata.** `yks.py` zorluk hedefini *ölçülen* zorluğa göre sayıyordu. Zorluk ölçümü çoğu soruyu "orta" saydığı için, kolay (d=1) turunda üretilen sorular orta hedefini zaten dolduruyor ve orta (d=2) turu hiç soru üretmiyordu. Bu yüzden 7 orta alt tip ZIP'e girmedi ve zorluk dağılımı kaydı (kolay 107 / orta 4.682 / zor 2.500). Düzeltme: hedef üretim zorluğuna (`dUret`) göre sayılır; regresyon testi eklendi (`test_uretim_hedefi_uretim_zorluguna_gore`). Düzeltmeden sonra yaş konusu 10.000'e ulaşıyor (7.289 değil).

**Sonuç:** Çözücüde kapsam boşluğu yok; 7 kuralın gerçek veriyle sınanmamış olması ise bir **sınama boşluğu**: bu 7 kural yalnız birim testlerle (üreticinin örnekleriyle) sınandı, ZIP'teki gerçek sorularla değil. ZIP yeniden üretilirse (konu kararı sonrası) bu kurallar da gerçek veriyle çalışır. **Pilot 40 şablonla sınırlıdır; bu 7 alt tip pilotta yoktur.**


## Bağımsız kalite denetimi (v2, `fabrika/uretim_py/denetim.py`)

Matematik doğru olsa bile soru kötü olabilir. Bu denetim, üretici meta bilgisini kullanmadan yalnız dosyadaki soru/şık/çözüm metnine bakar:

- **gerçeklik:** yaş senaryosu metinden yeniden kurulur (çözücü kayıtları); ebeveyn–çocuk farkı 20–45, ebeveyn ≤ 70, geçmişte sorulan zamanda çocuk ≥ 1, kardeş farkı ≤ 15, tek kişi yaşı 5–90. Aykırıysa **REDDET**.
- **çözüm:** çözüm metnindeki `a = b = c` biçimli işlemler yeniden hesaplanır; `ax − b` için "çıkarılır", `ax + b` için "eklenir" denmesi, gereksiz/çift işaretli parantez yakalanır. **DÜZELT**.
- **metin:** rakamdan sonraki ekler sayının okunuşuna göre denetlenir (3'ya → 3'e, 6'dir → 6'dır); ASCII eksi, boşluk hataları. **DÜZELT**.
- **şık:** beş şık eşit aralıklıysa (sayısal dolgu) veya bir çeldirici cevaptan bariz uzak/ters işaretliyse. **DÜZELT**.

Bulgusu olan soru, cevabı doğru olsa da `inceleme` kuyruğuna gider (`--denetim` zorunlu). Sınır: işlem denetimi yalnız `a = b = c` biçimli sayısal ifadeleri doğrular; anlatımın her cümlesini anlamaz. Üretici tarafında da aynı kurallar uygulanır (yaş gerçekçiliği, ek düzeltici, sayısal dolgu şıkkı en çok 1; fazlasında soru reddedilir).

Eski aday ZIP'e uygulandığında (14.444/18.719 soruda en az bir bulgu) üç bildirilen soru da yakalandı.
