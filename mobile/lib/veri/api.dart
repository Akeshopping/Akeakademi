import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'modeller.dart';
import 'oturum_deposu.dart';

/// Hata türleri ekranlarda ayrı durumlara bağlanır.
enum HataTuru {
  ag, // bağlantı yok / zaman aşımı
  oturum, // 401: oturum yok ya da süresi doldu
  limit, // 402: ücretsiz hak bitti
  kapali, // 404: sunucuda soru servisi henüz açık değil
  cokIstek, // 429
  cakisma, // 409
  sureDoldu, // 410
  gecersiz, // 400
  sunucu, // 5xx ve diğerleri
}

class ApiHata implements Exception {
  final HataTuru tur;
  final int durum;
  final String kod;
  final String mesaj;
  final int? beklemeSn;
  final Map<String, dynamic> govde;
  const ApiHata(this.tur, {this.durum = 0, this.kod = '', this.mesaj = '', this.beklemeSn, this.govde = const {}});
  @override
  String toString() => 'ApiHata($tur, $durum, $kod)';
}

/// AKE sunucusuyla konuşan tek katman. Kimlik: "Authorization: Bearer <oturum anahtarı>". Çerez, CSRF üstbilgisi ya da sahte Origin KULLANILMAZ.
class AkeApi {
  final String taban;
  final http.Client _c;
  final OturumDeposu _depo;
  String? _anahtar;
  String? _hesapId;

  /// Şu an oturumu açık hesabın kimliği (giriş ya da /ben ile öğrenilir; çıkış ve 401'de silinir).
  String? get hesapId => _hesapId;

  /// 401 alındığında (anahtar silindikten sonra) bir kez çağrılır.
  void Function()? oturumBittiDinleyici;

  /// [taban] ZORUNLU: varsayılan adres yoktur; test derlemesi yanlışlıkla Production'a bağlanamaz (bkz. Yapilandirma).
  AkeApi({required String taban, required http.Client istemci, required OturumDeposu depo})
      : taban = taban.replaceAll(RegExp(r'/+$'), ''),
        _c = istemci,
        _depo = depo;

  bool get girisli => _anahtar != null;

  Future<bool> anahtariYukle() async {
    _anahtar = await _depo.oku();
    return girisli;
  }

  Future<Map<String, dynamic>> _istek(String yontem, String yol,
      {Map<String, dynamic>? govde, bool kimlikli = true, String? beklenenHesap}) async {
    /// Bir kayıt belirli bir hesap için hazırlandıysa, gönderim anında oturum başka hesaba geçmişse AĞA HİÇ ÇIKMADAN reddedilir
    /// (kontrol ile gönderim arasında await yok; hesap değişimi araya giremez).
    if (beklenenHesap != null && beklenenHesap != _hesapId) {
      throw const ApiHata(HataTuru.oturum, kod: 'hesap_degisti', mesaj: 'Oturum başka bir hesaba geçti.');
    }
    final uri = Uri.parse('$taban$yol');
    final basliklar = <String, String>{'accept': 'application/json'};
    if (govde != null) basliklar['content-type'] = 'application/json';
    final gonderilenAnahtar = _anahtar;
    if (kimlikli) {
      if (gonderilenAnahtar == null) {
        throw const ApiHata(HataTuru.oturum, durum: 401, kod: 'oturum', mesaj: 'Giriş gerekli.');
      }
      basliklar['authorization'] = 'Bearer $gonderilenAnahtar';
    }
    http.Response r;
    try {
      final Future<http.Response> f;
      if (yontem == 'GET') {
        f = _c.get(uri, headers: basliklar);
      } else if (yontem == 'PUT') {
        f = _c.put(uri, headers: basliklar, body: jsonEncode(govde ?? const {}));
      } else {
        f = _c.post(uri, headers: basliklar, body: jsonEncode(govde ?? const {}));
      }
      r = await f.timeout(const Duration(seconds: 20));
    } catch (_) {
      throw const ApiHata(HataTuru.ag, mesaj: 'Sunucuya ulaşılamadı.');
    }
    Map<String, dynamic> m = const {};
    try {
      final d = jsonDecode(utf8.decode(r.bodyBytes));
      if (d is Map) m = Map<String, dynamic>.from(d);
    } catch (_) {}
    if (r.statusCode >= 200 && r.statusCode < 300) return m;
    final h = _hata(r.statusCode, m, r.headers);
    if (h.tur == HataTuru.oturum && kimlikli && gonderilenAnahtar != null && _anahtar == gonderilenAnahtar) {
      _anahtar = null;
      _hesapId = null;
      await _depo.sil();
      oturumBittiDinleyici?.call();
    }
    throw h;
  }

