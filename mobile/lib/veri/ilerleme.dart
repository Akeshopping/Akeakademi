import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'api.dart';

/// Web sitesindeki record() ile AYNI biçimde, hesabın "stats" alanına yazılan sayaçlar:
///   topic["ders|konu"] = [doğru, yanlış, boş]      daily["YYYY-AA-GG"] = {q, c, tp}
///   tr["ders|konu"]    = son 12 sonucun dizgisi    td["ders|konu"]     = [[d,y],[d,y],[d,y]] (zorluk 1-3)
/// Mobil yalnızca bu dört sayacı günceller; web'in kendi hesapladığı (ans, para, badges, XP, yanlışlar defteri) alanlara DOKUNMAZ ve olduğu gibi korur.
class IlerlemeKaydi {
  final String ders;
  final String konu;
  final int zorluk;
  /// 1 doğru, 0 yanlış, -1 boş
  final int sonuc;
  final DateTime zaman;
  const IlerlemeKaydi({required this.ders, required this.konu, required this.zorluk, required this.sonuc, required this.zaman});
  String get anahtar => '$ders|$konu';
}

String gunAnahtari(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Map<String, dynamic> _kopya(Map<String, dynamic> m) => Map<String, dynamic>.from(jsonDecode(jsonEncode(m)) as Map);

/// Saf işlev: gelen stats'ı değiştirmez, güncellenmiş kopyayı döner.
Map<String, dynamic> ilerlemeUygula(Map<String, dynamic> stats, IlerlemeKaydi k) {
  final s = _kopya(stats);
  final key = k.anahtar;
  final topic = s['topic'] is Map ? Map<String, dynamic>.from(s['topic'] as Map) : <String, dynamic>{};
  final t = (topic[key] is List ? (topic[key] as List).map((e) => (e as num).toInt()).toList() : <int>[0, 0, 0]);
  while (t.length < 3) {
    t.add(0);
  }
  t[k.sonuc == 1 ? 0 : (k.sonuc == 0 ? 1 : 2)]++;
  topic[key] = t;
  s['topic'] = topic;

  if (k.sonuc != -1) {
    final daily = s['daily'] is Map ? Map<String, dynamic>.from(s['daily'] as Map) : <String, dynamic>{};
    final gun = gunAnahtari(k.zaman);
    final day = daily[gun] is Map ? Map<String, dynamic>.from(daily[gun] as Map) : <String, dynamic>{'q': 0, 'c': 0};
    day['q'] = ((day['q'] as num?) ?? 0).toInt() + 1;
    if (k.sonuc == 1) day['c'] = ((day['c'] as num?) ?? 0).toInt() + 1;
    final tp = day['tp'] is Map ? Map<String, dynamic>.from(day['tp'] as Map) : <String, dynamic>{};
    tp[key] = ((tp[key] as num?) ?? 0).toInt() + 1;
    day['tp'] = tp;
    daily[gun] = day;
    s['daily'] = daily;

    final tr = s['tr'] is Map ? Map<String, dynamic>.from(s['tr'] as Map) : <String, dynamic>{};
    final dizgi = '${tr[key] ?? ''}${k.sonuc}';
    tr[key] = dizgi.length > 12 ? dizgi.substring(dizgi.length - 12) : dizgi;
    s['tr'] = tr;

    final td = s['td'] is Map ? Map<String, dynamic>.from(s['td'] as Map) : <String, dynamic>{};
    final liste = <List<int>>[];
    final eski = td[key];
    for (var i = 0; i < 3; i++) {
      if (eski is List && eski.length > i && eski[i] is List && (eski[i] as List).length >= 2) {
        liste.add([((eski[i] as List)[0] as num).toInt(), ((eski[i] as List)[1] as num).toInt()]);
      } else {
        liste.add([0, 0]);
      }
    }
    final di = (k.zorluk - 1).clamp(0, 2).toInt();
    liste[di][k.sonuc == 1 ? 0 : 1]++;
    td[key] = liste;
    s['td'] = td;
  }
  return s;
}

/// Hesaptan okunan stats'tan bir konunun toplamları (arayüz "hesabındaki ilerleme"yi SUNUCUDAN okur, yerel belleğe güvenmez).
class KonuIlerlemesi {
  final int dogru;
  final int yanlis;
  final int bos;
  const KonuIlerlemesi(this.dogru, this.yanlis, this.bos);
  int get toplam => dogru + yanlis + bos;
  int get cozulen => dogru + yanlis;
}

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

/// Kayıtları sırayla, okuma→uygulama→yazma biçiminde hesaba işler. Aynı anda tek yazma yapılır; yazma "eski" (409) dönerse
/// (başka cihaz daha yeni yazdıysa) sunucudaki son hâl yeniden okunup üstüne uygulanır. Başarısız kayıtlar kaybolmaz, beklemede tutulur.
class IlerlemeSenkron extends ChangeNotifier {
  final AkeApi api;
  final DateTime Function() simdi;
  final List<IlerlemeKaydi> _bekleyen = [];
  Future<void> _kuyruk = Future<void>.value();
  SenkronDurumu durum = SenkronDurumu.bos;
  ApiHata? sonHata;

  IlerlemeSenkron(this.api, {DateTime Function()? simdi}) : simdi = simdi ?? DateTime.now;

  int get bekleyenSayisi => _bekleyen.length;

  Future<void> ekle(IlerlemeKaydi k) {
    _bekleyen.add(k);
    return bosalt();
  }

  /// Bekleyen kayıtları hesaba yazar; biterse (ya da hata olursa) çözülür, hata atmaz (durum alanlarından okunur).
  Future<void> bosalt() {
    _kuyruk = _kuyruk.then((_) => _calistir());
    return _kuyruk;
  }

  Future<void> _calistir() async {
    if (_bekleyen.isEmpty) {
      durum = SenkronDurumu.bos;
      notifyListeners();
      return;
    }
    durum = SenkronDurumu.kaydediliyor;
    notifyListeners();
    final grup = List<IlerlemeKaydi>.from(_bekleyen);
    try {
      for (var deneme = 0; deneme < 3; deneme++) {
        final alanlar = await api.veriOku();
        var stats = alanlar['stats'] is Map ? Map<String, dynamic>.from(alanlar['stats'] as Map) : <String, dynamic>{};
        final uzakU = (stats['_u'] as num?)?.toInt() ?? 0;
        for (final k in grup) {
          stats = ilerlemeUygula(stats, k);
        }
        final yeniU = simdi().millisecondsSinceEpoch;
        stats['_u'] = yeniU > uzakU ? yeniU : uzakU + 1;
        try {
          await api.veriYaz('stats', stats);
          _bekleyen.removeRange(0, grup.length);
          sonHata = null;
          durum = _bekleyen.isEmpty ? SenkronDurumu.bos : SenkronDurumu.bekliyor;
          notifyListeners();
          return;
        } on ApiHata catch (h) {
          if (h.tur == HataTuru.cakisma && deneme < 2) continue;
          rethrow;
        }
      }
    } on ApiHata catch (h) {
      sonHata = h;
      durum = SenkronDurumu.bekliyor;
      notifyListeners();
    }
  }

  /// Hesaptaki güncel konu ilerlemeleri (sunucudan).
  Future<Map<String, KonuIlerlemesi>> hesaptanOku() async {
    final alanlar = await api.veriOku();
    final stats = alanlar['stats'] is Map ? Map<String, dynamic>.from(alanlar['stats'] as Map) : <String, dynamic>{};
    return konuIlerlemeleri(stats);
  }
}
