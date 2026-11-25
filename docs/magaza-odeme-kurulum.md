# Mağaza ödeme kurulumu · senin yapacakların

Aşağıdakileri **sen** yaparsın (hesap, ürün ve anahtar gerektirir). Gizli değerleri repoya, sohbete ya da rapora yazma; yalnızca Cloudflare ortam değişkenine koy.
Başlamadan: tüm testler **Preview** ortamında yapılır. Production'a hiçbir şey ekleme.

Uygulama kimlikleri (mevcut Flutter projesi): Android `com.akeakademi.ake_akademi`, iOS `com.akeakademi.akeAkademi`.
Vergi/fatura ve mağaza politikası kararları (20/B, mali müşavir) bu belgenin konusu değildir.

## A) Google Play Console

1. Play Console'da uygulamayı oluştur (`com.akeakademi.ake_akademi`) ve **kapalı test** kanalına imzalı bir sürüm (AAB) yükle. Abonelik ürünleri, uygulama yüklenip faturalama izni algılandıktan sonra açılabilir.
2. **Gelir elde etme → Ürünler → Abonelikler** altında 4 abonelik oluştur. Abonelik kimliği tam olarak: `atilim_aylik`, `atilim_yillik`, `premium_aylik`, `premium_yillik`.
3. Her aboneliğe bir **temel plan** ekle: aylık için "Her ay yenilenir", yıllık için "Her yıl yenilenir"; fiyatı gir ve **Etkinleştir**.
4. **Ayarlar → Lisans testi** altına test Gmail adreslerini ekle ve lisans yanıtını `RESPOND_NORMALLY` bırak. Aynı adresleri kapalı test kanalının test kullanıcılarına da ekle.
5. **Hizmet hesabı:** Google Cloud'da bir proje seç → "Google Play Android Developer API"yi etkinleştir → hizmet hesabı oluştur → JSON anahtar indir. Play Console → **Kullanıcılar ve izinler** → hizmet hesabının e-postasını davet et ve "Finansal verileri görüntüle" + "Siparişleri ve abonelikleri yönet" izinlerini ver. (İzinlerin yansıması birkaç saat sürebilir.)
6. **Gerçek zamanlı bildirimler (isteğe bağlı ama önerilir):** Pub/Sub'da bir konu oluştur, `google-play-developer-notifications@system.gserviceaccount.com` hesabına yayıncı izni ver, bir **push** aboneliği aç. Adres: `https://<preview-adresi>/api/magaza/google?s=<MAGAZA_BILDIRIM_SIRRI>`. Play Console → **Gelir elde etme kurulumu** → konu adını gir. Bildirim yalnızca tetikleyicidir; erişimi bildirim açmaz.

## B) App Store Connect

1. Apple Developer hesabında App ID'yi oluştur (`com.akeakademi.akeAkademi`) ve **In-App Purchase** yeteneğinin açık olduğunu doğrula. **Sözleşmeler, vergi ve bankacılık** bölümünde "Paid Apps" sözleşmesinin **Active** olması gerekir; yoksa ürünler görünmez.
2. App Store Connect'te uygulamayı oluştur. **Abonelikler** altında bir abonelik grubu aç (ör. "AKE Paketler") ve 4 abonelik ekle. Ürün kimlikleri: `atilim_aylik`, `atilim_yillik`, `premium_aylik`, `premium_yillik`. Süre: aylık ürünler 1 ay, yıllık ürünler 1 yıl. Fiyat, yerelleştirme adı/açıklaması ve inceleme ekran görüntüsü gir. Grup içinde Premium'u Atılım'ın üstüne sırala.
3. **Sandbox test kullanıcıları:** Kullanıcılar ve Erişim → **Sandbox** → yeni test kullanıcısı (gerçek olmayan bir e-posta). Telefonda: Ayarlar → App Store → **Sandbox Hesabı** bölümüne bu kullanıcıyla gir (iOS 16+ geliştirici modu açıkken görünür).
4. **App Store Server API anahtarı:** Kullanıcılar ve Erişim → **Entegrasyonlar → Uygulama İçi Satın Alma** → anahtar oluştur → `.p8` dosyasını **bir kez** indir. Ekranda **Issuer ID** ve **Key ID** görünür.
5. **Sunucu bildirimleri (isteğe bağlı):** Uygulama → App Bilgileri → **App Store Sunucu Bildirimleri** → Sandbox adresi: `https://<preview-adresi>/api/magaza/apple`, sürüm 2. Bildirim yalnızca tetikleyicidir.
6. TestFlight'a bir derleme yükle (Mac/Xcode ya da CI). Sandbox satın alma TestFlight ya da Xcode'dan yüklenen derlemede çalışır.

## C) Cloudflare (yalnız Preview ortamı)

Workers & Pages → akeakademi → Settings → Variables and Secrets → **Preview** bölümü. Değerleri burada gir; buraya yazmıyorum.

| Ad | Tür | Ne | Örnek / not |
|---|---|---|---|
| `AKE_MAGAZA` | Değişken | Mod | `sandbox` (kapatmak için sil) |
| `GOOGLE_PLAY_PAKET` | Değişken | Android paket adı | `com.akeakademi.ake_akademi` (varsayılan zaten bu) |
| `GOOGLE_PLAY_HIZMET_HESABI` | **Secret** | A-5'te indirilen JSON'un tamamı | tek satır JSON |
| `APPLE_BUNDLE_ID` | Değişken | iOS paket kimliği | `com.akeakademi.akeAkademi` (varsayılan bu) |
| `APPLE_IAP_ISSUER_ID` | **Secret** | B-4 Issuer ID | UUID |
| `APPLE_IAP_KEY_ID` | **Secret** | B-4 Key ID | 10 karakter |
| `APPLE_IAP_PRIVATE_KEY` | **Secret** | `.p8` dosyasının içeriği | `-----BEGIN PRIVATE KEY-----` ile başlar |
| `MAGAZA_BILDIRIM_SIRRI` | **Secret** | Google bildirim adresindeki gizli anahtar | uzun rastgele metin |

`AKE_GIZLI` zaten tanımlı olmalı (mevcut erişim kodu anahtarı); hesap takma adları ondan türetilir.
Preview test veritabanına tablo gerekmiyor: `magaza_islem` ilk kullanımda kendiliğinden oluşur (`migrations/0003_magaza.sql` Production için hazırdır, uygulama).

## D) Bittiğinde

1. `AKE_MAGAZA=sandbox` olduğunu ve Production'da hiçbir mağaza değişkeninin **olmadığını** kontrol et.
2. `docs/magaza-test-listesi.md` listesini gerçek Android ve iPhone'da çalıştır.
3. Sonuçları (geçti/kaldı + ekran görüntüsü) bana yolla; ben "sandbox doğrulandı" demeyi ancak bu liste gerçek cihazda geçince yaparım.

## Bu belgede olmayanlar

Gerçek tahsilat, `canli` mod, Production dağıtımı, vergi/fatura kararı.
