import 'dart:async';

import 'package:flutter/foundation.dart';

import '../veri/api.dart';
import '../veri/modeller.dart';
import 'magaza_koprusu.dart';

/// Paketler ekranının durumu. İLKE: erişim yalnızca SUNUCUNUN mağazadan doğruladığı işlemden sonra açılır. Uygulama mağazadan gelen
/// kimliği sunucuya anahtar olarak yollar; sunucu "kabul" demeden paket açılmış sayılmaz, işlem de mağazaya tamamlanmaz.
enum OdemeFazi { yukleniyor, hazir, sunucuKapali, magazaYok, hata }

class PaketSatiri {
  final String id; // atilim_aylik …
  final String plan; // orta | premium
  final String donem; // ay | yil
  final MagazaUrunu? urun; // null: mağaza bu ürünü döndürmedi (henüz oluşturulmamış/yayında değil)
  const PaketSatiri(this.id, this.plan, this.donem, this.urun);
  String get planAdi => plan == 'premium' ? 'Premium' : 'Atılım';
  String get donemAdi => donem == 'yil' ? 'Yıllık' : 'Aylık';
}

class OdemeModeli extends ChangeNotifier {
  final AkeApi api;
  final MagazaKoprusu koprusu;
  final Duration geriYuklemeBekleme;
  OdemeModeli(this.api, this.koprusu, {this.geriYuklemeBekleme = const Duration(seconds: 6)});

  OdemeFazi faz = OdemeFazi.yukleniyor;
  String hataMesaji = '';
  List<PaketSatiri> paketler = const [];
  List<SunucuIslemi> islemler = const [];
  HesapDurumu? hesap;
  String? hesapKimligi; // bu platform için sunucunun verdiği takma ad (satın almaya eklenir)

  /// Şu an mağazada işlemi süren ürün (düğmeler kilitlenir; çift satın alma olmaz).
  String? islemdeUrun;

  /// Mağaza ödemeyi onay bekliyor (örn. nakit/çocuk onayı): erişim AÇILMADI.
  bool bekliyor = false;

  /// Kullanıcıya gösterilen son sonuç; [mesajHata] kırmızı mı.
  String mesaj = '';
  bool mesajHata = false;

  /// Mağaza ödemeyi aldı ama sunucu doğrulayamadı (ağ/sunucu): işlem mağazada AÇIK kalır, kullanıcı yeniden dener.
  MagazaOlayi? dogrulanamayan;
  final Set<String> _surenler = {};
  StreamSubscription<MagazaOlayi>? _abone;
  Timer? _geriYuklemeZamani;
  bool _geriYukleniyor = false;
  int _geriYuklenen = 0;
  bool _kapandi = false;

  Future<void> baslat() async {
    _abone ??= koprusu.olaylar.listen(_olay, onError: (Object e) => _sonuc('Mağaza bildirimi okunamadı.', hata: true));
    await yenile();
  }

  Future<void> yenile() async {
    faz = OdemeFazi.yukleniyor;
    notifyListeners();
    try {
      final d = await api.magazaDurumu();
      hesapKimligi = koprusu.platform == 'apple' ? d.kimlikApple : d.kimlikGoogle;
      islemler = d.islemler;
      hesap = d.hesap;
      if (!await koprusu.kullanilabilir()) {
        faz = OdemeFazi.magazaYok;
        paketler = const [];
      } else {
        final okunan = {for (final u in await koprusu.urunleriOku(d.urunler.map((e) => e.$1).toSet())) u.id: u};
        paketler = [for (final e in d.urunler) PaketSatiri(e.$1, e.$2, e.$3, okunan[e.$1])];
        faz = OdemeFazi.hazir;
      }
    } on ApiHata catch (e) {
      if (e.kod == 'kapali') {
        faz = OdemeFazi.sunucuKapali;
      } else {
        faz = OdemeFazi.hata;
        hataMesaji = e.tur == HataTuru.ag ? 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.' : 'Paket bilgisi okunamadı. Biraz sonra tekrar dene.';
      }
    } catch (_) {
      faz = OdemeFazi.hata;
      hataMesaji = 'Mağaza bilgisi okunamadı. Biraz sonra tekrar dene.';
    }
    if (!_kapandi) notifyListeners();
  }

  bool get mesgul => islemdeUrun != null || _surenler.isNotEmpty || _geriYukleniyor;

  Future<void> satinAl(String urunId) async {
    if (mesgul || hesapKimligi == null) return;
    islemdeUrun = urunId;
    bekliyor = false;
    mesaj = '';
    dogrulanamayan = null;
    notifyListeners();
    try {
      await koprusu.satinAl(urunId, hesapKimligi!);
    } catch (_) {
      islemdeUrun = null;
      _sonuc('Satın alma başlatılamadı. Biraz sonra tekrar dene.', hata: true);
    }
  }

