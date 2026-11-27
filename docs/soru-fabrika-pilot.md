# Pilot: 200 inceleme adayı (seçilen kimlikler)

Bu belge soru METNİ içermez, yalnız seçilen kimlikleri ve seçim kuralını raporlar. **Bu 200 soru yalnız insan incelemesi adayıdır; hiçbiri onaylı değildir, yayımlanmadı, üretim D1'e aktarılmadı.** Soru metinli inceleme paketi repoya konmadı (soru metni repoda tutulmaz); inceleyene ayrıca verildi.

## Seçim kuralı (sabit, rastgelelik yok, girdi sırasından bağımsız; kod: `fabrika/soru-fabrika-pilot.mjs`)
1. 40 şablonun (cümle kalıbı) her birinden en çok 5 soru; toplam en çok 200. Dosyadaki ilk 5 soru alınmaz (kontrol: 40 şablonun hiçbirinde seçim ilk 5 ile aynı değil).
2. Uygunluk: |cevap| ≥ 2 ve her çeldirici cevaba ≤ max(0,75·|cevap|, 6) uzaklıkta, cevapla aynı işaretli. Yeterli uygun aday yoksa eksik yer uygun olmayanlardan doldurulur ve raporlanır.
3. Çeşitlilik: soru metnindeki sayılar + cevap değeri şablon içinde 0-1'e ölçeklenir. İlk soru şablonun merkezine en yakın olan, sonrakiler seçilmişlere en uzak olan (maximin). Cevap şıkkı konumu ve zorluk henüz seçilmemişse bonus. Eşitlikte küçük kimlik.
4. Aday havuzu: ön kontrolden `uygun` çıkan 15.213 soru (tekrar/benzer olanlar zaten dışarıda).

## Sonuç
- Toplam **200** soru, 40 şablon.

| Konu | Seçilen |
|---|---|
| Basit Eşitsizlikler | 55 |
| Çarpanlara Ayırma | 15 |
| Kâr Zarar Problemleri | 15 |
| Karışım Problemleri | 15 |
| Rasyonel Sayılar | 15 |
| Sayı Basamakları | 15 |
| Yaş Problemleri | 70 |

## Şablon ve kimlikler

**1. Basit Eşitsizlikler** · aday 509 · uygunluk eşiğini geçen 509

`#x + # < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?`

`py-tyt_matematik-05cadcce`, `py-tyt_matematik-f307776e`, `py-tyt_matematik-045b0dec`, `py-tyt_matematik-3de1cea7`, `py-tyt_matematik-24c5b606`

**2. Basit Eşitsizlikler** · aday 153 · uygunluk eşiğini geçen 153

`#x < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?`

`py-tyt_matematik-9d315cb6`, `py-tyt_matematik-64ecad79`, `py-tyt_matematik-dfda4f42`, `py-tyt_matematik-599bf408`, `py-tyt_matematik-44bbf39b`

**3. Basit Eşitsizlikler** · aday 382 · uygunluk eşiğini geçen 382

`#x − # < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?`

`py-tyt_matematik-ee28e15d`, `py-tyt_matematik-52b7cccd`, `py-tyt_matematik-a3b3c40d`, `py-tyt_matematik-34727a23`, `py-tyt_matematik-7ae2648a`

**4. Basit Eşitsizlikler** · aday 892 · uygunluk eşiğini geçen 857

`x bir tam sayı olmak üzere # < #x + # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-fd3081b1`, `py-tyt_matematik-eb05278c`, `py-tyt_matematik-c40d7a29`, `py-tyt_matematik-958147b4`, `py-tyt_matematik-60268c19`

**5. Basit Eşitsizlikler** · aday 894 · uygunluk eşiğini geçen 808

`x bir tam sayı olmak üzere # < #x − # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-5fa97181`, `py-tyt_matematik-2f43ff7d`, `py-tyt_matematik-80ad9d9a`, `py-tyt_matematik-4601555f`, `py-tyt_matematik-b5785ec9`

**6. Basit Eşitsizlikler** · aday 179 · uygunluk eşiğini geçen 166

