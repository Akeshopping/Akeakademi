# Çevrimdışı inceleme + uzman kararı akışı (fabrika)

Durum: yerel dalda (`fabrika-cevrimdisi-inceleme`), **push yok, deploy yok, production'a yazma yok.**

## Neden
Yayım kapısı yalnız ücretli kör model denetimini (`model_durum='gecti'` + `denetim_tam=1`) tanır. Claude sohbetinde/kodla yapılan çevrimdışı inceleme o denetim **değildir**; bu akış onu ayrı kayıt olarak tutar ve öyle görünmesine izin vermez.

## Akış
1. **İçe al** `POST /api/yonetim/fabrika-cevrimdisi-ice-al` `{kayit, neden}` — soru yoksa taslak yazar; taslak olarak varsa ve içerik farklıysa yeni sürüm yapar (`fabrika_surum`: eski json, yeni json, neden, kim). `model_durum='cevrimdisi_bekliyor'`.
2. **Çevrimdışı inceleme** `POST .../fabrika-cevrimdisi` `{soru_id, sonuc, arac, kapsam, bulgular}` — kapsam anahtarları: `bagimsiz_cozum, cozum_metni, celdirici, dil, guclu_etiketi, benzerlik` (`yapildi|yapilmadi`). `gecti` için hepsi `yapildi` ve engelleyici bulgu yok. `model_durum` = `cevrimdisi_gecti|revizyon|ret`; **asla `gecti`**, `denetim_tam` 0, `model_denetimi` daima `yapilmadi`.
3. **Uzman kararı (insan)** `POST .../fabrika-uzman` — mevcut uç; artık aynı batch'te `fabrika_uzman_baglam` (h, a, x, d) anlık görüntüsü de yazılır.
4. **Yayım kararı** `POST .../fabrika-karar` `{id, karar:"yayin", cevrimdisiKabul:true}` — yalnız sunucuda `AKE_CEVRIMDISI_YAYIM=1` iken (varsayılan KAPALI).
5. İzleme: `GET .../fabrika-cevrimdisi-durum` — her soru için eksik insan kararları.

## Bağlama
Atomik SQL geçidi (`GECIT_CEVRIMDISI_SQL`): son çevrimdışı kayıt `gecti` ve `h, a, x, d` soru ile birebir; uzman `kabul` kaydı aynı `h` + `a, x, d` bağlamıyla; uzman `red` / açık `uzman_bekliyor` notu yok; tekrar yok. İçerik (çözüm metni ve güçlük dahil) değişirse inceleme ve uzman kabulü otomatik geçersiz olur. Kayıt tabloları değiştirilemez/silinemez (tetikleyici).

## Değişmeyenler
`soruYazKanonik` canlı durum yazmaz · `fabrika_uzman_yayim_kapisi` tetikleyicisi · `soruOnayla` atomik batch + final ASSERT · uyarı kapısı · model denetimi yolu (bayrak/istek yokken davranış aynı).

## Production göç planı (UYGULANMADI)
Production D1 (`akeakademi-db`) eski şemada: `soru(id,s,t,d,json,durum,tarih,karar)`, 89 satır (89 onayli), `fabrika_*` tablosu yok. Akış yalnız kanonik şema (kaynak, rk, h, govde, a, x, grup, kopya_of) ve `AKE_SORU_V2=1` ile çalışır. Gereken (ayrı insan onayı ile, `docs/soru-bankasi-production-migration.md` PHASE A–M): kilit aç → yedek + Time Travel bookmark → dry-run (conflict/invalid 0) → onay belirteci → nullable kolon ekleme + veri → indeks → doğrula → `AKE_SORU_V2=1` + smoke → kilidi kaldır. Sonra kod deploy'u (`fabrikaSema` yeni tabloları kendisi kurar). `AKE_CEVRIMDISI_YAYIM=1` en son ve ayrı onayla.
