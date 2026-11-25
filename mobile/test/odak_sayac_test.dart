import 'package:ake_akademi/durum/odak.dart';
import 'package:ake_akademi/veri/oturum_deposu.dart';
import 'package:flutter_test/flutter_test.dart';

/// Odak sayacı: arayüzsüz, sahte saatle. Süre duvar saatinden hesaplanır; uygulama kapanıp açılsa bile doğru kalır.
class _Saat {
  DateTime t = DateTime(2026, 11, 25, 10, 0, 0);
  DateTime al() => t;
  void ilerle(Duration d) => t = t.add(d);
}

class _Sunucu {
  final List<String> gelen = [];
  bool hata = false;
  final Set<String> sayilan = {};
  int fm = 0;
  Future<int> gonder(String tur) async {
    gelen.add(tur);
    if (hata) throw Exception('ag yok');
    if (sayilan.add(tur)) fm += 25;
    return fm;
  }
}

int _kimlikSayaci = 0;

OdakSayaci _yap(_Saat s, AyarDeposu ayar, _Sunucu sunucu, {String hesap = 'h1'}) =>
    OdakSayaci(ayar: ayar, hesapId: hesap, simdi: s.al, gonder: sunucu.gonder, yeniKimlik: () => 'tur-kimlik-${(++_kimlikSayaci).toString().padLeft(8, '0')}');

