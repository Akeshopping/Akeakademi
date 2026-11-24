# Windows PowerShell: android/ ve ios/ klasörlerini üretir ve AKE ayarlarını uygular.
# Kullanım:  cd mobile ; powershell -ExecutionPolicy Bypass -File .\kur.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) { throw 'Flutter bulunamadı: https://docs.flutter.dev/get-started/install/windows' }
flutter create --platforms=android,ios --org com.akeakademi --project-name ake_akademi .
if ($LASTEXITCODE -ne 0) { throw 'flutter create başarısız' }

$m = 'android\app\src\main\AndroidManifest.xml'
if (Test-Path $m) {
  $s = [IO.File]::ReadAllText((Resolve-Path $m))
  if ($s -notmatch 'android.permission.INTERNET') { $s = ([regex]'<application').Replace($s, "<uses-permission android:name=`"android.permission.INTERNET`"/>`n    <application", 1) }
  $s = ([regex]'android:label="[^"]*"').Replace($s, 'android:label="AKE Akademi"', 1)
  if ($s -notmatch 'android:allowBackup') { $s = ([regex]'<application').Replace($s, '<application android:allowBackup="false"', 1) }
  [IO.File]::WriteAllText((Resolve-Path $m), $s, (New-Object Text.UTF8Encoding($false)))
}
$p = 'ios\Runner\Info.plist'
if (Test-Path $p) {
  $s = [IO.File]::ReadAllText((Resolve-Path $p))
  $s = ([regex]'(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)').Replace($s, '${1}AKE Akademi${2}', 1)
  [IO.File]::WriteAllText((Resolve-Path $p), $s, (New-Object Text.UTF8Encoding($false)))
}
flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'flutter pub get başarısız' }
Write-Host 'Hazır. Test: flutter test | Çalıştır: flutter run --dart-define=AKE_API=https://mobil-ake-ilk-surum.akeakademi.pages.dev'
