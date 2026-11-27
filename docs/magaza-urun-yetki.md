# Mağaza paketleri · ürün ve yetki tablosu

Mobilde ücretli paket **yalnızca Google Play (Android) ve App Store (iPhone)** aboneliğiyle alınır. Web/Shopier ödeme bağlantısı uygulamada yoktur.
Erişimi **sunucu** verir: uygulama mağazadan aldığı işlem kimliğini sunucuya yollar, sunucu mağazaya kendisi sorar (`lib/magaza.js`). Uygulamanın "satın aldım" demesi tek başına hiçbir şey açmaz.

Mobil uygulama mağaza olaylarını giriş yapılmış hesap boyunca dinler; Paketler ekranından ayrılmak dinlemeyi durdurmaz. Çıkışta veya hesap değişiminde eski dinleyici kapanır. Doğrulanamayan mağaza işlemi tamamlanmaz; kullanıcı Paketler'deki Geri yükle ile yeniden deneyebilir.

## 1) Paketler ve yetkiler

| | Ücretsiz | Atılım | Premium |
|---|---|---|---|
| Soru çözme | günde 20 | sınırsız | sınırsız |
| Deneme | ayda 1 | sınırsız | sınırsız |
| AI öğretmen mesajı (aylık) | yok | 200 | 500 |
| Gelişmiş çözüm (aylık) | yok | 20 | 60 |
| Çalışma planı, odak odası, gelişim | var | var | var |
| Sunucudaki plan adı | – | `orta` | `premium` |

Sayılar sunucudaki mevcut ayarlardır (`limitler()`); bu belge onları değiştirmez.

## 2) Ürünler (iki mağazada AYNI kimlik)

| Ürün kimliği | Paket | Süre | Mağazada tür |
|---|---|---|---|
| `atilim_aylik` | Atılım | 1 ay, otomatik yenilenir | Abonelik |
| `atilim_yillik` | Atılım | 1 yıl, otomatik yenilenir | Abonelik |
| `premium_aylik` | Premium | 1 ay, otomatik yenilenir | Abonelik |
| `premium_yillik` | Premium | 1 yıl, otomatik yenilenir | Abonelik |

Fiyatı **mağaza** belirler ve uygulama ekranda mağazanın verdiği fiyatı gösterir (uygulama içinde fiyat yazılı değildir). Web listesindeki fiyatlar (199 / 2.189 / 399 / 4.389 TL) yalnızca referanstır; mağazada hangi fiyatı gireceğine sen karar verirsin.

## 3) Erişim kodlarıyla birlikte çalışma

- Mevcut erişim kodları aynen çalışır; hiçbiri değişmedi.
- Bir hesapta hem kod hem mağaza aboneliği olabilir. **En yüksek plan geçerli olur** (Premium > Atılım). Aynı planda bitişi en geç olan görünür.
- Mağaza aboneliği biterse (iptal + süre sonu, iade, ödeme sorunu) kod varsa kodun planı devam eder.
- Kod bağlama ekranı değişmedi; Ayarlar'da "Paketleri gör" düğmesi Paketler ekranına götürür.

## 4) Durumlar: erişim ne zaman var?

| Mağaza durumu | Erişim | Not |
|---|---|---|
| Aktif | Var | |
| Ek süre (ödeme alınamadı, mağaza süre tanıdı) | Var | Mağaza süreyi bitirirse kapanır |
| İptal edildi (yenilenmeyecek) | Süre bitene dek var | |
| Askıda / ödeme beklemede / duraklatılmış | Yok | Mağaza onaylayınca açılır |
| Süresi bitti | Yok | |
| İade / geri alma | Yok | Sunucu mağazayı tazelediğinde (en geç 6 saat, ya da bildirimle) kapanır |

## 5) Bir işlem ve bir hesap

- Her mağaza işlemi (Google satın alma belirteci, Apple özgün işlem kimliği) **tek bir AKE hesabına** bağlanır. Başka hesap aynı işlemi alamaz (`409`).
- Google: satın alma sırasında konan hesap takma adı sunucuda doğrulanır; uyuşmazsa işlem reddedilir.
- Apple: işlemde `appAccountToken` **zorunlu** ve bu hesabın takma adıyla eşleşmeli. Belirteçsiz işlem hiçbir hesaba bağlanmaz (reddedilir); böylece işlem kimliğini bilen biri başkasının satın almasını sahiplenemez. Flutter eklentisi belirteci koymazsa iPhone satın almaları bu yüzden doğrulanmaz; bu durum gerçek iPhone testinde (I3, I8) görülür.
- Aynı işlem tekrar gelirse sonuç aynıdır, ikinci satır oluşmaz.
- Hesap silinirse işlem satırı `silindi` olarak kalır: başka hesaba geçmez. **Mağaza aboneliği kendiliğinden iptal olmaz**; kullanıcı Google Play / App Store'dan iptal etmelidir.
- Hesap değiştirince (başka e-posta ile giriş) mağaza geri yüklemesi başka hesabın işlemini açmaz.

## 6) Kapalı varsayılan

Sunucuda `AKE_MAGAZA` tanımlı değilse bütün mağaza uçları `503 kapali` döner ve uygulamada Paketler ekranı "henüz açık değil" der.
`AKE_MAGAZA=sandbox` → yalnızca mağaza **test** işlemleri kabul edilir (gerçek tahsilatlı işlem reddedilir). `canli` → yayın sonrası için; bu turda kullanılmaz.
