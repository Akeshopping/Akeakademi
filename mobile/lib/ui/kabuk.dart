import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../durum/uygulama.dart';
import '../veri/hesap_verisi.dart';
import 'ana_sayfa.dart';
import 'ai.dart';
import 'deneme.dart';
import 'marka.dart';
import 'menu.dart';
import 'secim.dart';
import 'tema.dart';

class _Sekme {
  final String ad;
  final IconData simge;
  final IconData dolu;
  const _Sekme(this.ad, this.simge, this.dolu);
}

const _sekmeler = [
  _Sekme('Ana sayfa', Icons.home_outlined, Icons.home_outlined),
  _Sekme('Soru çöz', Icons.dns_outlined, Icons.dns_outlined),
  _Sekme('Deneme', Icons.timer_outlined, Icons.timer_outlined),
  _Sekme('AI', Icons.auto_awesome_outlined, Icons.auto_awesome_outlined),
  _Sekme('Menü', Icons.menu_rounded, Icons.menu_rounded),
];

/// Giriş yapılmış uygulama kabuğu: koyu mürekkep üst çubuk (K amblemi + kalan gün), sayfa alanı, koyu alt gezinme (site mobil menüsü).
class AnaEkran extends StatefulWidget {
  final UygulamaModeli model;
  const AnaEkran({super.key, required this.model});
  @override
  State<AnaEkran> createState() => _AnaEkranState();
}

class _AnaEkranState extends State<AnaEkran> {
  final Set<int> _acilan = {0};
  HesapVerisi? _veri; // üst çubuktaki kalan gün için (Ana sayfa yükleyince doldurur)
  UygulamaModeli get m => widget.model;

  @override
  void initState() {
    super.initState();
    m.addListener(_dinle);
  }

  @override
  void dispose() {
    m.removeListener(_dinle);
    super.dispose();
  }

  void _dinle() {
    if (!mounted) return;
    setState(() => _acilan.add(m.sekme));
  }

  void _veriGeldi(HesapVerisi v) {
    if (mounted && _veri == null) setState(() => _veri = v);
  }

  Widget _sayfa(int i) {
    switch (i) {
      case 0:
        return AnaSayfa(model: m, veriGeldi: _veriGeldi);
      case 1:
        return SoruCozSekmesi(model: m);
      case 2:
        return DenemeSekmesi(model: m);
      case 3:
        return AiSekmesi(model: m);
      default:
        return MenuSekmesi(model: m);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return PopScope(
      canPop: m.sekme == 0 && m.menuSayfasi == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) m.geriGit();
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: t.ustCubuk, systemNavigationBarColor: t.ustCubuk, systemNavigationBarIconBrightness: Brightness.light),
      child: Scaffold(
        backgroundColor: t.kagit,
        body: Column(children: [
          _UstCubuk(model: m, kalanGun: _veri?.kalanGun(DateTime.now())),
          Expanded(
            child: IndexedStack(index: m.sekme, children: [
              for (var i = 0; i < _sekmeler.length; i++) _acilan.contains(i) ? _sayfa(i) : const SizedBox.shrink(),
            ]),
          ),
          _AltGezinme(secili: m.sekme, secince: m.sekmeGit),
        ]),
      ),
      ),
    );
  }
}

class _UstCubuk extends StatelessWidget {
  final UygulamaModeli model;
  final int? kalanGun;
  const _UstCubuk({required this.model, required this.kalanGun});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final ad = model.kullanici?.ad.trim() ?? '';
    final eposta = model.kullanici?.eposta ?? '';
    final bas = (ad.isNotEmpty ? ad : eposta).isNotEmpty ? (ad.isNotEmpty ? ad : eposta).substring(0, 1).toUpperCase() : '?';
    return Container(
      color: t.ustCubuk,
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
      child: Container(
        height: 58,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08)))),
        child: Row(children: [
          const AmblemKutu(boyut: 32),
          const SizedBox(width: 10),
          Expanded(child: Align(alignment: Alignment.centerLeft, child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: AkeYaziMarka(renk: t.ustMetin, akademiGoster: false)))),
          Semantics(
            button: true,
            label: 'Temayı değiştir',
            child: AkeDokun(
              basinca: () => model.temaDegistir(Theme.of(context).brightness == Brightness.dark ? ThemeMode.light : ThemeMode.dark),
              child: SizedBox(
                key: const ValueKey('tema-dugmesi'),
                width: 48,
                height: 48,
                child: Icon(Theme.of(context).brightness == Brightness.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, color: t.ustMetin, size: 22),
              ),
            ),
          ),
          Semantics(
            button: true,
            label: 'Hesabım ve ayarlar',
            child: AkeDokun(
              basinca: () => model.menuyeGit(MenuSayfasi.ayarlar),
              child: SizedBox(
                width: 48,
                height: 48,
                child: Center(
                  child: Container(
                    width: 32,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AkeTok.acik.mercanAcik, shape: BoxShape.circle),
                    child: Text(bas, style: const TextStyle(color: AkeTok.murekkepSabit, fontWeight: FontWeight.w700, fontSize: 14)),
                  ),
                ),
              ),
            ),
          ),
          if (kalanGun != null)
            Semantics(
              label: 'YKS 2027 sınavına $kalanGun gün kaldı',
              child: ExcludeSemantics(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: Colors.white.withValues(alpha: 0.06), border: Border.all(color: Colors.white.withValues(alpha: 0.16))),
                  child: Text('$kalanGun', style: rakamStili(AkeTok.acik.mercanAcik, 15, agirlik: FontWeight.w700)),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

class _AltGezinme extends StatelessWidget {
  final int secili;
  final ValueChanged<int> secince;
  const _AltGezinme({required this.secili, required this.secince});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return Container(
      decoration: BoxDecoration(color: t.ustCubuk, border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08)))),
      padding: EdgeInsets.fromLTRB(6, 6, 6, 6 + MediaQuery.paddingOf(context).bottom),
      child: Row(children: [
        for (var i = 0; i < _sekmeler.length; i++)
          Expanded(
            key: ValueKey('sekme-$i'),
            child: Semantics(
              selected: i == secili,
              button: true,
              label: _sekmeler[i].ad,
              child: ExcludeSemantics(
                child: AkeDokun(
                  basinca: () => secince(i),
                  child: SizedBox(
                    height: 52,
                    child: Column(mainAxisAlignment: MainAxisAlignment.start, children: [
                      // Sitedeki gibi: etkin sekmede üstte mercan çizgi, simge mercan; pasifte ince çizgili gri simge.
                      AnimatedContainer(duration: const Duration(milliseconds: 200), curve: Curves.easeOut, width: i == secili ? 32 : 0, height: 2.5, decoration: BoxDecoration(color: AkeTok.acik.mercanAcik, borderRadius: BorderRadius.circular(2))),
                      const SizedBox(height: 7),
                      Icon(_sekmeler[i].simge, size: 22, color: i == secili ? AkeTok.acik.mercanAcik : AkeTok.uzerindeKoyu3),
                      const SizedBox(height: 3),
                      Text(_sekmeler[i].ad, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, fontWeight: i == secili ? FontWeight.w700 : FontWeight.w600, color: i == secili ? AkeTok.porselen : AkeTok.uzerindeKoyu3)),
                    ]),
                  ),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}
