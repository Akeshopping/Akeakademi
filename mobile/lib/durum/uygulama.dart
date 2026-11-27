import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../veri/api.dart';
import '../veri/hesap_verisi.dart';
import '../veri/ilerleme.dart';
import '../veri/modeller.dart';
import '../veri/oturum_deposu.dart';
import '../odeme/magaza_koprusu.dart';
import '../odeme/odeme.dart';
import 'odak.dart';
import 'package:flutter/material.dart' show ThemeMode;

enum Faz { yukleniyor, ag, giris, oturumBitti, ana }

/// Menü sekmesinin alt sayfaları (sitedeki Menü bölümü): null = menü listesi.
enum MenuSayfasi { gelisim, plan, paket, ayarlar }

/// Uygulamanın kök durumu: oturum var mı, süresi doldu mu, ağ var mı.
class UygulamaModeli extends ChangeNotifier {
  final AkeApi api;
  final IlerlemeSenkron senkron;
  final AyarDeposu ayar;
  final DateTime Function() saat; // test için değiştirilebilir saat
  /// Odak odası sayacı (aktif hesaba bağlı; sekmeler arasında yaşar).
  OdakSayaci? odak;

  /// Üretimde main() gerçek köprüyü verir; testler sahte köprü verebilir veya mağazayı hiç açmaz.
  MagazaKoprusu? magaza;
  /// Satın alma dinleyicisi ekranlar arasında yaşar, çıkışta ve hesap değişiminde kapanır.
  OdemeModeli? odeme;
  Faz faz = Faz.yukleniyor;
  Kullanici? kullanici;
  ThemeMode tema = ThemeMode.system;

  /// Her yeni uygulama çalıştırıldığında bir kez oynayan giriş animasyonu.
  bool acilisOynat = false;
  bool _acilisKararlastirildi = false;

  /// Alt gezinmedeki etkin sekme (0 Ana sayfa, 1 Soru çöz, 2 Deneme, 3 AI, 4 Menü). Ekranlar buradan sekme değiştirebilir.
  int sekme = 0;

  /// Ana sayfadaki "Mini deneme" gibi kısayollar Deneme sekmesini hazır ayarla açar (ör. 'mini' = ¼ uzunluk); sekme bir kez okuyup temizler.
  String? denemeOnAyar;
  void sekmeGit(int i) {
    if (sekme == i) return;
    sekme = i;
    notifyListeners();
  }

  /// Menü sekmesinde açık alt sayfa (Gelişim, Plan, Ayarlar); null ise menü listesi.
  MenuSayfasi? menuSayfasi;
  void menuyeGit(MenuSayfasi? s) {
    sekme = 4;
    menuSayfasi = s;
    notifyListeners();
  }

  /// Geri tuşu: önce menü alt sayfası, sonra Ana sayfaya; zaten Ana sayfadaysa false (sistem çıkar).
  bool geriGit() {
    if (sekme == 4 && menuSayfasi != null) {
      menuSayfasi = null;
    } else if (sekme != 0) {
      sekme = 0;
    } else {
      return false;
    }
    notifyListeners();
    return true;
  }

  /// Hesap silme: sunucu siler, yerel her şey temizlenir, giriş ekranına dönülür.
  Future<void> hesapSil() async {
    await api.hesapSil();
    _odemeyiKapat();
    senkron.temizle();
    kullanici = null;
    odak = null;
    sekme = 0;
    menuSayfasi = null;
    faz = Faz.giris;
    notifyListeners();
  }

  UygulamaModeli(this.api, this.senkron, {AyarDeposu? ayar, DateTime Function()? saat})
      : ayar = ayar ?? BellekAyar(),
        saat = saat ?? DateTime.now {
    api.oturumBittiDinleyici = () {
      _odemeyiKapat();
      kullanici = null;
      odak = null;
      senkron.oturumBitti();
      faz = Faz.oturumBitti;
      notifyListeners();
    };
  }

  Future<void> ayarlariYukle() async {
    if (_acilisKararlastirildi) return; // Aynı süreçte ağ nedeniyle yeniden başlatma animasyonu tekrarlamaz.
    _acilisKararlastirildi = true;
    acilisOynat = true;
    try {
      final t = await ayar.oku('tema');
      tema = t == 'acik' ? ThemeMode.light : (t == 'koyu' ? ThemeMode.dark : ThemeMode.system);
      // Eski sürümlerin '1' (görüldü) kaydı artık açılışı engellemez.
      acilisOynat = (await ayar.oku('acilis')) != 'kapali';
    } catch (_) {
      // Ayar deposu okunamazsa bile o süreçte açılışın gösterilmesine izin ver.
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

  /// Açılış animasyonu bitti ya da geçildi: bu süreçte tekrar oynatılmaz.
  void acilisBitti() {
    if (!acilisOynat) return;
    acilisOynat = false;
    notifyListeners();
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
    _odemeyiKapat();
    if (magaza != null) {
      odeme = OdemeModeli(api, magaza!, hesapId: id);
      unawaited(odeme!.baslat());
    }
    odak = OdakSayaci(
      ayar: ayar,
      hesapId: id,
      simdi: saat,
      gonder: (tur) => api.odakTuru(tur: tur, tzDk: saat().timeZoneOffset.inMinutes, beklenenHesap: id),
      yeniKimlik: () => yeniIstekKimligi(),
    )..yukle();
    senkron.hesapAyarla(id);
    senkron.supur();
    senkron.bosalt();
  }

  Future<void> cikis() async {
    _odemeyiKapat();
    await api.cikis();
    senkron.temizle();
    kullanici = null;
    odak = null;
    sekme = 0;
    menuSayfasi = null;
    faz = Faz.giris;
    notifyListeners();
  }

  void yenidenGirisYap() {
    faz = Faz.giris;
    notifyListeners();
  }

  void _odemeyiKapat() {
    odeme?.dispose();
    odeme = null;
  }

  @override
  void dispose() {
    _odemeyiKapat();
    super.dispose();
  }

  /// Aynı istek tekrarlandığında sunucu aynı oturumu döner (kota ikinci kez düşmez). Her yeni oturum için yeni kimlik üretilir.
  static String yeniIstekKimligi([Random? r]) {
    final rnd = r ?? Random.secure();
    const harf = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return 'm-${List.generate(30, (_) => harf[rnd.nextInt(harf.length)]).join()}';
  }
}
