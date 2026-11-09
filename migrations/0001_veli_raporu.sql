-- AKE Akademi · Haftalık veli raporu · D1 migration 0001
-- Elle ve onay sonrası çalıştırılır:  wrangler d1 execute <VERITABANI_ADI> --remote --file=migrations/0001_veli_raporu.sql
-- Yalnızca yeni tablo ekler; mevcut tablolara dokunmaz. Tekrar çalıştırmak güvenlidir (IF NOT EXISTS).

-- Öğrencinin veli raporu ayarı (varsayılan: kapalı)
CREATE TABLE IF NOT EXISTS veli_ayar (
  kid TEXT PRIMARY KEY,
  veli_eposta TEXT,
  durum TEXT NOT NULL DEFAULT 'yok',      -- yok | bekliyor | onayli | iptal
  etkin INTEGER NOT NULL DEFAULT 0,        -- öğrenci açık mı (1) kapalı mı (0)
  yas_grubu TEXT,                          -- yetiskin | kucuk (öğrencinin beyanı)
  onay_tarih INTEGER,
  onay_surum TEXT,
  onayli_hash TEXT,                        -- onay verilen adresin özeti; adres değişirse eşleşmez
  son_gonderim INTEGER,
  guncelleme INTEGER
);

-- Tek kullanımlık, süreli bağlantı belirteçleri (düz metin SAKLANMAZ, yalnızca özet)
CREATE TABLE IF NOT EXISTS veli_token (
  hash TEXT PRIMARY KEY,
  kid TEXT NOT NULL,
  tur TEXT NOT NULL,                       -- onay | yonet
  veli_hash TEXT,
  bitis INTEGER NOT NULL,
  kullanildi INTEGER NOT NULL DEFAULT 0,
  tarih INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS veli_token_kid ON veli_token (kid);

-- Gönderim kayıtları; (öğrenci, hafta, adres) tekil olduğu için aynı hafta mükerrer gönderim olmaz
CREATE TABLE IF NOT EXISTS veli_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kid TEXT NOT NULL,
  hafta TEXT NOT NULL,                     -- ISO hafta, ör. 2026-W46
  veli_hash TEXT NOT NULL,
  veli_maske TEXT,                         -- a***@gmail.com
  durum TEXT NOT NULL,                     -- bekliyor | gonderiliyor | gonderildi | hata
  deneme INTEGER NOT NULL DEFAULT 0,
  hata TEXT,
  sonraki INTEGER,
  tarih INTEGER NOT NULL,
  UNIQUE (kid, hafta, veli_hash)
);
CREATE INDEX IF NOT EXISTS veli_log_tarih ON veli_log (tarih);

-- İzin ve ayar değişikliklerinin denetim kaydı (e-posta adresi yazılmaz)
CREATE TABLE IF NOT EXISTS veli_denetim (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kid TEXT NOT NULL,
  olay TEXT NOT NULL,
  ayrinti TEXT,
  tarih INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS veli_denetim_kid ON veli_denetim (kid, tarih);
