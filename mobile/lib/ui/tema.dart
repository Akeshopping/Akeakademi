import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;

/// AKE Ritmi — site tasarım token'larının (docs/tasarim/tokens.css) mobil karşılığı. Açık ve koyu tema aynı adlarla.
/// Renk değerleri tokens.css'den alınmıştır; her yüzey/metin çifti orada ölçülmüş kontrasta sahiptir.
@immutable
class AkeTok extends ThemeExtension<AkeTok> {
  final bool koyu;
  final Color kagit, kart, girinti, yukselen;
  final Color murekkep, murekkep2, murekkep3;
  final Color cizgi, cizgiGuclu;
  final Color mercan, mercanUstu, mercanYumusak, mercanDeko, mercanAcik;
  final Color dogru, dogruZemin, yanlis, yanlisZemin, uyari, uyariZemin;
  final Color ustCubuk, ustMetin, ustMetin2;

  const AkeTok({
    required this.koyu,
    required this.kagit,
    required this.kart,
    required this.girinti,
    required this.yukselen,
    required this.murekkep,
    required this.murekkep2,
    required this.murekkep3,
    required this.cizgi,
    required this.cizgiGuclu,
    required this.mercan,
    required this.mercanUstu,
    required this.mercanYumusak,
    required this.mercanDeko,
    required this.mercanAcik,
    required this.dogru,
    required this.dogruZemin,
    required this.yanlis,
    required this.yanlisZemin,
    required this.uyari,
    required this.uyariZemin,
    required this.ustCubuk,
    required this.ustMetin,
    required this.ustMetin2,
  });

  /// Sabit mürekkep tonları (temadan etkilenmez): üst çubuk, kahraman kartı, K amblem kutusu.
  static const murekkepSabit = Color(0xFF28232C);
  static const murekkepAcik = Color(0xFF3A3340);
  static const porselen = Color(0xFFF8F5F0);
  static const uzerindeKoyu2 = Color(0xFFD2CAD4);
  static const uzerindeKoyu3 = Color(0xFFB3AAB8);

  static const acik = AkeTok(
    koyu: false,
    kagit: Color(0xFFF8F5F0),
    kart: Color(0xFFFFFFFF),
    girinti: Color(0xFFF0EBE3),
    yukselen: Color(0xFFFFFFFF),
    murekkep: Color(0xFF28232C),
    murekkep2: Color(0xFF5C5560),
    murekkep3: Color(0xFF6B6370),
    cizgi: Color(0xFFE8E1D9),
    cizgiGuclu: Color(0xFF8A8290),
    mercan: Color(0xFFB73F36),
    mercanUstu: Color(0xFFFFFFFF),
    mercanYumusak: Color(0xFFF9E5E1),
    mercanDeko: Color(0xFFD94F43),
    mercanAcik: Color(0xFFF27D6D),
    dogru: Color(0xFF476650),
    dogruZemin: Color(0xFFE6EEE8),
    yanlis: Color(0xFF9E1B4B),
    yanlisZemin: Color(0xFFFBE9EE),
    uyari: Color(0xFF7A4300),
    uyariZemin: Color(0xFFFBEBD6),
    ustCubuk: Color(0xFF28232C),
    ustMetin: Color(0xFFF8F5F0),
    ustMetin2: Color(0xFFD2CAD4),
  );

