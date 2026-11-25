import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/api.dart';
import '../veri/ilerleme.dart';
import '../veri/katalog.dart';
import '../veri/modeller.dart';
import 'ortak.dart';
import 'soru.dart';
import 'tema.dart';

/// "Soru çöz" sekmesi: 1) sınavı seç, 2) dersini seç → konu listesi → soru oturumu.
/// Konu/soru sayıları sunucunun /api/soru/ozet yanıtından gelir; soru olmayan ders/konu listelenmez ya da pasif görünür.
class SoruCozSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const SoruCozSekmesi({super.key, required this.model});
  @override
  State<SoruCozSekmesi> createState() => _SoruCozSekmesiState();
}

class _SoruCozSekmesiState extends State<SoruCozSekmesi> {
  late Future<Ozet> _ozet;
  String _sinav = 'TYT';
  int _sekme = 0; // 0 Konular · 1 Soru ara · 2 Paragraf
  int? _zorluk; // arama ve paragraf için (null = karışık)
  final TextEditingController _ara = TextEditingController();

  @override
  void initState() {
    super.initState();
    _ozet = widget.model.api.ozet();
  }

  @override
  void dispose() {
    _ara.dispose();
    super.dispose();
  }

  void _yenile() {
    setState(() {
      _ozet = widget.model.api.ozet();
    });
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    return FutureBuilder<Ozet>(
      future: _ozet,
      builder: (context, s) {
        if (s.connectionState != ConnectionState.done) return const Yukleniyor(metin: 'Sınavlar hazırlanıyor…');
        if (s.hasError) return _hataGorunumu(s.error!, _yenile);
        final ozet = s.data!;
        if (ozet.toplam == 0) {
          return DurumKutusu(simge: Icons.hourglass_empty, baslik: 'Henüz soru yok', aciklama: 'Soru bankası şu an boş görünüyor. Biraz sonra tekrar dene.', dugme: 'Yenile', basinca: _yenile);
        }
        final sinav = Katalog.sinavlar.firstWhere((e) => e.anahtar == _sinav, orElse: () => Katalog.sinavlar.first);
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          children: [
            const _Baslik('Soru Çözüm Merkezi'),
            const SizedBox(height: 14),
            _SekmeSecici(secili: _sekme, degisti: (i) => setState(() => _sekme = i)),
            const SizedBox(height: 16),
            if (_sekme == 1) ..._araGovdesi(context, m)
            else if (_sekme == 2) ..._paragrafGovdesi(context, m, ozet)
            else ...[
            const _AdimBasligi(1, 'Hangi sınava çalışıyorsun?'),
            const SizedBox(height: 10),
            LayoutBuilder(builder: (context, c) {
              final w = (c.maxWidth - 10) / 2;
              return Wrap(spacing: 10, runSpacing: 10, children: [
                for (final e in Katalog.sinavlar)
                  SizedBox(
                    width: e.anahtar == 'YDT' ? c.maxWidth : w,
                    child: _SinavKarti(sinav: e, soruSayisi: e.dersler.fold<int>(0, (a, d) => a + ozet.dersToplami(d)), secili: e.anahtar == _sinav, basinca: () => setState(() => _sinav = e.anahtar)),
                  ),
              ]);
            }),
            const SizedBox(height: 22),
            const _AdimBasligi(2, 'Dersini seç'),
            const SizedBox(height: 10),
            LayoutBuilder(builder: (context, c) {
              final w = (c.maxWidth - 10) / 2;
              return Wrap(spacing: 10, runSpacing: 10, children: [
                for (final d in sinav.dersler)
                  SizedBox(
                    width: w,
                    child: _DersKarti(
                      ders: d,
                      konuSayisi: (ozet.konular[d] ?? const <String, int>{}).length,
                      soruSayisi: ozet.dersToplami(d),
                      basinca: ozet.dersToplami(d) == 0 ? null : () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => KonuEkrani(model: m, ders: d, ozet: ozet))),
                    ),
                  ),
              ]);
            }),
            ],
          ],
        );
      },
    );
  }

  List<Widget> _araGovdesi(BuildContext context, UygulamaModeli m) {
    final t = context.ake;
    final gecerli = _ara.text.trim().length >= 2;
    return [
      Text('Soru metninde geçen bir kelimeyi yaz; eşleşen sorulardan 10 soruluk oturum açılır.', style: TextStyle(color: t.murekkep2, height: 1.4)),
      const SizedBox(height: 12),
      TextField(
        key: const ValueKey('ara-girdi'),
        controller: _ara,
        maxLength: 60,
        textInputAction: TextInputAction.search,
        decoration: const InputDecoration(labelText: 'Aranacak kelime', hintText: 'Örn. asal, paragraf, mol', border: OutlineInputBorder(), counterText: ''),
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => gecerli ? _araBaslat(m) : null,
      ),
      const SizedBox(height: 12),
      _ZorlukSecici(secili: _zorluk, degisti: (z) => setState(() => _zorluk = z)),
      const SizedBox(height: 14),
      AkeDugme('Ara ve çöz', key: const ValueKey('ara-baslat'), simge: Icons.search_rounded, basinca: gecerli ? () => _araBaslat(m) : null),
      if (!gecerli) Padding(padding: const EdgeInsets.only(top: 8), child: Text('En az 2 karakter yaz.', style: TextStyle(color: t.murekkep3, fontSize: 12.5))),
    ];
  }

  void _araBaslat(UygulamaModeli m) {
    final k = _ara.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (k.length < 2) return;
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SoruEkrani(model: m, ara: k, zorluk: _zorluk)));
  }

  List<Widget> _paragrafGovdesi(BuildContext context, UygulamaModeli m, Ozet ozet) {
    final t = context.ake;
    final n = (ozet.konular['turkce'] ?? const <String, int>{})['Paragraf'] ?? 0;
    if (n == 0) {
      return [KartKutu(child: Text('Bu soru bankasında “Paragraf” konusu henüz yok.', style: TextStyle(color: t.murekkep2, height: 1.4)))];
    }
    final r = dersRengi(context, 'turkce');
    return [
      SolSeritKutu(
        serit: r.metin,
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Paragraf', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text('Türkçe · $n soru. Okuma parçalı sorular.', style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.35)),
        ]),
      ),
      const SizedBox(height: 12),
      _ZorlukSecici(secili: _zorluk, degisti: (z) => setState(() => _zorluk = z)),
      const SizedBox(height: 14),
      AkeDugme('Paragraf çöz', key: const ValueKey('paragraf-baslat'), simge: Icons.menu_book_rounded, basinca: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SoruEkrani(model: m, ders: 'turkce', konu: 'Paragraf', zorluk: _zorluk)))),
    ];
  }

  Widget _hataGorunumu(Object e, VoidCallback tekrar) {
    if (e is ApiHata && e.tur == HataTuru.oturum) return const Yukleniyor(metin: 'Oturum kontrol ediliyor…');
    if (e is ApiHata && e.tur == HataTuru.kapali) {
      return DurumKutusu(
        simge: Icons.construction,
        baslik: 'Soru servisi henüz açık değil',
        aciklama: 'Bu sunucuda mobil soru servisi etkin değil. Test sürümünde Preview adresini kullanmalısın.',
        dugme: 'Tekrar dene',
        basinca: tekrar,
      );
    }
    return DurumKutusu(simge: Icons.cloud_off, baslik: 'Yüklenemedi', aciklama: hataMetni(e), dugme: 'Tekrar dene', basinca: tekrar);
  }
}

