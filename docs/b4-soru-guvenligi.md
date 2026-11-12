# B4 — Soru Bankası ve Cevap Anahtarı Güvenliği

Dal: `fix/b4-soru-guvenligi` (taban: `main` a058874). B1, B2, B3 korunmuştur. **Henüz commit/push/PR/migration/deploy yapılmadı.**

> **ÖNEMLİ — kapsam:** Bu PR B4'ün **yalnızca Aşama 1–2 hazırlığıdır** (sunucu altyapısı + istemci akışı, bayrakla kapalı gelir). **Gömülü `BANK` (728 soru, `a` ve `x` ile) ve `/sorular/*.json` statik dosyalarındaki cevap sızıntısı, Aşama 3 yayına girene kadar DEVAM EDER.** Bu PR tek başına sızıntıyı kapatmış sayılmamalıdır.

**Bağımsız inceleme düzeltmeleri (2. tur):** (1) oturum açma hatasında eski yerel sisteme otomatik dönüş kaldırıldı; (2) katalog sayfalandı; (3) `soru-ice-aktar` mevcut kimlikte içerik bütünlüğünü denetler.
Bu çalışma yalnızca yerel ve izole test ortamında (node:sqlite D1 taklidi + yerel Chromium) yapıldı; Production/Preview veritabanına ve ortam değişkenlerine dokunulmadı; soru havuzundan hiçbir şey silinmedi.

## 1. Güvenlik raporu — doğrulanan sızıntı yolları

| # | Yol | Kanıt | Durum bu PR'dan sonra |
|---|-----|-------|------------------------|
| 1 | `index.html` içinde gömülü `BANK` (728 soru, her birinde `a` ve `x`) | `BANK.length` = 728; tüm kayıtlarda `a` ve `x` var (tarayıcıda ölçüldü) | Çözüm akışı artık sunucudan; gömülü veri **Aşama 3**'te HTML'den çıkarılır (bkz. §2). Bayrak açıkken çözme akışında RUN/localStorage anahtar içermez |
| 2 | `GET /api/sorular` (herkese açık, ≤5000 onaylı soru, ham JSON, `max-age=300`) | `functions/api/sorular.js` | `AKE_SORU_V2=1` **ve** `AKE_SORU_ESKI_KAPAT=1` iken `{sorular:[],kapali:true}` + `no-store` |
| 3 | `/sorular/liste.json` ve `/sorular/*.json` statik dosyaları (`a`,`x` içerir) | Pages statik servis | Aynı iki bayrakla `functions/sorular/[[yol]].js` → 404 `no-store`; bayrak kapalıyken `env.ASSETS` aynen |
| 4 | İstemci değerlendirmesi (`pickAnswer`, `finishRun`: `o === q.a`) | `index.html` | Sunucu oturumlu sorularda cevap `/api/soru/cevap`, deneme `/api/soru/bitir` ile; puan sunucuda |
| 5 | `lib/soru-api.js` bayrağa bağlı, arayüz kullanmıyordu | — | Arayüz bağlandı (bayrak yoksa eski akış) |
| 6 | `lib/soru-kanonik.js`: eski `soru.json` doğru cevapları taşıyor | — | Herkese açık hiçbir uç `json` sütununu döndürmez; yalnızca `govde/a/x` kanonik sütunları sunucu içinde kullanılır |
| 7 | Önbellekler: HTTP/CDN (`/api/sorular` 300 sn), service worker (`/` ve `/sorular/*`), `localStorage ake.ek`, `ake.run` anlık görüntüsü | `sw.js`, `index.html` | `/sorular/*` SW'den muaf; `ake.run` artık sunucu sorularında `a/x` taşımaz (cevaplananlar hariç); `ake.ek` temizliği Aşama 3 |

