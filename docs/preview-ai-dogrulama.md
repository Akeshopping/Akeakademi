# Preview'da gerçek AI yanıtını doğrulama (Atılım vaadi)

Amaç: Atılım'ın vaat ettiği "AI öğretmen" yanıtını **gerçek** `/api/ai` çağrısıyla Preview'da görmek. Hiçbir değer bu dosyaya yazılmaz; sırlar yalnız Cloudflare panelinde tutulur.

## Cloudflare Pages → Preview ortamında olması gerekenler
| Ad | Tür | Durum |
|---|---|---|
| `ANTHROPIC_API_KEY` | Secret | **Yok olduğu bilinen eksik.** Yoksa `/api/ai` 500 `yapilandirma` döner. |
| `DB` | D1 bağlaması | `akeakademi-preview-test` (var; Production D1'ine bağlı OLMAMALI) |
| `AKE_GIZLI` | Secret | Var olmalı (erişim kodu ve hesap kimlikleri) |
| `AKE_MODEL_HIZLI`, `AKE_MODEL_GUCLU`, `AKE_EFOR_GUCLU` | Değişken | İsteğe bağlı; yoksa koddaki varsayılanlar |
| `AKE_LIMIT_ORTA` | Değişken | İsteğe bağlı; yoksa Atılım 200 mesaj/ay. Maliyet için Preview'da düşük tut |
| `AKE_MAGAZA` | Değişken | `sandbox` (mağaza testi için); AI testi için gerekmez |

## Doğrulama adımları
1. Preview'da test hesabıyla giriş yap. Atılım erişimi için ya Play lisans testiyle satın alma (sunucu doğrular) ya da test erişim kodu kullan.
2. AI sekmesinde bir soru sor. Beklenen: gerçek bir model yanıtı; Network'te `POST /api/ai` 200.
3. Aylık sayaç: Paketler ekranındaki "kalan mesaj" bir azalır.
4. Hak bitişi: `AKE_LIMIT_ORTA`'yı 1-2 yap, hakkı bitir; uygulama "hak doldu" göstermeli (429 `kota`).
5. Anahtarsız davranış: anahtar yokken uygulamanın anlaşılır hata gösterdiğini bir kez gör, sonra anahtarı ekle.

Production'a hiçbir anahtar eklenmez ve Production D1'ine dokunulmaz.