class _Baslik extends StatelessWidget {
  final String metin;
  const _Baslik(this.metin);
  @override
  Widget build(BuildContext context) => Text(metin, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15));
}

class _AdimBasligi extends StatelessWidget {
  final int no;
  final String metin;
  const _AdimBasligi(this.no, this.metin);
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return Row(children: [
      Container(
        width: 26,
        height: 26,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: t.koyu ? t.murekkep : AkeTok.murekkepSabit, shape: BoxShape.circle),
        child: Text('$no', style: TextStyle(color: t.koyu ? AkeTok.murekkepSabit : AkeTok.porselen, fontWeight: FontWeight.w700, fontSize: 13)),
      ),
      const SizedBox(width: 10),
      Expanded(child: Text(metin, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
    ]);
  }
}

class _SinavKarti extends StatelessWidget {
  final Sinav sinav;
  final int soruSayisi;
  final bool secili;
  final VoidCallback basinca;
  const _SinavKarti({required this.sinav, required this.soruSayisi, required this.secili, required this.basinca});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final bos = soruSayisi == 0;
    return Semantics(
      selected: secili,
      label: '${sinav.ad}, ${sinav.aciklama}, $soruSayisi soru',
      child: ExcludeSemantics(
        child: AkeDokun(
          basinca: bos ? null : basinca,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            constraints: const BoxConstraints(minHeight: 96),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: secili ? t.girinti : t.kart,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: secili ? t.murekkep : t.cizgi, width: secili ? 2 : 1),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(sinav.ad, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
                if (secili) Icon(Icons.check_circle_rounded, size: 20, color: t.murekkep),
              ]),
              const SizedBox(height: 4),
              Text(sinav.aciklama, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.murekkep2, fontSize: 12.5, height: 1.3)),
              const SizedBox(height: 6),
              Text(bos ? 'Henüz soru yok' : '$soruSayisi soru', style: TextStyle(color: bos ? t.uyari : t.murekkep3, fontSize: 12.5)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _DersKarti extends StatelessWidget {
  final String ders;
  final int konuSayisi;
  final int soruSayisi;
  final VoidCallback? basinca;
  const _DersKarti({required this.ders, required this.konuSayisi, required this.soruSayisi, required this.basinca});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final r = dersRengi(context, ders);
    final bos = basinca == null;
    return Semantics(
      label: '${Katalog.dersAdi(ders)}, ${bos ? 'henüz soru yok' : '$konuSayisi konu, $soruSayisi soru'}',
      child: ExcludeSemantics(
        child: AkeDokun(
          basinca: basinca,
          child: SolSeritKutu(
            serit: bos ? t.cizgi : r.metin,
            minYukseklik: 64,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(Katalog.dersAdi(ders), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: bos ? t.murekkep3 : t.murekkep)),
              const SizedBox(height: 3),
              Text(bos ? 'Yakında' : '$konuSayisi konu', style: TextStyle(color: bos ? t.uyari : t.murekkep2, fontSize: 12.5)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Konu seçimi; hesaptaki ilerleme (varsa) her konunun yanında görünür.
class KonuEkrani extends StatefulWidget {
  final UygulamaModeli model;
  final String ders;
  final Ozet ozet;
  const KonuEkrani({super.key, required this.model, required this.ders, required this.ozet});
  @override
  State<KonuEkrani> createState() => _KonuEkraniState();
}

class _KonuEkraniState extends State<KonuEkrani> {
  Map<String, KonuIlerlemesi> _ilerleme = const {};
  int? _zorluk; // null = karışık

  @override
  void initState() {
    super.initState();
    widget.model.senkron.hesaptanOku().then((v) {
      if (mounted) setState(() => _ilerleme = v);
    }).catchError((Object _) {
      // ilerleme gösterilemese de konu seçimi çalışır
    });
  }

  void _baslat(String? konu) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => SoruEkrani(model: widget.model, ders: widget.ders, konu: konu, zorluk: _zorluk),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final r = dersRengi(context, widget.ders);
    final konular = (widget.ozet.konular[widget.ders] ?? const <String, int>{});
    final adlar = konular.keys.toList()..sort((a, b) => a.compareTo(b));
    return AkeSayfa(
      baslik: Katalog.dersAdi(widget.ders),
      govde: adlar.isEmpty
          ? const DurumKutusu(simge: Icons.hourglass_empty, baslik: 'Bu derste konu yok', aciklama: 'Bu ders için henüz soru eklenmemiş.')
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              children: [
                _ZorlukSecici(secili: _zorluk, degisti: (z) => setState(() => _zorluk = z)),
                const SizedBox(height: 12),
                AkeDugme(_zorluk == null ? 'Karışık 10 soru' : '10 ${_zorlukAdi(_zorluk!).toLowerCase()} soru', basinca: () => _baslat(null), simge: Icons.shuffle_rounded),
                const SizedBox(height: 16),
                for (final k in adlar) ...[
                  Semantics(
                    label: '$k, ${konular[k]} soru',
                    child: ExcludeSemantics(
                      child: AkeDokun(
                        basinca: () => _baslat(k),
                        child: SolSeritKutu(
                          serit: r.metin,
                          minYukseklik: 64,
                          padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                          child: Row(children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(k, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, height: 1.25)),
                                const SizedBox(height: 3),
                                Text(_altMetin(k, konular[k] ?? 0), style: TextStyle(color: t.murekkep2, fontSize: 13)),
                              ]),
                            ),
                            Icon(Icons.chevron_right_rounded, color: t.murekkep3),
                          ]),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            ),
    );
  }

  String _altMetin(String konu, int n) {
    final p = _ilerleme['${widget.ders}|$konu'];
    if (p == null || p.cozulen == 0) return '$n soru';
    final yuzde = (p.dogru * 100 / p.cozulen).round();
    return '$n soru · ${p.cozulen} çözüldü · %$yuzde doğru';
  }
}

String _zorlukAdi(int z) => z == 1 ? 'Kolay' : (z == 2 ? 'Orta' : 'Zor');

/// Sitedeki "Zorluk" seçimi: Karışık · Kolay · Orta · Zor (sunucu `zorluk` filtresi 1/2/3; yoksa karışık).
class _ZorlukSecici extends StatelessWidget {
  final int? secili;
  final ValueChanged<int?> degisti;
  const _ZorlukSecici({required this.secili, required this.degisti});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final secenekler = <(int?, String)>[(null, 'Karışık'), (1, 'Kolay'), (2, 'Orta'), (3, 'Zor')];
    return Semantics(
      container: true,
      label: 'Zorluk seçimi',
      child: Row(children: [
        for (var i = 0; i < secenekler.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Semantics(
              button: true,
              selected: secili == secenekler[i].$1,
              child: ExcludeSemantics(
                child: AkeDokun(
                  basinca: () => degisti(secenekler[i].$1),
                  child: Container(
                    key: ValueKey('zorluk-${secenekler[i].$1 ?? 0}'),
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: secili == secenekler[i].$1 ? t.girinti : t.kart,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: secili == secenekler[i].$1 ? t.murekkep : t.cizgi, width: secili == secenekler[i].$1 ? 1.6 : 1),
                    ),
                    child: Text(secenekler[i].$2, maxLines: 1, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: secili == secenekler[i].$1 ? t.murekkep : t.murekkep2)),
                  ),
                ),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// Soru Çözüm Merkezi sekmeleri. Yalnız sunucu desteği olanlar: Konular, Soru ara (sunucu `ara` filtresi), Paragraf.
/// "ÖSYM tarzı" ve "AI ile üret" sunucuda karşılığı olmadığı için YOK.
class _SekmeSecici extends StatelessWidget {
  final int secili;
  final ValueChanged<int> degisti;
  const _SekmeSecici({required this.secili, required this.degisti});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    const adlar = ['Konular', 'Soru ara', 'Paragraf'];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: t.girinti, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        for (var i = 0; i < adlar.length; i++)
          Expanded(
            child: Semantics(
              button: true,
              selected: i == secili,
              label: adlar[i],
              child: ExcludeSemantics(
                child: AkeDokun(
                  basinca: () => degisti(i),
                  child: AnimatedContainer(
                    key: ValueKey('soru-sekme-$i'),
                    duration: const Duration(milliseconds: 160),
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: i == secili ? t.kart : Colors.transparent, borderRadius: BorderRadius.circular(11), border: Border.all(color: i == secili ? t.cizgi : Colors.transparent)),
                    child: Text(adlar[i], maxLines: 1, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: i == secili ? t.murekkep : t.murekkep2)),
                  ),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}
