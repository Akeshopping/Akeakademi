# B3 · Canlı deneme güvenliği: tasarım, dağıtım ve geri alma

Uzak veritabanında hiçbir komut çalıştırılmadı; commit/push/dağıtım yapılmadı.

## Zaman çizelgesi (tamamı SUNUCU saatiyle)
`baslangic` → `bitis` (= başlangıç + süre; sorular açık) → `kapanis` (= bitiş + 60 sn; cevap kabulünün SON anı) → `sonucZamani` (= kapanış + 15 sn; sıralama, cevap anahtarı, çözümler).
- 60 sn tolerans yalnızca bitiş anındaki ağ gecikmesi içindir (eski: 180 sn).
- 15 sn: anahtar açıldığı anda yoldaki/gecikmiş hiçbir isteğin kabul edilmemesi için saat farkı payı. Anahtarın görülebildiği hiçbir anda yeni cevap kabul edilmez.

## Kapatılan açıklar
| # | Eski durum | Yeni davranış |
|---|---|---|
| 1 | `sonuc` bitişte anahtar+çözüm veriyordu, gönderim hâlâ 3 dk açıktı | Anahtar/çözüm/sıralama yalnızca `sonucZamani` sonrası; önbellek de aynı kapıdan geçer |
| 2 | Bitişten 3 dk sonra gönderim kabul | `kapanis` sonrası 410; kayıt öncesi taze saat yeniden kontrol edilir |
| 3 | `sure` istemciden | İstemci süresi yok sayılır; süre = açılış kaydından kabul anına (en çok bitiş) |
| 4 | Soru açmayan da gönderebilirdi | `canli_acilis` kaydı yoksa 403 |
Ek (bağımsız incelemede bulunan puan sızıntısı, düzeltildi): cevap anahtarı kapalı olsa da gönderim süresi sürerken puan bilgisi üç yoldan sızıyordu. Artık `sonucZamani` öncesinde:
- `canli/:id/gonder` yalnızca `{kaydedildi:true, bitis, sonucZamani}` döner (tekrar/eşzamanlı gönderimde de aynı şekil; d/y/b/net/süre yok). Farklı cevaplar aynı yanıtı üretir, puan yoklanamaz.
- `canli/:id/sonuc` → `benim: {kaydedildi:true}` (puan, süre, sıra yok).
- `GET canli` → `benim: {kaydedildi:true}`.
`sonucZamani` sonrasında gerçek puan, süre, sıra, sıralama ve çözümler eksiksiz döner. Açılış kaydı `INSERT OR IGNORE` (ilk kayıt geçerli): ikinci cihaz/yenileme süreyi sıfırlayamaz.

## Migration
`migrations/0002_canli_acilis.sql`: yalnızca yeni tablo `canli_acilis (canli, kid, acilis)`, `IF NOT EXISTS`, tekrar çalıştırılabilir; mevcut veriye dokunmaz. Uygulama tabloyu ilk kullanımda da kendisi kurar (diğer sosyal tablolar gibi), bu yüzden migration gecikse bile sistem bozulmaz.

## Dağıtım (onay sonrası)
1. Time Travel geri dönüş noktası (Preview ve Production ayrı). Hedef veritabanını yazılı doğrula; B2 belgesindeki gibi uzak komut önerilmez (kalıcı Wrangler yapılandırması yok).
2. Preview-test D1'de migration → `sqlite_master`'da `canli_acilis` doğrula.
3. Preview dağıtımı + smoke: test denemesiyle: erken soru 425, açmadan gönderim 403, kapanıştan sonra 410, sonuç anahtarı `sonucZamani`'ndan önce kapalı.
4. Production migration, sonra kod. **Canlı bir deneme sürerken dağıtma:** dağıtım öncesi soruları açmış öğrencinin açılış kaydı olmaz ve 403 alır. Bitmiş/başlamamış zamanda dağıt.
5. Geri alma: önceki dağıtıma dön; `canli_acilis` kalabilir (zararsız). Eski kod yeni tabloyu kullanmaz.

## Uyumluluk ve kalan riskler
- Eski istemci (önbellekli index.html): `sure` gönderir ama yok sayılır; gönderim yanıtında artık puan olmadığı için eski sürüm başarı mesajında "undefined doğru…" gösterebilir (kayıt doğru yapılır; yenileyince yeni arayüz gelir). Sayfa önbelleği yenilenince düzelir; `sonucZamani` bilmez, sonuç sayfası sunucu yanıtındaki `acik` alanına bakar (bitişte "yükleniyor/açılmadı" görebilir, yenileyince düzelir).
- Gönderim süresi 180 sn → 60 sn: bitişte çevrimdışı kalan öğrencinin bekleyen cevabı 60 sn sonra kabul edilmez (arayüz bunu açıkça söyler). İstenirse `CANLI_TOLERANS` artırılır; her artış anahtar açılışını aynı miktar geciktirir.
- Süre hesabı: ilk soru isteğinin sunucuya ulaştığı andan; ağ gecikmesi öğrenci lehine/aleyhine birkaç sn oynatır.
- Sunucu saatleri arasında küçük fark (Cloudflare örnekleri) 15 sn payın içinde kalır.
- Açılış kaydını aşmak için yeni hesap açmak mümkündür; bu hesap bazlı sıralama modelinin sınırıdır (B1 e-posta doğrulaması ve B2 hız sınırı bunu zorlaştırır).
