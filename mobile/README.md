# AKE Akademi · mobil uygulama (Flutter, Android + iOS)

Web sitesi WebView'e konmadı; ekranlar Flutter ile yeniden yazıldı. Hesap, soru bankası ve ilerleme **mevcut AKE sunucusunu** kullanır. Web HTML/CSS kodu kopyalanmadı; yalnızca amblem ve tasarım token'larının renk değerleri alındı.

## Bu sürümde (ilk dikey akış)
Açılış → ücretsiz giriş (e-postaya gelen 8 haneli kod) → sınav → ders → konu → soru → şık seç → sunucu cevabı + açıklama → sonuç → ilerlemenin hesaba yazılması ve hesaptan okunması.
Hata, boş, yükleniyor, bağlantı yok, soru servisi kapalı, ücretsiz hak bitti ve oturum süresi doldu ekranları vardır. Ödeme/satın alma **yoktur**.

## Nasıl konuşur
- Kimlik: `Authorization: Bearer <oturum anahtarı>`. Anahtar, `kod-dogrula` isteğinde `istemci:"mobil"` denince döner; cihazın güvenli deposunda (Android Keystore / iOS Keychain) durur. Çerez ve sahte Origin kullanılmaz. Sunucu tarafı değişiklik: `lib/ortak.js`, `lib/soru-api.js`, `functions/api/hesap/[[yol]].js` (testler: `tests/mobil-oturum.test.mjs`).
- Sorular: `/api/soru/ozet`, `/oturum`, `/cevap`, `/bitir`. Cevap anahtarı cevaptan önce istemciye gelmez.
- İlerleme: `/api/hesap/veri` ve `/veri/stats`. Web'in `record()` biçimindeki `topic`, `daily`, `tr`, `td` sayaçları güncellenir; web'in kendi alanları (ans, badges, para…) korunur.

## Çalıştırma (kendi bilgisayarında; Flutter SDK ≥ 3.22 gerekir)
```bash
cd mobile
./kur.sh                      # android/ ve ios/ klasörlerini üretir, ayarları uygular, flutter pub get
flutter analyze
flutter test                  # api, ilerleme ve ekran akışı testleri
flutter run -d <emülatör> --dart-define=AKE_API=https://tasarim-erken-erisim-acilis.akeakademi.pages.dev
```
Soru servisi sunucuda `AKE_SORU_V2=1` ve canonical soru verisi ister. **Production'da bu bayrak kapalıdır**; uygulama o durumda "Soru servisi henüz açık değil" ekranı gösterir. Test için Preview ortamında bayrağı sen açmalısın (ve test D1'de soru verisi olmalı).

## iOS
`ios/` kaynakları `./kur.sh` ile üretilir. Derleme ve imzalama için Mac + Xcode + Apple geliştirici hesabı gerekir; bu depoda iOS derlemesi **yapılmadı**.

## Bilinen sınırlar (bu sürüm)
- Dart kodu ve testleri, bu geliştirme ortamında Flutter SDK olmadığı için **derlenmedi ve çalıştırılmadı**.
- Google ile giriş yok (yalnız e-posta kodu).
- Web'deki yanlışlar defteri, XP ve rozetler mobilde güncellenmez; yalnız konu sayaçları.
- Soru sırasında uygulama kapanırsa bekleyen ilerleme kayıtları bellekte olduğu için kaybolabilir (kalıcı kuyruk sonraki iş).
