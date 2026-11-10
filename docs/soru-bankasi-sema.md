# Korumalı soru bankası · D1 şeması ve göç (PR 1/6, karanlık altyapı)

Bu belge soru METNİ içermez. PR 1 hiçbir canlı davranışı değiştirmez: `lib/soru-kanonik.js` ve `fabrika/soru-migrate.mjs` hiçbir
`functions/` dosyasından, `index.html`'den ya da service worker'dan içe aktarılmaz; üretim D1'ine yazılmaz.

## `soru` tablosu (mevcut sütunlar korunur) + yeni sütunlar

| Sütun | Anlam |
|---|---|
| `id, s, t, d, json, durum, tarih, karar` | MEVCUT. Silinmez, yeniden adlandırılmaz. |
| `kaynak` | `gomulu` / `statik` / `ai` |
| `rk` | 0..2147483647 kararlı rastgele seçim anahtarı; eklenirken BİR KEZ atanır, göç tekrarında değişmez |
| `h` | kanonik içerik özeti (SHA-256). **UNIQUE DEĞİL**; normal indeks `soru_h` |
| `govde` | yalnız `{"p"?,"q","o":[5]}`; `p` yoksa/boşsa alan hiç yazılmaz |
| `a`, `x` | doğru şık (0-4) ve çözüm |
| `grup` | ortak pasaj grubu (PR 2'de doldurulur; PR 1'de NULL) |
| `kopya_of` | tam içerik kopyasında kanonik kimlik (yeni seçimde `WHERE kopya_of IS NULL`) |

**`json` DEPRECATED LEGACY'dir.** İçinde p/q/o ile birlikte `a/x` de bulunur ve PR 1 boyunca bulunmaya devam eder (geri dönüş güvenliği).
Yeni sunucu API'si ASLA `SELECT json` ile soru döndürmez; yalnız açık sütunlardan (`govde`, `a`, `x`, ...) çalışır.
"a/x ayrı sütuna alındı, artık json'dan sızamaz" ifadesi YANLIŞTIR: `json`, kapanış PR'ında gövde-only yapılana ya da kullanımdan
kalkana kadar a/x içerir. Göçle eklenen yeni satırlarda `json` NULL bırakılır.

### Göçle gelen satırların `durum` değeri: `banka`
Legacy uçlar yalnız `durum = 'onayli'` (`/api/sorular`) ve `'bekliyor'`/`'onayli'` (yönetim paneli) okur. Göçle eklenen 927 satır
`banka` durumunda olduğu için bu uçlara görünmez; böylece `/api/sorular` çıktısı ve istemci davranışı değişmez. Mevcut `ok-*`
satırlarının `durum/tarih/karar` değerleri aynen korunur. Sonraki PR'lar seçimi `banka` (ve geçişte `onayli`) üzerinden yapar.

## Kanonik içerik özeti `h`
`SHA-256( s \n normalize(p) \n normalize(q) \n normalize(o[0]) … normalize(o[4]) )`; `normalize` = Unicode NFC + boşlukları tek boşluğa indir + kırp
(büyük/küçük harf korunur). Şıklar KONUMSAL sıradadır (yeniden sıralanmış şıklar farklı içeriktir).

**`a/x` özete DAHİL DEĞİL.** "Aynı soru"yu gövde+şıklar tanımlar. `a/x` farklıysa bu iki ayrı soru değil bir editoryal ÇATIŞMADIR ve
sessizce kopya sayılmaz: ayrı `cevap_hash` ile yakalanır, raporlanır ve uygulamayı durdurur (`cevap`, `cevap_farki_kopya`).
Yalnız `q` aynı olan sorular kopya sayılmaz (`kopya_of` verilmez), yalnız `q_only_duplicate` olarak sayılır.

## Göç kuralları (`fabrika/soru-migrate.mjs`)
- A) kimlik D1'de yok → ekle (`durum='banka'`, `rk` ata). B) kimlik var, özet aynı → no-op (yalnız boş yeni sütunları `COALESCE` ile doldurur).
  C) kimlik var, özet farklı → HARD CONFLICT: overwrite yok, apply başarısız.
- Kimlikler birebir korunur. Hiçbir satır silinmez. Geçersiz soru raporlanır ve apply'i durdurur. Tek işlem: ya hepsi ya hiçbiri.
- Kopya kanonik seçimi deterministik: kaynak önceliği (`gomulu` < `statik` < `ai`), sonra kod sırasına göre en küçük kimlik.
- Varsayılan DRY RUN. Uzak/üretim D1'e bağlanmaz; `--apply` yalnız yerel `--db dosya.sqlite` ile çalışır.
- Çıktı/manifest yalnız sayı, kimlik ve hash içerir. `--manifest` repo dışına yazar.

## PR 2 için indeks önerisi (bu PR'da YALNIZ `soru_h` oluşturulur)
Bileşik `(durum, s, t, d, rk)` her isteğe bağlı süzgeç birleşimine hizmet ETMEZ: SQLite sol-önek kuralıyla `t` yokken yalnız `(durum, s)` önekini
kullanır ve `ORDER BY rk` için TEMP B-TREE sıralaması gerekir (60.000 satırlık denemede doğrulandı). Önerilen kısmi indeksler
(`WHERE durum='banka' AND kopya_of IS NULL`, sorgu aynı koşulu aynen içermeli):

| Sorgu biçimi | İndeks | Plan |
|---|---|---|
| ders | `(s, rk)` | `SEARCH ... (s=? AND rk>?)`, sıralama yok |
| ders + konu (± zorluk) | `(s, t, rk)` | `SEARCH ... (s=? AND t=? AND rk>?)` |
| filtresiz | `(rk)` | `SEARCH ... (rk>?)` |
| ders + zorluk | `(s, rk)` yeter; `(s, d, rk)` yalnız `d` çok seçiciyse | planlayıcı `(s, rk)`'ı seçti |
