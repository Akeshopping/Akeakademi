import 'package:ake_akademi/veri/hesap_verisi.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // Belge biçimleri sitenin pack() çıktısıyla aynıdır: profile/plan alanı İÇ İÇE ({_u, profile:{…}}), stats ve exams alan düzeyinde.
  final alanlar = {
    'profile': {'_u': 5, 'profile': {'name': 'Ali', 'alan': 'SAY', 'gunluk': 50, 'examDate': '2027-06-19', 'ok': true}},
    'plan': {
      '_u': 5,
      'plan': {
        'tasks': [
          {'id': 't1', 'day': 1, 'text': 'Paragraf: 25 soru', 's': 'turkce', 'min': 30, 'done': true},
        ],
      },
    },
    'stats': {
      '_u': 5,
      'daily': {'2026-11-24': {'q': 40, 'c': 30}, '2026-11-25': {'q': 10, 'c': 5}},
      'topic': {'mat|Sayılar': [3, 1, 0]},
    },
    'exams': {
      '_u': 5,
      'exams': [
        {'id': 'w1', 'kind': 'exam', 'title': 'TYT', 'date': 10, 'd': 8, 'y': 2, 'b': 1, 'net': 7.5},
        {'id': 'x', 'kind': 'practice', 'net': 1},
        {'id': 'm:abc', 'kind': 'exam', 'src': 'mobil', 'title': 'Mobil deneme', 'date': 20, 'd': 1, 'y': 1, 'b': 2, 'net': 0.75},
      ],
    },
  };

  test('profil ve plan sitenin iç içe belgesinden okunur', () {
    final v = HesapVerisi.alanlardan(alanlar);
    expect(v.ad, 'Ali');
    expect(v.alan, 'SAY');
    expect(v.gunlukHedef, 50);
    expect(v.plan.single.metin, 'Paragraf: 25 soru');
    expect(v.plan.single.bitti, isTrue);
  });

  test('düz (eski biçim) belge profil/plan olarak SAYILMAZ: veri uydurulmaz', () {
    final v = HesapVerisi.alanlardan({'profile': {'name': 'Düz'}, 'plan': {'tasks': [{'text': 'x'}]}});
    expect(v.ad, '');
    expect(v.plan, isEmpty);
  });

  test('toplam soru ve doğru, site gibi günlük sayaçlardan; günlük yoksa konulardan', () {
    final v = HesapVerisi.alanlardan(alanlar);
    expect([v.toplamSoru, v.toplamDogru], [50, 35]);
    final k = HesapVerisi.alanlardan({'stats': {'topic': {'mat|Sayılar': [3, 1, 0]}}});
    expect([k.toplamSoru, k.toplamDogru], [4, 3]);
  });

  test('deneme geçmişi yalnız kind=exam kayıtlarını, web ve mobil birlikte verir', () {
    final v = HesapVerisi.alanlardan(alanlar);
    expect(v.denemeler.map((d) => d.id), ['w1', 'm:abc']);
    expect(v.denemeler.last.mobil, isTrue);
    expect(v.denemeler.first.net, 7.5);
  });
}
