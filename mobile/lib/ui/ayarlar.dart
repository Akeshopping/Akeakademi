import 'package:flutter/material.dart';

import '../durum/uygulama.dart';
import '../yapilandirma.dart';
import 'tema.dart';

/// Ayarlar ve hesap: tema (gerçek), çıkış (gerçek). Olmayan özellikler (hesap silme, bildirimler) açıkça "yok" diye yazılır.
class AyarlarSekmesi extends StatelessWidget {
  final UygulamaModeli model;
  const AyarlarSekmesi({super.key, required this.model});

  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        final ad = model.kullanici?.ad.trim() ?? '';
        final eposta = model.kullanici?.eposta ?? '';
        final baslik = ad.isNotEmpty ? ad : eposta;
        final bas = baslik.isEmpty ? '?' : baslik.substring(0, 1).toUpperCase();
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          children: [
            const Text('Ayarlar', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.15)),
            const SizedBox(height: 14),
            KartKutu(
              child: Row(children: [
                Container(width: 48, height: 48, alignment: Alignment.center, decoration: BoxDecoration(color: AkeTok.acik.mercanAcik, shape: BoxShape.circle), child: Text(bas, style: const TextStyle(color: AkeTok.murekkepSabit, fontWeight: FontWeight.w700, fontSize: 20))),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(baslik, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    if (ad.isNotEmpty && eposta.isNotEmpty) Text(eposta, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: t.murekkep2, fontSize: 13)),
                    Text('Ücretsiz hesap', style: TextStyle(color: t.murekkep3, fontSize: 12.5)),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 14),
            KartKutu(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Görünüm', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                _TemaSecici(model: model),
              ]),
            ),
            const SizedBox(height: 14),
            KartKutu(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Hesap', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text('Hesap silme ve bildirim ayarları mobilde henüz yok.', style: TextStyle(color: t.murekkep2, height: 1.4)),
                const SizedBox(height: 14),
                AkeDugme('Çıkış yap', tur: DugmeTuru.cizgili, simge: Icons.logout_rounded, basinca: () => _cikisSor(context)),
              ]),
            ),
            const SizedBox(height: 18),
            Center(child: Text('AKE Akademi · test sürümü · sunucu: ${Yapilandirma.apiKisa()}', textAlign: TextAlign.center, style: TextStyle(color: t.murekkep3, fontSize: 12))),
          ],
        );
      },
    );
  }

  Future<void> _cikisSor(BuildContext context) async {
    final onay = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Çıkış yapılsın mı?'),
        content: const Text('İlerlemen hesabında durur; tekrar giriş yapınca kaldığın yerden devam edersin.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Vazgeç')),
          TextButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Çıkış yap')),
        ],
      ),
    );
    if (onay == true) await model.cikis();
  }
}

class _TemaSecici extends StatelessWidget {
  final UygulamaModeli model;
  const _TemaSecici({required this.model});
  @override
  Widget build(BuildContext context) {
    final t = context.ake;
    Widget secenek(String ad, IconData ic, ThemeMode m) {
      final secili = model.tema == m;
      return Expanded(
        child: Semantics(
          selected: secili,
          button: true,
          label: 'Tema: $ad',
          child: ExcludeSemantics(
            child: AkeDokun(
              basinca: () => model.temaDegistir(m),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 52,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  color: secili ? t.mercanYumusak : t.kart,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: secili ? t.mercan : t.cizgiGuclu, width: secili ? 2 : 1),
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(ic, size: 18, color: secili ? t.mercan : t.murekkep2),
                  const SizedBox(width: 6),
                  Flexible(child: Text(ad, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: secili ? t.mercan : t.murekkep))),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    return Row(children: [
      secenek('Sistem', Icons.brightness_auto_rounded, ThemeMode.system),
      secenek('Açık', Icons.light_mode_outlined, ThemeMode.light),
      secenek('Koyu', Icons.dark_mode_outlined, ThemeMode.dark),
    ]);
  }
}
