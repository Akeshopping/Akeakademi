# Pilot (v2): inceleme adayları (seçilen kimlikler)

> **Hiçbir soru onaylı değildir.** Bu liste yalnızca insan incelemesine gidecek adaylardır. Üretim D1'e aktarım, onay ve yayım yapılmadı. Soru metinleri repoda değil; inceleme paketi repo dışındadır.

## Seçim kuralı (sabit, rastgelelik yok, girdi sırasından bağımsız; kod: `fabrika/soru-fabrika-pilot.mjs`)

1. Şablon = soru metninde sayılar `#` yapılınca aynı kalan metin. Her şablondan **en çok 5**, toplam **en çok 200** soru; 200'e ZORLANMAZ.
2. Aday olabilmek için soru önce **bağımsız çözücüden** (metinden cevap) ve **bağımsız kalite denetiminden** (`fabrika/uretim_py/denetim.py`) bulgusuz geçmelidir: yaş gerçekçiliği, çözüm metnindeki işlem anlatımı (soru/cevapla ve işaretle uyum), sayıdan sonraki ek uyumu, şık kalitesi (eşit aralıklı dolgu ve bariz alakasız çeldirici yok). Bulgusu olan soru, işaretli cevap doğru olsa bile **inceleme** kuyruğuna ayrılır (öneri: DÜZELT veya REDDET).
3. Makul çeldirici ölçütü: |cevap| ≥ 2; her çeldirici cevaba `max(0,75·|cevap|, 6)` içinde, aynı işaretli, cevaptan farklı.
4. **Kota doldurma yok:** ölçütleri geçen aday 5'ten azsa o şablondan daha az soru alınır, eksik raporlanır. (Eski sürümdeki "gevşetme" kaldırıldı.)
5. Çeşitlilik: sayılar + cevap + zorluk, şablon içinde ölçeklenir; merkezden başla, sonra en uzak (maximin); yeni cevap konumu/zorluk bonusu; eşitlikte küçük kimlik.

## Sonuç

- Yeni aday küme (v2): 20980 soru → 11889 uygun · 1252 tekrar · 0 geçersiz · 7839 inceleme (hepsi denetim bulgusu: şık kalitesi).
- Pilot: **200** soru, **69** şablonda soru var (70 şablon bulundu); eksik: 1 şablon (hiç ölçütü geçen aday yok).
- Toplam üst sınır (200) bağlayıcı: 70 şablon × 5 = 350 > 200, bu yüzden şablon başına ≈3 soru alındı (62 şablon 3, 7 şablon 2, 1 şablon 0). Konu dağılımı şablon sayısına bağlıdır (Yaş 44 şablon).
- Konu: Basit Eşitsizlikler 30, Çarpanlara Ayırma 9, Kâr Zarar Problemleri 9, Karışım Problemleri 9, Rasyonel Sayılar 9, Sayı Basamakları 6, Yaş Problemleri 128
- Cevap konumu: A 16, B 45, C 57, D 56, E 26
- Zorluk: 1: 12, 2: 97, 3: 91
- Seçim iki kez çalıştırıldı, kimlik listesi aynı çıktı.

## Şablon ve kimlikler

**1. Basit Eşitsizlikler** · aday 97 · ölçütü geçen 97 · seçilen 3

`#x + # < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?`

`py-tyt_matematik-70239b51`, `py-tyt_matematik-9efd214d`, `py-tyt_matematik-6c8dfce1`

**2. Basit Eşitsizlikler** · aday 22 · ölçütü geçen 22 · seçilen 3

`#x < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?`

`py-tyt_matematik-432c8a06`, `py-tyt_matematik-87e78a12`, `py-tyt_matematik-f2c7b818`

**3. Basit Eşitsizlikler** · aday 103 · ölçütü geçen 103 · seçilen 3

`#x − # < # eşitsizliğini sağlayan kaç tane pozitif tam sayı vardır?`

`py-tyt_matematik-03c6d3b2`, `py-tyt_matematik-63b99518`, `py-tyt_matematik-206fb4b3`

