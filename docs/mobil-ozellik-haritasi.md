# AKE Akademi · Site → Mobil uygulama özellik haritası

Durum etiketleri: **Gerçek** = çalışan sunucu API'siyle uygulamada çalışıyor · **Salt okunur** = hesap verisini okur, yazmaz · **Yok** = uygulamada yok (ekranda "Sitede var, mobilde henüz yok" diye açıkça yazılı, sahte düğme yok).

Mobil altyapı kuralları (değişmedi): Bearer oturum anahtarı, WebView yok, web belgelerine (`profile`, `stats`, `plan`) mobilden yazılmaz, soru bankası cevap anahtarı istemciye cevaptan önce gitmez.

| Site bölümü | Mobil | Durum | Not / neden |
|---|---|---|---|
| Giriş (e-posta + 8 haneli kod) | Giriş ekranı | **Gerçek** | `kod-gönder` / `kod-doğrula`, Bearer anahtar güvenli depoda; oturum bitince giriş ekranı gelir |
| Ana sayfa · karşılama, kalan gün | Ana sayfa | **Salt okunur** | `profile.examDate` (yoksa 2027-06-19), kalan gün yerelde hesaplanır |
| Ana sayfa · bugünün hedefi | Ana sayfa | **Salt okunur** | `stats.daily` + `profile.gunluk` (yoksa 40); veri yoksa uydurma yok |
| Ana sayfa · tekrar önerisi | Ana sayfa | **Salt okunur** | `stats.topic` içinde en az 5 soru çözülmüş en düşük başarılı konular |
| Ana sayfa · "Seni tanıyalım" (ad/alan düzenleme) | — | **Yok** | Profil yazma mobilde kapalı |
| Soru çöz (Stüdyo) · sınav → ders → konu | Soru çöz sekmesi | **Gerçek** | `GET /api/soru/ozet` |
| Soru çöz · zorluk (Karışık/Kolay/Orta/Zor) | Konu ekranı | **Gerçek** | `oturum` isteğinde `zorluk: 1\|2\|3`; seçilmezse alan gönderilmez |
| Soru çöz · soru, 5 şık, cevap, açıklama, sonuç | Soru ekranı | **Gerçek** | `oturum` / `cevap` / `bitir`; cevap anahtarı cevaptan sonra gelir |
| Soru çöz · ilerleme senkronu | Arka planda | **Gerçek** | `POST /api/soru/ilerleme` (sunucu kendi kaydından işler; istemci sayaç göndermez) |
| Soru çöz · "Soru ara", "ÖSYM tarzı", "Paragraf", "AI ile üret" sekmeleri | — | **Yok** | Mobil için API sözleşmesi hazır değil |
| Deneme | Ana sayfada "Sitede var" kartı | **Yok** | Deneme akışı mobilde yok (sunucuda `exam` modu var, arayüzü yapılmadı) |
| AI öğretmen | Ana sayfada "Sitede var" kartı | **Yok** | Premium + çerez oturumu; Bearer ile AI ucu yok |
| Planım | Plan sekmesi | **Salt okunur** | `plan.tasks`; görev ekleme/işaretleme mobilde yok (yazma kapalı) |
| Gelişimim | Gelişim sekmesi | **Salt okunur** | Günlük çözülen/doğru, konu başarısı; site rozet/seri/grafik ayrıntıları yok |
| Ayarlar · görünüm | Ayarlar | **Gerçek** | Sistem / Açık / Koyu (yerel) |
| Ayarlar · çıkış | Ayarlar | **Gerçek** | `POST /api/hesap/cikis` + yerel anahtar silme |
| Ayarlar · hedef, odak odası, bildirimler | — | **Yok** | Profil yazma ve bildirim altyapısı mobilde yok |
| Hesap silme | — | **Yok** | Mobilden yapılamaz; ekranda söylenir (web'de yapılır) |
| Arkadaş ligi, Sınıfım | — | **Yok** | Sosyal API'leri Bearer ile açılmadı |
| Paketler ve Üyelik / ödeme | — | **Yok** | Bu turda ödeme canlıya açılmadı; mağaza faturalaması sandbox doğrulaması ve 20/B hazırlığıyla sonra |

## Alt gezinme farkı (bilinçli)

Sitenin mobil alt çubuğu: Ana sayfa · Soru çöz · Deneme · AI · Menü. Uygulamada Deneme ve AI yok, bu yüzden ölü sekme koymak yerine çalışan ekranlar öne alındı: Ana sayfa · Soru çöz · Gelişim · Plan · Ayarlar. Deneme ve AI, ana sayfadaki "Sitede var, mobilde henüz yok" kartında görünür.
