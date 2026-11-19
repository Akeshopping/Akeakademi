-- AKE Soru Fabrikası robotu (taslak → kör denetim → inceleme → yönetici yayımı).
-- Elle uygulama NOTU: lib/fabrika.js › fabrikaSema aynı tabloları CREATE TABLE IF NOT EXISTS ile ilk kullanımda kurar; bu dosya yalnız kayıt/elle kurulum içindir.
-- ÖN KOŞUL: soru tablosunda kanonik kolonlar (kaynak, rk, h, govde, a, x, kopya_of) bulunmalı (AKE_SORU_V2=1 şeması). Mevcut soru satırlarına dokunmaz.
CREATE TABLE IF NOT EXISTS fabrika_ayar (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS fabrika_pilot (id TEXT PRIMARY KEY, hedef INTEGER, durum TEXT, ders TEXT, konu TEXT, baslangic INTEGER, bitis INTEGER);
CREATE TABLE IF NOT EXISTS fabrika_is (id TEXT PRIMARY KEY, tur TEXT, soru_id TEXT, pilot_id TEXT, ders TEXT, konu TEXT, durum TEXT, deneme INTEGER DEFAULT 0, azami INTEGER, kilit_bitis INTEGER, kilit_kimlik TEXT, sonraki INTEGER, hata TEXT, olusturma INTEGER, guncelleme INTEGER);
CREATE INDEX IF NOT EXISTS fabrika_is_durum ON fabrika_is (durum, sonraki);
CREATE TABLE IF NOT EXISTS fabrika_soru (soru_id TEXT PRIMARY KEY, pilot_id TEXT, surum INTEGER, asama TEXT, model_durum TEXT, denetim_tam INTEGER DEFAULT 0, tekrar INTEGER DEFAULT 0, sayisal TEXT DEFAULT 'yapilmadi', denetim_json TEXT, olusturma INTEGER, guncelleme INTEGER, yayim_durum TEXT DEFAULT 'yok', yayim_kim TEXT, yayim_tarih INTEGER);
CREATE TABLE IF NOT EXISTS fabrika_cagri (id TEXT PRIMARY KEY, is_id TEXT, tur TEXT, soru_id TEXT, surum INTEGER, model TEXT, giris INTEGER, cikis INTEGER, sure_ms INTEGER, hata TEXT, tarih INTEGER, gun TEXT);
CREATE INDEX IF NOT EXISTS fabrika_cagri_gun ON fabrika_cagri (gun);
