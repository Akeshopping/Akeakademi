/* AKE Akademi site ayarları
   Tırnak işaretlerinin arasını doldur, kaydet ve siteyi yeniden yükle (Vercel otomatik günceller).
   Bu bilgiler Premium sayfasında ve yasal metinlerde (KVKK, mesafeli satış, iade) görünür.
   Boş bırakılan alanlar yasal metinlerde [KÖŞELİ PARANTEZ] olarak görünür.
   Bir paketin "Bu paketi seç" düğmesi; ad soyad, e-posta ve o paketin ödeme linki dolunca açılır.
   ÖNEMLİ: AI öğretmen siteye bağlanmadan ödeme linki ekleme; yoksa satıp veremeyeceğin bir hizmet satmış olursun. */
window.AKE_AYAR = {
  adSoyad: "",        // Ad soyad ya da şirket unvanı (satıcı / veri sorumlusu)
  adres: "",          // Açık adres
  eposta: "",         // İletişim e-postası
  telefon: "",        // Telefon (isteğe bağlı)
  odemeAracisi: "",   // Ödeme kuruluşu. Örn: "iyzico"
  fiyatOrta: "149",       // Orta paket aylık fiyat (TL, sadece sayı)
  yillikOrta: "1490",     // Orta paket yıllık fiyat
  fiyatPremium: "299",    // Premium paket aylık fiyat
  yillikPremium: "2990",  // Premium paket yıllık fiyat
  aiOrta: "300",          // Orta paket aylık AI mesaj hakkı
  aiPremium: "800",       // Premium paket aylık AI mesaj hakkı
  linkOrtaAy: "",         // Ödeme linkleri (https:// ile başlar). Boş olan paket "Çok yakında" görünür.
  linkOrtaYil: "",
  linkPremiumAy: "",
  linkPremiumYil: "",
  yapayZeka: "",      // AI sağlayıcısı (boşsa "Anthropic (Claude)" yazar)
  barindirma: "Vercel",
  guncelleme: "3 Kasım 2026"  // Yasal metinlerin son güncelleme tarihi
};
