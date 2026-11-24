# AKE Akademi · mobil uygulama (Flutter, Android + iOS)

Web sitesi WebView'e konmadı; ekranlar Flutter ile yeniden yazıldı. Hesap, soru bankası ve ilerleme **mevcut AKE sunucusunu** kullanır. Web HTML/CSS kodu kopyalanmadı; yalnızca amblem ve tasarım token'larının renk değerleri alındı.

## Bu sürümde (ilk dikey akış)
Açılış → ücretsiz giriş (e-postaya gelen 8 haneli kod) → sınav → ders → konu → soru → şık seç → sunucu cevabı + açıklama → sonuç → ilerlemenin hesaba yazılması ve hesaptan okunması.
Hata, boş, yükleniyor, bağlantı yok, soru servisi kapalı, ücretsiz hak bitti ve oturum süresi doldu ekranları vardır. Ödeme/satın alma **yoktur**.

## Nasıl konuşur
- Kimlik: `Authorization: Bearer <oturum anahtarı>`. Anahtar, `kod-dogrula` isteğinde `istemci:"mobil"` denince döner; cihazın güvenli deposunda (Android Keystore / iOS Keychain) durur. Çerez ve sahte Origin kullanılmaz. Sunucu tarafı değişiklik: `lib/ortak.js`, `lib/soru-api.js`, `functions/api/hesap/[[yol]].js` (testler: `tests/mobil-oturum.test.mjs`).
- Sorular: `/api/soru/ozet`, `/oturum`, `/cevap`, `/bitir`. Cevap anahtarı cevaptan önce istemciye gelmez.
- İlerleme: uygulama **sayaç göndermez ve `stats` belgesine yazmaz**. Cevaptan sonra `POST /api/soru/ilerleme {oturum, tz}` der; sunucu kendi kaydettiği cevaplardan web'in `record()` biçimindeki `topic`, `daily`, `tr`, `td` sayaçlarını **atomik (CAS) ve tekil (oturum+soru başına bir kez)** uygular. Web alanları (ans, badges, para…) korunur. Okuma: `GET /api/hesap/veri`.
- Bekleyen kayıtlar **hesap kimliğine bağlıdır**: çıkış, oturum bitişi ve başka hesapla girişte önceki hesabın kaydı yeni hesaba yazılmaz (istek ağa çıkmadan reddedilir). Açılışta/girişte sunucu, hesabın işlenmemiş cevaplarını süpürür (uygulama kapanmış olsa bile kayıp olmaz).
- Soru oturumu açarken istek kimliği ekran başına bir kez üretilir; ağ hatasında "Tekrar dene" aynı kimliği kullanır, yanıt kaybolsa bile ikinci kota kullanımı olmaz.

## Sunucu adresi (varsayılan YOK)
`AKE_API` zorunludur; verilmezse uygulama "Yapılandırma hatası" gösterir ve ağa çıkmaz. Production adresine (akeakademi.com) yalnızca **release** derlemesi bağlanır; debug/profile/test için ayrıca `--dart-define=AKE_URETIM_ONAY=evet` gerekir. Test için **mobil dalın kendi Preview adresi**: `https://mobil-ake-ilk-surum.akeakademi.pages.dev` (dal takma adı; her commit ayrıca kendi adresini alır, PR denetimindeki "Cloudflare Pages" satırında görünür). Başka dalın Preview adresi kullanılmaz.

Soru servisi sunucuda `AKE_SORU_V2=1` ve canonical soru verisi ister. **Production'da bayrak kapalıdır** (uygulama o zaman "Soru servisi henüz açık değil" gösterir). Preview'da bayrağın açık olduğu `/api/soru/ozet` → 401 (kapalı olsaydı 404) ile doğrulandı; Preview'ın test veritabanında canonical soru verisi olup olmadığı giriş yapılmadan doğrulanamaz, ilk gerçek denemede görülecek.

## Çalıştırma — Windows (PowerShell)
1. Flutter SDK kur (≥ 3.22): https://docs.flutter.dev/get-started/install/windows ; Android Studio + Android SDK + bir emülatör (AVD).
2. `flutter doctor` çalıştır, kırmızı maddeleri gider (`flutter doctor --android-licenses` ile lisansları kabul et).
3. ```powershell
   cd mobile
   powershell -ExecutionPolicy Bypass -File .\kur.ps1     # android/ ve ios/ üretir, ayarları uygular, pub get
   flutter analyze
   flutter test
   flutter run -d emulator-5554 --dart-define=AKE_API=https://mobil-ake-ilk-surum.akeakademi.pages.dev
   ```
   Emülatör kimliğini `flutter devices` gösterir.

macOS/Linux: `./kur.sh` aynı işi yapar.

## Doğrulama (CI)
`.github/workflows/mobil.yml` her PR/push'ta `flutter pub get`, `flutter analyze`, `flutter test` ve `flutter build apk --debug` çalıştırır; sonuç PR denetimlerinde görünür, debug APK artefakt olarak 7 gün saklanır. **iOS CI'da derlenmez** (Mac/Xcode/imza yok).

## iOS
`ios/` kaynakları `./kur.sh` ile üretilir. Derleme ve imzalama için Mac + Xcode + Apple geliştirici hesabı gerekir; bu depoda iOS derlemesi **yapılmadı**.

## Bilinen sınırlar (bu sürüm)
- **Web ile eşzamanlı yazma:** sunucu tarafı artık atomik ve çift saymaz; ancak web istemcisi, daha yeni uzak `stats` belgesini bütünüyle benimser. Web'de henüz gönderilmemiş (≈6 sn / çevrimdışı) yerel değişiklikler, aynı hesapta mobil yazdıktan sonra ezilebilir. Çözüm web tarafı birleştirme ister; yapılmadı. Bu yüzden "web ile tam güvenli senkron" denmez.
- Google ile giriş yok (yalnız e-posta kodu).
- Web'deki yanlışlar defteri, XP ve rozetler mobilde güncellenmez; yalnız konu sayaçları.
- Bekleyen kayıt listesi bellektedir; kaybolursa açılışta sunucu süpürmesi cevapları toparlar (cevaplar sunucuda durur).
