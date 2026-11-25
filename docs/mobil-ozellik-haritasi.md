# AKE Akademi · Site → Mobil uygulama özellik haritası

Durum etiketleri: **Gerçek** = sunucu API'siyle çalışan akış (testler sahte sunucuyla; canlı hesapla denenmedi)  · **Salt okunur** = hesap verisini okur, yazmaz · **Yok** = uygulamada yok (ekranda "Sitede var, mobilde henüz yok" diye açıkça yazılı, sahte düğme yok).

Mobil altyapı kuralları (değişmedi): Bearer oturum anahtarı, WebView yok, web belgelerinden yalnız `profile` ve `plan` koşullu (CAS) yazılır, `stats`'a mobilden yazılmaz, soru bankası cevap anahtarı istemciye cevaptan önce gitmez.

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
| Soru çöz · "Soru ara" sekmesi | Soru çöz → Soru ara | **Gerçek** | `oturum` isteğine `ara` (en çok 80 karakter, sunucuda LIKE ile; bu turda sunucuya eklendi, testli, Production'a dağıtılmadı) |
| Soru çöz · "Paragraf" sekmesi | Soru çöz → Paragraf | **Gerçek** | Türkçe/Paragraf konusuyla oturum |
| Soru çöz · "ÖSYM tarzı", "AI ile üret" sekmeleri | — | **Yok** | Sunucuda karşılığı yok (soru bankasında ÖSYM etiketi / üretim ucu yok); düğme konmadı |
| Deneme (süreli, ders ve soru sayısı seçmeli) | Deneme sekmesi | **Gerçek (kısmi)** | `oturum` `mod: exam`; cevap anahtarı bitene kadar gelmez; net = doğru − yanlış/4. Ücretsiz hesapta aylık deneme hakkı sunucuda. Oturum (TYT/AYT/SAY/EA/SÖZ/YDT/Serbest), uzunluk (tam/yarım/mini/özel), bölüm tablosu ve süre ayarı var; `bolumler` sunucu sözleşmesiyle gerçek bölümlü oturum kurulur (Preview'da 5 soruluk bölümlü oturum alındı). **Yok:** canlı deneme. Biten deneme sonucu Gelişim'e (`stats` + `exams`) yazılır ve "Geçmiş denemeler"de görünür (sentetik hesapla Preview'da doğrulandı) |
| AI öğretmen | AI sekmesi | **Gerçek (sahte yanıtla test edildi)** | `POST /api/ai` (Bearer, paket kodu gerekir, aylık kota sunucuda). Kod bağlama: `POST /api/hesap/kod-bagla`. Testler sahte sunucuyla; **gerçek AI çağrısı yapılmadı** |
| Planım | Menü → Plan | **Gerçek** | Görev ekle/düzenle/işaretle/sil, haftayı sıfırla; `plan` belgesi koşullu yazma (`_b`/`_h`), 409'da yeniden okuyup dener; bilinmeyen alanlar korunur |
| Gelişimim | Menü → Gelişim | **Salt okunur** | Günlük çözülen/doğru, konu başarısı; site rozet/seri/grafik ayrıntıları yok |
| Ayarlar · görünüm | Menü → Ayarlar | **Gerçek** | Sistem / Açık / Koyu (yerel) |
| Ayarlar · profil (ad, alan, günlük hedef, sınav tarihi) | Menü → Ayarlar | **Gerçek** | `profile` belgesi koşullu yazma; bilinmeyen alanlar korunur |
| Ayarlar · çıkış | Menü → Ayarlar | **Gerçek** | `POST /api/hesap/cikis` + yerel anahtar silme |
| Plan · Odak odası | Plan sayfası | **Gerçek (testli; Preview'da uç doğrulandı)** | Odak 25 / Mola 5 dk, Başlat·Duraklat·Devam·Sıfırla; süre duvar saatinden hesaplanır (arka plana gidip dönünce, uygulama kapanıp açılınca doğru); biten tur `POST /api/soru/odak` ile günlük odak dakikasına yazılır (tur kimliği tek seferlik, tekrarda çift sayılmaz, günde en çok 16 tur). Süre dolunca bildirim yok |
| Ayarlar · bildirimler | — | **Yok** | Bildirim altyapısı mobilde yok |
| Hesap silme | Menü → Ayarlar | **Gerçek (sahte sunucu + Preview'da sentetik hesap)** | `POST /api/hesap/sil`; "SİL" yazılmadan düğme pasif. Preview'da uygulamanın silme işlemi şunları temizledi: `soru_oturum_soru` 5, `soru_oturum` 1, `ilerleme_olay` 2 (odak turları dahil), `veri` 3, `oturum` 1, `kullanici` 1. Kullanılmış `kod` satırı bilerek silinmez: `kid='silindi'` yapılır (denendi). Bu satırı uygulama silmez; test artığı olarak **elle** hedefli DELETE ile temizlendi. **Production'da denenmedi** |
| Arkadaş ligi, Sınıfım | — | **Yok** | Sosyal API'leri Bearer ile açılmadı |
| Paketler ve Üyelik / ödeme | — | **Yok** | Bu turda ödeme canlıya açılmadı; mağaza faturalaması sandbox doğrulaması ve 20/B hazırlığıyla sonra |

## Alt gezinme

Site ile aynı: Ana sayfa · Soru çöz · Deneme · AI · Menü. Gelişim, Plan ve Ayarlar Menü içinden açılır; Android geri tuşu önce alt sayfadan Menü'ye, sonra Ana sayfaya, en son uygulamadan çıkar.
