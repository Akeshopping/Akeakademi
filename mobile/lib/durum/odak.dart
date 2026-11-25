import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../veri/oturum_deposu.dart';

/// Sitedeki odak sayacı (POMO): Odak 25 dk / Mola 5 dk; başlat, duraklat, devam, sıfırla; mod yalnız dururken değişir.
/// Süre DUVAR SAATİNE göre hesaplanır (çalışırken bitiş zamanı saklanır), bu yüzden uygulama arka plana gidip dönse ya da
/// kapanıp açılsa bile kalan süre doğrudur. Bitişte yalnız BİR tur tamamlanır (site gibi): odak biterse mola, mola biterse odak.
/// Biten odak turu hesabın günlük odak dakikasına (stats.daily[gün].fm, web ile aynı alan) sunucu uç noktasıyla yazılır;
/// yazılamazsa tur cihazda bekler ve sonra tekrar denenir (tur kimliği tek seferliktir, çift sayılmaz).
const odakSureleriSn = {'odak': 25 * 60, 'mola': 5 * 60};

class OdakSayaci extends ChangeNotifier {
  final AyarDeposu _ayar;
  final String hesapId;
  final DateTime Function() _simdi;
  final Future<int> Function(String tur) _gonder; // başarıda günün sunucudaki toplam odak dakikası
  final String Function() _yeniKimlik;

  String mod = 'odak';
  bool calisiyor = false;
  int _bitisMs = 0;
  int _kalanSn = odakSureleriSn['odak']!;
  String? _tur; // çalışan odak turunun tek seferlik kimliği
  final List<String> bekleyen = []; // tamamlanmış ama sunucuya yazılamamış turlar
  int? sunucuFm; // son başarılı yazmada günün toplamı
  String? sunucuFmGunu;
  String? sonOlay; // 'odak' ya da 'mola' bitti; arayüz bir kez gösterir
  int sonOlayMs = 0;
  bool _gonderiyor = false;

  OdakSayaci({required AyarDeposu ayar, required this.hesapId, required DateTime Function() simdi, required Future<int> Function(String) gonder, required String Function() yeniKimlik})
      : _ayar = ayar,
        _simdi = simdi,
        _gonder = gonder,
        _yeniKimlik = yeniKimlik;

  String get _anahtar => 'odak.$hesapId';
  int get tamSn => odakSureleriSn[mod]!;

  /// Kalan saniye (çalışırken saatten, dururken saklanan değerden).
  int get kalanSn => calisiyor ? math.max(0, ((_bitisMs - _simdi().millisecondsSinceEpoch) / 1000).round()) : _kalanSn;
  bool get kismenKullanildi => !calisiyor && _kalanSn < tamSn;

  String get gunAnahtari {
    final d = _simdi();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /// Bugün odaklı çalışma (dk): hesaptan okunan [hesapDk] ile bu oturumda yazılan en yüksek değerin büyüğü + bekleyen turlar.
  int bugunOdakDk(int hesapDk) {
    final s = sunucuFmGunu == gunAnahtari ? sunucuFm ?? 0 : 0;
    return math.max(hesapDk, s) + bekleyen.length * 25;
  }

  Future<void> yukle() async {
    try {
      final h = await _ayar.oku(_anahtar);
      if (h != null && h.isNotEmpty) {
        final j = jsonDecode(h);
        if (j is Map) {
          final m = '${j['mod']}';
          if (odakSureleriSn.containsKey(m)) mod = m;
          calisiyor = j['calisiyor'] == true;
          _bitisMs = j['bitis'] is num ? (j['bitis'] as num).toInt() : 0;
          final k = j['kalan'] is num ? (j['kalan'] as num).toInt() : odakSureleriSn[mod]!;
          _kalanSn = k.clamp(0, odakSureleriSn[mod]!).toInt();
          _tur = j['tur'] is String && (j['tur'] as String).isNotEmpty ? j['tur'] as String : null;
          bekleyen
            ..clear()
            ..addAll([for (final x in (j['bekleyen'] is List ? j['bekleyen'] as List : const []) ) if (x is String && x.isNotEmpty) x]);
        }
      }
    } catch (_) {
      // bozuk kayıt: varsayılan duruma dön
      mod = 'odak';
      calisiyor = false;
      _kalanSn = odakSureleriSn['odak']!;
      bekleyen.clear();
    }
    guncelle();
    notifyListeners();
    unawaited(bekleyenleriGonder());
  }

  Future<void> _kaydet() async {
    try {
      await _ayar.yaz(_anahtar, jsonEncode({'mod': mod, 'calisiyor': calisiyor, 'bitis': _bitisMs, 'kalan': _kalanSn, 'tur': _tur, 'bekleyen': bekleyen}));
    } catch (_) {}
  }

  /// Saniye tikinde ve uygulama öne gelince çağrılır: süre dolduysa turu tamamlar.
  void guncelle() {
    if (calisiyor && kalanSn <= 0) _tamamla();
  }

  void _tamamla() {
    calisiyor = false;
    if (mod == 'odak') {
      bekleyen.add(_tur ?? _yeniKimlik());
      mod = 'mola';
      sonOlay = 'odak';
    } else {
      mod = 'odak';
      sonOlay = 'mola';
    }
    sonOlayMs = _simdi().millisecondsSinceEpoch;
    _tur = null;
    _kalanSn = odakSureleriSn[mod]!;
    unawaited(_kaydet());
    notifyListeners();
    unawaited(bekleyenleriGonder());
  }

  void modSec(String m) {
    if (calisiyor || !odakSureleriSn.containsKey(m)) return;
    mod = m;
    _kalanSn = odakSureleriSn[m]!;
    _tur = null;
    unawaited(_kaydet());
    notifyListeners();
  }

  void basla() {
    if (calisiyor) return;
    _bitisMs = _simdi().millisecondsSinceEpoch + _kalanSn * 1000;
    calisiyor = true;
    if (mod == 'odak') _tur ??= _yeniKimlik();
    unawaited(_kaydet());
    notifyListeners();
  }

  void duraklat() {
    if (!calisiyor) return;
    _kalanSn = kalanSn;
    calisiyor = false;
    unawaited(_kaydet());
    notifyListeners();
  }

  void sifirla() {
    calisiyor = false;
    _kalanSn = tamSn;
    _tur = null;
    unawaited(_kaydet());
    notifyListeners();
  }

  /// Arayüz son olayı gösterdi (en çok 2 dk eski olay gösterilir; eskisi sessizce düşer).
  String? olayTuket() {
    final o = sonOlay;
    sonOlay = null;
    if (o == null) return null;
    return _simdi().millisecondsSinceEpoch - sonOlayMs <= 120000 ? o : null;
  }

  /// Bekleyen turları sırayla sunucuya yazar; ilk hatada durur (sonra yeniden denenir). Gönderilen tur sayısını döner.
  Future<int> bekleyenleriGonder() async {
    if (_gonderiyor || bekleyen.isEmpty) return 0;
    _gonderiyor = true;
    var n = 0;
    try {
      for (final id in List<String>.from(bekleyen)) {
        try {
          final fm = await _gonder(id);
          bekleyen.remove(id);
          sunucuFm = fm;
          sunucuFmGunu = gunAnahtari;
          n++;
        } catch (_) {
          break;
        }
      }
    } finally {
      _gonderiyor = false;
    }
    if (n > 0) {
      await _kaydet();
      notifyListeners();
    }
    return n;
  }
}
