"""AKE Akademi · 2027 YKS konu kataloğu (Alfa'nın gönderdiği liste, yazım hataları düzeltilmiş).

Her ders için konular ve üretim yöntemi:
  kod    : hesaplı konu. Soru parametreli üretilir, cevap kodla hesaplanır, bağımsız kodla doğrulanır.
  kismi  : yarısı hesaplı, yarısı kavramsal. Hesaplı kısım koddan, kavramsal kısım yazılarak üretilir.
  sozel  : kodla doğrulanamaz. Soruları model yazar, doğruluğu öğretmen kontrol eder.
Bu sınıflama benim değerlendirmem; konu konu birlikte değiştirebiliriz.
"""

KATALOG = {
    "tyt_turkce": ("sozel", [
        "Sözcükte Anlam", "Söz Yorumu", "Deyim ve Atasözü", "Cümlede Anlam", "Paragraf",
        "Paragrafta Anlatım Teknikleri", "Paragrafta Düşünceyi Geliştirme Yolları", "Paragrafta Yapı",
        "Paragrafta Konu-Ana Düşünce", "Paragrafta Yardımcı Düşünce", "Ses Bilgisi", "Yazım Kuralları",
        "Noktalama İşaretleri", "Sözcükte Yapı/Ekler", "Sözcük Türleri", "İsimler", "Zamirler", "Sıfatlar",
        "Zarflar", "Edat – Bağlaç – Ünlem", "Fiiller", "Fiilde Anlam (Kip-Kişi-Yapı)", "Ek Fiil", "Fiilimsi",
        "Fiilde Çatı", "Sözcük Grupları", "Cümlenin Ögeleri", "Cümle Türleri", "Anlatım Bozukluğu"]),
    "tyt_matematik": ("kod", [
        "Temel Kavramlar", "Sayı Basamakları", "Bölme ve Bölünebilme", "EBOB – EKOK", "Rasyonel Sayılar",
        "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma", "Oran Orantı",
        "Denklem Çözme", "Problemler", "Sayı Problemleri", "Kesir Problemleri", "Yaş Problemleri",
        "Hareket Hız Problemleri", "İşçi Emek Problemleri", "Yüzde Problemleri", "Kar Zarar Problemleri",
        "Karışım Problemleri", "Kümeler – Kartezyen Çarpım", "Fonksiyonlar", "Polinomlar",
        "2.Dereceden Denklemler", "Permütasyon ve Kombinasyon", "Olasılık"]),
    "tyt_matematik_kismi": ("kismi", ["Grafik Problemleri", "Rutin Olmayan Problemler", "Mantık", "Veri – İstatistik"]),
    "tyt_geometri": ("kod", [
        "Temel Kavramlar", "Doğruda Açılar", "Üçgende Açılar", "Özel Üçgenler", "Dik Üçgen", "İkizkenar Üçgen",
        "Eşkenar Üçgen", "Açıortay", "Kenarortay", "Eşlik ve Benzerlik", "Üçgende Alan", "Üçgende Benzerlik",
        "Açı Kenar Bağıntıları", "Çokgenler", "Özel Dörtgenler", "Dörtgenler", "Deltoid", "Paralelkenar",
        "Eşkenar Dörtgen", "Dikdörtgen", "Kare", "Yamuk", "Çember ve Daire", "Çemberde Açı", "Çemberde Uzunluk",
        "Dairede Çevre ve Alan", "Noktanın Analitiği", "Doğrunun Analitiği", "Dönüşüm Geometrisi",
        "Prizmalar", "Küp", "Silindir", "Piramit", "Koni", "Küre", "Çemberin Analitiği"]),
    "tyt_fizik": ("kod", [
        "Sıvıların Kaldırma Kuvveti", "Basınç", "Isı, Sıcaklık ve Genleşme", "Hareket ve Kuvvet", "Dinamik",
        "İş, Güç ve Enerji", "Elektrik", "Optik"]),
    "tyt_fizik_kismi": ("kismi", ["Fizik Bilimine Giriş", "Madde ve Özellikleri", "Manyetizma", "Dalgalar"]),
    "tyt_kimya": ("kod", [
        "Kimyanın Temel Kanunları ve Kimyasal Hesaplamalar", "Karışımlar", "Gazlar", "Asitler, Bazlar ve Tuzlar",
        "Kimyasal Tepkimelerde Enerji", "Kimyasal Tepkimelerde Hız", "Kimyasal Tepkimelerde Denge",
        "Sıvı Çözeltiler ve Çözünürlük", "Kimya ve Elektrik"]),
    "tyt_kimya_kismi": ("kismi", [
        "Atom ve Periyodik Sistem", "Kimyasal Türler Arası Etkileşimler", "Maddenin Hâlleri", "Modern Atom Teorisi",
        "Karbon Kimyasına Giriş", "Organik Bileşikler"]),
    "tyt_kimya_sozel": ("sozel", ["Kimya Bilimi", "Doğa ve Kimya", "Kimya Her Yerde", "Enerji Kaynakları ve Bilimsel Gelişmeler"]),
    "tyt_biyoloji": ("sozel", [
        "Canlıların Ortak Özellikleri", "Canlıların Temel Bileşenleri", "Hücre ve Organeller – Madde Geçişleri",
        "Canlıların Sınıflandırılması", "Hücrede Bölünme – Üreme", "Kalıtım", "Bitki Biyolojisi", "Ekosistem"]),
    "tyt_tarih": ("sozel", [
        "Tarih ve Zaman", "İnsanlığın İlk Dönemleri", "Ortaçağ'da Dünya", "İlk ve Orta Çağlarda Türk Dünyası",
        "İslam Medeniyetinin Doğuşu", "İlk Türk İslam Devletleri", "Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi",
        "Beylikten Devlete Osmanlı Siyaseti (1300-1453)", "Dünya Gücü Osmanlı Devleti (1453-1600)", "Yeni Çağ Avrupa Tarihi",
        "Yakın Çağ Avrupa Tarihi", "Osmanlı Devletinde Arayış Yılları", "18. Yüzyılda Değişim ve Diplomasi", "En Uzun Yüzyıl",
        "Osmanlı Kültür ve Medeniyeti", "20. Yüzyılda Osmanlı Devleti", "I. Dünya Savaşı",
        "Mondros Ateşkesi, İşgaller ve Cemiyetler", "Kurtuluş Savaşına Hazırlık Dönemi", "I. TBMM Dönemi",
        "Kurtuluş Savaşı ve Antlaşmalar", "II. TBMM Dönemi ve Çok Partili Hayata Geçiş", "Türk İnkılabı",
        "Atatürk İlkeleri", "Atatürk Dönemi Türk Dış Politikası"]),
    "tyt_cografya": ("sozel", [
        "Doğa ve İnsan", "Dünya'nın Şekli ve Hareketleri", "Coğrafi Konum", "Harita Bilgisi", "Atmosfer ve Sıcaklık",
        "İklimler", "Basınç ve Rüzgârlar", "Nem, Yağış ve Buharlaşma", "İç Kuvvetler / Dış Kuvvetler",
        "Su – Toprak ve Bitkiler", "Nüfus", "Göç", "Yerleşme", "Türkiye'nin Yer Şekilleri", "Ekonomik Faaliyetler",
        "Bölgeler", "Uluslararası Ulaşım Hatları", "Çevre ve Toplum", "Doğal Afetler"]),
    "tyt_felsefe": ("sozel", [
        "Felsefenin Konusu", "Bilgi Felsefesi", "Varlık Felsefesi", "Ahlak Felsefesi", "Sanat Felsefesi",
        "Din Felsefesi", "Siyaset Felsefesi", "Bilim Felsefesi"]),
    "tyt_din": ("sozel", [
        "İnanç", "İbadet", "Ahlak ve Değerler", "Din, Kültür ve Medeniyet", "Hz. Muhammed (S.A.V.)", "Vahiy ve Akıl",
        "Dünya ve Ahiret", "Kur'an'a göre Hz. Muhammed (S.A.V.)", "İnançla İlgili Meseleler", "Yahudilik ve Hristiyanlık",
        "İslam ve Bilim", "Anadolu'da İslam", "İslam Düşüncesinde Tasavvufi Yorumlar", "Güncel Dini Meseleler",
        "Hint ve Çin Dinleri"]),
    "ayt_edebiyat": ("sozel", [
        "Anlam Bilgisi", "Dil Bilgisi", "Güzel Sanatlar ve Edebiyat", "Metinlerin Sınıflandırılması", "Şiir Bilgisi",
        "Edebi Sanatlar", "Türk Edebiyatı Dönemleri", "İslamiyet Öncesi Türk Edebiyatı ve Geçiş Dönemi", "Halk Edebiyatı",
        "Divan Edebiyatı", "Tanzimat Edebiyatı", "Servet-i Fünun Edebiyatı", "Fecr-i Ati Edebiyatı", "Milli Edebiyat",
        "Cumhuriyet Dönemi Edebiyatı", "Edebiyat Akımları", "Dünya Edebiyatı"]),
    "ayt_matematik": ("kod", [
        "Binom ve Olasılık", "İstatistik", "Karmaşık Sayılar", "2.Dereceden Eşitsizlikler", "Parabol", "Trigonometri",
        "Logaritma", "Diziler", "Limit", "Türev", "İntegral"]),
    "ayt_fizik": ("kod", [
        "Vektörler", "Kuvvet, Tork ve Denge", "Kütle Merkezi", "Basit Makineler", "Hareket", "Newton'un Hareket Yasaları",
        "İş, Güç ve Enerji II", "Atışlar", "İtme ve Momentum", "Elektrik Alan ve Potansiyel", "Paralel Levhalar ve Sığa",
        "Manyetik Alan ve Manyetik Kuvvet", "İndüksiyon, Alternatif Akım ve Transformatörler", "Çembersel Hareket",
        "Dönme, Yuvarlanma ve Açısal Momentum", "Kütle Çekim ve Kepler Yasaları", "Basit Harmonik Hareket"]),
    "ayt_fizik_kismi": ("kismi", [
        "Dalga Mekaniği ve Elektromanyetik Dalgalar", "Atom Modelleri", "Büyük Patlama ve Parçacık Fiziği", "Radyoaktivite",
        "Özel Görelilik", "Kara Cisim Işıması", "Fotoelektrik Olay ve Compton Olayı",
        "Modern Fiziğin Teknolojideki Uygulamaları"]),
    "ayt_kimya": ("kod", ["Asit-Baz Dengesi", "Çözünürlük Dengesi", "Organik Kimyaya Giriş", "Organik Kimya"]),
    "ayt_biyoloji": ("sozel", [
        "Sinir Sistemi", "Endokrin Sistem ve Hormonlar", "Duyu Organları", "Destek ve Hareket Sistemi", "Sindirim Sistemi",
        "Dolaşım ve Bağışıklık Sistemi", "Solunum Sistemi", "Üriner Sistem (Boşaltım Sistemi)",
        "Üreme Sistemi ve Embriyonik Gelişim", "Komünite Ekolojisi", "Popülasyon Ekolojisi", "Genden Proteine",
        "Nükleik Asitler", "Genetik Şifre ve Protein Sentezi", "Canlılarda Enerji Dönüşümleri", "Canlılık ve Enerji",
        "Fotosentez", "Kemosentez", "Hücresel Solunum", "Bitki Biyolojisi", "Canlılar ve Çevre"]),
    "ayt_tarih": ("sozel", [
        "Türklerin İslamiyet'i Kabulü ve İlk Türk İslam Devletleri", "Devletleşme Sürecinde Savaşçılar ve Askerler",
        "Beylikten Devlete Osmanlı Medeniyeti", "Sultan ve Osmanlı Merkez Teşkilatı", "Klasik Çağda Osmanlı Toplum Düzeni",
        "Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti", "Değişim Çağında Avrupa ve Osmanlı",
        "Uluslararası İlişkilerde Denge Stratejisi (1774-1914)", "Devrimler Çağında Değişen Devlet-Toplum İlişkileri",
        "Sermaye ve Emek", "XIX. ve XX. Yüzyılda Değişen Gündelik Hayat", "XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya"]),
    "ayt_cografya": ("sozel", [
        "Biyoçeşitlilik", "Biyomlar", "Ekosistemin Unsurları", "Enerji Akışı ve Madde Döngüsü", "Ekstrem Doğa Olayları",
        "Küresel İklim Değişimi", "Nüfus Politikaları", "Türkiye'de Nüfus ve Yerleşme", "Ekonomik Faaliyetler ve Doğal Kaynaklar",
        "Göç ve Şehirleşme", "Türkiye'nin Ekonomi Politikaları", "Türkiye Ekonomisinin Sektörel Dağılımı", "Türkiye'de Tarım",
        "Türkiye'de Hayvancılık", "Türkiye'de Madenler ve Enerji Kaynakları", "Türkiye'de Sanayi", "Türkiye'de Ulaşım",
        "Türkiye'de Ticaret ve Turizm", "Geçmişten Geleceğe Şehir ve Ekonomi", "Türkiye'nin İşlevsel Bölgeleri ve Kalkınma Projeleri",
        "Hizmet Sektörünün Ekonomideki Yeri", "Küresel Ticaret", "İlk Uygarlıklar", "Kültür Bölgeleri ve Türk Kültürü",
        "Sanayileşme Süreci: Almanya", "Tarım ve Ekonomi İlişkisi: Fransa – Somali", "Ülkeler Arası Etkileşim", "Jeopolitik Konum",
        "Çatışma Bölgeleri", "Küresel ve Bölgesel Örgütler", "Çevre Sorunları ve Türleri",
        "Madenler ve Enerji Kaynaklarının Çevreye Etkisi", "Doğal Kaynakların Sürdürülebilir Kullanımı", "Ekolojik Ayak İzi",
        "Doğal Çevrenin Sınırlılığı", "Çevre Politikaları", "Çevresel Örgütler", "Çevre Anlaşmaları"]),
    "ayt_felsefe_grubu": ("sozel", [
        "İlk Çağ Felsefesi", "MÖ 6. Yüzyıl – MS 2. Yüzyıl Felsefesi", "MS 2. Yüzyıl – MS 15. Yüzyıl Felsefesi",
        "15. Yüzyıl – 17. Yüzyıl Felsefesi", "18. Yüzyıl – 19. Yüzyıl Felsefesi", "20. Yüzyıl Felsefesi",
        "Mantığa Giriş", "Klasik Mantık", "Mantık ve Dil", "Sembolik Mantık",
        "Psikoloji Bilimini Tanıyalım", "Psikolojinin Temel Süreçleri", "Öğrenme, Bellek, Düşünme", "Ruh Sağlığının Temelleri",
        "Sosyolojiye Giriş", "Birey ve Toplum", "Toplumsal Yapı", "Toplumsal Değişme ve Gelişme", "Toplum ve Kültür", "Toplumsal Kurumlar"]),
}

HEDEF_KONU_BASINA = 10_000  # Alfa'nın istediği: her konudan 10 bin soru

if __name__ == "__main__":
    toplam = {"kod": 0, "kismi": 0, "sozel": 0}
    for ders, (yontem, konular) in KATALOG.items():
        toplam[yontem] += len(konular)
    n = sum(toplam.values())
    print("Konu sayısı:", n, "|", ", ".join(f"{k}: {v}" for k, v in toplam.items()))
    print(f"Her konu 10 bin = {n * HEDEF_KONU_BASINA:,} soru".replace(",", "."))
    for k, v in toplam.items():
        print(f"  {k}: {v} konu → {v * HEDEF_KONU_BASINA:,} soru".replace(",", "."))