**4. Basit Eşitsizlikler** · aday 566 · ölçütü geçen 565 · seçilen 3

`x bir tam sayı olmak üzere # < #x + # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-a455550e`, `py-tyt_matematik-eb05278c`, `py-tyt_matematik-60268c19`

**5. Basit Eşitsizlikler** · aday 709 · ölçütü geçen 709 · seçilen 3

`x bir tam sayı olmak üzere # < #x − # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-5fa97181`, `py-tyt_matematik-2f43ff7d`, `py-tyt_matematik-80ad9d9a`

**6. Basit Eşitsizlikler** · aday 135 · ölçütü geçen 135 · seçilen 3

`x bir tam sayı olmak üzere # < #x ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-8a89ab0c`, `py-tyt_matematik-2b029b90`, `py-tyt_matematik-38c7ceb6`

**7. Basit Eşitsizlikler** · aday 55 · ölçütü geçen 55 · seçilen 3

`x bir tam sayı olmak üzere |#x − #| ≤ # eşitsizliğini sağlayan kaç farklı x değeri vardır?`

`py-tyt_matematik-5fde05fb`, `py-tyt_matematik-830a0c9a`, `py-tyt_matematik-ce6061c5`

**8. Basit Eşitsizlikler** · aday 384 · ölçütü geçen 275 · seçilen 3

`x bir tam sayı olmak üzere −# < #x + # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-2042d0ce`, `py-tyt_matematik-4c452411`, `py-tyt_matematik-43ec6de0`

**9. Basit Eşitsizlikler** · aday 984 · ölçütü geçen 945 · seçilen 3

`x bir tam sayı olmak üzere −# < #x − # ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-532432cf`, `py-tyt_matematik-164220d7`, `py-tyt_matematik-e076aad3`

**10. Basit Eşitsizlikler** · aday 1 · ölçütü geçen 0 · seçilen 0 · **eksik 5**

`x bir tam sayı olmak üzere −# < #x − # ≤ −# eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

**11. Basit Eşitsizlikler** · aday 137 · ölçütü geçen 117 · seçilen 3

`x bir tam sayı olmak üzere −# < #x ≤ # eşitsizliğini sağlayan x değerlerinin toplamı kaçtır?`

`py-tyt_matematik-bb8e0a76`, `py-tyt_matematik-24b576b8`, `py-tyt_matematik-6c52b55c`

**12. Çarpanlara Ayırma** · aday 43 · ölçütü geçen 43 · seçilen 3

`a + b = # ve a·b = # olduğuna göre a² + b² kaçtır?`

`py-tyt_matematik-11382d08`, `py-tyt_matematik-4109e6ca`, `py-tyt_matematik-167877d0`

**13. Çarpanlara Ayırma** · aday 7 · ölçütü geçen 7 · seçilen 3

`x + #/x = # olduğuna göre x³ + #/x³ ifadesinin değeri kaçtır?`

`py-tyt_matematik-cc42994e`, `py-tyt_matematik-68ea2f71`, `py-tyt_matematik-55ade752`

**14. Çarpanlara Ayırma** · aday 29 · ölçütü geçen 29 · seçilen 3

`x − y = # ve x + y = # olduğuna göre x² − y² kaçtır?`

`py-tyt_matematik-be34c82d`, `py-tyt_matematik-d5a6d5bc`, `py-tyt_matematik-e8215f73`

**15. Kâr Zarar Problemleri** · aday 93 · ölçütü geçen 93 · seçilen 3

`Alış fiyatı # TL olan bir mal %# kârla satılıyor. Malın satış fiyatı kaç TL'dir?`

`py-tyt_matematik-5f2e9041`, `py-tyt_matematik-9c9637a8`, `py-tyt_matematik-fc587a49`

**16. Kâr Zarar Problemleri** · aday 15 · ölçütü geçen 15 · seçilen 3

`Aynı fiyata, # TL'ye satılan iki maldan biri %# kârla, diğeri %# zararla satılmıştır. Bu satışlardan toplam kaç TL zarar edilmiştir?`

