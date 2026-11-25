import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/hesap_verisi.dart';
import '../veri/katalog.dart';
import 'ortak.dart';
import 'plan.dart';
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

  bool _gorevMesgul = false;

  /// Bugünün plan görevini işaretler: planı sürümle okur, koşullu yazar (409'da yeniden dener), sonra hesabı yeniler.
  Future<void> _gorevIsaretle(String id, bool bitti) async {
    if (_gorevMesgul || id.isEmpty) return;
    setState(() => _gorevMesgul = true);
    try {
      await PlanDeposu(widget.model.api).uygula((l) => [for (final g in l) g.id == id ? g.kopya(bitti: bitti) : g]);
      final y = _yukle();
      if (mounted) setState(() => _f = y);
      await y;
    } catch (_) {
      // Hata sessiz geçilmez: yenilenen veri eski kalır, kullanıcı Plan sekmesinde ayrıntıyı görür.
    } finally {
      if (mounted) setState(() => _gorevMesgul = false);
    }
  }

  Future<void> _yenile() async {
    final y = _yukle();
    setState(() { _f = y; });
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
    final zayif = v.konular.where((k) => k.cozulen >= 5).toList()..sort((a, b) => a.yuzde.compareTo(b.yuzde));
    return [
      _Program(model: widget.model, veri: v, gorevIsaretle: _gorevIsaretle, mesgul: _gorevMesgul),
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

/// Sitedeki "Bugünün programı": günlük hedef, zayıf konular (10 soru), plandaki bugünkü görevler ve haftalık mini deneme.
/// Hepsi hesaptaki gerçek veriden hesaplanır; "Sıradaki" ilk bitmemiş maddedir. Yanlış tekrarı ve kart tekrarı mobilde yok.
class ProgramMaddesi {
  final String baslik;
  final String alt;
  final bool bitti;
  final String eylem; // Çöz / Başla
  final VoidCallback? calistir;
  final String? ders;
  final String? gorevKimligi;
  const ProgramMaddesi({required this.baslik, required this.alt, required this.bitti, required this.eylem, this.calistir, this.ders, this.gorevKimligi});
}

List<ProgramMaddesi> programMaddeleri(HesapVerisi v, DateTime simdi, {required UygulamaModeli model, required BuildContext context}) {
  final bugun = v.bugun(simdi);
  final cikti = <ProgramMaddesi>[];
  cikti.add(ProgramMaddesi(
    baslik: '${v.gunlukHedef} soru çöz',
    alt: 'Bugün ${bugun.soru}/${v.gunlukHedef}',
    bitti: bugun.soru >= v.gunlukHedef,
    eylem: 'Çöz',
    calistir: () => model.sekmeGit(1),
  ));
  final zayif = v.konular.where((k) => k.cozulen >= 3 && k.konu.isNotEmpty).toList()..sort((a, b) => a.yuzde != b.yuzde ? a.yuzde.compareTo(b.yuzde) : b.cozulen.compareTo(a.cozulen));
  for (final k in zayif.take(2)) {
    final n = bugun.konuSayisi['${k.ders}|${k.konu}'] ?? 0;
    cikti.add(ProgramMaddesi(
      baslik: '${Katalog.dersAdi(k.ders)}: ${k.konu}',
      alt: '10 soru, bugün ${n > 10 ? 10 : n}/10',
      bitti: n >= 10,
      eylem: 'Çöz',
      ders: k.ders,
      calistir: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SoruEkrani(model: model, ders: k.ders, konu: k.konu))),
    ));
  }
  final sonDeneme = v.denemeler.isEmpty ? 0 : v.denemeler.map((e) => e.tarihMs).reduce(math.max);
  if (simdi.millisecondsSinceEpoch - sonDeneme > 6 * 86400000) {
    final bugunYapildi = v.denemeler.any((e) => HesapVerisi.gunAnahtari(DateTime.fromMillisecondsSinceEpoch(e.tarihMs)) == HesapVerisi.gunAnahtari(simdi));
    cikti.add(ProgramMaddesi(baslik: 'Mini deneme', alt: 'Haftalık durum kontrolü, süreli', bitti: bugunYapildi, eylem: 'Başla', calistir: () { model.denemeOnAyar = 'mini'; model.sekmeGit(2); }));
  }
  return cikti;
}

