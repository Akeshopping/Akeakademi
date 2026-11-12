-- AKE Akademi · B2 · dağıtık hız sınırlayıcı tablosu (lib/hiz.js)
-- Yalnızca YENİ tablo ve indeks ekler; mevcut tablolara/verilere dokunmaz. Tekrar çalıştırılabilir (IF NOT EXISTS).
-- Satırlar geçicidir: bitis geçince uygulama tarafından otomatik silinir. IP/kimlik AÇIK METİN saklanmaz (anahtar = tuzlu SHA-256).
-- UYGULAMA SIRASI ve komutlar: docs/b2-hiz-siniri-dagitim.md  (bu dosya otomatik çalışmaz)
CREATE TABLE IF NOT EXISTS hiz (
  anahtar TEXT PRIMARY KEY,
  pencere INTEGER NOT NULL,
  adet    INTEGER NOT NULL,
  bitis   INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS hiz_bitis ON hiz (bitis);
