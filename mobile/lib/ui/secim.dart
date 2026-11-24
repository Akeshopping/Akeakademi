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

  @override
  void initState() {
    super.initState();
    _ozet = widget.model.api.ozet();
  }

  void _yenile() => setState(() => _ozet = widget.model.api.ozet());

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
        );
      },
    );
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
      builder: (_) => SoruEkrani(model: widget.model, ders: widget.ders, konu: konu),
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
                AkeDugme('Karışık 10 soru', basinca: () => _baslat(null), simge: Icons.shuffle_rounded),
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
