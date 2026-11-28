import 'dart:convert';

import 'package:ake_akademi/durum/uygulama.dart';
import 'package:ake_akademi/ui/ai.dart';
import 'package:ake_akademi/ui/deneme.dart';
import 'package:ake_akademi/ui/tema.dart';
import 'package:ake_akademi/ui/kok.dart';
import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/ilerleme.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'sahte_magaza.dart';
import 'sahte_sunucu.dart';

UygulamaModeli model(SahteSunucu s, {DateTime Function()? saat}) {
  final api = AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: BellekDeposu(SahteSunucu.anahtar));
  return UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': 'kapali'}), saat: saat);
}

void ekran(WidgetTester t, double genislik, {double yukseklik = 900}) {
  t.view.physicalSize = Size(genislik, yukseklik);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);
}

Future<UygulamaModeli> ac(WidgetTester t, SahteSunucu s, {double genislik = 390, double yukseklik = 900, DateTime Function()? saat}) async {
  ekran(t, genislik, yukseklik: yukseklik);
  final m = model(s, saat: saat);
  await m.baslat();
  await t.pumpWidget(AkeUygulamasi(model: m));
  await t.pumpAndSettle();
  return m;
}

/// Zamanlayıcılı ekranlarda pumpAndSettle bitmez; kısa adımlarla ilerletilir.
Future<void> bekle(WidgetTester t, [int adim = 8]) async {
  for (var i = 0; i < adim; i++) {
    await t.pump(const Duration(milliseconds: 200));
  }
}

Future<void> sekme(WidgetTester t, int i) async {
  await t.tap(find.byKey(ValueKey('sekme-$i')));
  await t.pumpAndSettle();
}