`py-tyt_matematik-0772c39e`, `py-tyt_matematik-cf564665`, `py-tyt_matematik-537c26d7`

**17. Kâr Zarar Problemleri** · aday 152 · ölçütü geçen 152 · seçilen 3

`Bir mal %# zararla # TL'ye satılıyor. Malın alış fiyatı kaç TL'dir?`

`py-tyt_matematik-1a0bdd5e`, `py-tyt_matematik-64caf568`, `py-tyt_matematik-9fb9eb7b`

**18. Karışım Problemleri** · aday 30 · ölçütü geçen 30 · seçilen 3

`Tuz oranı %# olan # g tuzlu su ile tuz oranı %# olan # g tuzlu su karıştırılıyor. Karışımın tuz oranı yüzde kaçtır?`

`py-tyt_matematik-28377f9e`, `py-tyt_matematik-a52f97a4`, `py-tyt_matematik-bf3a6f87`

**19. Karışım Problemleri** · aday 306 · ölçütü geçen 306 · seçilen 3

`Tuz oranı %# olan # g tuzlu suya kaç gram saf su eklenirse tuz oranı %# olur?`

`py-tyt_matematik-61d44f00`, `py-tyt_matematik-b9ed82a2`, `py-tyt_matematik-12ae4a5c`

**20. Karışım Problemleri** · aday 19 · ölçütü geçen 19 · seçilen 3

`Tuz oranı %# olan tuzlu su ile tuz oranı %# olan tuzlu su karıştırılarak tuz oranı %# olan çözelti elde ediliyor. Tuz oranı %# olan çözeltiden # g kullanıldığına göre tuz oranı %# olan çözeltiden kaç gram kullanılmıştır?`

`py-tyt_matematik-98277890`, `py-tyt_matematik-ef298118`, `py-tyt_matematik-c913c473`

**21. Rasyonel Sayılar** · aday 504 · ölçütü geçen 504 · seçilen 3

`#/# + #/# işleminin sonucu kaçtır?`

`py-tyt_matematik-1512da80`, `py-tyt_matematik-7101ee9f`, `py-tyt_matematik-ae2099dc`

**22. Rasyonel Sayılar** · aday 98 · ölçütü geçen 98 · seçilen 3

`Bir sayının #/# kadarı # olduğuna göre bu sayı kaçtır?`

`py-tyt_matematik-6e5a6355`, `py-tyt_matematik-49d1c6ef`, `py-tyt_matematik-4fca9fc1`

**23. Rasyonel Sayılar** · aday 838 · ölçütü geçen 838 · seçilen 3

`Bir yolun #/# kadarı birinci gün, kalan yolun #/# kadarı ikinci gün alınıyor. Geriye # km yol kaldığına göre yolun tamamı kaç km'dir?`

`py-tyt_matematik-9410c9d7`, `py-tyt_matematik-4ee3fcd8`, `py-tyt_matematik-db40c3b5`

**24. Sayı Basamakları** · aday 15 · ölçütü geçen 15 · seçilen 3

`Rakamları birbirinden farklı ve rakamları toplamı # olan üç basamaklı en büyük doğal sayı kaçtır?`

`py-tyt_matematik-af619be6`, `py-tyt_matematik-c400b799`, `py-tyt_matematik-a4484903`

**25. Sayı Basamakları** · aday 30 · ölçütü geçen 30 · seçilen 3

`Rakamları toplamı # olan iki basamaklı bir doğal sayının rakamlarının yeri değiştirildiğinde elde edilen sayı, ilk sayıdan # eksiktir. Buna göre ilk sayı kaçtır?`

`py-tyt_matematik-ba6a7351`, `py-tyt_matematik-38bfd0dd`, `py-tyt_matematik-a4cd6580`

**26. Yaş Problemleri** · aday 66 · ölçütü geçen 66 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dir. Bu gruptan bir kişi ayrılınca ortalama # oluyor. Ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-02158d0b`, `py-tyt_matematik-945c5c1c`, `py-tyt_matematik-ca47f88c`

