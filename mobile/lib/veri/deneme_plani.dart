/// Bölümlü deneme planı. Oturum yapısı (bölümler, dersler, tam soru sayıları, süre) sitedeki `EXAMS` ile aynıdır (ÖSYM 2026 yapısı).
/// Sunucu sözleşmesi: POST /api/soru/oturum {mod: exam, adet, bolumler: [{bolum, ders, adet}], tur, uzunluk}.
enum DenemeUzunluk {
  tam('full', 'Tam'),
  yarim('half', 'Yarım'),
  mini('quarter', 'Mini (¼)'),
  ozel('custom', 'Kendi dağılımım');

  final String kod; // sunucudaki `uzunluk` değeri
  final String ad;
  const DenemeUzunluk(this.kod, this.ad);
}

class DenemeBolumu {
  final String ad;
  final List<(String ders, int tam)> dersler;
  const DenemeBolumu(this.ad, this.dersler);
}

class DenemeTuru {
  final String kod;
  final String ad;
  final String uzun;
  final int dakika; // resmî oturum süresi
  final List<DenemeBolumu> bolumler;
  const DenemeTuru(this.kod, this.ad, this.uzun, this.dakika, this.bolumler);

  int get tamSoru => bolumler.fold(0, (a, b) => a + b.dersler.fold(0, (c, d) => c + d.$2));
}

/// Bir bölümün bir dersi: tam soru sayısı, seçilen soru sayısı.
class DenemeSatiri {
  final String bolum;
  final String ders;
  final int tam;
  final int n;
  const DenemeSatiri(this.bolum, this.ders, this.tam, this.n);
  String get anahtar => '$bolum:$ders';
}

class DenemeKatalogu {
  static const List<DenemeTuru> turler = [
    DenemeTuru('TYT', 'TYT', 'Temel Yeterlilik Testi', 165, [
      DenemeBolumu('Türkçe', [('turkce', 40)]),
      DenemeBolumu('Sosyal Bilimler', [('tarih', 5), ('cografya', 5), ('felsefe', 5), ('din', 5)]),
      DenemeBolumu('Temel Matematik', [('mat', 30), ('geo', 10)]),
      DenemeBolumu('Fen Bilimleri', [('fizik', 7), ('kimya', 7), ('biyoloji', 6)]),
    ]),
    DenemeTuru('SAY', 'AYT Sayısal', 'Matematik ve Fen Bilimleri', 180, [
      DenemeBolumu('Matematik', [('amat', 30), ('geo', 10)]),
      DenemeBolumu('Fizik', [('afizik', 14)]),
      DenemeBolumu('Kimya', [('akimya', 13)]),
      DenemeBolumu('Biyoloji', [('abiyoloji', 13)]),
    ]),
    DenemeTuru('EA', 'AYT Eşit Ağırlık', 'Matematik ve Türk Dili-Sosyal 1', 180, [
      DenemeBolumu('Matematik', [('amat', 30), ('geo', 10)]),
      DenemeBolumu('Edebiyat', [('edebiyat', 24)]),
      DenemeBolumu('Tarih-1', [('tarih2', 10)]),
      DenemeBolumu('Coğrafya-1', [('cografya2', 6)]),
    ]),
    DenemeTuru('SOZ', 'AYT Sözel', 'Türk Dili-Sosyal 1 ve Sosyal 2', 180, [
      DenemeBolumu('Edebiyat', [('edebiyat', 24)]),
      DenemeBolumu('Tarih', [('tarih2', 21)]),
      DenemeBolumu('Coğrafya', [('cografya2', 17)]),
      DenemeBolumu('Felsefe Grubu', [('psikoloji', 3), ('sosyoloji', 3), ('mantik', 3), ('felsefe', 3)]),
      DenemeBolumu('Din Kültürü', [('din', 6)]),
    ]),
    DenemeTuru('YDT', 'YDT İngilizce', 'Yabancı Dil Testi', 120, [
      DenemeBolumu('İngilizce', [('ingilizce', 80)]),
    ]),
  ];

  static DenemeTuru tur(String kod) => turler.firstWhere((t) => t.kod == kod, orElse: () => turler.first);

  /// Sitedeki `defaultExam()`: profildeki alana göre.
  static String varsayilanTur(String alan) => const {'SAY': 'SAY', 'EA': 'EA', 'SOZ': 'SOZ', 'DIL': 'YDT'}[alan] ?? 'TYT';

  /// Sitedeki `examRows()`: tam/yarım/mini için her dersin soru sayısı `max(1, round(tam × oran))`; özelde kullanıcı değeri
  /// (varsayılan ¼). [ozel] anahtarı `bolum:ders`.
  static List<DenemeSatiri> satirlar(DenemeTuru t, DenemeUzunluk u, Map<String, int> ozel) {
    final oran = switch (u) { DenemeUzunluk.tam => 1.0, DenemeUzunluk.yarim => 0.5, DenemeUzunluk.mini => 0.25, DenemeUzunluk.ozel => 0.25 };
    final r = <DenemeSatiri>[];
    for (final b in t.bolumler) {
      for (final (ders, tam) in b.dersler) {
        final varsayilan = (tam * oran).round().clamp(1, tam).toInt();
        final n = u == DenemeUzunluk.ozel ? (ozel['${b.ad}:$ders'] ?? varsayilan).clamp(0, tam).toInt() : varsayilan;
        r.add(DenemeSatiri(b.ad, ders, tam, n));
      }
    }
    return r;
  }

  /// Sitedeki otomatik süre: `max(5, round(resmî dk × seçilen / tam))`.
  static int otomatikSure(DenemeTuru t, int toplam) => t.tamSoru == 0 ? 5 : (t.dakika * toplam / t.tamSoru).round().clamp(5, 100000).toInt();
}

/// Başlatılan denemenin ekranlar arası taşınan planı.
class DenemePlani {
  final String? tur; // null = serbest (tek ders / karışık)
  final DenemeUzunluk uzunluk;
  final List<DenemeSatiri> satirlar; // yalnız n > 0 olanlar
  final String? ders; // serbest modda
  final int adet;
  final int sureDk; // 0 = süresiz
  const DenemePlani({this.tur, this.uzunluk = DenemeUzunluk.tam, this.satirlar = const [], this.ders, required this.adet, required this.sureDk});

  bool get bolumlu => tur != null && satirlar.isNotEmpty;

  /// Sunucuya giden bölüm listesi.
  List<Map<String, dynamic>> bolumlerJson() => [for (final s in satirlar) {'bolum': s.bolum, 'ders': s.ders, 'adet': s.n}];

  /// ders → bölüm adı (sonuç tablosu için).
  Map<String, String> get dersBolum => {for (final s in satirlar) s.ders: s.bolum};

  /// Bölüm adları, sıra korunarak.
  List<String> get bolumAdlari => [for (final s in satirlar) s.bolum].toSet().toList();
}
