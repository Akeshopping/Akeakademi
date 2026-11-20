-- "Açıldığında haber ver" (erken erişim) listesi. Uygulama bu tabloyu ilk istekte CREATE TABLE IF NOT EXISTS ile kendisi de oluşturur
-- (lib/liste.js listeSema); bu dosya şemanın belgesi ve elle kurulum içindir. Numara: 0003, açık PR #33'te (soru fabrikası) kullanılıyor.
CREATE TABLE IF NOT EXISTS bekleme (
  eposta TEXT PRIMARY KEY,        -- küçük harf, normalize
  durum TEXT NOT NULL,            -- 'bekliyor' (onay e-postası gitti) | 'onayli'
  paket TEXT,                     -- 'atilim' | 'premium' | 'ikisi'
  kayit INTEGER,                  -- ilk kayıt zamanı (ms)
  onay_hash TEXT,                 -- onay belirtecinin gizli anahtarlı SHA-256 özeti
  onay_son INTEGER,               -- onay bağlantısının son geçerlilik zamanı (48 sa)
  onay_zaman INTEGER,             -- onaylandığı zaman
  son_gonderim INTEGER,           -- son onay e-postası zamanı (10 dk yeniden gönderim sınırı)
  izin_surum TEXT,                -- gösterilen izin/aydınlatma metni sürümü
  izin_zaman INTEGER,
  ip_ozet TEXT                    -- IP'nin gizli anahtarlı kısa özeti (açık IP tutulmaz)
);
CREATE INDEX IF NOT EXISTS bekleme_onay ON bekleme (onay_hash);