**27. Yaş Problemleri** · aday 58 · ölçütü geçen 58 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dir. Gruba yeni bir kişi katılınca ortalama # oluyor. Gruba katılan kişi kaç yaşındadır?`

`py-tyt_matematik-26b41be7`, `py-tyt_matematik-1c005ed7`, `py-tyt_matematik-cc978a10`

**28. Yaş Problemleri** · aday 125 · ölçütü geçen 125 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dir. Gruptan # yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama # oluyor. Diğer ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-d90c90f4`, `py-tyt_matematik-0d23dad9`, `py-tyt_matematik-78784371`

**29. Yaş Problemleri** · aday 18 · ölçütü geçen 18 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dur. Bu gruptan bir kişi ayrılınca ortalama # oluyor. Ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-5d4bf12c`, `py-tyt_matematik-05190556`, `py-tyt_matematik-620658bf`

**30. Yaş Problemleri** · aday 17 · ölçütü geçen 17 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dur. Gruba yeni bir kişi katılınca ortalama # oluyor. Gruba katılan kişi kaç yaşındadır?`

`py-tyt_matematik-74dea7d8`, `py-tyt_matematik-a12a0a9a`, `py-tyt_matematik-e22c06bf`

**31. Yaş Problemleri** · aday 53 · ölçütü geçen 53 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dur. Gruptan # yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama # oluyor. Diğer ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-bc605c39`, `py-tyt_matematik-3786845c`, `py-tyt_matematik-7795fd3d`

**32. Yaş Problemleri** · aday 15 · ölçütü geçen 15 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dır. Bu gruptan bir kişi ayrılınca ortalama # oluyor. Ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-1dae0cd7`, `py-tyt_matematik-5a561185`, `py-tyt_matematik-a4141054`

**33. Yaş Problemleri** · aday 11 · ölçütü geçen 11 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dır. Gruba yeni bir kişi katılınca ortalama # oluyor. Gruba katılan kişi kaç yaşındadır?`

`py-tyt_matematik-8c3287a6`, `py-tyt_matematik-020d3d46`, `py-tyt_matematik-beb778e8`

**34. Yaş Problemleri** · aday 33 · ölçütü geçen 33 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'dır. Gruptan # yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama # oluyor. Diğer ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-ddf8b76c`, `py-tyt_matematik-ea540897`, `py-tyt_matematik-ee0fd00b`

**35. Yaş Problemleri** · aday 19 · ölçütü geçen 19 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'tir. Bu gruptan bir kişi ayrılınca ortalama # oluyor. Ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-51e97d42`, `py-tyt_matematik-89f6db14`, `py-tyt_matematik-c899db18`

**36. Yaş Problemleri** · aday 19 · ölçütü geçen 19 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'tir. Gruba yeni bir kişi katılınca ortalama # oluyor. Gruba katılan kişi kaç yaşındadır?`

`py-tyt_matematik-803057a1`, `py-tyt_matematik-c9a108de`, `py-tyt_matematik-c3805eed`

**37. Yaş Problemleri** · aday 28 · ölçütü geçen 28 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'tir. Gruptan # yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama # oluyor. Diğer ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-be00bf80`, `py-tyt_matematik-f0942c81`, `py-tyt_matematik-aac90a68`

**38. Yaş Problemleri** · aday 32 · ölçütü geçen 32 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'tür. Bu gruptan bir kişi ayrılınca ortalama # oluyor. Ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-3808416a`, `py-tyt_matematik-2eae1b1c`, `py-tyt_matematik-cc580b5a`

**39. Yaş Problemleri** · aday 26 · ölçütü geçen 26 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'tür. Gruba yeni bir kişi katılınca ortalama # oluyor. Gruba katılan kişi kaç yaşındadır?`

`py-tyt_matematik-cae92353`, `py-tyt_matematik-b697746c`, `py-tyt_matematik-0a925830`

**40. Yaş Problemleri** · aday 56 · ölçütü geçen 56 · seçilen 3

`# kişilik bir grubun yaş ortalaması #'tür. Gruptan # yaşındaki bir kişi ile yaşı bilinmeyen başka bir kişi ayrılınca ortalama # oluyor. Diğer ayrılan kişi kaç yaşındadır?`

