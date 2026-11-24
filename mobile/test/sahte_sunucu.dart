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
  int cevapSayisi = 0;
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
    if (yol == '/api/hesap/ben') return _y(200, {'kullanici': {'id': hesapId, 'eposta': 'ogrenci@ornek.com', 'ad': ''}});
    if (yol == '/api/hesap/cikis') return _y(200, {'ok': true});
    if (yol == '/api/hesap/veri' && r.method == 'GET') {
      final t = ilerlemeler[hesapId];
      return _y(200, {'alanlar': {if (t != null) 'stats': {'topic': t}}});
    }
    if (yol.startsWith('/api/hesap/veri/')) return _y(500, {'error': 'mobil_veri_yazmamali'}); // uygulama stats'a yazmaz
    if (yol.startsWith('/api/soru/')) {
      if (!soruServisiAcik) return _y(404, {'error': 'yok', 'message': ''});
      if (yol == '/api/soru/ozet') {
        return _y(200, {
          'toplam': 40,
          'dersler': {
            'mat': {'toplam': 30, 'konular': {'Sayılar': {'toplam': 30, 'zorluk': {'1': 10, '2': 10, '3': 10}}}},
            'turkce': {'toplam': 10, 'konular': {'Paragraf': {'toplam': 10, 'zorluk': {'2': 10}}}},
          },
        });
      }
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      if (yol == '/api/soru/oturum') {
        final anahtarIstek = '$hesapId|${b['istek']}';
        var oturum = istekOturum[anahtarIstek];
        if (oturum == null) {
          if (limitDoldu) return _y(402, {'error': 'limit', 'message': 'Ücretsiz hakkın bitti.'});
          kotaKullanilan++;
          oturum = 'o${kotaKullanilan.toString().padLeft(47, '0')}';
          istekOturum[anahtarIstek] = oturum;
          oturumSahibi[oturum] = hesapId;
        }
        if (yanitKaybi > 0) {
          yanitKaybi--;
          throw http.ClientException('yanıt kayboldu');
        }
        return _y(200, {'oturum': oturum, 'mod': 'practice', 'adet': sorular.length, 'sonaErme': 0, 'sorular': sorular, 'kota': {'tur': 'soru', 'limit': 30, 'kalan': 30 - kotaKullanilan}});
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
      if (yol == '/api/soru/cevap') {
        cevapSayisi++;
        final dogru = dogruSecenek[b['soru']]!;
        (cevaplar[b['oturum'] as String] ??= []).add((b['soru'] as String, b['secim'] as int));
        return _y(200, {'dogru': b['secim'] == dogru, 'a': dogru, 'x': aciklama});
      }
      if (yol == '/api/soru/bitir') return _y(200, {'oturum': b['oturum'], 'mod': 'practice', 'dogru': 1, 'yanlis': 1, 'bos': 0, 'sorular': []});
    }
    return _y(404, {'error': 'yok'});
  }
}
