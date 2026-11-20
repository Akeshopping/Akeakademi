# docs/tasarim/ — AKE Ritmi görünüm üretim süreci

`index.html` (görsel yenileme) elle yazılmaz; özgün taban (`870e057`, yenilemeden önceki main) `index.html`'inden bu klasördeki betikle **yeniden üretilir**. `main` artık üretilmiş dosyayı içerir: tabanı `main` yapmayın, `--base 870e057` (varsayılan) kullanın. Taban yeni bir özgün sürüme taşınırsa `--base` ile verin.

## Çalıştırma (Python 3, ek paket yok)

    python3 docs/tasarim/uret.py                 # tabanı origin/main (yoksa main), çıktıyı ./index.html yazar
    python3 docs/tasarim/uret.py --base origin/main --out /tmp/yeni.html   # taban = bir git sürümü (dal/etiket/commit)

Yol sabit değildir; her şey bu klasöre göre bulunur. Aynı girdiyle aynı çıktı üretilir (kontrol: iki kez çalıştırıp `cmp`).

## Dosyalar

| Dosya | Görev |
|---|---|
| `tokens.css` | Renk, yazı, gölge değişkenleri (varsayılan Mercan & Mürekkep, açık/koyu) |
| `ritim.css` | Bileşen kuralları + 4 palet (`data-pal`), özel renk bağları, şeffaf kart/cam, plan yerleşimi |
| `jsedits.py` | Ana görünüm kodu düzenlemeleri (`rep(eski, yeni, adet)`; adet tutmazsa durur) |
| `jsedits_acilis.py` | Açılış seçenekleri ve Ayarlar seçimi |
| `jsedits_renk.py` | Palet, özel renk (kontrast denetimli), şeffaf kartlar, plan ve rozet düzeni |
| `jsedits_tanitim.py` | Tanıtım ilk ekran: somut ürün cümlesi, gerçek sayılar (atlVeri), harita açıklaması |
| `jsedits_studyo.py` | Stüdyo yapışkan "Teste başla" çubuğu (mobil/tablet) |
| `jsedits_erken.py` | Satış kapalı: "Açıldığında haber ver" erken erişim listesi, paket/ödeme çağrıları, aydınlatma metni |
| `jsedits_esik.py` | Varsayılan Eşik açılışı: yerel K logosu, ~3,3 sn, ilk ziyarette bir kez, atla düğmesi ilk andan |
| `giris_ai.patch` | Giriş yolu (tanıtım/ilk kart/üst çubuk), Gelişim boş ısı haritası durumu, AI sohbet akışında akıllı kaydırma; özgün tabana, diğer düzenlemelerden önce uygulanır |
| `jsedits_video.py` | Mevcut serinin haftalık görsel zinciri (seri hesabı ve rozet koşulları değişmez) |
| `acilis_recolor.py`, `gen_icons.py` | Açılış/ikon yeniden renklendirme (gerekirse; varsayılan yol = depo kökü) |
| `rakam.woff2` | Rakam yazı tipi alt kümesi |

Statik dosyalar (üretilmez, doğrudan düzenlenir): `acilis/*.css`, `acilis/ortak/renk.js`, sahne dosyaları.

## Güvenlik sınırı

Üretici yalnızca görünümle ilgili CSS/JS metinlerini değiştirir. Giriş, kota, soru bankası, soru API'si, cevap anahtarı, güvenli mod ve D1 koduna dokunmaz; her düzenleme tam eşleşme ve adet doğrulamasıyla yapılır, eşleşmeyen düzenleme üretimi durdurur.

## Yeni ayar eklemek

Ayar anahtarlarını `jsedits_renk.py` içine yazın (ERISIM + `erisimSet` izinli değerler + Ayarlar kartı). `jsedits.py` ve `uret.py` değişmeden kalır; ayarlar yeniden üretimde kaybolmaz.

Not: klasör `docs/` altındadır çünkü depo kökündeki her üst düzey öğe yol-koruma testiyle sınıflandırılmak zorundadır; `docs/` zaten korunan (yayına verilmeyen) klasördür.
