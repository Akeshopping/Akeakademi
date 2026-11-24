import 'dart:math';

import 'package:flutter/foundation.dart';

import '../veri/api.dart';
import '../veri/ilerleme.dart';
import '../veri/modeller.dart';

enum Faz { yukleniyor, ag, giris, oturumBitti, ana }

/// Uygulamanın kök durumu: oturum var mı, süresi doldu mu, ağ var mı.
class UygulamaModeli extends ChangeNotifier {
  final AkeApi api;
  final IlerlemeSenkron senkron;
  Faz faz = Faz.yukleniyor;
  Kullanici? kullanici;

  UygulamaModeli(this.api, this.senkron) {
    api.oturumBittiDinleyici = () {
      kullanici = null;
      senkron.oturumBitti();
      faz = Faz.oturumBitti;
      notifyListeners();
    };
  }

  Future<void> baslat() async {
    faz = Faz.yukleniyor;
    notifyListeners();
    if (!await api.anahtariYukle()) {
      faz = Faz.giris;
      notifyListeners();
      return;
    }
    try {
      kullanici = await api.ben();
      faz = Faz.ana;
      _hesabaGec(kullanici!.id);
    } on ApiHata catch (h) {
      if (h.tur == HataTuru.oturum) {
        faz = Faz.oturumBitti; // dinleyici de aynı durumu kurar
      } else {
        faz = Faz.ag;
      }
    }
    notifyListeners();
  }

  Future<void> kodIste(String eposta) => api.kodGonder(eposta.trim().toLowerCase());

  Future<void> kodDogrula(String eposta, String kod) async {
    kullanici = await api.kodDogrula(eposta.trim().toLowerCase(), kod.replaceAll(RegExp(r'\D'), ''));
    faz = Faz.ana;
    _hesabaGec(kullanici!.id);
    notifyListeners();
  }

  /// Aktif hesap bu kimliktir: başka hesabın bekleyen kayıtları silinir; bu hesabın işlenmemiş cevapları sunucudan toparlanır.
  void _hesabaGec(String id) {
    senkron.hesapAyarla(id);
    senkron.supur();
    senkron.bosalt();
  }

  Future<void> cikis() async {
    await api.cikis();
    senkron.temizle();
    kullanici = null;
    faz = Faz.giris;
    notifyListeners();
  }

  void yenidenGirisYap() {
    faz = Faz.giris;
    notifyListeners();
  }

  /// Aynı istek tekrarlandığında sunucu aynı oturumu döner (kota ikinci kez düşmez). Her yeni oturum için yeni kimlik üretilir.
  static String yeniIstekKimligi([Random? r]) {
    final rnd = r ?? Random.secure();
    const harf = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return 'm-${List.generate(30, (_) => harf[rnd.nextInt(harf.length)]).join()}';
  }
}
