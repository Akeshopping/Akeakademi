import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../durum/uygulama.dart';
import '../veri/hesap_verisi.dart';
import 'ana_sayfa.dart';
import 'ayarlar.dart';
import 'gelisim.dart';
import 'marka.dart';
import 'plan.dart';
import 'secim.dart';
import 'tema.dart';

class _Sekme {
  final String ad;
  final IconData simge;
  final IconData dolu;
  const _Sekme(this.ad, this.simge, this.dolu);
}

const _sekmeler = [
  _Sekme('Ana sayfa', Icons.home_outlined, Icons.home_rounded),
  _Sekme('Soru çöz', Icons.layers_outlined, Icons.layers_rounded),
  _Sekme('Gelişim', Icons.show_chart_rounded, Icons.show_chart_rounded),
  _Sekme('Plan', Icons.event_note_outlined, Icons.event_note_rounded),
  _Sekme('Ayarlar', Icons.tune_rounded, Icons.tune_rounded),
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
        return GelisimSekmesi(model: m);
      case 3:
        return PlanSekmesi(model: m);
      default:
        return AyarlarSekmesi(model: m);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return AnnotatedRegion<SystemUiOverlayStyle>(
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
            label: 'Hesabım ve ayarlar',
            child: AkeDokun(
              basinca: () => model.sekmeGit(4),
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
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        curve: Curves.easeOut,
                        width: 44,
                        height: 26,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(borderRadius: BorderRadius.circular(13), color: i == secili ? Colors.white.withValues(alpha: 0.09) : Colors.transparent),
                        child: Icon(i == secili ? _sekmeler[i].dolu : _sekmeler[i].simge, size: 22, color: i == secili ? AkeTok.acik.mercanAcik : AkeTok.uzerindeKoyu3),
                      ),
                      const SizedBox(height: 2),
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