`py-tyt_matematik-6eafcb14`, `py-tyt_matematik-c555d28b`, `py-tyt_matematik-c56e4a0b`

**41. Yaş Problemleri** · aday 130 · ölçütü geçen 130 · seçilen 3

`Ali ile babasının yaşları toplamı #, yaşları arasındaki fark # olduğuna göre Ali kaç yaşındadır?`

`py-tyt_matematik-3c05212b`, `py-tyt_matematik-a7dbfd92`, `py-tyt_matematik-f11f5260`

**42. Yaş Problemleri** · aday 173 · ölçütü geçen 173 · seçilen 3

`Ayşe, Burak'tan # yaş büyüktür. Burak da Can'dan # yaş büyüktür. Üçünün yaşları toplamı # olduğuna göre Can kaç yaşındadır?`

`py-tyt_matematik-f0e88125`, `py-tyt_matematik-d5b80917`, `py-tyt_matematik-60e66ae7`

**43. Yaş Problemleri** · aday 55 · ölçütü geçen 55 · seçilen 3

`Babanın şimdiki yaşı #, oğlunun şimdiki yaşı # olduğuna göre kaç yıl sonra babanın yaşı oğlunun yaşının # katı olur?`

`py-tyt_matematik-67744476`, `py-tyt_matematik-a6de0597`, `py-tyt_matematik-39df1b2e`

**44. Yaş Problemleri** · aday 110 · ölçütü geçen 110 · seçilen 3

`Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının # katıdır. Baba, anneden # yaş büyüktür. Üç kişinin yaşları toplamı # olduğuna göre # yıl sonra anne ile babanın yaşları toplamı kaç olur?`

`py-tyt_matematik-4eb38f5b`, `py-tyt_matematik-17ad4eff`, `py-tyt_matematik-f166893f`

**45. Yaş Problemleri** · aday 18 · ölçütü geçen 18 · seçilen 3

`Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının # katıdır. Baba, anneden # yaş büyüktür. Üç kişinin yaşları toplamı # olduğuna göre baba kaç yaşındadır?`

`py-tyt_matematik-236ad2d8`, `py-tyt_matematik-0fbe216a`, `py-tyt_matematik-466ac96e`

**46. Yaş Problemleri** · aday 15 · ölçütü geçen 15 · seçilen 3

`Bir ailede anne, baba ve bir çocuk vardır. Annenin yaşı çocuğun yaşının # katıdır. Baba, anneden # yaş büyüktür. Üç kişinin yaşları toplamı # olduğuna göre çocuk kaç yaşındadır?`

`py-tyt_matematik-999d35f7`, `py-tyt_matematik-8b0a4ed1`, `py-tyt_matematik-104a85c7`

**47. Yaş Problemleri** · aday 293 · ölçütü geçen 293 · seçilen 3

`Bir anne ile kızının yaşları oranı #/#, yaşları toplamı # olduğuna göre # yıl sonra annenin yaşı kaç olur?`

`py-tyt_matematik-3ef08d6a`, `py-tyt_matematik-6d2d2585`, `py-tyt_matematik-2f695d05`

**48. Yaş Problemleri** · aday 32 · ölçütü geçen 32 · seçilen 3

`Bir anne ile kızının yaşları oranı #/#, yaşları toplamı # olduğuna göre anne ile kızı arasındaki yaş farkı kaçtır?`

`py-tyt_matematik-d50b6d22`, `py-tyt_matematik-489ffc2c`, `py-tyt_matematik-dc5b5341`

**49. Yaş Problemleri** · aday 31 · ölçütü geçen 31 · seçilen 3

`Bir anne ile kızının yaşları oranı #/#, yaşları toplamı # olduğuna göre kızı kaç yaşındadır?`

`py-tyt_matematik-1f4a328a`, `py-tyt_matematik-cccfa2f1`, `py-tyt_matematik-be48fd9e`

**50. Yaş Problemleri** · aday 166 · ölçütü geçen 166 · seçilen 3