`x bir tam sayı olmak üzere # < #x ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-86861aae`, `py-tyt_matematik-9c8ef0cc`, `py-tyt_matematik-8129d0da`, `py-tyt_matematik-c3f2d576`, `py-tyt_matematik-4b6866c4`

**7. Basit Eşitsizlikler** · aday 216 · uygunluk eşiğini geçen 158

`x bir tam sayı olmak üzere |#x − #| ≤ # eşitsizliğini sağlayan kaç farklı x değeri vardır?`

`py-tyt_matematik-41a821e6`, `py-tyt_matematik-88b41d47`, `py-tyt_matematik-c360e9d7`, `py-tyt_matematik-50cf9b90`, `py-tyt_matematik-946379b7`

**8. Basit Eşitsizlikler** · aday 898 · uygunluk eşiğini geçen 623

`x bir tam sayı olmak üzere −# < #x + # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-0fc0cbab`, `py-tyt_matematik-4c452411`, `py-tyt_matematik-5e1976f1`, `py-tyt_matematik-f8ef8fe7`, `py-tyt_matematik-a3dbfbbf`

**9. Basit Eşitsizlikler** · aday 1694 · uygunluk eşiğini geçen 1518

`x bir tam sayı olmak üzere −# < #x − # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-5b62c7e8`, `py-tyt_matematik-164220d7`, `py-tyt_matematik-5328e834`, `py-tyt_matematik-c29b7d8f`, `py-tyt_matematik-497bd1df`

**10. Basit Eşitsizlikler** · aday 8 · uygunluk eşiğini geçen 1 · **gevşetildi**

`x bir tam sayı olmak üzere −# < #x − # ≤ −# eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-a5cda671`, `py-tyt_matematik-9250d840`, `py-tyt_matematik-52e4c635`, `py-tyt_matematik-259e9c32`, `py-tyt_matematik-65fa691b`

**11. Basit Eşitsizlikler** · aday 285 · uygunluk eşiğini geçen 230

`x bir tam sayı olmak üzere −# < #x ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-e3a8b45d`, `py-tyt_matematik-f76e64a6`, `py-tyt_matematik-558cdd19`, `py-tyt_matematik-63e8e8e5`, `py-tyt_matematik-8ad5a129`

**12. Çarpanlara Ayırma** · aday 78 · uygunluk eşiğini geçen 45

`a + b = # ve a·b = # olduğuna göre a² + b² kaçtır?`

`py-tyt_matematik-11382d08`, `py-tyt_matematik-4109e6ca`, `py-tyt_matematik-167877d0`, `py-tyt_matematik-f1250a2b`, `py-tyt_matematik-9fe62244`

**13. Çarpanlara Ayırma** · aday 7 · uygunluk eşiğini geçen 2 · **gevşetildi**

`x + #/x = # olduğuna göre x³ + #/x³ ifadesinin değeri kaçtır?`

`py-tyt_matematik-cc42994e`, `py-tyt_matematik-55ade752`, `py-tyt_matematik-06c5bc36`, `py-tyt_matematik-68ea2f71`, `py-tyt_matematik-ab546eae`

**14. Çarpanlara Ayırma** · aday 90 · uygunluk eşiğini geçen 30

`x − y = # ve x + y = # olduğuna göre x² − y² kaçtır?`

`py-tyt_matematik-be34c82d`, `py-tyt_matematik-d5a6d5bc`, `py-tyt_matematik-e8215f73`, `py-tyt_matematik-feeb96ec`, `py-tyt_matematik-c4feab82`

**15. Kâr Zarar Problemleri** · aday 228 · uygunluk eşiğini geçen 93

`Alış fiyatı # TL olan bir mal %# kârla satılıyor. Malın satış fiyatı kaç TL'dir?`

`py-tyt_matematik-5f2e9041`, `py-tyt_matematik-9c9637a8`, `py-tyt_matematik-fc587a49`, `py-tyt_matematik-40f43a61`, `py-tyt_matematik-459c69e6`

**16. Kâr Zarar Problemleri** · aday 38 · uygunluk eşiğini geçen 22

