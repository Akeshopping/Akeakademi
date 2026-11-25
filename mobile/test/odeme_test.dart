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
  for (var i = 0; i < 12; i++) {
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

  for (final g in [320.0, 390.0]) {
    testWidgets('11) Paketler ekranı ${g.toInt()} dp: mağaza fiyatları, geri yükleme, web/Shopier bağlantısı yok, taşma yok', (t) async {
      t.view.physicalSize = Size(g, 900);
      t.view.devicePixelRatio = 1.0;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final s = SahteSunucu();
      final api = _api(s);
      final m = UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': '1'}));
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
    final m = UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': '1'}));
    m.magaza = SahteMagaza();
    await m.baslat();
    await t.pumpWidget(AkeUygulamasi(model: m));
    await t.pumpAndSettle();
    m.menuyeGit(MenuSayfasi.paket);
    await t.pumpAndSettle();
    expect(find.text('Paket satın alma henüz açık değil'), findsOneWidget);
    expect(find.byKey(const ValueKey('paket-satin-premium_aylik')), findsNothing);
  });
}