Future<void> gorunurDokun(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

String tester_text(WidgetTester t, String anahtar) => t.widget<Text>(find.byKey(ValueKey(anahtar))).data ?? '';

void main() {
  group('gezinme (site bilgi mimarisi)', () {
    testWidgets('alt menü: Ana sayfa, Soru çöz, Deneme, AI, Menü; Gelişim/Plan/Ayarlar Menü içinden açılır', (t) async {
      final s = SahteSunucu();
      final m = await ac(t, s);
      for (final ad in ['Ana sayfa', 'Soru çöz', 'Deneme', 'AI', 'Menü']) {
        expect(find.text(ad), findsWidgets, reason: ad);
      }
      expect(find.text('Gelişim'), findsNothing, reason: 'Gelişim alt menüde değil');
      await sekme(t, 4);
      expect(find.byKey(const ValueKey('menu-gelisim')), findsOneWidget);
      expect(find.byKey(const ValueKey('menu-plan')), findsOneWidget);
      expect(find.byKey(const ValueKey('menu-ayarlar')), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('menu-plan')));
      await t.pumpAndSettle();
      expect(m.menuSayfasi, MenuSayfasi.plan);
      expect(find.byKey(const ValueKey('menu-geri')), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('menu-geri')));
      await t.pumpAndSettle();
      expect(m.menuSayfasi, isNull);
      expect(t.takeException(), isNull);
    });

    test('geri tuşu: önce menü alt sayfası, sonra Ana sayfa, sonra uygulamadan çıkış', () {
      final m = model(SahteSunucu());
      m.menuyeGit(MenuSayfasi.plan);
      expect(m.sekme, 4);
      expect(m.geriGit(), isTrue);
      expect(m.menuSayfasi, isNull);
      expect(m.sekme, 4);
      expect(m.geriGit(), isTrue);
      expect(m.sekme, 0);
      expect(m.geriGit(), isFalse);
    });
  });

  group('Soru Çözüm Merkezi', () {
    testWidgets('ücretsiz soru hakkı bitince Paketler ekranına geçilir, yarın devam seçeneği kalır', (t) async {
      final s = SahteSunucu()..limitDoldu = true;
      final m = await ac(t, s);
      await sekme(t, 1);
      await t.tap(find.byKey(const ValueKey('soru-sekme-2')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('paragraf-baslat')));
      await t.pumpAndSettle();
      expect(find.text('Ücretsiz hakkın bitti'), findsOneWidget);
      expect(find.text('Geri dön'), findsOneWidget);
      await t.tap(find.text('Paketleri gör'));
      await t.pumpAndSettle();
      expect(m.menuSayfasi, MenuSayfasi.paket);
    });
    testWidgets('Soru ara: kelime sunucuya `ara` olarak gider; Paragraf sekmesi konu filtresiyle başlar', (t) async {
      final s = SahteSunucu();
      await ac(t, s);
      await sekme(t, 1);
      await t.tap(find.byKey(const ValueKey('soru-sekme-1')));
      await t.pumpAndSettle();
      expect(t.widget<AkeDugme>(find.byKey(const ValueKey('ara-baslat'))).basinca, isNull, reason: 'kelime yokken pasif');
      await t.enterText(find.byKey(const ValueKey('ara-girdi')), '  asal   sayı ');
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('ara-baslat')));
      await t.pumpAndSettle();
      expect(s.sonModu, 'practice');
      expect(s.sonOturumGovdesi, contains('"ara":"asal sayı"'));
      expect(find.textContaining('araması'), findsWidgets);
    });

    testWidgets('Paragraf sekmesi: Türkçe/Paragraf konusuyla oturum açar', (t) async {
      final s = SahteSunucu();
      await ac(t, s);
      await sekme(t, 1);
      await t.tap(find.byKey(const ValueKey('soru-sekme-2')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('paragraf-baslat')));
      await t.pumpAndSettle();
      expect(s.sonOturumGovdesi, contains('"ders":"turkce"'));
      expect(s.sonOturumGovdesi, contains('"konu":"Paragraf"'));
    });
  });

  group('Deneme', () {
    testWidgets('süreli sınav: exam oturumu, cevaplar sunucuya yazılır ama anahtar bitene kadar görünmez; bitişte net ve çözümler gelir', (t) async {
      final s = SahteSunucu();
      await ac(t, s);
      await sekme(t, 2);
      expect(find.text('Denemeyi başlat'), findsOneWidget);
      expect(find.textContaining('3 deneme hakkın var'), findsOneWidget);
      await t.tap(find.text('Denemeyi başlat'));
      await bekle(t);
      expect(s.sonModu, 'exam');
      expect(find.byKey(const ValueKey('deneme-sure')), findsOneWidget);
      // soru 1: C (doğru, sunucuda gizli)
      await t.tap(find.byKey(const ValueKey('deneme-sik-2')));
      await bekle(t, 3);
      expect(s.sinavCevaplari.values.single.length, 1);
      expect(find.textContaining('Doğru cevap'), findsNothing, reason: 'sınavda anahtar bitene kadar gösterilmez');
      await t.tap(find.text('Sonraki'));
      await bekle(t, 3);
      await t.tap(find.byKey(const ValueKey('deneme-sik-1'))); // soru 2: B (yanlış; doğru A)
      await bekle(t, 3);
      expect(find.textContaining('Doğru cevap'), findsNothing);
      await t.tap(find.text('Bitir'));
      await bekle(t, 3);
      await t.tap(find.byKey(const ValueKey('deneme-bitir-onay')));
      await bekle(t, 8);
      expect(find.byKey(const ValueKey('deneme-net')), findsOneWidget);
      expect(find.text('0,75'), findsOneWidget, reason: '1 doğru, 1 yanlış → 1 − 1/4');
      expect(find.textContaining('1 doğru · 1 yanlış · 0 boş'), findsOneWidget);
      expect(find.textContaining('Doğru cevap'), findsWidgets, reason: 'bitişte anahtar gelir');
      expect(s.ilerlemeCagrilari.where((c) => c.$1 == 'u1').length, 1, reason: 'bitince deneme sonucu hesabın ilerlemesine işlenmek üzere sunucuya bildirildi (sayaç göndermeden)');
      expect(s.istekler.where((r) => r.url.path == '/api/soru/ilerleme').every((r) => !r.body.contains('"dogru"') && !r.body.contains('"net"')), isTrue, reason: 'istemci sayaç/net göndermez');
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('ücretsiz deneme hakkı bitince başlatma düğmesi pasif', (t) async {
      final s = SahteSunucu()..kalanDeneme = 0;
      final m = await ac(t, s);
      await sekme(t, 2);
      expect(find.textContaining('hakkın bitti'), findsWidgets);
      await t.tap(find.text('Denemeyi başlat'), warnIfMissed: false);
      await t.pumpAndSettle();
      expect(s.sonModu, isNull, reason: 'oturum hiç açılmadı');
      await gorunurDokun(t, find.byKey(const ValueKey('deneme-paketler')));
      expect(m.menuSayfasi, MenuSayfasi.paket);
      s.paketli = true; // satın alma başka ekranda doğrulandı
      m.sekmeGit(2);
      await t.pumpAndSettle();
      expect(find.textContaining('deneme sayısı sınırsız'), findsOneWidget);
      expect(t.widget<AkeDugme>(find.ancestor(of: find.text('Denemeyi başlat'), matching: find.byType(AkeDugme))).basinca, isNotNull);
    });

    testWidgets('paketli hesapta hak sınırsız görünür', (t) async {
      final s = SahteSunucu()..paketli = true;
      await ac(t, s);
      await sekme(t, 2);
      expect(find.textContaining('sınırsız'), findsOneWidget);
    });

    test('süre: 20 soru 28 dk (site 120 soru / 165 dk oranı)', () {
      expect(denemeSuresiDk(20), 28);
    });
  });

  group('AI öğretmen', () {
    testWidgets('ücretsiz öğrenci AI kapısından Paketler sayfasına gider', (t) async {
      final s = SahteSunucu()..magazaModu = 'kapali'; // ödeme kapalı önizleme: fayda özeti var, fiyat/satın alma düğmesi yok
      final m = await ac(t, s);
      await sekme(t, 3);
      expect(find.byKey(const ValueKey('ai-kapi')), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('ai-paketler')));
      await t.pumpAndSettle();
      expect(m.menuSayfasi, MenuSayfasi.paket);
      expect(find.text('Paket satın alma henüz açık değil'), findsOneWidget);
      expect(s.aiIstekleri, isEmpty);
      s.paketli = true; // mağaza doğrulaması sonrası sunucu hesabı paketli döner
      m.sekmeGit(3);
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('ai-girdi')), findsOneWidget, reason: 'AI sekmesi eski ücretsiz kapısında kalmaz');
    });
    testWidgets('paket yokken AI çağrılmaz; yanlış kod hata verir; doğru kodla sohbet açılır ve gerçek /api/ai çağrısı gider', (t) async {
      final s = SahteSunucu();
      await ac(t, s);
      await sekme(t, 3);
      expect(find.byKey(const ValueKey('ai-kapi')), findsOneWidget);
      expect(s.aiIstekleri, isEmpty);
      await t.enterText(find.byKey(const ValueKey('ai-kod')), 'YANLIS');
      await t.tap(find.text('Kodu bağla'));
      await t.pumpAndSettle();
      expect(find.textContaining('Kod hatalı'), findsOneWidget);
      expect(s.paketli, isFalse);
      await t.enterText(find.byKey(const ValueKey('ai-kod')), 'AKE-TEST-1234');
      await t.tap(find.text('Kodu bağla'));
      await t.pumpAndSettle();
      expect(s.paketli, isTrue);
      expect(find.byKey(const ValueKey('ai-girdi')), findsOneWidget);
      await t.enterText(find.byKey(const ValueKey('ai-girdi')), 'Asal sayı nedir?');
      await t.tap(find.byKey(const ValueKey('ai-gonder')));
      await t.pumpAndSettle();
      expect(find.textContaining('SAHTE YANIT 1'), findsOneWidget);
      expect(s.aiIstekleri.length, 1);
      expect(s.aiIstekleri[0].single['role'], 'user');
      expect((s.aiIstekleri[0].single['content'] as String).startsWith(aiRolMetni), isTrue);
      expect(s.aiIstekleri[0].single['content'], endsWith('Asal sayı nedir?'));
      // ikinci mesaj: geçmiş gider, rol metni yalnız ilk kullanıcı mesajında
      await t.enterText(find.byKey(const ValueKey('ai-girdi')), 'Peki 1 asal mı?');
      await t.tap(find.byKey(const ValueKey('ai-gonder')));
      await t.pumpAndSettle();
      final ikinci = s.aiIstekleri[1];
      expect(ikinci.map((m) => m['role']).toList(), ['user', 'assistant', 'user']);
      expect((ikinci[2]['content'] as String).contains('YKS öğretmenisin'), isFalse);
      expect(t.takeException(), isNull);
    });

    testWidgets('aylık hak dolunca sunucu 429 kota: kullanıcıya açık mesaj, çökme yok', (t) async {
      final s = SahteSunucu()..paketli = true;
      await ac(t, s);
      await sekme(t, 3);
      s.aiKotaDoldu = true;
      await t.enterText(find.byKey(const ValueKey('ai-girdi')), 'Merhaba');
      await t.tap(find.byKey(const ValueKey('ai-gonder')));
      await t.pumpAndSettle();
      expect(find.textContaining('AI mesaj hakkın doldu'), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });

  group('Plan', () {
    testWidgets('görev ekle, işaretle, sil: web ile aynı alanlar, koşullu yazma (_b/_h), stats\'a dokunulmaz; 409\'da yeniden okuyup dener', (t) async {
      final s = SahteSunucu();
      final m = await ac(t, s, yukseklik: 2200);
      m.menuyeGit(MenuSayfasi.plan);
      await t.pumpAndSettle();
      expect(find.textContaining('Henüz görevin yok'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('plan-ekle')));
      await t.pumpAndSettle();
      await t.enterText(find.byKey(const ValueKey('gorev-metin')), 'Paragraf: 25 soru');
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('gun-1')));
      await t.tap(find.text('Türkçe').last);
      await t.pumpAndSettle();
      await gorunurDokun(t, find.byKey(const ValueKey('gorev-kaydet')));
      expect(find.text('Paragraf: 25 soru'), findsOneWidget);
      var yaz = s.veriYazmalari.last;
      expect(yaz['_alan'], 'plan');
      expect(yaz['_b'], 0);
      expect(yaz['_h'], 'u1');
      final g = ((yaz['plan'] as Map)['tasks'] as List).single as Map;
      expect([g['text'], g['day'], g['s'], g['min'], g['done']], ['Paragraf: 25 soru', 1, 'turkce', 30, false]);
      expect((g['id'] as String).isNotEmpty, isTrue);
      // işaretle (araya başka yazma girmiş gibi ilk deneme 409)
      s.veriCakismasi = 1;
      await t.tap(find.text('Paragraf: 25 soru'));
      await t.pumpAndSettle();
      yaz = s.veriYazmalari.last;
      expect((((yaz['plan'] as Map)['tasks'] as List).single as Map)['done'], isTrue);
      expect(s.veriYazmalari.length, 3, reason: 'ekle + 409 + başarılı yeniden deneme');
      // sil
      await t.tap(find.byIcon(Icons.delete_outline_rounded));
      await t.pumpAndSettle();
      expect(((s.veriYazmalari.last['plan'] as Map)['tasks'] as List), isEmpty);
      expect(find.textContaining('Henüz görevin yok'), findsOneWidget);
      expect(s.veriYazmalari.every((y) => y['_alan'] == 'plan'), isTrue, reason: 'stats ve diğer alanlara yazılmadı');
      expect(t.takeException(), isNull);
    });

    testWidgets('mevcut plan belgesinin bilinmeyen alanları ve diğer görevler korunur; hafta sıfırlanır', (t) async {
      final s = SahteSunucu()
        ..veriAlanlari = {
          'plan': {
            '_u': 1,
            'plan': {
              'tasks': [
                {'id': 'a1', 'day': 0, 'text': 'Problemler', 's': 'mat', 'min': 45, 'done': true},
                {'id': 'a2', 'day': 2, 'text': 'Fizik tekrar', 's': 'fizik', 'min': 40, 'done': true},
              ],
              'baska': 'korunmali',
            },
          },
        };
      final m = await ac(t, s, yukseklik: 2200);
      m.menuyeGit(MenuSayfasi.plan);
      await t.pumpAndSettle();
      await gorunurDokun(t, find.text('Haftayı sıfırla'));
      await t.tap(find.byKey(const ValueKey('plan-onay')));
      await t.pumpAndSettle();
      final yaz = s.veriYazmalari.last;
      expect((yaz['plan'] as Map)['baska'], 'korunmali');
      expect(((yaz['plan'] as Map)['tasks'] as List).map((e) => (e as Map)['done']).toList(), [false, false]);
      expect(((yaz['plan'] as Map)['tasks'] as List).map((e) => (e as Map)['id']).toList(), ['a1', 'a2']);
      expect(yaz['_b'], 1);
    });
  });

  group('Plan · Odak odası (site Odak odası: başlat, duraklat, mola, süre)', () {
    DateTime simdi = DateTime(2026, 11, 25, 10, 0, 0);
    DateTime saat() => simdi;
    void ilerle(Duration d) => simdi = simdi.add(d);
    setUp(() => simdi = DateTime(2026, 11, 25, 10, 0, 0));

    Future<SahteSunucu> planAc(WidgetTester t, {bool hata = false}) async {
      final s = SahteSunucu()..odakHata = hata;
      final m = await ac(t, s, yukseklik: 2200, saat: saat);
      m.menuyeGit(MenuSayfasi.plan);
      await t.pumpAndSettle();
      return s;
    }

    String saatMetni(WidgetTester t) => tester_text(t, 'odak-saat');

    testWidgets('başlat → duraklat → devam et → bitince mola; mod çalışırken değişmez; bitişte tur hesaba yazılır', (t) async {
      final s = await planAc(t);
      expect(saatMetni(t), '25:00');
      expect(find.text('Başlat'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('odak-basla')));
      await t.pump();
      expect(find.byKey(const ValueKey('odak-duraklat')), findsOneWidget);
      ilerle(const Duration(minutes: 10));
      await t.pump(const Duration(seconds: 1));
      expect(saatMetni(t), '15:00');
      await t.tap(find.byKey(const ValueKey('odak-mod-mola')));
      await t.pump();
      expect(saatMetni(t), '15:00', reason: 'çalışırken mod değişmez');
      await t.tap(find.byKey(const ValueKey('odak-duraklat')));
      await t.pump();
      ilerle(const Duration(minutes: 5)); // duraklatılmışken süre akmaz
      await t.pump(const Duration(seconds: 1));
      expect(saatMetni(t), '15:00');
      expect(find.text('Devam et'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('odak-basla')));
      await t.pump();
      ilerle(const Duration(minutes: 15));
      await t.pump(const Duration(seconds: 1));
      await t.pump();
      expect(saatMetni(t), '05:00', reason: 'odak bitti → 5 dk mola hazır');
      expect(find.byKey(const ValueKey('odak-basla')), findsOneWidget, reason: 'mola kendiliğinden başlamaz');
      expect(s.odakIstekleri.length, 1);
      expect((s.odakIstekleri.single['tur'] as String).length, greaterThanOrEqualTo(16));
      expect(s.odakIstekleri.single['tz'], simdi.timeZoneOffset.inMinutes);
      await t.pumpAndSettle();
      expect(tester_text(t, 'odak-bugun'), startsWith('Bugün odaklı çalışma: 25 dk.'));
      expect(find.byKey(const ValueKey('odak-bekleyen')), findsNothing);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('mola 5 dk: bitince odağa döner ve hesaba odak yazılmaz; Sıfırla süreyi tam yapar', (t) async {
      final s = await planAc(t);
      await t.tap(find.byKey(const ValueKey('odak-mod-mola')));
      await t.pump();
      expect(saatMetni(t), '05:00');
      await t.tap(find.byKey(const ValueKey('odak-basla')));
      await t.pump();
      ilerle(const Duration(minutes: 2));
      await t.pump(const Duration(seconds: 1));
      expect(saatMetni(t), '03:00');
      await t.tap(find.byKey(const ValueKey('odak-sifirla')));
      await t.pump();
      expect(saatMetni(t), '05:00');
      expect(find.text('Başlat'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('odak-basla')));
      await t.pump();
      ilerle(const Duration(minutes: 5));
      await t.pump(const Duration(seconds: 1));
      await t.pump();
      expect(saatMetni(t), '25:00', reason: 'mola bitti → odak');
      expect(s.odakIstekleri, isEmpty, reason: 'mola odak dakikası değildir');
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('arka plana gidip dönünce süre gerçek saate göre doğru; süre arka planda dolduysa tur tamamlanmış olur', (t) async {
      final s = await planAc(t);
      await t.tap(find.byKey(const ValueKey('odak-basla')));
      await t.pump();
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      ilerle(const Duration(minutes: 12)); // arka planda zamanlayıcı çalışmaz; saat ilerler
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      expect(saatMetni(t), '13:00', reason: '25 − 12 dk');
      expect(s.odakIstekleri, isEmpty);
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      ilerle(const Duration(minutes: 40)); // süre arka planda doldu
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pump();
      await t.pump();
      expect(saatMetni(t), '05:00');
      expect(s.odakIstekleri.length, 1, reason: 'yalnız bir tur (site gibi)');
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('bağlantı yokken biten tur cihazda bekler, görünür; bağlantı gelince AYNI tur kimliğiyle yazılır ve çift sayılmaz', (t) async {
      final s = await planAc(t, hata: true);
      await t.tap(find.byKey(const ValueKey('odak-basla')));
      await t.pump();
      ilerle(const Duration(minutes: 25));
      await t.pump(const Duration(seconds: 1));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('odak-bekleyen')), findsOneWidget);
      expect(tester_text(t, 'odak-bugun'), startsWith('Bugün odaklı çalışma: 25 dk.'), reason: 'bekleyen tur da gösterilir');
      expect(s.odakIstekleri.length, 1);
      s.odakHata = false;
      t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('odak-bekleyen')), findsNothing);
      expect(s.odakIstekleri.length, 2);
      expect(s.odakIstekleri[0]['tur'], s.odakIstekleri[1]['tur'], reason: 'tekrar denemede aynı tur kimliği');
      expect(s.odakFm, 25, reason: 'sunucuda bir kez sayıldı');
      expect(tester_text(t, 'odak-bugun'), startsWith('Bugün odaklı çalışma: 25 dk.'));
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('Plan boş olsa da Odak odası görünür', (t) async {
      await planAc(t);
      expect(find.byKey(const ValueKey('odak-odasi')), findsOneWidget);
      expect(find.text('Odak odası'), findsOneWidget);
      await t.pumpWidget(const SizedBox());
    });
  });

  group('Ana sayfa · Bugünün programı (gerçek hesap verisi)', () {
    testWidgets('hedef, zayıf konu, bugünkü plan görevi ve mini deneme gelir; görev işaretlenir, Çöz konu oturumunu açar', (t) async {
      final simdi = DateTime.now();
      final gun = '${simdi.year}-${simdi.month.toString().padLeft(2, '0')}-${simdi.day.toString().padLeft(2, '0')}';
      final s = SahteSunucu()
        ..veriAlanlari = {
          'profile': {'_u': 1, 'profile': {'name': 'Test', 'alan': 'SAY', 'gunluk': 40}},
          'stats': {
            '_u': 1,
            'daily': {gun: {'q': 14, 'c': 9, 'tp': {'mat|Problemler': 4}}},
            'topic': {'mat|Problemler': [3, 7, 0], 'turkce|Paragraf': [8, 4, 0], 'fizik|Hareket': [9, 1, 0]},
          },
          'plan': {
            '_u': 1,
            'plan': {
              'tasks': [
                {'id': 'b1', 'day': simdi.weekday - 1, 'text': 'Hareket konu tekrarı', 's': 'fizik', 'min': 40, 'done': false},
                {'id': 'b2', 'day': (simdi.weekday) % 7, 'text': 'Başka günün görevi', 's': 'mat', 'min': 20, 'done': false},
              ],
            },
          },
        };
      await ac(t, s, yukseklik: 2200);
      expect(find.text('Bugünün programı'), findsOneWidget);
      expect(find.text('40 soru çöz'), findsOneWidget);
      expect(find.text('Bugün 14/40'), findsOneWidget);
      expect(find.text('Matematik: Problemler'), findsOneWidget);
      expect(find.text('10 soru, bugün 4/10'), findsOneWidget);
      expect(find.text('Türkçe: Paragraf'), findsOneWidget);
      expect(find.text('Mini deneme'), findsOneWidget, reason: 'hiç deneme yok → haftalık mini deneme önerilir');
      expect(find.text('SIRADAKİ'), findsOneWidget);
      expect(find.text('Hareket konu tekrarı'), findsOneWidget);
      expect(find.text('Başka günün görevi'), findsNothing, reason: 'yalnız bugünün görevleri');
      expect(find.text('Tekrar çözmeye değer'), findsOneWidget, reason: 'mevcut tekrar kartı korunur');
      await gorunurDokun(t, find.byKey(const ValueKey('ana-gorev-b1')));
      final yaz = s.veriYazmalari.last;
      expect(yaz['_alan'], 'plan');
      expect(((yaz['plan'] as Map)['tasks'] as List).first['done'], isTrue);
      expect(s.veriYazmalari.every((y) => y['_alan'] == 'plan'), isTrue);
    });

    testWidgets('Mini deneme "Başla": Deneme sekmesi ¼ uzunlukla açılır (site: sıradaki mini deneme)', (t) async {
      final s = SahteSunucu();
      final m = await ac(t, s, yukseklik: 2600);
      await gorunurDokun(t, find.text('Başla'));
      expect(m.sekme, 2);
      expect(tester_text(t, 'deneme-satir-mat'), '8', reason: 'Temel Matematik ¼ → Matematik 8');
      expect(tester_text(t, 'deneme-ozet'), '18 soru · 25 dk', reason: 'havuz: Türkçe 10 + Matematik 8');
      await t.pumpWidget(const SizedBox());
    });
  });

  group('Deneme · bölümlü oturum (site Deneme merkezi)', () {
    Map<String, dynamic> havuz(Map<String, int> d) => {
          'toplam': d.values.fold(0, (a, b) => a + b),
          'dersler': {for (final e in d.entries) e.key: {'toplam': e.value, 'konular': {'K': {'toplam': e.value, 'zorluk': {'2': e.value}}}}},
        };
    const tytHavuz = {'turkce': 40, 'tarih': 5, 'cografya': 5, 'felsefe': 5, 'din': 5, 'mat': 30, 'geo': 10, 'fizik': 7, 'kimya': 7, 'biyoloji': 6};
    String govdeAlan(SahteSunucu s, String k) => '${(jsonDecode(s.sonOturumGovdesi!) as Map<String, dynamic>)[k]}';

    testWidgets('TYT varsayılan: bölüm tablosu tam 120 soru/165 dk; Mini (¼) site ile aynı yuvarlamayla 31 soru/43 dk; oturum bolumler ile açılır', (t) async {
      final s = SahteSunucu()..ozetOzel = havuz(tytHavuz);
      await ac(t, s, yukseklik: 2600);
      await sekme(t, 2);
      expect(find.byKey(const ValueKey('deneme-tur-TYT')), findsOneWidget);
      expect(find.byKey(const ValueKey('deneme-tur-SAY')), findsOneWidget);
      expect(find.byKey(const ValueKey('deneme-tur-EA')), findsOneWidget);
      expect(find.byKey(const ValueKey('deneme-tur-SOZ')), findsOneWidget);
      expect(find.byKey(const ValueKey('deneme-tur-YDT')), findsOneWidget);
      expect(tester_text(t, 'deneme-tur-aciklama'), 'Temel Yeterlilik Testi · resmî oturum 120 soru, 165 dakika');
      expect(tester_text(t, 'deneme-satir-turkce'), '40');
      expect(tester_text(t, 'deneme-satir-mat'), '30');
      expect(tester_text(t, 'deneme-toplam'), '120');
      expect(tester_text(t, 'deneme-ozet'), '120 soru · 165 dk');
      await t.tap(find.byKey(const ValueKey('deneme-uzunluk-quarter')));
      await t.pumpAndSettle();
      expect(tester_text(t, 'deneme-satir-turkce'), '10');
      expect(tester_text(t, 'deneme-satir-tarih'), '1');
      expect(tester_text(t, 'deneme-satir-mat'), '8');
      expect(tester_text(t, 'deneme-satir-geo'), '3');
      expect(tester_text(t, 'deneme-satir-biyoloji'), '2');
      expect(tester_text(t, 'deneme-toplam'), '31');
      expect(tester_text(t, 'deneme-ozet'), '31 soru · 43 dk');
      await t.tap(find.text('Denemeyi başlat'));
      await bekle(t);
      expect(s.sonModu, 'exam');
      final g = jsonDecode(s.sonOturumGovdesi!) as Map<String, dynamic>;
      expect(g['adet'], 31);
      expect(g['tur'], 'TYT');
      expect(g['uzunluk'], 'quarter');
      expect(g.containsKey('ders'), isFalse, reason: 'bölümlü istekte tek ders alanı yok');
      final b = (g['bolumler'] as List).cast<Map<String, dynamic>>();
      expect(b.map((e) => e['ders']).toList(), ['turkce', 'tarih', 'cografya', 'felsefe', 'din', 'mat', 'geo', 'fizik', 'kimya', 'biyoloji']);
      expect(b.map((e) => e['bolum']).toSet().toList(), ['Türkçe', 'Sosyal Bilimler', 'Temel Matematik', 'Fen Bilimleri']);
      expect(b.fold<int>(0, (a, e) => a + (e['adet'] as int)), 31);
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('AYT Sayısal bölümleri ve Kendi dağılımım: satır −/+ ve süre ayarı toplamı, otomatik süreyi ve isteği değiştirir', (t) async {
      final s = SahteSunucu()..ozetOzel = havuz({...tytHavuz, 'amat': 30, 'afizik': 14, 'akimya': 13, 'abiyoloji': 13});
      await ac(t, s, yukseklik: 2600);
      await sekme(t, 2);
      await t.tap(find.byKey(const ValueKey('deneme-tur-SAY')));
      await t.pumpAndSettle();
      expect(tester_text(t, 'deneme-tur-aciklama'), 'Matematik ve Fen Bilimleri · resmî oturum 80 soru, 180 dakika');
      expect(tester_text(t, 'deneme-toplam'), '80');
      expect(tester_text(t, 'deneme-ozet'), '80 soru · 180 dk');
      await t.tap(find.byKey(const ValueKey('deneme-uzunluk-custom')));
      await t.pumpAndSettle();
      expect(tester_text(t, 'deneme-satir-amat-deger'), '8', reason: 'kendi dağılımım varsayılanı ¼ (30 → 8)');
      await t.tap(find.byKey(const ValueKey('deneme-satir-amat-arti')));
      await t.tap(find.byKey(const ValueKey('deneme-satir-afizik-eksi')));
      await t.pumpAndSettle();
      expect(tester_text(t, 'deneme-satir-amat-deger'), '9');
      final onceki = int.parse(tester_text(t, 'deneme-toplam'));
      expect(onceki, 21, reason: 'amat 9 (8+1), geo 3, fizik 3 (4−1), kimya 3, biyoloji 3');
      await t.tap(find.byKey(const ValueKey('deneme-sure-eksi')));
      await t.pumpAndSettle();
      expect(tester_text(t, 'deneme-sure-aciklama'), 'Kendi süren');
      await t.tap(find.text('Denemeyi başlat'));
      await bekle(t);
      final g = jsonDecode(s.sonOturumGovdesi!) as Map<String, dynamic>;
      expect(g['tur'], 'SAY');
      expect(g['uzunluk'], 'custom');
      expect(g['adet'], (g['bolumler'] as List).fold<int>(0, (a, e) => a + ((e as Map)['adet'] as int)));
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('havuzda yetmeyen ders için uyarı çıkar ve sunucuya havuzdan fazla istenmez', (t) async {
      final s = SahteSunucu()..ozetOzel = havuz({'turkce': 10, 'mat': 30});
      await ac(t, s, yukseklik: 2600);
      await sekme(t, 2);
      expect(find.byKey(const ValueKey('deneme-havuz-uyari')), findsOneWidget);
      expect(tester_text(t, 'deneme-ozet'), startsWith('40 soru'));
      await t.tap(find.text('Denemeyi başlat'));
      await bekle(t);
      final b = ((jsonDecode(s.sonOturumGovdesi!) as Map<String, dynamic>)['bolumler'] as List).cast<Map<String, dynamic>>();
      expect(b.map((e) => [e['ders'], e['adet']]).toList(), [['turkce', 10], ['mat', 30]], reason: 'havuzu olmayan dersler gönderilmez, fazlası kırpılır');
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('sonuç: bölümlü denemede "Ders ders" tablosu bölüm netlerini gösterir', (t) async {
      final s = SahteSunucu()..ozetOzel = havuz({'turkce': 40, 'mat': 30});
      s.sorular
        ..clear()
        ..addAll([
          {'id': 'q1', 's': 'turkce', 't': 'Paragraf', 'd': 1, 'q': 'Soru 1?', 'o': ['a', 'b', 'c', 'd', 'e']},
          {'id': 'q2', 's': 'mat', 't': 'Sayılar', 'd': 3, 'q': 'Soru 2?', 'o': ['a', 'b', 'c', 'd', 'e']},
        ]);
      s.dogruSecenek..clear()..addAll({'q1': 2, 'q2': 0});
      await ac(t, s, yukseklik: 2600);
      await sekme(t, 2);
      await t.tap(find.text('Denemeyi başlat'));
      await bekle(t);
      await t.tap(find.byKey(const ValueKey('deneme-sik-2'))); // q1 doğru
      await bekle(t, 3);
      await t.tap(find.text('Sonraki'));
      await bekle(t, 3);
      await t.tap(find.byKey(const ValueKey('deneme-sik-1'))); // q2 yanlış
      await bekle(t, 3);
      await t.tap(find.text('Bitir'));
      await bekle(t, 3);
      await t.tap(find.byKey(const ValueKey('deneme-bitir-onay')));
      await bekle(t, 8);
      expect(find.byKey(const ValueKey('deneme-ders-ders')), findsOneWidget);
      expect(tester_text(t, 'deneme-bolum-net-Türkçe'), '1,00');
      expect(tester_text(t, 'deneme-bolum-net-Temel Matematik'), '-0,25');
      expect(tester_text(t, 'deneme-net'), '0,75');
      await t.pumpWidget(const SizedBox());
    });

    testWidgets('Serbest: eski tek ders / karışık akış korunur (ders alanıyla, bolumler olmadan)', (t) async {
      final s = SahteSunucu();
      await ac(t, s, yukseklik: 2600);
      await sekme(t, 2);
      await t.tap(find.byKey(const ValueKey('deneme-tur-serbest')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('deneme-ders-mat')));
      await t.pumpAndSettle();
      expect(tester_text(t, 'deneme-ozet'), '20 soru · 28 dk');
      await t.tap(find.text('Denemeyi başlat'));
      await bekle(t);
      expect(govdeAlan(s, 'ders'), 'mat');
      expect(govdeAlan(s, 'bolumler'), 'null');
      await t.pumpWidget(const SizedBox());
    });
  });

  group('Gelişim · deneme geçmişi', () {
    testWidgets('exams belgesindeki web ve mobil denemeler en yeni üstte listelenir; yalnız deneme olsa da boş durum görünmez', (t) async {
      final s = SahteSunucu()
        ..veriAlanlari = {
          'exams': {
            'exams': [
              {'id': 'w1', 'kind': 'exam', 'title': 'TYT denemesi', 'date': 1000, 'd': 80, 'y': 20, 'b': 20, 'net': 75},
              {'id': 'm:abc', 'kind': 'exam', 'src': 'mobil', 'title': 'Mobil deneme', 'date': 2000, 'd': 1, 'y': 1, 'b': 2, 'net': 0.75},
              {'id': 'x', 'kind': 'practice', 'net': 1},
            ],
          },
        };
      final m = await ac(t, s);
      m.menuyeGit(MenuSayfasi.gelisim);
      await t.pumpAndSettle();
      expect(find.text('Henüz ilerleme yok'), findsNothing);
      expect(find.byKey(const ValueKey('deneme-gecmisi')), findsOneWidget);
      expect(find.text('2 deneme'), findsOneWidget, reason: 'kind=exam olmayan kayıt sayılmaz');
      expect(find.byKey(const ValueKey('deneme-net-m:abc')), findsOneWidget);
      expect(tester_text(t, 'deneme-net-m:abc'), '0,75');
      expect(tester_text(t, 'deneme-net-w1'), '75');
      expect(t.takeException(), isNull);
    });
  });

  group('Ayarlar ve hesap', () {
    testWidgets('profil ve hedef sunucuya yazılır; bilinmeyen profil alanları korunur', (t) async {
      final s = SahteSunucu()
        ..veriAlanlari = {
          'profile': {'_u': 1, 'profile': {'name': 'Ali', 'alan': 'EA', 'gunluk': 40, 'examDate': '2027-06-19', 'ozel': 'x'}},
        };
      final m = await ac(t, s, yukseklik: 2600);
      m.menuyeGit(MenuSayfasi.ayarlar);
      await t.pumpAndSettle();
      await t.enterText(find.byKey(const ValueKey('profil-ad')), 'Ayşe');
      await t.tap(find.byKey(const ValueKey('alan-SAY')));
      await t.tap(find.byKey(const ValueKey('hedef-60')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('profil-kaydet')));
      await t.pumpAndSettle();
      final yaz = s.veriYazmalari.last;
      expect(yaz['_alan'], 'profile');
      final pr = yaz['profile'] as Map;
      expect([pr['name'], pr['alan'], pr['gunluk'], pr['examDate'], pr['ozel']], ['Ayşe', 'SAY', 60, '2027-06-19', 'x']);
      expect(yaz['_b'], 1);
      expect(find.textContaining('Kaydedildi'), findsOneWidget);
    });

    testWidgets('hesap silme: "SİL" yazılmadan istek gitmez; yazınca sunucuda silinir ve giriş ekranına dönülür', (t) async {
      final s = SahteSunucu();
      final m = await ac(t, s, yukseklik: 2600);
      m.menuyeGit(MenuSayfasi.ayarlar);
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('hesap-sil')));
      await t.pumpAndSettle();
      expect(find.text('Hesabın silinsin mi?'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('sil-onay')), warnIfMissed: false);
      await t.pumpAndSettle();
      expect(s.silindi, isFalse, reason: 'onay yazılmadan silme isteği gitmemeli');
      expect(s.istekler.where((r) => r.url.path == '/api/hesap/sil'), isEmpty);
      await t.enterText(find.byKey(const ValueKey('sil-yaz')), 'sil');
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('sil-onay')));
      await t.pumpAndSettle();
      expect(s.silindi, isTrue);
      expect(s.istekler.where((r) => r.url.path == '/api/hesap/sil').length, 1);
      expect(m.faz, Faz.giris);
      expect(m.kullanici, isNull);
      expect(t.takeException(), isNull);
    });

    testWidgets('hesap silme vazgeçilirse hiçbir şey olmaz', (t) async {
      final s = SahteSunucu();
      final m = await ac(t, s, yukseklik: 2600);
      m.menuyeGit(MenuSayfasi.ayarlar);
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('hesap-sil')));
      await t.pumpAndSettle();
      await t.tap(find.text('Vazgeç'));
      await t.pumpAndSettle();
      expect(s.silindi, isFalse);
      expect(m.faz, Faz.ana);
    });
  });

  group('320 px', () {
    for (final genislik in [320.0, 390.0]) {
      testWidgets('Deneme, AI, Menü, Plan(görevli), Ayarlar taşmadan çizilir (${genislik.toInt()})', (t) async {
        final s = SahteSunucu()
          ..veriAlanlari = {
            'plan': {
              '_u': 1,
              'plan': {
                'tasks': [
                  {'id': 'a1', 'day': 0, 'text': 'Çok uzun bir görev adı: Paragraf ve problemler karışık 30 soru çöz ve yanlışlarını yaz', 's': 'mat', 'min': 45, 'done': false},
                ],
              },
            },
            'profile': {'_u': 1, 'profile': {'name': 'Ali Kaan', 'alan': 'SAY', 'gunluk': 40, 'examDate': '2027-06-19'}},
          };
        final m = await ac(t, s, genislik: genislik, yukseklik: 700);
        for (final i in [2, 3, 4]) {
          await sekme(t, i);
          expect(t.takeException(), isNull, reason: 'sekme $i');
        }
        s.paketli = true;
        m.magaza = SahteMagaza();
        await sekme(t, 0);
        await sekme(t, 3);
        expect(t.takeException(), isNull);
        for (final p in MenuSayfasi.values) {
          m.menuyeGit(p);
          await t.pumpAndSettle();
          expect(t.takeException(), isNull, reason: '$p');
        }
      });
    }
  });
}
