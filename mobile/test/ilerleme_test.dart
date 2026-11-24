import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/ilerleme.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter_test/flutter_test.dart';

import 'sahte_sunucu.dart';

IlerlemeKaydi kayit(int sonuc, {int zorluk = 2, String ders = 'mat', String konu = 'Sayılar', DateTime? zaman}) =>
    IlerlemeKaydi(ders: ders, konu: konu, zorluk: zorluk, sonuc: sonuc, zaman: zaman ?? DateTime(2026, 11, 24, 16));

Future<(AkeApi, SahteSunucu)> kur() async {
  final s = SahteSunucu();
  final api = AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: BellekDeposu(SahteSunucu.anahtar));
  await api.anahtariYukle();
  return (api, s);
}

void main() {
  group('ilerlemeUygula (web record() ile aynı biçim)', () {
    test('doğru: topic, daily, tr, td güncellenir', () {
      final s = ilerlemeUygula({}, kayit(1, zorluk: 3));
      expect(s['topic']['mat|Sayılar'], [1, 0, 0]);
      expect(s['daily']['2026-11-24'], {'q': 1, 'c': 1, 'tp': {'mat|Sayılar': 1}});
      expect(s['tr']['mat|Sayılar'], '1');
      expect(s['td']['mat|Sayılar'], [[0, 0], [0, 0], [1, 0]]);
    });

    test('yanlış: yanlış sayacı, günlük c artmaz, td yanlış kolonu', () {
      final s = ilerlemeUygula({}, kayit(0, zorluk: 1));
      expect(s['topic']['mat|Sayılar'], [0, 1, 0]);
      expect(s['daily']['2026-11-24']['c'], 0);
      expect(s['td']['mat|Sayılar'], [[0, 1], [0, 0], [0, 0]]);
    });

    test('boş: yalnızca topic[2] artar; daily/tr/td dokunulmaz', () {
      final s = ilerlemeUygula({}, kayit(-1));
      expect(s['topic']['mat|Sayılar'], [0, 0, 1]);
      expect(s.containsKey('daily'), isFalse);
      expect(s.containsKey('tr'), isFalse);
    });

    test('tr son 12 sonucu tutar; zorluk 0 ve 9 sınırlanır', () {
      var s = <String, dynamic>{};
      for (var i = 0; i < 15; i++) {
        s = ilerlemeUygula(s, kayit(i.isEven ? 1 : 0));
      }
      expect((s['tr']['mat|Sayılar'] as String).length, 12);
      s = ilerlemeUygula(s, kayit(1, zorluk: 9));
      s = ilerlemeUygula(s, kayit(1, zorluk: 0));
      expect((s['td']['mat|Sayılar'] as List).length, 3);
    });

    test('girdiyi değiştirmez; webin kendi alanlarını (ans, badges, para, _u) olduğu gibi korur', () {
      final girdi = <String, dynamic>{'_u': 5, 'ans': {'g-1': [1, 0, 0, 1, 1]}, 'badges': {'ilk': 1}, 'para': {'c': 2, 'w': 1, 'times': [3]}, 'topic': {'mat|Sayılar': [4, 1, 0]}};
      final s = ilerlemeUygula(girdi, kayit(1));
      expect(girdi['topic']['mat|Sayılar'], [4, 1, 0]);
      expect(s['topic']['mat|Sayılar'], [5, 1, 0]);
      expect(s['ans'], girdi['ans']);
      expect(s['badges'], {'ilk': 1});
      expect(s['para'], girdi['para']);
    });
  });

  group('IlerlemeSenkron', () {
    test('kayıt hesaba yazılır ve sunucudan okununca görünür (mevcut alanlar korunur)', () async {
      final (api, s) = await kur();
      s.stats = {'_u': 10, 'ans': {'x': [1]}, 'topic': {}};
      s.statsU = 10;
      final sy = IlerlemeSenkron(api, simdi: () => DateTime.fromMillisecondsSinceEpoch(50000));
      await sy.ekle(kayit(1));
      await sy.ekle(kayit(0));
      expect(sy.durum, SenkronDurumu.bos);
      expect(sy.bekleyenSayisi, 0);
      expect(s.stats!['ans'], {'x': [1]});
      final oku = await sy.hesaptanOku();
      expect(oku['mat|Sayılar']!.dogru, 1);
      expect(oku['mat|Sayılar']!.yanlis, 1);
      expect((s.stats!['_u'] as num).toInt(), greaterThan(10));
    });

    test('409 (eski): sunucudaki son hâl yeniden okunur ve üstüne uygulanır; kayıt kaybolmaz', () async {
      final (api, s) = await kur();
      s.zorla409 = 1;
      final sy = IlerlemeSenkron(api, simdi: () => DateTime.fromMillisecondsSinceEpoch(100));
      await sy.ekle(kayit(1));
      expect(sy.durum, SenkronDurumu.bos);
      expect((await sy.hesaptanOku())['mat|Sayılar']!.dogru, 1);
    });

    test('sunucu hatası: kayıt beklemede kalır, tekrar denenince yazılır', () async {
      final (api, s) = await kur();
      s.zorlaHata500 = 1;
      final sy = IlerlemeSenkron(api);
      await sy.ekle(kayit(1));
      expect(sy.durum, SenkronDurumu.bekliyor);
      expect(sy.bekleyenSayisi, 1);
      expect(sy.sonHata?.tur, HataTuru.sunucu);
      await sy.bosalt();
      expect(sy.durum, SenkronDurumu.bos);
      expect((await sy.hesaptanOku())['mat|Sayılar']!.dogru, 1);
    });

    test('ağ yokken kayıtlar birikir, ağ gelince tek yazmada işlenir', () async {
      final (api, s) = await kur();
      s.agYok = true;
      final sy = IlerlemeSenkron(api);
      await sy.ekle(kayit(1));
      await sy.ekle(kayit(1));
      expect(sy.bekleyenSayisi, 2);
      s.agYok = false;
      await sy.bosalt();
      expect(sy.bekleyenSayisi, 0);
      expect((await sy.hesaptanOku())['mat|Sayılar']!.dogru, 2);
    });
  });
}
