# İki aşamalı yayın planı

Panel (Aşama 1) ve veli raporu (Aşama 2) birbirinden bağımsız yayınlanır. Hiçbir adım ayrı onay olmadan yapılmaz.

Dal: `gelistirme/panel-veli-raporu` — commit sırası: **A** `394a7fe` (yalnızca panel) → **B** (veli backend) → **C** (sınırlayıcılar + D1 testleri + bu plan).

## Aşama 1 — Yönetim paneli V2 (migration yok, Worker yok, ek maliyet yok)

1. Onay sonrası: `git checkout main && git merge --ff-only 394a7fe` (yalnızca commit A; yalnızca `index.html` değişir).
2. Cloudflare Pages üretim dağıtımının bittiğini bekle; `akeakademi.com/#yonetim` 7 sekmeyi göstermeli.
3. Beklenen davranış: "Veli Raporları" sekmesi `/api/yonetim/veli` bulunamadığı için "Veli raporu henüz canlıda etkin değil" gösterir. Hata vermez.
4. Geri alma: `git revert <birleştirme/commit>`; veri veya şema etkilenmez.
5. Not: Service worker sürümü (`sw.js`) değişmez; ağ-öncelikli olduğu için yeni `index.html` gelir.

## Aşama 2 — Veli raporu (hukuki değerlendirme + onay sonrası)

Ön koşullar: KVKK/aydınlatma ve veli onay metinlerinin hukuki incelemesi; Resend alan adı doğrulaması (SPF/DKIM); Resend planı; **Workers Paid ($5/ay)** (aşağıdaki sınırlar); `VELI_RAPORU` hâlâ kapalı.

1. B ve C commit'lerini main'e al (Pages dağıtılır; `VELI_RAPORU` kapalı olduğu için uç noktalar kapalı yanıt verir, kullanıcı kartı gizli kalır).
2. Production D1'e migration: `wrangler d1 execute <VERITABANI_ADI> --remote --file=migrations/0001_veli_raporu.sql` (yalnızca yeni tablo, `IF NOT EXISTS`, geri alma: tabloları düşür; başka veriye dokunmaz). Önce D1 yedeği/Time Travel noktası not edilir.
3. Worker: `workers/veli-rapor/wrangler.toml` içinde D1 `database_id`'yi gerçek değerle doldur; `wrangler secret put AKE_GIZLI` (Pages ile aynı değer) ve `RESEND_API_KEY`; `wrangler deploy`. Cron'lar: `0 16 * * SUN` (TR 19:00) ve yeniden deneme `0 18,20 * * SUN`.
4. Yalnızca test hesabıyla uçtan uca doğrulama (kendi e-postan): adres → onay → etkinleştir → Worker'ı "Trigger" ile çalıştır → e-posta → durdurma bağlantısı.
5. `VELI_RAPORU=1`: önce Pages'te, sonra Worker'da. Aşamalı: önce yalnızca birkaç gönüllü; ilk Pazar günü yönetim panelinde gönderim geçmişi izlenir.
6. Geri alma (anında): `VELI_RAPORU` değerini `0`/sil → gönderim ve uç noktalar durur. Gerekirse Worker cron'larını kaldır. Tablolar zararsız kalır.

## Sınırlar ve maliyet (Kasım 2026'da resmi dokümanlardan; yayından önce yeniden kontrol edin)

| Kalem | Ücretsiz | Ücretli | Etki |
|---|---|---|---|
| Resend | 100 e-posta/gün, 3.000/ay, 10 istek/sn | Pro $20/ay: 50.000/ay; aşım $0,90/1.000 | ~100 etkin aboneye kadar Free yeter; üstü Pro. Uygulama gönderimler arası 150 ms bekler. |
| Workers | 10 ms CPU/cron, 50 alt istek/çağrı (D1 dahil) | $5/ay taban; cron için 30 sn CPU, 1.000 alt istek | Gönderim başına ≈10 D1/HTTP alt isteği → Free'de çalıştırma başına ~4 öğrenci. Gerçek kullanım için Paid gerekir. Varsayılan parti 40 (`VELI_PARTI`); kalanlar 18:00/20:00 tetiklemelerine kalır. |
| D1 | 5 M okuma/gün, 100 bin yazma/gün | Dahil kotalar, aşımı kullanım başına | Haftada bir çalıştığı için ihmal edilebilir; aday sorgusu zaten gönderilmişleri eler. |
| Pages Functions | 100 bin istek/gün | — | Onay/ayar uçları düşük hacimli. |

Maliyetler kesin sıfır kabul edilmemelidir: Workers Paid taban ücreti, 100 aboneyi aşınca Resend Pro ve olası aşım ücretleri.
Yönetim panelinde etkin abonelik sayısı 80'e ulaştığında uyarı gösterilir.
