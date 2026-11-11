# B2 · Dağıtık hız sınırlayıcı: tasarım ve güvenli dağıtım sırası

Bu belge `lib/hiz.js` ve `migrations/0001_hiz_siniri.sql` için geçerlidir. Bu çalışmada uzak veritabanında hiçbir komut çalıştırılmadı.

## Tasarım özeti
- Sayaç D1'dedir; karar **tek atomik SQL komutunda** verilir (`INSERT ... ON CONFLICT DO UPDATE ... WHERE`). Sınır dolunca satıra dokunulmaz; `meta.changes = 0` reddetme anlamına gelir.
- Sabit pencere: pencere sınırında kısa süreli en çok 2 kat yüklenme olabilir. Bu bilinen ve kabul edilen bir değiştirmedir (basitlik ve tek komut atomikliği karşılığında).
- IP ve kullanıcı kimliği açık metin saklanmaz: `anahtar = SHA-256(tuz | kova | kimlik)` ilk 32 hex. Tuz: `AKE_HIZ_TUZ`, yoksa `AKE_GIZLI`. IPv6 adresleri /64 önekine indirilir.
- Büyüme: izinli isteklerin yaklaşık %2'sinde süresi dolmuş en çok 100 satır silinir. Beklenen silme > beklenen ekleme.
- **Güvenli hata:** `hiz` tablosu yoksa veya D1 hata verirse istek engellenmez; o Worker örneğinde eski bellek içi sayaca düşülür ve hata günlüğe yazılır. Uygulama tablo oluşturmaz.
- **İstisna, ücretli AI ve erişim kodu denemeleri:** `ai.js` sınırlayıcı çalışmazken isteği **reddeder (503, Retry-After 30)** ve sağlayıcıya gitmez; çünkü bellek içi yedek Worker örneği başınadır ve AI maliyetini sınırsıza açardı. Bu yüzden migration, kod dağıtımından ÖNCE uygulanmalıdır.

## Sınırlar
| Uç | Anahtar | Sınır |
|---|---|---|
| `hesap/kod-gonder` | IP | 20 / saat (B1 e-posta başına 60 sn + saatte 5 sınırı aynen duruyor) |
| `hesap/kod-dogrula` | IP | 60 / saat (B1 deneme sınırı aynen duruyor) |
| `hesap/kod-bagla` ve `ai` (kod denemesi) | IP + kullanıcı, ORTAK bütçe | IP 60 / saat, kullanıcı 20 / saat |
| `geribildirim` | IP + tüm site | IP 5 / saat, site 300 / gün |
| `hata` (kayıt) | IP + tüm site | IP 20 / saat, site 1500 / saat |
| `ai` | hesap (DB yoksa kod) | 40 / 5 dakika |
| `sosyal/oda` | IP | 6 / dakika + tablo tavanı 20000 satır |
| `sosyal/xp` | kullanıcı | 30 / dakika |
| `sosyal/takma` | kullanıcı | 10 / saat |
| `sosyal/lig|sinif/kur` | kullanıcı | 10 / saat |
| `sosyal/lig|sinif/katil` | IP | 20 / saat |
| `sosyal` yazma uçları (takma, lig, sinif, ozet) | kullanıcı | 240 / saat genel bütçe |

Eski sınırlardan farklar: `kod-gonder` IP sınırı 8 → 20, `kod-dogrula` 30 → 60 saat başına. Gerekçe: Bellek içi sayaçlar örnek başına olduğundan eski sınır pratikte daha gevşekti; sınırı olduğu gibi global yapmak okul/kafe gibi ortak IP'lerdeki meşru kullanıcıları engellerdi. Asıl koruma e-posta başına B1 sınırlarıdır. Sayılar `functions/api/hesap/[[yol]].js` içindeki `IP_KOD`, `IP_DOGRULA`, `IP_BAGLA` sabitlerinden ayarlanır.

## Erişim kodu deneme bütçesi (AI + kod-bagla ortak)
`/api/hesap/kod-bagla` ve `/api/ai` (`code` alanı, `check` dahil) aynı iki kovayı paylaşır: **IP başına saatte 60** ve **kullanıcı başına saatte 20** deneme. Bir uçtan harcanan hak diğerinden düşer. Kontrol `kodBagla` çağrılmadan ÖNCE yapılır; sınır dolmuşsa kod hiç değerlendirilmez. D1 sınırlayıcısı çalışmazsa (tablo yok / D1 hatası) deneme reddedilir (503): arızada erişim kodu tahmini açılmaz. Zaten aktif paketi olan kullanıcının AI/check istekleri kod denemesi sayılmaz.
Kapsam dışı: D1 olmayan eski kurulum yolu (`env.DB` yok, yalnızca ortam değişkenindeki kodlar) değişmedi; üretim D1 kullanıyor.

## Migration nasıl uygulanır
**Bu depoda kalıcı bir Wrangler yapılandırması (`wrangler.toml` / `wrangler.jsonc`) yoktur.** Bu nedenle bu belge uzak veritabanı komutu ÖNERMEZ; hesap, veritabanı adı/kimliği ve bağlama adı doğrulanmadan yazılacak bir komut yanlış veritabanına gidebilir. Migration dosyası (`migrations/0001_hiz_siniri.sql`) hazırdır; nasıl uygulanacağı, doğrulanmış yapılandırma/yöntem belirlendikten sonra ayrıca kararlaştırılır.

## Güvenli dağıtım sırası (sen onay verdikten sonra)
Kod tablo olmadan da çalışır (bellek içi yedek), ancak **ücretli AI ve erişim kodu denemeleri tablo yokken geçici 503 verir**. Bu yüzden migration kod dağıtımından ÖNCE uygulanmalıdır.
1. **Geri dönüş noktası:** Production ve Preview-test D1 için Time Travel geri dönüş noktası kaydedilir.
2. **Yöntemi ve hedefi doğrula:** Migration'ı uygulayacak yöntem ve hedef veritabanı (ad + kimlik) yazılı olarak doğrulanır; Production ile Preview-test karıştırılmaz.
3. **Preview-test veritabanında migration** uygulanır. Sonra `hiz` ve `hiz_bitis` nesnelerinin oluştuğu `sqlite_master` sorgusuyla doğrulanır.
4. **Preview dağıtımı ve smoke:** birkaç gerçek `kod-gonder`, geri bildirim, `kod-bagla` ve AI isteği denenir; 429 davranışı elle görülür. Günlüklerde `hiz: D1 sınırlayıcı kullanılamadı` mesajı OLMAMALI.
5. **Production migration** (aynı yöntemle, doğrulanmış hedefte). Yalnızca yeni tablo ve indeks ekler; mevcut veriye dokunmaz; tekrar çalıştırılabilir.
6. **Production kod dağıtımı.**
7. **Doğrulama:** 429/503 oranı, `SELECT COUNT(*) FROM hiz` ve günlükteki hata mesajı izlenir. Ortak IP'lerden şikâyet gelirse `IP_KOD` / `IP_DOGRULA` (hesap) ve `lib/hiz.js` içindeki kod deneme sayıları ayarlanır.
8. **Geri alma:** önceki dağıtıma dönülür (tablo kalabilir, zararsızdır). Tablo ancak kod geri alındıktan sonra kaldırılabilir.

Ön koşul: `AKE_GIZLI` (veya `AKE_HIZ_TUZ`) production'da tanımlı olmalıdır. Tuz değişirse sayaçlar yeniden başlar (zararsız).
Cloudflare'daki mevcut WAF kuralına dokunulmaz; bu sınırlayıcı onun yerine geçmez, tamamlar.