  static const koyuTema = AkeTok(
    koyu: true,
    kagit: Color(0xFF1E1A21),
    kart: Color(0xFF28232C),
    girinti: Color(0xFF221D26),
    yukselen: Color(0xFF322C37),
    murekkep: Color(0xFFF8F5F0),
    murekkep2: Color(0xFFD2CAD4),
    murekkep3: Color(0xFFB3AAB8),
    cizgi: Color(0xFF3C3541),
    cizgiGuclu: Color(0xFF8B8290),
    mercan: Color(0xFFF27D6D),
    mercanUstu: Color(0xFF28232C),
    mercanYumusak: Color(0x24F27D6D),
    mercanDeko: Color(0xFFF27D6D),
    mercanAcik: Color(0xFFF27D6D),
    dogru: Color(0xFF8FBF9F),
    dogruZemin: Color(0x248FBF9F),
    yanlis: Color(0xFFF28AA8),
    yanlisZemin: Color(0x24F28AA8),
    uyari: Color(0xFFE8B65A),
    uyariZemin: Color(0x24E8B65A),
    ustCubuk: Color(0xFF1E1A21),
    ustMetin: Color(0xFFF8F5F0),
    ustMetin2: Color(0xFFD2CAD4),
  );

  @override
  AkeTok copyWith() => this;

  @override
  AkeTok lerp(ThemeExtension<AkeTok>? diger, double t) => (diger is AkeTok && t >= 0.5) ? diger : this;
}

extension AkeBaglam on BuildContext {
  AkeTok get ake => Theme.of(this).extension<AkeTok>() ?? AkeTok.acik;
}

/// Ders etiketi renkleri (metin / zemin). Site: --s-tr, --s-mat, --s-fen, --s-sos, --s-dil.
class DersRengi {
  final Color metin;
  final Color zemin;
  const DersRengi(this.metin, this.zemin);
}

enum DersGrubu { tr, mat, fen, sos, dil }

DersGrubu dersGrubu(String ders) {
  switch (ders) {
    case 'turkce':
    case 'edebiyat':
      return DersGrubu.tr;
    case 'mat':
    case 'geo':
    case 'amat':
      return DersGrubu.mat;
    case 'fizik':
    case 'kimya':
    case 'biyoloji':
    case 'afizik':
    case 'akimya':
    case 'abiyoloji':
      return DersGrubu.fen;
    case 'ingilizce':
      return DersGrubu.dil;
    default:
      return DersGrubu.sos;
  }
}

DersRengi dersRengi(BuildContext c, String ders) {
  final koyu = c.ake.koyu;
  switch (dersGrubu(ders)) {
    case DersGrubu.tr:
      return koyu ? const DersRengi(Color(0xFFC79BE0), Color(0xFF413649)) : const DersRengi(Color(0xFF7B4A9B), Color(0xFFF2EDF5));
    case DersGrubu.mat:
      return koyu ? const DersRengi(Color(0xFF8FB4F0), Color(0xFF383A4B)) : const DersRengi(Color(0xFF2F5FA7), Color(0xFFEAEFF6));
    case DersGrubu.fen:
      return koyu ? const DersRengi(Color(0xFF5FC4CC), Color(0xFF313D46)) : const DersRengi(Color(0xFF17717A), Color(0xFFE8F1F2));
    case DersGrubu.sos:
      return koyu ? const DersRengi(Color(0xFFE0B050), Color(0xFF453A32)) : const DersRengi(Color(0xFF7C5A0B), Color(0xFFF2EEE7));
    case DersGrubu.dil:
      return koyu ? const DersRengi(Color(0xFFEE8FBF), Color(0xFF483444)) : const DersRengi(Color(0xFFA33C73), Color(0xFFF6ECF1));
  }
}

/// Site yığını (tokens.css --f-body): önce "AKE Rakam" (yalnız U+0030-0039, Inter rakamları), harfler "AKE Sans" (Atkinson).
/// AkeRakam dosyaları yalnız rakam içerdiği için harfler otomatik yedeğe (AkeSans) düşer; böylece sitedeki gibi sıfır eğik çizgisiz çizilir.
class AkeYazi {
  static const govde = 'AkeRakam';
  static const yedek = <String>['AkeSans'];
  static const serif = 'AkeSerif';
  static const rakam = 'AkeRakam';
}

