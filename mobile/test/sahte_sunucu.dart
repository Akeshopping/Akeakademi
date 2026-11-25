import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Gerçek sunucu sözleşmesini (docs/soru-bankasi-api.md, functions/api/hesap) taklit eden bellek içi sunucu.
/// Çerez KULLANMAZ: kimlik yalnızca "Authorization: Bearer" ile gelir; yoksa 401.
class SahteSunucu {
  static const anahtar = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4';
  final List<http.Request> istekler = [];
  /// Hesaba göre sunucu tarafı ilerleme (stats.topic): hesap -> "ders|konu" -> [doğru, yanlış, boş]
  final Map<String, Map<String, List<int>>> ilerlemeler = {};
  String hesapId = 'u1'; // şu an giriş yapılan hesap (kod-dogrula bunu döner)
  final Map<String, String> oturumSahibi = {}; // oturum -> hesap
  final Map<String, List<(String soru, int secim)>> cevaplar = {};
  final Set<String> islendi = {}; // "hesap|oturum|soru": tekil işleme
  final Map<String, String> istekOturum = {}; // "hesap|istek" -> oturum
  final List<(String hesap, String oturum)> ilerlemeCagrilari = [];
  int kotaKullanilan = 0; // yeni (tekrar olmayan) oturum sayısı
  int yanitKaybi = 0; // ilk N /oturum isteği: sunucu işler, ama yanıt istemciye ulaşmaz
  bool oturumGecerli = true;
  bool soruServisiAcik = true;
  bool limitDoldu = false;
  bool agYok = false;
  String aciklama = 'Açıklama metni'; // cevaptan sonra dönen açıklama (uzun açıklama testi için değiştirilebilir)
  /// Emülatör ekran kanıtı için: doluysa /api/hesap/veri bunu 'alanlar' olarak döndürür (profil/istatistik/plan test verisi).
  Map<String, dynamic>? veriAlanlari;
  /// Doluysa /api/soru/ozet bunu döndürür (ders/konu listesi test verisi).
  Map<String, dynamic>? ozetOzel;
  int cevapSayisi = 0;
  // ---- hesap belgeleri (plan/profil): web ile aynı koşullu yazma sözleşmesi (_b = okunan sürüm, _h = hesap) ----
  final Map<String, Map<String, dynamic>> belgeler = {}; // alan -> belge (veriAlanlari yoksa)
  final Map<String, int> surumler = {};
  final List<Map<String, dynamic>> veriYazmalari = []; // gövde + '_alan' (hangi belge)
  int veriCakismasi = 0; // ilk N koşullu yazma 409 'eski' dönsün (araya başka yazma girmiş gibi)
  // ---- paket / AI ----
  bool paketli = false;
  int kalanDeneme = 3;
  bool aiKotaDoldu = false;
  final List<List<Map<String, dynamic>>> aiIstekleri = [];
  bool silindi = false;
  // ---- mağaza (sunucu sözleşmesi: lib/magaza.js). magazaGercek = "mağazanın gerçekten var dediği" işlem kimlikleri; sunucu yalnız bunları kabul eder.
  String magazaModu = 'sandbox'; // 'kapali' → 503
  final Set<String> magazaGercek = {};
  final List<Map<String, dynamic>> magazaDogrulamalari = []; // gelen her doğrulama isteği
  String? magazaHata; // doluysa her doğrulama bu hata koduyla reddedilir (örn. hesap_eslesmedi)
  int magazaAgHatasi = 0; // ilk N doğrulama isteğinde sunucu 502 magaza_ulasilamadi dönsün
  bool magazaPaketAcik = false;
  int _sur(String a) => surumler[a] ?? ((veriAlanlari?.containsKey(a) ?? false) ? 1 : 0);
  String? sonOturumGovdesi;
  // ---- odak odası ----
  final List<Map<String, dynamic>> odakIstekleri = []; // gelen her /odak isteği (hatalı denemeler dahil)
  final Set<String> odakTurlari = {};
  int odakFm = 0;
  bool odakHata = false;
  String? sonModu;
  final Map<String, List<(String soru, int secim)>> sinavCevaplari = {};
  int ilerlemeHata500 = 0; // ilk N /ilerleme isteği 500 dönsün
  final List<Map<String, dynamic>> sorular = [
    {'id': 'q1', 's': 'mat', 't': 'Sayılar', 'd': 1, 'q': 'Soru 1?', 'o': ['a', 'b', 'c', 'd', 'e']},
    {'id': 'q2', 's': 'mat', 't': 'Sayılar', 'd': 3, 'p': 'Paragraf', 'q': 'Soru 2?', 'o': ['a', 'b', 'c', 'd', 'e']},
  ];
  final Map<String, int> dogruSecenek = {'q1': 2, 'q2': 0}; // yalnızca sunucuda; istemciye cevaptan sonra gider
  late final MockClient istemci = MockClient(_isle);

