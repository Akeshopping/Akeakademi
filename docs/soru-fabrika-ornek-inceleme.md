# Örnek inceleme raporu (matematik doğrulaması)

Her konudan **tohum 2027** ile rastgele seçilmiş 3 soru (toplam 21). Cevap, üreticiden bağımsız çözücünün (`fabrika/uretim_py/bagimsiz_cozum.py`) YALNIZ soru metninden yeniden hesapladığı değerdir. Bu dosya soru metni içerir ve yalnız inceleme amaçlıdır; tam liste repoya konmaz.

| Konu | Soru kimliği | Cevap | Yükleme kararı |
|---|---|---|---|
| Basit Eşitsizlikler | `py-tyt_matematik-1f2c8fe9` | doğru | tekrar |
| Basit Eşitsizlikler | `py-tyt_matematik-83b319f6` | doğru | tekrar |
| Basit Eşitsizlikler | `py-tyt_matematik-17703b87` | doğru | uygun |
| Çarpanlara Ayırma | `py-tyt_matematik-03d87577` | doğru | uygun |
| Çarpanlara Ayırma | `py-tyt_matematik-f97dd07b` | doğru | uygun |
| Çarpanlara Ayırma | `py-tyt_matematik-7b100460` | doğru | uygun |
| Kâr Zarar Problemleri | `py-tyt_matematik-f868d87c` | doğru | uygun |
| Kâr Zarar Problemleri | `py-tyt_matematik-7ed508b0` | doğru | uygun |
| Kâr Zarar Problemleri | `py-tyt_matematik-c248ea70` | doğru | uygun |
| Karışım Problemleri | `py-tyt_matematik-4c5a3206` | doğru | tekrar |
| Karışım Problemleri | `py-tyt_matematik-a5746ec9` | doğru | uygun |
| Karışım Problemleri | `py-tyt_matematik-4a41b0d3` | doğru | uygun |
| Rasyonel Sayılar | `py-tyt_matematik-a37c24e4` | doğru | uygun |
| Rasyonel Sayılar | `py-tyt_matematik-59f1d65b` | doğru | uygun |
| Rasyonel Sayılar | `py-tyt_matematik-8842f534` | doğru | uygun |
| Sayı Basamakları | `py-tyt_matematik-8e1e57d6` | doğru | uygun |
| Sayı Basamakları | `py-tyt_matematik-2cd07b79` | doğru | uygun |
| Sayı Basamakları | `py-tyt_matematik-a4484903` | doğru | uygun |
| Yaş Problemleri | `py-tyt_matematik-54e98ebc` | doğru | uygun |
| Yaş Problemleri | `py-tyt_matematik-12f3379f` | doğru | uygun |
| Yaş Problemleri | `py-tyt_matematik-477c3fc1` | doğru | uygun |

### Basit Eşitsizlikler · `py-tyt_matematik-1f2c8fe9` · zorluk 1

**Soru:** 4x + 5 < 32 eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?

- A) 2
- B) 3
- C) 4
- D) 5
- E) 6  ← işaretli

**Bağımsız hesaplanan cevap:** 6 → şık E · işaretli E

**Kayıtlı çözüm:** Eşitsizlik 32 − (5) = 27 değeriyle düzenlenince 4x < 27 olur. Bu eşitsizliği sağlayan pozitif tam sayılar 1'den 6'e kadardır, yani 6 tanedir. Doğru cevap E şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `tekrar` (çok benzer (3-gram Jaccard ≥ 0.8): py-tyt_matematik-3a8b371e)

### Basit Eşitsizlikler · `py-tyt_matematik-83b319f6` · zorluk 1

**Soru:** 4x − 6 < 27 eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?

- A) 8  ← işaretli
- B) 9
- C) 10
- D) 11
- E) 12

**Bağımsız hesaplanan cevap:** 8 → şık A · işaretli A

**Kayıtlı çözüm:** Eşitsizlik 27 − (−6) = 33 değeriyle düzenlenince 4x < 33 olur. Bu eşitsizliği sağlayan pozitif tam sayılar 1'den 8'e kadardır, yani 8 tanedir. Doğru cevap A şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `tekrar` (çok benzer (3-gram Jaccard ≥ 0.8): py-tyt_matematik-dc33e527)

### Basit Eşitsizlikler · `py-tyt_matematik-17703b87` · zorluk 2

