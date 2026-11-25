# Gerçek telefon test listesi · mağaza satın alma (sandbox)

**Bu liste GERÇEK Android telefon ve GERÇEK iPhone için.** Android emülatörü ve iOS simülatörü ekran kanıtları (CI'daki yürüyüş) bunun yerine geçmez ve burada "gerçek telefon kanıtı" diye sayılmaz.
Önce `docs/magaza-odeme-kurulum.md` tamamlanmış olmalı (ürünler, test kullanıcıları, Preview değişkenleri). Hepsini **Preview** uygulamasıyla yap; gerçek para çekilmez (Google lisans testçisi / Apple Sandbox).

Her satırda: ✅ geçti / ❌ kaldı + ekran görüntüsü. Kalan satırın ne olduğunu yaz.

## Android (Google Play, lisans testçisi Gmail hesabıyla)
| # | Adım | Beklenen |
|---|---|---|
| A1 | Kapalı test sürümünü Play'den yükle, test Gmail'iyle Play'e giriş yap, AKE hesabına giriş yap | Giriş çalışır |
| A2 | Menü → Paketler | 4 abonelik, **fiyatlar Play'den** (₺…); "mağazada hazır değil" yazan satır yok |
| A3 | Atılım aylık → satın al → Play penceresi → onayla | "Paketin açıldı"; Paketler "Atılım paketindesin · … tarihine kadar"; "TEST satın alması" notu |
| A4 | Ayarlar → hesap durumu | Paketli hesap görünür; AI öğretmen açılır |
| A5 | Uygulamayı kapat-aç | Paket yerinde |
| A6 | Premium yıllık satın al (yükseltme) | Premium görünür |
| A7 | Satın alma penceresinde **Vazgeç** | "Satın alma iptal edildi. Ücret alınmadı."; paket değişmez |
| A8 | Play'de test kartını "yavaş test kartı/onay bekleyen" ile dene (varsa) | "Ödeme onay bekliyor"; paket **açılmaz**; onaylanınca açılır |
| A9 | Uçak modunda satın alma sonrası sunucuya ulaşılamasın (satın alma bitince ağı kes) | "mağazada kayıtlı ama doğrulanamadı" + **Yeniden dene**; ağ gelince çalışır, paket açılır |
| A10 | Uygulamayı sil, yeniden yükle, giriş yap → **Satın almalarımı geri yükle** | Paket geri gelir |
| A11 | **Başka AKE hesabıyla** giriş yap → Geri yükle | Paket **açılmaz**, "başka bir AKE hesabına ait" mesajı |
| A12 | Play'de aboneliği iptal et | Süre bitene kadar erişim sürer |
| A13 | Test aboneliği süresi kısadır (Play test aboneliği dakikalarla yenilenir): birkaç yenileme bekle | Bitiş tarihi uzar; Google yenilemeyi durdurunca erişim kapanır |
| A14 | Play → Siparişler → siparişi iade et | En geç ~6 saat içinde (ya da uygulamayı açınca) paket kapanır |
| A15 | Erişim kodu bağla (varsa) + mağaza aboneliği | En yüksek paket geçerli |
| A16 | Hesabı sil | Hesap silinir; uygulama abonelik iptali için Play'e yönlendirmeyi anlatır (abonelik **kendiliğinden iptal olmaz**) |

## iPhone (Apple Sandbox hesabıyla, TestFlight derlemesi)
| # | Adım | Beklenen |
|---|---|---|
| I1 | TestFlight'tan yükle; Ayarlar → App Store → Sandbox Hesabı ile gir; AKE hesabına giriş yap | Giriş çalışır |
| I2 | Menü → Paketler | 4 abonelik, **fiyatlar App Store'dan** |
| I3 | Atılım aylık → satın al → Sandbox onay penceresi ("[Environment: Sandbox]") | "Paketin açıldı"; paket görünür |
| I4 | Uygulamayı kapat-aç | Paket yerinde |
| I5 | Satın alma penceresinde **İptal** | "Satın alma iptal edildi"; paket değişmez |
| I6 | Uçak modu senaryosu (A9 ile aynı) | "doğrulanamadı" + Yeniden dene; sonra açılır |
| I7 | Uygulamayı sil, yükle, giriş → **Satın almalarımı geri yükle** | Paket geri gelir |
| I8 | **Başka AKE hesabıyla** Geri yükle | Paket açılmaz (A11 ile aynı beklenti). Beklenen sonuç budur. Ayrıca I3'te satın alma "başka bir AKE hesabına ait" diye REDDEDİLİRSE Apple `appAccountToken` eklentiden gitmiyor demektir: bana yaz (belirteçsiz işlem bilerek kabul edilmiyor) |
| I9 | Sandbox aboneliği (dakikalarla yenilenir): yenilemeleri bekle | Bitiş uzar; sandbox yenileme limitine ulaşınca erişim kapanır |
| I10 | Ayarlar → Apple Kimliği → Abonelikler'den iptal et | Süre bitene kadar erişim sürer |
| I11 | Sandbox'ta iade/geri alma (App Store Connect sandbox "Satın alma geçmişini yönet" ile) | Paket kapanır |
| I12 | Hesabı sil | A16 ile aynı |

## Sunucu tarafı kontrol (ikisi için)
- Cloudflare Preview günlüklerinde mağaza isteklerinin `200`/`404` döndüğünü, `403 canli_islem_kapali` ya da `503 yapilandirma` görünmediğini kontrol et. `503 yapilandirma`: Cloudflare değişkenlerinden biri eksik.
- Production'da `AKE_MAGAZA` **olmamalı**; Production'daki uygulama Paketler ekranında "henüz açık değil" görmeli.

## Bu listenin kanıtladığı / kanıtlamadığı
Bu listeyi cihazda geçmek "sandbox satın alma doğrulandı" demenin koşuludur. CI testleri sahte mağaza ve sahte sunucuyla çalışır; gerçek Google/Apple yanıtı kullanmaz.
