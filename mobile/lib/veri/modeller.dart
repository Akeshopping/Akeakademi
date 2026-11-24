/// Sunucu yanıtlarının tipli karşılıkları. Cevap anahtarı yalnızca CEVAPLANDIKTAN sonra gelir; Soru modelinde doğru şık alanı yoktur.
class Kullanici {
  final String id;
  final String eposta;
  final String ad;
  const Kullanici({required this.id, required this.eposta, required this.ad});
  factory Kullanici.fromJson(Map<String, dynamic> j) =>
      Kullanici(id: '${j['id'] ?? ''}', eposta: '${j['eposta'] ?? ''}', ad: '${j['ad'] ?? ''}');
}

class Soru {
  final String id;
  final String ders;
  final String konu;
  final int zorluk;
  final String? paragraf;
  final String metin;
  final List<String> secenekler;
  const Soru({
    required this.id,
    required this.ders,
    required this.konu,
    required this.zorluk,
    required this.paragraf,
    required this.metin,
    required this.secenekler,
  });
  factory Soru.fromJson(Map<String, dynamic> j) {
    final o = (j['o'] as List? ?? const []).map((e) => '$e').toList();
    if (o.length != 5 || j['q'] is! String) {
      throw const FormatException('Bozuk soru');
    }
    return Soru(
      id: '${j['id']}',
      ders: '${j['s']}',
      konu: '${j['t']}',
      zorluk: (j['d'] is num) ? (j['d'] as num).toInt() : 2,
      paragraf: (j['p'] is String && (j['p'] as String).isNotEmpty) ? j['p'] as String : null,
      metin: j['q'] as String,
      secenekler: o,
    );
  }
}

class OturumYaniti {
  final String oturum;
  final String mod;
  final int adet;
  final List<Soru> sorular;
  final bool sinirsiz;
  final int? kotaKalan;
  const OturumYaniti({
    required this.oturum,
    required this.mod,
    required this.adet,
    required this.sorular,
    required this.sinirsiz,
    required this.kotaKalan,
  });
  factory OturumYaniti.fromJson(Map<String, dynamic> j) {
    final kota = j['kota'] is Map ? Map<String, dynamic>.from(j['kota'] as Map) : const <String, dynamic>{};
    final sorular = <Soru>[];
    for (final s in (j['sorular'] as List? ?? const [])) {
      try {
        sorular.add(Soru.fromJson(Map<String, dynamic>.from(s as Map)));
      } on FormatException {
        // bozuk soru atlanır
      }
    }
    return OturumYaniti(
      oturum: '${j['oturum']}',
      mod: '${j['mod']}',
      adet: (j['adet'] is num) ? (j['adet'] as num).toInt() : sorular.length,
      sorular: sorular,
      sinirsiz: kota['sinirsiz'] == true,
      kotaKalan: kota['kalan'] is num ? (kota['kalan'] as num).toInt() : null,
    );
  }
}

class CevapSonucu {
  final bool dogru;
  final int dogruSecenek;
  final String? aciklama;
  const CevapSonucu({required this.dogru, required this.dogruSecenek, required this.aciklama});
  factory CevapSonucu.fromJson(Map<String, dynamic> j) => CevapSonucu(
        dogru: j['dogru'] == true,
        dogruSecenek: (j['a'] is num) ? (j['a'] as num).toInt() : -1,
        aciklama: j['x'] is String && (j['x'] as String).isNotEmpty ? j['x'] as String : null,
      );
}

/// Bitişte sunucunun döndüğü soru satırı. Sınav (deneme) cevap anahtarı yalnız BURADA, oturum bittikten sonra gelir.
class SonucSatir {
  final String id;
  final int? secim;
  final int? dogruSecenek;
  final String? aciklama;
  final bool? dogru;
  const SonucSatir({required this.id, required this.secim, required this.dogruSecenek, required this.aciklama, required this.dogru});
  factory SonucSatir.fromJson(Map<String, dynamic> j) => SonucSatir(
        id: '${j['id']}',
        secim: j['secim'] is num ? (j['secim'] as num).toInt() : null,
        dogruSecenek: j['a'] is num ? (j['a'] as num).toInt() : null,
        aciklama: j['x'] is String && (j['x'] as String).isNotEmpty ? j['x'] as String : null,
        dogru: j['dogru'] is bool ? j['dogru'] as bool : null,
      );
}

