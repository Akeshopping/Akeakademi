import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// Emülatörde alınan ekran görüntülerini ekran-kanit/ klasörüne yazar (CI bunları yayınlar).
Future<void> main() async {
  await integrationDriver(
    onScreenshot: (String ad, List<int> bayt, [Map<String, Object?>? args]) async {
      final f = File('ekran-kanit/$ad.png');
      await f.create(recursive: true);
      await f.writeAsBytes(bayt);
      return true;
    },
  );
}
