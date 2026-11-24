import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../veri/hesap_verisi.dart';
import '../veri/katalog.dart';
import 'ortak.dart';
import 'tema.dart';

/// Plan: sitede hazırladığın haftalık görevler (salt okunur). Görev ekleme/işaretleme mobilde henüz yok; bu açıkça yazılır.
class PlanSekmesi extends StatefulWidget {
  final UygulamaModeli model;
  const PlanSekmesi({super.key, required this.model});
  @override
  State<PlanSekmesi> createState() => _PlanSekmesiState();
}

class _PlanSekmesiState extends State<PlanSekmesi> {
  late Future<HesapVerisi> _f;

  @override
  void initState() {
    super.initState();
    _f = widget.model.hesapVerisi();
  }

  Future<void> _yenile() async {
    final y = widget.model.hesapVerisi();
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
          if (s.connectionState != ConnectionState.done) return const Yukleniyor(metin: 'Planın getiriliyor…');
          if (s.hasError) return DurumKutusu(simge: Icons.cloud_off, baslik: 'Plan getirilemedi', aciklama: hataMetni(s.error!), dugme: 'Tekrar dene', basinca: _yenile);
          final v = s.data!;
          final bugun = DateTime.now().weekday - 1;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            children: [
              const Text('Planım', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
              const SizedBox(height: 4),
              Text('Haftalık görevlerin sitede hazırlanır; burada görürsün.', style: TextStyle(color: t.murekkep2, height: 1.4)),
              const SizedBox(height: 14),
              if (v.plan.isEmpty)
                const KartKutu(child: Text('Henüz plan görevin yok. Görevleri akeakademi.com üzerinde “Planım” bölümünden ekleyebilirsin; eklediğinde burada görünür.', style: TextStyle(height: 1.5)))
              else
                for (var g = 0; g < 7; g++)
                  if (v.plan.any((p) => p.gun == g)) ...[
                    _Gun(gun: g, bugun: g == bugun, gorevler: v.plan.where((p) => p.gun == g).toList()),
                    const SizedBox(height: 12),
                  ],
              const SizedBox(height: 4),
              Text('Mobilde görev ekleme ve işaretleme henüz yok.', style: TextStyle(color: t.murekkep3, fontSize: 12.5)),
            ],
          );
        },
      ),
    );
  }
}

class _Gun extends StatelessWidget {
  final int gun;
  final bool bugun;
  final List<PlanGorevi> gorevler;
  const _Gun({required this.gun, required this.bugun, required this.gorevler});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return KartKutu(
      kenar: bugun ? t.mercan : null,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(gunAdlari[gun], style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
          if (bugun) const Hap('Bugün'),
        ]),
        const SizedBox(height: 6),
        for (final g in gorevler) _Gorev(g: g),
      ]),
    );
  }
}

class _Gorev extends StatelessWidget {
  final PlanGorevi g;
  const _Gorev({required this.g});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final r = g.ders.isEmpty ? null : dersRengi(context, g.ders);
    return Semantics(
      label: '${g.metin}${g.bitti ? ', tamamlandı' : ''}',
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.cizgi))),
          child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Icon(g.bitti ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 22, color: g.bitti ? t.dogru : t.cizgiGuclu),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(g.metin, style: TextStyle(fontWeight: FontWeight.w600, height: 1.3, decoration: g.bitti ? TextDecoration.lineThrough : null, color: g.bitti ? t.murekkep3 : t.murekkep)),
                if (r != null || g.dakika > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text([if (g.ders.isNotEmpty) Katalog.dersAdi(g.ders), if (g.dakika > 0) '${g.dakika} dk'].join(' · '), style: TextStyle(color: r?.metin ?? t.murekkep2, fontSize: 12.5)),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
