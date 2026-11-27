# Şablon çeşitliliği ve çok benzer bulunan sorular

**Şablon** = soru metninde sayılar `#` ile değiştirilince aynı kalan metin. Aynı şablondaki sorular yalnız sayılarda ayrışır. Benzerlik kuralı `fabrika/dogrula.mjs` ile aynıdır: 3-gram Jaccard ≥ 0,8 (aynı şablon grubunda ilk soru tutulur, sonrakiler `tekrar`). Benzerlik yalnız aynı şablon grubu içinde aranmıştır.

## Konu bazında özet

| Konu | Okunan | Şablon | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| Basit Eşitsizlikler | 7358 | 11 | 6110 | 1248 |
| Çarpanlara Ayırma | 175 | 3 | 175 | 0 |
| Kâr Zarar Problemleri | 418 | 3 | 418 | 0 |
| Karışım Problemleri | 1223 | 3 | 777 | 446 |
| Rasyonel Sayılar | 2187 | 3 | 1884 | 303 |
| Sayı Basamakları | 69 | 3 | 69 | 0 |
| Yaş Problemleri | 7289 | 14 | 5780 | 1509 |
| **Toplam** | **18719** | **40** | **15213** | **3506** |

Toplam 40 şablon; "40 kadar" bulgusu bu sayıdır. Yani 18.719 sorunun hepsi 40 cümle kalıbının sayı değişimidir. Aktarılabilir 15213 soru da aynı 40 kalıptan gelir; yalnız birbirine %80'den az benzeyenler tutulmuştur.

## Şablon dökümü (her konu)

### Basit Eşitsizlikler

| # | Şablon (sayılar # ile) | Soru | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| 1 | x bir tam sayı olmak üzere −# < #x − # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır? | 1694 | 1694 | 0 |
| 2 | #x + # < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır? | 1222 | 509 | 713 |
| 3 | #x − # < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır? | 917 | 382 | 535 |
| 4 | x bir tam sayı olmak üzere −# < #x + # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır? | 898 | 898 | 0 |
| 5 | x bir tam sayı olmak üzere # < #x − # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır? | 894 | 894 | 0 |
| 6 | x bir tam sayı olmak üzere # < #x + # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır? | 892 | 892 | 0 |
| 7 | x bir tam sayı olmak üzere −# < #x ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır? | 285 | 285 | 0 |
| 8 | x bir tam sayı olmak üzere |#x − #| ≤ # eşitsizliğini sağlayan kaç farklı x değeri vardır? | 216 | 216 | 0 |
| 9 | x bir tam sayı olmak üzere # < #x ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır? | 179 | 179 | 0 |
| 10 | #x < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır? | 153 | 153 | 0 |
| 11 | x bir tam sayı olmak üzere −# < #x − # ≤ −# eşitsizliğini sağlayan x değerlerinin toplamı kaçtır? | 8 | 8 | 0 |

### Çarpanlara Ayırma

| # | Şablon (sayılar # ile) | Soru | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| 1 | x − y = # ve x + y = # olduğuna göre x² − y² kaçtır? | 90 | 90 | 0 |
| 2 | a + b = # ve a·b = # olduğuna göre a² + b² kaçtır? | 78 | 78 | 0 |
| 3 | x + #/x = # olduğuna göre x³ + #/x³ ifadesinin değeri kaçtır? | 7 | 7 | 0 |

### Kâr Zarar Problemleri

| # | Şablon (sayılar # ile) | Soru | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| 1 | Alış fiyatı # TL olan bir mal %# kârla satılıyor. Malın satış fiyatı kaç TL'dir? | 228 | 228 | 0 |
| 2 | Bir mal %# zararla # TL'ye satılıyor. Malın alış fiyatı kaç TL'dir? | 152 | 152 | 0 |
| 3 | Aynı fiyata, # TL'ye satılan iki maldan biri %# kârla, diğeri %# zararla satılmıştır. Bu satışlardan toplam kaç TL zarar edilmiştir? | 38 | 38 | 0 |

### Karışım Problemleri

| # | Şablon (sayılar # ile) | Soru | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| 1 | Tuz oranı %# olan # g tuzlu suya kaç gram saf su eklenirse tuz oranı %# olur? | 696 | 696 | 0 |
| 2 | Tuz oranı %# olan tuzlu su ile tuz oranı %# olan tuzlu su karıştırılarak tuz oranı %# olan çözelti elde ediliyor. Tuz oranı %# olan çözeltiden # g kullanıldığına göre tuz oranı %# olan çözeltiden kaç gram kullanılmıştır? | 335 | 48 | 287 |
| 3 | Tuz oranı %# olan # g tuzlu su ile tuz oranı %# olan # g tuzlu su karıştırılıyor. Karışımın tuz oranı yüzde kaçtır? | 192 | 33 | 159 |

