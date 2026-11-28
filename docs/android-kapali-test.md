# Android kapalı test sürümü (Google Play) · yükleme anahtarı ve AAB

Durum: AAB'yi CI üretir ve doğrular. **Yükleme anahtarı olmadan üretilen dosya İMZASIZDIR ve Play'e yüklenemez.** Anahtar, parola ve keystore repoya/sohbete/loga yazılmaz.

## 1) Yükleme anahtarını kendi bilgisayarında oluştur (bir kez)
1. `keytool` gerekir (JDK 17 ya da Android Studio ile gelir). Terminalde `keytool -help` çalışıyorsa tamam.
2. Şunu çalıştır (klasör olarak repo DIŞINDA bir yer seç, örn. Belgeler):
   `keytool -genkeypair -v -keystore upload-keystore.jks -storetype PKCS12 -alias upload -keyalg RSA -keysize 2048 -validity 10000`
3. Parolayı iki kez sor: **yalnız harf ve rakam** kullan (boşluk, `\`, `:` yok). Ad/kurum sorularına istediğini yaz.
4. `upload-keystore.jks` dosyasını ve parolayı **iki ayrı güvenli yere** yedekle (parola yöneticisi + çevrimdışı kopya). Kaybedersen Play'de "yükleme anahtarını sıfırla" için destek gerekir.
5. Dosyayı Base64'e çevir (ekrana yazma, panoya al):
   - Mac: `base64 -i upload-keystore.jks | pbcopy`
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks")) | Set-Clipboard`
6. GitHub → depo → Settings → Secrets and variables → Actions → **New repository secret** ile dört sır ekle:
   `ANDROID_UPLOAD_KEYSTORE_BASE64` (panodaki değer), `ANDROID_UPLOAD_STORE_PASSWORD` (parola), `ANDROID_UPLOAD_KEY_ALIAS` (`upload`), `ANDROID_UPLOAD_KEY_PASSWORD` (aynı parola; PKCS12'de anahtar ve mağaza parolası aynıdır).
7. PR #44'ün iş akışını yeniden çalıştır. Artefakt adı `ake-akademi-android-release-aab-imzali` olmalı ve `aab-kaydi.txt` içinde `play_e_yuklenebilir: evet` yazmalı.

## 2) Play Console'da ilk adım
Henüz yoksa **Uygulama oluştur** (ad: AKE Akademi, dil: Türkçe, tür: Uygulama). Ardından Test → Kapalı test → sürüm oluştur adımında yukarıdaki imzalı AAB'yi yükleyip **Play Uygulama İmzalama**'ya katıl. Uygulamanın paket kimliği ilk yüklemeyle sabitlenir: `com.akeakademi.ake_akademi`. Bu doküman yükleme yapmaz; yüklemeyi sen yaparsın.

## 3) CI'ın her AAB'de doğruladıkları (`mobile/tool/aab_dogrula.sh`)
Paket kimliği · sürüm kodu (= Actions çalıştırma numarası; Play her yüklemede artan kod ister) · `com.android.vending.BILLING` ve `INTERNET` izni · `debuggable` değil · gömülü API adresi bu dalın Preview adresi (eski dal adresi yok) · imza (debug anahtarı kabul edilmez).

## 4) Abonelik ürünleri
Ürün kimlikleri ve sunucu kurulumu: `docs/magaza-odeme-kurulum.md`. Gerçek satın alma yalnız lisans test hesabıyla ve kapalı testte denenir; "Google Play sandbox ödemesi geçti" ancak o testten sonra söylenebilir.
