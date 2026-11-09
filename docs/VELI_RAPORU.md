# Haftalık veli raporu · kurulum ve yayın notları

Durum: **hazır ama kapalı.** `VELI_RAPORU` anahtarı `1` olmadan arayüz görünmez, hiçbir adres kabul edilmez, hiçbir e-posta gitmez.

## Parçalar
- `migrations/0001_veli_raporu.sql`: 4 yeni tablo (`veli_ayar`, `veli_token`, `veli_log`, `veli_denetim`). Mevcut tablolara dokunmaz. `sema()` bu tabloları kendiliğinden oluşturmaz; elle uygulanır.
- `lib/veli.js`: rapor hesabı, onay/iptal, gönderim, mükerrer engeli, yeniden deneme.
- `functions/api/veli/[[yol]].js`: öğrenci uçları (oturumlu) ve veli sayfaları (tek kullanımlık belirteçli).
- `functions/api/yonetim/[[yol]].js`: `GET veli` (yalnızca yönetici; öğrenci verisi yok).
- `workers/veli-rapor/`: cron Worker (Pages Functions cron desteklemez).

## Yayın sırası (her adım ayrı onay ister)
1. Hukuki değerlendirme: aydınlatma metni (`AYDINLATMA` in `lib/veli.js`), açık rıza, 18 yaş altı için veli/yasal temsilci süreci.
2. Migration: `wrangler d1 execute <DB_ADI> --remote --file=migrations/0001_veli_raporu.sql`
3. Worker: `workers/veli-rapor/wrangler.toml` içindeki D1 adı/kimliğini doldur, gizlileri ekle (`RESEND_API_KEY`, `AKE_GIZLI`), `wrangler deploy`.
4. Pages ve Worker'da `VELI_RAPORU=1`.

## Zamanlama
Türkiye saati UTC+3 sabit. Pazar 19.00 TR = pazar 16.00 UTC: `0 16 * * SUN`. Yeniden deneme: `0 18,20 * * SUN`.
Mükerrer engeli: `veli_log` içinde (öğrenci, ISO hafta, veli adresi özeti) tekil.

## Güvenlik
Belirteçler 24 baytlık rastgele, veritabanında yalnızca SHA-256 özeti; onay 48 saat, durdurma 35 gün; ikisi de tek kullanımlık (atomik). Bağlantıyı GET ile açmak durum değiştirmez (e-posta tarayıcıları belirteci tüketemez), POST gerekir. Adres değişince onay ve açık belirteçler iptal olur. Hesap silinince `veli_*` kayıtları silinir.

## Maliyet etkisi
- Resend: haftada abone başına 1 e-posta (+ onay e-postası). 100 aktif abone ≈ ayda 400 e-posta; Resend ücretsiz katman (3.000/ay) içinde.
- Cloudflare Worker cron: ücretsiz katman yeterli. D1: haftada abone başına birkaç okuma/yazma, ihmal edilebilir.
- AI maliyeti yok: rapor yalnızca kayıtlı sayılardan hesaplanır.

## Bilinen sınırlar
Çalışma süresi kaydedilmediği için raporda yok. Boş sayısı yalnızca deneme sınavlarında var. Ders bazında doğruluk haftalık olarak kaydedilmediğinden ders tablosu çözülen soru sayısını gösterir. "Tamamlanan test" olarak yalnızca deneme sınavları kayıtlıdır.
