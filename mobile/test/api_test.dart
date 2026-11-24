import 'package:ake_akademi/veri/api.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter_test/flutter_test.dart';

import 'sahte_sunucu.dart';

AkeApi yeniApi(SahteSunucu s, [BellekDeposu? depo]) => AkeApi(taban: 'https://test.ake', istemci: s.istemci, depo: depo ?? BellekDeposu());

void main() {
  test('kod doğrulanınca oturum anahtarı güvenli depoya yazılır ve istemci:"mobil" gönderilir', () async {
    final s = SahteSunucu(), depo = BellekDeposu(), api = yeniApi(s, depo);
    final k = await api.kodDogrula('Ogrenci@Ornek.com', '12345678');
    expect(k.eposta, 'Ogrenci@Ornek.com');
    expect(await depo.oku(), SahteSunucu.anahtar);
    expect(s.istekler.last.body, contains('"istemci":"mobil"'));
    expect(api.girisli, isTrue);
  });

  test('yanlış kod: anahtar saklanmaz, ApiHata(gecersiz, kod_yanlis)', () async {
    final s = SahteSunucu(), depo = BellekDeposu(), api = yeniApi(s, depo);
    await expectLater(api.kodDogrula('a@b.co', '00000000'), throwsA(isA<ApiHata>().having((e) => e.kod, 'kod', 'kod_yanlis')));
    expect(await depo.oku(), isNull);
  });

  test('kimlikli istekler Bearer gönderir; çerez, Origin, Referer ve gizli anahtar göndermez', () async {
    final s = SahteSunucu(), api = yeniApi(s, BellekDeposu(SahteSunucu.anahtar));
    await api.anahtariYukle();
    await api.ozet();
    final h = s.istekler.last.headers;
    expect(h['authorization'], 'Bearer ${SahteSunucu.anahtar}');
    expect(h.containsKey('cookie'), isFalse);
    expect(h.containsKey('origin'), isFalse);
    expect(h.containsKey('referer'), isFalse);
  });

  test('oturumsuz kimlikli istek ağa hiç çıkmadan oturum hatası verir', () async {
    final s = SahteSunucu(), api = yeniApi(s);
    await expectLater(api.ozet(), throwsA(isA<ApiHata>().having((e) => e.tur, 'tur', HataTuru.oturum)));
    expect(s.istekler, isEmpty);
  });

  test('401: yerel anahtar silinir ve dinleyici bir kez çağrılır', () async {
    final s = SahteSunucu()..oturumGecerli = false, depo = BellekDeposu(SahteSunucu.anahtar), api = yeniApi(s, depo);
    var cagri = 0;
    api.oturumBittiDinleyici = () => cagri++;
    await api.anahtariYukle();
    await expectLater(api.ben(), throwsA(isA<ApiHata>().having((e) => e.tur, 'tur', HataTuru.oturum)));
    expect(await depo.oku(), isNull);
    expect(api.girisli, isFalse);
    expect(cagri, 1);
  });

  test('hata türleri: 402 limit, 404 yok → kapali, ağ hatası → ag', () async {
    final s = SahteSunucu()..limitDoldu = true, api = yeniApi(s, BellekDeposu(SahteSunucu.anahtar));
    await api.anahtariYukle();
    await expectLater(api.oturumOlustur(istek: 'x' * 20, adet: 5), throwsA(isA<ApiHata>().having((e) => e.tur, 'tur', HataTuru.limit)));
    s.soruServisiAcik = false;
    await expectLater(api.ozet(), throwsA(isA<ApiHata>().having((e) => e.tur, 'tur', HataTuru.kapali)));
    s.agYok = true;
    await expectLater(api.ozet(), throwsA(isA<ApiHata>().having((e) => e.tur, 'tur', HataTuru.ag)));
  });

  test('oturum yanıtında cevap anahtarı yok; cevap sonrası doğru şık ve açıklama gelir', () async {
    final s = SahteSunucu(), api = yeniApi(s, BellekDeposu(SahteSunucu.anahtar));
    await api.anahtariYukle();
    final o = await api.oturumOlustur(istek: 'm-' + 'x' * 20, adet: 2, ders: 'mat');
    expect(o.sorular.length, 2);
    expect(o.sorular.first.secenekler.length, 5);
    final r = await api.cevapVer(oturum: o.oturum, soru: 'q1', secim: 2);
    expect(r.dogru, isTrue);
    expect(r.dogruSecenek, 2);
    expect(r.aciklama, 'Açıklama metni');
  });

  test('çıkış: ağ yoksa bile yerel oturum silinir', () async {
    final s = SahteSunucu()..agYok = true, depo = BellekDeposu(SahteSunucu.anahtar), api = yeniApi(s, depo);
    await api.anahtariYukle();
    await api.cikis();
    expect(await depo.oku(), isNull);
    expect(api.girisli, isFalse);
  });
}