**Soru:** x bir tam sayı olmak üzere −4 < 4x + 2 ≤ 7 eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?

- A) 0  ← işaretli
- B) 1
- C) 2
- D) 3
- E) 4

**Bağımsız hesaplanan cevap:** 0 → şık A · işaretli A

**Kayıtlı çözüm:** Her yandan 2 çıkarılıp 4'ya bölününce x'in aralığı bulunur. Bu aralıktaki tam sayılar −1, 0, 1 olur. Toplamları 0'dir. Doğru cevap A şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Çarpanlara Ayırma · `py-tyt_matematik-03d87577` · zorluk 2

**Soru:** a + b = 11 ve a·b = 18 olduğuna göre a² + b² kaçtır?

- A) 36
- B) 65
- C) 83
- D) 85  ← işaretli
- E) 87

**Bağımsız hesaplanan cevap:** 85 → şık D · işaretli D

**Kayıtlı çözüm:** (a + b)² = a² + 2ab + b² olduğundan a² + b² = 11² − 2·18 = 85 bulunur. Doğru cevap D şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Çarpanlara Ayırma · `py-tyt_matematik-f97dd07b` · zorluk 1

**Soru:** x − y = 3 ve x + y = 9 olduğuna göre x² − y² kaçtır?

- A) 6
- B) 12
- C) 24
- D) 27  ← işaretli
- E) 33

**Bağımsız hesaplanan cevap:** 27 → şık D · işaretli D

**Kayıtlı çözüm:** x² − y² = (x − y)(x + y) özdeşliği kullanılır. 3·9 = 27 bulunur. Doğru cevap D şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Çarpanlara Ayırma · `py-tyt_matematik-7b100460` · zorluk 1

**Soru:** x − y = 2 ve x + y = 18 olduğuna göre x² − y² kaçtır?

- A) 20
- B) 28
- C) 36  ← işaretli
- D) 40
- E) 46

**Bağımsız hesaplanan cevap:** 36 → şık C · işaretli C

**Kayıtlı çözüm:** x² − y² = (x − y)(x + y) özdeşliği kullanılır. 2·18 = 36 bulunur. Doğru cevap C şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Kâr Zarar Problemleri · `py-tyt_matematik-f868d87c` · zorluk 1

**Soru:** Alış fiyatı 200 TL olan bir mal %20 kârla satılıyor. Malın satış fiyatı kaç TL'dir?

- A) 40
- B) 160
- C) 220
- D) 240  ← işaretli
- E) 260

**Bağımsız hesaplanan cevap:** 240 → şık D · işaretli D

**Kayıtlı çözüm:** Kâr 200·20/100 = 40 TL olur. Satış fiyatı 200 + 40 = 240 TL bulunur. Doğru cevap D şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Kâr Zarar Problemleri · `py-tyt_matematik-7ed508b0` · zorluk 2

**Soru:** Bir mal %25 zararla 165 TL'ye satılıyor. Malın alış fiyatı kaç TL'dir?

- A) 175
- B) 190
- C) 200
- D) 220  ← işaretli
- E) 240

**Bağımsız hesaplanan cevap:** 220 → şık D · işaretli D

**Kayıtlı çözüm:** Alış fiyatı x ise x·(100 − 25)/100 = 165 olur. Buradan x = 165·100/75 = 220 TL bulunur. Zarar yüzdesini satış fiyatına uygulamak yanlıştır. Doğru cevap D şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Kâr Zarar Problemleri · `py-tyt_matematik-c248ea70` · zorluk 1

**Soru:** Alış fiyatı 160 TL olan bir mal %20 kârla satılıyor. Malın satış fiyatı kaç TL'dir?

- A) 180
- B) 192  ← işaretli
- C) 212
- D) 224
- E) 384

**Bağımsız hesaplanan cevap:** 192 → şık B · işaretli B

**Kayıtlı çözüm:** Kâr 160·20/100 = 32 TL olur. Satış fiyatı 160 + 32 = 192 TL bulunur. Doğru cevap B şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Karışım Problemleri · `py-tyt_matematik-4c5a3206` · zorluk 2

**Soru:** Tuz oranı %10 olan 400 g tuzlu su ile tuz oranı %20 olan 400 g tuzlu su karıştırılıyor. Karışımın tuz oranı yüzde kaçtır?