`Aynı fiyata, # TL'ye satılan iki maldan biri %# kârla, diğeri %# zararla satılmıştır. Bu satışlardan toplam kaç TL zarar edilmiştir?`

`py-tyt_matematik-08493fa3`, `py-tyt_matematik-943a1369`, `py-tyt_matematik-20b7e866`, `py-tyt_matematik-532f1451`, `py-tyt_matematik-0772c39e`

**17. Kâr Zarar Problemleri** · aday 152 · uygunluk eşiğini geçen 149

`Bir mal %# zararla # TL'ye satılıyor. Malın alış fiyatı kaç TL'dir?`

`py-tyt_matematik-1a0bdd5e`, `py-tyt_matematik-fcf041f4`, `py-tyt_matematik-9fb9eb7b`, `py-tyt_matematik-0798e342`, `py-tyt_matematik-eda4b99f`

**18. Karışım Problemleri** · aday 33 · uygunluk eşiğini geçen 17

`Tuz oranı %# olan # g tuzlu su ile tuz oranı %# olan # g tuzlu su karıştırılıyor. Karışımın tuz oranı yüzde kaçtır?`

`py-tyt_matematik-28377f9e`, `py-tyt_matematik-a52f97a4`, `py-tyt_matematik-bf3a6f87`, `py-tyt_matematik-0c686a43`, `py-tyt_matematik-4b25fcc0`

**19. Karışım Problemleri** · aday 696 · uygunluk eşiğini geçen 316

`Tuz oranı %# olan # g tuzlu suya kaç gram saf su eklenirse tuz oranı %# olur?`

`py-tyt_matematik-61d44f00`, `py-tyt_matematik-b9ed82a2`, `py-tyt_matematik-12ae4a5c`, `py-tyt_matematik-3c705690`, `py-tyt_matematik-0b92a67a`

**20. Karışım Problemleri** · aday 48 · uygunluk eşiğini geçen 19

`Tuz oranı %# olan tuzlu su ile tuz oranı %# olan tuzlu su karıştırılarak tuz oranı %# olan çözelti elde ediliyor. Tuz oranı %# olan çözeltiden # g kullanıldığına göre tuz oranı %# olan çözeltiden kaç gram kullanılmıştır?`

`py-tyt_matematik-85208ca7`, `py-tyt_matematik-c913c473`, `py-tyt_matematik-4498ab9a`, `py-tyt_matematik-89380489`, `py-tyt_matematik-3c469ba4`

**21. Rasyonel Sayılar** · aday 518 · uygunluk eşiğini geçen 518

`#/# + #/# işleminin sonucu kaçtır?`

`py-tyt_matematik-1512da80`, `py-tyt_matematik-7101ee9f`, `py-tyt_matematik-920d4bc6`, `py-tyt_matematik-0486cc7c`, `py-tyt_matematik-ca52399e`

**22. Rasyonel Sayılar** · aday 152 · uygunluk eşiğini geçen 95

`Bir sayının #/# kadarı # olduğuna göre bu sayı kaçtır?`

`py-tyt_matematik-d06a64a4`, `py-tyt_matematik-992feea9`, `py-tyt_matematik-b9f931bf`, `py-tyt_matematik-2c2b5f15`, `py-tyt_matematik-2ba88f5d`

**23. Rasyonel Sayılar** · aday 1214 · uygunluk eşiğini geçen 844

`Bir yolun #/# kadarı birinci gün, kalan yolun #/# kadarı ikinci gün alınıyor. Geriye # km yol kaldığına göre yolun tamamı kaç km'dir?`

`py-tyt_matematik-06cd1df8`, `py-tyt_matematik-dcc36465`, `py-tyt_matematik-5e57f62b`, `py-tyt_matematik-a2312a93`, `py-tyt_matematik-f07f40c1`

**24. Sayı Basamakları** · aday 22 · uygunluk eşiğini geçen 15

`Rakamları birbirinden farklı ve rakamları toplamı # olan üç basamaklı en büyük doğal sayı kaçtır?`

