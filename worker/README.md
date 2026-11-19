# Soru Fabrikası Worker'ı (yalnız ÖNİZLEME pilotu)

Ayrı Cloudflare Worker (cron, her dakika). Kuyruk D1'dedir; Worker her turda en çok 3 iş alır. **Robot kapalıyken model çağrısı yapmaz**, yalnız tek bir günlük satırı yazar. Yönetim uçları (Pages Functions) model çağırmaz.

`wrangler.toml` yalnız `onizleme` ortamını tanımlar. Üst düzeyde (production) D1, cron ya da değişken **yoktur**; `--env onizleme` olmadan deploy hiçbir şeyi canlıya bağlayamaz (`wrangler deploy --dry-run` ile doğrulandı).

> **Dikkat:** Worker'ın ilk turu, bağlı D1'de `fabrika_*` tablolarını kurar ve `soru` tablosuna kanonik kolonları ekler. Bu yüzden `DB` bağlantısı **mutlaka Preview D1** olmalıdır, production D1 değil.

## 1) Preview `DB` bağlantısını ve `AKE_SORU_V2`'yi doğrula (Cloudflare panelinde)
1. dash.cloudflare.com → **Workers & Pages** → **akeakademi** (Pages projesi) → **Settings** → **Bindings** (eski arayüzde *Functions*).
2. D1 satırlarında **DB** için **Preview** ve **Production** değerlerini karşılaştır. Preview'daki D1'in **adını** not et.
3. **Storage & databases → D1 SQL database** → o veritabanına tıkla → **Database ID** (UUID) değerini kopyala.
4. **Preview ve Production'daki DB aynı veritabanıysa DUR:** Preview, canlı veriye bağlı demektir. Önce ayrı bir Preview D1 oluşturup Preview `DB` bağlantısını ona çevir (**Settings → Bindings → Preview**).
5. Aynı proje → **Settings → Variables and secrets** → **Preview** sekmesi: `AKE_SORU_V2 = 1` olmalı (yoksa ekle). Pages Preview'da `AKE_FABRIKA_GUNLUK_CAGRI` boşsa varsayılan zaten 40'tır.

## 2) Worker'ı Preview D1'e bağla
`worker/wrangler.toml` içinde iki yer tutucuyu doldur: `database_name` ve `database_id` (1. adımdaki Preview D1). Sonra, bilgisayarında:
```
cd worker
npx wrangler login
npx wrangler deploy --env onizleme
```
Bu, **ake-fabrika-worker-onizleme** adlı Worker'ı oluşturur (cron her dakika; `AKE_SORU_V2=1`, `AKE_FABRIKA_GUNLUK_CAGRI=40`).

## 3) `ANTHROPIC_API_KEY` Secret'ı (değeri yalnız sen girersin)
**Workers & Pages → ake-fabrika-worker-onizleme → Settings → Variables and secrets → Add** → Type: **Secret** → Name: `ANTHROPIC_API_KEY` → değeri yapıştır → **Deploy**.
(Alternatif: `npx wrangler secret put ANTHROPIC_API_KEY --env onizleme`.) Anahtar repoya, tarayıcıya ya da günlüğe yazılmaz.

## 4) Robot kapalıyken doğrulama (hiçbir şey açma)
- **Workers & Pages → ake-fabrika-worker-onizleme → Observability / Logs** (canlı günlük): 1-2 dakika içinde şu satır görünmeli:
  `fabrika-worker {"d1":"baglandi","robot":false,"islenen":0,"neden":"robot_kapali","gunlukLimit":40,"anahtar":"tanimli"}`
  - `d1_yok` hatası → D1 bağlantısı yok (toml yer tutucuları ya da binding).
  - `"gunlukLimit":40` değilse `AKE_FABRIKA_GUNLUK_CAGRI` yanlış.
  - `"anahtar":"yok"` → Secret girilmemiş.
- **D1 → Preview veritabanı → Console:** `SELECT COUNT(*) FROM fabrika_cagri;` → **0** (hiç model çağrısı yok). `SELECT k, v FROM fabrika_ayar;` → `robot` satırı yok ya da `0`.
- Preview sitesi yönetim paneli → **Soru Fabrikası robotu**: "Robot KAPALI", "Günlük model çağrısı: 0/40".

Bu adımlarda **robotu açma, pilot başlatma, soru yayımlama yok.** Açma sırası (ayrı onayla): panel → "Robotu aç" → "10 soruluk pilotu başlat"; canlıya yalnız "Yayımla" ile geçer.
