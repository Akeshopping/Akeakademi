import 'dart:async';
import 'dart:io' show Platform;

import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:url_launcher/url_launcher.dart';

/// Sunucunun bildiği abonelik ürün kimlikleri (lib/magaza.js URUNLER ile AYNI; Play Console abonelik kimliği ve App Store Connect ürün kimliği olarak oluşturulur).
const magazaUrunKimlikleri = <String>['atilim_aylik', 'atilim_yillik', 'premium_aylik', 'premium_yillik'];

/// Mağazanın abonelik yönetim sayfası (iptal / yenileme / ödeme yöntemi). SABİT https adresleri; kişisel veri taşımaz.
const androidPaketKimligi = 'com.akeakademi.ake_akademi';
Uri abonelikAdresi(String platform) => platform == 'apple'
    ? Uri.parse('https://apps.apple.com/account/subscriptions')
    : Uri.parse('https://play.google.com/store/account/subscriptions?package=$androidPaketKimligi');

/// Mağazadan okunan ürün: ad ve FİYAT mağazanın kendi metnidir (uygulama fiyat yazmaz, yerel para birimi ve vergi mağazadan gelir).
class MagazaUrunu {
  final String id;
  final String ad;
  final String fiyat;
  const MagazaUrunu({required this.id, required this.ad, required this.fiyat});
}

enum MagazaOlayTuru { bekliyor, satinAlindi, geriYuklendi, iptal, hata }

/// Mağazanın bildirdiği bir satın alma olayı. [kimlik] SUNUCUYA gönderilen anahtardır (Google: satın alma belirteci, Apple: işlem kimliği);
/// erişim bununla değil, sunucunun mağazaya sormasıyla açılır. [ham] yalnızca [MagazaKoprusu.tamamla] içindir.
class MagazaOlayi {
  final MagazaOlayTuru tur;
  final String urunId;
  final String platform; // 'google' | 'apple'
  final String kimlik;
  final String mesaj;
  final Object? ham;
  const MagazaOlayi(this.tur, {this.urunId = '', this.platform = '', this.kimlik = '', this.mesaj = '', this.ham});
}

/// Mağaza ile tek konuşma yüzeyi. Gerçek uygulama [GercekMagazaKoprusu]'nu, testler sahte köprüyü kullanır.
abstract class MagazaKoprusu {
  String get platform;
  Stream<MagazaOlayi> get olaylar;
  Future<bool> kullanilabilir();
  Future<List<MagazaUrunu>> urunleriOku(Set<String> idler);
  Future<void> satinAl(String urunId, String hesapKimligi);
  Future<void> geriYukle();

  /// Mağazanın abonelik yönetim sayfasını açar. Açılamazsa false (ekran elle yol tarif eder).
  Future<bool> abonelikleriYonet();

  /// Mağazaya "bu işlemi tamamladım" der (Android'de onay/acknowledge, iOS'ta işlemi bitirir). YALNIZCA sunucu doğruladıktan sonra çağrılır.
  Future<void> tamamla(MagazaOlayi olay);
  void kapat();
}

/// Google Play Billing (Android) ve StoreKit (iOS) üzerinden `in_app_purchase` eklentisi.
class GercekMagazaKoprusu implements MagazaKoprusu {
  final InAppPurchase _iap;
  final Map<String, ProductDetails> _urunler = {};
  GercekMagazaKoprusu({InAppPurchase? iap}) : _iap = iap ?? InAppPurchase.instance;

  @override
  String get platform => Platform.isIOS ? 'apple' : 'google';

  @override
  Stream<MagazaOlayi> get olaylar => _iap.purchaseStream.expand((liste) => liste.map(_cevir));

  MagazaOlayi _cevir(PurchaseDetails p) {
    final hamKimlik = platform == 'apple' ? (p.purchaseID ?? '') : p.verificationData.serverVerificationData;
    switch (p.status) {
      case PurchaseStatus.pending:
        return MagazaOlayi(MagazaOlayTuru.bekliyor, urunId: p.productID, platform: platform, ham: p);
      case PurchaseStatus.purchased:
        return MagazaOlayi(MagazaOlayTuru.satinAlindi, urunId: p.productID, platform: platform, kimlik: hamKimlik, ham: p);
      case PurchaseStatus.restored:
        return MagazaOlayi(MagazaOlayTuru.geriYuklendi, urunId: p.productID, platform: platform, kimlik: hamKimlik, ham: p);
      case PurchaseStatus.canceled:
        return MagazaOlayi(MagazaOlayTuru.iptal, urunId: p.productID, platform: platform, ham: p);
      case PurchaseStatus.error:
        return MagazaOlayi(MagazaOlayTuru.hata, urunId: p.productID, platform: platform, mesaj: p.error?.message ?? '', ham: p);
    }
  }

  @override
  Future<bool> kullanilabilir() => _iap.isAvailable();

  @override
  Future<List<MagazaUrunu>> urunleriOku(Set<String> idler) async {
    final y = await _iap.queryProductDetails(idler);
    if (y.error != null) throw StateError(y.error!.message);
    _urunler
      ..clear()
      ..addEntries(y.productDetails.map((d) => MapEntry(d.id, d)));
    return y.productDetails.map((d) => MagazaUrunu(id: d.id, ad: d.title, fiyat: d.price)).toList();
  }

  @override
  Future<void> satinAl(String urunId, String hesapKimligi) async {
    final d = _urunler[urunId];
    if (d == null) throw StateError('Ürün mağazadan okunamadı.');
    // Abonelikler eklentide buyNonConsumable ile satın alınır. applicationUserName: Google'da "obfuscatedAccountId" olur ve sunucu bunu doğrular.
    final basladi = await _iap.buyNonConsumable(purchaseParam: PurchaseParam(productDetails: d, applicationUserName: hesapKimligi));
    if (!basladi) throw StateError('Satın alma başlatılamadı.');
  }

  @override
  Future<void> geriYukle() => _iap.restorePurchases();

  @override
  Future<bool> abonelikleriYonet() async {
    try {
      return await launchUrl(abonelikAdresi(platform), mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> tamamla(MagazaOlayi olay) async {
    final p = olay.ham;
    if (p is PurchaseDetails && p.pendingCompletePurchase) await _iap.completePurchase(p);
  }

  @override
  void kapat() {}
}
