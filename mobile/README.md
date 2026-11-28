# AKE Akademi · mobil uygulama (Flutter, Android + iOS)

Web sitesi WebView'e konmadı; ekranlar Flutter ile yeniden yazıldı. Hesap, soru bankası ve ilerleme **mevcut AKE sunucusunu** kullanır. Web HTML/CSS kodu kopyalanmadı; yalnızca amblem ve tasarım token'larının renk değerleri alındı.

## Bu sürümde (ilk dikey akış)
Açılış → ücretsiz giriş (e-postaya gelen 8 haneli kod) → sınav → ders → konu → soru → şık seç → sunucu cevabı + açıklama → sonuç → ilerlemenin hesaba yazılması ve hesaptan okunması.
Hata, boş, yükleniyor, bağlantı yok, soru servisi kapalı, ücretsiz hak bitti ve oturum süresi doldu ekranları vardır. Ödeme/satın alma **yoktur**.

## Tasarım (sitenin görsel kimliği)
- **Marka:** K amblemi `docs/tasarim/gen_icons.py` içindeki gerçek SVG path ve gradyanla `lib/ui/marka.dart`'ta çizilir (yaklaşık logo PNG yok). Başlatıcı ikonu, açılış, giriş ve üst çubuk aynı şekli kullanır; ikon dosyaları `kur_ikon.py` ile `kur.sh` içinde uygulanır.
- **Token'lar:** renk, yüzey ve ders renkleri `docs/tasarim/tokens.css` ile aynıdır (`lib/ui/tema.dart`, açık + koyu). Yazı: AKE Sans (Atkinson), AKE Serif (Newsreader), rakamlar AKE Rakam (Inter); site yığınındaki gibi önce Rakam, harfler Sans'a düşer (`assets/fontlar`, SIL OFL).
- **Ekranlar:** koyu mürekkep üst çubuk + alt gezinme, sıcak açık zemin, mercan vurgu, ders renkli kartlar, zorluk seçici, soru ekranı (paragraf, beş şık, seçili/doğru/yanlış, açıklamaya kayma, sabit alt eylem alanı).
- **Açılış animasyonu:** uygulama her yeni çalıştırıldığında bir kez, ≈1,9 sn + 0,25 sn sönme (2,15 sn); "Geç" ilk kareden itibaren; aynı süreçte sekme değiştirme ve arka plandan dönüşte tekrarlanmaz; "hareketi azalt"ta oynamaz.
- Site → uygulama özellik eşlemesi ve eksikler: `docs/mobil-ozellik-haritasi.md`.

## Nasıl konuşur
- Kimlik: `Authorization: Bearer <oturum anahtarı>`. Anahtar, `kod-dogrula` isteğinde `istemci:"mobil"` denince döner; cihazın güvenli deposunda (Android Keystore / iOS Keychain) durur. Çerez ve sahte Origin kullanılmaz. Sunucu tarafı değişiklik: `lib/ortak.js`, `lib/soru-api.js`, `functions/api/hesap/[[yol]].js` (testler: `tests/mobil-oturum.test.mjs`).
- Sorular: `/api/soru/ozet`, `/oturum`, `/cevap`, `/bitir`. Cevap anahtarı cevaptan önce istemciye gelmez.
- İlerleme: uygulama **sayaç göndermez ve `stats` belgesine yazmaz**. Cevaptan sonra `POST /api/soru/ilerleme {oturum, tz}` der; sunucu kendi kaydettiği cevaplardan web'in `record()` biçimindeki `topic`, `daily`, `tr`, `td` sayaçlarını **atomik (CAS) ve tekil (oturum+soru başına bir kez)** uygular. Web alanları (ans, badges, para…) korunur. Okuma: `GET /api/hesap/veri`.
- Bekleyen kayıtlar **hesap kimliğine bağlıdır**: çıkış, oturum bitişi ve başka hesapla girişte önceki hesabın kaydı yeni hesaba yazılmaz (istek ağa çıkmadan reddedilir). Açılışta/girişte sunucu, hesabın işlenmemiş cevaplarını süpürür (uygulama kapanmış olsa bile kayıp olmaz).
- Soru oturumu açarken istek kimliği ekran başına bir kez üretilir; ağ hatasında "Tekrar dene" aynı kimliği kullanır, yanıt kaybolsa bile ikinci kota kullanımı olmaz.

## Sunucu adresi (varsayılan YOK)
`AKE_API` zorunludur; verilmezse uygulama "Yapılandırma hatası" gösterir ve ağa çıkmaz. Production adresine (akeakademi.com) yalnızca **release** derlemesi bağlanır; debug/profile/test için ayrıca `--dart-define=AKE_URETIM_ONAY=evet` gerekir. Test için **PR #44 dalının (`mobil/magaza-sandbox`) kendi Preview adresi**: `https://mobil-magaza-sandbox.akeakademi.pages.dev` (dal takma adı; her commit ayrıca kendi adresini alır, PR denetimindeki "Cloudflare Pages" satırında görünür). Başka dalın Preview adresi kullanılmaz.

Soru servisi sunucuda `AKE_SORU_V2=1` ve canonical soru verisi ister. **Production'da bayrak kapalıdır** (uygulama o zaman "Soru servisi henüz açık değil" gösterir). Preview'da bayrağın açık olduğu `/api/soru/ozet` → 401 (kapalı olsaydı 404) ile doğrulandı; Preview'ın test veritabanında canonical soru verisi olup olmadığı giriş yapılmadan doğrulanamaz, ilk gerçek denemede görülecek.