ThemeData akeTema({required bool koyu}) {
  final t = koyu ? AkeTok.koyuTema : AkeTok.acik;
  final sema = ColorScheme(
    brightness: koyu ? Brightness.dark : Brightness.light,
    primary: t.mercan,
    onPrimary: t.mercanUstu,
    secondary: t.mercanDeko,
    onSecondary: t.mercanUstu,
    error: t.yanlis,
    onError: t.kart,
    surface: t.kagit,
    onSurface: t.murekkep,
  );
  final temel = ThemeData(brightness: koyu ? Brightness.dark : Brightness.light, useMaterial3: true, fontFamily: AkeYazi.govde, fontFamilyFallback: AkeYazi.yedek);
  return temel.copyWith(
    colorScheme: sema,
    scaffoldBackgroundColor: t.kagit,
    canvasColor: t.kagit,
    extensions: <ThemeExtension<dynamic>>[t],
    textTheme: temel.textTheme.apply(bodyColor: t.murekkep, displayColor: t.murekkep, fontFamily: AkeYazi.govde, fontFamilyFallback: AkeYazi.yedek),
    dividerColor: t.cizgi,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.kart,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: TextStyle(color: t.murekkep2),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: t.cizgiGuclu)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: t.cizgiGuclu)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: t.mercan, width: 2)),
    ),
    textSelectionTheme: TextSelectionThemeData(cursorColor: t.mercan, selectionHandleColor: t.mercan),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: t.mercan, linearTrackColor: t.cizgi),
  );
}

/// Basılınca hafifçe küçülen dokunma alanı (mikro etkileşim). Her zaman en az 48 dp yüksekliğinde kullanılmalıdır.
class AkeDokun extends StatefulWidget {
  final Widget child;
  final VoidCallback? basinca;
  final BorderRadius? yaricap;
  const AkeDokun({super.key, required this.child, required this.basinca, this.yaricap});
  @override
  State<AkeDokun> createState() => _AkeDokunState();
}

class _AkeDokunState extends State<AkeDokun> {
  bool _basili = false;
  void _ayarla(bool v) {
    if (_basili != v && mounted) setState(() => _basili = v);
  }

  @override
  Widget build(BuildContext context) {
    final aktif = widget.basinca != null;
    return Semantics(
      button: true,
      enabled: aktif,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: aktif ? (_) => _ayarla(true) : null,
        onTapUp: aktif ? (_) => _ayarla(false) : null,
        onTapCancel: aktif ? () => _ayarla(false) : null,
        onTap: widget.basinca,
        child: AnimatedScale(
          scale: _basili ? 0.97 : 1.0,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: AnimatedOpacity(opacity: _basili ? 0.9 : 1.0, duration: const Duration(milliseconds: 120), child: widget.child),
        ),
      ),
    );
  }
}

enum DugmeTuru { dolu, cizgili, metin }

/// Site düğmeleri: dolu mercan, çizgili, metin. 52 dp yükseklik, 12 dp yarıçap.
class AkeDugme extends StatelessWidget {
  final String etiket;
  final VoidCallback? basinca;
  final DugmeTuru tur;
  final IconData? simge;
  final bool genis;
  const AkeDugme(this.etiket, {super.key, required this.basinca, this.tur = DugmeTuru.dolu, this.simge, this.genis = true});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final aktif = basinca != null;
    Color zemin, yazi, kenar;
    switch (tur) {
      case DugmeTuru.dolu:
        zemin = aktif ? t.mercan : t.girinti;
        yazi = aktif ? t.mercanUstu : t.murekkep3;
        kenar = Colors.transparent;
      case DugmeTuru.cizgili:
        zemin = Colors.transparent;
        yazi = aktif ? t.murekkep : t.murekkep3;
        kenar = aktif ? t.cizgiGuclu : t.cizgi;
      case DugmeTuru.metin:
        zemin = Colors.transparent;
        yazi = aktif ? t.mercan : t.murekkep3;
        kenar = Colors.transparent;
    }
    final govde = Container(
      constraints: BoxConstraints(minHeight: 52, minWidth: genis ? double.infinity : 0),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(color: zemin, borderRadius: BorderRadius.circular(12), border: Border.all(color: kenar)),
      child: Row(mainAxisSize: genis ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
        if (simge != null) ...[Icon(simge, size: 20, color: yazi), const SizedBox(width: 8)],
        Flexible(child: Text(etiket, textAlign: TextAlign.center, style: TextStyle(color: yazi, fontSize: 16, fontWeight: FontWeight.w700))),
      ]),
    );
    return AkeDokun(basinca: basinca, child: govde);
  }
}

