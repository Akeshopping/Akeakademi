# Korumalı soru bankası — production migration runbook (PR 4/6)

**Bu PR'da production'a hiçbir yazma yapılmadı.** Bu belge, ayrı bir insan onayından sonra yapılacak gerçek göçün adımlarıdır.
Araç: `fabrika/soru-d1-migrate.mjs` (planlama/doğrulama mantığı `fabrika/soru-migrate.mjs` ve `lib/soru-kanonik.js`'ten gelir).

## Güvenlik tasarımı (özet)
- **Varsayılan = salt okuma.** Bayraksız çalıştırma hiçbir yere bağlanmaz. `--apply` yoksa D1 sürücüsü *fiziksel olarak* salt-okunurdur (INSERT/UPDATE/ALTER/CREATE/DROP `prepare()` aşamasında reddedilir).
- **Kimlik koruması.** `--db-id` ve `--db-name` zorunlu; Cloudflare'dan dönen kimlik/ad ile birebir eşleşmezse **HARD STOP** (çıkış kodu 3). `--environment production` yalnız `AKE_MIGRATE_PRODUCTION_DB_ID` (ortam değişkeni) ile aynı veritabanında çalışır; staging etiketiyle üretim veritabanına bağlanmak da HARD STOP'tur.
- **Apply kapıları (hepsi gerekir):** conflict 0 · invalid 0 · kaynak sapması 0 · beklenen final hesaplandı · `--apply` · yedek dosyası okundu ve hash'i biliniyor · yedek satır sayısı = mevcut satır sayısı · yedekten sonra veri değişmemiş · yedek bu veritabanından · `--freeze-confirmed` · `--expect-pre-count` gerçek sayıyla aynı · `--confirm` belirteci eşleşiyor.
- **Onay belirteci** = `sha256(sürüm|db-id|ortam|ön sayım|beklenen final|yedek sha256)` ilk 20 hane. Sır içermez; dry-run bunu (yedek dosyası verilince) yazdırır. Kimlik, sayım ya da yedek değişirse belirteç tutmaz.
- Token'lar (`CLOUDFLARE_API_TOKEN`) yalnız ortam değişkeninden okunur; çıktıya/hataya basılmaz (`[gizli]`). Çıktıda soru metni yoktur: yalnız sayı, kimlik ve hash.
- Araç `AKE_SORU_V2`'yi veya herhangi bir ortam değişkenini/bayrağı **değiştirmez**. Migration ve V2'yi açmak iki ayrı manuel onaydır.

## Atomiklik / chunk tasarımı
- Sıra: **A** preflight okuma → **B** tam doğrulama (plan; yazma başlamadan çatışma/geçersiz/sapma 0 olmalı) → **C** şema (yalnız nullable kolon ekleme, yıkıcı değişiklik yok; legacy sistem bozulmaz) → **D** veri (parçalı) → **E** indeksler (`soru_sec_*`, `IF NOT EXISTS`) → **F** doğrulama.
- Veri parçalara bölünür (varsayılan 40, **en çok 50** ifade/batch; D1 sınırları: Workers ücretsiz planda çağrı başına 50 sorgu, ifade başına ≤100 bağlı parametre, ≤100 KB SQL. Bu sınırlar Cloudflare belgelerindendir, canlı D1'de bu PR'da denenmedi). 1127 satır bugün ~30 parçadır; 100k+ satır için parça sayısı doğrusal artar, bellekte yalnız plan tutulur.
- **Her ifade idempotenttir:** ekleme `WHERE NOT EXISTS (id)`, doldurma `COALESCE` (dolu kolona dokunmaz, `rk` değişmez), `kopya_of` sabit değer atar. Bir parça kısmen/çifte yazılsa bile yeniden çalıştırmak aynı sonuca götürür. Her parça 3 kez denenir.
- Parça hatasında araç dur ve "yeniden çalıştırmak güvenlidir" der. **Yeniden çalıştırma:** plan veritabanının O ANKİ durumundan yeniden hesaplanır (yapılmış işler no-op olur). Yarım durum yedekten farklı olduğu için **yeni yedek + yeni dry-run + yeni belirteç** gerekir.
- Cloudflare REST `batch`'inin işlem (transaction) davranışına güvenilmez; tasarım parça-içi atomikliğe değil idempotentliğe dayanır.

## Admin yazma dondurması — karar: `AKE_SORU_MIGRATION_LOCK` eklendi (varsayılan KAPALI)
Gerekçe: elle dondurma ("admini kullanma") insan hatasına açıktır ve doğrulanamaz; yönetim panelinde açık bir sekme `soru-karar` gönderebilir. Sunucu tarafı kilit 2 satırdır, yalnız `POST soru-uret` ve `POST soru-karar` için 503 `bakim` döner; yönetim GET'leri, hesap, ödeme, `/api/sorular` etkilenmez; `AKE_SORU_V2`'den bağımsızdır. Maliyet: Pages'te ortam değişkeni **yeni bir dağıtımla** etkinleşir (kilit açma/kapama bir deploy gerektirir). Bu yüzden runbook hem kilidi hem `--freeze-confirmed` beyanını ister.
**Güvenli yoklama (üretimde veri yazmaz):** `POST /api/yonetim/soru-karar` gövde `{"id":[],"karar":"red"}` → kilit açıkken **503**, kapalıyken 200 `{ok:true,n:0}` (boş liste hiçbir satıra dokunmaz). `soru-uret` ile yoklama YAPMA (AI çağrısı/yazım olabilir).

## Runbook

### PHASE A — freeze
1. Cloudflare Pages production ortam değişkenine `AKE_SORU_MIGRATION_LOCK=1` ekle ve yeniden dağıt. (`AKE_SORU_V2`'ye dokunma; kapalı kalmalı.)
2. Yoklama: yukarıdaki `soru-karar` boş liste isteği **503**. **Beklenen:** 503. **Dur:** 200 dönerse (kilit etkin değil). **Rollback:** değişkeni sil, yeniden dağıt.

### PHASE B — backup (salt okuma)
3. `node fabrika/soru-d1-migrate.mjs --remote --environment production --db-id <ID> --db-name <AD> --backup-out /gizli/ake-yedek-<tarih>.json`
4. **Beklenen çıktı:** `YEDEK yazıldı (private, 0600): satır N · sha256 <hash>`. N'yi ve hash'i not al (bu dosya soru metni içerir: repoya KOYMA, paylaşma, public artifact yapma; 0600). Araç repo içi yolu ve var olan dosyayı reddeder.
5. Yedek meta'sı şema kolonlarını, durum dağılımını ve canonical dolu/boş sayısını içerir (kaydet). **Dur:** satır sayısı beklentiden farklıysa, hata varsa.

### PHASE C — read-only audit
6. Aynı komut `--backup-out` olmadan çalıştır: preflight raporu. **Beklenen:** doğru veritabanı adı/kimlik öneki, `mevcut toplam` (bugün ~89 ama **sabit kabul etme**; gerçek D1 sayısı okunur), durum dağılımı, `canonical tam/eksik`, `kimlik çakışması`.
7. **Dur:** `veritabanı` satırı beklenen değilse; HARD STOP zaten çıkar.

### PHASE D — dry-run
8. `... --backup-file /gizli/ake-yedek-<tarih>.json` (apply yok). **Beklenen:** `conflict: 0 · invalid: 0 · sapma: 0`, `beklenen final toplam = mevcut + yeni ekleme` ve **ONAY BELİRTECİ**. Final toplam sabit 1216 değildir: `1127 statik/embedded + migration günü gerçek D1 satırı − gerçek ID çakışması` (ID çakışması aynı içerikse no-op/backfill, farklıysa conflict).
9. **Dur:** conflict/invalid/sapma ≠ 0 ise apply YOK; nedeni (kimlikler raporlanır, metin değil) düzeltilmeden ilerleme.

### PHASE E — operator approval
10. Operatör şunları doğrular: ön sayım (`--expect-pre-count`), beklenen final, yedek hash'i, dondurma aktif. İnsan onayı olmadan PHASE F'ye geçilmez.

### PHASE F — apply
11. `... --backup-file F --apply --confirm <BELİRTEÇ> --expect-pre-count <N> --freeze-confirmed [--manifest-out /gizli/ake-manifest.json]`
12. **Beklenen:** kapıların hepsi `TAMAM`, `şema hazır`, `parça i/n tamam` satırları, sonra `UYGULANDI: eklenen … · doldurulan … · kopya_of …`.
13. **Dur / rollback koşulu:** herhangi bir kapı `RED` → hiçbir şey yazılmaz (güvenli). Parça hatası → yeniden çalıştırmak güvenli: yeni yedek + dry-run + yeni belirteçle tekrar. Şema eklendikten sonra hata olsa da nullable kolonlar legacy sistemi bozmaz.

### PHASE G — validation
14. Araç otomatik doğrular (çıktıda `doğrulama TAMAM/KALDI`): satır sayısı beklenenle aynı · static/embedded tüm kimlikler mevcut · Pilot 100/100 ve içerik özeti aynı · canonical alanlar tam · eligible satırda h/rk/govde/a/x eksiği yok · migration öncesi satırlar (json/durum/tarih/karar) aynı · legacy `/api/sorular` çıktısı (durum='onayli' json özeti) aynı · içe aktarılanlar `banka` · planın yeniden hesabı: çatışma/geçersiz 0, yapılacak iş 0 (duplicate `kopya_of` doğru). `--manifest-out`: sıralı ID hash, içerik hash, cevap hash, satır sayısı, eklenen ID'ler (yalnız ID).
15. Elle: canlı `GET /api/sorular` sayısı migration öncesiyle aynı; `/api/soru/*` hâlâ 404.
16. **Dur:** `DOĞRULAMA: BAŞARISIZ` → **otomatik rollback yok**; V2 kapalı kalır, legacy çalışmaya devam eder; yukarıdaki rollback planına bak.

### PHASE H — unlock
17. `AKE_SORU_MIGRATION_LOCK` değişkenini sil, yeniden dağıt, yoklama `soru-karar` boş liste → **200**. **Dur:** hâlâ 503 ise kilit kalkmadı.

### PHASE I — human approval before V2 flag
18. Migration başarılı olsa bile `AKE_SORU_V2` **otomatik açılmaz**. İnsan onayı → `AKE_SORU_V2=1` (ayrı adım) → dark API canlı smoke → DUR → frontend cutover sonraki PR.

## Rollback planı (yıkıcı otomatik rollback YOK)
1. `AKE_SORU_V2` kapalı kalır; legacy frontend/API çalışmaya devam eder (yeni kolonlar nullable, `banka` satırları legacy uçlara görünmez).
2. Gerekirse yalnız migration'ın eklediği satırlar, **manifestteki `eklenen_idler`** üzerinden, elle ve gözden geçirilerek kaldırılır: `DELETE FROM soru WHERE id IN (<manifest ID'leri>) AND durum = 'banka'` — `durum='banka'` koşulu mevcut legacy satırları (onayli/bekliyor/red) korur. Bu bir **şablondur; bu PR'da hiçbir script bunu çalıştırmaz**.
3. Önce hazır olması gerekenler: manifest (eklenen ID'ler) + migration öncesi yedek. Yedekten geri yükleme de elle yapılır.
4. Eklenen nullable kolonlar geri alınmaz (zararsız; `DROP COLUMN` yapılmaz).
