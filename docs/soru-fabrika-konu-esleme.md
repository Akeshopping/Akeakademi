# Konu adları: KARAR VERİLDİ, yedi ad ayrı tutulur

Bu belge soru METNİ içermez.

## Karar (PR #45)
Yedi konu adı **ayrı konu olarak** kalır, "Sayılar" veya "Problemler" gibi genel adlara dönüştürülmez: **Sayı Basamakları, Rasyonel Sayılar, Basit Eşitsizlikler, Çarpanlara Ayırma, Yaş Problemleri, Kâr Zarar Problemleri, Karışım Problemleri.** Öğrenci hangi alt konuda çalıştığını görür.

Bu PR'da: aktarım aracı `t` değerini olduğu gibi taşır (eşleme/dönüştürme yok); `KONU_ESLE` tablosuna satır eklenmedi; veritabanına konu eklenmedi (kuyruktaki sorular `bekliyor`, öğrenciye görünmez). Önceki sürümdeki "3 eşleme + 2 yeni" önerisi **geçersizdir**.

## Mevcut konu görünümüne etkisi (kod okumasıyla kontrol edildi)
- Konu listesi `topicsOf(s)` ile **sorulardan dinamik** üretilir ve Türkçe alfabetik sıralanır (`index.html`). Sabit bir konu listesi/sırası yoktur; yeni ad kendiliğinden ayrı konu satırı olur.
- `KONU_ESLE` adları büyük/küçük harf ve noktalamaya bakmadan birleştirir. Yedi adın hiçbiri, hiçbir derste mevcut bir adla bu anahtarda **çakışmıyor** (mevcut `fabrika/mevcut_konular.json`'daki 21 dersin tüm adlarıyla kontrol edildi); yani mevcut konular birleşmez, kaybolmaz, yeniden adlandırılmaz.
- Mevcut `mat` listesi 23 addır; yedi ad yayımlanırsa 30 konu olur. Mevcut "Problemler" (10 soru) ve "Sayılar" (3 soru) aynen kalır; yeni konular bunların YANINDA ayrı satır olarak görünür. Bu yedi konu yalnız onay + yayımdan sonra görünür; şu an yayımlanmış soru yok.
- İlk yayımda bu yedi konunun soru sayısı (pilotta 5-70) mevcut konulardan farklı olacaktır; "az soru" görüntüsü için karar gerekebilir (ör. konu başına en az soru eşiğiyle yayım).
- Açık nokta (bu işten bağımsız): sitede "Yüzde problemleri" / "Yüzde Problemleri" çift yazımı `KONU_ESLE` ile zaten tek satırda birleşir; değişiklik gerekmez.