/// Kart: beyaz/koyu yüzey, ince çizgi, 16 dp yarıçap. [basinca] verilirse dokunulabilir kart olur.
class KartKutu extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? renk;
  final Color? kenar;
  final VoidCallback? basinca;
  final double yaricap;
  const KartKutu({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.renk, this.kenar, this.basinca, this.yaricap = 16});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final kutu = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: renk ?? t.kart,
        borderRadius: BorderRadius.circular(yaricap),
        border: Border.all(color: kenar ?? t.cizgi),
        boxShadow: t.koyu ? null : const [BoxShadow(color: Color(0x0D28232C), blurRadius: 2, offset: Offset(0, 1)), BoxShadow(color: Color(0x1428232C), blurRadius: 24, spreadRadius: -14, offset: Offset(0, 10))],
      ),
      child: child,
    );
    return basinca == null ? kutu : AkeDokun(basinca: basinca, child: kutu);
  }
}

/// Solda renkli şerit taşıyan kart (sitedeki ders/konu kartları). Flutter, renkleri farklı kenarlığa
/// yuvarlak köşe vermeyi desteklemez; bu yüzden kenarlık tek renk, şerit ise kırpılmış ayrı bir katmandır.
class SolSeritKutu extends StatelessWidget {
  final Widget child;
  final Color serit;
  final double seritGenisligi;
  final Color? renk;
  final Color? kenar;
  final double yaricap;
  final double minYukseklik;
  final EdgeInsetsGeometry padding;
  const SolSeritKutu({
    super.key,
    required this.child,
    required this.serit,
    this.seritGenisligi = 4,
    this.renk,
    this.kenar,
    this.yaricap = 12,
    this.minYukseklik = 0,
    this.padding = const EdgeInsets.fromLTRB(14, 12, 12, 12),
  });

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final ic = padding.resolve(Directionality.of(context));
    return Container(
      width: double.infinity,
      constraints: BoxConstraints(minHeight: minYukseklik),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: renk ?? t.kart,
        borderRadius: BorderRadius.circular(yaricap),
        border: Border.all(color: kenar ?? t.cizgi),
      ),
      child: Stack(children: [
        Padding(padding: ic.copyWith(left: ic.left + seritGenisligi - 1), child: child),
        Positioned(left: 0, top: 0, bottom: 0, width: seritGenisligi, child: ColoredBox(color: serit)),
      ]),
    );
  }
}

/// Küçük hap biçimli etiket (örn. "0/5 tamam").
class Hap extends StatelessWidget {
  final String metin;
  final Color? zemin;
  final Color? yazi;
  const Hap(this.metin, {super.key, this.zemin, this.yazi});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: zemin ?? t.mercanYumusak, borderRadius: BorderRadius.circular(999)),
      child: Text(metin, style: TextStyle(color: yazi ?? t.mercan, fontWeight: FontWeight.w700, fontSize: 12.5)),
    );
  }
}

/// Rakamlar için site yazı tipi (AKE Rakam).
TextStyle rakamStili(Color renk, double boyut, {FontWeight agirlik = FontWeight.w700}) =>
    TextStyle(fontFamily: AkeYazi.rakam, fontFamilyFallback: AkeYazi.yedek, fontSize: boyut, fontWeight: agirlik, color: renk, height: 1.05);