void main() {
  test('başlangıç: odak 25:00, durmuş; başlat/duraklat/devam saati duvar saatine göre sayar', () async {
    final s = _Saat(), ay = BellekAyar(), sv = _Sunucu();
    final o = _yap(s, ay, sv);
    await o.yukle();
    expect((o.mod, o.calisiyor, o.kalanSn), ('odak', false, 1500));
    o.basla();
    s.ilerle(const Duration(minutes: 10));
    expect(o.kalanSn, 900);
    o.duraklat();
    s.ilerle(const Duration(minutes: 7));
    expect(o.kalanSn, 900, reason: 'duraklatılmışken akmaz');
    expect(o.kismenKullanildi, isTrue);
    o.basla();
    s.ilerle(const Duration(minutes: 4));
    expect(o.kalanSn, 660);
  });

  test('süre dolunca yalnız bir tur: odak → mola, tur sunucuya gider; mola → odak, sunucuya gitmez', () async {
    final s = _Saat(), ay = BellekAyar(), sv = _Sunucu();
    final o = _yap(s, ay, sv);
    await o.yukle();
    o.basla();
    s.ilerle(const Duration(hours: 3)); // çok geç dönüldü: yine tek tur
    o.guncelle();
    await Future<void>.delayed(Duration.zero);
    expect((o.mod, o.calisiyor, o.kalanSn), ('mola', false, 300));
    expect(sv.gelen.length, 1);
    expect(sv.fm, 25);
    expect(o.bekleyen, isEmpty);
    expect(o.olayTuket(), 'odak');
    expect(o.olayTuket(), isNull, reason: 'olay bir kez gösterilir');
    o.basla();
    s.ilerle(const Duration(minutes: 5));
    o.guncelle();
    await Future<void>.delayed(Duration.zero);
    expect((o.mod, o.kalanSn), ('odak', 1500));
    expect(sv.gelen.length, 1);
    expect(o.olayTuket(), 'mola');
  });

  test('mod yalnız dururken değişir; Sıfırla süreyi tam yapar ve yeni tur kimliği üretir', () async {
    final s = _Saat(), ay = BellekAyar(), sv = _Sunucu();
    final o = _yap(s, ay, sv);
    await o.yukle();
    o.basla();
    o.modSec('mola');
    expect(o.mod, 'odak', reason: 'çalışırken değişmez');
    s.ilerle(const Duration(minutes: 3));
    o.duraklat();
    o.sifirla();
    expect(o.kalanSn, 1500);
    o.basla();
    s.ilerle(const Duration(minutes: 25));
    o.guncelle();
    await Future<void>.delayed(Duration.zero);
    final birinci = sv.gelen.single;
    o.modSec('odak');
    o.basla();
    s.ilerle(const Duration(minutes: 25));
    o.guncelle();
    await Future<void>.delayed(Duration.zero);
    expect(sv.gelen.length, 2);
    expect(sv.gelen[1], isNot(birinci), reason: 'her tur ayrı kimlik');
    o.sifirla();
    o.modSec('mola');
    expect(o.kalanSn, 300);
  });

  test('uygulama kapanıp açılınca: çalışan sayaç saatten devam eder; dolmuşsa tur tamamlanır; duraklatılmış süre korunur', () async {
    final s = _Saat(), ay = BellekAyar(), sv = _Sunucu();
    final a = _yap(s, ay, sv);
    await a.yukle();
    a.basla();
    await Future<void>.delayed(Duration.zero);
    s.ilerle(const Duration(minutes: 8)); // uygulama kapalı
    final b = _yap(s, ay, sv);
    await b.yukle();
    expect((b.mod, b.calisiyor, b.kalanSn), ('odak', true, 1020));
    b.duraklat();
    await Future<void>.delayed(Duration.zero);
    s.ilerle(const Duration(hours: 5));
    final c = _yap(s, ay, sv);
    await c.yukle();
    expect((c.calisiyor, c.kalanSn), (false, 1020), reason: 'duraklatılmış süre aynen kalır');
    c.basla();
    await Future<void>.delayed(Duration.zero);
    s.ilerle(const Duration(minutes: 30)); // süre kapalıyken doldu
    final d = _yap(s, ay, sv);
    await d.yukle();
    await Future<void>.delayed(Duration.zero);
    expect((d.mod, d.calisiyor, d.kalanSn), ('mola', false, 300));
    expect(sv.gelen.length, 1, reason: 'kapalıyken biten tur açılışta hesaba yazıldı');
  });

  test('sunucu yokken tur bekler (kalıcı), aynı kimlikle tekrar denenir ve çift sayılmaz; bugunOdakDk bekleyeni de sayar', () async {
    final s = _Saat(), ay = BellekAyar(), sv = _Sunucu()..hata = true;
    final o = _yap(s, ay, sv);
    await o.yukle();
    o.basla();
    s.ilerle(const Duration(minutes: 25));
    o.guncelle();
    await Future<void>.delayed(Duration.zero);
    expect(o.bekleyen.length, 1);
    expect(o.bugunOdakDk(10), 35, reason: 'hesaptaki 10 + bekleyen tur 25');
    final id = o.bekleyen.single;
    // uygulama yeniden açıldı: bekleyen tur diskten geldi
    final p = _yap(s, ay, sv);
    await p.yukle();
    await Future<void>.delayed(Duration.zero);
    expect(p.bekleyen, [id]);
    sv.hata = false;
    expect(await p.bekleyenleriGonder(), 1);
    expect(p.bekleyen, isEmpty);
    expect(sv.gelen.where((x) => x == id).length, greaterThanOrEqualTo(2), reason: 'aynı kimlik tekrar gönderildi');
    expect(sv.fm, 25, reason: 'sunucuda tek kez sayıldı');
    expect(p.bugunOdakDk(10), 25, reason: 'sunucunun günlük toplamı artık hesaptan büyük');
  });

  test('hesaplar ayrı saklanır; bozuk kayıt varsayılana döner', () async {
    final s = _Saat(), ay = BellekAyar(), sv = _Sunucu();
    final a = _yap(s, ay, sv, hesap: 'h1');
    await a.yukle();
    a.modSec('mola');
    await Future<void>.delayed(Duration.zero);
    final b = _yap(s, ay, sv, hesap: 'h2');
    await b.yukle();
    expect(b.mod, 'odak');
    await ay.yaz('odak.h3', '{{bozuk');
    final c = _yap(s, ay, sv, hesap: 'h3');
    await c.yukle();
    expect((c.mod, c.calisiyor, c.kalanSn), ('odak', false, 1500));
  });
}
