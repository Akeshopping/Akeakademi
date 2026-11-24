/// Derleme zamanı ayarları. Hiçbir gizli anahtar, API anahtarı veya yönetici bilgisi uygulamaya GÖMÜLMEZ;
/// oturum anahtarı yalnızca giriş sonrası cihazın güvenli deposunda (Android Keystore / iOS Keychain) tutulur.
///
/// Örnek: flutter run --dart-define=AKE_API=https://tasarim-erken-erisim-acilis.akeakademi.pages.dev
class Yapilandirma {
  /// Sunucu adresi (sonunda eğik çizgi olmadan).
  static const String api = String.fromEnvironment('AKE_API', defaultValue: 'https://akeakademi.com');
  static const String surum = '0.1.0';
}
