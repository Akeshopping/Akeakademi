# Shopier ödeme doğrulama, uzlaştırma ve iade tasarımı

Durum: TASARIM + güvenli (kapalı-kalan) kod. Canlıya alınmadı. Bu belge hangi bilginin resmi kaynaktan doğrulandığını, hangisinin varsayım olduğunu ayırır.

## 1. Doğrulanmış bilgi ve varsayımlar

| Konu | Durum | Kaynak / not |
|---|---|---|
| Sipariş durumları: Açık = "müşteri ödemeyi tamamladı", Kapalı, İptal (tam iade, ödeme aktarılmadan), İade (aktarım sonrası veya kısmi iade) | **Doğrulandı** | Shopier Yardım Merkezi, "Sipariş durumu nedir?" (help.shopier.com/help/siparis-durumu-nedir) |
| Webhook, eski OSB'nin yerine önerilen güncel yöntemdir | **Doğrulandı** | help.shopier.com/help/otomatik-siparis-bildirimi-osb-nedir |
| PAT: hesaba süresiz ve sınırsız erişim verir; paylaşılmamalı; yalnızca bir kez gösterilir | **Doğrulandı** | help.shopier.com/help/kisisel-erisim-anahtari-nedir |
| API REST'tir; ayrıntılar developer.shopier.com'dadır | **Doğrulandı** | help.shopier.com/help/shopier-api-nedir |
| Webhook olay adları (`order.created`, `refund.updated`), `Shopier-Signature` başlığı, HMAC-SHA256 + ham gövde | **Doğrulanamadı (resmi)**; yalnızca üçüncü taraf SDK/şablon aktarıyor | Resmi `developer.shopier.com/reference/webhooks` okunamadı: site robots kuralıyla otomatik erişimi yasaklıyor, araç da izin vermiyor. Atlatılmadı. |
| `order.created`'ın yalnızca ödeme tamamlanınca mı gönderildiği | **Doğrulanamadı** | Bu yüzden yalnızca olaya dayanılmıyor; durum alanı da isteniyor |
| Durum alan adı (`paymentStatus`) ve başarı değeri (`paid`) | **Varsayım** | Önceki uygulamadan; resmi belgeyle teyit yok |
| Para birimi alanı, toplam tutar alanı (`totals.total`), kalem alanları (`lineItems[].productId/quantity`), indirim alanları | **Varsayım** | Alan adları `siparisAlanlari()` içinde tek yerde; belge gelince yalnızca orası güncellenir |
| Sipariş sorgulama uç noktası | **Bilinmiyor** | Üretim kodundan çıkarıldı. SHOPIER_PAT tanımlı olsa bile API çağrılmaz |

Sonuç: ödeme akışı canlıda uçtan uca doğrulanmadan bu değişiklik canlıya önerilmez (bkz. §6).

### 1a. GERÇEK ödeme ile doğrulananlar (9 Kasım 2026, 199 TL Atılım 1 ay, canlı sistem)
Gerçek bir `order.created` bildirimi alındı ve canlı sistem kodu üretip e-posta gönderdi. Gerçek yükten **doğrulanan** alanlar: `paymentStatus: "paid"`, üst düzey `currency: "TRY"`, `totals.total: "199.00"` (nokta ondalık), `lineItems[].productId` (metin) ve `quantity`, `discounts: []`, `refunds: []`, `status: "unfulfilled"` (teslim durumu, ödeme değil). `billingInfo` boş olabilir; e-posta `shippingInfo.email` içinde de gelebilir (kod ikisine de bakıyor). İmza geçti (HMAC çalışıyor). Hâlâ **doğrulanmayan**: `paid` dışındaki değerler, başarısız ödeme yükü, indirimli sipariş yükü, `refund.updated` yükü, imza başlığının resmi adı.

## 2. Kodun şu anki güvenli davranışı (kapalı kalır)

Erişim kodu yalnızca şunların HEPSİ doğruysa üretilir: geçerli imza, durum alanı başarılı, ürün kimliği tanınıyor, para birimi TRY/TL, nihai tutar = (liste fiyatı veya sunucuda tanımlı indirimli tutar) × miktar toplamı (kuruşu kuruşuna, tolerans yok), sipariş daha önce işlenmemiş. Biri tutmazsa kod üretilmez ve sipariş `odeme_dogrulanamadi`, `para_dogrulanamadi` veya `tutar_uyusmuyor` olarak (ham verisiyle) kaydedilir. Bildirimdeki indirim alanlarına güvenilmez; yalnızca `AKE_INDIRIMLI` (sunucu ortam değişkeni) tutarları kabul edilir.

## 3. Uzlaştırma ve destek süreci (ödeme yapan müşteri erişimsiz kalmasın)

Tek gerçek kaynak: Shopier panelindeki sipariş (Durum "Açık" = ödeme tamamlandı).

