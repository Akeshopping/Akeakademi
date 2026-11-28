-- Mağaza (Google Play / App Store) abonelik işlemleri. Erişim yalnızca sunucunun mağazadan doğruladığı satırlardan açılır.
CREATE TABLE IF NOT EXISTS magaza_islem (platform TEXT NOT NULL, ana TEXT NOT NULL, kid TEXT NOT NULL, urun TEXT NOT NULL, plan TEXT NOT NULL, durum TEXT NOT NULL, bitis INTEGER NOT NULL DEFAULT 0, test INTEGER NOT NULL DEFAULT 0, son_islem TEXT, oto_yenile INTEGER NOT NULL DEFAULT 0, olusturma INTEGER NOT NULL, guncelleme INTEGER NOT NULL, PRIMARY KEY (platform, ana));
CREATE INDEX IF NOT EXISTS magaza_islem_kid ON magaza_islem (kid);
