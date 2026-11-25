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

import 'sahte_sunucu.dart';

UygulamaModeli model(SahteSunucu s) {
  final api = AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: BellekDeposu(SahteSunucu.anahtar));
  return UygulamaModeli(api, IlerlemeSenkron(api), ayar: BellekAyar({'acilis': '1'}));
}

void ekran(WidgetTester t, double genislik, {double yukseklik = 900}) {
  t.view.physicalSize = Size(genislik, yukseklik);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);
}

Future<UygulamaModeli> ac(WidgetTester t, SahteSunucu s, {double genislik = 390, double yukseklik = 900}) async {
  ekran(t, genislik, yukseklik: yukseklik);
  final m = model(s);
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
      await ac(t, s);
      await sekme(t, 2);
      expect(find.textContaining('hakkın bitti'), findsWidgets);
      await t.tap(find.text('Denemeyi başlat'), warnIfMissed: false);
      await t.pumpAndSettle();
      expect(s.sonModu, isNull, reason: 'oturum hiç açılmadı');
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
      final m = await ac(t, s);
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
      final g = (yaz['tasks'] as List).single as Map;
      expect([g['text'], g['day'], g['s'], g['min'], g['done']], ['Paragraf: 25 soru', 1, 'turkce', 30, false]);
      expect((g['id'] as String).isNotEmpty, isTrue);
      // işaretle (araya başka yazma girmiş gibi ilk deneme 409)
      s.veriCakismasi = 1;
      await t.tap(find.text('Paragraf: 25 soru'));
      await t.pumpAndSettle();
      yaz = s.veriYazmalari.last;
      expect(((yaz['tasks'] as List).single as Map)['done'], isTrue);
      expect(s.veriYazmalari.length, 3, reason: 'ekle + 409 + başarılı yeniden deneme');
      // sil
      await t.tap(find.byIcon(Icons.delete_outline_rounded));
      await t.pumpAndSettle();
      expect((s.veriYazmalari.last['tasks'] as List), isEmpty);
      expect(find.textContaining('Henüz görevin yok'), findsOneWidget);
      expect(s.veriYazmalari.every((y) => y['_alan'] == 'plan'), isTrue, reason: 'stats ve diğer alanlara yazılmadı');
      expect(t.takeException(), isNull);
    });

    testWidgets('mevcut plan belgesinin bilinmeyen alanları ve diğer görevler korunur; hafta sıfırlanır', (t) async {
      final s = SahteSunucu()
        ..veriAlanlari = {
          'plan': {
            'tasks': [
              {'id': 'a1', 'day': 0, 'text': 'Problemler', 's': 'mat', 'min': 45, 'done': true},
              {'id': 'a2', 'day': 2, 'text': 'Fizik tekrar', 's': 'fizik', 'min': 40, 'done': true},
            ],
            'baska': 'korunmali',
          },
        };
      final m = await ac(t, s);
      m.menuyeGit(MenuSayfasi.plan);
      await t.pumpAndSettle();
      await gorunurDokun(t, find.text('Haftayı sıfırla'));
      await t.tap(find.byKey(const ValueKey('plan-onay')));
      await t.pumpAndSettle();
      final yaz = s.veriYazmalari.last;
      expect(yaz['baska'], 'korunmali');
      expect((yaz['tasks'] as List).map((e) => (e as Map)['done']).toList(), [false, false]);
      expect((yaz['tasks'] as List).map((e) => (e as Map)['id']).toList(), ['a1', 'a2']);
      expect(yaz['_b'], 1);
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
          'profile': {'name': 'Ali', 'alan': 'EA', 'gunluk': 40, 'examDate': '2027-06-19', 'ozel': 'x'},
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
      expect([yaz['name'], yaz['alan'], yaz['gunluk'], yaz['examDate'], yaz['ozel']], ['Ayşe', 'SAY', 60, '2027-06-19', 'x']);
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
              'tasks': [
                {'id': 'a1', 'day': 0, 'text': 'Çok uzun bir görev adı: Paragraf ve problemler karışık 30 soru çöz ve yanlışlarını yaz', 's': 'mat', 'min': 45, 'done': false},
              ],
            },
            'profile': {'name': 'Ali Kaan', 'alan': 'SAY', 'gunluk': 40, 'examDate': '2027-06-19'},
          };
        final m = await ac(t, s, genislik: genislik, yukseklik: 700);
        for (final i in [2, 3, 4]) {
          await sekme(t, i);
          expect(t.takeException(), isNull, reason: 'sekme $i');
        }
        s.paketli = true;
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
