# AKE Soru Fabrikası · Kurallar

Her soru turundan önce bu dosya okunur. Amaç: ÖSYM kalitesinde, özgün, doğru ve dengeli soru.

## Soru biçimi (siteyle birebir)
{ id, s, t, d, q, o[5], a, x, p? }
- s: ders anahtarı (mat, geo, amat, fizik, ... ingilizce)
- t: konu adı (mevcut_konular.json'daki adlarla aynı yazılır; yeni konu gerekirse açıkça eklenir)
- d: 1 kolay, 2 orta, 3 zor
- o: tam 5 şık, hepsi farklı; a: doğru şıkkın sırası (0-4)
- x: çözüm açıklaması (kısa, adım adım, doğru şıkkı ve yanlış şıkların neden yanlış olduğunu söyler)
- p: paragraf/metin gerekiyorsa

## Kalite kuralları
1. Özgün: kitaptan/ÖSYM'den kopya yok; yeni senaryo, yeni sayı, yeni metin.
2. Tek doğru cevap. "Hepsi", "Hiçbiri", "Yukarıdakilerin hepsi" gibi şıklar yok.
3. Çeldiriciler mantıklı: öğrencinin gerçek hatalarından (işaret hatası, birim karışması, formülü ters kullanma, yarım işlem) türetilir.
4. Sayısal şıklar küçükten büyüğe sıralı. Sözel şıklar uzunluk olarak birbirine yakın (en uzun şık hep doğru olmasın).
5. Doğru şık konumu dengeli dağılır (A-E eşit).
6. Zorluk dengesi: yaklaşık %30 kolay, %45 orta, %25 zor.
7. Soru kökü açık; çift anlam, belirsiz veri, eksik veri yok. Öncüllü sorularda (I, II, III) şıklar öncül kombinasyonlarıdır.
8. Gerçek bilgi gerektiren sorularda (tarih, coğrafya, edebiyat, din, felsefe) yalnızca kesin bilinen bilgi kullanılır; tartışmalı bilgi kullanılmaz.
9. Açıklama doğru cevapla çelişmez; sayılar kodla hesaplanıp açıklamaya yazılır.

## Doğrulama (kodla, ücretsiz)
- Sayısal sorularda doğru şık ve açıklamadaki sayılar kodla hesaplanır; elle yazılmaz.
- dogrula.mjs: 5 farklı şık, geçerli a/d/s, tekrar eden/çok benzeyen soru, şık uzunluğu yanlılığı, yasak şıklar, cevap konumu dağılımı, açıklama boş mu.
- Sözel sorular (Türkçe, tarih, coğrafya, edebiyat, din, felsefe, İngilizce vb.) kodla doğrulanamaz: incelenecek.json listesine yazılır, öğretmen bakar.
- Yapay zeka ile ikinci kontrol YOK (token tasarrufu). Her şey Alfa'nın onayından geçer.
