import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'marka.dart';
import 'tema.dart';

/// İlk açılışta bir kez oynayan kısa giriş: konu haritasının noktaları ve yolları bir öğrenme yolunda birleşir,
/// nokta ve çizgiler K amblemin gerçek köşe noktalarına oturur; son karede gerçek K amblemi (aynı path, aynı gradyan) belirir.
///
/// Süre: [sure] (2,2 sn) + 0,25 sn sönme. "Geç" ilk kareden itibaren görünür; ekranın herhangi bir yerine dokunmak da geçer.
/// "Hareketi azalt" açıksa hiç oynamaz. Tekrar açılışta kullanıcı hiç bekletilmez (çağıran taraf bayrağı saklar).
class AcilisKatmani extends StatefulWidget {
  final VoidCallback bitti;
  final Duration sure;
  const AcilisKatmani({super.key, required this.bitti, this.sure = const Duration(milliseconds: 2200)});
  @override
  State<AcilisKatmani> createState() => _AcilisKatmaniState();
}

class _AcilisKatmaniState extends State<AcilisKatmani> with TickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.sure);
  late final AnimationController _son = AnimationController(vsync: this, duration: const Duration(milliseconds: 250));
  bool _bitirildi = false;
  bool _basladi = false;

  @override
  void initState() {
    super.initState();
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed) _sonlandir();
    });
    _son.addStatusListener((s) {
      if (s == AnimationStatus.completed) _bitir();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_basladi) return;
    _basladi = true;
    if (MediaQuery.of(context).disableAnimations) {
      // Hareketi azalt: animasyon oynamaz; ilk karede bitir.
      WidgetsBinding.instance.addPostFrameCallback((_) => _bitir());
    } else {
      _c.forward();
    }
  }

  void _sonlandir() {
    if (_son.isAnimating || _bitirildi) return;
    _son.forward();
  }

  void _bitir() {
    if (_bitirildi) return;
    _bitirildi = true;
    widget.bitti();
  }

  void _gec() {
    if (_bitirildi) return;
    _c.stop();
    _bitir();
  }

  @override
  void dispose() {
    _c.dispose();
    _son.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return const SizedBox.shrink();
    final ust = MediaQuery.paddingOf(context).top;
    return Material(
      type: MaterialType.transparency,
      child: AnimatedBuilder(
        animation: Listenable.merge([_c, _son]),
        builder: (context, _) {
          final u = _c.value;
          final sonme = 1 - Curves.easeIn.transform(_son.value);
          return Opacity(
            opacity: sonme,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _gec,
              child: Container(
                color: AkeTok.murekkepSabit,
                child: Stack(children: [
                  Positioned.fill(child: CustomPaint(painter: _AcilisBoyaci(u))),
                  Positioned(
                    top: ust + 8,
                    right: 8,
                    child: Semantics(
                      button: true,
                      label: 'Animasyonu geç',
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _gec,
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 64, minHeight: 48),
                          alignment: Alignment.center,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: const Text('Geç', style: TextStyle(color: AkeTok.uzerindeKoyu2, fontWeight: FontWeight.w600, fontSize: 15)),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// K amblemin köşe noktaları (path D'nin ikinci alt yolu; sitedeki ikonla aynı koordinatlar).
const List<Offset> _kKoseleri = [
  Offset(25, 28), Offset(25, 56), Offset(31, 56), Offset(31, 45.5), Offset(45.5, 60),
  Offset(54, 60), Offset(36, 41.5), Offset(54, 22.4), Offset(45.7, 22.4), Offset(31, 38),
];

class _AcilisBoyaci extends CustomPainter {
  final double u;
  _AcilisBoyaci(this.u);

  static double _aralik(double u, double a, double b) => ((u - a) / (b - a)).clamp(0.0, 1.0).toDouble();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final emblemW = math.min(w * 0.42, 168.0);
    final emblemH = emblemW * AkeAmblemYolu.yukseklik / AkeAmblemYolu.genislik;
    final merkez = Offset(w / 2, h * 0.44);
    final sol = merkez.dx - emblemW / 2, ust = merkez.dy - emblemH / 2;
    Offset hedef(Offset p) => Offset(sol + (p.dx - AkeAmblemYolu.sol) * emblemW / AkeAmblemYolu.genislik, ust + (p.dy - AkeAmblemYolu.ust) * emblemW / AkeAmblemYolu.genislik);

    // Dağınık başlangıç noktaları (sabit tohum: her açılışta aynı, deterministik).
    final rnd = math.Random(11);
    final n = _kKoseleri.length;
    final baslangic = List.generate(n, (i) {
      final a = (i / n) * 2 * math.pi + rnd.nextDouble() * 0.8;
      final r = (0.32 + rnd.nextDouble() * 0.3) * math.min(w, h) * 1.15;
      return Offset(merkez.dx + math.cos(a) * r, merkez.dy + math.sin(a) * r * 1.1);
    });

    final giris = _aralik(u, 0.0, 0.28);
    final hareket = Curves.easeInOutCubic.transform(_aralik(u, 0.22, 0.72));
    final doldur = Curves.easeOut.transform(_aralik(u, 0.64, 0.92));
    final cizgiSon = 1 - Curves.easeIn.transform(_aralik(u, 0.72, 0.92));

    // Arka plan ışığı (mercan, K belirdikçe güçlenir).
    final isik = Paint()..shader = RadialGradient(colors: [const Color(0xFFF27D6D).withValues(alpha: 0.10 + 0.20 * doldur), const Color(0x00F27D6D)]).createShader(Rect.fromCircle(center: merkez, radius: math.min(w, h) * 0.55));
    canvas.drawRect(Offset.zero & size, isik);

    // Nokta konumları: dağınıktan K köşelerine.
    final konum = <Offset>[
      for (var i = 0; i < n; i++)
        Offset.lerp(baslangic[i], hedef(_kKoseleri[i]), Curves.easeInOutCubic.transform(_aralik(hareket, i * 0.03, 0.7 + i * 0.03)))!,
    ];

    // Çizgiler: zincir (öğrenme yolu) + çapraz konu bağları (hareketle sönen).
    final zincir = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..color = Color.lerp(const Color(0xFFB3AAB8), const Color(0xFFF27D6D), hareket)!.withValues(alpha: (0.25 + 0.6 * hareket) * giris * cizgiSon);
    final yol = Path()..moveTo(konum[0].dx, konum[0].dy);
    for (var i = 1; i < n; i++) {
      yol.lineTo(konum[i].dx, konum[i].dy);
    }
    yol.close();
    final olcum = yol.computeMetrics().toList();
    for (final m in olcum) {
      canvas.drawPath(m.extractPath(0, m.length * Curves.easeOut.transform(giris)), zincir);
    }
    final bag = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color(0xFFB3AAB8).withValues(alpha: 0.22 * giris * (1 - hareket));
    for (var i = 0; i < n; i++) {
      canvas.drawLine(konum[i], konum[(i + 3) % n], bag);
    }

    // Noktalar.
    for (var i = 0; i < n; i++) {
      final belir = _aralik(giris, i * 0.05, 0.5 + i * 0.05);
      final sonme = 1 - _aralik(u, 0.74, 0.94);
      final yaricap = (3.0 + 2.2 * (1 - hareket)) * belir;
      final p = Paint()..color = Color.lerp(const Color(0xFFD2CAD4), const Color(0xFFF27D6D), hareket)!.withValues(alpha: belir * sonme);
      canvas.drawCircle(konum[i], yaricap, p);
      if (belir > 0 && sonme > 0) {
        canvas.drawCircle(konum[i], yaricap * 2.6, Paint()..color = const Color(0xFFF27D6D).withValues(alpha: 0.10 * belir * sonme));
      }
    }

    // Gerçek K amblemi: aynı path + gradyan; köşe noktaları üzerine oturur.
    if (doldur > 0) {
      canvas.save();
      final olcek = 0.94 + 0.06 * doldur;
      canvas.translate(merkez.dx, merkez.dy);
      canvas.scale(olcek, olcek);
      canvas.translate(-merkez.dx, -merkez.dy);
      canvas.translate(sol, ust);
      final o = emblemW / AkeAmblemYolu.genislik;
      canvas.scale(o, o);
      canvas.translate(-AkeAmblemYolu.sol, -AkeAmblemYolu.ust);
      final kutu = const Rect.fromLTRB(AkeAmblemYolu.sol, AkeAmblemYolu.ust, AkeAmblemYolu.sag, AkeAmblemYolu.alt);
      final boya = Paint()
        ..isAntiAlias = true
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AkeAmblemRenk.koyuZemin.baslangic.withValues(alpha: doldur), AkeAmblemRenk.koyuZemin.bitis.withValues(alpha: doldur)],
        ).createShader(kutu);
      canvas.drawPath(AkeAmblemYolu.olustur(), boya);
      canvas.restore();
    }

    // Site adı.
    final yazi = _aralik(u, 0.78, 1.0);
    if (yazi > 0) {
      final tp = TextPainter(
        text: TextSpan(children: [
          TextSpan(text: 'AKE', style: TextStyle(color: AkeTok.porselen.withValues(alpha: yazi))),
          TextSpan(text: ' Akademi', style: TextStyle(color: AkeTok.porselen.withValues(alpha: 0.86 * yazi))),
        ], style: const TextStyle(fontFamily: AkeYazi.govde, fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(merkez.dx - tp.width / 2, ust + emblemH + 28 + (1 - yazi) * 8));
    }
  }

  @override
  bool shouldRepaint(_AcilisBoyaci eski) => eski.u != u;
}
