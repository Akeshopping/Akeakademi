import 'package:ake_akademi/durum/uygulama.dart';
import 'package:ake_akademi/ui/kok.dart';
import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/ilerleme.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'sahte_sunucu.dart';

UygulamaModeli kurModel(SahteSunucu s, [BellekDeposu? depo]) {
  final api = AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: depo ?? BellekDeposu());
  return UygulamaModeli(api, IlerlemeSenkron(api));
}

Future<void> buyukEkran(WidgetTester t) async {
  t.view.physicalSize = const Size(900, 2200);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);
}

void main() {
  testWidgets('giriş → sınav → ders → konu → soru → cevap → sonuç → hesaptaki ilerleme', (t) async {
    await buyukEkran(t);
    final s = SahteSunucu(), model = kurModel(s);
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));

    expect(find.text('Ücretsiz başla'), findsOneWidget);
    await t.tap(find.text('Ücretsiz başla'));
    await t.pump();
    await t.enterText(find.byType(TextField), 'ogrenci@ornek.com');
    await t.tap(find.text('Giriş kodu gönder'));
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextField), '12345678');
    await t.tap(find.text('Giriş yap'));
    await t.pumpAndSettle();

    expect(find.text('Hangi sınava çalışıyorsun?'), findsOneWidget);
    await t.tap(find.text('TYT'));
    await t.pumpAndSettle();
    await t.tap(find.text('Matematik'));
    await t.pumpAndSettle();
    await t.tap(find.text('Sayılar'));
    await t.pumpAndSettle();

    expect(find.text('Soru 1 / 2'), findsOneWidget);
    await t.tap(find.text('c')); // q1'in doğru şıkkı (index 2)
    await t.pump();
    await t.tap(find.text('Cevapla'));
    await t.pumpAndSettle();
    expect(find.text('Doğru!'), findsOneWidget);
    expect(find.text('Açıklama metni'), findsOneWidget);

    await t.tap(find.text('Sonraki soru'));
    await t.pumpAndSettle();
    expect(find.text('Soru 2 / 2'), findsOneWidget);
    expect(find.text('Paragraf'), findsOneWidget);
    await t.tap(find.text('b')); // q2'nin doğru şıkkı A; B yanlış
    await t.pump();
    await t.tap(find.text('Cevapla'));
    await t.pumpAndSettle();
    expect(find.textContaining('Yanlış — doğru cevap A'), findsOneWidget);

    await t.tap(find.text('Bitir'));
    await t.pumpAndSettle();
    expect(find.text('1 / 2'), findsOneWidget);
    expect(find.text('İlerlemen hesabına kaydedildi.'), findsOneWidget);

    // Sunucudaki hesap verisi (web ile aynı alan) gerçekten güncellendi
    final stats = s.stats!;
    expect(stats['topic']['mat|Sayılar'], [1, 1, 0]);
    expect(stats['daily'].values.first['q'], 2);
    expect(stats['daily'].values.first['c'], 1);
    expect(stats['td']['mat|Sayılar'], [[1, 0], [0, 0], [0, 1]]);

    await t.tap(find.text('Hesabımdaki ilerleme'));
    await t.pumpAndSettle();
    expect(find.text('1 doğru · 1 yanlış · %50'), findsOneWidget);
    // Cevap anahtarı hiçbir istek gövdesinde ya da istemci modelinde yok; çerez hiç gönderilmedi
    expect(s.istekler.any((r) => r.headers.containsKey('cookie')), isFalse);
  });

  testWidgets('kayıtlı oturum süresi dolmuşsa açılışta "oturum süresi doldu" ekranı', (t) async {
    final s = SahteSunucu()..oturumGecerli = false, model = kurModel(s, BellekDeposu(SahteSunucu.anahtar));
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));
    expect(find.textContaining('Oturumunun süresi doldu'), findsOneWidget);
    expect(find.text('Giriş kodu gönder'), findsOneWidget);
  });

  testWidgets('kullanım sırasında oturum biterse açık ekranlar kapanır ve giriş ekranı gelir', (t) async {
    await buyukEkran(t);
    final s = SahteSunucu(), model = kurModel(s, BellekDeposu(SahteSunucu.anahtar));
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));
    await t.pumpAndSettle();
    expect(find.text('Hangi sınava çalışıyorsun?'), findsOneWidget);
    await t.tap(find.text('TYT'));
    await t.pumpAndSettle();
    s.oturumGecerli = false;
    await t.tap(find.text('Matematik'));
    await t.pumpAndSettle();
    await t.tap(find.text('Sayılar'));
    await t.pumpAndSettle();
    expect(find.textContaining('Oturumunun süresi doldu'), findsOneWidget);
  });

  testWidgets('internet yoksa "Bağlantı yok" ve tekrar dene', (t) async {
    final s = SahteSunucu()..agYok = true, model = kurModel(s, BellekDeposu(SahteSunucu.anahtar));
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));
    expect(find.text('Bağlantı yok'), findsOneWidget);
    s.agYok = false;
    await t.tap(find.text('Tekrar dene'));
    await t.pumpAndSettle();
    expect(find.text('Hangi sınava çalışıyorsun?'), findsOneWidget);
  });

  testWidgets('soru servisi kapalıysa anlaşılır durum ekranı', (t) async {
    final s = SahteSunucu()..soruServisiAcik = false, model = kurModel(s, BellekDeposu(SahteSunucu.anahtar));
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));
    await t.pumpAndSettle();
    expect(find.text('Soru servisi henüz açık değil'), findsOneWidget);
  });

  testWidgets('ücretsiz hak bitince limit ekranı (ödeme bağlantısı yok)', (t) async {
    await buyukEkran(t);
    final s = SahteSunucu()..limitDoldu = true, model = kurModel(s, BellekDeposu(SahteSunucu.anahtar));
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));
    await t.pumpAndSettle();
    await t.tap(find.text('TYT'));
    await t.pumpAndSettle();
    await t.tap(find.text('Matematik'));
    await t.pumpAndSettle();
    await t.tap(find.text('Sayılar'));
    await t.pumpAndSettle();
    expect(find.text('Ücretsiz hakkın bitti'), findsOneWidget);
    expect(find.textContaining('Shopier'), findsNothing);
    expect(find.textContaining('satın'), findsNothing);
  });
}