class OturumSonucu {
  final int dogru;
  final int yanlis;
  final int bos;
  final List<SonucSatir> sorular;
  const OturumSonucu({required this.dogru, required this.yanlis, required this.bos, this.sorular = const []});
  factory OturumSonucu.fromJson(Map<String, dynamic> j) => OturumSonucu(
        dogru: (j['dogru'] as num?)?.toInt() ?? 0,
        yanlis: (j['yanlis'] as num?)?.toInt() ?? 0,
        bos: (j['bos'] as num?)?.toInt() ?? 0,
        sorular: [
          for (final e in (j['sorular'] as List? ?? const []))
            if (e is Map) SonucSatir.fromJson(Map<String, dynamic>.from(e)),
        ],
      );

  /// Site ile aynı net: doğru − yanlış/4 (yüzde bire yuvarlı).
  double get net => ((dogru - yanlis / 4) * 100).round() / 100;
}

/// /api/hesap/ben: paket, AI kullanımı ve ücretsiz haklar (sunucu söyler; istemci hesap yapmaz).
class HesapDurumu {
  final String? plan; // null = paket yok
  final String bitis;
  final int aiMesaj;
  final int aiMesajLimit;
  final int aiGuclu;
  final int aiGucluLimit;
  final bool ucretsizVar;
  final int? kalanSoru;
  final int? kalanDeneme;
  const HesapDurumu({this.plan, this.bitis = '', this.aiMesaj = 0, this.aiMesajLimit = 0, this.aiGuclu = 0, this.aiGucluLimit = 0, this.ucretsizVar = false, this.kalanSoru, this.kalanDeneme});
  bool get paketli => plan != null;
  factory HesapDurumu.fromJson(Map<String, dynamic> j) {
    Map<String, dynamic> m(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
    int n(Object? v) => v is num ? v.toInt() : 0;
    final paket = j['paket'] is Map ? m(j['paket']) : null;
    final k = m(j['kullanim']), l = m(j['limit']), u = m(j['ucretsiz']);
    return HesapDurumu(
      plan: paket == null ? null : '${paket['plan'] ?? ''}',
      bitis: paket == null ? '' : '${paket['bitis'] ?? ''}',
      aiMesaj: n(k['mesaj']),
      aiMesajLimit: n(l['mesaj']),
      aiGuclu: n(k['guclu']),
      aiGucluLimit: n(l['guclu']),
      ucretsizVar: u.isNotEmpty && u['sinirsiz'] != true,
      kalanSoru: u['kalanSoru'] is num ? n(u['kalanSoru']) : null,
      kalanDeneme: u['kalanDeneme'] is num ? n(u['kalanDeneme']) : null,
    );
  }
}

/// Hesap belgesi + sürümü (koşullu yazma için). [surum] sunucunun `u` değeridir.
class SurumluBelge {
  final Map<String, dynamic> belge;
  final int surum;
  const SurumluBelge(this.belge, this.surum);
}

class Ozet {
  final int toplam;
  /// ders anahtarı → (konu adı → soru sayısı)
  final Map<String, Map<String, int>> konular;
  const Ozet({required this.toplam, required this.konular});
  factory Ozet.fromJson(Map<String, dynamic> j) {
    final k = <String, Map<String, int>>{};
    final dersler = j['dersler'] is Map ? Map<String, dynamic>.from(j['dersler'] as Map) : const <String, dynamic>{};
    dersler.forEach((ders, v) {
      final konular = (v is Map && v['konular'] is Map) ? Map<String, dynamic>.from(v['konular'] as Map) : const <String, dynamic>{};
      final m = <String, int>{};
      konular.forEach((konu, kv) {
        final n = (kv is Map && kv['toplam'] is num) ? (kv['toplam'] as num).toInt() : 0;
        if (n > 0) m[konu] = n;
      });
      if (m.isNotEmpty) k[ders] = m;
    });
    return Ozet(toplam: (j['toplam'] as num?)?.toInt() ?? 0, konular: k);
  }
  int dersToplami(String ders) => (konular[ders] ?? const <String, int>{}).values.fold(0, (a, b) => a + b);
}
