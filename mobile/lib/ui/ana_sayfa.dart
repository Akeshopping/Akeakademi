import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/hesap_verisi.dart';
import '../veri/katalog.dart';
import 'ortak.dart';
import 'soru.dart';
import 'tema.dart';

/// Ana sayfa: karşılama kartı, bugünün hedefi (hesaptaki gerçek günlük sayılar), zayıf konular ve mobilde henüz olmayan bölümler.
class AnaSayfa extends StatefulWidget {
  final UygulamaModeli model;
  final void Function(HesapVerisi) veriGeldi;
  const AnaSayfa({super.key, required this.model, required this.veriGeldi});
  @override
  State<AnaSayfa> createState() => _AnaSayfaState();
}

class _AnaSayfaState extends State<AnaSayfa> {
  late Future<HesapVerisi> _f;

  @override
  void initState() {
    super.initState();
    _f = _yukle();
  }

  Future<HesapVerisi> _yukle() async {
    final v = await widget.model.hesapVerisi();
    widget.veriGeldi(v);
    return v;
  }

  Future<void> _yenile() async {
    final y = _yukle();
    setState(() => _f = y);
    try {
      await y;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return RefreshIndicator(
      color: t.mercan,
      backgroundColor: t.kart,
      onRefresh: _yenile,
      child: FutureBuilder<HesapVerisi>(
        future: _f,
        builder: (context, s) {
          final v = s.data;
          final yukleniyor = s.connectionState != ConnectionState.done;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            children: [
              _Karsilama(model: widget.model, veri: v),
              const SizedBox(height: 14),
              if (yukleniyor) const _Iskelet() else if (s.hasError) _Hata(hata: s.error!, tekrar: _yenile) else ..._icerik(v!),
              const SizedBox(height: 14),
              const _MobildeYok(),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _icerik(HesapVerisi v) {
    final t = context.ake;
    final bugun = v.bugun(DateTime.now());
    final oran = (bugun.soru / v.gunlukHedef).clamp(0.0, 1.0).toDouble();
    final yuzde = bugun.soru == 0 ? 0 : (bugun.dogru * 100 / bugun.soru).round();
    final zayif = v.konular.where((k) => k.cozulen >= 5).toList()..sort((a, b) => a.yuzde.compareTo(b.yuzde));
    return [
      KartKutu(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Expanded(child: Text('Bugünün hedefi', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700))),
            const SizedBox(width: 8),
            Hap('${bugun.soru}/${v.gunlukHedef} soru'),
          ]),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(value: oran, minHeight: 8, color: t.mercan, backgroundColor: t.girinti),
          ),
          const SizedBox(height: 12),
          Text(
            bugun.soru == 0 ? 'Bugün henüz soru çözmedin. İlk soru seni bekliyor.' : 'Bugün ${bugun.soru} soru çözdün · %$yuzde doğru',
            style: TextStyle(color: t.murekkep2, height: 1.4),
          ),
        ]),
      ),
      const SizedBox(height: 14),
      KartKutu(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Tekrar çözmeye değer', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('En az 5 soru çözdüğün konulardan başarısı en düşük olanlar.', style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.4)),
          const SizedBox(height: 6),
          if (zayif.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Text('Henüz yeterli çözümün yok. Birkaç konudan soru çözdükçe zayıf konuların burada görünür.', style: TextStyle(color: t.murekkep3, height: 1.4)),
            )
          else
            for (final k in zayif.take(3)) _KonuSatiri(konu: k, model: widget.model),
        ]),
      ),
    ];
  }
}

class _Karsilama extends StatelessWidget {
  final UygulamaModeli model;
  final HesapVerisi? veri;
  const _Karsilama({required this.model, required this.veri});

  @override
  Widget build(BuildContext context) {
    final simdi = DateTime.now();
    final ad = (veri?.ad.isNotEmpty == true ? veri!.ad : (model.kullanici?.ad.trim() ?? ''));
    final ilk = ad.split(' ').first;
    final kalan = veri?.kalanGun(simdi);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [AkeTok.murekkepAcik, AkeTok.murekkepSabit]),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(children: [
          Positioned.fill(child: CustomPaint(painter: _YayBoyaci())),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(ilk.isEmpty ? 'Merhaba' : 'Merhaba $ilk', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AkeTok.porselen, height: 1.1)),
              const SizedBox(height: 8),
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: tarihMetni(simdi)),
                  if (kalan != null) ...[
                    const TextSpan(text: " · YKS 2027'ye "),
                    TextSpan(text: '$kalan', style: rakamStili(AkeTok.acik.mercanAcik, 15)),
                    const TextSpan(text: ' gün'),
                  ],
                ]),
                style: const TextStyle(color: AkeTok.uzerindeKoyu2, height: 1.4),
              ),
              const SizedBox(height: 18),
              AkeDugme('Soru çöz', basinca: () => model.sekmeGit(1), genis: false, simge: Icons.arrow_forward_rounded),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Kartın alt kenarındaki ince mercan yay (sitedeki karşılama kartının ışık çizgisi).
