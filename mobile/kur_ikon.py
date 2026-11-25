#!/usr/bin/env python3
"""Android başlatıcı ikonu + açılış zemini: sitedeki gerçek K amblemi (docs/tasarim/gen_icons.py ile AYNI path).
flutter create'in ürettiği varsayılan Flutter ikonlarının yerine geçer. Yalnızca standart kütüphane."""
import pathlib, shutil
kok = pathlib.Path(__file__).resolve().parent
res = kok / 'android/app/src/main/res'
kaynak = kok / 'assets/android-ikon'
if not res.exists():
    print('android/ yok, ikon atlandı'); raise SystemExit(0)
for d in kaynak.iterdir():
    if not d.is_dir():
        continue
    hedef = res / d.name
    hedef.mkdir(parents=True, exist_ok=True)
    for f in d.glob('*.png'):
        shutil.copy2(f, hedef / f.name)
(res / 'mipmap-anydpi-v26').mkdir(parents=True, exist_ok=True)
(res / 'mipmap-anydpi-v26/ic_launcher.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@color/ake_murekkep"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n', encoding='utf-8')
(res / 'values').mkdir(parents=True, exist_ok=True)
(res / 'values/ake_renkler.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ake_murekkep">#28232C</color>\n</resources>\n', encoding='utf-8')
zemin = ('<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
         '    <item android:drawable="@color/ake_murekkep"/>\n</layer-list>\n')
for ad in ('drawable', 'drawable-v21'):
    (res / ad).mkdir(parents=True, exist_ok=True)
    (res / ad / 'launch_background.xml').write_text(zemin, encoding='utf-8')
# Android 12+ sistem açılış ekranı varsayılan olarak uygulama ikonunu (K) gösterir; animasyonumuz zaten K ile biter.
# Bu yüzden sistem ekranı yalnız aynı koyu zemin olur (K → noktalar → K akışı oluşmaz), animasyonun ilk karesiyle aynı renkte.
(res / 'drawable/ake_bos_ikon.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n'
    '    <solid android:color="#00000000"/>\n    <size android:width="1dp" android:height="1dp"/>\n</shape>\n', encoding='utf-8')
v31 = ('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
       '    <style name="LaunchTheme" parent="@android:style/Theme.Light.NoTitleBar">\n'
       '        <item name="android:windowBackground">@drawable/launch_background</item>\n'
       '        <item name="android:windowSplashScreenBackground">@color/ake_murekkep</item>\n'
       '        <item name="android:windowSplashScreenAnimatedIcon">@drawable/ake_bos_ikon</item>\n'
       '        <item name="android:forceDarkAllowed">false</item>\n'
       '        <item name="android:windowFullscreen">false</item>\n'
       '        <item name="android:windowDrawsSystemBarBackgrounds">false</item>\n'
       '        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>\n'
       '    </style>\n'
       '    <style name="NormalTheme" parent="@android:style/Theme.Light.NoTitleBar">\n'
       '        <item name="android:windowBackground">?android:colorBackground</item>\n'
       '    </style>\n</resources>\n')
for ad in ('values-v31', 'values-night-v31'):
    (res / ad).mkdir(parents=True, exist_ok=True)
    (res / ad / 'styles.xml').write_text(v31, encoding='utf-8')
print('AKE K ikonu ve koyu açılış zemini uygulandı.')