`py-tyt_matematik-af619be6`, `py-tyt_matematik-c400b799`, `py-tyt_matematik-a4484903`, `py-tyt_matematik-b9396758`, `py-tyt_matematik-7e023476`

**25. Sayı Basamakları** · aday 35 · uygunluk eşiğini geçen 30

`Rakamları toplamı # olan iki basamaklı bir doğal sayının rakamlarının yeri değiştirildiğinde elde edilen sayı, ilk sayıdan # eksiktir. Buna göre ilk sayı kaçtır?`

`py-tyt_matematik-ba6a7351`, `py-tyt_matematik-38bfd0dd`, `py-tyt_matematik-a4cd6580`, `py-tyt_matematik-086b258c`, `py-tyt_matematik-5e92a745`

**26. Sayı Basamakları** · aday 12 · uygunluk eşiğini geçen 12

`Rakamları toplamı # olan iki basamaklı kaç tane çift doğal sayı vardır?`

`py-tyt_matematik-ced96c13`, `py-tyt_matematik-2cd07b79`, `py-tyt_matematik-62808aaf`, `py-tyt_matematik-4d19e1b9`, `py-tyt_matematik-f9b0bed0`

**27. Yaş Problemleri** · aday 242 · uygunluk eşiğini geçen 88

`# kişilik bir grubun yaş ortalaması #'dir. Bu gruptan bir kişi ayrılınca ortalama # oluyor. Ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-51e97d42`, `py-tyt_matematik-89f6db14`, `py-tyt_matematik-cc580b5a`, `py-tyt_matematik-2eae1b1c`, `py-tyt_matematik-28e769d3`

**28. Yaş Problemleri** · aday 366 · uygunluk eşiğini geçen 276

`# kişilik bir grubun yaş ortalaması #'dir. Gruptan # yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama # oluyor. Diğer ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-818a605d`, `py-tyt_matematik-1735204c`, `py-tyt_matematik-f2493ce7`, `py-tyt_matematik-b9c10aaa`, `py-tyt_matematik-2507c708`

**29. Yaş Problemleri** · aday 287 · uygunluk eşiğini geçen 208

`Ali ile babasının yaşları toplamı #, yaşları arasındaki fark # olduğuna göre Ali kaç yaşındadır?`

`py-tyt_matematik-aa196d92`, `py-tyt_matematik-94ec29ae`, `py-tyt_matematik-4ae20ce6`, `py-tyt_matematik-335d7bba`, `py-tyt_matematik-8fc244c7`

**30. Yaş Problemleri** · aday 296 · uygunluk eşiğini geçen 272

`Ayşe, Burak'tan # yaş büyüktür. Burak da Can'dan # yaş büyüktür. Üçünün yaşları toplamı # olduğuna göre Can kaç yaşındadır?`

`py-tyt_matematik-40d436a8`, `py-tyt_matematik-3625cb3c`, `py-tyt_matematik-3d1405d7`, `py-tyt_matematik-8779800f`, `py-tyt_matematik-bd36b7ef`

**31. Yaş Problemleri** · aday 115 · uygunluk eşiğini geçen 115

`Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının # katıdır. Baba, anneden # yaş büyüktür. Üç kişinin yaşları toplamı # olduğuna göre # yıl sonra anne ile babanın yaşları toplamı kaç olur?`

`py-tyt_matematik-cb289d89`, `py-tyt_matematik-07820390`, `py-tyt_matematik-6997e0f8`, `py-tyt_matematik-ce513a87`, `py-tyt_matematik-8d46689b`

**32. Yaş Problemleri** · aday 18 · uygunluk eşiğini geçen 14

`Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının # katıdır. Baba, anneden # yaş büyüktür. Üç kişinin yaşları toplamı # olduğuna göre çocuk kaç yaşındadır?`

`py-tyt_matematik-83f469e6`, `py-tyt_matematik-a9d1b6db`, `py-tyt_matematik-4c4b4f3a`, `py-tyt_matematik-57fe9c94`, `py-tyt_matematik-f2f9abbb`

**33. Yaş Problemleri** · aday 226 · uygunluk eşiğini geçen 214

