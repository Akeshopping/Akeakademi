#!/usr/bin/env bash
# AAB doğrulaması (CI ve elle). Kullanım: tool/aab_dogrula.sh <aab> <beklenen_paket> <beklenen_api> <beklenen_versionCode> <imza_bekleniyor: evet|hayir> [kayit_dosyasi]
# Parola/anahtar OKUMAZ ve YAZMAZ; yalnız AAB'nin kendisini inceler. Çıkış kodu 0 = beklentilerle uyumlu (imza beklentisi dahil).
set -uo pipefail
AAB=$1; PAKET=$2; API=$3; VKOD=$4; IMZALI=$5; KAYIT=${6:-aab-kayit/aab-kaydi.txt}
BT_SURUM=1.18.1
BT_SHA256=675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c
mkdir -p "$(dirname "$KAYIT")"
BT=${BUNDLETOOL_JAR:-${RUNNER_TEMP:-/tmp}/bundletool-$BT_SURUM.jar}
if [ ! -f "$BT" ]; then
  curl -fsSL -o "$BT" "https://github.com/google/bundletool/releases/download/$BT_SURUM/bundletool-all-$BT_SURUM.jar" || { echo "HATA: bundletool indirilemedi"; exit 1; }
fi
echo "$BT_SHA256  $BT" | sha256sum -c - >/dev/null || { echo "HATA: bundletool sha256 uyuşmuyor"; exit 1; }

HATA=0
sat() { echo "$*" | tee -a "$KAYIT"; }
ok() { sat "  [GEÇTİ] $*"; }
kal() { sat "  [KALDI] $*"; HATA=1; }
: > "$KAYIT"
sat "aab_dosya: $(basename "$AAB")"
sat "aab_sha256: $(sha256sum "$AAB" | cut -d' ' -f1)"
sat "aab_boyut: $(stat -c %s "$AAB")"
[ -n "${GITHUB_SHA:-}" ] && sat "commit: $GITHUB_SHA"
[ -n "${GITHUB_RUN_ID:-}" ] && sat "calisma: ${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/$GITHUB_RUN_ID"

MAN=$(java -jar "$BT" dump manifest --bundle="$AAB" 2>/dev/null) || { echo "HATA: manifest okunamadı"; exit 1; }
sat "--- manifest ---"
grep -qF "package=\"$PAKET\"" <<<"$MAN" && ok "paket kimliği $PAKET" || kal "paket kimliği $PAKET değil"
VC=$(grep -oE 'android:versionCode="[0-9]+"' <<<"$MAN" | head -1 | grep -oE '[0-9]+')
VN=$(grep -oE 'android:versionName="[^"]*"' <<<"$MAN" | head -1 | cut -d'"' -f2)
sat "  sürüm kodu: ${VC:-?}  sürüm adı: ${VN:-?}"
[ "${VC:-}" = "$VKOD" ] && ok "sürüm kodu $VKOD" || kal "sürüm kodu beklenen $VKOD değil"
grep -qF 'android:name="com.android.vending.BILLING"' <<<"$MAN" && ok "Play Billing izni (com.android.vending.BILLING)" || kal "Play Billing izni YOK"
grep -qF 'android:name="android.permission.INTERNET"' <<<"$MAN" && ok "INTERNET izni" || kal "INTERNET izni YOK"
if grep -qE 'android:debuggable="true"' <<<"$MAN"; then kal "debuggable=true (release olmamalı)"; else ok "debuggable değil"; fi
sat "  minSdk: $(grep -oE 'android:minSdkVersion="[0-9]+"' <<<"$MAN" | head -1 | grep -oE '[0-9]+')  targetSdk: $(grep -oE 'android:targetSdkVersion="[0-9]+"' <<<"$MAN" | head -1 | grep -oE '[0-9]+')"

sat "--- gömülü API adresleri (libapp.so) ---"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for ABI in arm64-v8a armeabi-v7a x86_64; do
  if unzip -p "$AAB" "base/lib/$ABI/libapp.so" > "$TMP/libapp.so" 2>/dev/null && [ -s "$TMP/libapp.so" ]; then
    ADR=$(strings -n 8 "$TMP/libapp.so" | grep -oE 'https://[A-Za-z0-9.-]+\.(pages\.dev|com)' | sort | uniq -c)
    sat "  [$ABI]"
    echo "$ADR" | sed 's/^/    /' | tee -a "$KAYIT"
    grep -qF "${API#https://}" <<<"$ADR" && ok "$ABI: beklenen Preview adresi gömülü (${API#https://})" || kal "$ABI: beklenen adres YOK"
    grep -q 'mobil-ake-ilk-surum' <<<"$ADR" && kal "$ABI: eski dal adresi gömülü"
  fi
done
[ -s "$TMP/libapp.so" ] || kal "libapp.so okunamadı (adres doğrulanamadı)"

sat "--- imza ---"
JS=$(jarsigner -verify "$AAB" 2>&1 || true)
CERT=$(keytool -printcert -jarfile "$AAB" 2>&1 || true)
if grep -qiE "jar is unsigned|no manifest" <<<"$JS"; then
  sat "  imza: YOK (imzasız)"
  [ "$IMZALI" = "hayir" ] && ok "beklendiği gibi imzasız" || kal "imza bekleniyordu ama AAB imzasız"
  YUKLENEBILIR=hayir
elif grep -qi "jar verified" <<<"$JS"; then
  sat "  imza: var"; grep -E "Owner:|SHA256:|Valid from" <<<"$CERT" | head -4 | sed 's/^/    /' | tee -a "$KAYIT" >/dev/null
  if grep -qiE "Owner:.*(Android Debug|CN=Android Debug)" <<<"$CERT"; then kal "debug anahtarıyla imzalanmış: Play reddeder"; YUKLENEBILIR=hayir
  elif [ "$IMZALI" = "evet" ]; then ok "yükleme anahtarıyla imzalı (debug değil)"; YUKLENEBILIR=evet
  else kal "imzasız bekleniyordu ama imzalı"; YUKLENEBILIR=hayir; fi
else
  kal "imza durumu okunamadı"; YUKLENEBILIR=hayir
fi
[ "$HATA" != 0 ] && YUKLENEBILIR=hayir
sat "--- sonuç ---"
sat "play_e_yuklenebilir: $YUKLENEBILIR"
[ "$YUKLENEBILIR" = "hayir" ] && sat "  (imzasız ya da denetimi kalan dosya Play'e yüklenemez)"
exit $HATA