`Bir annenin yaşı kızının yaşının # katıdır. # yıl önce ikisinin yaşları toplamı # olduğuna göre annenin bugünkü yaşı kaçtır?`

`py-tyt_matematik-431b39c5`, `py-tyt_matematik-c1992a91`, `py-tyt_matematik-00b1c19d`

**51. Yaş Problemleri** · aday 8 · ölçütü geçen 8 · seçilen 3

`Bir annenin yaşı kızının yaşının # katıdır. İkisinin yaşları toplamı # olduğuna göre kızı kaç yaşındadır?`

`py-tyt_matematik-6f89e7a2`, `py-tyt_matematik-72ba7669`, `py-tyt_matematik-dcef73ed`

**52. Yaş Problemleri** · aday 61 · ölçütü geçen 61 · seçilen 3

`Bir baba ile oğlu hakkında şu bilgiler veriliyor: # yıl önce babanın yaşı oğlunun yaşının # katıydı. # yıl sonra babanın yaşı oğlunun yaşının # katı olacaktır. Buna göre baba ile oğlunun bugünkü yaşları toplamı kaçtır?`

`py-tyt_matematik-63a3b12e`, `py-tyt_matematik-43e5abaf`, `py-tyt_matematik-fcece053`

**53. Yaş Problemleri** · aday 66 · ölçütü geçen 66 · seçilen 3

`Bir baba ile oğlu hakkında şu bilgiler veriliyor: # yıl önce babanın yaşı oğlunun yaşının # katıydı. # yıl sonra babanın yaşı oğlunun yaşının # katı olacaktır. Buna göre babanın bugünkü yaşı kaçtır?`

`py-tyt_matematik-76e81736`, `py-tyt_matematik-bfae569c`, `py-tyt_matematik-833819ed`

**54. Yaş Problemleri** · aday 43 · ölçütü geçen 43 · seçilen 3

`Bir baba ile oğlu hakkında şu bilgiler veriliyor: # yıl önce babanın yaşı oğlunun yaşının # katıydı. # yıl sonra babanın yaşı oğlunun yaşının # katı olacaktır. Buna göre oğlun bugünkü yaşı kaçtır?`

`py-tyt_matematik-6736f92b`, `py-tyt_matematik-2ce6cb7f`, `py-tyt_matematik-f23a5637`

**55. Yaş Problemleri** · aday 38 · ölçütü geçen 38 · seçilen 3

`Bir babanın yaşı oğlunun yaşının # katıdır. İkisinin yaşları toplamı # olduğuna göre baba kaç yaşındadır?`

`py-tyt_matematik-a4ff49ec`, `py-tyt_matematik-b4327550`, `py-tyt_matematik-14219a7c`

**56. Yaş Problemleri** · aday 1029 · ölçütü geçen 1029 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dir. # yıl önce yaşları toplamı # olduğuna göre # yıl sonra yaşları toplamı kaç olur?`

`py-tyt_matematik-b033afd4`, `py-tyt_matematik-0b3dd46c`, `py-tyt_matematik-e8dd0c84`

**57. Yaş Problemleri** · aday 110 · ölçütü geçen 110 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dir. # yıl önce yaşları toplamı # olduğuna göre bugünkü yaşlarının çarpımı kaçtır?`

`py-tyt_matematik-1ea5a5b6`, `py-tyt_matematik-df1c6b17`, `py-tyt_matematik-4b7e8483`

**58. Yaş Problemleri** · aday 451 · ölçütü geçen 451 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dir. # yıl önce yaşları toplamı # olduğuna göre büyük kardeş şimdi kaç yaşındadır?`

`py-tyt_matematik-6d207039`, `py-tyt_matematik-a93ef2f5`, `py-tyt_matematik-1c8646f9`

**59. Yaş Problemleri** · aday 535 · ölçütü geçen 535 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dur. # yıl önce yaşları toplamı # olduğuna göre # yıl sonra yaşları toplamı kaç olur?`

`py-tyt_matematik-58fa1cfa`, `py-tyt_matematik-f926a593`, `py-tyt_matematik-98e66519`

