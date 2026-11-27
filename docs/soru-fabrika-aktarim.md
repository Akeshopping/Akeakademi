# Soru Fabrikası · aday soru aktarımı (ZIP/JSONL → yönetici inceleme kuyruğu)

Bu belge soru METNİ içermez.

## Akış
`bagimsiz_cozum.py` (soru metninden bağımsız çözüm) → `fabrika/soru-fabrika-aktar.mjs` (ön kontrol + soru başına sonuç kaydı) → **`bekliyor`** (yönetim paneli) → yönetici onayı (`soru-karar`, `lib/soru-yaz.js soruOnayla`) → `onayli`.

- Aktarım yalnız `durum='bekliyor'` yazar. `/api/sorular` yalnız `onayli`, V2 havuzu yalnız `banka/onayli` okur: **öğrencilere görünen sayı değişmez** (araç, yazma öncesi/sonrası `onayli` ve `banka` sayısını karşılaştırır, değişirse durur).
- `json` (legacy) yazılır; kanonik sütunlar (`h, govde, a, x, rk, kaynak, kopya_of`) BOŞ bırakılır. Onay anında `soruOnayla` bunları tek batch'te doldurur, aynı `h`/farklı cevap çatışmasını ve kopyayı kendisi denetler.
- Araç ÜRETİM D1'E BAĞLANMAZ. `--apply` yalnız `--local-db <sqlite>` ile çalışır; çıktı klasörü repo içinde olamaz.

## Eşleme
| ZIP | Site |
|---|---|
| `s: tyt_matematik` | `s: mat` (`lib/soru-api.js DERSLER`) |
| `t` (ör. "Yaş Problemleri") | olduğu gibi. **Sitenin mevcut konu listesinde (`fabrika/mevcut_konular.json`) yok** → rapor "yeni konu adı" der; karar yöneticide |
| `d` | bağımsız ölçülen zorluk (tahmin; gerçek çözüm verisiyle ayarlanmalı) |
| `dUret` | atılır (yalnız ledger notu) |
| `id` | `py-<ders>-<8 hex>`; mevcut `ok-*`/statik kimliklerle çakışmaz |

## Kontroller (soru başına sonuç: `uygun | tekrar | gecersiz | inceleme`, aktarımdan sonra `aktarildi | zaten_var | catisma`)
Dosya bütünlüğü (JSON satırı, `rapor.json` ile satır sayısı) · `dogrulaSoru` (zorunlu alanlar, 5 farklı şık, `a` 0-4) · kimlik biçimi/benzersizlik · çözümün işaretli şıkkı söylemesi · `kanonikHash` tekrarı (yükleme içi ve depodaki statik bankayla; farklı cevaplı aynı soru = `inceleme`) · mevcut gömülü/statik soru köküyle çakışma = `inceleme` · `dogrula.mjs` ile aynı 3-gram Jaccard ≥ 0.8 benzerlik kuralı (aynı şablon grubu içinde, ilk soru tutulur, sonrakiler `tekrar`) · bağımsız çözüm `dogru` değilse = `inceleme`.

## Yinelenebilirlik
`INSERT … WHERE NOT EXISTS (id)`, 40'lık işlemlerle. Yarıda kalırsa aynı komut yeniden çalıştırılır: var olan aynı içerik `zaten_var`, farklı içerik `catisma` (üzerine yazılmaz).

## ÜRETİM İÇİN GEREKEN (bu araçla yapılmadı)
1. Üretim D1'e yazma yetkisi (Cloudflare hesap/DB kimliği + token) ve `soru-bankasi-production-migration.md` PHASE kapılarına uygun, insan onaylı bir pencere. Bu ortamda bu yetki yoktur.
2. Üretimdeki mevcut `soru` satırlarına karşı tekrar denetimi (`h` ve soru kökü) üretim okumasıyla yeniden çalıştırılmalı; bu çalıştırma yalnız depodaki statik bankayla karşılaştırdı.
3. Karar: yeni konu adları sitenin konu listesine eklenecek mi, yoksa mevcut konulara mı eşlenecek.
4. Panel `bekliyor` listesini 100'er gösterir; onay `soruOnayla` ile istek başına sınırlı id ile verilir. 15 binlik kuyruk için toplu inceleme planı gerekir.
