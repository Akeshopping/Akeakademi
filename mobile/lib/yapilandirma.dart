import 'package:flutter/foundation.dart';

/// Derleme zamanı ayarları. Hiçbir gizli anahtar, API anahtarı veya yönetici bilgisi uygulamaya GÖMÜLMEZ;
/// oturum anahtarı yalnızca giriş sonrası cihazın güvenli deposunda (Android Keystore / iOS Keychain) tutulur.
///
/// Sunucu adresi VARSAYILAN DEĞİL, zorunludur (`--dart-define=AKE_API=https://...`):
/// - adres verilmezse uygulama açılmaz (yapılandırma hata ekranı),
/// - Production adresine (akeakademi.com) yalnızca RELEASE derlemesi bağlanabilir; debug/profile/test derlemesi için ayrıca
///   `--dart-define=AKE_URETIM_ONAY=evet` gerekir. Böylece test derlemesi yanlışlıkla canlı API'ye gitmez.
/// - Test/Preview için mobil dalın kendi Preview adresi kullanılır (README'deki "Sunucu adresi" bölümü).
class Yapilandirma {
  static const String _apiTanim = String.fromEnvironment('AKE_API');
  static const String _uretimOnayTanim = String.fromEnvironment('AKE_URETIM_ONAY');
  static const String surum = '0.1.0';

  /// Production alan adları (www dahil).
  static const List<String> uretimSunuculari = ['akeakademi.com', 'www.akeakademi.com'];

  /// Doğrulanmış sunucu adresi ya da [YapilandirmaHatasi] atar.
  static String api() => dogrula(_apiTanim, yayinDerlemesi: kReleaseMode, uretimOnay: _uretimOnayTanim == 'evet');

  /// Saf doğrulama (testlenebilir): adresi normalleştirip döner.
  static String dogrula(String ham, {required bool yayinDerlemesi, bool uretimOnay = false}) {
    final a = ham.trim().replaceAll(RegExp(r'/+$'), '');
    if (a.isEmpty) {
      throw const YapilandirmaHatasi('Sunucu adresi verilmemiş. --dart-define=AKE_API=https://<adres> ile derle.');
    }
    final u = Uri.tryParse(a);
    if (u == null || !u.hasAuthority || u.host.isEmpty) {
      throw const YapilandirmaHatasi('Sunucu adresi geçersiz.');
    }
    final yerel = u.host == 'localhost' || u.host == '10.0.2.2' || u.host == '127.0.0.1';
    if (u.scheme != 'https' && !(u.scheme == 'http' && yerel && !yayinDerlemesi)) {
      throw const YapilandirmaHatasi('Sunucu adresi https olmalı (yalnızca yerel geliştirmede http kabul edilir).');
    }
    if (u.path.isNotEmpty || u.hasQuery || u.hasFragment) {
      throw const YapilandirmaHatasi('Sunucu adresi yalnızca alan adı içermeli (yol, sorgu ya da # olmadan).');
    }
    if (uretimSunuculari.contains(u.host.toLowerCase()) && !yayinDerlemesi && !uretimOnay) {
      throw const YapilandirmaHatasi(
          'Production API\'sine yalnızca release derlemesi bağlanabilir. Test için mobil dalın Preview adresini kullan.');
    }
    return a;
  }
}

class YapilandirmaHatasi implements Exception {
  final String mesaj;
  const YapilandirmaHatasi(this.mesaj);
  @override
  String toString() => mesaj;
}