  Future<void> geriYukle() async {
    if (mesgul) return;
    _geriYukleniyor = true;
    _geriYuklenen = 0;
    mesaj = '';
    dogrulanamayan = null;
    notifyListeners();
    try {
      await koprusu.geriYukle();
    } catch (_) {
      _geriYukleniyor = false;
      _sonuc('Satın almalar geri yüklenemedi. Biraz sonra tekrar dene.', hata: true);
      return;
    }
    // Eklenti "bitti" sinyali vermez: olaylar akıştan gelir. Süre dolunca hiç gelmediyse bulunamadı denir.
    _geriYuklemeZamani?.cancel();
    _geriYuklemeZamani = Timer(geriYuklemeBekleme, () {
      if (_kapandi || !_geriYukleniyor) return;
      if (_surenler.isEmpty && _geriYuklenen == 0) {
        _geriYukleniyor = false;
        _sonuc('Bu mağaza hesabında geri yüklenecek satın alma bulunamadı.', hata: false);
      }
    });
  }

  /// Sunucu doğrulaması ağ/sunucu yüzünden yapılamadıysa aynı işlemi yeniden dener.
  Future<void> yenidenDene() async {
    final o = dogrulanamayan;
    if (o == null || mesgul) return;
    dogrulanamayan = null;
    await _dogrula(o);
  }

  void _olay(MagazaOlayi o) {
    switch (o.tur) {
      case MagazaOlayTuru.bekliyor:
        bekliyor = true;
        notifyListeners();
      case MagazaOlayTuru.iptal:
        bekliyor = false;
        islemdeUrun = null;
        _sonuc('Satın alma iptal edildi. Ücret alınmadı.', hata: false);
      case MagazaOlayTuru.hata:
        bekliyor = false;
        islemdeUrun = null;
        _geriYukleniyor = false;
        _sonuc('Mağaza satın almayı tamamlayamadı. Ücret alındıysa birkaç dakika içinde Geri yükle\'yi dene.', hata: true);
      case MagazaOlayTuru.satinAlindi:
      case MagazaOlayTuru.geriYuklendi:
        _geriYuklenen++;
        unawaited(_dogrula(o));
    }
  }

  /// Mağazanın verdiği işlemi SUNUCUYA doğrulatır. Kabul gelmeden işlem tamamlanmaz ve paket açılmış gösterilmez.
  Future<void> _dogrula(MagazaOlayi o) async {
    if (o.kimlik.isEmpty || !_surenler.add(o.kimlik)) return;
    bekliyor = false;
    notifyListeners();
    try {
      await api.magazaDogrula(o.platform, o.kimlik);
      await koprusu.tamamla(o);
      islemdeUrun = null;
      _geriYukleniyor = false;
      await yenile();
      _sonuc('Paketin açıldı. Teşekkürler!', hata: false);
    } on ApiHata catch (e) {
      islemdeUrun = null;
      _geriYukleniyor = false;
      final kod = _sunucuHatasi(e);
      if (e.tur == HataTuru.ag || kod == 'magaza_ulasilamadi' || kod == 'yapilandirma' || e.tur == HataTuru.sunucu) {
        dogrulanamayan = o;
        _sonuc('Satın alma mağazada kayıtlı ama doğrulanamadı. Bağlantı gelince "Yeniden dene"ye bas; paket doğrulanınca açılır.', hata: true);
      } else {
        _sonuc(_hataMetni(kod), hata: true);
      }
    } catch (_) {
      islemdeUrun = null;
      _geriYukleniyor = false;
      dogrulanamayan = o;
      _sonuc('Satın alma doğrulanamadı. "Yeniden dene"ye bas.', hata: true);
    } finally {
      _surenler.remove(o.kimlik);
      if (!_kapandi) notifyListeners();
    }
  }

  static String _sunucuHatasi(ApiHata e) {
    final s = e.govde['sonuc'];
    if (s is List && s.isNotEmpty && s.first is Map) return '${(s.first as Map)['hata'] ?? ''}';
    return e.kod;
  }

  static String _hataMetni(String kod) => switch (kod) {
        'hesap_eslesmedi' || 'baska_hesap' => 'Bu satın alma başka bir AKE hesabına ait. Satın aldığın hesapla giriş yapıp Geri yükle\'yi dene.',
        'islem_bulunamadi' => 'Mağaza bu işlemi bulamadı. Ücret alındıysa birkaç dakika sonra Geri yükle\'yi dene.',
        'canli_islem_kapali' => 'Bu sürümde yalnızca mağaza test satın almaları kabul edilir.',
        'urun' => 'Bu ürün AKE paketlerinden biri değil.',
        'kapali' => 'Mağaza satın alma şu an kapalı.',
        _ => 'Satın alma doğrulanamadı. Sorun sürerse bizimle iletişime geç.',
      };

  void _sonuc(String m, {required bool hata}) {
    mesaj = m;
    mesajHata = hata;
    if (!_kapandi) notifyListeners();
  }

  @override
  void dispose() {
    _kapandi = true;
    _geriYuklemeZamani?.cancel();
    _abone?.cancel();
    koprusu.kapat();
    super.dispose();
  }
}
