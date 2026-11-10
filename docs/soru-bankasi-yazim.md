# Korumalı soru bankası — yönetim yazımı (PR 3/6)

Yönetim soru yazımı artık `AKE_SORU_V2=1` iken **kanonik çift yazım** yapar. Bayrak kapalıyken (production'da bugünkü durum) hiçbir şey değişmez.

## Runtime soru yazan yerler (envanter)
| Dosya / uç | Yazılan kolonlar | Bayrak kapalı | Bayrak açık |
|---|---|---|---|
| `functions/api/yonetim` · `soru-uret` | INSERT: id,s,t,d,json,durum='onayli',tarih,karar | aynen (legacy) | legacy + kaynak='ai', rk, h, govde, a, x, kopya_of (tek INSERT) |
| `functions/api/yonetim` · `soru-karar` | UPDATE durum, karar | aynen | onayda canonical boşsa doldurur (tek batch); red aynen |
| `lib/ortak.js` `soruSema` | tablo oluşturma (CREATE IF NOT EXISTS) | aynen | aynen |
| `fabrika/soru-migrate.mjs` | göç aracı (elle çalışır, runtime değil) | — | — |

Başka runtime INSERT/UPDATE yolu yoktur.

## Bayrak açıkken kurallar (`lib/soru-yaz.js`)
- Doğrulama `dogrulaSoru` ile; geçersiz soru yazılmaz (yanıtta `gecersiz` sayısı).
- **Tam duplicate** (aynı `h` + aynı cevap/çözüm): satır yazılır, `kopya_of` = mevcut kanonik (kaynak önceliği gomulu < statik < ai). V2 havuzuna girmez. Mevcut kayıtların `kopya_of` değeri toplu değiştirilmez.
- **Çatışma** (aynı `h`, farklı cevap/çözüm): yazılmaz / onaylanmaz, raporlanır (`catisma`). Yeni durum eklenmedi.
- **ID çakışması**: üzerine yazılmaz; yeni id ile en çok 4 deneme, sonra `idCakisma`.
- **Atomiklik**: `soru-uret` satırı tek `INSERT … SELECT … WHERE NOT EXISTS` ile yazılır; `soru-karar` onayı tek D1 batch'tir ve son ifade bir assert'tir. Çoklu ID'de biri geçersiz/çatışmalıysa hiçbiri onaylanmaz (409).
- Mevcut 89 legacy satıra ve tabloya toplu tarama/backfill yapılmaz; onayda yalnız bekleyen satır doldurulur.

## Cutover sırası
1. PR 3 main'e girer.
2. Production `AKE_SORU_V2` **kapalı** kalır.
3. Admin soru üretimi kısa süre durdurulur.
4. Production canonical migration çalıştırılır.
5. Migration count/hash doğrulanır.
6. Migration sonrası delta legacy row olmadığı doğrulanır.
7. `AKE_SORU_V2` açılır.
8. Yeni admin yazımları dual-write olur.
9. V2 API staging/live smoke yapılır.
10. Ancak bundan sonra frontend cutover.

**Not:** 1216 yalnızca şu anki baseline'dır (1127 statik/embedded + 89 legacy D1). Migration gününde beklenen toplam = 1127 statik/embedded + migration öncesi gerçek D1 satır sayısı − gerçek ID çakışması.

## Bu PR'da yapılmayanlar
Production migration, remote D1 apply, bayrak açma, `index.html` V2 entegrasyonu, `/api/sorular` kapatma, `sorular/*.json` ve gömülü BANK kaldırma.

## Onay (soru-karar) atomikliği — PR 3 düzeltmesi
- Batch'in son ifadesi bir assert'tür: başlangıçta bekleyen **her** hedef satır batch sonunda `durum='onayli'` ve `h, govde, a, x, rk, kaynak` dolu olmalıdır (sayım == hedef sayısı). Aksi halde (araya giren red/durum değişikliği/silme, çatışmayla no-op olan UPDATE) batch'in tamamı geri alınır, istek 409 döner.
- Kanonik alanları zaten dolu bekleyen satırlar da doğrulanır (`dogrulaSoru`, `h` govdeyle uyumu, çatışma). Aynı `h` + farklı cevap/çözüm onaylanmaz; tam duplicate ise `kopya_of` kanonik kayda bağlanır (mevcut `kopya_of` korunur).
- Kanonik/çatışma kaynağı olarak yalnız `durum IN ('banka','onayli')` satırlar sayılır (red/bekleyen satır kanonik olamaz).
- **Conservative false-positive conflict:** çatışma karşılaştırması `x` için ham metindir (boşluk/NFC farkı çatışma sayılır); fail-closed ve bilinçlidir, atomiklik bozulmasın diye bu PR'da normalize edilmedi.