1. **Yakalama.** Her doğrulanamayan sipariş `siparis` tablosuna `<id>!odeme` veya `<id>!tutar` kimliğiyle düşer (mevcut davranış). Yönetici panelindeki sipariş listesi bunları gösterir.
2. **Bildirim (önerilen, uygulanmadı).** Doğrulanamayan her sipariş için yöneticiye e-posta (sipariş no, tutar, durum). Mevcut e-posta altyapısı kullanılabilir.
3. **Müşteri yolu.** Ödeme sonrası e-posta/ekran metni: "Erişim kodun 24 saat içinde gelmezse info@akeakademi.com'a sipariş numaranla yaz." (Satış sayfasındaki mevcut 24 saat sözüyle uyumlu.)
4. **Günlük uzlaştırma (elle).** Yönetici, Shopier panelindeki "Açık" siparişleri `siparis` listesiyle karşılaştırır. Eşleşmeyen, ödemesi tamamlanmış siparişi destek talebiyle birlikte §4'teki onay yoluna alır.
5. **Otomatik uzlaştırma.** Yalnızca resmi sipariş sorgulama sözleşmesi doğrulandıktan sonra (günlük zamanlanmış karşılaştırma).
6. **Süre.** Doğrulanamayan siparişler 24 saat içinde ele alınır; 7 gün çözülmeyenler iade değerlendirmesine alınır.

## 4. Yönetici manuel onayı (YALNIZCA TASARIM; uygulanmayacak)

- **Yetki:** yalnızca `yoneticiMi` hesabı; kimliği oturumdan alınır. Uç noktaya yalnızca JSON POST, `Origin` kontrolü, SameSite çerez.
- **Kapsam kısıtı:** yönetici paket, tutar veya e-posta GİRMEZ. Onay yalnızca kayıtlı ham siparişi (`<id>!odeme` / `!tutar`) seçer; paket ve süre ürün kimliğinden sunucuda yeniden hesaplanır. Alıcı e-posta kayıttakinden değişmez.
- **Gerekçe zorunlu:** "Shopier panelinde Açık doğrulandı" + not. Gerekçesiz çağrı reddedilir.
- **Denetim kaydı (append-only):** kim, ne zaman, hangi sipariş, önceki durum, gerekçe, tutar, IP özeti. Ayrı bir tablo gerektirir (migration; ayrıca onay istenir).
- **Kötüye kullanım önlemleri:** aynı siparişe tek onay (idempotent); günlük onay üst sınırı (ör. 20); her onayda yöneticiye ve (isteğe bağlı) ikinci bir adrese bildirim e-postası; tutarı uyuşmayan sipariş için ek uyarı ve ikinci onay; onay sonrası geri alma mevcut `abone-iptal` ile yapılır.
- **Uygulama sırası:** önce denetim tablosu (onaylı migration), sonra uç nokta, sonra panel düğmesi.

## 5. `refund.updated` — iade ve erişim iptali tasarımı (uygulanmadı)

Olay yükü ve alanları resmi olarak doğrulanamadı; aşağıdaki kurallar doğrulamadan sonra uygulanır.

1. İmza doğrulanır; olay sipariş numarasıyla kayıtlı `siparis`/`kod` satırına eşlenir. Eşleşmeyen olay yalnızca kaydedilir.
2. **Tam iade / iptal** (Shopier: "İptal" veya tam "İade"): yalnızca o siparişe ait kod(lar) iptal edilir. Mevcut yapıda `kod.bitis` geçmiş bir tarihe çekilerek iptal edilebilir (hesap/kod bağlantısı ve geçmiş korunur). Başka siparişlerin kodları ve hesabın diğer abonelikleri etkilenmez.
3. **Kısmi iade:** erişim iptal edilmez; yönetici bildirimiyle elle karara bırakılır.
4. **Önce kaydet, sonra uygula:** olay `iade_bekliyor` olarak düşer; tutar/sipariş eşleşmesi doğrulanınca iptal uygulanır; belirsizse yönetici onayına gider (§4'teki kurallarla).
5. **Mevcut aboneliklere dokunulmaz:** değişiklik yalnızca iade olayıyla eşleşen sipariş koduna uygulanır; geçmişe dönük toplu işlem yoktur.
6. Her iptal denetim kaydına yazılır ve müşteriye bilgi e-postası gider.
7. İade edilen siparişin aynı kimlikle tekrar işlenmesi mevcut tekrar-sipariş korumasıyla engellenir.

## 6. Canlıya almadan önce gerekenler

1. Shopier panelinden (veya resmi belgeden) gerçek bir `order.created` bildirim gövdesi: durum alanı/değeri, para birimi, toplam, kalem ve indirim alanları. Alan eşlemesi güncellenir, testler gerçek örnekle genişletilir.
2. Ortam değişkenleri: gerekiyorsa `AKE_INDIRIMLI`, `AKE_FIYATLAR` (liste fiyatı değişirse).
3. Düşük tutarlı gerçek bir test siparişiyle (sizin onayınızla) uçtan uca doğrulama: ödeme → webhook → kod → e-posta → hesapta paket.
4. §3'teki bildirim ve destek metni.
