# Mobil mağaza satın alma · erişim modeli (TASLAK, bu turda uygulanmadı)

**Durum:** Yalnızca tasarım notu. Mobil uygulamada gerçek satın alma, ödeme bağlantısı, Shopier ya da web ödeme yolu YOKTUR. Hiçbir tablo, uç veya ortam değişkeni eklenmedi.
**Vergi/fatura:** 20/B uygunluğu ve mağaza gelirlerinin faturalandırılması mali müşavir/vergi dairesi kararına bağlıdır; bu belge o kararı varsaymaz.
**Mağaza kuralları:** Apple ve Google'ın dijital ürün satışı ve harici ödeme yönlendirmesi politikaları sık değişir; yayından önce güncel metinler kontrol edilmelidir.

## İlkeler
1. **Erişimi yalnızca sunucu verir.** Uygulama "premium mu?" kararını kendi vermez; hesabın paketini `/api/hesap/ben` (mevcut `aktifPaket`) söyler. Cihazdaki bayrak, cihazdaki makbuz ya da mağaza kütüphanesinin "satın alındı" yanıtı tek başına erişim açmaz.
2. **Makbuz sunucuda doğrulanır.** Uygulama mağazadan aldığı kanıtı sunucuya gönderir; sunucu mağazanın kendi API'sine sorar. İstemciden gelen alanlara (fiyat, bitiş tarihi, ürün) güvenilmez.
3. **Gizli anahtarlar uygulamaya gömülmez.** Google servis hesabı, Apple App Store Server API anahtarı (.p8) yalnızca Cloudflare Pages secret olarak sunucuda durur.
4. **Satın alma hesaba bağlanır.** Mağaza işlemi (Google `purchaseToken`, Apple `originalTransactionId`) tek bir AKE hesabına kalıcı bağlanır; aynı işlem başka hesapta kullanılamaz.
5. **Mevcut erişim mantığı yeniden kullanılır.** Doğrulanmış her satın alma, mevcut `kod` tablosuna `anahtar = "magaza:<platform>:<işlem özeti>"`, `plan`, `bitis` ile bir satır yazar; böylece `aktifPaket`, ücretsiz-kota atlaması (`soru-api` "paketli") ve soru erişim kuralları değişmeden çalışır. Shopier/eski erişim kodları ayrı kalır, karışmaz.

## Akış (iki mağaza için ortak)
```
Uygulama                        AKE sunucusu                     Mağaza
   | 1) POST /api/magaza/hesap-etiketi (Bearer)                      |
   |<-- {etiket: türetilmiş UUID/obfuscatedAccountId}                 |
   | 2) mağaza satın alma penceresi (etiket ile) ------------------->|
   |<-- satın alma kanıtı (Google purchaseToken / Apple JWS işlem)    |
   | 3) POST /api/magaza/dogrula {platform, urunId, kanit} (Bearer)   |
   |            4) kanıtı mağaza API'sinden doğrula ---------------->|
   |            5) işlem tekil mi? etiket bu hesaba mı ait?          |
   |            6) kod tablosuna paket satırı yaz, (Google) onayla    |
   |<-- {paket, bitis}  (uygulama /api/hesap/ben ile teyit eder)      |
```
- **Etiket:** `HMAC(AKE_GIZLI, "magaza:" + kid)` ile türetilir (kullanıcı kimliği/e-posta mağazaya düz gitmez). Google'da `obfuscatedAccountId`, Apple'da `appAccountToken` olarak satın almaya eklenir; doğrulamada işlemdeki etiket hesapla eşleşmezse reddedilir.
- **Tekil işlem:** `magaza_islem(islem_kimligi UNIQUE, platform, kid, urun_id, durum, baslangic, bitis, son_dogrulama)`. Aynı işlem aynı hesaptan tekrar gelirse idempotent (200, aynı paket); başka hesaptan gelirse 409 ve kayıt.
- **Geri yükleme:** Uygulama "Satın alımları geri yükle" ile mağazadaki işlemleri sunucuya yollar; sunucu her birini yukarıdaki gibi doğrular ve (etiket uyuyorsa) hesaba yeniden bağlar.

## Google Play
- Doğrulama: Android Publisher API (`purchases.subscriptionsv2.get` / tek seferlik ürün için `purchases.products.get`), servis hesabı kimlik bilgisi sunucu secret'ında.
- **Onay (acknowledge):** sunucu doğrulayınca satın almayı onaylar (3 gün içinde onaylanmazsa Google iade eder).
- **Bildirimler:** Real-time developer notifications (Pub/Sub push) → `/api/magaza/google-bildirim`; yenileme, iptal, askıya alma, iade durumları `magaza_islem.bitis/durum` alanını günceller. Push uç noktası Google'ın imzalı JWT'sini doğrular.
- Test: kapalı test kanalı + lisans test hesapları.

## Apple (iOS)
- Uygulama StoreKit 2 ile satın alır; işlem `JWS` imzalı gelir. Sunucu zincirini (x5c → Apple Root CA G3), `bundleId`, `productId`, `environment` (Sandbox/Production) ve `appAccountToken`'ı doğrular; gerekirse App Store Server API (`/inApps/v1/transactions/{id}`) ile teyit eder. API anahtarı (.p8, issuer, key id) yalnızca sunucuda.
- **Bildirimler:** App Store Server Notifications V2 → `/api/magaza/apple-bildirim` (imzalı JWS doğrulanır); yenileme/iptal/iade/askıya alma durum günceller.
- Test: Sandbox hesapları + TestFlight. Bu depoda Mac/Xcode olmadan iOS tarafı derlenip denenemez.

## Yapılacak sunucu işleri (ayrı PR'lar, onayla)
1. `magaza_islem` tablosu için migration (`migrations/0003_...`), idempotent; test D1'de doğrula.
2. `POST hesap-etiketi`, `POST dogrula`, iki bildirim ucu; hepsi Bearer (mevcut `oturum()`), hız sınırı (`lib/hiz.js`) ve gövde boyutu sınırıyla.
3. Mağaza çağrıları için ağ katmanı soyutlaması; testlerde sahte mağaza yanıtları (gerçek Apple/Google'a bağlanmadan).
4. Ürün kimlikleri ve planlar (ör. `atilim_aylik`, `premium_yillik`) → mevcut `limitler(env, plan)` ile eşleme.
5. Hesap silme: bağlı mağaza satırları anonimleştirilir; aktif abonelik için kullanıcıyı mağaza abonelik ayarına yönlendiren metin.

## Bu turda bilinçli olarak YAPILMAYANLAR
- Uygulamada satın alma düğmesi, fiyat, paket sayfası ya da Shopier/web ödeme bağlantısı.
- Mağaza SDK'sı (in_app_purchase) eklenmedi; bağımlılık ve izin yüzeyi büyütülmedi.
- Production D1 ve canlı yapılandırma değişikliği.
