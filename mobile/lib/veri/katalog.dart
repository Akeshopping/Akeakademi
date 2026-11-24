/// Sınav → ders eşlemesi. Ders anahtarları sunucunun soru bankasıyla (DERSLER) ve web sitesiyle aynıdır.
/// Konular elle yazılmaz: sunucunun /api/soru/ozet yanıtından gelir (böylece soru olmayan konu listelenmez).
class Ders {
  final String anahtar;
  final String ad;
  const Ders(this.anahtar, this.ad);
}

class Sinav {
  final String anahtar;
  final String ad;
  final String aciklama;
  final List<String> dersler;
  const Sinav(this.anahtar, this.ad, this.aciklama, this.dersler);
}

class Katalog {
  static const Map<String, Ders> dersler = {
    'turkce': Ders('turkce', 'Türkçe'),
    'tarih': Ders('tarih', 'Tarih'),
    'cografya': Ders('cografya', 'Coğrafya'),
    'felsefe': Ders('felsefe', 'Felsefe'),
    'din': Ders('din', 'Din Kültürü'),
    'mat': Ders('mat', 'Matematik'),
    'geo': Ders('geo', 'Geometri'),
    'fizik': Ders('fizik', 'Fizik'),
    'kimya': Ders('kimya', 'Kimya'),
    'biyoloji': Ders('biyoloji', 'Biyoloji'),
    'amat': Ders('amat', 'AYT Matematik'),
    'afizik': Ders('afizik', 'AYT Fizik'),
    'akimya': Ders('akimya', 'AYT Kimya'),
    'abiyoloji': Ders('abiyoloji', 'AYT Biyoloji'),
    'edebiyat': Ders('edebiyat', 'Edebiyat'),
    'tarih2': Ders('tarih2', 'AYT Tarih'),
    'cografya2': Ders('cografya2', 'AYT Coğrafya'),
    'psikoloji': Ders('psikoloji', 'Psikoloji'),
    'sosyoloji': Ders('sosyoloji', 'Sosyoloji'),
    'mantik': Ders('mantik', 'Mantık'),
    'ingilizce': Ders('ingilizce', 'İngilizce'),
  };

  static const List<Sinav> sinavlar = [
    Sinav('TYT', 'TYT', 'Temel Yeterlilik Testi',
        ['turkce', 'tarih', 'cografya', 'felsefe', 'din', 'mat', 'geo', 'fizik', 'kimya', 'biyoloji']),
    Sinav('SAY', 'AYT Sayısal', 'Matematik ve Fen Bilimleri', ['amat', 'geo', 'afizik', 'akimya', 'abiyoloji']),
    Sinav('EA', 'AYT Eşit Ağırlık', 'Matematik ve Türk Dili-Sosyal 1', ['amat', 'geo', 'edebiyat', 'tarih2', 'cografya2']),
    Sinav('SOZ', 'AYT Sözel', 'Türk Dili-Sosyal 1 ve Sosyal 2',
        ['edebiyat', 'tarih2', 'cografya2', 'psikoloji', 'sosyoloji', 'mantik', 'felsefe', 'din']),
    Sinav('YDT', 'YDT İngilizce', 'Yabancı Dil Testi', ['ingilizce']),
  ];

  static String dersAdi(String anahtar) => dersler[anahtar]?.ad ?? anahtar;
}
