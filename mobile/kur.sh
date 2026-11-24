#!/usr/bin/env bash
# Android ve iOS platform klasörlerini üretir ve AKE ayarlarını uygular. Flutter SDK (>=3.22) kurulu olmalı.
# Kullanım: cd mobile && ./kur.sh
set -euo pipefail
cd "$(dirname "$0")"
command -v flutter >/dev/null || { echo "Flutter bulunamadı: https://docs.flutter.dev/get-started/install"; exit 1; }
# lib/, test/, pubspec.yaml korunur; yalnızca eksik android/ ve ios/ dosyaları oluşturulur.
flutter create --platforms=android,ios --org com.akeakademi --project-name ake_akademi .
python3 - <<'PY'
import re, pathlib
m = pathlib.Path('android/app/src/main/AndroidManifest.xml')
if m.exists():
    s = m.read_text(encoding='utf-8')
    if 'android.permission.INTERNET' not in s:
        s = s.replace('<application', '<uses-permission android:name="android.permission.INTERNET"/>\n    <application', 1)
    s = re.sub(r'android:label="[^"]*"', 'android:label="AKE Akademi"', s, count=1)
    if 'android:allowBackup' not in s:
        s = s.replace('<application', '<application android:allowBackup="false"', 1)
    m.write_text(s, encoding='utf-8')
p = pathlib.Path('ios/Runner/Info.plist')
if p.exists():
    s = p.read_text(encoding='utf-8')
    s = re.sub(r'(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)', r'\1AKE Akademi\2', s, count=1)
    p.write_text(s, encoding='utf-8')
print('Platform ayarları uygulandı.')
PY
rm -f test/widget_test.dart   # flutter create şablon testi (bu uygulamaya ait değil)
flutter pub get
echo "Hazır. Test: flutter test | Çalıştır: flutter run --dart-define=AKE_API=<Preview adresi>"
