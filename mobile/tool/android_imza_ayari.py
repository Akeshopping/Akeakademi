#!/usr/bin/env python3
"""Release imzalama ayarı (kur.sh / kur.ps1 çağırır). Anahtar bilgisi REPODA YOKTUR: android/key.properties'ten (git'te yok) okunur.
Davranış:
  - key.properties VARSA release derlemesi yükleme anahtarıyla imzalanır.
  - key.properties YOKSA ve görev bir "bundle" (AAB) ise imza EKLENMEZ -> dosya İMZASIZ çıkar (debug anahtarına sessizce düşülmez).
  - key.properties YOKSA ve görev APK ise eski davranış: debug anahtarı (yalnız test/emülatör için).
Şablon beklenmedik biçimdeyse sessizce geçmez: hata verip durur."""
import pathlib, re, sys

for ad, kt in (('android/app/build.gradle.kts', True), ('android/app/build.gradle', False)):
    g = pathlib.Path(ad)
    if g.exists():
        break
else:
    sys.exit('HATA: android/app/build.gradle(.kts) bulunamadı (flutter create çalıştı mı?)')

s = g.read_text(encoding='utf-8')
if 'AKE: yükleme anahtarı' in s:
    print('İmza ayarı zaten uygulanmış.'); sys.exit(0)

if kt:
    baslik = ('// AKE: yükleme anahtarı key.properties dosyasından okunur (repoda YOK; bkz. docs/android-kapali-test.md)\n'
              'val akeAnahtarDosyasi = rootProject.file("key.properties")\n'
              'val akeAnahtar = Properties().apply { if (akeAnahtarDosyasi.exists()) load(FileInputStream(akeAnahtarDosyasi)) }\n'
              'val akeBundleGorevi = gradle.startParameter.taskNames.any { it.contains("bundle", ignoreCase = true) }\n\n')
    blok = ('    signingConfigs {\n'
            '        if (akeAnahtarDosyasi.exists()) {\n'
            '            create("release") {\n'
            '                keyAlias = akeAnahtar["keyAlias"] as String\n'
            '                keyPassword = akeAnahtar["keyPassword"] as String\n'
            '                storeFile = file(akeAnahtar["storeFile"] as String)\n'
            '                storePassword = akeAnahtar["storePassword"] as String\n'
            '            }\n'
            '        }\n'
            '    }\n')
    imza = 'signingConfig = if (akeAnahtarDosyasi.exists()) signingConfigs.getByName("release") else if (akeBundleGorevi) null else signingConfigs.getByName("debug")'
else:
    baslik = ('// AKE: yükleme anahtarı key.properties dosyasından okunur (repoda YOK; bkz. docs/android-kapali-test.md)\n'
              'def akeAnahtarDosyasi = rootProject.file("key.properties")\n'
              'def akeAnahtar = new Properties()\n'
              'if (akeAnahtarDosyasi.exists()) { akeAnahtar.load(new FileInputStream(akeAnahtarDosyasi)) }\n'
              'def akeBundleGorevi = gradle.startParameter.taskNames.any { it.toLowerCase().contains("bundle") }\n\n')
    blok = ('    signingConfigs {\n'
            '        release {\n'
            '            if (akeAnahtarDosyasi.exists()) {\n'
            '                keyAlias akeAnahtar["keyAlias"]\n'
            '                keyPassword akeAnahtar["keyPassword"]\n'
            '                storeFile file(akeAnahtar["storeFile"])\n'
            '                storePassword akeAnahtar["storePassword"]\n'
            '            }\n'
            '        }\n'
            '    }\n')
    imza = 'signingConfig akeAnahtarDosyasi.exists() ? signingConfigs.release : (akeBundleGorevi ? null : signingConfigs.debug)'

# release tipindeki debug imzasını değiştir
yeni, n = re.subn(r'signingConfig\s*=?\s*signingConfigs(?:\.getByName\("debug"\)|\.debug)', imza, s, count=1)
if n != 1:
    sys.exit('HATA: release buildType içindeki debug imza satırı bulunamadı; şablon değişmiş olabilir.')
s = yeni
# android { satırından önce başlık, hemen sonra signingConfigs bloğu
m = re.search(r'^android\s*\{\s*\n', s, flags=re.M)
if not m:
    sys.exit('HATA: android { bloğu bulunamadı.')
s = s[:m.start()] + baslik + s[m.start():m.end()] + blok + s[m.end():]
if kt:
    s = 'import java.io.FileInputStream\nimport java.util.Properties\n\n' + s   # 'java' adı Gradle'da eklenti uzantısını gölgeler; içe aktarma şart
g.write_text(s, encoding='utf-8')
print('Release imza ayarı uygulandı (anahtar yoksa AAB imzasız çıkar).')
