# Korumalı soru bankası · PR 2/6 · sunucu taraflı soru oturumu API'si ("karanlık API")

**Durum:** `AKE_SORU_V2=1` ortam değişkeni yoksa tüm uçlar `404` döner ve D1'e hiç dokunulmaz. Frontend bu API'yi çağırmaz; `/api/sorular`, `sorular/*.json`, `index.html` BANK/EKQ, `sw.js` değişmedi. Production'da `AKE_SORU_V2` AYARLANMAZ; production D1'e 1.216 soruluk canonical göç (1.127 embedded/statik [728 + 99 + 100 + 200] + mevcut 89 D1 `ok-*`; PR 1 aracı) henüz uygulanmadı.

## Uçlar (`functions/api/soru/[[yol]].js` → `lib/soru-api.js`)

| Uç | İş |
|---|---|
| `POST /api/soru/oturum` | `{istek, mod: practice\|exam, adet, ders?, konu?, zorluk?}` → `{oturum, mod, adet, sonaErme, sorular:[{id,s,t,d,p?,q,o}], kota}`. **a/x/h/rk/json/kopya_of/kaynak yok.** |
| `POST /api/soru/cevap` | `{oturum, soru, secim 0-4}` → pratik: `{dogru, a, x}` (ilk cevapta; sonra kilitli, farklı seçim `409 cevap_kilitli`); sınav: `{kaydedildi:true}` (bitene kadar değiştirilebilir, anahtar yok). |
| `POST /api/soru/bitir` | Sahibi atomik bitirir; idempotent. Sınav: tüm sorular + `secim, a, x, dogru`; pratik: yalnız cevaplananların anahtarı. |
| `GET /api/soru/ozet` | Yalnız sayılar (ders/konu/zorluk); metin, şık, a/x yok. |

Sıra: **bayrak → yöntem/yol → aynı-origin (CSRF) → oturum (çerezden kid) → şema → iş.** Tüm yanıtlar `Cache-Control: private, no-store`. Bilinmeyen alan (örn. `idler`, `kid`, `oturum`/`id` ile kendi kimliğini seçme) `400`.

Hata kodları: 400 geçersiz girdi · 401 oturum yok · 402 ücretsiz hak bitti · 403 origin · 404 yok (başkasının oturumu/sorusu da 404) · 405 yöntem · 409 `cevap_kilitli`/`oturum_bitti`/`istek_cakisma` · 410 `sure_doldu` · 429 `cok_acik_oturum` · 503 `banka_yok`/`gecici`/`mesgul`.

## D1 şeması (yalnız bayrak AÇIKKEN, oturumlu ilk istekte kurulur)

- `soru_oturum (id PK, kid, mod, durum, olusturma, sona_erme, bitis, adet, kota_tur, kota_verilen, istek NOT NULL, filtre, UNIQUE(kid, istek))` + indeks `soru_oturum_kid (kid, durum, sona_erme)`.
- `soru_oturum_soru (oturum, sira, soru_id, secim, cevap_zamani, dogru, PK(oturum, sira), UNIQUE(oturum, soru_id))`.
- Seçim indeksleri (partial, `WHERE durum IN ('banka','onayli') AND kopya_of IS NULL AND govde IS NOT NULL AND a IS NOT NULL AND x IS NOT NULL`): `soru_sec_rk (rk)`, `soru_sec_s_rk (s, rk)`, `soru_sec_st_rk (s, t, rk)`. `d` için ayrı indeks eklenmedi (ölçüm gerektirmedi: ders+rk indeksi sırayı verir, `d` satırda süzülür).
- Durumlar: `acik`, `bitti`, `iptal`. `hazirlaniyor` yalnız tek işlemin (batch) içinde vardır; commit sonrası hiçbir satırda kalmaz.
- `soru_gecmis` eklenmedi (yanlış tekrar/geçmiş önceliği PR 4).

## Kota + oturum atomikliği

`kotaAl` + sonra INSERT **yoktur**. Tek `env.DB.batch()` (D1: *"Batched statements are SQL transactions … each statement … execute and commit, sequentially, non-concurrently"*; hata → tümü geri alınır). D1 batch'te sonuca göre dallanma olmadığından tüm karar SQL şartlarındadır:

1. sayaç satırı yoksa 0 ile oluştur (yalnız ücretsiz)
2. oturumu `hazirlaniyor` ekle — şartlar: `(kid,istek)` yok · açık oturum < 3 · `sayaç + hak <= limit`
3. soruları `json_each` ile ekle — şart: oturum satırı var ve soru hâlâ uygun
4. sayacı artır — şart: oturum satırı var ve `sayaç + hak <= limit`
5. doğrula+etkinleştir: soru sayısı tamam **ve** `changes() = 1` ise `acik`; değilse `durum = NULL` → NOT NULL ihlali → **tüm batch (kota dahil) geri alınır**.

