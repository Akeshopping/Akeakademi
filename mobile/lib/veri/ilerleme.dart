import 'package:flutter/foundation.dart';

import 'api.dart';

/// İlerleme SUNUCUDA hesaplanır: uygulama sayaç göndermez, yalnızca "şu oturumdaki cevaplarımı hesabıma işle" der
/// (POST /api/soru/ilerleme). Sunucu kendi kaydettiği cevaplardan, kimliğe bağlı, tekil ve atomik biçimde uygular; bu yüzden
/// tekrar denemeler çift saymaz ve web ile eşzamanlı yazma kayıp güncelleme üretmez. Burada yalnızca "hangi hesabın hangi oturumu
/// henüz işlenmedi" bilgisi tutulur ve her kayıt HESAP KİMLİĞİNE bağlıdır: başka hesapla yazılamaz.
class KonuIlerlemesi {
  final int dogru;
  final int yanlis;
  final int bos;
  const KonuIlerlemesi(this.dogru, this.yanlis, this.bos);
  int get toplam => dogru + yanlis + bos;
  int get cozulen => dogru + yanlis;
}

/// Hesaptan okunan stats'tan konu toplamları (arayüz "hesabındaki ilerleme"yi SUNUCUDAN okur, yerel belleğe güvenmez).
Map<String, KonuIlerlemesi> konuIlerlemeleri(Map<String, dynamic> stats) {
  final r = <String, KonuIlerlemesi>{};
  final topic = stats['topic'];
  if (topic is Map) {
    topic.forEach((k, v) {
      if (v is List && v.length >= 3) r['$k'] = KonuIlerlemesi((v[0] as num).toInt(), (v[1] as num).toInt(), (v[2] as num).toInt());
    });
  }
  return r;
}

enum SenkronDurumu { bos, kaydediliyor, bekliyor }

class _Bekleyen {
  final String hesapId;
  final String oturum;
  const _Bekleyen(this.hesapId, this.oturum);
  @override
  bool operator ==(Object o) => o is _Bekleyen && o.hesapId == hesapId && o.oturum == oturum;
  @override
  int get hashCode => Object.hash(hesapId, oturum);
}

class IlerlemeSenkron extends ChangeNotifier {
  final AkeApi api;
  final int Function() _tzDk;
  final List<_Bekleyen> _bekleyen = [];
  Future<void> _kuyruk = Future<void>.value();
  String? _aktifHesap;
  SenkronDurumu durum = SenkronDurumu.bos;
  ApiHata? sonHata;

  IlerlemeSenkron(this.api, {int Function()? tzDk}) : _tzDk = tzDk ?? (() => DateTime.now().timeZoneOffset.inMinutes);

  int get bekleyenSayisi => _bekleyen.length;

  /// Giriş yapılan hesap. Başka hesaba ait bekleyen kayıtlar BURADA silinir; hiçbir koşulda yeni hesaba yazılmaz.
  void hesapAyarla(String? id) {
    _aktifHesap = id;
    if (id != null) _bekleyen.removeWhere((b) => b.hesapId != id);
    _durumuGuncelle();
    notifyListeners();
  }

  /// Çıkış: bekleyen kayıtlar silinir (cevaplar sunucuda durur; aynı hesap tekrar girince süpürme bunları toparlar).
  void temizle() {
    _bekleyen.clear();
    _aktifHesap = null;
    sonHata = null;
    durum = SenkronDurumu.bos;
    notifyListeners();
  }

  /// Oturum süresi doldu: kayıtlar kendi hesap kimliğiyle kalır; yalnızca AYNI hesap tekrar girerse işlenir.
  void oturumBitti() {
    _aktifHesap = null;
    _durumuGuncelle();
    notifyListeners();
  }

  void _durumuGuncelle() => durum = _bekleyen.isEmpty ? SenkronDurumu.bos : SenkronDurumu.bekliyor;

  Future<void> ekle({required String hesapId, required String oturum}) {
    final b = _Bekleyen(hesapId, oturum);
    if (!_bekleyen.contains(b)) _bekleyen.add(b);
    return bosalt();
  }

  /// Bekleyenleri sırayla işler; biterse (ya da hata olursa) çözülür, hata atmaz (durum alanlarından okunur).
  Future<void> bosalt() {
    _kuyruk = _kuyruk.then((_) => _calistir());
    return _kuyruk;
  }

  Future<void> _calistir() async {
    final hesap = _aktifHesap;
    if (hesap == null) {
      _durumuGuncelle();
      notifyListeners();
      return;
    }
    final grup = _bekleyen.where((b) => b.hesapId == hesap).toList();
    if (grup.isEmpty) {
      _durumuGuncelle();
      notifyListeners();
      return;
    }
    durum = SenkronDurumu.kaydediliyor;
    notifyListeners();
    for (final b in grup) {
      try {
        await api.ilerlemeIsle(oturum: b.oturum, tzDk: _tzDk(), beklenenHesap: b.hesapId);
        _bekleyen.remove(b);
        sonHata = null;
      } on ApiHata catch (h) {
        if (h.kod == 'hesap_degisti') {
          if (api.hesapId == null) {
            // oturum bitti: kayıt kendi hesap kimliğiyle kalır, aynı hesap tekrar girince işlenir
            _durumuGuncelle();
            notifyListeners();
            return;
          }
          _bekleyen.remove(b); // başka hesaba geçildi: kayıt hiçbir yere yazılmaz
          continue;
        }
        sonHata = h;
        _durumuGuncelle();
        durum = SenkronDurumu.bekliyor;
        notifyListeners();
        return;
      }
    }
    _durumuGuncelle();
    notifyListeners();
  }

  /// Girişte/açılışta: sunucudaki bu hesabın işlenmemiş cevaplarını toparlar (uygulama cevaptan sonra kapanmış olabilir).
  Future<void> supur() {
    _kuyruk = _kuyruk.then((_) => _supur());
    return _kuyruk;
  }

  Future<void> _supur() async {
    final hesap = _aktifHesap;
    if (hesap == null) return;
    try {
      for (var i = 0; i < 5; i++) {
        final kalan = await api.ilerlemeIsle(tzDk: _tzDk(), beklenenHesap: hesap);
        if (kalan == 0) break;
      }
      sonHata = null;
    } on ApiHata catch (h) {
      if (h.kod != 'hesap_degisti') sonHata = h;
    }
  }

  /// Hesaptaki güncel konu ilerlemeleri (sunucudan).
  Future<Map<String, KonuIlerlemesi>> hesaptanOku() async {
    final alanlar = await api.veriOku();
    final stats = alanlar['stats'] is Map ? Map<String, dynamic>.from(alanlar['stats'] as Map) : <String, dynamic>{};
    return konuIlerlemeleri(stats);
  }
}
