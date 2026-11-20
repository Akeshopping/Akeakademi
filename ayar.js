/* AKE Akademi site ayarları
   Tırnak işaretlerinin arasını doldur, kaydet ve GitHub'a yükle (site birkaç dakikada otomatik güncellenir).
   Bu bilgiler Premium sayfasında ve yasal metinlerde (KVKK, mesafeli satış, iade) görünür.
   Boş bırakılan alanlar yasal metinlerde [KÖŞELİ PARANTEZ] olarak görünür.
   SATIŞ KAPALI (21 Kasım 2026): Atılım ve Premium için ödeme alınmaz; site "Açıldığında haber ver" listesi gösterir.
   Aşağıdaki ödeme linkleri bilerek BOŞTUR ve sitede hiçbir yerde kullanılmaz. Eski Shopier ürünlerini Shopier panelinden de kapat.
   Daha önce alınmış erişim kodları ve Shopier sipariş bildirimi (sunucu) çalışmaya devam eder. */
window.AKE_AYAR = {
  adSoyad: "Ali Kaan Eren",   // Ad soyad ya da şirket unvanı (satıcı / veri sorumlusu)
  adres: "Güneşler Yeni Mahalle 5203. Sokak No:4 Kat:1 Adapazarı/Sakarya",   // Açık adres
  eposta: "info@akeakademi.com",   // İletişim e-postası
  telefon: "",        // Telefon (isteğe bağlı)
  odemeAracisi: "Shopier",   // Ödeme kuruluşu
  fiyatOrta: "199",       // Atılım paketi aylık fiyat (TL, sadece sayı)
  yillikOrta: "2189",     // Atılım paketi yıllık fiyat
  fiyatPremium: "399",    // Premium paket aylık fiyat
  yillikPremium: "4389",  // Premium paket yıllık fiyat
  aiOrta: "200",          // Atılım paketi aylık AI mesaj hakkı
  aiPremium: "500",       // Premium paket aylık AI mesaj hakkı
  cozumOrta: "20",        // Atılım paketi: bu mesajların kaçı gelişmiş modelle soru çözümü olsun
  cozumPremium: "60",     // Premium paket: bu mesajların kaçı gelişmiş modelle soru çözümü olsun
  linkOrtaAy: "",   // satış kapalı: boş bırak
  linkOrtaYil: "",
  linkPremiumAy: "",
  linkPremiumYil: "",
  yapayZeka: "",      // AI sağlayıcısı (boşsa "Anthropic (Claude)" yazar)
  barindirma: "Cloudflare",
  guncelleme: "5 Kasım 2026"  // Yasal metinlerin son güncelleme tarihi
};
