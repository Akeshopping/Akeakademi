// Mağaza satın alma akışı · SAHTE köprü + SAHTE sunucu. Bu testler uygulama mantığını kanıtlar; GERÇEK Google Play / App Store sandbox işlemi DEĞİLDİR.
// İlke: erişim yalnız sunucu mağaza işlemini doğrulayınca açılır; sunucu kabul etmeden işlem mağazaya tamamlanmaz.
import 'package:ake_akademi/durum/uygulama.dart';
import 'package:ake_akademi/odeme/magaza_koprusu.dart';
import 'package:ake_akademi/odeme/odeme.dart';
import 'package:ake_akademi/ui/kok.dart';
import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/ilerleme.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'sahte_magaza.dart';
import 'sahte_sunucu.dart';

AkeApi _api(SahteSunucu s) => AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: BellekDeposu(SahteSunucu.anahtar));

Future<void> _bosalt() async {
  for (var i = 0; i < 40; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

Future<(OdemeModeli, SahteSunucu, SahteMagaza)> _kur({bool magazaAcik = true, String sunucuModu = 'sandbox'}) async {
  final s = SahteSunucu()..magazaModu = sunucuModu;
  final api = _api(s);
  await api.anahtariYukle();
  final k = SahteMagaza()..acik = magazaAcik;
  final o = OdemeModeli(api, k, geriYuklemeBekleme: const Duration(milliseconds: 20));
  addTearDown(o.dispose);
  await o.baslat();
  await _bosalt();
  return (o, s, k);
}

MagazaOlayi _alindi(String kimlik, {String urun = 'premium_aylik', MagazaOlayTuru tur = MagazaOlayTuru.satinAlindi}) => MagazaOlayi(tur, urunId: urun, platform: 'google', kimlik: kimlik);

void main() {
  test('1) mağaza fiyatları köprüden gelir; sunucu kapalıyken ve mağaza yokken doğru durum', () async {
    final (o, _, _) = await _kur();
    expect(o.faz, OdemeFazi.hazir);
    expect(o.paketler.map((p) => p.urun?.fiyat), ['₺199,00', '₺2.189,00', '₺399,00', '₺4.389,00']);
    expect(o.hesapKimligi, startsWith('g-'), reason: 'Google için takma ad');
    final (k, _, _) = await _kur(sunucuModu: 'kapali');
    expect(k.faz, OdemeFazi.sunucuKapali);
    final (y, _, _) = await _kur(magazaAcik: false);
    expect(y.faz, OdemeFazi.magazaYok);
  });

  test('2) satın alma: sunucu doğrulayınca paket açılır; işlem mağazaya YALNIZ ondan sonra tamamlanır', () async {
    final (o, s, k) = await _kur();
    s.magazaGercek.add('belirtec-1');
    k.satinAlYaniti = (u) => k.olay(_alindi('belirtec-1', urun: u));
    await o.satinAl('premium_aylik');
    expect(k.satinAlmalar.single.$2, o.hesapKimligi, reason: 'hesap takma adı satın almaya eklenir');
    await _bosalt();
    expect(s.magazaDogrulamalari.single, {'platform': 'google', 'kimlik': 'belirtec-1'});
    expect(k.tamamlananlar.length, 1);
    expect(o.hesap?.paketli, true);
    expect(o.mesajHata, false);
    expect(o.islemdeUrun, isNull);
  });

  test('3) sunucu reddederse paket AÇILMAZ ve işlem tamamlanmaz (uygulamanın "aldım" demesi yetmez)', () async {
    final (o, s, k) = await _kur();
    k.olay(_alindi('uydurma-belirtec')); // mağazada böyle bir işlem yok
    await _bosalt();
    expect(s.magazaDogrulamalari.length, 1);
    expect(k.tamamlananlar, isEmpty);
    expect(o.hesap?.paketli, false);
    expect(o.mesajHata, true);
    expect(o.mesaj, contains('bulamadı'));
    // başka hesaba ait işlem
    s.magazaHata = 'hesap_eslesmedi';
    k.olay(_alindi('baska-hesabin-belirteci'));
    await _bosalt();
    expect(o.mesaj, contains('başka bir AKE hesabına'));
    expect(k.tamamlananlar, isEmpty);
    expect(o.hesap?.paketli, false);
  });

  test('4) ağ/sunucu hatasında işlem açık kalır; yeniden denenince bir kez doğrulanır ve tamamlanır', () async {
    final (o, s, k) = await _kur();
    s.magazaGercek.add('belirtec-2');
    s.magazaAgHatasi = 1;
    k.olay(_alindi('belirtec-2'));
    await _bosalt();
    expect(o.dogrulanamayan, isNotNull);
    expect(k.tamamlananlar, isEmpty);
    expect(o.hesap?.paketli, false);
    await o.yenidenDene();
    await _bosalt();
    expect(s.magazaDogrulamalari.length, 2);
    expect(k.tamamlananlar.length, 1);
    expect(o.dogrulanamayan, isNull);
    expect(o.hesap?.paketli, true);
  });

  test('5) aynı olay eşzamanlı iki kez gelirse sunucuya tek doğrulama gider', () async {
    final (o, s, k) = await _kur();
    s.magazaGercek.add('belirtec-3');
    k.olay(_alindi('belirtec-3'));
    k.olay(_alindi('belirtec-3'));
    await _bosalt();
    expect(s.magazaDogrulamalari.length, 1);
    expect(o.hesap?.paketli, true);
  });

  test('6) bekleyen ödeme: erişim açılmaz; onaylanınca doğrulanıp açılır', () async {
    final (o, s, k) = await _kur();
    s.magazaGercek.add('belirtec-4');
    k.satinAlYaniti = (u) => k.olay(MagazaOlayi(MagazaOlayTuru.bekliyor, urunId: u, platform: 'google'));
    await o.satinAl('atilim_aylik');
    await _bosalt();
    expect(o.bekliyor, true);
    expect(s.magazaDogrulamalari, isEmpty);
    expect(o.hesap?.paketli, false);
    k.olay(_alindi('belirtec-4', urun: 'atilim_aylik'));
    await _bosalt();
    expect(o.bekliyor, false);
    expect(o.hesap?.paketli, true);
  });

  test('7) iptal ve mağaza hatası: sunucuya gidilmez, ekran serbest kalır, mesaj gösterilir', () async {
    final (o, s, k) = await _kur();
    k.satinAlYaniti = (u) => k.olay(MagazaOlayi(MagazaOlayTuru.iptal, urunId: u, platform: 'google'));
    await o.satinAl('atilim_yillik');
    await _bosalt();
    expect(o.islemdeUrun, isNull);
    expect(o.mesaj, contains('iptal'));
    expect(o.mesajHata, false);
    k.satinAlYaniti = (u) => k.olay(MagazaOlayi(MagazaOlayTuru.hata, urunId: u, platform: 'google', mesaj: 'x'));
    await o.satinAl('atilim_yillik');
    await _bosalt();
    expect(o.mesajHata, true);
    expect(o.islemdeUrun, isNull);
    expect(s.magazaDogrulamalari, isEmpty);
    k.satinAlAtar = true;
    await o.satinAl('atilim_yillik');
    expect(o.mesajHata, true);
    expect(o.islemdeUrun, isNull);
  });

  test('8) geri yükleme: mağazanın bildirdiği işlem sunucuya doğrulatılır; hiç yoksa "bulunamadı" (hata değil)', () async {
    final (o, s, k) = await _kur();
    await o.geriYukle();
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(k.geriYuklemeCagrisi, 1);
    expect(o.mesaj, contains('bulunamadı'));
    expect(o.mesajHata, false);
    s.magazaGercek.add('belirtec-5');
    k.geriYuklemeYaniti = () => k.olay(_alindi('belirtec-5', tur: MagazaOlayTuru.geriYuklendi));
    await o.geriYukle();
    await _bosalt();
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(s.magazaDogrulamalari.last['kimlik'], 'belirtec-5');
    expect(o.hesap?.paketli, true);
    expect(o.mesaj, contains('açıldı'));
  });

  test('9) işlem sürerken ikinci satın alma başlamaz (çift dokunma)', () async {
    final (o, _, k) = await _kur();
    await o.satinAl('atilim_aylik');
    await o.satinAl('premium_aylik');
    expect(k.satinAlmalar.length, 1);
  });

  test('9b) mağaza kimlik vermediğinde satın alma kilidi çözülür, erişim açılmaz', () async {
    final (o, s, k) = await _kur();
    k.satinAlYaniti = (u) => k.olay(MagazaOlayi(MagazaOlayTuru.satinAlindi, urunId: u, platform: 'google'));
    await o.satinAl('premium_aylik');
    await _bosalt();
    expect(o.islemdeUrun, isNull);
    expect(o.mesajHata, isTrue);
    expect(o.mesaj, contains('kimliği'));
    expect(s.magazaDogrulamalari, isEmpty);
    expect(k.tamamlananlar, isEmpty);
  });

  test('10) Apple köprüsü: işlem kimliği ve apple takma adı kullanılır', () async {
    final s = SahteSunucu();
    final api = _api(s);
    await api.anahtariYukle();
    final k = SahteMagaza()..platform = 'apple';
    final o = OdemeModeli(api, k);
    addTearDown(o.dispose);
    await o.baslat();
    await _bosalt();
    expect(o.hesapKimligi, '00000000-0000-4000-8000-000000000001');
    s.magazaGercek.add('2000000111');
    k.olay(const MagazaOlayi(MagazaOlayTuru.satinAlindi, urunId: 'premium_yillik', platform: 'apple', kimlik: '2000000111'));
    await _bosalt();
    expect(s.magazaDogrulamalari.single, {'platform': 'apple', 'kimlik': '2000000111'});
    expect(o.hesap?.paketli, true);
  });

  test('10b) başka hesaba ait bekleyen mağaza isteği ağa çıkmadan reddedilir', () async {
    final s = SahteSunucu(), api = _api(s);
    await api.anahtariYukle();
    await api.ben();
    await expectLater(api.magazaDogrula('google', 'eski-islem', beklenenHesap: 'baska-hesap'), throwsA(isA<ApiHata>().having((e) => e.kod, 'kod', 'hesap_degisti')));
    expect(s.magazaDogrulamalari, isEmpty);
  });

  for (final g in [320.0, 390.0]) {
    testWidgets('11) Paketler ekranı ${g.toInt()} dp: mağaza fiyatları, geri yükleme, web/Shopier bağlantısı yok, taşma yok', (t) async {
      t.view.physicalSize = Size(g, 1800);
      t.view.devicePixelRatio = 1.0;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final s = SahteSunucu();
      final api = _api(s);
      final m = UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': 'kapali'}));
      final k = SahteMagaza();
      m.magaza = k;
      await m.baslat();
      await t.pumpWidget(AkeUygulamasi(model: m));
      await t.pumpAndSettle();
      m.menuyeGit(MenuSayfasi.paket);
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('paket-satin-premium_yillik')), findsOneWidget);
      expect(find.textContaining('₺399,00'), findsOneWidget);
      expect(find.byKey(const ValueKey('paket-geri-yukle')), findsOneWidget);
      expect(find.textContaining('shopier', findRichText: true), findsNothing);
      expect(find.textContaining('http', findRichText: true), findsNothing);
      expect(t.takeException(), isNull);
      // satın alma → sunucu doğrular → ekran paketi gösterir
      s.magazaGercek.add('b-1');
      k.satinAlYaniti = (u) => k.olay(_alindi('b-1', urun: u));
      await t.ensureVisible(find.byKey(const ValueKey('paket-satin-premium_aylik')));
      await t.tap(find.byKey(const ValueKey('paket-satin-premium_aylik')));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('paket-durum')), findsOneWidget);
      expect(find.textContaining('Premium paketindesin'), findsOneWidget);
      expect(find.byKey(const ValueKey('paket-test')), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  }

  testWidgets('12) sunucu kapalıyken ekran açıklayıcı durum gösterir, satın alma düğmesi yok', (t) async {
    t.view.physicalSize = const Size(390, 900);
    t.view.devicePixelRatio = 1.0;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final s = SahteSunucu()..magazaModu = 'kapali';
    final api = _api(s);
    final m = UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': 'kapali'}));
    m.magaza = SahteMagaza();
    await m.baslat();
    await t.pumpWidget(AkeUygulamasi(model: m));
    await t.pumpAndSettle();
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.text('Paket satın alma henüz açık değil'), findsOneWidget);
    expect(find.byKey(const ValueKey('paket-satin-premium_aylik')), findsNothing);
  });

  testWidgets('13) Paketler ekranı kapansa da satın alma işlenir; çıkıştan sonra eski dinleyici işlem yapmaz', (t) async {
    t.view.physicalSize = const Size(390, 900);
    t.view.devicePixelRatio = 1.0;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final s = SahteSunucu(), api = _api(s), k = SahteMagaza();
    final m = UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': 'kapali'}))..magaza = k;
    await m.baslat();
    await t.pumpWidget(AkeUygulamasi(model: m));
    await t.pumpAndSettle();
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    m.menuyeGit(null); // Satın alma onayı kullanıcı Menü'ye dönmüşken gelebilir.
    await t.pumpAndSettle();
    s.magazaGercek.add('gec-gelen-islem');
    k.olay(_alindi('gec-gelen-islem'));
    await t.pumpAndSettle();
    expect(s.magazaDogrulamalari.single['kimlik'], 'gec-gelen-islem');
    expect(k.tamamlananlar.length, 1);
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.textContaining('Premium paketindesin'), findsOneWidget);
    await m.cikis();
    await t.pumpAndSettle();
    k.olay(_alindi('eski-hesap-islemi'));
    await t.pumpAndSettle();
    expect(s.magazaDogrulamalari.length, 1, reason: 'çıkıştan sonra eski hesapla yeni ödeme doğrulanmaz');
    expect(k.tamamlananlar.length, 1);
    s.hesapId = 'u2';
    await m.kodDogrula('yeni@ornek.com', '12345678');
    await t.pumpAndSettle();
    s.magazaGercek.add('yeni-hesap-islemi');
    k.olay(_alindi('yeni-hesap-islemi'));
    await t.pumpAndSettle();
    expect(s.magazaDogrulamalari.length, 2, reason: 'yeni hesap kendi ödeme dinleyicisini açar');
    expect(s.magazaDogrulamalari.last['kimlik'], 'yeni-hesap-islemi');
  });

  // ---------- durum tazeleme (Paketler yeniden açılınca / uygulama arka plandan dönünce) ----------
  group('14) tazele: süre bitimi ve iade', () {
    for (final durum in ['bitti', 'iade']) {
      test('sunucu "$durum" dönünce paket kapanır; ekran "yükleniyor"a düşmez', () async {
        final s0 = SahteSunucu()..magazaPaketAcik = true;
        final api = _api(s0);
        await api.anahtariYukle();
        final k = SahteMagaza();
        final o = OdemeModeli(api, k);
        addTearDown(o.dispose);
        await o.baslat();
        await _bosalt();
        expect(o.hesap?.paketli, true);
        s0.magazaPaketAcik = false;
        s0.magazaBitenDurum = durum;
        final fazlar = <OdemeFazi>[];
        o.addListener(() => fazlar.add(o.faz));
        await o.tazele();
        expect(o.hesap?.paketli, false, reason: 'erişim sunucunun yanıtına göre kapanır');
        expect(o.islemler.single.durum, durum);
        expect(fazlar, everyElement(OdemeFazi.hazir), reason: 'eldeki bilgi tazelenirken ekran boşalmaz');
      });
    }
  });

  test('15) eski yanıt yeni durumu ezmez (iki eşzamanlı tazeleme, eski olan en son döner)', () async {
    final s = SahteSunucu()..magazaPaketAcik = true;
    final api = _api(s);
    await api.anahtariYukle();
    final o = OdemeModeli(api, SahteMagaza());
    addTearDown(o.dispose);
    await o.baslat();
    await _bosalt();
    expect(o.hesap?.paketli, true);
    s.magazaGetTut = true;
    final eski = o.tazele(); // o anki durum: paket açık
    await _bosalt();
    s.magazaPaketAcik = false; // arada iade
    s.magazaBitenDurum = 'iade';
    final yeni = o.tazele();
    await _bosalt();
    s.magazaTutulan[1].complete();
    await yeni;
    expect(o.hesap?.paketli, false);
    s.magazaTutulan[0].complete(); // eski yanıt en son gelir
    await eski;
    expect(o.hesap?.paketli, false, reason: 'daha yeni okumanın sonucu eski yanıtla geri alınmaz');
    expect(o.islemler.single.durum, 'iade');
  });

  test('16) ağ hatasında eski bilgi güncelmiş gibi sunulmaz: uyarı + tekrar deneme; düzelince uyarı kalkar', () async {
    final s = SahteSunucu()..magazaPaketAcik = true;
    final api = _api(s);
    await api.anahtariYukle();
    final o = OdemeModeli(api, SahteMagaza());
    addTearDown(o.dispose);
    await o.baslat();
    await _bosalt();
    s.magazaGetAgYok = true;
    await o.tazele();
    expect(o.eskimis, true);
    expect(o.eskimisMesaji, contains('Sunucuya ulaşılamadı'));
    expect(o.faz, OdemeFazi.hazir, reason: 'eski liste kalır');
    expect(o.hesap?.paketli, true, reason: 'bilgi silinmez ama "eski olabilir" diye işaretlidir');
    s.magazaGetAgYok = false;
    await o.tazele();
    expect(o.eskimis, false);
    // eldeki bilgi yokken (ilk yükleme) hata ekranına düşer
    final s2 = SahteSunucu()..magazaGetAgYok = true;
    final api2 = _api(s2);
    await api2.anahtariYukle();
    final o2 = OdemeModeli(api2, SahteMagaza());
    addTearDown(o2.dispose);
    await o2.baslat();
    await _bosalt();
    expect(o2.faz, OdemeFazi.hata);
    expect(o2.hataMesaji, contains('Sunucuya ulaşılamadı'));
    expect(o2.hesap, isNull);
  });

  test('17) tazeleme süren satın alma, bekleyen onay, mesaj ve "Yeniden dene" durumunu sıfırlamaz', () async {
    final (o, s, k) = await _kur();
    // (a) işlem mağazada sürüyor
    await o.satinAl('premium_aylik');
    expect(o.islemdeUrun, 'premium_aylik');
    await o.tazele();
    expect(o.islemdeUrun, 'premium_aylik');
    // (b) mağaza onay bekliyor
    k.olay(_alindi('', tur: MagazaOlayTuru.bekliyor));
    await _bosalt();
    expect(o.bekliyor, true);
    await o.tazele();
    expect(o.bekliyor, true);
    // (c) sunucu doğrulayamadı → Yeniden dene bekliyor; tazeleme bunu silmez
    final (o2, s2, k2) = await _kur();
    s2.magazaGercek.add('t-1');
    s2.magazaAgHatasi = 1;
    k2.satinAlYaniti = (u) => k2.olay(_alindi('t-1', urun: u));
    await o2.satinAl('premium_aylik');
    await _bosalt();
    expect(o2.dogrulanamayan, isNotNull);
    final mesaj = o2.mesaj;
    await o2.tazele();
    expect(o2.dogrulanamayan, isNotNull);
    expect(o2.mesaj, mesaj);
    await o2.yenidenDene();
    await _bosalt();
    expect(o2.hesap?.paketli, true);
    expect(s.magazaDogrulamalari, isEmpty);
  });

  test('18) tazeleme sürerken satın alma olayı gelirse sonuç eski (satın almadan önceki) yanıtla ezilmez', () async {
    final (o, s, k) = await _kur();
    expect(o.hesap?.paketli, isNot(true));
    s.magazaGetTut = true;
    final eski = o.tazele(); // satın almadan ÖNCEKİ durum: paket yok
    await _bosalt();
    s.magazaGercek.add('t-2');
    k.olay(_alindi('t-2'));
    await _bosalt();
    expect(s.magazaDogrulamalari.single['kimlik'], 't-2');
    expect(s.magazaTutulan.length, 2, reason: 'doğrulama sonrası yenileme de yolda');
    s.magazaTutulan[1].complete(); // yeni (satın alma sonrası) yanıt
    await _bosalt();
    expect(o.hesap?.paketli, true);
    s.magazaTutulan[0].complete(); // eski yanıt en son gelir
    await eski;
    await _bosalt();
    expect(o.hesap?.paketli, true, reason: 'eski yanıt paketi geri kapatmaz');
    expect(k.tamamlananlar.length, 1);
    expect(o.mesaj, contains('Paketin açıldı'));
  });

  test('19) hesap değişirse eski hesabın yanıtı uygulanmaz', () async {
    // (a) yanıt yolda iken dinleyici kapanır (çıkış / hesap değişimi)
    final s = SahteSunucu()..magazaPaketAcik = true;
    final api = _api(s);
    await api.anahtariYukle();
    await api.ben();
    final o = OdemeModeli(api, SahteMagaza(), hesapId: 'u1');
    s.magazaGetTut = true;
    final f = o.baslat();
    await _bosalt();
    o.dispose();
    s.magazaTutulan.single.complete();
    await f;
    expect(o.hesap, isNull, reason: 'kapanmış dinleyici eski hesabın paketini almaz');
    // (b) istek bile atılmaz: oturum başka hesaba geçmiş
    final s2 = SahteSunucu()..magazaPaketAcik = true;
    final api2 = _api(s2);
    await api2.anahtariYukle();
    await api2.ben();
    final o2 = OdemeModeli(api2, SahteMagaza(), hesapId: 'baska-hesap');
    addTearDown(o2.dispose);
    await o2.tazele();
    expect(s2.magazaGetSayisi, 0);
    expect(o2.hesap, isNull);
  });

  Future<(UygulamaModeli, SahteSunucu, SahteMagaza)> ekranKur(WidgetTester t, {bool paketAcik = false}) async {
    t.view.physicalSize = const Size(390, 900);
    t.view.devicePixelRatio = 1.0;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final s = SahteSunucu()..magazaPaketAcik = paketAcik, api = _api(s), k = SahteMagaza();
    final m = UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': 'kapali'}))..magaza = k;
    await m.baslat();
    await t.pumpWidget(AkeUygulamasi(model: m));
    await t.pumpAndSettle();
    return (m, s, k);
  }

  testWidgets('20) Paketler her yeniden açılışta tazelenir (süre bitimi / başka cihazdaki değişiklik görünür)', (t) async {
    final (m, s, _) = await ekranKur(t, paketAcik: true);
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.textContaining('Premium paketindesin'), findsOneWidget);
    final once = s.magazaGetSayisi;
    m.menuyeGit(null);
    await t.pumpAndSettle();
    s.magazaPaketAcik = false; // arada süre bitti
    s.magazaBitenDurum = 'bitti';
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(s.magazaGetSayisi, greaterThan(once));
    expect(find.textContaining('Premium paketindesin'), findsNothing);
    expect(find.textContaining('ücretsiz paketi'), findsOneWidget);
  });

  testWidgets('21) ekran açıkken uygulama arka plandan dönünce tazelenir; ekran kapalıyken sunucuya sorulmaz', (t) async {
    final (m, s, _) = await ekranKur(t, paketAcik: true);
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.textContaining('Premium paketindesin'), findsOneWidget);
    s.magazaPaketAcik = false; // arka plandayken iade edildi
    s.magazaBitenDurum = 'iade';
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await t.pumpAndSettle();
    expect(find.textContaining('Premium paketindesin'), findsNothing);
    expect(find.textContaining('ücretsiz paketi'), findsOneWidget);
    m.menuyeGit(null);
    await t.pumpAndSettle();
    final n = s.magazaGetSayisi;
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await t.pumpAndSettle();
    expect(s.magazaGetSayisi, n, reason: 'Paketler kapalıyken geri dönüşte gereksiz istek yok');
  });

  testWidgets('22) tazeleme ağ hatasıyla düşerse ekranda "eski olabilir" uyarısı ve Tekrar dene çıkar; düzelince kalkar', (t) async {
    final (m, s, _) = await ekranKur(t, paketAcik: true);
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-eski')), findsNothing);
    s.magazaGetAgYok = true;
    m.menuyeGit(null);
    await t.pumpAndSettle();
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-eski')), findsOneWidget);
    expect(find.textContaining('eski olabilir'), findsOneWidget);
    expect(find.textContaining('Premium paketindesin'), findsOneWidget, reason: 'eski bilgi silinmez, ama uyarıyla gösterilir');
    s.magazaGetAgYok = false;
    await t.ensureVisible(find.byKey(const ValueKey('paket-tazele')));
    await t.tap(find.byKey(const ValueKey('paket-tazele')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-eski')), findsNothing);
    expect(t.takeException(), isNull);
  });

  // ---------- eski bilgi / doğrulanamayan işlem varken yeni satın alma kapalı ----------
  test('23) ağ kesintisi → eski bilgi → satın alma engeli → bağlantı gelince tazeleme → yeniden açılır', () async {
    final (o, s, k) = await _kur();
    expect(o.satinAlmaEngelli, false);
    s.magazaGetAgYok = true;
    await o.tazele();
    expect(o.eskimis, true);
    expect(o.satinAlmaEngelli, true);
    await o.satinAl('premium_aylik');
    expect(k.satinAlmalar, isEmpty, reason: 'eski bilgiyle yeni ödeme başlatılmaz (model katmanı)');
    expect(o.islemdeUrun, isNull);
    await o.tazele(); // hâlâ ağ yok
    expect(o.satinAlmaEngelli, true);
    s.magazaGetAgYok = false;
    await o.tazele();
    expect(o.eskimis, false);
    expect(o.satinAlmaEngelli, false);
    await o.satinAl('premium_aylik');
    expect(k.satinAlmalar.length, 1, reason: 'başarılı tazelemeden sonra satın alma yeniden açılır');
  });

  test('24) doğrulanamayan işlem korunur: yeni satın alma onu silmez; yalnız sunucu doğrulayınca kalkar', () async {
    final (o, s, k) = await _kur();
    s.magazaGercek.add('u-1');
    s.magazaAgHatasi = 1;
    k.satinAlYaniti = (u) => k.olay(_alindi('u-1', urun: u));
    await o.satinAl('premium_aylik');
    await _bosalt();
    expect(o.dogrulanamayan?.kimlik, 'u-1');
    expect(o.satinAlmaEngelli, true);
    expect(k.satinAlmalar.length, 1);
    // yeni satın alma denemesi: mağazaya gitmez, kayıt silinmez
    await o.satinAl('atilim_aylik');
    expect(k.satinAlmalar.length, 1);
    expect(o.dogrulanamayan?.kimlik, 'u-1');
    // başarılı tazeleme çözülmemiş işlemi silmez, satın almayı da açmaz
    await o.tazele();
    expect(o.eskimis, false);
    expect(o.dogrulanamayan?.kimlik, 'u-1');
    expect(o.satinAlmaEngelli, true);
    // "Geri yükle" mağazadan işlem getirmezse kayıt yine kalır
    await o.geriYukle();
    await Future<void>.delayed(const Duration(milliseconds: 80));
    expect(o.dogrulanamayan?.kimlik, 'u-1');
    expect(o.satinAlmaEngelli, true);
    // sunucu doğrulayınca kayıt kalkar, satın alma yeniden açılır
    await o.yenidenDene();
    await _bosalt();
    expect(o.dogrulanamayan, isNull);
    expect(k.tamamlananlar.length, 1);
    expect(o.hesap?.paketli, true);
    expect(o.satinAlmaEngelli, false);
    k.satinAlYaniti = null;
    await o.satinAl('premium_yillik');
    expect(k.satinAlmalar.length, 2);
  });

  testWidgets('25) Paketler: ağ kesintisi uyarısı + satın alma kilidi; bağlantı gelince Tekrar dene kilidi açar', (t) async {
    final (m, s, k) = await ekranKur(t);
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-engel')), findsNothing);
    s.magazaGetAgYok = true;
    m.menuyeGit(null);
    await t.pumpAndSettle();
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-eski')), findsOneWidget);
    expect(find.byKey(const ValueKey('paket-engel')), findsOneWidget);
    await t.ensureVisible(find.byKey(const ValueKey('paket-satin-premium_aylik')));
    await t.tap(find.byKey(const ValueKey('paket-satin-premium_aylik')), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(k.satinAlmalar, isEmpty, reason: 'düğme kilitli: mağaza penceresi açılmaz');
    s.magazaGetAgYok = false;
    await t.ensureVisible(find.byKey(const ValueKey('paket-tazele')));
    await t.tap(find.byKey(const ValueKey('paket-tazele')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-eski')), findsNothing);
    expect(find.byKey(const ValueKey('paket-engel')), findsNothing);
    await t.ensureVisible(find.byKey(const ValueKey('paket-satin-premium_aylik')));
    await t.tap(find.byKey(const ValueKey('paket-satin-premium_aylik')));
    await t.pumpAndSettle();
    expect(k.satinAlmalar.length, 1, reason: 'tazeleme başarılı: satın alma yeniden açıldı');
    expect(t.takeException(), isNull);
  });

  testWidgets('26) Paketler: doğrulanamayan ödeme varken yeni satın alma kapalı, "Yeniden dene" yolu gösterilir', (t) async {
    final (m, s, k) = await ekranKur(t);
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    s.magazaGercek.add('w-1');
    s.magazaAgHatasi = 1;
    k.satinAlYaniti = (u) => k.olay(_alindi('w-1', urun: u));
    await t.ensureVisible(find.byKey(const ValueKey('paket-satin-premium_aylik')));
    await t.tap(find.byKey(const ValueKey('paket-satin-premium_aylik')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-yeniden')), findsOneWidget);
    expect(find.textContaining('henüz doğrulanamadı'), findsOneWidget);
    await t.ensureVisible(find.byKey(const ValueKey('paket-satin-atilim_aylik')));
    await t.tap(find.byKey(const ValueKey('paket-satin-atilim_aylik')), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(k.satinAlmalar.length, 1, reason: 'ikinci satın alma başlamadı');
    expect(find.byKey(const ValueKey('paket-yeniden')), findsOneWidget, reason: 'çözülmemiş işlem silinmedi');
    await t.ensureVisible(find.byKey(const ValueKey('paket-yeniden')));
    await t.tap(find.byKey(const ValueKey('paket-yeniden')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('paket-yeniden')), findsNothing);
    expect(find.byKey(const ValueKey('paket-engel')), findsNothing);
    expect(find.textContaining('Premium paketindesin'), findsOneWidget);
    expect(m.odeme!.satinAlmaEngelli, false);
    expect(t.takeException(), isNull);
  });
}
