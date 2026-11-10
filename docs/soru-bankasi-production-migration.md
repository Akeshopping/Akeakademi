# Korumalı soru bankası — production migration runbook (PR 4/6)

**Bu PR'da production'a hiçbir yazma yapılmadı.** Bu belge, ayrı bir insan onayından sonra yapılacak gerçek göçün adımlarıdır.
Araç: `fabrika/soru-d1-migrate.mjs` (planlama/doğrulama mantığı `fabrika/soru-migrate.mjs` ve `lib/soru-kanonik.js`'ten gelir).

## Temel kural (cutover sırası)
**`AKE_SORU_MIGRATION_LOCK` kilidi, V2 açılıp smoke edilene kadar KALDIRILMAZ.** Kilit V2'den önce kalkarsa, V2 henüz açık değilken `soru-uret` / `soru-karar` yeni *legacy-only* satır üretir ve canonical havuz geride kalır. Sıra: kilit → yedek/audit/dry-run → apply → doğrulama → (kilit AÇIK) → insan onayı → V2 aç + deploy → V2 smoke (kilit hâlâ açık) → canonical delta = 0 doğrula → kilidi kaldır → yeniden deploy → doğrula.

## Güvenlik tasarımı (özet)
- **Varsayılan = salt okuma.** Bayraksız çalıştırma hiçbir yere bağlanmaz. `--apply` yoksa D1 sürücüsü *fiziksel olarak* salt-okunurdur (INSERT/UPDATE/ALTER/CREATE/DROP `prepare()` aşamasında reddedilir).
- **Kimlik koruması.** `--db-id` ve `--db-name` zorunlu; Cloudflare'dan dönen kimlik/ad ile birebir eşleşmezse **HARD STOP** (çıkış kodu 3). `--environment production` yalnız `AKE_MIGRATE_PRODUCTION_DB_ID` (ortam değişkeni) ile aynı veritabanında çalışır; staging etiketiyle üretim veritabanına bağlanmak da HARD STOP.
- **`soru` tablosu ve legacy temel kolonlar (`id, s, t, d, json, durum, tarih, karar`) önceden VAR olmalı.** Yoksa (ya da biri eksikse) HARD STOP, hiçbir şey yazılmaz: araç sıfırdan tablo kurmaz (yanlış/bozuk DB olabilir). Yerel provalarda tablo kurma yalnız açık `--bootstrap-table` ile (uzak modda kapalı).
- **Apply kapıları (hepsi gerekir):** conflict 0 · invalid 0 · kaynak sapması 0 · beklenen final hesaplandı · `--apply` · yedek okundu, hash'i biliniyor, satır sayısı mevcutla aynı · yedekten sonra veri değişmemiş · yedek bu veritabanından · `--freeze-confirmed` · `--expect-pre-count` doğru · `--recovery-manifest-out` (repo dışı, yeni dosya) · `--confirm` belirteci eşleşiyor.
- **Production'da ayrıca:** Time Travel bookmark alınmalı; alınamazsa HARD STOP (bookmark'sız production apply YAPILMAZ).
- **Onay belirteci** = `sha256(sürüm|db-id|ortam|ön sayım|beklenen final|yedek sha256)` ilk 20 hane. Sır içermez.
- Token (`CLOUDFLARE_API_TOKEN`) yalnız ortam değişkeninden okunur; çıktıya/hataya basılmaz (`[gizli]`). Çıktıda soru metni yoktur: yalnız sayı, kimlik, hash.
- Araç `AKE_SORU_V2`'yi veya başka bir bayrağı/ortam değişkenini **değiştirmez**. Migration ve V2'yi açmak ayrı manuel onaylardır.

## Kurtarma manifesti (pre-write)
`--recovery-manifest-out F` production/staging apply için **zorunludur** ve **ilk SQL yazmasından önce** (şema ALTER dahil) yazılır; yazılamazsa (dizin yok, dosya var, repo içi yol) hiçbir DB yazması başlamaz. Dosya 0600, repo dışı, mevcut dosyanın üzerine yazılmaz, soru metni içermez.
Alanlar: `surum`, `durum` (`planned` → `completed` | `basarisiz_kismi_olabilir` | `tamamlandi_dogrulama_basarisiz`), `olusturma`, `veritabani_id`, `veritabani_adi`, `ortam`, `on_sayim`, `on_durum_hash`, `yedek_sha256`, `beklenen_final`, `kaynak_sayilari`, `time_travel_bookmark`, `planlanan_ekleme_idleri`, `planlanan_backfill_idleri`, `planlanan_kopya_of_idleri`. Durum güncellemesi geçici dosya + `rename` ile atomiktir. Parça hatasında `planned`/`basarisiz_kismi_olabilir` kalır ve planlanan ID'ler elde bulunur.

