# Erken erişim ("Açıldığında haber ver") — yayın öncesi kontrol listesi

Dal: `tasarim/erken-erisim-acilis`. Durum 22 Kasım 2026. `main`'e birleştirme ve Production ancak aşağıdaki **Engeller** kapanınca.

## Engeller (öncelik sırasıyla)
1. **Shopier:** dört eski ürün (`52547800`, `52547904`, `52547968`, `52547986`) stok 0 ile kapalı; bu kalıcı kapatma değil (stok girilirse yeniden açılır). Kalıcı kapatma kararı (silme ya da ürünün yayından kaldırılması) bekliyor. Sipariş webhook'u ve erişim kodları korunur. Kapattıktan sonra dört eski bağlantı yeniden kontrol edilir.
2. **Gerçek e-posta akışı (Preview):** kayıt → onay → eski bağlantı (reddedilir) → yeni bağlantı (onaylar) → tekrar basış ("zaten onaylı") → "Kaydımı sil". İlk hesaptaki "onay başarısız" olayı nedeni bilinmeden kapalı sayılmaz; yeni testte tekrarlanırsa araştırılır.
3. **Zamanlanmış temizlik:** (a) Pages Secret `AKE_TEMIZLIK` (Production ve Preview), (b) GitHub Secrets `AKE_TEMIZLIK` ve `AKE_TEMIZLIK_URL`, (c) birleşmeden sonra workflow'un çalıştığının Actions'ta görülmesi, (d) Preview'da elle çağrıyla silmenin doğrulanması. GitHub zamanlamayı yalnızca `main`'den çalıştırır ve geç kalabilir; depo 60 gün etkinliksiz kalırsa kapatabilir.
4. **Gizlilik metni = gerçek davranış:** aydınlatmada "48 saat geçerli; süre dolunca otomatik temizlikle silinir, genellikle bir saat içinde, aksaklıkta gecikebilir" yazıyor. Bu cümle ancak 3. madde canlıda çalışırken doğrudur; çalışmıyorsa metin yayınlanmaz.
5. **İYS / izin süreci** ve ticari elektronik ileti hukuki kontrolü tamamlanmadı.
6. **Production D1:** `bekleme` tablosu yok. Önce `migrations/0004_erken_erisim.sql` onayla uygulanır (tekrar çalıştırmaya zarar vermez; test D1'de ve yerelde doğrulandı), sonra yayın.
7. **Gerçek telefonda test** yapılmadı (yalnız masaüstü/emülasyon).

## Birleştirme riskleri
- PR #38, #33, #10 ve `tasarim/ai-akis-inceleme` ile dosya çakışması olabilir (`index.html` üretilen dosya: `python3 docs/tasarim/uret.py` ile yeniden üretilmeli, elle çözülmemeli).
- PR #40 (test) ve PR #41 (soru API, sunucu davranışı) ayrı incelenir; bu dala bağlı değildir.

## Yayın günü
`node --test tests/*.test.mjs`; `uret.py` çıktısı `index.html` ile byte aynı; Preview'da dört ürün bağlantısı "Tükendi"; fiyat/satın alma çağrısı taraması; Production değişken ve secret var/yok kontrolü; ardından onayla Production.
