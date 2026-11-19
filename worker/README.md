# Soru Fabrikası Worker'ı

Ayrı Cloudflare Worker (cron, her dakika). Kuyruk D1'dedir; Worker her turda en çok 3 iş alır. Robot anahtarı kapalıyken hiçbir model çağrısı yapmaz. Yönetim uçları (Pages Functions) model çağırmaz; yalnız durumu yönetir.

## Kurulum için EKSİK AYARLAR (hiçbiri bu repoda yazılı değildir)
1. `wrangler.toml` içindeki `database_name` / `database_id`: Pages projesindeki **aynı D1** veritabanı.
2. Secret: `cd worker && npx wrangler secret put ANTHROPIC_API_KEY` (değer terminalde girilir; repoya, tarayıcıya, loga yazılmaz).
3. Pages projesinde `AKE_SORU_V2=1` (kanonik soru şeması). Worker `[vars]` içinde de var.
4. `npx wrangler deploy` (Worker yayımı). Pages tarafı deploy'u robotun varsayılanını değiştirmez: robot KAPALI başlar.
5. Opsiyonel: `AKE_FABRIKA_MODEL_URETIM`, `AKE_FABRIKA_MODEL_DENETIM` (varsayılan `claude-sonnet-5-5`), `AKE_FABRIKA_GUNLUK_CAGRI` (varsayılan 40).

## Açma sırası
Yönetim paneli → Soru Fabrikası robotu → "Robotu aç" → "10 soruluk pilotu başlat". Sonuçlar inceleme kuyruğunda görünür; canlıya yalnız "Yayımla" ile geçer.