## Çalıştırma — Windows (PowerShell)
1. Flutter SDK kur (≥ 3.22): https://docs.flutter.dev/get-started/install/windows ; Android Studio + Android SDK + bir emülatör (AVD).
2. `flutter doctor` çalıştır, kırmızı maddeleri gider (`flutter doctor --android-licenses` ile lisansları kabul et).
3. ```powershell
   cd mobile
   powershell -ExecutionPolicy Bypass -File .\kur.ps1     # android/ ve ios/ üretir, ayarları uygular, pub get
   flutter analyze
   flutter test
   flutter run -d emulator-5554 --dart-define=AKE_API=https://mobil-magaza-sandbox.akeakademi.pages.dev
   ```
   Emülatör kimliğini `flutter devices` gösterir.

macOS/Linux: `./kur.sh` aynı işi yapar.

## Doğrulama (CI)
`.github/workflows/mobil.yml` her PR/push'ta dört iş çalıştırır: **Node** sunucu testleri; **android** (`flutter pub get`, `flutter analyze`, `flutter test`, debug APK); **aab** (release AAB + doğrulama, aşağıda); **ios** (macOS'ta `flutter test`, imzasız `flutter build ios --release --no-codesign` ve simülatörde ekran yürüyüşü); ayrıca **emulator** işi. Artefaktlar 14 gün saklanır. iOS tarafı yalnız **imzasız derleme + simülatör testidir**: TestFlight/App Store paketi (IPA), imza ve Apple geliştirici hesabı gerektiren adımlar CI'da YOKTUR ve gerçek iPhone'da denenmemiştir. Tüm CI derlemeleri bu dalın Preview adresine bağlıdır (`AKE_API_PREVIEW`, iş akışı başında).

### Android kapalı test sürümü (AAB)
`aab` işi `flutter build appbundle --release` üretir (sürüm kodu = çalıştırma numarası) ve `tool/aab_dogrula.sh` ile paket kimliğini, sürüm kodunu, Play Billing iznini, gömülü Preview adresini ve imzayı denetler. **Yükleme anahtarı GitHub Secrets'ta yoksa AAB İMZASIZ çıkar** (artefakt adında `IMZASIZ-play-e-yuklenemez` yazar) ve Play'e yüklenemez. Anahtar oluşturma ve Secrets adımları: `docs/android-kapali-test.md`. Anahtar, parola ve keystore repoya girmez.

### Emülatör ekran kanıtı (CI, `emulator` işi)
`tool/emulator_kanit.sh`, Android 14 emülatörde 320 dp ve 390 dp genişlikte `integration_test/ekranlar_test.dart` ile ekranları gezer ve PNG alır; ardından **gerçek** release uygulamanın ilk/ikinci açılışını ve "hareketi azalt" açılışını gerçek zamanlı `screenrecord` ile kaydeder. Çıktı: iş artefaktı `ake-emulator-kanit` ve push'ta `kanit/pr43-<sha>` dalı. **Ekran yürüyüşündeki ders/soru/istatistikler TEST VERİSİDİR** (`test/sahte_sunucu.dart`, bellek içi); gerçek hesap, Preview girişi ve Production emülatör testinde kullanılmaz. CI emülatörü yazılım GPU'sudur; kare hızı telefonu temsil etmez.

## iOS
`ios/` kaynakları `./kur.sh` ile üretilir. CI (macOS) imzasız derleme ve simülatör testi yapar. Gerçek cihaz, TestFlight ve App Store için Mac + Xcode + Apple geliştirici hesabı ve imza gerekir; bu adımlar henüz **yapılmadı**.

## Bilinen sınırlar (bu sürüm)
- **Web ile eşzamanlı yazma:** yeni web sürümü cevapları yerelde kalıcı olay olarak da tutar; senkronda uzak belgeyi okur, eksik olayları üstüne uygular ve sunucuya koşullu (`_b`) yazar. Çevrimdışı/gönderilmemiş cevaplar ve eskimiş sekmeler mobil ilerlemesini ezmez, mobil de web'inkini ezmez; yanıt kaybolsa çift sayım olmaz (testler: `tests/web-stats-senkron.test.mjs`, ayrıca Preview D1'de doğrulandı). **Kalan sınırlar:** (1) bu değişiklikten önceki, önbellekteki ESKİ web sürümü koşulsuz yazmaya devam eder; yeni web yayınlanıp sekme yenilenince kapanır. (2) Bir cihaz yeni sürümle ilk kez senkron olurken, eski sürümden kalan gönderilmemiş yerel sayaçlar uzak sayaçlarla "büyüğünü koru" kuralıyla birleşir (tek seferlik, en kötü durumda küçük taraftaki artış kaybolabilir). (3) `ans/para/rozet` dışındaki web alanları (sınavlar, yanlışlar defteri vb.) eskisi gibi son-yazan-kazanır.
- Mobilde yok: canlı deneme, ÖSYM tarzı / AI ile üret sekmeleri, bildirimler (odak bitişinde bildirim dahil), arkadaş ligi, Sınıfım, paketler/ödeme (ayrıntı: `docs/mobil-ozellik-haritasi.md`). Bunlar uygulamada sahte düğmeyle değil, ana sayfada "Sitede var, mobilde henüz yok" notuyla gösterilir.
- Deneme, AI öğretmen, Plan düzenleme, profil ve hesap silme sahte sunucuyla (testlerde) ve emülatörde doğrulandı; **gerçek (Preview/Production) hesapla, gerçek AI çağrısıyla ve gerçek hesap silmeyle denenmedi.**
- Simgeler Material simgeleridir; sitenin özel simge seti uygulamaya taşınmadı.
- Google ile giriş yok (yalnız e-posta kodu).
- Web'deki yanlışlar defteri, XP ve rozetler mobilde güncellenmez; yalnız konu sayaçları.
- Bekleyen kayıt listesi bellektedir; kaybolursa açılışta sunucu süpürmesi cevapları toparlar (cevaplar sunucuda durur).
