// Emülatörde GERÇEK uygulamanın ekran yürüyüşü. Sunucu, test/sahte_sunucu.dart içindeki bellek içi sahte sunucudur:
// ekrandaki ders, soru ve istatistikler TEST VERİSİDİR (gerçek hesap/Production değil). Gerçek Preview girişi bu testte yoktur.
// Çalıştırma: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/ekranlar_test.dart -d <emülatör> --dart-define=GENISLIK=390
import 'package:ake_akademi/durum/uygulama.dart';
import 'package:ake_akademi/ui/kok.dart';
import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/ilerleme.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import '../test/sahte_sunucu.dart';

const _beklenenGenislik = int.fromEnvironment('GENISLIK', defaultValue: 0);

String _gun(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Map<String, dynamic> _veri() {
  final bugun = DateTime.now();
  final gunluk = <String, dynamic>{};
  const soru = [32, 45, 0, 28, 51, 38, 24];
  const dogru = [21, 33, 0, 19, 40, 27, 15];
  for (var i = 0; i < 7; i++) {
    final g = bugun.subtract(Duration(days: 6 - i));
    if (soru[i] > 0) gunluk[_gun(g)] = {'q': soru[i], 'c': dogru[i]};
  }
  return {
    'profile': {'name': 'Test Öğrencisi', 'alan': 'say', 'gunluk': 40, 'examDate': '2027-06-19'},
    'stats': {
      'daily': gunluk,
      'topic': {
        'mat|Sayılar': [34, 12, 2],
        'mat|Problemler': [18, 14, 0],
        'turkce|Paragraf': [41, 9, 1],
        'fizik|Hareket': [7, 11, 0],
      },
    },
    'plan': {
      'tasks': [
        {'text': 'Problemler: 30 soru', 'day': 0, 's': 'mat', 'min': 45, 'done': true},
        {'text': 'Paragraf: 25 soru', 'day': 1, 's': 'turkce', 'min': 30, 'done': true},
        {'text': 'Hareket konu tekrarı', 'day': 2, 's': 'fizik', 'min': 40, 'done': false},
        {'text': 'Sayılar: yanlışları çöz', 'day': 3, 's': 'mat', 'min': 35, 'done': false},
        {'text': 'Deneme sonrası analiz', 'day': 5, 's': 'mat', 'min': 60, 'done': false},
      ],
    },
  };
}

void _sunucuHazirla(SahteSunucu s, {required bool uzunAciklama}) {
  s.veriAlanlari = _veri();
  s.ozetOzel = {
    'toplam': 90,
    'dersler': {
      'mat': {'toplam': 40, 'konular': {'Sayılar': {'toplam': 25, 'zorluk': {'1': 8, '2': 10, '3': 7}}, 'Problemler': {'toplam': 15, 'zorluk': {'2': 9, '3': 6}}}},
      'turkce': {'toplam': 30, 'konular': {'Paragraf': {'toplam': 30, 'zorluk': {'1': 6, '2': 14, '3': 10}}}},
      'fizik': {'toplam': 20, 'konular': {'Hareket': {'toplam': 20, 'zorluk': {'2': 12, '3': 8}}}},
    },
  };
  s.sorular
    ..clear()
    ..addAll([
      {
        'id': 'q1', 's': 'turkce', 't': 'Paragraf', 'd': 2,
        'p': 'Bir metnin anlamı yalnızca sözcüklerde değil, sözcüklerin birbiriyle kurduğu ilişkide ortaya çıkar. Okur, bu ilişkiyi kurarken kendi yaşantısından da yararlanır; bu yüzden aynı paragraf farklı okurlarda farklı izler bırakabilir.',
        'q': 'Bu parçadan çıkarılabilecek en kesin yargı aşağıdakilerden hangisidir?',
        'o': [
          'Anlam, okurun katkısıyla tamamlanan bir süreçtir.',
          'Sözcükler tek başına yeterli bir anlam taşır.',
          'Her okur metni aynı biçimde yorumlar.',
          'Paragraflar yaşantıdan bağımsız yazılmalıdır.',
          'Anlam yalnızca yazarın niyetine bağlıdır.',
        ],
      },
      {
        'id': 'q2', 's': 'mat', 't': 'Sayılar', 'd': 2,
        'q': 'x ve y pozitif tam sayılardır. x + y = 12 ve x · y = 35 ise |x − y| kaçtır?',
        'o': ['|x − y| = 1', '|x − y| = 2', '|x − y| = 3', '|x − y| = 4', '|x − y| = 5'],
      },
    ]);
  s.dogruSecenek
    ..clear()
    ..addAll({'q1': 0, 'q2': 1});
  s.aciklama = uzunAciklama
      ? 'Parçada anlamın yalnızca sözcüklerde değil, sözcükler arasındaki ilişkide ve okurun yaşantısında oluştuğu söyleniyor. Bu nedenle doğru yargı, anlamı okurun katkısıyla tamamlanan bir süreç olarak gören seçenektir. '
          'Diğer seçenekler parçadaki düşünceyle çelişir: sözcüklerin tek başına yeterli olduğunu, herkesin aynı yorumu yaptığını ya da yalnızca yazarın niyetinin belirleyici olduğunu savunmak, parçanın ana düşüncesine ters düşer. '
          'Ayrıca paragrafların yaşantıdan bağımsız yazılması gerektiği düşüncesi parçada hiç geçmez. Bu tür sorularda önce ana düşünceyi tek cümleyle yaz, sonra her seçeneği bu cümleyle karşılaştır; çelişen seçenekleri eleyince doğru cevap kendiliğinden kalır.'
      : 'x + y = 12 ve x · y = 35 olduğundan sayılar 5 ve 7’dir. |x − y| = 2 bulunur.';
}

UygulamaModeli _model(SahteSunucu s) {
  final api = AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: BellekDeposu());
  return UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': '1'})); // açılış animasyonunun kendi gerçek zamanlı kaydı var
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('ekran yürüyüşü: giriş → ana → Soru çöz → soru → Gelişim → Plan → Ayarlar (açık ve koyu)', (t) async {
    await binding.convertFlutterSurfaceToImage();
    final boyut = t.view.physicalSize / t.view.devicePixelRatio;
    // ignore: avoid_print
    print('CIHAZ_MANTIKSAL_GENISLIK=${boyut.width.toStringAsFixed(1)} yukseklik=${boyut.height.toStringAsFixed(1)} dpr=${t.view.devicePixelRatio}');
    if (_beklenenGenislik > 0) expect(boyut.width, closeTo(_beklenenGenislik.toDouble(), 1.0), reason: 'emülatör beklenen mantıksal genişlikte değil');
    final g = '${boyut.width.round()}';

    final s = SahteSunucu();
    _sunucuHazirla(s, uzunAciklama: true);
    final m = _model(s);
    await m.baslat();
    await t.pumpWidget(AkeUygulamasi(model: m));
    await t.pumpAndSettle();

    Future<void> ek(String ad) async {
      await t.pumpAndSettle();
      expect(t.takeException(), isNull, reason: 'ekranda taşma/çizim hatası: $ad');
      await binding.takeScreenshot('$g-$ad');
    }

    Future<void> dokun(String metin) async {
      final f = find.text(metin);
      expect(f, findsWidgets, reason: '"$metin" ekranda yok');
      await t.ensureVisible(f.first);
      await t.pumpAndSettle();
      await t.tap(f.first);
      await t.pumpAndSettle();
    }

    Future<void> sekme(int i) async {
      await t.tap(find.byKey(ValueKey('sekme-$i')));
      await t.pumpAndSettle();
    }

    // giriş (açık tema; sistem teması açık)
    await ek('01-giris-acik');
    await dokun('Ücretsiz başla');
    await ek('02-giris-eposta-acik');
    await t.enterText(find.byType(TextField), 'ogrenci@ornek.com');
    await dokun('Giriş kodu gönder');
    await t.enterText(find.byType(TextField), '12345678');
    await dokun('Giriş yap');

    Future<void> yuru(String tema) async {
      await sekme(0);
      await ek('10-ana-$tema');
      await sekme(1);
      await ek('20-soru-sec-sinav-$tema');
      await dokun('TYT');
      await ek('21-soru-sec-ders-$tema');
      await dokun('Türkçe');
      await ek('22-soru-sec-konu-$tema');
      await dokun('Paragraf');
      await ek('30-soru-okuma-$tema');
      await dokun('Sözcükler tek başına yeterli bir anlam taşır.'); // B: yanlış şık (doğru: A)
      await ek('31-soru-secili-$tema');
      await dokun('Cevapla');
      await ek('32-soru-yanlis-aciklama-$tema');
      await dokun('Sonraki soru');
      await ek('33-soru-2-$tema');
      await dokun('|x − y| = 2'); // doğru şık
      await dokun('Cevapla');
      await ek('34-soru-dogru-$tema');
      await dokun('Bitir');
      await ek('40-sonuc-$tema');
      await dokun('Ana sayfaya dön');
      await sekme(2);
      await ek('50-gelisim-$tema');
      await sekme(3);
      await ek('60-plan-$tema');
      await sekme(4);
      await ek('70-ayarlar-$tema');
    }

    await yuru('acik');
    await dokun('Koyu');
    expect(m.tema, ThemeMode.dark);
    // sorular yeni oturumda yeniden gelsin
    await yuru('koyu');
    expect(t.takeException(), isNull);
  });
}