- A) %10
- B) %11
- C) %13
- D) %15  ← işaretli
- E) %17

**Bağımsız hesaplanan cevap:** 15 → şık D · işaretli D

**Kayıtlı çözüm:** Birinci çözeltideki tuz 400·10/100 = 40 g, ikincideki tuz 400·20/100 = 80 g olur. Toplam tuz 120 g, toplam çözelti 800 g olduğundan oran %15 bulunur. Doğru cevap D şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `tekrar` (çok benzer (3-gram Jaccard ≥ 0.8): py-tyt_matematik-a52f97a4)

### Karışım Problemleri · `py-tyt_matematik-a5746ec9` · zorluk 3

**Soru:** Tuz oranı %60 olan 460 g tuzlu suya kaç gram saf su eklenirse tuz oranı %15 olur?

- A) 207
- B) 1360
- C) 1380  ← işaretli
- D) 1400
- E) 1420

**Bağımsız hesaplanan cevap:** 1380 → şık C · işaretli C

**Kayıtlı çözüm:** Başlangıçtaki tuz 460·60/100 g'dır. Su eklenince tuz miktarı değişmez. 460·60/100 = (460 + x)·15/100 denkleminden x = 1380 g bulunur. Doğru cevap C şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Karışım Problemleri · `py-tyt_matematik-4a41b0d3` · zorluk 3

**Soru:** Tuz oranı %100 olan 560 g tuzlu suya kaç gram saf su eklenirse tuz oranı %25 olur?

- A) 1660
- B) 1680  ← işaretli
- C) 1700
- D) 1720
- E) 2240

**Bağımsız hesaplanan cevap:** 1680 → şık B · işaretli B

**Kayıtlı çözüm:** Başlangıçtaki tuz 560·100/100 g'dır. Su eklenince tuz miktarı değişmez. 560·100/100 = (560 + x)·25/100 denkleminden x = 1680 g bulunur. Doğru cevap B şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Rasyonel Sayılar · `py-tyt_matematik-a37c24e4` · zorluk 3

**Soru:** Bir yolun 1/5 kadarı birinci gün, kalan yolun 5/6 kadarı ikinci gün alınıyor. Geriye 8 km yol kaldığına göre yolun tamamı kaç km'dir?

- A) 60  ← işaretli
- B) 70
- C) 80
- D) 88
- E) 90

**Bağımsız hesaplanan cevap:** 60 → şık A · işaretli A

**Kayıtlı çözüm:** Birinci günden sonra yolun 4/5 kadarı kalır. İkinci günden sonra kalanın 1/6 kadarı, yani yolun 4/5·1/6 kadarı kalır. Bu miktar 8 km olduğundan yol 8·30/(4·1) = 60 km'dir. Doğru cevap A şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Rasyonel Sayılar · `py-tyt_matematik-59f1d65b` · zorluk 3

**Soru:** Bir yolun 3/5 kadarı birinci gün, kalan yolun 2/3 kadarı ikinci gün alınıyor. Geriye 2 km yol kaldığına göre yolun tamamı kaç km'dir?

- A) 15  ← işaretli
- B) 16
- C) 17
- D) 19
- E) 30

**Bağımsız hesaplanan cevap:** 15 → şık A · işaretli A

**Kayıtlı çözüm:** Birinci günden sonra yolun 2/5 kadarı kalır. İkinci günden sonra kalanın 1/3 kadarı, yani yolun 2/5·1/3 kadarı kalır. Bu miktar 2 km olduğundan yol 2·15/(2·1) = 15 km'dir. Doğru cevap A şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Rasyonel Sayılar · `py-tyt_matematik-8842f534` · zorluk 3

**Soru:** Bir yolun 1/4 kadarı birinci gün, kalan yolun 7/8 kadarı ikinci gün alınıyor. Geriye 24 km yol kaldığına göre yolun tamamı kaç km'dir?

- A) 176
- B) 224
- C) 232
- D) 256  ← işaretli
- E) 288

**Bağımsız hesaplanan cevap:** 256 → şık D · işaretli D

**Kayıtlı çözüm:** Birinci günden sonra yolun 3/4 kadarı kalır. İkinci günden sonra kalanın 1/8 kadarı, yani yolun 3/4·1/8 kadarı kalır. Bu miktar 24 km olduğundan yol 24·32/(3·1) = 256 km'dir. Doğru cevap D şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Sayı Basamakları · `py-tyt_matematik-8e1e57d6` · zorluk 3