### Rasyonel Sayılar

| # | Şablon (sayılar # ile) | Soru | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| 1 | Bir yolun #/# kadarı birinci gün, kalan yolun #/# kadarı ikinci gün alınıyor. Geriye # km yol kaldığına göre yolun tamamı kaç km'dir? | 1517 | 1214 | 303 |
| 2 | #/# + #/# işleminin sonucu kaçtır? | 518 | 518 | 0 |
| 3 | Bir sayının #/# kadarı # olduğuna göre bu sayı kaçtır? | 152 | 152 | 0 |

### Sayı Basamakları

| # | Şablon (sayılar # ile) | Soru | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| 1 | Rakamları toplamı # olan iki basamaklı bir doğal sayının rakamlarının yeri değiştirildiğinde elde edilen sayı, ilk sayıdan # eksiktir. Buna göre ilk sayı kaçtır? | 35 | 35 | 0 |
| 2 | Rakamları birbirinden farklı ve rakamları toplamı # olan üç basamaklı en büyük doğal sayı kaçtır? | 22 | 22 | 0 |
| 3 | Rakamları toplamı # olan iki basamaklı kaç tane çift doğal sayı vardır? | 12 | 12 | 0 |

### Yaş Problemleri

| # | Şablon (sayılar # ile) | Soru | Aktarılabilir | Tekrar |
|---|---|---|---|---|
| 1 | İki kardeşin yaşları arasındaki fark #'tür. # yıl önce yaşları toplamı # olduğuna göre büyük kardeş şimdi kaç yaşındadır? | 3308 | 3308 | 0 |
| 2 | # kişilik bir grubun yaş ortalaması #'dir. Bu gruptan bir kişi ayrılınca ortalama # oluyor. Ayrılan kişi kaç yaşındadır? | 856 | 242 | 614 |
| 3 | Bir baba ile oğlu hakkında şu bilgiler veriliyor: # yıl önce babanın yaşı oğlunun yaşının # katıydı. # yıl sonra babanın yaşı oğlunun yaşının # katı olacaktır. Buna göre oğlun bugünkü yaşı kaçtır? | 383 | 75 | 308 |
| 4 | # kişilik bir grubun yaş ortalaması #'dir. Gruptan # yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama # oluyor. Diğer ayrılan kişi kaç yaşındadır? | 369 | 366 | 3 |
| 5 | İki kardeşin yaşları arasındaki fark #'tür. # yıl önce yaşları toplamı # olduğuna göre bugünkü yaşlarının çarpımı kaçtır? | 351 | 351 | 0 |
| 6 | Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının # katıdır. Baba, anneden # yaş büyüktür. Üç kişinin yaşları toplamı # olduğuna göre # yıl sonra anne ile babanın yaşları toplamı kaç olur? | 329 | 115 | 214 |
| 7 | Ayşe, Burak'tan # yaş büyüktür. Burak da Can'dan # yaş büyüktür. Üçünün yaşları toplamı # olduğuna göre Can kaç yaşındadır? | 296 | 296 | 0 |
| 8 | Ali ile babasının yaşları toplamı #, yaşları arasındaki fark # olduğuna göre Ali kaç yaşındadır? | 287 | 287 | 0 |
| 9 | Bir annenin yaşı kızının yaşının # katıdır. # yıl önce ikisinin yaşları toplamı # olduğuna göre annenin bugünkü yaşı kaçtır? | 275 | 275 | 0 |
| 10 | Bir baba ile oğlu hakkında şu bilgiler veriliyor: # yıl önce babanın yaşı oğlunun yaşının # katıydı. # yıl sonra babanın yaşı oğlunun yaşının # katı olacaktır. Buna göre baba ile oğlunun bugünkü yaşları toplamı kaçtır? | 239 | 67 | 172 |
| 11 | Bir anne ile kızının yaşları oranı #/#, yaşları toplamı # olduğuna göre # yıl sonra annenin yaşı kaç olur? | 226 | 226 | 0 |
| 12 | Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının # katıdır. Baba, anneden # yaş büyüktür. Üç kişinin yaşları toplamı # olduğuna göre çocuk kaç yaşındadır? | 216 | 18 | 198 |
| 13 | Bir anne ile kızının yaşları oranı #/#, yaşları toplamı # olduğuna göre kızı kaç yaşındadır? | 112 | 112 | 0 |
| 14 | Bir annenin yaşı kızının yaşının # katıdır. İkisinin yaşları toplamı # olduğuna göre kızı kaç yaşındadır? | 42 | 42 | 0 |

## Çok benzer bulunan (`tekrar`) sorulardan örnekler

Her konudan 2 çift: tutulan soru ve ona çok benzediği için aktarılmayan soru. Fark yalnız sayılardır.

