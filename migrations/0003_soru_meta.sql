-- AKE Akademi · B4 Aşama 3A · soru gösterim bayrakları (os = ÖSYM tarzı, fix = şık sırası sabit)
-- Yalnızca YENİ bir tablo ekler; `soru` ve diğer tablolara/verilere dokunmaz (ALTER/UPDATE/DELETE yok). Tekrar çalıştırılabilir (IF NOT EXISTS).
-- API bu tabloyu OLUŞTURMAZ (otomatik DDL yoktur): bu dosya AÇIK ONAYLA, önce Preview'da, sonra Production'da elle uygulanır.
-- Tablo yokken API çökmez; yanıtta bayrak: "eksik" döner. Doldurma: fabrika/soru-bayrak-doldur.mjs (yerel prova → onaylı uzak yazım).
-- Doldurma tamamlanınca araç `#doldu` işaret satırını (os/fix = beklenen toplamlar) yazar; API "hazir" durumunu yalnız bu satırla bildirir.
CREATE TABLE IF NOT EXISTS soru_meta (id TEXT PRIMARY KEY, os INTEGER NOT NULL DEFAULT 0, fix INTEGER NOT NULL DEFAULT 0);
