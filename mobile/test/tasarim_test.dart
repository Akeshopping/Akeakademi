import 'package:ake_akademi/durum/uygulama.dart';
import 'package:ake_akademi/ui/acilis.dart';
import 'package:ake_akademi/ui/kok.dart';
import 'package:ake_akademi/ui/marka.dart';
import 'package:ake_akademi/ui/tema.dart';
import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/ilerleme.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'sahte_sunucu.dart';

UygulamaModeli model(SahteSunucu s, {String? anahtar, Map<String, String>? ayar}) {
  final api = AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: BellekDeposu(anahtar));
  return UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar(ayar ?? {'acilis': '1'}));
}

void ekran(WidgetTester t, double genislik, {double yukseklik = 700}) {
  t.view.physicalSize = Size(genislik, yukseklik);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);
}

Future<void> sekme(WidgetTester t, int i) async {
  await t.tap(find.byKey(ValueKey('sekme-$i')));
  await t.pumpAndSettle();
}

void main() {
  group('K amblemi (marka)', () {
    test('şekil sitedeki path ile aynı kutuda: (6,6)–(58,60); evenodd ile K deliği boş', () {
      final p = AkeAmblemYolu.olustur();
      final k = p.getBounds();
      expect(k.left, closeTo(6, 0.01));
      expect(k.top, closeTo(6, 0.01));
      expect(k.right, closeTo(58, 0.01));
      expect(k.bottom, closeTo(60, 0.01));
      expect(p.fillType, PathFillType.evenOdd);
      expect(p.contains(const Offset(50, 12)), isTrue, reason: 'K\'nin üstündeki dolu bölge');
      expect(p.contains(const Offset(28, 50)), isFalse, reason: 'K gövdesi oyuk (evenodd)');
      expect(p.contains(const Offset(10, 10)), isFalse, reason: 'sol üst köşe yuvarlak: dışarıda');
      expect(p.contains(const Offset(8, 58)), isTrue, reason: 'sol alt köşe dik');
    });

    test('gradyan renkleri gen_icons.py ile aynı', () {
      expect(AkeAmblemRenk.koyuZemin.baslangic, const Color(0xFFF27D6D));
      expect(AkeAmblemRenk.koyuZemin.bitis, const Color(0xFFFAD6D0));
      expect(AkeAmblemRenk.acikZemin.baslangic, const Color(0xFFD94F43));
      expect(AkeAmblemRenk.acikZemin.bitis, const Color(0xFFF27D6D));
    });

    testWidgets('amblem 52:54 oranında çizilir', (t) async {
      await t.pumpWidget(const Directionality(textDirection: TextDirection.ltr, child: Center(child: AkeAmblem(genislik: 104))));
      final boyut = t.getSize(find.byType(AkeAmblem));
      expect(boyut.width, 104);
      expect(boyut.height, closeTo(108, 0.01));
    });
  });

  for (final genislik in [320.0, 390.0]) {
    for (final koyu in [false, true]) {
      final etiket = '${genislik.toInt()} px ${koyu ? 'koyu' : 'açık'}';
      testWidgets('giriş ekranı taşmadan çizilir ve düğme dokunma alanı ≥48 ($etiket)', (t) async {
        ekran(t, genislik, yukseklik: 640);
        t.platformDispatcher.platformBrightnessTestValue = koyu ? Brightness.dark : Brightness.light;
        addTearDown(t.platformDispatcher.clearPlatformBrightnessTestValue);
        final s = SahteSunucu(), m = model(s);
        await m.baslat();
        await t.pumpWidget(AkeUygulamasi(model: m));
        await t.pumpAndSettle();
        expect(find.text('Ücretsiz başla'), findsOneWidget);
        expect(t.getSize(find.byType(AkeDugme).first).height, greaterThanOrEqualTo(48));
        expect(Theme.of(t.element(find.byType(Scaffold).first)).extension<AkeTok>()!.koyu, koyu);
        await t.tap(find.text('Ücretsiz başla'));
        await t.pumpAndSettle();
        expect(find.byType(TextField), findsOneWidget);
        expect(t.takeException(), isNull);
      });

      testWidgets('ana sayfa, soru çöz, gelişim, plan, ayarlar taşmadan çizilir; alt gezinme ≥48 ($etiket)', (t) async {
        ekran(t, genislik);
        t.platformDispatcher.platformBrightnessTestValue = koyu ? Brightness.dark : Brightness.light;
        addTearDown(t.platformDispatcher.clearPlatformBrightnessTestValue);
        final s = SahteSunucu()..ilerlemeler['u1'] = {'mat|Sayılar': [7, 3, 0]};
        final m = model(s, anahtar: SahteSunucu.anahtar);
        await m.baslat();
        await t.pumpWidget(AkeUygulamasi(model: m));
        await t.pumpAndSettle();
        expect(find.text('Bugünün hedefi'), findsOneWidget);
        for (var i = 0; i < 5; i++) {
          await sekme(t, i);
          expect(t.takeException(), isNull, reason: 'sekme $i');
          expect(t.getSize(find.byKey(ValueKey('sekme-$i'))).height, greaterThanOrEqualTo(48));
        }
      });
    }
  }

  testWidgets('soru ekranı 320 px: beş şık, uzun açıklamada geri bildirim görünür alana kayar', (t) async {
    ekran(t, 320, yukseklik: 568);
    final s = SahteSunucu()..aciklama = List.filled(40, 'Bu çözümde önce verilenler yazılır, sonra işlem sırası kurulur.').join(' ');
    final m = model(s, anahtar: SahteSunucu.anahtar);
    await m.baslat();
    await t.pumpWidget(AkeUygulamasi(model: m));
    await t.pumpAndSettle();
    await sekme(t, 1);
    await t.tap(find.text('TYT'));
    await t.pumpAndSettle();
    await t.scrollUntilVisible(find.text('Matematik'), 120, scrollable: find.byType(Scrollable).first);
    await t.tap(find.text('Matematik'));
    await t.pumpAndSettle();
    await t.scrollUntilVisible(find.text('Sayılar'), 120, scrollable: find.byType(Scrollable).first);
    await t.tap(find.text('Sayılar'));
    await t.pumpAndSettle();
    for (final harf in ['a', 'b', 'c', 'd', 'e']) {
      expect(find.text(harf), findsOneWidget);
    }
    expect(t.getSize(find.text('c')).height, greaterThan(0));
    await t.tap(find.text('c'));
    await t.pump();
    await t.tap(find.text('Cevapla'));
    await t.pumpAndSettle();
    expect(find.text('Doğru!'), findsOneWidget);
    final konum = t.state<ScrollableState>(find.byType(Scrollable).first).position.pixels;
    expect(konum, greaterThan(0), reason: 'açıklamaya kayılmalı');
    expect(find.text('Sonraki soru'), findsOneWidget, reason: 'alt eylem alanı kaydırmada da görünür');
    expect(t.takeException(), isNull);
  });

  testWidgets('tema ayarı: Koyu seçilince uygulama koyu temaya geçer', (t) async {
    ekran(t, 390);
    final s = SahteSunucu(), m = model(s, anahtar: SahteSunucu.anahtar);
    await m.baslat();
    await t.pumpWidget(AkeUygulamasi(model: m));
    await t.pumpAndSettle();
    await sekme(t, 4);
    await t.tap(find.text('Koyu'));
    await t.pumpAndSettle();
    expect(m.tema, ThemeMode.dark);
    expect(Theme.of(t.element(find.byType(Scaffold).first)).extension<AkeTok>()!.koyu, isTrue);
    expect(t.takeException(), isNull);
  });

  group('açılış animasyonu', () {
    test('toplam süre ≤ 2,5 sn (2,2 sn animasyon + 0,25 sn sönme)', () {
      const katman = AcilisKatmani(bitti: _bos);
      expect(katman.sure.inMilliseconds + 250, lessThanOrEqualTo(2500));
    });

    testWidgets('ilk açılışta oynar, "Geç" ilk karede var, süre sonunda biter ve bir daha oynamaz', (t) async {
      ekran(t, 390);
      final s = SahteSunucu(), m = model(s, ayar: const <String, String>{});
      await m.baslat();
      expect(m.acilisOynat, isTrue);
      await t.pumpWidget(AkeUygulamasi(model: m));
      await t.pump();
      expect(find.text('Geç'), findsOneWidget);
      expect(find.byType(AcilisKatmani), findsOneWidget);
      await t.pump(const Duration(milliseconds: 1100));
      expect(find.text('Geç'), findsOneWidget, reason: 'ortasında hâlâ oynuyor');
      await t.pump(const Duration(milliseconds: 1200));
      await t.pump(const Duration(milliseconds: 300));
      await t.pump();
      expect(find.byType(AcilisKatmani), findsNothing);
      expect(m.acilisOynat, isFalse);
      expect(await m.ayar.oku('acilis'), '1');
      // tekrar açılış: aynı ayarla yeni model animasyonu hiç göstermez
      final m2 = UygulamaModeli(m.api, m.senkron, ayar: m.ayar);
      await m2.baslat();
      expect(m2.acilisOynat, isFalse);
    });

    testWidgets('"Geç" hemen bitirir ve giriş ekranı kullanılabilir kalır', (t) async {
      ekran(t, 320, yukseklik: 640);
      final s = SahteSunucu(), m = model(s, ayar: const <String, String>{});
      await m.baslat();
      await t.pumpWidget(AkeUygulamasi(model: m));
      await t.pump();
      await t.tap(find.text('Geç'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 10));
      expect(find.byType(AcilisKatmani), findsNothing);
      expect(m.acilisOynat, isFalse);
      await t.tap(find.text('Ücretsiz başla'));
      await t.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('hareketi azalt açıkken animasyon hiç oynamaz', (t) async {
      ekran(t, 390);
      t.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(t.platformDispatcher.clearAccessibilityFeaturesTestValue);
      final s = SahteSunucu(), m = model(s, ayar: const <String, String>{});
      await m.baslat();
      await t.pumpWidget(AkeUygulamasi(model: m));
      await t.pump();
      await t.pump();
      expect(find.text('Geç'), findsNothing);
      expect(m.acilisOynat, isFalse);
      expect(find.text('Ücretsiz başla'), findsOneWidget);
    });
  });
}

void _bos() {}
