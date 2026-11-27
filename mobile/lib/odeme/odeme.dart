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
  final String? hesapId;
  OdemeModeli(this.api, this.koprusu, {this.hesapId, this.geriYuklemeBekleme = const Duration(seconds: 6)});

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
    if (_kapandi) return;
    _abone ??= koprusu.olaylar.listen(_olay, onError: (Object e) => _sonuc('Mağaza bildirimi okunamadı.', hata: true));
    await yenile();
  }

  /// Son tazeleme başarısız oldu: ekrandaki paket bilgisi ESKİ olabilir (bilgi silinmez ama güncelmiş gibi de sunulmaz).
  bool eskimis = false;
  String eskimisMesaji = '';
  int _nesil = 0; // her sunucu okumasına artan numara: yalnız EN SON başlatılan yanıt uygulanır (eski yanıt yeni durumu ezmez)

  /// Sert yenileme: "yükleniyor" gösterir (ilk açılış, açık hata, elle "Tekrar dene").
  Future<void> yenile() => _getir(sert: true);

  /// Yumuşak tazeleme (ekran yeniden açılınca, uygulama arka plandan dönünce): elindeki bilgi ekranda kalır; sürmekte olan satın alma,
  /// bekleyen onay, mesaj ve "Yeniden dene" durumuna DOKUNMAZ. Ağ hatasında eski bilgi "eski olabilir" uyarısıyla kalır.
  Future<void> tazele() => _getir(sert: false);

  Future<void> _getir({required bool sert}) async {
    if (_kapandi) return;
    final n = ++_nesil;
    bool eski() => _kapandi || n != _nesil; // kapandıysa (hesap değişti/çıkış) ya da daha yeni bir okuma başladıysa bu yanıt atılır
    final eldeBilgiVar = !sert && faz == OdemeFazi.hazir;
    if (!eldeBilgiVar) {
      faz = OdemeFazi.yukleniyor;
      notifyListeners();
    }
    try {
      final d = await api.magazaDurumu(beklenenHesap: hesapId);
      if (eski()) return;
      final kullanilabilir = await koprusu.kullanilabilir();
      if (eski()) return;
      List<PaketSatiri> yeniPaketler = const [];
      if (kullanilabilir) {
        final okunan = {for (final u in await koprusu.urunleriOku(d.urunler.map((e) => e.$1).toSet())) u.id: u};
        if (eski()) return;
        yeniPaketler = [for (final e in d.urunler) PaketSatiri(e.$1, e.$2, e.$3, okunan[e.$1])];
      }
      hesapKimligi = koprusu.platform == 'apple' ? d.kimlikApple : d.kimlikGoogle;
      islemler = d.islemler;
      hesap = d.hesap;
      paketler = yeniPaketler;
      faz = kullanilabilir ? OdemeFazi.hazir : OdemeFazi.magazaYok;
      eskimis = false;
      eskimisMesaji = '';
    } on ApiHata catch (e) {
      if (eski()) return;
      if (e.kod == 'kapali') {
        faz = OdemeFazi.sunucuKapali;
        eskimis = false;
      } else {
        _tazelemeHatasi(eldeBilgiVar, e.tur == HataTuru.ag ? 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.' : 'Paket bilgisi okunamadı. Biraz sonra tekrar dene.');
      }
    } catch (_) {
      if (eski()) return;
      _tazelemeHatasi(eldeBilgiVar, 'Mağaza bilgisi okunamadı. Biraz sonra tekrar dene.');
    }
    if (!_kapandi) notifyListeners();
  }

  void _tazelemeHatasi(bool eldeBilgiVar, String m) {
    if (eldeBilgiVar) {
      eskimis = true; // eski liste kalır ama güncel değil
      eskimisMesaji = m;
    } else {
      faz = OdemeFazi.hata;
      hataMesaji = m;
    }
  }

  bool get mesgul => islemdeUrun != null || _surenler.isNotEmpty || _geriYukleniyor;

  Future<void> satinAl(String urunId) async {
    if (_kapandi || faz != OdemeFazi.hazir || mesgul || hesapKimligi == null) return;
    islemdeUrun = urunId;
    bekliyor = false;
    mesaj = '';
    dogrulanamayan = null;
    notifyListeners();
    try {
      await koprusu.satinAl(urunId, hesapKimligi!);
    } catch (_) {
      if (_kapandi) return;
      islemdeUrun = null;
      _sonuc('Satın alma başlatılamadı. Biraz sonra tekrar dene.', hata: true);
    }
  }

  Future<void> geriYukle() async {
    if (_kapandi || mesgul) return;
    _geriYukleniyor = true;
    _geriYuklenen = 0;
    mesaj = '';
    dogrulanamayan = null;
    notifyListeners();
    try {
      await koprusu.geriYukle();
    } catch (_) {
      if (_kapandi) return;
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
    if (_kapandi || o == null || mesgul) return;
    dogrulanamayan = null;
    await _dogrula(o);
  }

  void _olay(MagazaOlayi o) {
    if (_kapandi) return;
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
    if (_kapandi) return;
    if (o.kimlik.isEmpty) {
      islemdeUrun = null;
      _geriYukleniyor = false;
      _sonuc('Mağaza işlem kimliği vermedi. Ücret alındıysa Geri yükle ile tekrar dene; sorun sürerse bizimle iletişime geç.', hata: true);
      return;
    }
    if (!_surenler.add(o.kimlik)) return;
    bekliyor = false;
    notifyListeners();
    try {
      await api.magazaDogrula(o.platform, o.kimlik, beklenenHesap: hesapId);
      if (_kapandi) return; // Hesap değiştiyse eski ekrandan mağaza işlemini tamamlama.
      await koprusu.tamamla(o);
      if (_kapandi) return;
      islemdeUrun = null;
      _geriYukleniyor = false;
      await yenile();
      _sonuc('Paketin açıldı. Teşekkürler!', hata: false);
    } on ApiHata catch (e) {
      if (_kapandi) return;
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
      if (_kapandi) return;
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
    if (_kapandi) return;
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