  http.Response _y(int durum, Map<String, dynamic> govde, [Map<String, String>? ek]) =>
      http.Response(jsonEncode(govde), durum, headers: {'content-type': 'application/json; charset=utf-8', ...?ek});

  Future<http.Response> _isle(http.Request r) async {
    istekler.add(r);
    if (agYok) throw http.ClientException('ağ yok');
    final yol = r.url.path;
    if (r.headers.containsKey('cookie')) return _y(400, {'error': 'cerez_olmamali'});
    if (yol == '/api/hesap/kod-gonder') return _y(200, {'ok': true});
    if (yol == '/api/hesap/kod-dogrula') {
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      if (b['kod'] != '12345678') return _y(400, {'error': 'kod_yanlis', 'message': 'Kod hatalı ya da süresi dolmuş.'});
      return _y(200, {
        'kullanici': {'id': hesapId, 'eposta': b['eposta'], 'ad': ''},
        if (b['istemci'] == 'mobil') 'oturumAnahtari': anahtar,
      });
    }
    final yetkili = r.headers['authorization'] == 'Bearer $anahtar' && oturumGecerli;
    if (!yetkili) return _y(401, {'error': 'giris'});
    if (silindi) return _y(401, {'error': 'giris'});
    if (yol == '/api/hesap/ben') {
      return _y(200, {
        'kullanici': {'id': hesapId, 'eposta': 'ogrenci@ornek.com', 'ad': ''},
        'paket': paketli || magazaPaketAcik ? {'plan': 'premium', 'bitis': '2027-06-30'} : null,
        'kullanim': {'mesaj': aiIstekleri.length, 'guclu': 0},
        'limit': paketli ? {'mesaj': 500, 'guclu': 60} : null,
        'ucretsiz': paketli ? {'sinirsiz': true} : {'sinirsiz': false, 'kalanSoru': 12, 'kalanDeneme': kalanDeneme},
      });
    }
    if (yol == '/api/hesap/kod-bagla') {
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      if (b['kod'] != 'AKE-TEST-1234') return _y(400, {'error': 'kod_gecersiz'});
      paketli = true;
      return _y(200, {'paket': {'plan': 'premium', 'bitis': '2027-06-30'}});
    }
    if (yol.startsWith('/api/hesap/magaza')) {
      if (magazaModu == 'kapali') return _y(503, {'error': 'kapali', 'message': ''});
      if (yol == '/api/hesap/magaza' && r.method == 'GET') {
        return _y(200, {
          'mod': magazaModu,
          'urunler': [
            {'id': 'atilim_aylik', 'plan': 'orta', 'donem': 'ay'},
            {'id': 'atilim_yillik', 'plan': 'orta', 'donem': 'yil'},
            {'id': 'premium_aylik', 'plan': 'premium', 'donem': 'ay'},
            {'id': 'premium_yillik', 'plan': 'premium', 'donem': 'yil'},
          ],
          'hesapKimligi': {'google': 'g-$hesapId', 'apple': '00000000-0000-4000-8000-000000000001'},
          'islemler': magazaPaketAcik ? [{'platform': 'google', 'urun': 'premium_aylik', 'plan': 'premium', 'durum': 'aktif', 'bitis': '2027-06-30', 'erisim': true, 'test': true}] : [],
          'paket': magazaPaketAcik || paketli ? {'plan': 'premium', 'bitis': '2027-06-30'} : null,
        });
      }
      if (yol == '/api/hesap/magaza/dogrula' && r.method == 'POST') {
        final b = jsonDecode(r.body) as Map<String, dynamic>;
        magazaDogrulamalari.add(b);
        if (magazaAgHatasi > 0) {
          magazaAgHatasi--;
          return _y(502, {'sonuc': [{'ok': false, 'hata': 'magaza_ulasilamadi'}]});
        }
        if (magazaHata != null) return _y(409, {'sonuc': [{'ok': false, 'hata': magazaHata}]});
        if (!magazaGercek.contains(b['kimlik'])) return _y(404, {'sonuc': [{'ok': false, 'hata': 'islem_bulunamadi'}]});
        magazaPaketAcik = true; // yalnız sunucu mağazadan doğruladıktan sonra
        return _y(200, {'sonuc': [{'ok': true}], 'paket': {'plan': 'premium', 'bitis': '2027-06-30'}});
      }
      return _y(404, {'error': 'yok'});
    }
    if (yol == '/api/hesap/sil' && r.method == 'POST') {
      silindi = true;
      return _y(200, {'ok': true});
    }
    if (yol == '/api/ai' && r.method == 'POST') {
      if (!paketli) return _y(402, {'error': 'paket'});
      if (aiKotaDoldu) return _y(429, {'error': 'kota'});
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      aiIstekleri.add([for (final m in (b['messages'] as List)) Map<String, dynamic>.from(m as Map)]);
      return _y(200, {'text': 'SAHTE YANIT ${aiIstekleri.length}: önce yöntemi kur.', 'truncated': false, 'plan': 'premium'});
    }
    if (yol == '/api/hesap/cikis') return _y(200, {'ok': true});
    if (yol == '/api/hesap/veri' && r.method == 'GET') {
      if (veriAlanlari != null) return _y(200, {'alanlar': veriAlanlari, 'u': {for (final k in veriAlanlari!.keys) k: _sur(k)}, 'hesap': hesapId});
      final t = ilerlemeler[hesapId];
      return _y(200, {'alanlar': {if (t != null) 'stats': {'topic': t}, ...belgeler}, 'u': {...surumler}, 'hesap': hesapId});
    }
    if (yol.startsWith('/api/hesap/veri/') && r.method == 'PUT') {
      final alan = yol.substring('/api/hesap/veri/'.length);
      if (alan != 'plan' && alan != 'profile') return _y(500, {'error': 'mobil_veri_yazmamali'}); // uygulama yalnız plan ve profil yazar; stats sunucuda hesaplanır
      final g = jsonDecode(r.body) as Map<String, dynamic>;
      veriYazmalari.add({...g, '_alan': alan});
      if (g['_h'] != hesapId) return _y(409, {'error': 'hesap'});
      final b = g['_b'] as int?;
      if (b == null) return _y(400, {'error': '_b'});
      if (veriCakismasi > 0) {
        veriCakismasi--;
        surumler[alan] = _sur(alan) + 1; // araya başka yazma girdi
        return _y(409, {'error': 'eski', 'u': surumler[alan]});
      }
      if (_sur(alan) != b) return _y(409, {'error': 'eski', 'u': _sur(alan)});
      final belge = Map<String, dynamic>.from(g)..remove('_b')..remove('_h');
      belgeler[alan] = belge;
      veriAlanlari?[alan] = belge;
      surumler[alan] = b + 1;
      return _y(200, {'ok': true, 'u': b + 1});
    }
    if (yol.startsWith('/api/hesap/veri/')) return _y(500, {'error': 'mobil_veri_yazmamali'});
    if (yol.startsWith('/api/soru/')) {
      if (!soruServisiAcik) return _y(404, {'error': 'yok', 'message': ''});
      if (yol == '/api/soru/ozet') {
        if (ozetOzel != null) return _y(200, ozetOzel!);
        return _y(200, {
          'toplam': 40,
          'dersler': {
            'mat': {'toplam': 30, 'konular': {'Sayılar': {'toplam': 30, 'zorluk': {'1': 10, '2': 10, '3': 10}}}},
            'turkce': {'toplam': 10, 'konular': {'Paragraf': {'toplam': 10, 'zorluk': {'2': 10}}}},
          },
        });
      }
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      if (yol == '/api/soru/odak') {
        odakIstekleri.add(b);
        if (odakHata) return _y(503, {'error': 'gecici'});
        if (odakTurlari.add('${b['tur']}')) odakFm += 25; // aynı tur ikinci kez sayılmaz (sunucu gibi)
        return _y(200, {'fm': odakFm});
      }
      if (yol == '/api/soru/oturum') {
        sonOturumGovdesi = r.body;
        sonModu = '${b['mod']}';
        final anahtarIstek = '$hesapId|${b['istek']}';
        var oturum = istekOturum[anahtarIstek];
        if (oturum == null) {
          if (limitDoldu || (b['mod'] == 'exam' && !paketli && kalanDeneme < 1)) return _y(402, {'error': 'limit', 'message': 'Ücretsiz hakkın bitti.'});
          if (b['mod'] == 'exam' && !paketli) kalanDeneme--;
          kotaKullanilan++;
          oturum = 'o${kotaKullanilan.toString().padLeft(47, '0')}';
          istekOturum[anahtarIstek] = oturum;
          oturumSahibi[oturum] = hesapId;
        }
        if (yanitKaybi > 0) {
          yanitKaybi--;
          throw http.ClientException('yanıt kayboldu');
        }
        return _y(200, {'oturum': oturum, 'mod': '${b['mod']}', 'adet': sorular.length, 'sonaErme': 0, 'sorular': sorular, 'kota': {'tur': 'soru', 'limit': 30, 'kalan': 30 - kotaKullanilan}});
      }
      if (yol == '/api/soru/ilerleme') {
        if (ilerlemeHata500 > 0) {
          ilerlemeHata500--;
          return _y(500, {'error': 'sunucu'});
        }
        if (b.keys.any((k) => k != 'oturum' && k != 'tz')) return _y(400, {'error': 'bilinmeyen_alan'});
        final ids = b['oturum'] != null ? [b['oturum'] as String] : oturumSahibi.entries.where((e) => e.value == hesapId).map((e) => e.key).toList();
        for (final id in ids) {
          if (oturumSahibi[id] != hesapId) return _y(404, {'error': 'yok'});
          ilerlemeCagrilari.add((hesapId, id));
          for (final (soru, secim) in cevaplar[id] ?? const <(String, int)>[]) {
            if (!islendi.add('$hesapId|$id|$soru')) continue;
            final t = ilerlemeler.putIfAbsent(hesapId, () => {}).putIfAbsent('mat|Sayılar', () => [0, 0, 0]);
            t[secim == dogruSecenek[soru] ? 0 : 1]++;
          }
        }
        final bekleyen = oturumSahibi.entries.where((e) => e.value == hesapId && (cevaplar[e.key] ?? []).any((c) => !islendi.contains('$hesapId|${e.key}|${c.$1}'))).length;
        return _y(200, {'bekleyen': bekleyen});
      }
      if (yol == '/api/soru/cevap' && sonModu == 'exam') {
        cevapSayisi++;
        final l = sinavCevaplari.putIfAbsent(b['oturum'] as String, () => []);
        l.removeWhere((e) => e.$1 == b['soru']);
        l.add((b['soru'] as String, b['secim'] as int));
        return _y(200, {'kaydedildi': true}); // sınav: anahtar YOK
      }
      if (yol == '/api/soru/cevap') {
        cevapSayisi++;
        final dogru = dogruSecenek[b['soru']]!;
        (cevaplar[b['oturum'] as String] ??= []).add((b['soru'] as String, b['secim'] as int));
        return _y(200, {'dogru': b['secim'] == dogru, 'a': dogru, 'x': aciklama});
      }
      if (yol == '/api/soru/bitir' && sonModu == 'exam') {
        final l = sinavCevaplari[b['oturum'] as String] ?? [];
        var d = 0, y = 0;
        final satirlar = <Map<String, dynamic>>[];
        for (final q in sorular) {
          final c = l.where((e) => e.$1 == q['id']).toList();
          final a = dogruSecenek[q['id']]!;
          if (c.isEmpty) {
            satirlar.add({'id': q['id'], 'secim': null, 'a': a, 'x': aciklama, 'dogru': null});
          } else {
            final ok = c.first.$2 == a;
            ok ? d++ : y++;
            satirlar.add({'id': q['id'], 'secim': c.first.$2, 'a': a, 'x': aciklama, 'dogru': ok});
          }
        }
        return _y(200, {'oturum': b['oturum'], 'mod': 'exam', 'dogru': d, 'yanlis': y, 'bos': sorular.length - d - y, 'sorular': satirlar});
      }
      if (yol == '/api/soru/bitir') return _y(200, {'oturum': b['oturum'], 'mod': 'practice', 'dogru': 1, 'yanlis': 1, 'bos': 0, 'sorular': []});
    }
    return _y(404, {'error': 'yok'});
  }
}
