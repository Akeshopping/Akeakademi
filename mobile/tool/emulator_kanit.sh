#!/usr/bin/env bash
# Emülatörde (CI) ekran kanıtı: 320 ve 390 dp genişlikte ekran yürüyüşü + GERÇEK ZAMANLI açılış kaydı. Çıktı: mobile/kanit/
set -uo pipefail
cd "$(dirname "$0")/.."
PAKET=com.akeakademi.ake_akademi
APK=${1:-kanit-apk/ake-release.apk}   # GERÇEK uygulama (lib/main.dart, release). flutter drive başka bir APK (test girişi) kurar; ikisi karışmamalı.
mkdir -p kanit
adb wait-for-device
adb shell input keyevent 82 || true
adb shell settings put global window_animation_scale 1 || true
adb shell settings put global transition_animation_scale 1 || true
adb shell settings put global animator_duration_scale 1 || true
cihaz() { # $1=mantıksal dp genişlik
  case "$1" in
    320) adb shell wm size 720x1520; adb shell wm density 360;;
    390) adb shell wm size 1170x2400; adb shell wm density 480;;
  esac
  sleep 3
  echo "EKRAN $1 dp: $(adb shell wm size | tr -d '\r' | tail -1) / $(adb shell wm density | tr -d '\r' | tail -1)" | tee -a kanit/cihaz.txt
}
adb shell getprop ro.product.model | tr -d '\r' | sed 's/^/EMULATOR_MODEL=/' | tee kanit/cihaz.txt
adb shell getprop ro.build.version.release | tr -d '\r' | sed 's/^/ANDROID=/' | tee -a kanit/cihaz.txt

# 1) ekran yürüyüşü (flutter drive; test verisi = sahte sunucu)
for G in 320 390; do
  cihaz $G
  flutter drive --no-pub --driver=test_driver/integration_test.dart --target=integration_test/ekranlar_test.dart -d emulator-5554 \
    --dart-define=GENISLIK=$G 2>&1 | tee kanit/drive-$G.log || echo "DRIVE_HATA_$G" | tee -a kanit/cihaz.txt
done
mkdir -p kanit/ekranlar && cp -r ekran-kanit/*.png kanit/ekranlar/ 2>/dev/null || true

# 2) GERÇEK UYGULAMA (Preview adresli debug APK): ilk açılış animasyonu, gerçek zamanlı ekran kaydı
adb uninstall $PAKET >/dev/null 2>&1 || true   # drive'ın kurduğu test derlemesini kaldır
adb install "$APK" && echo "GERCEK_APK_KURULDU $(basename "$APK")" | tee -a kanit/cihaz.txt
adb shell dumpsys package $PAKET | grep -E "versionName|debuggable|flags=" | head -3 | tee -a kanit/cihaz.txt
kayit() { # $1=dp $2=ad $3=pm clear? $4=hareket(1=normal,0=azalt)
  cihaz $1
  adb shell settings put global animator_duration_scale $4
  [ "$3" = "temiz" ] && adb shell pm clear $PAKET >/dev/null
  adb shell am force-stop $PAKET
  adb shell rm -f /sdcard/$2.mp4
  ( adb shell screenrecord --time-limit 9 --bit-rate 8000000 /sdcard/$2.mp4 ) &
  sleep 1.5
  adb shell am start -W -n $PAKET/.MainActivity >/dev/null
  sleep 9
  wait || true
  sleep 1
  adb pull /sdcard/$2.mp4 kanit/$2.mp4 >/dev/null 2>&1 || echo "KAYIT_ALINAMADI_$2" | tee -a kanit/cihaz.txt
  adb exec-out screencap -p > kanit/$2-son.png
}
kayit 390 acilis-390-ilk-acilis temiz 1
kayit 320 acilis-320-ilk-acilis temiz 1
kayit 390 acilis-390-ikinci-acilis kal 1      # bayrak kaydedildi: animasyon OYNAMAMALI
kayit 320 acilis-320-hareket-azalt temiz 0     # sistem animasyonları kapalı: animasyon OYNAMAMALI
adb shell settings put global animator_duration_scale 1

# 3) videolardan kareler (ffmpeg varsa) ve süre bilgisi
if command -v ffmpeg >/dev/null; then
  for v in kanit/acilis-*.mp4; do
    ad=$(basename "$v" .mp4)
    ffprobe -v error -show_entries format=duration -of csv=p=0 "$v" 2>/dev/null | sed "s/^/SURE_SN $ad=/" | tee -a kanit/cihaz.txt
    ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$v" 2>/dev/null | sed "s/^/KARE_SAYISI $ad=/" | tee -a kanit/cihaz.txt
    ffmpeg -v error -y -i "$v" -vf "fps=5,scale=160:-1,tile=8x5" -frames:v 1 "kanit/$ad-kareler.png" || true
  done
fi
adb shell wm size reset; adb shell wm density reset
echo "bitti"
