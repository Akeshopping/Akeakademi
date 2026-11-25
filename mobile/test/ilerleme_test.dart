import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/ilerleme.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter_test/flutter_test.dart';

import 'sahte_sunucu.dart';

Future<(AkeApi, SahteSunucu)> kur() async {
  final s = SahteSunucu();
  final api = AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: BellekDeposu());
  return (api, s);
}

/// Hesaba giriş (sunucuda `hesapId` hangi hesabı döndürüyorsa).
Future<void> giris(AkeApi api, SahteSunucu s, String hesap) async {
  s.hesapId = hesap;
  await api.kodDogrula('x@ornek.com', '12345678');
}

/// Bir soru oturumu açıp tek cevap verir; oturum kimliğini döner.
Future<String> cevapla(AkeApi api, String istek, {int secim = 2}) async {
  final o = await api.oturumOlustur(istek: istek, adet: 2, ders: 'mat', konu: 'Sayılar');
  await api.cevapVer(oturum: o.oturum, soru: 'q1', secim: secim);
  return o.oturum;
}

Future<KonuIlerlemesi?> hesapta(AkeApi api, String konu) async => konuIlerlemeleri((await api.veriOku())['stats'] as Map<String, dynamic>? ?? {})[konu];

void main() {
  test('konuIlerlemeleri hesap verisini okur; bozuk girdiyi yok sayar', () {
    final r = konuIlerlemeleri({'topic': {'mat|Sayılar': [3, 1, 2], 'x': 'bozuk'}});
    expect(r['mat|Sayılar']!.dogru, 3);
    expect(r['mat|Sayılar']!.cozulen, 4);
    expect(r['mat|Sayılar']!.toplam, 6);
    expect(r.containsKey('x'), isFalse);
  });

  group('IlerlemeSenkron', () {
    test('cevap hesaba işlenir; istemci hiçbir sayaç göndermez, stats\'a yazmaz', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u1');
      final o = await cevapla(api, 'i1');
      await sy.ekle(hesapId: 'u1', oturum: o);
      expect(sy.durum, SenkronDurumu.bos);
      expect((await hesapta(api, 'mat|Sayılar'))!.dogru, 1);
      expect(s.istekler.where((r) => r.url.path.startsWith('/api/hesap/veri/')), isEmpty);
      final govde = s.istekler.where((r) => r.url.path == '/api/soru/ilerleme').map((r) => r.body).join();
      expect(govde.contains('topic'), isFalse);
      expect(govde.contains('dogru'), isFalse);
    });

    test('aynı oturumu tekrar işlemek çift saymaz', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u1');
      final o = await cevapla(api, 'i1');
      await sy.ekle(hesapId: 'u1', oturum: o);
      await sy.ekle(hesapId: 'u1', oturum: o);
      await sy.supur();
      expect((await hesapta(api, 'mat|Sayılar'))!.dogru, 1);
    });

    test('bağlantı hatası: kayıt beklemede kalır; ağ gelince bir kez işlenir', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u1');
      final o = await cevapla(api, 'i1');
      s.agYok = true;
      await sy.ekle(hesapId: 'u1', oturum: o);
      expect(sy.durum, SenkronDurumu.bekliyor);
      expect(sy.bekleyenSayisi, 1);
      expect(sy.sonHata?.tur, HataTuru.ag);
      s.agYok = false;
      await sy.bosalt();
      await sy.bosalt();
      expect(sy.bekleyenSayisi, 0);
      expect((await hesapta(api, 'mat|Sayılar'))!.dogru, 1);
    });

    test('sunucu hatası (500): beklemede kalır, tekrar denenince işlenir', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u1');
      final o = await cevapla(api, 'i1');
      s.ilerlemeHata500 = 1;
      await sy.ekle(hesapId: 'u1', oturum: o);
      expect(sy.durum, SenkronDurumu.bekliyor);
      expect(sy.sonHata?.tur, HataTuru.sunucu);
      await sy.bosalt();
      expect(sy.durum, SenkronDurumu.bos);
      expect((await hesapta(api, 'mat|Sayılar'))!.dogru, 1);
    });

    test('HESAP DEĞİŞTİRME: u1\'in bekleyen kaydı, çıkış + u2 girişinden sonra u2\'ye ASLA yazılmaz', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u1');
      final o = await cevapla(api, 'i1');
      s.agYok = true;
      await sy.ekle(hesapId: 'u1', oturum: o);
      expect(sy.bekleyenSayisi, 1);
      s.agYok = false;
      await api.cikis();
      sy.temizle();
      await giris(api, s, 'u2');
      sy.hesapAyarla('u2');
      await sy.bosalt();
      await sy.supur();
      expect(sy.bekleyenSayisi, 0);
      expect(await hesapta(api, 'mat|Sayılar'), isNull); // u2'de hiçbir şey yok
      expect(s.ilerlemeCagrilari.where((c) => c.$1 == 'u2'), isEmpty);
      expect(s.ilerlemeler['u1'], isNull); // u1'inki de işlenmedi (cevap sunucuda; u1 girince süpürme toparlar)
    });

    test('OTURUM BİTTİ + BAŞKA HESAPLA GİRİŞ (çıkış çağrılmadan): önceki hesabın kaydı yeni hesaba yazılmaz', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u1');
      final o = await cevapla(api, 'i1');
      s.agYok = true;
      await sy.ekle(hesapId: 'u1', oturum: o);
      s.agYok = false;
      s.oturumGecerli = false;
      await sy.bosalt(); // 401 → oturum bitti
      expect(api.hesapId, isNull);
      expect(sy.bekleyenSayisi, 1); // kendi hesabıyla duruyor
      s.oturumGecerli = true;
      await giris(api, s, 'u2');
      sy.hesapAyarla('u2');
      expect(sy.bekleyenSayisi, 0); // u1'in kaydı silindi
      await sy.bosalt();
      expect(s.ilerlemeCagrilari.where((c) => c.$1 == 'u2'), isEmpty);
      expect(await hesapta(api, 'mat|Sayılar'), isNull);
    });

    test('OTURUM BİTTİ + AYNI HESAPLA GİRİŞ: kayıt korunur ve işlenir', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u1');
      final o = await cevapla(api, 'i1');
      s.agYok = true;
      await sy.ekle(hesapId: 'u1', oturum: o);
      s.agYok = false;
      s.oturumGecerli = false;
      await sy.bosalt();
      s.oturumGecerli = true;
      await giris(api, s, 'u1');
      sy.hesapAyarla('u1');
      await sy.bosalt();
      expect(sy.bekleyenSayisi, 0);
      expect((await hesapta(api, 'mat|Sayılar'))!.dogru, 1);
    });

    test('gönderim anında hesap farklıysa istek AĞA ÇIKMAZ (hesap_degisti)', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u2');
      final once = s.istekler.length;
      await expectLater(
        api.ilerlemeIsle(oturum: 'o${'1'.padLeft(47, '0')}', tzDk: 180, beklenenHesap: 'u1'),
        throwsA(isA<ApiHata>().having((h) => h.kod, 'kod', 'hesap_degisti')),
      );
      expect(s.istekler.length, once);
    });

    test('uygulama cevaptan sonra kapandıysa açılışta süpürme işlenmemiş cevabı toparlar', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      await cevapla(api, 'i1'); // senkron hiç çalışmadı (uygulama kapandı)
      final yeni = IlerlemeSenkron(api)..hesapAyarla('u1');
      await yeni.supur();
      expect((await hesapta(api, 'mat|Sayılar'))!.dogru, 1);
    });

    test('süpürme başka hesabın oturumunu işlemez', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      await cevapla(api, 'i1');
      await api.cikis();
      await giris(api, s, 'u2');
      final sy = IlerlemeSenkron(api)..hesapAyarla('u2');
      await sy.supur();
      expect(s.ilerlemeCagrilari.where((c) => c.$1 == 'u1'), isEmpty);
      expect(await hesapta(api, 'mat|Sayılar'), isNull);
    });
  });

  group('soru oturumu isteği (kota)', () {
    test('yanıt kaybolunca AYNI istek kimliğiyle tekrar: ikinci kota kullanımı olmaz, aynı oturum döner', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      s.yanitKaybi = 1;
      await expectLater(api.oturumOlustur(istek: 'm-aynideneme', adet: 2), throwsA(isA<ApiHata>().having((h) => h.tur, 'tur', HataTuru.ag)));
      final o = await api.oturumOlustur(istek: 'm-aynideneme', adet: 2);
      expect(s.kotaKullanilan, 1);
      expect(o.oturum, s.istekOturum['u1|m-aynideneme']);
    });

    test('FARKLI istek kimliği ikinci kota kullanır (hata, kimliğin korunması gerektiğini kanıtlar)', () async {
      final (api, s) = await kur();
      await giris(api, s, 'u1');
      s.yanitKaybi = 1;
      await expectLater(api.oturumOlustur(istek: 'm-a', adet: 2), throwsA(isA<ApiHata>()));
      await api.oturumOlustur(istek: 'm-b', adet: 2);
      expect(s.kotaKullanilan, 2);
    });
  });
}
