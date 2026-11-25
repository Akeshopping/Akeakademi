# Mobil uygulama – görsel karşılaştırma (güncel)

**Hepsi gerçek Android emülatör görüntüsüdür** (Pixel benzeri sdk_gphone64, Android 14, 390 dp; CI'da `flutter drive`). Veri **TEST VERİSİ**: sahte sunucu, gerçek hesap/AI/Production yok. Kanıt dalı: `kanit/pr43-f115713` (320 dp görüntüleri, açılış kayıtları ve ölçüm kayıtları orada).

## Uygulama ekranları (açık | koyu)
| Ekran | Açık | Koyu |
|---|---|---|
| Ana sayfa | ![](mobil-gorsel/uygulama/10-ana-acik.png) | ![](mobil-gorsel/uygulama/10-ana-koyu.png) |
| Soru çöz · sınav seçimi | ![](mobil-gorsel/uygulama/20-soru-sec-sinav-acik.png) | ![](mobil-gorsel/uygulama/20-soru-sec-sinav-koyu.png) |
| Soru çöz · Soru ara | ![](mobil-gorsel/uygulama/41-soru-ara-acik.png) | ![](mobil-gorsel/uygulama/41-soru-ara-koyu.png) |
| Deneme · başlangıç | ![](mobil-gorsel/uygulama/45-deneme-baslangic-acik.png) | ![](mobil-gorsel/uygulama/45-deneme-baslangic-koyu.png) |
| Deneme · soru (süre çalışıyor) | ![](mobil-gorsel/uygulama/46-deneme-soru-acik.png) | ![](mobil-gorsel/uygulama/46-deneme-soru-koyu.png) |
| Deneme · sonuç (net + çözümler) | ![](mobil-gorsel/uygulama/47-deneme-sonuc-acik.png) | ![](mobil-gorsel/uygulama/47-deneme-sonuc-koyu.png) |
| AI · paket kodu kapısı | ![](mobil-gorsel/uygulama/50-ai-kapi-acik.png) | — (aynı oturumda kod zaten bağlıydı) |
| AI · sohbet (sahte yanıt) | ![](mobil-gorsel/uygulama/51-ai-sohbet-acik.png) | ![](mobil-gorsel/uygulama/51-ai-sohbet-koyu.png) |
| Menü | ![](mobil-gorsel/uygulama/60-menu-acik.png) | ![](mobil-gorsel/uygulama/60-menu-koyu.png) |
| Gelişim | ![](mobil-gorsel/uygulama/61-gelisim-acik.png) | ![](mobil-gorsel/uygulama/61-gelisim-koyu.png) |
| Plan · görev ekle | ![](mobil-gorsel/uygulama/62-plan-gorev-ekle-acik.png) | ![](mobil-gorsel/uygulama/62-plan-gorev-ekle-koyu.png) |
| Plan · görevli | ![](mobil-gorsel/uygulama/63-plan-gorevli-acik.png) | ![](mobil-gorsel/uygulama/63-plan-gorevli-koyu.png) |
| Ayarlar | ![](mobil-gorsel/uygulama/70-ayarlar-acik.png) | ![](mobil-gorsel/uygulama/70-ayarlar-koyu.png) |
| Ayarlar · hesap silme onayı | ![](mobil-gorsel/uygulama/71-hesap-sil-onay-acik.png) | ![](mobil-gorsel/uygulama/71-hesap-sil-onay-koyu.png) |

## Site ile karşılaştırma — dürüst durum
- **Aynı veri + aynı ekran durumuyla site görüntüsü bu turda ÜRETİLEMEDİ.** Eski site referansları (`mobil-gorsel/ana.png`, `soru-merkezi.png`, `konu.png`, `gelisim.png`, `plan.png`, `ayarlar.png`) sitenin kendi sahte-API'li yerel çizimidir; verileri uygulamadaki test verisiyle **aynı değil** (ör. site Gelişim referansı boş durumdur). Bu yüzden onları "aynı görsel" diye yan yana koymadım; yalnız başvuru olarak duruyorlar.
- Eski yan yana tablo kaldırıldı; "Aynı görsel" yer tutucuları yok.
- Site tarafı için gereken: sitenin veri katmanına aynı sahte kullanıcı verisi verilip 390 px'te aynı ekranların alınması. Bu ayrı bir iş olarak **açık**.

## Bilinen görsel/işlev farkları (siteye göre)
| Alan | Fark |
|---|---|
| Alt menü | Site ile aynı: Ana sayfa · Soru çöz · Deneme · AI · Menü. Gelişim/Plan/Ayarlar Menü içinde. |
| Soru çöz sekmeleri | Konular, Soru ara, Paragraf var. **"ÖSYM tarzı" ve "AI ile üret" yok** (sunucuda karşılığı yok; düğme konmadı). |
| Deneme | Süreli, ders+soru sayısı seçmeli. **Bölümlü tam TYT/AYT ve canlı deneme yok.** Sonuç Gelişim geçmişine yazılmaz. |
| Plan | Görev ekle/işaretle/sil/haftayı sıfırla var. **Odak odası yok.** |
| Simgeler | Material simgeleri; sitenin özel simge seti taşınmadı. K amblemi, renkler ve yazı tipi siteyle aynı kaynaktan. |
| Durum çubuğu | Emülatör görüntülerinde üst şerit boş görünür (sistem durum çubuğu yakalanmıyor). |

## Açılış animasyonu
- Tasarım süresi 2,2 sn + 0,25 sn sönme = 2,45 sn (birim testi ≤2,5 sn doğrular). Son kare gerçek K amblemi; "Geç" ilk kareden var; ikinci açılışta oynamaz; "hareketi azalt" açıkken 0 ms.
- **CI emülatöründe ölçülen gerçek süre 3,2–3,6 sn** (320 dp: 3219 ms, 390 dp: 3569 ms); yazılım GPU'su yüzünden kareler 400–1100 ms. **2,5 sn hedefi emülatörde tutmadı; telefonda akıcılık kanıtlanmadı.**
