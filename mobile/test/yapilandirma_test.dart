import 'package:ake_akademi/yapilandirma.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  String d(String a, {bool yayin = false, bool onay = false}) => Yapilandirma.dogrula(a, yayinDerlemesi: yayin, uretimOnay: onay);

  test('adres verilmezse hata (varsayılan Production yok)', () {
    expect(() => d(''), throwsA(isA<YapilandirmaHatasi>()));
    expect(() => d('   '), throwsA(isA<YapilandirmaHatasi>()));
  });

  test('test/debug derlemesi Production\'a bağlanamaz (www dahil), onay verilirse bağlanır', () {
    expect(() => d('https://akeakademi.com'), throwsA(isA<YapilandirmaHatasi>()));
    expect(() => d('https://www.akeakademi.com/'), throwsA(isA<YapilandirmaHatasi>()));
    expect(() => d('https://AKEAKADEMI.com'), throwsA(isA<YapilandirmaHatasi>()));
    expect(d('https://akeakademi.com', onay: true), 'https://akeakademi.com');
  });

  test('release derlemesi Production\'a bağlanabilir', () {
    expect(d('https://akeakademi.com/', yayin: true), 'https://akeakademi.com');
  });

  test('Preview adresi kabul edilir ve sondaki eğik çizgi atılır', () {
    expect(d('https://f349e35d.akeakademi.pages.dev/'), 'https://f349e35d.akeakademi.pages.dev');
  });

  test('https zorunlu; http yalnızca yerel ve release dışında', () {
    expect(() => d('http://f349e35d.akeakademi.pages.dev'), throwsA(isA<YapilandirmaHatasi>()));
    expect(d('http://10.0.2.2:8788'), 'http://10.0.2.2:8788');
    expect(() => d('http://10.0.2.2:8788', yayin: true), throwsA(isA<YapilandirmaHatasi>()));
  });

  test('yol/sorgu/# içeren ya da bozuk adres reddedilir', () {
    expect(() => d('https://x.pages.dev/api'), throwsA(isA<YapilandirmaHatasi>()));
    expect(() => d('https://x.pages.dev?a=1'), throwsA(isA<YapilandirmaHatasi>()));
    expect(() => d('x.pages.dev'), throwsA(isA<YapilandirmaHatasi>()));
  });
}