## Time Travel bookmark (kurtarma noktası)
Araç yalnız güncel bookmark'ı **okur** (`GET /accounts/{hesap}/d1/database/{db}/time_travel/bookmark`) ve kurtarma manifestine yazar; **restore YAPMAZ**. Dry-run'da bookmark'ın alınabildiği salt-okuma olarak raporlanır. Production'da alınamazsa apply HARD STOP. Bu uç bu PR'da canlı API'ye karşı denenmedi (yalnız sahte `fetch`).
Restore örneği (**insan onayıyla, bu PR'da çalıştırılmaz**): `wrangler d1 time-travel restore <DB> --bookmark=<BOOKMARK>`. Restore, bookmark'tan sonraki TÜM yazmaları (örn. başka admin yazıları) geri alır; bu yüzden son çaredir.

## Atomiklik / chunk tasarımı
- Sıra: **A** preflight okuma → **B** tam doğrulama (yazma başlamadan conflict/invalid/sapma 0) → **C** şema (yalnız nullable kolon ekleme) → **D** veri (parçalı) → **E** indeksler (`soru_sec_*`, `IF NOT EXISTS`) → **F** doğrulama.
- Parça başına en çok 50 ifade (varsayılan 40); ifade başına ≤100 bağlı parametre, ≤100 KB SQL. Bu konservatif sınırlar Cloudflare belgelerindendir; 100k+ satırda parça sayısı doğrusal artar.
- **Her ifade idempotenttir:** ekleme `WHERE NOT EXISTS (id)`, doldurma `COALESCE`, `kopya_of` sabit değer. Cloudflare batch transaction davranışına **güvenilmez**; tasarım idempotent yeniden denemeye dayanır.
- REST yanıtı sert doğrulanır: `result` dizisi, uzunluk (= ifade sayısı) ve **her `result[i].success === true`**; üst düzey `success` tek başına yetmez.
- Parça hatasında "yeniden çalıştırmak güvenlidir" denir. Yeniden denemeden önce **yeni yedek + yeni dry-run + yeni belirteç** gerekir (veri değişti).

## Admin yazma kilidi: `AKE_SORU_MIGRATION_LOCK` (varsayılan KAPALI)
Yalnız `POST soru-uret` ve `POST soru-karar` için 503 `bakim`; yönetim GET'leri, hesap, ödeme, `/api/sorular` etkilenmez; `AKE_SORU_V2`'den bağımsızdır. Pages'te ortam değişkeni **yeni dağıtımla** etkinleşir.
**Güvenli yoklama (veri yazmaz):** `POST /api/yonetim/soru-karar` gövde `{"id":[],"karar":"red"}` → kilitliyken **503**, değilken 200 `{ok:true,n:0}`. `soru-uret` ile yoklama YAPMA.

## Runbook

### PHASE A — migration lock AÇ
1. Cloudflare Pages production'a `AKE_SORU_MIGRATION_LOCK=1` ekle ve yeniden dağıt. `AKE_SORU_V2`'ye dokunma (kapalı).
**Dur:** dağıtım başarısızsa. **Rollback:** değişkeni sil, yeniden dağıt.

### PHASE B — lock doğrula
2. Yukarıdaki yoklama. **Beklenen: 503.** **Dur:** 200 dönerse kilit etkin değil; ilerleme.

### PHASE C — backup / audit / dry-run (salt okuma)
3. Yedek: `node fabrika/soru-d1-migrate.mjs --remote --environment production --db-id <ID> --db-name <AD> --backup-out /gizli/ake-yedek.json`. **Beklenen:** `YEDEK yazıldı (private, 0600): satır N · sha256 <hash>`. Dosya soru metni içerir: repoya KOYMA, paylaşma, public artifact yapma. N ve hash'i not al.
4. Audit/dry-run: aynı komut `--backup-out` yerine `--backup-file /gizli/ake-yedek.json`. **Beklenen:** doğru DB adı/kimlik öneki; `mevcut toplam` (bugün ~89 ama **sabit kabul etme**), durum dağılımı, `canonical tam/eksik`, `conflict: 0 · invalid: 0 · sapma: 0`, `beklenen final = mevcut + yeni`, `Time Travel bookmark (salt okuma GET): alınabildi`, **ONAY BELİRTECİ**. Final toplam sabit 1216 değildir: `1127 statik/embedded + migration günü gerçek D1 satırı − gerçek ID çakışması`.
**Dur:** HARD STOP (yanlış DB / tablo yok / legacy kolon yok), conflict/invalid/sapma ≠ 0, bookmark `ALINAMADI` (production'da apply RED; ayrı doğrulanmış manuel yedek şartı gerekir). Operatör ön sayımı, beklenen finali ve yedek hash'ini doğrular.

### PHASE D — migration apply
5. `... --backup-file F --apply --confirm <BELİRTEÇ> --expect-pre-count <N> --freeze-confirmed --recovery-manifest-out /gizli/ake-kurtarma.json [--manifest-out /gizli/ake-manifest.json]`
6. **Beklenen:** kapıların hepsi `TAMAM` → `kurtarma manifesti yazıldı … bookmark: kaydedildi` → `şema hazır` → `parça i/n tamam` → `UYGULANDI: …`.
**Dur / rollback koşulu:** bir kapı `RED` → hiçbir şey yazılmaz. Parça hatası → otomatik DELETE/restore YOK; "Rollback katmanları" bölümüne bak.

### PHASE E — post-validation
7. Araç otomatik doğrular (`doğrulama TAMAM/KALDI`): satır sayısı beklenenle aynı · static/embedded tüm kimlikler · Pilot 100/100 ve içerik özeti · canonical alanlar tam · eligible satırda eksik yok · migration öncesi satırlar (json/durum/tarih/karar) aynı · legacy `/api/sorular` çıktısı özeti aynı · içe aktarılanlar `banka` · yeniden plan: çatışma/geçersiz 0, yapılacak iş 0 (duplicate `kopya_of` doğru). Kurtarma manifesti `completed` olur.
**Dur:** `DOĞRULAMA: BAŞARISIZ` → V2'yi AÇMA, kilidi KALDIRMA; incele.

### PHASE F — migration kilidi AÇIK KALIR
8. Doğrulama başarılı olsa bile `AKE_SORU_MIGRATION_LOCK=1` **KİLİT AÇIK KALIR**. Bu aşamada kimse soru üretmez/onaylamaz; havuz canonical ile eşit kalır.
**Dur:** kilidi burada kaldırmak YASAKTIR.

### PHASE G — insan onayı
9. İnsan: doğrulama çıktısı, `completed` kurtarma manifesti ve canlı `GET /api/sorular` sayısının (migration öncesiyle aynı) gözden geçirilmesi. Onay yoksa V2 açılmaz.

### PHASE H — AKE_SORU_V2=1 aç ve deploy et
10. Pages'te `AKE_SORU_V2=1` ekle, yeniden dağıt. Migration kilidi **hâlâ 1** olmalı. (Bu adım ayrı manuel onaydır; araç bunu yapmaz.)

### PHASE I — V2 API smoke (kilit hâlâ açık)
11. `GET /api/soru/ozet` yönetici/öğrenci oturumuyla 200 ve gizli alan (a/x/h/rk/json/kaynak/kopya_of) yok; oturum aç/cevap/bitir akışı test hesabıyla. Kilit hâlâ açık olduğundan bu sırada soru yazımı olamaz.
**Dur:** V2 API hata veriyorsa `AKE_SORU_V2`'yi kaldır (V2 kapalı = legacy çalışır), kilit açık kalır, incele.

### PHASE J — canonical durum / delta legacy row = 0
12. Salt-okuma dry-run'ı tekrarla. **Beklenen:** `canonical eksik: 0`, `yeni ekleme: 0`, `backfill: 0`, `kopya_of düzeltme: 0` (migration sonrası eklenen legacy-only satır yok = delta 0), `conflict/invalid/sapma: 0`. **Dur:** ≠ 0 ise kilidi KALDIRMA; incele.

### PHASE K — migration kilidini kaldır
13. Yalnız PHASE H–J başarılıysa `AKE_SORU_MIGRATION_LOCK` değişkenini sil.

### PHASE L — yeniden deploy
14. Yeniden dağıt (değişken yeni dağıtımla etkinleşir).

### PHASE M — unlock doğrula
15. Yoklama `soru-karar` `{"id":[],"karar":"red"}` → **200**. Yeni admin yazımı (soru-uret/soru-karar) artık `AKE_SORU_V2=1` ile canonical çift yazım yapar. **Dur:** hâlâ 503 ise kilit kalkmadı.

## Rollback katmanları (hiçbiri otomatik çalışmaz)
1. **V2 kapalı / admin kilidi açık (=yazma kapalı):** ilk ve en güvenli katman. `AKE_SORU_V2` kapalıyken legacy frontend/API çalışır (yeni kolonlar nullable, `banka` satırları legacy uçlara görünmez); kilit açıkken veri değişmez.
2. **Pre-apply kurtarma manifesti:** planlanan ekleme/backfill/kopya_of ID'leri ve ön durum hash'i.
3. **Private JSON export (yedek dosyası):** migration öncesi tam `soru` tablosu.
4. **D1 Time Travel bookmark:** pre-apply kurtarma noktası.

**Kısmi (partial) migration sonrası:** otomatik DELETE/restore YAPILMAZ. Öncelik: sorunu incele; idempotent yeniden deneme güvenliyse **yeni preflight + yeni yedek + yeni belirteçle** yeniden dene (tamamlanmış işler no-op olur).
**Gerçek rollback gerekirse (insan onayıyla):** Time Travel bookmark değerlendirmesi (restore örneği yukarıda; bookmark sonrası tüm yazmaları geri alır) **veya** kurtarma manifestindeki `planlanan_ekleme_idleri` üzerinden kontrollü temizlik şablonu: `DELETE FROM soru WHERE id IN (<manifest ID'leri>) AND durum = 'banka'` (`durum='banka'` koşulu legacy satırları korur). Bu bir **şablondur; bu PR'da hiçbir script çalıştırmaz.** Eklenen nullable kolonlar geri alınmaz (zararsız; `DROP COLUMN` yapılmaz).