`Bir anne ile kızının yaşları oranı #/#, yaşları toplamı # olduğuna göre # yıl sonra annenin yaşı kaç olur?`

`py-tyt_matematik-a6e4883f`, `py-tyt_matematik-2c788614`, `py-tyt_matematik-2f695d05`, `py-tyt_matematik-2358b67f`, `py-tyt_matematik-b454f548`

**34. Yaş Problemleri** · aday 112 · uygunluk eşiğini geçen 85

`Bir anne ile kızının yaşları oranı #/#, yaşları toplamı # olduğuna göre kızı kaç yaşındadır?`

`py-tyt_matematik-87483170`, `py-tyt_matematik-c2ed0880`, `py-tyt_matematik-2f3c6bfb`, `py-tyt_matematik-57eebda9`, `py-tyt_matematik-416f9ab4`

**35. Yaş Problemleri** · aday 275 · uygunluk eşiğini geçen 208

`Bir annenin yaşı kızının yaşının # katıdır. # yıl önce ikisinin yaşları toplamı # olduğuna göre annenin bugünkü yaşı kaçtır?`

`py-tyt_matematik-139d6776`, `py-tyt_matematik-70fd5047`, `py-tyt_matematik-0291b5dc`, `py-tyt_matematik-efbbfaf5`, `py-tyt_matematik-a4197bf1`

**36. Yaş Problemleri** · aday 42 · uygunluk eşiğini geçen 35

`Bir annenin yaşı kızının yaşının # katıdır. İkisinin yaşları toplamı # olduğuna göre kızı kaç yaşındadır?`

`py-tyt_matematik-c9407549`, `py-tyt_matematik-d0c8d5a6`, `py-tyt_matematik-5bd0daca`, `py-tyt_matematik-8600170b`, `py-tyt_matematik-ffa6db93`

**37. Yaş Problemleri** · aday 67 · uygunluk eşiğini geçen 62

`Bir baba ile oğlu hakkında şu bilgiler veriliyor: # yıl önce babanın yaşı oğlunun yaşının # katıydı. # yıl sonra babanın yaşı oğlunun yaşının # katı olacaktır. Buna göre baba ile oğlunun bugünkü yaşları toplamı kaçtır?`

`py-tyt_matematik-65425388`, `py-tyt_matematik-d1d1148f`, `py-tyt_matematik-9b4e98ab`, `py-tyt_matematik-79f3e4c6`, `py-tyt_matematik-4330ea2d`

**38. Yaş Problemleri** · aday 75 · uygunluk eşiğini geçen 36

`Bir baba ile oğlu hakkında şu bilgiler veriliyor: # yıl önce babanın yaşı oğlunun yaşının # katıydı. # yıl sonra babanın yaşı oğlunun yaşının # katı olacaktır. Buna göre oğlun bugünkü yaşı kaçtır?`

`py-tyt_matematik-69a662bc`, `py-tyt_matematik-07923da7`, `py-tyt_matematik-d1e79fa1`, `py-tyt_matematik-a2a4c81d`, `py-tyt_matematik-67a5a5b8`

**39. Yaş Problemleri** · aday 351 · uygunluk eşiğini geçen 204

`İki kardeşin yaşları arasındaki fark #'tür. # yıl önce yaşları toplamı # olduğuna göre bugünkü yaşlarının çarpımı kaçtır?`

`py-tyt_matematik-949d775a`, `py-tyt_matematik-d0f7b6c1`, `py-tyt_matematik-d8b0ba70`, `py-tyt_matematik-ddcb2b73`, `py-tyt_matematik-34791c9f`

**40. Yaş Problemleri** · aday 3308 · uygunluk eşiğini geçen 3124

`İki kardeşin yaşları arasındaki fark #'tür. # yıl önce yaşları toplamı # olduğuna göre büyük kardeş şimdi kaç yaşındadır?`

`py-tyt_matematik-cc52b79f`, `py-tyt_matematik-8a1e883e`, `py-tyt_matematik-9082b264`, `py-tyt_matematik-2eb67bc9`, `py-tyt_matematik-ebfe1358`
