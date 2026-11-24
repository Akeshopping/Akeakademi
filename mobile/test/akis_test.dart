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

    // Sunucu, kendi kaydettiği cevaplardan hesabın ilerlemesini işledi (istemci sayaç göndermedi)
    expect(s.ilerlemeler['u1']!['mat|Sayılar'], [1, 1, 0]);
    expect(s.istekler.where((r) => r.url.path.startsWith('/api/hesap/veri/')), isEmpty);

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

  testWidgets('soru açılırken yanıt kaybolursa "Tekrar dene" AYNI istek kimliğiyle gider: ikinci kota kullanımı olmaz', (t) async {
    await buyukEkran(t);
    final s = SahteSunucu()..yanitKaybi = 1, model = kurModel(s, BellekDeposu(SahteSunucu.anahtar));
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));
    await t.pumpAndSettle();
    await t.tap(find.text('TYT'));
    await t.pumpAndSettle();
    await t.tap(find.text('Matematik'));
    await t.pumpAndSettle();
    await t.tap(find.text('Sayılar'));
    await t.pumpAndSettle();
    expect(find.text('Sorular açılamadı'), findsOneWidget);
    expect(s.kotaKullanilan, 1); // sunucu işledi, yanıt ulaşmadı
    await t.tap(find.text('Tekrar dene'));
    await t.pumpAndSettle();
    expect(find.text('Soru 1 / 2'), findsOneWidget);
    expect(s.kotaKullanilan, 1); // ikinci kullanım YOK
    final kimlikler = s.istekler.where((r) => r.url.path == '/api/soru/oturum').map((r) => RegExp(r'"istek":"([^"]+)"').firstMatch(r.body)!.group(1)).toSet();
    expect(kimlikler.length, 1);
  });

  testWidgets('hesap değişimi: u1 oturumu bitti, u2 girdi; u1\'in bekleyen cevabı u2\'ye yazılmaz (arayüz akışı)', (t) async {
    await buyukEkran(t);
    final s = SahteSunucu(), model = kurModel(s, BellekDeposu(SahteSunucu.anahtar));
    await model.baslat();
    await t.pumpWidget(AkeUygulamasi(model: model));
    await t.pumpAndSettle();
    await t.tap(find.text('TYT'));
    await t.pumpAndSettle();
    await t.tap(find.text('Matematik'));
    await t.pumpAndSettle();
    await t.tap(find.text('Sayılar'));
    await t.pumpAndSettle();
    s.ilerlemeHata500 = 99; // senkron başarısız: kayıt bekleyecek
    await t.tap(find.text('c'));
    await t.pump();
    await t.tap(find.text('Cevapla'));
    await t.pumpAndSettle();
    expect(model.senkron.bekleyenSayisi, 1);
    await model.cikis();
    s.ilerlemeHata500 = 0;
    s.hesapId = 'u2';
    await model.kodDogrula('baska@ornek.com', '12345678');
    await model.senkron.bosalt();
    await model.senkron.supur();
    expect(model.kullanici!.id, 'u2');
    expect(model.senkron.bekleyenSayisi, 0);
    expect(s.ilerlemeCagrilari.where((c) => c.$1 == 'u2'), isEmpty);
    expect(s.ilerlemeler['u2'], isNull);
  });
}
