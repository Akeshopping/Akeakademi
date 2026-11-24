import 'dart:math';

import 'package:flutter/foundation.dart';

import '../veri/api.dart';
import '../veri/hesap_verisi.dart';
import '../veri/ilerleme.dart';
import '../veri/modeller.dart';
import '../veri/oturum_deposu.dart';
import 'package:flutter/material.dart' show ThemeMode;

enum Faz { yukleniyor, ag, giris, oturumBitti, ana }

/// Uygulamanın kök durumu: oturum var mı, süresi doldu mu, ağ var mı.
class UygulamaModeli extends ChangeNotifier {
  final AkeApi api;
  final IlerlemeSenkron senkron;
  final AyarDeposu ayar;
  Faz faz = Faz.yukleniyor;
  Kullanici? kullanici;
  ThemeMode tema = ThemeMode.system;

  /// İlk açılışta bir kez oynayan giriş animasyonu. Görüldüğü cihazda saklanır; tekrar açılışta hiç gösterilmez.
  bool acilisOynat = false;

  /// Alt gezinmedeki etkin sekme (0 Ana sayfa, 1 Soru çöz, 2 Gelişim, 3 Plan, 4 Ayarlar). Ekranlar buradan sekme değiştirebilir.
  int sekme = 0;
  void sekmeGit(int i) {
    if (sekme == i) return;
    sekme = i;
    notifyListeners();
  }

  UygulamaModeli(this.api, this.senkron, {AyarDeposu? ayar}) : ayar = ayar ?? BellekAyar() {
    api.oturumBittiDinleyici = () {
      kullanici = null;
      senkron.oturumBitti();
      faz = Faz.oturumBitti;
      notifyListeners();
    };
  }

  Future<void> ayarlariYukle() async {
    try {
      final t = await ayar.oku('tema');
      tema = t == 'acik' ? ThemeMode.light : (t == 'koyu' ? ThemeMode.dark : ThemeMode.system);
      acilisOynat = (await ayar.oku('acilis')) != '1';
    } catch (_) {
      acilisOynat = false; // depo okunamazsa kullanıcıyı bekletme
    }
  }

  /// Hesap verisi (profil, günlük sayılar, konu başarısı, plan): önce bekleyen cevaplar yazılır, sonra SUNUCUDAN okunur.
  Future<HesapVerisi> hesapVerisi() async {
    await senkron.bosalt();
    return HesapVerisi.alanlardan(await api.veriOku());
  }

  Future<void> temaDegistir(ThemeMode m) async {
    tema = m;
    notifyListeners();
    try {
      await ayar.yaz('tema', m == ThemeMode.light ? 'acik' : (m == ThemeMode.dark ? 'koyu' : 'sistem'));
    } catch (_) {}
  }

  /// Açılış animasyonu bitti ya da geçildi: bir daha oynatılmaz.
  Future<void> acilisBitti() async {
    if (!acilisOynat) return;
    acilisOynat = false;
    notifyListeners();
    try {
      await ayar.yaz('acilis', '1');
    } catch (_) {}
  }

  Future<void> baslat() async {
    faz = Faz.yukleniyor;
    await ayarlariYukle();
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
    sekme = 0;
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
    sekme = 0;
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
