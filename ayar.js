/* AKE Akademi site ayarları
   Tırnak işaretlerinin arasını doldur, kaydet ve GitHub'a yükle (site birkaç dakikada otomatik güncellenir).
   Bu bilgiler Premium sayfasında ve yasal metinlerde (KVKK, mesafeli satış, iade) görünür.
   Boş bırakılan alanlar yasal metinlerde [KÖŞELİ PARANTEZ] olarak görünür.
   Bir paketin "Bu paketi seç" düğmesi; ad soyad, e-posta ve o paketin ödeme linki dolunca açılır.
   Ödeme linkleri Shopier ürün linkleridir. Fiyat değiştirirsen Shopier'deki ürün fiyatını da aynı yap. */
window.AKE_AYAR = {
  adSoyad: "Ali Kaan Eren",   // Ad soyad ya da şirket unvanı (satıcı / veri sorumlusu)
  adres: "Güneşler Yeni Mahalle 5203. Sokak No:4 Kat:1 Adapazarı/Sakarya",   // Açık adres
  eposta: "alikaaneren13@gmail.com",   // İletişim e-postası
  telefon: "",        // Telefon (isteğe bağlı)
  odemeAracisi: "Shopier",   // Ödeme kuruluşu
  fiyatOrta: "199",       // Orta paket aylık fiyat (TL, sadece sayı)
  yillikOrta: "2189",     // Orta paket yıllık fiyat
  fiyatPremium: "399",    // Premium paket aylık fiyat
  yillikPremium: "4389",  // Premium paket yıllık fiyat
  aiOrta: "200",          // Orta paket aylık AI mesaj hakkı
  aiPremium: "500",       // Premium paket aylık AI mesaj hakkı
  cozumOrta: "20",        // Orta paket: bu mesajların kaçı gelişmiş modelle soru çözümü olsun
  cozumPremium: "60",     // Premium paket: bu mesajların kaçı gelişmiş modelle soru çözümü olsun
  linkOrtaAy: "https://www.shopier.com/AKESHOPPING/52547800",   // Ödeme linkleri (https:// ile başlar). Boş olan paket "Çok yakında" görünür.
  linkOrtaYil: "https://www.shopier.com/AKESHOPPING/52547904",
  linkPremiumAy: "https://www.shopier.com/AKESHOPPING/52547968",
  linkPremiumYil: "https://www.shopier.com/AKESHOPPING/52547986",
  yapayZeka: "",      // AI sağlayıcısı (boşsa "Anthropic (Claude)" yazar)
  barindirma: "Cloudflare",
  guncelleme: "4 Kasım 2026"  // Yasal metinlerin son güncelleme tarihi
};