class _YayBoyaci extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final yol = Path()
      ..moveTo(size.width * 0.05, size.height * 1.02)
      ..cubicTo(size.width * 0.35, size.height * 0.82, size.width * 0.7, size.height * 0.88, size.width * 1.02, size.height * 0.55);
    final boya = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..shader = const LinearGradient(colors: [Color(0x00F27D6D), Color(0x99F27D6D), Color(0x00F27D6D)]).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(yol, boya);
    final glow = Paint()
      ..shader = const RadialGradient(colors: [Color(0x24F27D6D), Color(0x00F27D6D)]).createShader(Rect.fromCircle(center: Offset(size.width * 1.02, 0), radius: math.max(size.width, size.height) * 0.7));
    canvas.drawRect(Offset.zero & size, glow);
  }

  @override
  bool shouldRepaint(_YayBoyaci eski) => false;
}

class _KonuSatiri extends StatelessWidget {
  final KonuBasarisi konu;
  final UygulamaModeli model;
  const _KonuSatiri({required this.konu, required this.model});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final r = dersRengi(context, konu.ders);
    return AkeDokun(
      basinca: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SoruEkrani(model: model, ders: konu.ders, konu: konu.konu.isEmpty ? null : konu.konu))),
      child: Container(
        constraints: const BoxConstraints(minHeight: 56),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
        child: Row(children: [
          Container(width: 4, height: 36, decoration: BoxDecoration(color: r.metin, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(konu.konu.isEmpty ? Katalog.dersAdi(konu.ders) : konu.konu, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.25)),
              const SizedBox(height: 2),
              Text('${Katalog.dersAdi(konu.ders)} · ${konu.cozulen} soru', style: TextStyle(color: t.murekkep2, fontSize: 12.5)),
            ]),
          ),
          const SizedBox(width: 10),
          Text('%${konu.yuzde}', style: rakamStili(konu.yuzde < 50 ? t.yanlis : t.uyari, 17)),
          const SizedBox(width: 6),
          Icon(Icons.chevron_right_rounded, color: t.murekkep3),
        ]),
      ),
    );
  }
}

class _MobildeYok extends StatelessWidget {
  const _MobildeYok();
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    Widget satir(IconData ic, String ad, String acik) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(color: t.girinti, borderRadius: BorderRadius.circular(10)), child: Icon(ic, size: 20, color: t.murekkep3)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(ad, style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(acik, style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.35)),
            ])),
          ]),
        );
    return KartKutu(
      renk: t.kagit,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('Sitede var, mobilde henüz yok', style: TextStyle(fontWeight: FontWeight.w700, color: t.murekkep))),
        ]),
        const SizedBox(height: 4),
        satir(Icons.timer_outlined, 'Deneme sınavları', 'Süreli denemeler şimdilik akeakademi.com üzerinden çözülüyor.'),
        satir(Icons.auto_awesome_outlined, 'AI öğretmen', 'Mobilde açık değil; sitede çalışıyor.'),
      ]),
    );
  }
}

class _Iskelet extends StatelessWidget {
  const _Iskelet();
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    Widget kutu(double h) => Container(height: h, margin: const EdgeInsets.only(bottom: 14), decoration: BoxDecoration(color: t.girinti, borderRadius: BorderRadius.circular(16)));
    return Column(children: [kutu(120), kutu(160)]);
  }
}

class _Hata extends StatelessWidget {
  final Object hata;
  final VoidCallback tekrar;
  const _Hata({required this.hata, required this.tekrar});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return KartKutu(
      renk: t.uyariZemin,
      kenar: t.uyari,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Hesap verin getirilemedi', style: TextStyle(color: t.uyari, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(hataMetni(hata), style: TextStyle(color: t.uyari, height: 1.4)),
        const SizedBox(height: 12),
        AkeDugme('Tekrar dene', basinca: tekrar, tur: DugmeTuru.cizgili, genis: false),
      ]),
    );
  }
}