Sonuç: "kota düştü, oturum yok" ya da "oturum var, kota düşmedi" kalıcı olamaz. Şart sağlanmazsa 3-5 sessiz no-op olur; çağıran nedeni okur (aynı istek → mevcut oturum; açık ≥ 3 → 429; kota yarışı → yeniden oku, sonunda 402). Aynı `kid+istek` tekrarı yeni kota harcamaz. Ücretsiz sayaç `ucretsiz_kimlik` (eski `ucretsiz` yedeği) — `lib/kota.js`'e yardımcı `kotaRezervasyonKonumu` eklendi: mevcut `kotaAl/kotaDurum` tüketim davranışını değiştirmez ve yeni kullanım ayırmaz/artırmaz; ancak mevcut `hazirla()` yolunu çağırdığı için saf okuma DEĞİLDİR (kota tablolarını `CREATE IF NOT EXISTS` ile hazırlayabilir, eski dönem kayıtlarını tembel temizleyebilir, eski kid tabanlı sayacı `ucretsiz_kimlik`'e taşıyabilir). Asıl soru oturumu kota artışı tek atomik batch içinde yapılır; `kotaAl/kotaDurum` değişmedi. Eski `/api/hesap/kota` aynı sayacı kullanır.

Doğrulama: yerel SQLite kabuğunda (iç içe geçen istekler, her noktada hata enjeksiyonu) ve **gerçek D1 uygulaması (miniflare/workerd)** üzerinde: paralel 20+20, 7 hak 10+10, paralel sınav, aynı istek 5×, NOT NULL → geri alma, `changes()` semantiği, EXPLAIN. Üretim D1 hizmetinde AYNI testin staging'de koşulması bayrağı açmadan önce önerilir.

## Seçim

`rk >= r ORDER BY rk LIMIT n` sonra gerekirse `rk < r` (sarma); `r` = kriptografik rastgele. SQL rastgele sıralama yok, banka JS'ye çekilmez, seçim sorgusu `a/x` okumaz, `SELECT json` yok. Bilinen sınırlama: aynı `r`'den başlayan iki oturum örtüşür (rk rastgele olduğundan içerik açısından yanlılık yok); tekrar önceliği PR 4.

## Süre ve sınırlar

- Oturum ömrü: practice 24 sa (bir günlük çalışma + gece), exam 6 sa (gerçek TYT/AYT ≤ 3 sa 15 dk + pay). Dolan oturum cevap kabul etmez, anahtar vermez (`410`); tembel olarak `iptal` olur.
- Tek istekte en çok practice 50 / exam 120 (kazıma/payload sınırı; ürün kotası değil). Ücretli de aynı.
- Kullanıcı başına en çok 3 açık oturum (`429`). **Risk:** arayüz oturumu `/bitir` ile kapatmazsa terk edilen oturumlar 24 sa sayılır; frontend bağlanırken oturumu bitirmeli ya da eski oturum otomatik iptal edilmeli (PR 3+).
- **TODO (ayrı PR):** kalıcı (D1) saatlik oturum-oluşturma hız sınırı; test planı `tests/soru-api-guvenlik.test.mjs` içinde `test.todo`.

## CUTOVER BLOCKER / SONRAKİ PR: yönetim soru üretim write-path'i

`functions/api/yonetim/[[yol]].js` → `soru-uret` bugün yeni `onayli` soruları **legacy biçimde** yazar (`id, s, t, d, json, durum, tarih, karar`); `govde, a, x, h, rk, kaynak` kanonik kolonlarını **doldurmaz**. V2 uygun-soru koşulu (`durum IN ('banka','onayli') AND kopya_of IS NULL AND govde IS NOT NULL AND a IS NOT NULL AND x IS NOT NULL`) olduğundan, production göçünden SONRA üretilen yeni legacy `ok-*` soruları kanonik backfill/write-path yapılmazsa V2 havuzuna GİRMEZ. Bu PR'da yönetim kodu değiştirilmedi.

**V2 frontend cutover'ı ve `/api/sorular`'ın kapatılması öncesinde, yönetim soru üretim write-path'i kanonik kolonları (`govde, a, x, h, rk, kaynak`) atomik olarak dolduracak şekilde güncellenmek ZORUNDADIR.** Bu iş sonraki uygun PR'a blocker olarak taşınmıştır.
