import 'package:flutter/material.dart';

import '../veri/ilerleme.dart';
import '../veri/katalog.dart';
import 'ortak.dart';
import 'tema.dart';

/// Hesaptaki ilerleme: bekleyen kayıtlar önce yazılır, sonra veri SUNUCUDAN okunur (yerel belleğe güvenilmez).
class IlerlemeEkrani extends StatefulWidget {
  final IlerlemeSenkron senkron;
  const IlerlemeEkrani({super.key, required this.senkron});
  @override
  State<IlerlemeEkrani> createState() => _IlerlemeEkraniState();
}

class _IlerlemeEkraniState extends State<IlerlemeEkrani> {
  late Future<Map<String, KonuIlerlemesi>> _veri;

  @override
  void initState() {
    super.initState();
    _veri = _yukle();
  }

  Future<Map<String, KonuIlerlemesi>> _yukle() async {
    await widget.senkron.bosalt();
    return widget.senkron.hesaptanOku();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hesabımdaki ilerleme')),
      body: FutureBuilder<Map<String, KonuIlerlemesi>>(
        future: _veri,
        builder: (context, s) {
          if (s.connectionState != ConnectionState.done) return const Yukleniyor(metin: 'İlerlemen getiriliyor…');
          if (s.hasError) {
            return DurumKutusu(simge: Icons.cloud_off, baslik: 'İlerleme getirilemedi', aciklama: hataMetni(s.error!), dugme: 'Tekrar dene', basinca: () => setState(() => _veri = _yukle()));
          }
          final liste = s.data!.entries.where((e) => e.value.cozulen > 0 || e.value.bos > 0).toList()
            ..sort((a, b) => b.value.toplam.compareTo(a.value.toplam));
          if (liste.isEmpty) {
            return const DurumKutusu(simge: Icons.insights_outlined, baslik: 'Henüz ilerleme yok', aciklama: 'Bir konudan soru çözdüğünde ilerlemen burada görünür.');
          }
          return ListView(padding: const EdgeInsets.all(16), children: [
            for (final e in liste) ...[
              _KonuSatiri(anahtar: e.key, ilerleme: e.value),
              const SizedBox(height: 10),
            ],
          ]);
        },
      ),
    );
  }
}

class _KonuSatiri extends StatelessWidget {
  final String anahtar;
  final KonuIlerlemesi ilerleme;
  const _KonuSatiri({required this.anahtar, required this.ilerleme});
  @override
  Widget build(BuildContext context) {
    final parca = anahtar.split('|');
    final ders = Katalog.dersAdi(parca.first), konu = parca.length > 1 ? parca.sublist(1).join('|') : '';
    final yuzde = ilerleme.cozulen == 0 ? 0 : (ilerleme.dogru * 100 / ilerleme.cozulen).round();
    return Semantics(
      label: '$ders, $konu: ${ilerleme.dogru} doğru, ${ilerleme.yanlis} yanlış, yüzde $yuzde',
      child: KartKutu(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(konu.isEmpty ? ders : konu, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          Text(ders, style: const TextStyle(color: AkeRenk.murekkep2, fontSize: 13)),
          const SizedBox(height: 10),
          LinearProgressIndicator(value: yuzde / 100, minHeight: 6, color: AkeRenk.dogru, backgroundColor: AkeRenk.cizgi),
          const SizedBox(height: 8),
          Text('${ilerleme.dogru} doğru · ${ilerleme.yanlis} yanlış · %$yuzde', style: const TextStyle(color: AkeRenk.murekkep2)),
        ]),
      ),
    );
  }
}
