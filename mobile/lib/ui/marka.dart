import 'package:flutter/material.dart';

import 'tema.dart';

/// AKE'nin K amblemi. Şekil, sitedeki `docs/tasarim/gen_icons.py` içindeki SVG path'in (D) birebir aynısıdır:
///   M6 60V32A26 26 0 0 1 32 6H58V60z  M25 28v28h6V45.5l14.5 14.5H54L36 41.5 54 22.5v-.1h-8.3L31 38V28z   (fill-rule: evenodd)
/// viewBox 64×64; şeklin kutusu (6,6)–(58,60). Gradyan: kullanıcı uzayında (6,6)→(58,60).
class AkeAmblemYolu {
  static const double sol = 6, ust = 6, sag = 58, alt = 60;
  static const double genislik = sag - sol; // 52
  static const double yukseklik = alt - ust; // 54

  static Path olustur() {
    final p = Path()..fillType = PathFillType.evenOdd;
    // M6 60 V32 A26 26 0 0 1 32 6 H58 V60 z
    p.moveTo(6, 60);
    p.lineTo(6, 32);
    p.arcToPoint(const Offset(32, 6), radius: const Radius.circular(26), clockwise: true);
    p.lineTo(58, 6);
    p.lineTo(58, 60);
    p.close();
    // M25 28 v28 h6 V45.5 l14.5 14.5 H54 L36 41.5 54 22.5 v-.1 h-8.3 L31 38 V28 z
    p.moveTo(25, 28);
    p.lineTo(25, 56);
    p.lineTo(31, 56);
    p.lineTo(31, 45.5);
    p.lineTo(45.5, 60);
    p.lineTo(54, 60);
    p.lineTo(36, 41.5);
    p.lineTo(54, 22.5);
    p.lineTo(54, 22.4);
    p.lineTo(45.7, 22.4);
    p.lineTo(31, 38);
    p.lineTo(31, 28);
    p.close();
    return p;
  }
}

/// Gradyan renkleri. Koyu zeminde (mürekkep kutu, koyu tema): mercan-açık → pembe-soluk (gen_icons `tile`).
/// Açık zeminde (çıplak amblem): koyu mercan → mercan-açık (gen_icons `bare`).
class AkeAmblemRenk {
  final Color baslangic;
  final Color bitis;
  const AkeAmblemRenk(this.baslangic, this.bitis);
  static const koyuZemin = AkeAmblemRenk(Color(0xFFF27D6D), Color(0xFFFAD6D0));
  static const acikZemin = AkeAmblemRenk(Color(0xFFD94F43), Color(0xFFF27D6D));
}

class _AmblemBoyaci extends CustomPainter {
  final AkeAmblemRenk renk;
  /// 0..1: şeklin ne kadarının çizildiği (açılış animasyonu için; 1 = tam). Tam çizimde bölgeleme yok.
  final double saydamlik;
  const _AmblemBoyaci(this.renk, this.saydamlik);

  @override
  void paint(Canvas canvas, Size size) {
    final olcek = size.width / AkeAmblemYolu.genislik;
    canvas.save();
    canvas.scale(olcek, olcek);
    canvas.translate(-AkeAmblemYolu.sol, -AkeAmblemYolu.ust);
    const kutu = Rect.fromLTRB(AkeAmblemYolu.sol, AkeAmblemYolu.ust, AkeAmblemYolu.sag, AkeAmblemYolu.alt);
    final boya = Paint()
      ..isAntiAlias = true
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [renk.baslangic.withValues(alpha: saydamlik), renk.bitis.withValues(alpha: saydamlik)],
      ).createShader(kutu);
    canvas.drawPath(AkeAmblemYolu.olustur(), boya);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_AmblemBoyaci eski) => eski.renk != renk || eski.saydamlik != saydamlik;
}

/// Çıplak K amblemi (kutusuz). [yukseklik] verilmez; genişlikten, şeklin 52:54 oranıyla hesaplanır.
class AkeAmblem extends StatelessWidget {
  final double genislik;
  final AkeAmblemRenk renk;
  final double saydamlik;
  const AkeAmblem({super.key, required this.genislik, this.renk = AkeAmblemRenk.koyuZemin, this.saydamlik = 1});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'AKE Akademi K amblemi',
      image: true,
      child: ExcludeSemantics(
        child: CustomPaint(
          size: Size(genislik, genislik * AkeAmblemYolu.yukseklik / AkeAmblemYolu.genislik),
          painter: _AmblemBoyaci(renk, saydamlik),
        ),
      ),
    );
  }
}

/// Sitedeki `.logo-tile`: mürekkep zeminli, %28 yuvarlak köşeli kutuda K (kutunun %70'i).
class AmblemKutu extends StatelessWidget {
  final double boyut;
  const AmblemKutu({super.key, this.boyut = 32});

  @override
  Widget build(BuildContext context) {
    final k = boyut * 0.62;
    return Semantics(
      label: 'AKE Akademi amblemi',
      image: true,
      child: ExcludeSemantics(
        child: Container(
          width: boyut,
          height: boyut,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(boyut * 0.28),
            gradient: const RadialGradient(center: Alignment(0, -1), radius: 1.3, colors: [AkeTok.murekkepAcik, AkeTok.murekkepSabit, AkeTok.murekkepSabit], stops: [0, 0.6, 1]),
            border: Border.all(color: const Color(0x1FFFFFFF)),
            boxShadow: const [BoxShadow(color: Color(0x9928232C), blurRadius: 14, spreadRadius: -6, offset: Offset(0, 6))],
          ),
          alignment: Alignment.center,
          // K'nin optik merkezi şeklin kutusunun biraz üstünde: sitedeki ikonlarla aynı küçük düzeltme.
          child: Transform.translate(offset: Offset(0, -boyut * 0.008), child: AkeAmblem(genislik: k)),
        ),
      ),
    );
  }
}

/// "AKE Akademi" yazısı (site `.wm`): koyu üst çubukta porselen renk, "Akademi" biraz soluk.
class AkeYaziMarka extends StatelessWidget {
  final double boyut;
  final Color renk;
  final bool akademiGoster;
  const AkeYaziMarka({super.key, this.boyut = 19, required this.renk, this.akademiGoster = true});

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(children: [
        const TextSpan(text: 'AKE'),
        if (akademiGoster) TextSpan(text: ' Akademi', style: TextStyle(color: renk.withValues(alpha: 0.86))),
      ]),
      maxLines: 1,
      overflow: TextOverflow.fade,
      softWrap: false,
      style: TextStyle(fontFamily: AkeYazi.govde, fontSize: boyut, fontWeight: FontWeight.w700, letterSpacing: -0.2, color: renk, height: 1),
    );
  }
}
