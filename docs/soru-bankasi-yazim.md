# Korumalı soru bankası — yönetim yazımı (PR 3/6)

Yönetim soru yazımı artık `AKE_SORU_V2=1` iken **kanonik çift yazım** yapar. Bayrak kapalıyken (production'da bugünkü durum) hiçbir şey değişmez.

## Runtime soru yazan yerler (envanter)
| Dosya / uç | Yazılan kolonlar | Bayrak kapalı | Bayrak açık |
|---|---|---|---|
| `functions/api/yonetim` · `soru-uret` | INSERT: id,s,t,d,json,durum='taslak',tarih,karar (artık canlıya yazmaz) | aynen (legacy, durum='taslak') | legacy + kaynak='ai', rk, h, govde, a, x, kopya_of (tek INSERT) |
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
(Ayrıntılı runbook: [`soru-bankasi-production-migration.md`](soru-bankasi-production-migration.md), PHASE A–M.)
1. PR 3 (ve migration hattı PR'ı) main'e girer; production `AKE_SORU_V2` **kapalı**.
2. `AKE_SORU_MIGRATION_LOCK=1` (admin soru yazımı kilitli) ve doğrulanır.
3. Production canonical migration (yedek → dry-run → apply); count/hash/delta doğrulanır.
4. Kilit **açık kalır**; insan onayı.
5. `AKE_SORU_V2` açılır ve deploy edilir; V2 API smoke **kilit hâlâ açıkken** yapılır; canonical delta legacy row = 0 doğrulanır.
6. Ancak bundan sonra migration kilidi kaldırılır, yeniden deploy, unlock doğrulanır (yeni admin yazımları dual-write olur).
7. Ancak bundan sonra frontend cutover.

**Not:** 1216 yalnızca şu anki baseline'dır (1127 statik/embedded + 89 legacy D1). Migration gününde beklenen toplam = 1127 statik/embedded + migration öncesi gerçek D1 satır sayısı − gerçek ID çakışması.

## Bu PR'da yapılmayanlar
Production migration, remote D1 apply, bayrak açma, `index.html` V2 entegrasyonu, `/api/sorular` kapatma, `sorular/*.json` ve gömülü BANK kaldırma.

## Onay (soru-karar) atomikliği — PR 3 düzeltmesi
- Batch'in son ifadesi bir assert'tür: başlangıçta bekleyen **her** hedef satır batch sonunda `durum='onayli'` ve `h, govde, a, x, rk, kaynak` dolu olmalıdır (sayım == hedef sayısı). Aksi halde (araya giren red/durum değişikliği/silme, çatışmayla no-op olan UPDATE) batch'in tamamı geri alınır, istek 409 döner.
- Kanonik alanları zaten dolu bekleyen satırlar da doğrulanır (`dogrulaSoru`, `h` govdeyle uyumu, çatışma). Aynı `h` + farklı cevap/çözüm onaylanmaz; tam duplicate ise `kopya_of` kanonik kayda bağlanır (mevcut `kopya_of` korunur).
- Kanonik/çatışma kaynağı olarak yalnız `durum IN ('banka','onayli')` satırlar sayılır (red/bekleyen satır kanonik olamaz).
- **Conservative false-positive conflict:** çatışma karşılaştırması `x` için ham metindir (boşluk/NFC farkı çatışma sayılır); fail-closed ve bilinçlidir, atomiklik bozulmasın diye bu PR'da normalize edilmedi.

## Fabrika robotu: AI sorusu canlıya yalnız yönetici yayım kararıyla geçer
- `soruYazKanonik` varsayılanı `durum='taslak'`; `'onayli'`/`'banka'` istenirse `canli_durum_yasak` hatası verir. Legacy (bayrak kapalı) `soru-uret` INSERT'i de `'taslak'` yazar. Öğrenci uçları (`/api/sorular`, `UYGUN`) yalnız `banka/onayli` okur, taslak görünmez.
- Durumlar `fabrika_soru` tablosundadır ve **ayrıdır**: `model_durum` (bekliyor|gecti|revizyon|ret|belirsiz) ile `yayim_durum` (yok|onayli|red). Canlıya giden tek yol `lib/fabrika.js › yayimKarari`: `model_durum='gecti' AND denetim_tam=1 AND tekrar=0` şartı `soruOnayla`'nın UPDATE'inde (`ek` SQL geçidi) aranır; geçit sağlanmazsa final ASSERT tüm batch'i geri alır.
- Kuyruk D1'dedir (`fabrika_is`: kilit/lease, en çok 3 deneme, geri çekilme, `olu` = dead-letter). İşi ayrı Worker (`worker/`) yapar; yönetim uçları model ÇAĞIRMAZ. Her model çağrısı `fabrika_cagri`'ya (model, giriş/çıkış token, süre, hata, soru sürümü) yazılır.
- Robot anahtarı varsayılan KAPALI (`fabrika_ayar.robot`); açmak için `AKE_SORU_V2=1` gerekir. Pilot en çok 10 soru; günlük model çağrısı `AKE_FABRIKA_GUNLUK_CAGRI` (varsayılan 40). 20.000/gün döngüsü kurulmadı.
- Sayısal doğrulama `yapilmadi`dır (model kodu çalıştırılmaz). Özgünlük kontrolü de yapılmadı.

### Fabrika robotu: sıkı geçit, fiyat, durdurma (PR #33 düzeltmeleri)
- **Model geçidi:** `model_durum='gecti'` yalnız denetçi JSON'unda `tek_dogru === true`, `belirsiz === false` (boolean, açıkça), `sorunlar` dizisi bulunup **boşsa** ve `cevap` üretici anahtarıyla aynıysa verilir. Eksik/yanlış tipli alan → `belirsiz`; `tek_dogru:false` → `ret`; farklı cevap ya da bildirilen herhangi bir kalite sorunu → `revizyon` (sorunlar `denetim_json`'da saklanır).
- **Fiyat:** yalnız bilinen modeller hesaplanır (`claude-sonnet-5-5`: 2 $ giriş / 10 $ çıkış, milyon token). Bilinmeyen model → `usd=null`; toplam USD'ye katılmaz, `fiyatsizCagri`/`fiyatsizModeller` ile ayrıca gösterilir. Başka model için fiyatı operatör açıkça verir: `AKE_FABRIKA_FIYATLAR='{"model":[giris,cikis]}'`.
- **Çağrı ↔ soru:** üretim çağrısı, soru oluşunca `soru_id` + sürüme bağlanır; soru oluşmayan üretim çağrısı bağsız (NULL) kalır. Denetim çağrıları baştan bağlıdır.
- **Karar:** `fabrika-karar` yalnız `"yayin"`/`"red"` kabul eder; başka değer 400 `karar_gecersiz`, hiçbir satır değişmez.
- **Pilot durdurma:** bekleyen işler `iptal`; model yanıtı beklenen (`calisiyor`) işler iptal edilemez. Yanıt gelirse kaydedilir (çağrı günlüğü + gider) ama yeni denetim başlatılmaz; üretimden doğan taslak `denetim_bekliyor` kalır, yayımlanamaz, panelde listelenir ve reddedilebilir. Hata ile dönen iş yeniden denenmez (`iptal`). Durmuş pilotun süresi dolmuş kilitli işi yeniden alınmaz.
- `worker/` klasörü web'den sunulmaz (`KORUNAN_KLASORLER` + `functions/worker/[[yol]].js`).
