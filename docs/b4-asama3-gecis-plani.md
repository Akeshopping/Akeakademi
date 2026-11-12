# B4 · Aşama 3 geçiş planı (3A hazır · 3B ve 3C onay bekler)

## Gerçek açıklar (3A'da doğrulandı)
| # | Kaynak | Durum | Kapanış |
|---|---|---|---|
| 1 | `index.html` içindeki `BANK` (728 soru, a/x ile) + `allQ()` (11 yer) / `BANK` (42 yer) | herkese açık, girişsiz | 3B (istemci kataloğa geçer) → 3C (BANK silinir) |
| 2 | `/sorular/*.json` (399 soru, a/x ile) | herkese açık | 3C (`AKE_SORU_ESKI_KAPAT=1`, sonra dosya silme) |
| 3 | `/api/sorular` → `SELECT json` (onaylı satırlar a/x ile) | herkese açık, 5 dk önbellekli | 3C (`AKE_SORU_ESKI_KAPAT=1` → boş liste) |
| 4 | tarayıcı `ake.ek` (3'ten gelen a/x'li kopya), `ake.run` | yalnız 1–3 kaynaklıysa anahtar taşır; V2 oturum soruları anahtarsız (istemci testi geçti) | 3B (`ake.ek` temizliği) |
| 5 | Service Worker | `/api/` ve `/sorular/` önbelleğe alınmaz; ama önbelleğe alınan `/` (index.html) BANK'ı taşır | 3B/3C (BANK kalkınca kendiliğinden kapanır; SW sürümü artırılır) |
Kapalı olduğu kanıtlananlar: `/api/soru/*` (oturum öncesi anahtar yok; deneme bitmeden anahtar yok; alıştırmada yalnız cevaplanan soru), `/api/soru/katalog`, `/api/soru/ozet`, canlı sınav (anahtar `sonucZamani`ndan sonra).

## Veri kaybı riski (os / fix)
`gomuluBankaCikar` yalnız id,s,t,d,p,q,o,a,x alır; BANK'taki **52 `os` (ÖSYM işareti)** ve **37 `fix` (şık sırası sabit)** göçte düşüyordu.
27 `fix` sorusunu istemci sezgisi (`sabitSira`) yakalamaz → BANK kalkınca şıklar karışırdı. 3A: yeni `soru_meta` tablosu + `fabrika/soru-bayrak-doldur.mjs`.
Yerel prova (gerçek çıkarım, 1127 satırlık yerel SQLite): 89 bayraklı soru, 89 eşleşme, 0 eşleşmeyen; tekrar çalıştırma aynı sonuç.

## 3A (bu dal) · sunucu hazırlığı — canlı davranışı değiştirmez
- **Otomatik DDL YOK.** API `soru_meta` oluşturmaz; `SEMA_SQL`'de yoktur. Şema yalnız `migrations/0003_soru_meta.sql` (yeni tablo, `IF NOT EXISTS`, tekrar çalıştırılabilir) ile ve **açık onayla** uygulanır (önce Preview, sonra Production). `soru` tablosuna ALTER/UPDATE/DELETE yok.
- Tablo yoksa / boşsa / işaret satırı yoksa API çökmez: sorular verilir, yanıtta `bayrak: "eksik"` bildirilir (sessiz "bayraksız" iddiası yok). `bayrak: "hazir"` yalnız `#doldu` işaret satırı varsa döner; bu satırı araç, kaynakla BİREBİR doğruladıktan sonra yazar.
- `/api/soru/oturum` ve `/katalog` sorularına gerekirse `os:1`, `fix:1` eklenir (cevap anahtarı değil). Puanlama bu bayraklardan bağımsızdır (seçim hep orijinal şık indeksiyle gider).
- Fail-closed koruma: izin listesi (`id,s,t,d,p,q,o,os,fix`) dışı alan varsa yanıt 500 `sizinti_engellendi`.
- `index.html`: `svBaslat` sunucu bayrağını soruya taşır (tek satır); yerel BANK işareti korunur.
- Araç: `node fabrika/soru-bayrak-doldur.mjs --local-db <dosya> [--apply | --dogrula]` (uzak D1 yazımı yok: `--remote` HARD STOP). `--apply` önce yazar, sonra doğrular, yalnız tam eşleşmede işaret satırını yazar.
- **BANK kaldırma KAPISI (3C ön koşulu):** Preview/Production'da `bayrak: "hazir"` + `--dogrula` başarılı (52 os / 37 fix). Aksi halde 27 sabit-sıra sorusunun şıkları (sezgi yakalamaz) karışır.

## 3B · istemci geçişi (onay + ayrı dal; BANK/JSON hâlâ silinmez)
1. 3A'yı Preview'a al (DDL otomatik değil: önce `migrations/0003_soru_meta.sql` ayrı onayla elle uygulanır). Sonra `soru_meta` yedek + dry-run + ayrı onayla doldurulur (uzak sürücü 3B'de eklenir) ve `--dogrula` ile işaret satırı doğrulanır.
2. İstemci kataloğu `/api/soru/katalog` (cevapsız) ile kurar; `fabrikaYukle` ve `/api/sorular` kullanımı kapatılır; `ake.ek` temizlenir.
3. Karar gerektirenler: girişsiz (anonim) gezinme, SEO sayfasındaki 12 örnek cevap, Günlük soru / Yanlış defteri / gen / AI sorularının yerel akışı, ÖSYM filtresi (`osymElle`) katalog `os` bayrağına bağlanır.
4. Preview'da gerçek test (giriş, alıştırma, deneme, yanlış defteri, premium, canlı sınav, yönetici).

## 3C · kapatma ve temizlik (ayrı onay)
1. Preview'da `AKE_SORU_ESKI_KAPAT=1` → `/api/sorular` boş, `/sorular/*` 404; testler; sonra Production.
2. Yalnız ondan sonra: `BANK`, `/sorular/*.json`, `fabrika/yazim` kaynaklarının depodan çıkarılması (dosya silme onayı) ve SW sürümü.
3. Zaten sızmış 399 + 728 sorunun yenilenmesi (cevapları kopyalanmış olabilir).

## Geri alma
- 3A: kod geri alınır ya da dal birleştirilmez. Tablo hiç oluşturulmadıysa geri alınacak bir şey yoktur; oluşturulduysa bırakılabilir (zararsız) veya `DROP TABLE soru_meta`. Hiçbir mevcut tablo/kolon değişmedi.
- 3B: istemci değişikliği geri alınır (BANK/JSON yerinde).
- 3C: `AKE_SORU_ESKI_KAPAT` kapatılır → eski yollar yeniden açılır; silinen dosyalar git geçmişinden dönebilir (BANK silme ayrı commit olmalı).