  ApiHata _hata(int durum, Map<String, dynamic> m, Map<String, String> basliklar) {
    final kod = '${m['error'] ?? ''}', mesaj = '${m['message'] ?? ''}';
    final bekle = int.tryParse(basliklar['retry-after'] ?? '');
    HataTuru t;
    if (durum == 401) {
      t = HataTuru.oturum;
    } else if (durum == 402) {
      t = HataTuru.limit;
    } else if (durum == 404 && kod == 'yok') {
      t = HataTuru.kapali;
    } else if (durum == 429) {
      t = HataTuru.cokIstek;
    } else if (durum == 409) {
      t = HataTuru.cakisma;
    } else if (durum == 410) {
      t = HataTuru.sureDoldu;
    } else if (durum >= 400 && durum < 500) {
      t = HataTuru.gecersiz;
    } else {
      t = HataTuru.sunucu;
    }
    return ApiHata(t, durum: durum, kod: kod, mesaj: mesaj, beklemeSn: bekle, govde: m);
  }

  // ---------- hesap ----------
  Future<void> kodGonder(String eposta) async {
    await _istek('POST', '/api/hesap/kod-gonder', govde: {'eposta': eposta}, kimlikli: false);
  }

  /// Kod doğruysa sunucu oturum anahtarını döner (yalnızca istemci:"mobil" istenirse); anahtar güvenli depoya yazılır.
  Future<Kullanici> kodDogrula(String eposta, String kod) async {
    final y = await _istek('POST', '/api/hesap/kod-dogrula',
        govde: {'eposta': eposta, 'kod': kod, 'istemci': 'mobil'}, kimlikli: false);
    final anahtar = y['oturumAnahtari'];
    if (anahtar is! String || anahtar.length < 40) {
      throw const ApiHata(HataTuru.sunucu, mesaj: 'Sunucu oturum anahtarı vermedi.');
    }
    await _depo.yaz(anahtar);
    _anahtar = anahtar;
    final k = Kullanici.fromJson(Map<String, dynamic>.from(y['kullanici'] as Map));
    _hesapId = k.id;
    return k;
  }

  Future<Kullanici> ben() async {
    final y = await _istek('GET', '/api/hesap/ben');
    final k = Kullanici.fromJson(Map<String, dynamic>.from(y['kullanici'] as Map));
    _hesapId = k.id;
    return k;
  }

  Future<void> cikis() async {
    try {
      if (_anahtar != null) await _istek('POST', '/api/hesap/cikis', govde: const {});
    } on ApiHata {
      // sunucuya ulaşılamasa da yerel oturum silinir
    }
    _anahtar = null;
    _hesapId = null;
    await _depo.sil();
  }

  // ---------- soru bankası (sunucu tarafı oturum; cevap anahtarı yalnızca cevaptan sonra gelir) ----------
  Future<Ozet> ozet() async => Ozet.fromJson(await _istek('GET', '/api/soru/ozet'));

  Future<OturumYaniti> oturumOlustur({required String istek, required int adet, String? ders, String? konu, int? zorluk}) async {
    final g = <String, dynamic>{'istek': istek, 'mod': 'practice', 'adet': adet};
    if (ders != null) g['ders'] = ders;
    if (konu != null) g['konu'] = konu;
    if (zorluk != null) g['zorluk'] = zorluk; // 1 kolay · 2 orta · 3 zor; yoksa karışık
    return OturumYaniti.fromJson(await _istek('POST', '/api/soru/oturum', govde: g));
  }

  Future<CevapSonucu> cevapVer({required String oturum, required String soru, required int secim}) async =>
      CevapSonucu.fromJson(await _istek('POST', '/api/soru/cevap', govde: {'oturum': oturum, 'soru': soru, 'secim': secim}));

  Future<OturumSonucu> bitir(String oturum) async =>
      OturumSonucu.fromJson(await _istek('POST', '/api/soru/bitir', govde: {'oturum': oturum}));

  // ---------- ilerleme ----------
  /// Hesap verisi (salt okuma): web ile aynı alanlar. İstemci bu belgeye YAZMAZ.
  Future<Map<String, dynamic>> veriOku() async {
    final y = await _istek('GET', '/api/hesap/veri');
    return y['alanlar'] is Map ? Map<String, dynamic>.from(y['alanlar'] as Map) : <String, dynamic>{};
  }

  /// Sunucuya "cevaplarımı hesabıma işle" der. [oturum] verilmezse yalnız BU hesabın bekleyen oturumları işlenir (süpürme).
  /// Dönen sayı: hâlâ işlenmemiş oturum sayısı. İstemci hiçbir sayaç göndermez; sunucu kendi kayıtlarından uygular (tekil, atomik).
  Future<int> ilerlemeIsle({String? oturum, required int tzDk, String? beklenenHesap}) async {
    final g = <String, dynamic>{'tz': tzDk};
    if (oturum != null) g['oturum'] = oturum;
    final y = await _istek('POST', '/api/soru/ilerleme', govde: g, beklenenHesap: beklenenHesap);
    return (y['bekleyen'] as num?)?.toInt() ?? 0;
  }
}
