import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Gerçek sunucu sözleşmesini (docs/soru-bankasi-api.md, functions/api/hesap) taklit eden bellek içi sunucu.
/// Çerez KULLANMAZ: kimlik yalnızca "Authorization: Bearer" ile gelir; yoksa 401.
class SahteSunucu {
  static const anahtar = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4';
  final List<http.Request> istekler = [];
  Map<String, dynamic>? stats;
  int statsU = 0;
  bool oturumGecerli = true;
  bool soruServisiAcik = true;
  bool limitDoldu = false;
  bool agYok = false;
  int cevapSayisi = 0;
  int zorla409 = 0; // ilk N stats yazması "eski" (409) dönsün
  int zorlaHata500 = 0; // ilk N stats yazması 500 dönsün
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
        'kullanici': {'id': 'u1', 'eposta': b['eposta'], 'ad': ''},
        if (b['istemci'] == 'mobil') 'oturumAnahtari': anahtar,
      });
    }
    final yetkili = r.headers['authorization'] == 'Bearer $anahtar' && oturumGecerli;
    if (!yetkili) return _y(401, {'error': 'giris'});
    if (yol == '/api/hesap/ben') return _y(200, {'kullanici': {'id': 'u1', 'eposta': 'ogrenci@ornek.com', 'ad': ''}});
    if (yol == '/api/hesap/cikis') return _y(200, {'ok': true});
    if (yol == '/api/hesap/veri' && r.method == 'GET') return _y(200, {'alanlar': {if (stats != null) 'stats': stats}});
    if (yol == '/api/hesap/veri/stats' && r.method == 'PUT') {
      if (zorlaHata500 > 0) {
        zorlaHata500--;
        return _y(500, {'error': 'sunucu'});
      }
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      final u = (b['_u'] as num).toInt();
      if (zorla409 > 0) {
        zorla409--;
        statsU += 5;
        return _y(409, {'error': 'eski', 'u': statsU});
      }
      if (u < statsU) return _y(409, {'error': 'eski', 'u': statsU});
      stats = b;
      statsU = u;
      return _y(200, {'ok': true});
    }
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
        if (limitDoldu) return _y(402, {'error': 'limit', 'message': 'Ücretsiz hakkın bitti.'});
        return _y(200, {'oturum': 'a' * 48, 'mod': 'practice', 'adet': sorular.length, 'sonaErme': 0, 'sorular': sorular, 'kota': {'tur': 'soru', 'limit': 30, 'kalan': 28}});
      }
      if (yol == '/api/soru/cevap') {
        cevapSayisi++;
        final dogru = dogruSecenek[b['soru']]!;
        return _y(200, {'dogru': b['secim'] == dogru, 'a': dogru, 'x': 'Açıklama metni'});
      }
      if (yol == '/api/soru/bitir') return _y(200, {'oturum': b['oturum'], 'mod': 'practice', 'dogru': 1, 'yanlis': 1, 'bos': 0, 'sorular': []});
    }
    return _y(404, {'error': 'yok'});
  }
}
