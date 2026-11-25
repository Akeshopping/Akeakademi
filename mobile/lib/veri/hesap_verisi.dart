/// Hesaptan (sunucudan) okunan çalışma verisi: web ile aynı belgeler (`profile`, `stats`, `plan`). Salt okunur.
/// Hiçbir alan uydurulmaz: veri yoksa null/boş döner ve ekran bunu açıkça söyler.
class PlanGorevi {
  final String metin;
  final int gun; // 0 = Pazartesi
  final String ders;
  final int dakika;
  final bool bitti;
  const PlanGorevi({required this.metin, required this.gun, required this.ders, required this.dakika, required this.bitti});
}

class GunSayisi {
  final String gun; // yyyy-MM-dd
  final int soru;
  final int dogru;
  const GunSayisi(this.gun, this.soru, this.dogru);
}

/// Web `exams` belgesindeki deneme özeti (web ve mobil denemeleri birlikte; `qs` yok sayılır).
class DenemeKaydi {
  final String id;
  final String baslik;
  final int tarihMs;
  final int dogru;
  final int yanlis;
  final int bos;
  final double net;
  final bool mobil;
  const DenemeKaydi({required this.id, required this.baslik, required this.tarihMs, required this.dogru, required this.yanlis, required this.bos, required this.net, required this.mobil});
}

class KonuBasarisi {
  final String ders;
  final String konu;
  final int dogru;
  final int yanlis;
  const KonuBasarisi(this.ders, this.konu, this.dogru, this.yanlis);
  int get cozulen => dogru + yanlis;
  int get yuzde => cozulen == 0 ? 0 : (dogru * 100 / cozulen).round();
}

class HesapVerisi {
  final String ad;
  final String alan;
  final int gunlukHedef;
  final String sinavTarihi;
  final Map<String, GunSayisi> gunluk;
  final List<KonuBasarisi> konular;
  final List<PlanGorevi> plan;
  final List<DenemeKaydi> denemeler; // eskiden yeniye
  const HesapVerisi({
    required this.ad,
    required this.alan,
    required this.gunlukHedef,
    required this.sinavTarihi,
    required this.gunluk,
    required this.konular,
    required this.plan,
    this.denemeler = const [],
  });

  static const varsayilanSinav = '2027-06-19';

  static int _i(Object? v) => v is num ? v.toInt() : 0;
  static Map<String, dynamic> _m(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  factory HesapVerisi.alanlardan(Map<String, dynamic> alanlar) {
    final profil = _m(_m(alanlar['profile'])['profile']); // site belge biçimi: {_u, profile: {…}}
    final stats = _m(alanlar['stats']);
    final plan = _m(_m(alanlar['plan'])['plan']); // {_u, plan: {tasks}}
    final gunluk = <String, GunSayisi>{};
    _m(stats['daily']).forEach((g, v) {
      final d = _m(v);
      gunluk[g] = GunSayisi(g, _i(d['q']), _i(d['c']));
    });
    final konular = <KonuBasarisi>[];
    _m(stats['topic']).forEach((anahtar, v) {
      if (v is! List || v.length < 2) return;
      final parca = anahtar.split('|');
      konular.add(KonuBasarisi(parca.first, parca.length > 1 ? parca.sublist(1).join('|') : '', _i(v[0]), _i(v[1])));
    });
    final gorevler = <PlanGorevi>[];
    final liste = plan['tasks'];
    if (liste is List) {
      for (final g in liste) {
        final t = _m(g);
        final metin = '${t['text'] ?? ''}'.trim();
        if (metin.isEmpty) continue;
        gorevler.add(PlanGorevi(metin: metin, gun: _i(t['day']).clamp(0, 6).toInt(), ders: '${t['s'] ?? ''}', dakika: _i(t['min']), bitti: t['done'] == true));
      }
    }
    final denemeler = <DenemeKaydi>[];
    final exListe = _m(alanlar['exams'])['exams'];
    if (exListe is List) {
      for (final e in exListe) {
        final m = _m(e);
        if (m['kind'] != 'exam' || m['net'] is! num) continue;
        denemeler.add(DenemeKaydi(
          id: '${m['id'] ?? ''}',
          baslik: '${m['title'] ?? 'Deneme'}',
          tarihMs: _i(m['date']),
          dogru: _i(m['d']),
          yanlis: _i(m['y']),
          bos: _i(m['b']),
          net: (m['net'] as num).toDouble(),
          mobil: m['src'] == 'mobil',
        ));
      }
    }
    final hedef = _i(profil['gunluk']);
    final sinav = '${profil['examDate'] ?? ''}';
    return HesapVerisi(
      ad: '${profil['name'] ?? ''}'.trim(),
      alan: '${profil['alan'] ?? ''}',
      gunlukHedef: hedef > 0 ? hedef : 40,
      sinavTarihi: RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(sinav) ? sinav : varsayilanSinav,
      gunluk: gunluk,
      konular: konular,
      plan: gorevler,
      denemeler: denemeler,
    );
  }

  static String gunAnahtari(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  GunSayisi bugun(DateTime simdi) => gunluk[gunAnahtari(simdi)] ?? GunSayisi(gunAnahtari(simdi), 0, 0);

  /// Bugünden geriye [n] gün (eskiden yeniye).
  List<GunSayisi> sonGunler(DateTime simdi, int n) {
    final r = <GunSayisi>[];
    for (var i = n - 1; i >= 0; i--) {
      final g = gunAnahtari(DateTime(simdi.year, simdi.month, simdi.day - i));
      r.add(gunluk[g] ?? GunSayisi(g, 0, 0));
    }
    return r;
  }

  /// Site (`totals()`) ile aynı kaynak: günlük sayaçların toplamı. Günlük kayıt hiç yoksa konu toplamına düşer.
  int get toplamSoru => gunluk.isNotEmpty ? gunluk.values.fold(0, (a, g) => a + g.soru) : konular.fold(0, (a, k) => a + k.cozulen);
  int get toplamDogru => gunluk.isNotEmpty ? gunluk.values.fold(0, (a, g) => a + g.dogru) : konular.fold(0, (a, k) => a + k.dogru);

  /// Sınava kalan tam gün (en az 0). Site: ceil((sınav 10:15 +03:00 − şimdi) / gün).
  int kalanGun(DateTime simdi) {
    final p = sinavTarihi.split('-').map(int.parse).toList();
    final hedef = DateTime.utc(p[0], p[1], p[2], 7, 15); // 10:15 +03:00
    final fark = hedef.difference(simdi.toUtc()).inMinutes / 1440;
    final g = fark.ceil();
    return g < 0 ? 0 : g;
  }
}

const gunAdlari = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const aylarTr = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/// "24 Kasım Salı"
String tarihMetni(DateTime d) => '${d.day} ${aylarTr[d.month - 1]} ${gunAdlari[d.weekday - 1]}';

const alanAdlari = {'SAY': 'Sayısal', 'EA': 'Eşit Ağırlık', 'SOZ': 'Sözel', 'DIL': 'Dil'};