**60. Yaş Problemleri** · aday 57 · ölçütü geçen 57 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dur. # yıl önce yaşları toplamı # olduğuna göre bugünkü yaşlarının çarpımı kaçtır?`

`py-tyt_matematik-949d775a`, `py-tyt_matematik-a613ff4d`, `py-tyt_matematik-e65de3b7`

**61. Yaş Problemleri** · aday 229 · ölçütü geçen 229 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dur. # yıl önce yaşları toplamı # olduğuna göre büyük kardeş şimdi kaç yaşındadır?`

`py-tyt_matematik-c591714d`, `py-tyt_matematik-8fbdfcec`, `py-tyt_matematik-98ad5aa4`

**62. Yaş Problemleri** · aday 255 · ölçütü geçen 255 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dır. # yıl önce yaşları toplamı # olduğuna göre # yıl sonra yaşları toplamı kaç olur?`

`py-tyt_matematik-28d0f98b`, `py-tyt_matematik-d0515b49`, `py-tyt_matematik-17207466`

**63. Yaş Problemleri** · aday 19 · ölçütü geçen 19 · seçilen 3

`İki kardeşin yaşları arasındaki fark #'dır. # yıl önce yaşları toplamı # olduğuna göre bugünkü yaşlarının çarpımı kaçtır?`

`py-tyt_matematik-67c9e63b`, `py-tyt_matematik-2cb9bb32`, `py-tyt_matematik-6813b6e8`

**64. Yaş Problemleri** · aday 114 · ölçütü geçen 114 · seçilen 2

`İki kardeşin yaşları arasındaki fark #'dır. # yıl önce yaşları toplamı # olduğuna göre büyük kardeş şimdi kaç yaşındadır?`

`py-tyt_matematik-4f3d5f79`, `py-tyt_matematik-58032ddc`

**65. Yaş Problemleri** · aday 264 · ölçütü geçen 264 · seçilen 2

`İki kardeşin yaşları arasındaki fark #'tir. # yıl önce yaşları toplamı # olduğuna göre # yıl sonra yaşları toplamı kaç olur?`

`py-tyt_matematik-69d7de89`, `py-tyt_matematik-1ed29950`

**66. Yaş Problemleri** · aday 24 · ölçütü geçen 24 · seçilen 2

`İki kardeşin yaşları arasındaki fark #'tir. # yıl önce yaşları toplamı # olduğuna göre bugünkü yaşlarının çarpımı kaçtır?`

`py-tyt_matematik-bd8c1c95`, `py-tyt_matematik-c9a0f339`

**67. Yaş Problemleri** · aday 113 · ölçütü geçen 113 · seçilen 2

`İki kardeşin yaşları arasındaki fark #'tir. # yıl önce yaşları toplamı # olduğuna göre büyük kardeş şimdi kaç yaşındadır?`

`py-tyt_matematik-a1fe5117`, `py-tyt_matematik-53cf13cd`

**68. Yaş Problemleri** · aday 1013 · ölçütü geçen 1013 · seçilen 2

`İki kardeşin yaşları arasındaki fark #'tür. # yıl önce yaşları toplamı # olduğuna göre # yıl sonra yaşları toplamı kaç olur?`

`py-tyt_matematik-11be4fc8`, `py-tyt_matematik-2a45f8dc`

**69. Yaş Problemleri** · aday 90 · ölçütü geçen 90 · seçilen 2

`İki kardeşin yaşları arasındaki fark #'tür. # yıl önce yaşları toplamı # olduğuna göre bugünkü yaşlarının çarpımı kaçtır?`

`py-tyt_matematik-9f26226e`, `py-tyt_matematik-7f542cee`

**70. Yaş Problemleri** · aday 399 · ölçütü geçen 399 · seçilen 2

`İki kardeşin yaşları arasındaki fark #'tür. # yıl önce yaşları toplamı # olduğuna göre büyük kardeş şimdi kaç yaşındadır?`

`py-tyt_matematik-432c1776`, `py-tyt_matematik-a8841aed`