### Basit Eşitsizlikler (1248 tekrar)

- **Tutulan** `py-tyt_matematik-d6034ca1`: 5x + 3 < 33 eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?
- **Aktarılmayan** `py-tyt_matematik-5f9a3f39`: 3x + 3 < 33 eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?

- **Tutulan** `py-tyt_matematik-ce90c31c`: 3x + 7 < 17 eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?
- **Aktarılmayan** `py-tyt_matematik-e14c98ec`: 2x + 7 < 17 eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?

**Çarpanlara Ayırma:** tekrar yok.

**Kâr Zarar Problemleri:** tekrar yok.

### Karışım Problemleri (446 tekrar)

- **Tutulan** `py-tyt_matematik-856b6a57`: Tuz oranı %40 olan tuzlu su ile tuz oranı %20 olan tuzlu su karıştırılarak tuz oranı %35 olan çözelti elde ediliyor. Tuz oranı %20 olan çözeltiden 15 g kullanıldığına göre tuz oranı %40 olan çözeltiden kaç gram kullanılmıştır?
- **Aktarılmayan** `py-tyt_matematik-e3e3bbb1`: Tuz oranı %40 olan tuzlu su ile tuz oranı %20 olan tuzlu su karıştırılarak tuz oranı %35 olan çözelti elde ediliyor. Tuz oranı %20 olan çözeltiden 35 g kullanıldığına göre tuz oranı %40 olan çözeltiden kaç gram kullanılmıştır?

- **Tutulan** `py-tyt_matematik-e4e7e8d6`: Tuz oranı %40 olan tuzlu su ile tuz oranı %15 olan tuzlu su karıştırılarak tuz oranı %30 olan çözelti elde ediliyor. Tuz oranı %15 olan çözeltiden 30 g kullanıldığına göre tuz oranı %40 olan çözeltiden kaç gram kullanılmıştır?
- **Aktarılmayan** `py-tyt_matematik-c4e5ba96`: Tuz oranı %40 olan tuzlu su ile tuz oranı %15 olan tuzlu su karıştırılarak tuz oranı %30 olan çözelti elde ediliyor. Tuz oranı %15 olan çözeltiden 50 g kullanıldığına göre tuz oranı %40 olan çözeltiden kaç gram kullanılmıştır?

### Rasyonel Sayılar (303 tekrar)

- **Tutulan** `py-tyt_matematik-885c7d03`: Bir yolun 3/8 kadarı birinci gün, kalan yolun 5/8 kadarı ikinci gün alınıyor. Geriye 90 km yol kaldığına göre yolun tamamı kaç km'dir?
- **Aktarılmayan** `py-tyt_matematik-e119be03`: Bir yolun 5/8 kadarı birinci gün, kalan yolun 3/8 kadarı ikinci gün alınıyor. Geriye 90 km yol kaldığına göre yolun tamamı kaç km'dir?

- **Tutulan** `py-tyt_matematik-9a961007`: Bir yolun 1/5 kadarı birinci gün, kalan yolun 1/8 kadarı ikinci gün alınıyor. Geriye 28 km yol kaldığına göre yolun tamamı kaç km'dir?
- **Aktarılmayan** `py-tyt_matematik-b578d2e7`: Bir yolun 1/8 kadarı birinci gün, kalan yolun 1/5 kadarı ikinci gün alınıyor. Geriye 28 km yol kaldığına göre yolun tamamı kaç km'dir?

**Sayı Basamakları:** tekrar yok.

### Yaş Problemleri (1509 tekrar)

- **Tutulan** `py-tyt_matematik-3b781c5d`: Bir baba ile oğlu hakkında şu bilgiler veriliyor: 11 yıl önce babanın yaşı oğlunun yaşının 6 katıydı. 13 yıl sonra babanın yaşı oğlunun yaşının 2 katı olacaktır. Buna göre oğlun bugünkü yaşı kaçtır?
- **Aktarılmayan** `py-tyt_matematik-6f837641`: Bir baba ile oğlu hakkında şu bilgiler veriliyor: 11 yıl önce babanın yaşı oğlunun yaşının 6 katıydı. 9 yıl sonra babanın yaşı oğlunun yaşının 2 katı olacaktır. Buna göre oğlun bugünkü yaşı kaçtır?

- **Tutulan** `py-tyt_matematik-22d3f349`: 5 kişilik bir grubun yaş ortalaması 20'dir. Bu gruptan bir kişi ayrılınca ortalama 20 oluyor. Ayrılan kişi kaç yaşındadır?
- **Aktarılmayan** `py-tyt_matematik-2b666c61`: 8 kişilik bir grubun yaş ortalaması 20'dir. Bu gruptan bir kişi ayrılınca ortalama 20 oluyor. Ayrılan kişi kaç yaşındadır?