class _Program extends StatelessWidget {
  final UygulamaModeli model;
  final HesapVerisi veri;
  final Future<void> Function(String id, bool bitti) gorevIsaretle;
  final bool mesgul;
  const _Program({required this.model, required this.veri, required this.gorevIsaretle, required this.mesgul});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final simdi = DateTime.now();
    final bugun = veri.bugun(simdi);
    final maddeler = programMaddeleri(veri, simdi, model: model, context: context);
    final gunNo = simdi.weekday - 1;
    final gorevler = veri.plan.where((g) => g.gun == gunNo).toList();
    final tamam = maddeler.where((m) => m.bitti).length;
    final sira = maddeler.indexWhere((m) => !m.bitti);
    final oran = (bugun.soru / veri.gunlukHedef).clamp(0.0, 1.0).toDouble();
    final yuzde = bugun.soru == 0 ? 0 : (bugun.dogru * 100 / bugun.soru).round();
    return KartKutu(
      key: const ValueKey('bugunun-programi'),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('Bugünün programı', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700))),
          const SizedBox(width: 8),
          Text('$tamam/${maddeler.length} tamam', style: TextStyle(color: t.murekkep2, fontSize: 13)),
        ]),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(value: oran, minHeight: 8, color: t.mercan, backgroundColor: t.girinti),
        ),
        const SizedBox(height: 10),
        Text(
          bugun.soru == 0 ? 'Bugün henüz soru çözmedin. İlk soru seni bekliyor.' : 'Bugün ${bugun.soru} soru çözdün · %$yuzde doğru',
          style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 6),
        for (var i = 0; i < maddeler.length; i++) _ProgramSatiri(madde: maddeler[i], siradaki: i == sira),
        if (gorevler.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('Planındaki görevler', key: const ValueKey('plan-gorevleri'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          for (final g in gorevler) _PlanSatiri(g: g, isaretle: gorevIsaretle, mesgul: mesgul, model: model),
        ],
      ]),
    );
  }
}

class _ProgramSatiri extends StatelessWidget {
  final ProgramMaddesi madde;
  final bool siradaki;
  const _ProgramSatiri({required this.madde, required this.siradaki});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final r = madde.ders == null ? null : dersRengi(context, madde.ders!);
    return Container(
      constraints: const BoxConstraints(minHeight: 60),
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
      child: Row(children: [
        if (r != null) Container(width: 4, height: 38, margin: const EdgeInsets.only(right: 10), decoration: BoxDecoration(color: r.metin, borderRadius: BorderRadius.circular(2))),
        Icon(madde.bitti ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 22, color: madde.bitti ? t.dogru : t.cizgiGuclu),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (siradaki) Text('SIRADAKİ', style: TextStyle(color: t.mercan, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
            Text(madde.baslik, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, height: 1.25, decoration: madde.bitti ? TextDecoration.lineThrough : null, color: madde.bitti ? t.murekkep3 : t.murekkep)),
            Text(madde.alt, style: TextStyle(color: t.murekkep2, fontSize: 12.5)),
          ]),
        ),
        const SizedBox(width: 8),
        if (madde.bitti)
          Text('Tamam', style: TextStyle(color: t.murekkep3, fontSize: 13))
        else
          AkeDugme(madde.eylem, genis: false, tur: siradaki ? DugmeTuru.dolu : DugmeTuru.cizgili, basinca: madde.calistir),
      ]),
    );
  }
}

class _PlanSatiri extends StatelessWidget {
  final PlanGorevi g;
  final Future<void> Function(String id, bool bitti) isaretle;
  final bool mesgul;
  final UygulamaModeli model;
  const _PlanSatiri({required this.g, required this.isaretle, required this.mesgul, required this.model});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final dersli = g.ders.isNotEmpty && !g.bitti;
    return Container(
      constraints: const BoxConstraints(minHeight: 56),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
      child: Row(children: [
        Expanded(
          child: Semantics(
            button: true,
            checked: g.bitti,
            label: '${g.metin}, ${g.bitti ? 'tamamlandı' : 'tamamlanmadı'}. Değiştirmek için dokun.',
            child: ExcludeSemantics(
              child: AkeDokun(
                basinca: mesgul ? null : () => isaretle(g.id, !g.bitti),
                child: Container(
                  key: ValueKey('ana-gorev-${g.id}'),
                  constraints: const BoxConstraints(minHeight: 56),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(children: [
                    Icon(g.bitti ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 22, color: g.bitti ? t.dogru : t.cizgiGuclu),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(g.metin, style: TextStyle(fontWeight: FontWeight.w600, height: 1.3, decoration: g.bitti ? TextDecoration.lineThrough : null, color: g.bitti ? t.murekkep3 : t.murekkep)),
                        if (g.ders.isNotEmpty || g.dakika > 0)
                          Text([if (g.ders.isNotEmpty) Katalog.dersAdi(g.ders), if (g.dakika > 0) '${g.dakika} dk'].join(' · '), style: TextStyle(color: t.murekkep2, fontSize: 12.5)),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
        if (dersli)
          AkeDugme('Çöz', key: ValueKey('ana-gorev-coz-${g.id}'), genis: false, tur: DugmeTuru.cizgili, basinca: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SoruEkrani(model: model, ders: g.ders)))),
      ]),
    );
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
              Text(ad.trim().isEmpty ? 'Merhaba' : 'Merhaba ${ad.trim()}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AkeTok.porselen, height: 1.1)),
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
        satir(Icons.timer_outlined, 'Bölümlü tam deneme', 'Tam TYT/AYT bölümlü ve canlı denemeler şimdilik akeakademi.com üzerinden çözülüyor.'),
        satir(Icons.groups_outlined, 'Arkadaş ligi ve Sınıfım', 'Sosyal bölümler mobilde henüz yok; sitede çalışıyor.'),
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