**Önbellek sınırı (açık söyleniyor):** Daha önce yayınlanmış cevaplar — tarayıcı/CDN/SW önbelleği, `localStorage`, indirilmiş HTML, üçüncü kişilerin kopyaları — **geri alınamaz**. Bu PR yalnızca bundan sonra yeni sızıntıyı ve değiştirilmiş (yeniden yazılacak) soruların anahtarını önler. Gömülü 728 sorunun cevapları, Aşama 3 deploy edilene kadar sayfa kaynağında durur; yayınlanmış sürümlerin kopyaları için tek gerçek çözüm o soruların yerine yeni soru yazmaktır.

## 2. Geçiş mimarisi (bağımsız, geri alınabilir aşamalar)

**Aşama 1 — Sunucu hazırlığı (bu PR, bayrak kapalıyken hiçbir şey değişmez)**
- `lib/soru-api.js` yeniden kullanıldı ve genişletildi: `idler` (katalogtan kimlikle oturum), `parcalar` (çok bölümlü oturum), `GET /api/soru/katalog` (cevapsız, **sayfalı**: `?limit=1..1000` varsayılan 200, `?sonra=<imleç>`; id'ye göre kararlı anahtar-kümesi sayfalama; yanıt `{n, sorular, sonraki}`; her sayfa isteği hız sınırına (30/sa) sayılır; hiçbir yanıtta `a/x/json/govde/kaynak/kopya_of` yok), toplu `cevaplar` ile `bitir` (sınavda tek istekte sunucu puanı), oturum sayısı sınırında en eskiyi otomatik iptal, hız sınırı (B2 `hizSinir`: kullanıcı 60/sa, IP 600/sa; katalog 30/sa).
- Yeni yönetim ucu `POST /api/yonetim/soru-ice-aktar` (1–100 soru, `kaynak=statik`, `durum=banka`): gömülü/statik soruları kanonik D1'e taşır. **Mevcut kimlikle karşılaşırsa** yüklenen içerik kanonik alanlara çevrilip kayıtla karşılaştırılır (`s,t,d,govde,a,x`): aynıysa idempotent (`var`), farklıysa gerçek çatışma (`kimlikCatismasi`, `sorunlu[].neden=kimlik_farkli_icerik`, yalnız farklı **alan adları**; cevap/çözüm değeri yanıtta yok). Mevcut kayıt hiçbir koşulda değiştirilmez/silinmez; eski (kanonik alanı olmayan) satır 'aynı' sayılmaz. `AKE_SORU_MIGRATION_LOCK` bunu da kapsar.
- Yeni dosya: `lib/soru-bayrak.js` (`bayrakAcik`, `eskiKapali`).

**Aşama 2 — İstemci (bu PR, `AKE_SORU_V2=1` olmadıkça eski yerel akış aynen)**
- `startRun` → `svBaslat`: giriş yapmış kullanıcıda, üretilmiş (gen)/AI/yanlış defteri/canlı deneme dışı sorular için `idler` ile oturum açar; 404 (V2 kapalı/uç yok) ya da `banka_yok` (sunucuda uygun soru henüz yok; kota düşmez) ise eski yerel akışa düşer. **Beklenmeyen hatada (500/503/ağ/400 vb.) eski sisteme DÖNÜLMEZ**: 'Sorular şu an açılamadı' penceresi + 'Tekrar dene'. Tekrarda aynı `istek` anahtarı kullanılır; ilk istek sunucuda tamamlanmış (kota düşmüş) olsa bile sunucu aynı oturumu geri verir, **kota ikinci kez düşmez** (testle doğrulandı).
- Çalışma: cevap `/api/soru/cevap` → doğru seçenek + çözüm ekranda; cevaplanmamış sorunun anahtarı istemcide yok.
- Deneme: bitene kadar hiçbir yanıtta anahtar yok; **Bitir** → tek `/api/soru/bitir` (toplu cevaplar) → puan ve anahtar. Süresi dolmuş/iptal oturumda anahtarı alınamayan sorular **boş** sayılır (yanlış sayılmaz).
- Kota: oturum açılırken sunucuda atomik düşer; eski `/api/hesap/kota` yalnızca yerelde kalan (üretilmiş) sorular için çağrılır → çifte düşüm yok. Ücretsiz kota bitince oturum kısılır.
- Servis worker sürümü (`ake-s2`) bilinçli **değiştirilmedi** (testler sabit; Aşama 3'te).

**Aşama 3 — Ayrı sonraki PR (Production geçişi ve V2 doğrulamasından sonra)**
Gömülü `BANK`'ı HTML'den çıkar, `/sorular/*.json` dosyalarını kaldır, SW `V` artır + `sw` testini güncelle, `ake.ek` temizle, soru bankası gezgini / paragraf / ÖSYM / günün sorusu / `tn` akışlarını sunucuya taşı, `os`/`fix` ek alanlarını kanonik `govde`'ye ekle.

## 3. Sınav kuralları (açık tanım)
- Sınav oturumunda cevap anahtarı **yalnızca** `/bitir` yanıtında gelir; sınav sırasında `/cevap` çağrılmaz.
- Cevap değiştirme: bitirilene kadar serbest (yalnızca istemci durumu); `/bitir` isteğindeki **son** cevap listesi geçerli; listede olmayan soru boş sayılır; yinelenen/bilinmeyen alan → 400.
- Bitiş sonrası oturum kapanır; ikinci `/bitir` önceki sonucu döndürür (cevaplar uygulanmaz). Süresi dolan oturum 410.
- Çalışma modunda ilk cevap kilitlenir; açıklama cevaptan sonra gelir.

## 4. Dağıtım planı
**Preview:** (1) PR'ı Preview'a dağıt, bayraklar kapalı → eski akış çalışıyor mu (smoke). (2) Preview D1'de migration runbook (`docs/soru-bankasi-production-migration.md`) → `soru-ice-aktar` ile 728 gömülü soruyu aktar (adet kontrolü: D1'deki `statik` soru sayısı = 728 − kopya). (3) Preview'da `AKE_SORU_V2=1` → test hesabıyla çalışma/deneme/yanlış defteri/canlı deneme. (4) `AKE_SORU_ESKI_KAPAT=1` → `/api/sorular` boş, `/sorular/*` 404; uygulama hâlâ çalışıyor mu.
**Production (onayınızla, bu sırayla, her adım ayrı ve geri alınabilir):** migration (kilit açıkken) → soru sayısı doğrulama → `AKE_SORU_V2=1` → 24 saat izleme → `AKE_SORU_ESKI_KAPAT=1` → Aşama 3 PR'ı.
**Eski frontend uyumu:** Eski `index.html` önbellekteyken `ESKI_KAPAT` açılırsa `/api/sorular` boş döner (soru kaybı yok, gömülü bank çalışır); statik `fabrika` dosyaları 404 olur (`fabrikaYukle` sessizce atlar). Bu yüzden `ESKI_KAPAT` en son açılır.
**CDN:** `/api/sorular` genel `max-age=300` idi; kapatma `no-store` ile yanıt verir ama kenarda en çok 5 dk eski kopya kalabilir. Cloudflare "Purge Everything" önerilir (sizin onayınızla).

## 5. Geri alma
- Tüm yeni davranış bayrakla: `AKE_SORU_ESKI_KAPAT` kaldır → eski uçlar açılır; `AKE_SORU_V2` kaldır → istemci eski yerel akışa döner (`/api/soru/*` 404). Veri silinmez; D1'e eklenen satırlar zararsız.
- `soru_oturum_soru.parca` sütunu korumalı `ALTER` ile eklenir (geri alma gerekmez, eski kod yok sayar). Migration dosyası yok.

## 6. Yeni sorular nasıl otomatik girer
- `soru-uret` (AI üretimi) → `lib/soru-yaz.js` kanonik yazım (çift yazım) → V2 açıkken katalog ve oturumlara kendiliğinden girer (`UYGUN` koşulu: `durum IN (banka, onayli)`, kopya değil, `govde/a/x` dolu).
- Elle/statik soru: `POST /api/yonetim/soru-ice-aktar` (100'lük partiler, tekrar çalıştırılabilir; çakışma/kopya/geçersiz sayıları döner).

## 7. Test sonuçları (yerel, izole; Production/Preview'a dokunulmadı)
- `node --test tests/*.test.mjs`: **318/318 geçti** (319 test, 0 hata/atlanan). B1 `hesap-giris-kod` 21/21, B2 `hiz-b2` 28/28, B3 `canli-b3` 20/20; B4 `soru-b4.test.mjs` 29/29 (gerçek handler'lar).
- Tarayıcı (gerçek handler + yerel D1): `soru-b4-istemci.mjs` **37/37**; `kota-yetki-regresyon` 23/23; `hesap-fail-closed` 39/39; `sw-guncelleme-regresyon` 30/30.
- Yeni regresyonlar: katalog sayfalama (kararlı sıra, tekrar/eksik yok, sayfalar arası ekleme, sınır doğrulamaları, 401, hız sınırı, sızıntı yok); içe aktarma (aynı içerik idempotent; farklı cevap/çözüm/metin/konu = çatışma; kayıtlar bayt bayt değişmedi; eski satır); istemci (500 → durur ve tekrar dener, kota düşmez; yanıtı kaybolan başarılı istek → tekrarda aynı oturum, kota tek sefer; ağ kopuk; `banka_yok` → eski akış; V2 kapalı → eski akış).
- Mutasyon kontrolleri (hepsi yakalandı, geri alındı): oturum çıktısına `a` ekleme; `/sorular/*` kapatmasını kaldırma; içe aktarmada her kimlik çakışmasını `var` sayma; kataloğu sınırsız yapma; sunucu hatasında eski akışa dönme.
- Mevcut sorular, abonelikler ve öğrenci ilerlemesi: hiçbir tablo/sütun silinmedi veya değiştirilmedi; yeni kod yalnızca okur/ekler; `soru_oturum_soru.parca` korumalı ALTER (eski kod yok sayar).

## 8. Kalan riskler
1. **Gömülü BANK ve statik JSON'daki cevap sızıntısı Aşama 3'e kadar devam eder.** Bu PR yalnızca altyapıyı ve akışı hazırlar; cevaplar sayfa kaynağında ve `/sorular/*.json` içinde durur.
2. Üretilmiş (GENS) sorular yerelde; cevapları istemcide. Bunlar rastgele üretildiğinden bankadaki sabit sorular kadar değerli değil ama aynı koruma yok.
3. Premium sınırsız kullanıcı oturum açarak yavaş yavaş soru toplayabilir (saatte 60 oturum ile sınırlı); çalışma modunda cevaplanan sorunun anahtarı zaten verilir.
4. Sınavda 120'den fazla sunucu sorusu varsa parçalara bölünür; ücretsiz kullanıcıda ikinci parça 402 olur ve fazlası sete eklenmez (nadir).
5. Çalışma modunda cevaplanmamış soruların çözümü sonuç ekranında görünmez (anahtar yok).
6. `os`/`fix` ek alanları kanonik `govde`'de yok (istemci bunları yerel kayıttan kopyalar; Aşama 3'te taşınmalı).
7. Yanlış defteri, canlı deneme, bank gezgini, ÖSYM/paragraf yan akışları yerel veriyle çalışmaya devam eder (uyumluluk bilinçli korundu).
8. İstemci katalog yerine her başlatmada `idler` kullanır; sunucuda olmayan sorular yerel kalır (kısmi migration güvenli).

## 9. Değişen dosyalar
`index.html`, `lib/soru-api.js`, `lib/soru-yaz.js`, `lib/soru-bayrak.js` (yeni), `functions/api/sorular.js`, `functions/api/yonetim/[[yol]].js`, `functions/sorular/[[yol]].js` (yeni), `sw.js`, `tests/soru-b4.test.mjs` (yeni), `tests/soru-b4-istemci.mjs` (yeni), `tests/yardim/soru-v2.mjs` (sorgu dizesi desteği), `tests/soru-api.test.mjs`, `tests/soru-api-guvenlik.test.mjs`, `docs/b4-soru-guvenligi.md` (yeni).
