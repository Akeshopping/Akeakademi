-- AKE Akademi · B3 · canlı deneme açılış kaydı
-- Yalnızca YENİ bir tablo ekler; mevcut tablolara/verilere (canli, canli_sonuc, kullanıcılar) dokunmaz. Tekrar çalıştırılabilir (IF NOT EXISTS).
-- Her satır: bir öğrencinin bir canlı denemenin sorularını sunucudan İLK açtığı an (ms). İlk kayıt geçerlidir; üzerine yazılmaz.
-- Uygulama aynı tabloyu ilk kullanımda kendisi de oluşturur (lib/sosyal.js, diğer sosyal tablolar gibi); bu dosya önceden/ayrıca uygulama içindir.
CREATE TABLE IF NOT EXISTS canli_acilis (
  canli   TEXT NOT NULL,
  kid     TEXT NOT NULL,
  acilis  INTEGER NOT NULL,
  PRIMARY KEY (canli, kid)
) WITHOUT ROWID;
