import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Oturum anahtarının saklandığı yer. Üretimde cihazın güvenli deposu; testlerde bellek.
abstract class OturumDeposu {
  Future<String?> oku();
  Future<void> yaz(String anahtar);
  Future<void> sil();
}

class GuvenliDepo implements OturumDeposu {
  static const _ad = 'ake_oturum_anahtari';
  final FlutterSecureStorage _d;
  GuvenliDepo([FlutterSecureStorage? depo])
      : _d = depo ?? const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  @override
  Future<String?> oku() => _d.read(key: _ad);
  @override
  Future<void> yaz(String anahtar) => _d.write(key: _ad, value: anahtar);
  @override
  Future<void> sil() => _d.delete(key: _ad);
}

class BellekDeposu implements OturumDeposu {
  String? _v;
  BellekDeposu([this._v]);
  @override
  Future<String?> oku() async => _v;
  @override
  Future<void> yaz(String anahtar) async => _v = anahtar;
  @override
  Future<void> sil() async => _v = null;
}

/// Küçük uygulama ayarları (tema, açılış animasyonu görüldü mü). Oturum anahtarından ayrı tutulur; çıkışta silinmez.
abstract class AyarDeposu {
  Future<String?> oku(String ad);
  Future<void> yaz(String ad, String deger);
}

class GuvenliAyar implements AyarDeposu {
  final FlutterSecureStorage _d;
  GuvenliAyar([FlutterSecureStorage? depo])
      : _d = depo ?? const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  @override
  Future<String?> oku(String ad) => _d.read(key: 'ake_ayar_$ad');
  @override
  Future<void> yaz(String ad, String deger) => _d.write(key: 'ake_ayar_$ad', value: deger);
}

class BellekAyar implements AyarDeposu {
  final Map<String, String> _m;
  BellekAyar([Map<String, String>? ilk]) : _m = {...?ilk};
  @override
  Future<String?> oku(String ad) async => _m[ad];
  @override
  Future<void> yaz(String ad, String deger) async => _m[ad] = deger;
}