**Soru:** Rakamları toplamı 15 olan iki basamaklı kaç tane çift doğal sayı vardır?

- A) 1
- B) 2  ← işaretli
- C) 3
- D) 4
- E) 5

**Bağımsız hesaplanan cevap:** 2 → şık B · işaretli B

**Kayıtlı çözüm:** Onlar basamağı a ise birler basamağı 15 − a olur. Birler basamağı çift ve 0-9 arasında olmalıdır. Bu şartı sağlayan 2 sayı vardır. Doğru cevap B şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Sayı Basamakları · `py-tyt_matematik-2cd07b79` · zorluk 3

**Soru:** Rakamları toplamı 4 olan iki basamaklı kaç tane çift doğal sayı vardır?

- A) 2  ← işaretli
- B) 3
- C) 4
- D) 5
- E) 6

**Bağımsız hesaplanan cevap:** 2 → şık A · işaretli A

**Kayıtlı çözüm:** Onlar basamağı a ise birler basamağı 4 − a olur. Birler basamağı çift ve 0-9 arasında olmalıdır. Bu şartı sağlayan 2 sayı vardır. Doğru cevap A şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Sayı Basamakları · `py-tyt_matematik-a4484903` · zorluk 3

**Soru:** Rakamları birbirinden farklı ve rakamları toplamı 23 olan üç basamaklı en büyük doğal sayı kaçtır?

- A) 689
- B) 786
- C) 896
- D) 977
- E) 986  ← işaretli

**Bağımsız hesaplanan cevap:** 986 → şık E · işaretli E

**Kayıtlı çözüm:** En büyük sayı için yüzler basamağı mümkün olduğunca büyük, sonra onlar basamağı büyük seçilir; rakamlar farklı kalmalı ve toplam 23 olmalıdır. Bu şartları sağlayan en büyük sayı 986'dur. Doğru cevap E şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Yaş Problemleri · `py-tyt_matematik-54e98ebc` · zorluk 2

**Soru:** İki kardeşin yaşları arasındaki fark 8'tür. 7 yıl önce yaşları toplamı 24 olduğuna göre büyük kardeş şimdi kaç yaşındadır?

- A) 16
- B) 22
- C) 23  ← işaretli
- D) 24
- E) 30

**Bağımsız hesaplanan cevap:** 23 → şık C · işaretli C

**Kayıtlı çözüm:** 7 yıl önce toplam 24 idi, şimdi 24 + 2·7 = 38 olur. Fark 8 olduğundan büyük kardeş (38 + 8)/2 = 23 yaşındadır. Doğru cevap C şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Yaş Problemleri · `py-tyt_matematik-12f3379f` · zorluk 2

**Soru:** İki kardeşin yaşları arasındaki fark 11'tür. 14 yıl önce yaşları toplamı 23 olduğuna göre büyük kardeş şimdi kaç yaşındadır?

- A) 20
- B) 30
- C) 31  ← işaretli
- D) 32
- E) 45

**Bağımsız hesaplanan cevap:** 31 → şık C · işaretli C

**Kayıtlı çözüm:** 14 yıl önce toplam 23 idi, şimdi 23 + 2·14 = 51 olur. Fark 11 olduğundan büyük kardeş (51 + 11)/2 = 31 yaşındadır. Doğru cevap C şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`

### Yaş Problemleri · `py-tyt_matematik-477c3fc1` · zorluk 3

**Soru:** Bir baba ile oğlu hakkında şu bilgiler veriliyor: 6 yıl önce babanın yaşı oğlunun yaşının 4 katıydı. 8 yıl sonra babanın yaşı oğlunun yaşının 2 katı olacaktır. Buna göre oğlun bugünkü yaşı kaçtır?

- A) 7
- B) 9
- C) 11
- D) 12
- E) 13  ← işaretli

**Bağımsız hesaplanan cevap:** 13 → şık E · işaretli E

**Kayıtlı çözüm:** y − 6 = 4(x − 6) ve y + 8 = 2(x + 8) denklemleri çözülünce oğul x = 13, baba y = 34 bulunur. Doğru cevap E şıkkıdır.

**Karar:** cevap doğru; yükleme sonucu `uygun`
