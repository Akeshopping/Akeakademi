import 'dart:async';

import 'package:ake_akademi/odeme/magaza_koprusu.dart';

/// Test köprüsü: GERÇEK Google Play / StoreKit DEĞİLDİR. Mağazanın olaylarını testler üretir; hangi çağrıların yapıldığı kaydedilir.
class SahteMagaza implements MagazaKoprusu {
  @override
  String platform = 'google';
  final StreamController<MagazaOlayi> _akis = StreamController<MagazaOlayi>.broadcast();
  bool acik = true;
  List<MagazaUrunu> urunler = const [
    MagazaUrunu(id: 'atilim_aylik', ad: 'Atılım aylık', fiyat: '₺199,00'),
    MagazaUrunu(id: 'atilim_yillik', ad: 'Atılım yıllık', fiyat: '₺2.189,00'),
    MagazaUrunu(id: 'premium_aylik', ad: 'Premium aylık', fiyat: '₺399,00'),
    MagazaUrunu(id: 'premium_yillik', ad: 'Premium yıllık', fiyat: '₺4.389,00'),
  ];
  final List<(String urun, String hesapKimligi)> satinAlmalar = [];
  final List<MagazaOlayi> tamamlananlar = [];
  int geriYuklemeCagrisi = 0;
  bool satinAlAtar = false;

  /// satinAl çağrılınca çalışır: mağazanın o an vereceği olayı üretir (ör. purchased, pending, canceled).
  void Function(String urun)? satinAlYaniti;
  void Function()? geriYuklemeYaniti;

  void olay(MagazaOlayi o) => _akis.add(o);

  @override
  Stream<MagazaOlayi> get olaylar => _akis.stream;
  @override
  Future<bool> kullanilabilir() async => acik;
  @override
  Future<List<MagazaUrunu>> urunleriOku(Set<String> idler) async => urunler.where((u) => idler.contains(u.id)).toList();
  @override
  Future<void> satinAl(String urunId, String hesapKimligi) async {
    if (satinAlAtar) throw StateError('başlatılamadı');
    satinAlmalar.add((urunId, hesapKimligi));
    final y = satinAlYaniti;
    if (y != null) scheduleMicrotask(() => y(urunId));
  }

  @override
  Future<void> geriYukle() async {
    geriYuklemeCagrisi++;
    final y = geriYuklemeYaniti;
    if (y != null) scheduleMicrotask(y);
  }

  int yonetAcilis = 0;
  bool yonetAcilir = true;
  @override
  Future<bool> abonelikleriYonet() async {
    yonetAcilis++;
    return yonetAcilir;
  }

  @override
  Future<void> tamamla(MagazaOlayi olay) async => tamamlananlar.add(olay);
  @override
  void kapat() {}
}
