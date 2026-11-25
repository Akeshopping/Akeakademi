import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import 'ayarlar.dart';
import 'gelisim.dart';
import 'plan.dart';
import 'tema.dart';

/// Sitedeki "Menü": Gelişim, Plan, Ayarlar ve hesap buradan açılır. Alt sayfa açıkken üstte "Menü" geri satırı görünür.
class MenuSekmesi extends StatelessWidget {
  final UygulamaModeli model;
  const MenuSekmesi({super.key, required this.model});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        final s = model.menuSayfasi;
        if (s == null) return _Liste(model: model);
        final (baslik, icerik) = switch (s) {
          MenuSayfasi.gelisim => ('Gelişim', GelisimSekmesi(model: model)),
          MenuSayfasi.plan => ('Plan', PlanSekmesi(model: model)),
          MenuSayfasi.ayarlar => ('Ayarlar ve hesap', AyarlarSekmesi(model: model)),
        };
        final t = context.ake;
        return Column(children: [
          Semantics(
            button: true,
            label: 'Menüye dön',
            child: AkeDokun(
              basinca: () => model.menuyeGit(null),
              child: Container(
                key: const ValueKey('menu-geri'),
                height: 48,
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: t.cizgi))),
                child: Row(children: [
                  Icon(Icons.arrow_back_rounded, size: 20, color: t.murekkep2),
                  const SizedBox(width: 8),
                  Text('Menü', style: TextStyle(color: t.murekkep2, fontWeight: FontWeight.w600)),
                  Flexible(child: Text('  ›  $baslik', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.murekkep3))),
                ]),
              ),
            ),
          ),
          Expanded(child: icerik),
        ]);
      },
    );
  }
}

class _Liste extends StatelessWidget {
  final UygulamaModeli model;
  const _Liste({required this.model});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    final ad = model.kullanici?.ad.trim() ?? '';
    final eposta = model.kullanici?.eposta ?? '';
    final baslik = ad.isNotEmpty ? ad : eposta;
    final bas = baslik.isEmpty ? '?' : baslik.substring(0, 1).toUpperCase();
    Widget satir(String anahtar, IconData ic, String ad, String alt, MenuSayfasi s) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Semantics(
          button: true,
          label: '$ad, $alt',
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: () => model.menuyeGit(s),
              child: KartKutu(
                key: ValueKey('menu-$anahtar'),
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                child: Row(children: [
                  Container(width: 42, height: 42, decoration: BoxDecoration(color: t.mercanYumusak, borderRadius: BorderRadius.circular(12)), child: Icon(ic, color: t.mercan, size: 22)),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(ad, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(alt, style: TextStyle(color: t.murekkep2, fontSize: 13, height: 1.3)),
                    ]),
                  ),
                  Icon(Icons.chevron_right_rounded, color: t.murekkep3),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: [
        const Text('Menü', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
        const SizedBox(height: 14),
        KartKutu(
          child: Row(children: [
            Container(width: 48, height: 48, alignment: Alignment.center, decoration: BoxDecoration(color: AkeTok.acik.mercanAcik, shape: BoxShape.circle), child: Text(bas, style: const TextStyle(color: AkeTok.murekkepSabit, fontWeight: FontWeight.w700, fontSize: 18))),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(baslik, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                if (ad.isNotEmpty && eposta.isNotEmpty) Text(eposta, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.murekkep2, fontSize: 13)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        satir('gelisim', Icons.show_chart_rounded, 'Gelişim', 'Çözülen soru, doğruluk, konu başarısı', MenuSayfasi.gelisim),
        satir('plan', Icons.event_note_rounded, 'Plan', 'Haftalık görevlerini ekle, işaretle, düzenle', MenuSayfasi.plan),
        satir('ayarlar', Icons.tune_rounded, 'Ayarlar ve hesap', 'Profil, hedef, görünüm, paket, hesabı sil', MenuSayfasi.ayarlar),
        const SizedBox(height: 8),
        Text('Mobilde henüz olmayanlar: bildirimler, arkadaş ligi ve Sınıfım, canlı deneme, yanlış defteri, kartlar. Ödeme/paket satın alma ayrı bir iş olarak ele alınacak.', style: TextStyle(color: t.murekkep3, fontSize: 12.5, height: 1.4)),
      ],
    );
  }
}
