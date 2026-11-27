# Konu adı karşılaştırması ve eşleme önerisi (KARAR BEKLİYOR, veritabanına konu eklenmedi)

Bu belge soru METNİ içermez. Hiçbir konu adı veritabanına eklenmedi; aktarım aracı konu adını olduğu gibi taşır ve yeni adları raporda "yeni konu" diye işaretler.

## Sitedeki mevcut TYT Matematik (`mat`) konu adları
Kaynak: `fabrika/mevcut_konular.json` (23 ad) ve gömülü bankadaki 40 soru (`fabrika/mevcut_ozet.json`):
Sayılar (3 soru) · Mutlak değer (2) · Önermeler/Mantık (3-5) · Bölme ve bölünebilme (1) · **Problemler (10)** · Sayısal mantık (1) · Kümeler (3) · Veri analizi (1) · Üslü sayılar (2) · Köklü sayılar (1) · Oran-Orantı (1) · Yüzde problemleri / Yüzde Problemleri (2, iki yazım) · EBOB-EKOK (1) · Denklem sistemleri (1) · Hareket Problemleri (1) · İş problemleri (1) · Fonksiyonlar (1) · Permütasyon ve Kombinasyon (1) · Olasılık (1) · İkinci dereceden denklemler (1) · Bölenler (1) · Ortalama (1).

İstemci tarafında `KONU_ESLE` (`index.html`) adları **büyük/küçük harf ve noktalamaya bakmadan** birleştirir ve `M.mat` eşleme tablosu şu an **boştur**. Yani yeni bir ad olduğu gibi bir konu olarak görünür; ayrıca eşleme tablosuna satır eklenerek mevcut bir adla birleştirilebilir.

## Yedi konu adı ve öneri
| Aktarılan ad | Sitede birebir karşılık | En yakın mevcut ad | Öneri |
|---|---|---|---|
| Sayı Basamakları | yok | Sayılar | **Sayılar'a eşle** |
| Rasyonel Sayılar | yok | Sayılar | **Sayılar'a eşle** |
| Basit Eşitsizlikler | yok | yok (Denklem sistemleri uymaz) | **Yeni konu olarak ekle** |
| Çarpanlara Ayırma | yok | yok | **Yeni konu olarak ekle** |
| Yaş Problemleri | yok | Problemler | **Problemler'e eşle** |
| Kâr Zarar Problemleri | yok | Yüzde problemleri / Problemler | **Problemler'e eşle** |
| Karışım Problemleri | yok | Problemler | **Problemler'e eşle** |

Gerekçe: Sitedeki liste kaba ve eski; yeni 2027 konu listesi (Sayı Basamakları, Rasyonel Sayılar, Basit Eşitsizlikler, Çarpanlara Ayırma, Yaş/Kâr-Zarar/Karışım ayrı) daha ayrıntılı. Mevcut konulara eşlemek öğrenci arayüzünü sade tutar ama ayrıntıyı kaybeder: "Problemler" altında Yaş + Kâr-Zarar + Karışım birlikte ~15 bin soruyla sitedeki 10 sorunun yanında baskın çıkar.

## Alternatif
Yedi adı da **yeni konu** olarak eklemek: 2027 listesine birebir uyar, öğrenci konu bazlı çalışabilir; ancak Sayılar/Problemler içinde konu sayısı artar ve mevcut az sorulu konularla dengesiz görünür.

## Karar gerekenler
1. Yukarıdaki karma öneri mi (3 eşleme + 2 yeni), hepsi yeni konu mu, hepsi mevcut konuya mı?
2. "Yüzde problemleri / Yüzde Problemleri" çift yazımı (mevcut veri) bu işten bağımsız birleşiyor mu, yoksa tek yazıma mı çekilsin?
3. Karar sonrası uygulanacak yer: aktarım aracında `t` eşlemesi (yeni PR) ve/veya `KONU_ESLE` tablosu. Bu PR'da hiçbiri yapılmadı.
