/* AKE Akademi site ayarları
   Tırnak işaretlerinin arasını doldur, kaydet ve siteyi yeniden yükle (Vercel otomatik günceller).
   Bu bilgiler Premium sayfasında ve yasal metinlerde (KVKK, mesafeli satış, iade) görünür.
   Boş bırakılan alanlar yasal metinlerde [KÖŞELİ PARANTEZ] olarak görünür.
   "Ödemeye geç" düğmesi; ad soyad, e-posta, fiyat ve ödeme linki dolunca açılır. */
window.AKE_AYAR = {
  adSoyad: "",        // Ad soyad ya da şirket unvanı (satıcı / veri sorumlusu)
  adres: "",          // Açık adres
  eposta: "",         // İletişim e-postası
  telefon: "",        // Telefon (isteğe bağlı)
  fiyat: "",          // Premium aylık fiyatı, yalnızca sayı. Örn: "149"
  aiLimit: "",        // Aylık AI mesaj hakkı. Örn: "300"
  odemeAracisi: "",   // Ödeme kuruluşu. Örn: "iyzico"
  odemeLinki: "",     // https:// ile başlayan ödeme sayfası linki
  yapayZeka: "",      // AI sağlayıcısı (boşsa "Anthropic (Claude)" yazar)
  barindirma: "Vercel",
  guncelleme: "3 Kasım 2026"  // Yasal metinlerin son güncelleme tarihi
};
